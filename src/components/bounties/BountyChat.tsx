import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Send, MessageSquare, Lock, Trash2, Shield, Upload, FileCode, Download, Loader2, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import DOMPurify from "dompurify";

interface BountyChatProps {
  bountyId: string;
  bountyStatus: string;
  requesterId: string;
  assignedModderId: string | null;
  isAdmin?: boolean;
  isPaid?: boolean;
  isPurchaseCompleted?: boolean;
}

export function BountyChat({ bountyId, bountyStatus, requesterId, assignedModderId, isAdmin, isPaid, isPurchaseCompleted }: BountyChatProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isParticipant = user && (user.id === requesterId || user.id === assignedModderId);
  const isModderUser = user?.id === assignedModderId;
  const isRequesterUser = user?.id === requesterId;
  const canView = isParticipant || isAdmin;
  const canSend = isParticipant && bountyStatus === "in_progress";

  const { data: messages } = useQuery({
    queryKey: ["bounty-messages", bountyId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bounty_messages")
        .select(`
          *,
          profiles:sender_id(username, display_name, avatar_url, user_id)
        `)
        .eq("bounty_id", bountyId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!canView,
  });

  // Fetch deliveries
  const { data: deliveries } = useQuery({
    queryKey: ["bounty-deliveries", bountyId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bounty_deliveries")
        .select("*")
        .eq("bounty_id", bountyId)
        .order("delivered_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!canView,
  });

  // Realtime subscription
  useEffect(() => {
    if (!canView) return;

    const channel = supabase
      .channel(`bounty-chat-${bountyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bounty_messages", filter: `bounty_id=eq.${bountyId}` },
        () => { queryClient.invalidateQueries({ queryKey: ["bounty-messages", bountyId] }); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bounty_deliveries", filter: `bounty_id=eq.${bountyId}` },
        () => { queryClient.invalidateQueries({ queryKey: ["bounty-deliveries", bountyId] }); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [bountyId, canView, queryClient]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!user || !message.trim() || !canSend) return;
    const content = message.trim();
    if (content.length > 2000) { toast.error("Mensagem muito longa (máx 2000 caracteres)."); return; }

    setSending(true);
    const { error } = await (supabase as any).from("bounty_messages").insert({
      bounty_id: bountyId, sender_id: user.id, content,
    });
    setSending(false);
    if (error) { toast.error("Erro ao enviar mensagem: " + error.message); return; }
    setMessage("");
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!isAdmin) return;
    const { error } = await (supabase as any).from("bounty_messages").delete().eq("id", msgId);
    if (error) { toast.error(error.message); return; }
    toast.success("Mensagem removida.");
    queryClient.invalidateQueries({ queryKey: ["bounty-messages", bountyId] });
  };

  // File upload (modder only)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !isModderUser) return;

    if (!file.name.endsWith(".lua")) {
      toast.error("Apenas arquivos .lua são aceitos.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 5MB).");
      return;
    }

    setUploading(true);
    try {
      const filePath = `${user.id}/${bountyId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("bounty-deliveries")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create delivery record
      const { error: dbError } = await (supabase as any).from("bounty_deliveries").insert({
        bounty_id: bountyId,
        modder_id: user.id,
        file_url: filePath,
        file_name: file.name,
      });

      if (dbError) throw dbError;

      // Send a system-like chat message
      await (supabase as any).from("bounty_messages").insert({
        bounty_id: bountyId,
        sender_id: user.id,
        content: `📦 Script entregue: "${file.name}" — aguardando pagamento para liberação do download.`,
      });

      toast.success("Script entregue com sucesso! 📦");
      queryClient.invalidateQueries({ queryKey: ["bounty-deliveries", bountyId] });
    } catch (err: any) {
      toast.error("Erro ao enviar arquivo: " + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Secure download
  const handleDownload = async (deliveryId: string) => {
    setDownloading(deliveryId);
    try {
      const { data, error } = await supabase.functions.invoke("download-bounty-delivery", {
        body: { delivery_id: deliveryId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.url) {
        const a = document.createElement("a");
        a.href = data.url;
        a.download = data.file_name || "script.lua";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("Download iniciado! ⬇️");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao baixar arquivo.");
    } finally {
      setDownloading(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (!canView) return null;

  const hasDeliveries = deliveries && deliveries.length > 0;

  return (
    <div className="border border-white/5 bg-[#050505]">
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-[#030304] flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
          <MessageSquare className="h-4 w-4 text-neon-cyan" />
          Chat da Encomenda
        </h2>
        <div className="flex items-center gap-2">
          {isAdmin && !isParticipant && (
            <span className="text-[10px] font-mono text-neon-purple/70 uppercase tracking-widest flex items-center gap-1">
              <Shield className="h-3 w-3" /> Visualizando como admin
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">Privado</span>
          </div>
        </div>
      </div>

      {/* Delivery Section */}
      {hasDeliveries && (
        <div className="p-4 border-b border-white/5 bg-neon-green/5 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-neon-green flex items-center gap-1.5">
            <FileCode className="h-3.5 w-3.5" /> Entregas ({deliveries.length})
          </p>
          {deliveries.map((del: any) => {
            const canDownload = isModderUser || isAdmin || (isRequesterUser && (del.released || !isPaid));
            return (
              <div key={del.id} className="flex items-center justify-between gap-3 p-3 bg-[#030304] border border-white/5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileCode className="h-4 w-4 text-neon-cyan shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-white truncate">{del.file_name}</p>
                    <p className="text-[9px] text-muted-foreground/50 font-mono">
                      {formatDistanceToNow(new Date(del.delivered_at), { locale: ptBR, addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {del.released ? (
                    <span className="text-[9px] text-neon-green font-mono flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Liberado
                    </span>
                  ) : isPaid ? (
                    <span className="text-[9px] text-yellow-500 font-mono flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Aguardando pagamento
                    </span>
                  ) : null}
                  {canDownload ? (
                    <Button
                      size="sm"
                      onClick={() => handleDownload(del.id)}
                      disabled={downloading === del.id}
                      className="h-7 px-3 rounded-none bg-neon-green/10 hover:bg-neon-green/20 text-neon-green border border-neon-green/30 text-[10px] font-black uppercase tracking-widest"
                    >
                      {downloading === del.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                      Baixar
                    </Button>
                  ) : (
                    <span className="text-[9px] text-destructive/70 font-mono">🔒 Pague para baixar</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="p-4 space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        {!messages || messages.length === 0 ? (
          <div className="py-12 text-center">
            <MessageSquare className="h-8 w-8 text-neon-cyan/15 mx-auto mb-3" />
            <p className="text-xs text-muted-foreground/50 font-mono">
              {bountyStatus === "in_progress" ? "Nenhuma mensagem ainda. Inicie a conversa!" : "Chat disponível apenas durante a execução."}
            </p>
          </div>
        ) : (
          messages.map((msg: any) => {
            const isMine = msg.sender_id === user?.id;
            const name = msg.profiles?.display_name ?? msg.profiles?.username ?? "Anônimo";
            const isRequesterMsg = msg.sender_id === requesterId;

            return (
              <div key={msg.id} className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"} group`}>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isRequesterMsg ? "text-neon-purple/70" : "text-neon-cyan/70"}`}>
                    {isMine ? "Você" : name}
                  </span>
                  <span className="text-[9px] text-muted-foreground/40 font-mono">
                    {formatDistanceToNow(new Date(msg.created_at), { locale: ptBR, addSuffix: true })}
                  </span>
                  {isAdmin && (
                    <button onClick={() => handleDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive/50 hover:text-destructive p-0.5" title="Excluir mensagem">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed ${isMine ? "bg-neon-purple/10 border border-neon-purple/20 text-foreground/90" : "bg-[#030304] border border-white/5 text-foreground/80"}`}>
                  {DOMPurify.sanitize(msg.content, { ALLOWED_TAGS: [] })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      {canSend ? (
        <div className="p-4 border-t border-white/5 bg-[#030304] space-y-3">
          {/* Modder upload button */}
          {isModderUser && bountyStatus === "in_progress" && (
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept=".lua" onChange={handleFileUpload} className="hidden" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-none text-[10px] font-black uppercase tracking-widest border-neon-green/30 text-neon-green hover:bg-neon-green/10"
              >
                {uploading ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Upload className="h-3 w-3 mr-1.5" />}
                {uploading ? "Enviando..." : "Entregar Script (.lua)"}
              </Button>
              <span className="text-[9px] text-muted-foreground/40 font-mono">
                O script fica protegido até o pagamento ser confirmado
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              rows={1}
              maxLength={2000}
              className="flex-1 bg-[#050505] border border-white/10 focus:border-neon-cyan/30 focus:outline-none focus:ring-1 focus:ring-neon-cyan/20 px-4 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className="shrink-0 h-10 w-10 flex items-center justify-center bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[9px] text-muted-foreground/30 font-mono">
            Enter para enviar · Shift+Enter para nova linha · {message.length}/2000
          </p>
        </div>
      ) : bountyStatus === "completed" ? (
        <div className="p-3 border-t border-white/5 text-center">
          <p className="text-[10px] text-muted-foreground/40 font-mono uppercase tracking-widest">
            Encomenda concluída — chat encerrado
          </p>
        </div>
      ) : isAdmin && !isParticipant ? (
        <div className="p-3 border-t border-white/5 text-center">
          <p className="text-[10px] text-muted-foreground/40 font-mono uppercase tracking-widest">
            Modo visualização admin — somente leitura
          </p>
        </div>
      ) : null}
    </div>
  );
}
