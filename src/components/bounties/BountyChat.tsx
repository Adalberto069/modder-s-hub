import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Send, MessageSquare, Lock, Trash2, Shield, Upload, FileCode, Download,
  Loader2, ShieldCheck, FlaskConical, CheckCircle, AlertTriangle, XCircle, Timer
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import DOMPurify from "dompurify";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  const [testing, setTesting] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
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
        .select(`*, profiles:sender_id(username, display_name, avatar_url, user_id)`)
        .eq("bounty_id", bountyId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!canView,
  });

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

  // Check test logs for rate limit display
  const { data: testLogs } = useQuery({
    queryKey: ["bounty-test-logs", bountyId, user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bounty_test_logs")
        .select("delivery_id")
        .eq("bounty_id", bountyId)
        .eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!canView && !!user,
  });

  const getTestCountForDelivery = (deliveryId: string) => {
    return testLogs?.filter((log: any) => log.delivery_id === deliveryId).length ?? 0;
  };

  useEffect(() => {
    if (!canView) return;
    const channel = supabase
      .channel(`bounty-chat-${bountyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bounty_messages", filter: `bounty_id=eq.${bountyId}` },
        () => { queryClient.invalidateQueries({ queryKey: ["bounty-messages", bountyId] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "bounty_deliveries", filter: `bounty_id=eq.${bountyId}` },
        () => { queryClient.invalidateQueries({ queryKey: ["bounty-deliveries", bountyId] }); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bountyId, canView, queryClient]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !isModderUser) return;
    if (!file.name.endsWith(".lua")) { toast.error("Apenas arquivos .lua são aceitos."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 5MB)."); return; }

    setUploading(true);
    try {
      // 1) Read file content for security analysis
      const code = await file.text();

      // 2) Run heuristic security analysis BEFORE upload
      toast.info("🔍 Analisando segurança do script...");
      const { data: analysis, error: analysisError } = await supabase.functions.invoke("analyze-script", {
        body: { code },
      });
      if (analysisError) {
        console.warn("Falha na análise:", analysisError);
      }

      // 3) Block if classified as malicious
      if (analysis?.classification === "malicious") {
        const reasons = (analysis.threats ?? []).slice(0, 3).map((t: any) => t.description || t.type).join(" • ");
        toast.error(
          `🔴 Entrega bloqueada — Alto Risco detectado.\n${reasons || "Padrões suspeitos críticos encontrados."}`,
          { duration: 8000 }
        );
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      // 4) Warn if suspicious but allow
      if (analysis?.classification === "suspicious") {
        toast.warning("🟡 Script suspeito — entrega permitida, mas o solicitante será avisado.", { duration: 6000 });
      }

      const filePath = `${user.id}/${bountyId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("bounty-deliveries").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await (supabase as any).from("bounty_deliveries").insert({
        bounty_id: bountyId, modder_id: user.id, file_url: filePath, file_name: file.name,
      });
      if (dbError) throw dbError;

      const securityNote = analysis?.classification === "suspicious" ? " ⚠️ (análise: suspeito)" : " ✅ (análise: seguro)";
      await (supabase as any).from("bounty_messages").insert({
        bounty_id: bountyId, sender_id: user.id,
        content: `📦 Script entregue: "${file.name}"${securityNote} — o solicitante deve testar e aprovar antes do pagamento.`,
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

  // Test download (time-limited)
  const handleTestDownload = async (deliveryId: string) => {
    setTesting(deliveryId);
    try {
      const { data, error } = await supabase.functions.invoke("test-bounty-delivery", {
        body: { delivery_id: deliveryId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.test_code) {
        const blob = new Blob([data.test_code], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.file_name || "teste_script.lua";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Script de teste baixado! Expira em ${data.expires_minutes} minutos ⏰`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar teste.");
    } finally {
      setTesting(null);
    }
  };

  // Approve delivery
  const handleApprove = async (deliveryId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("bounty_deliveries")
        .update({ test_approved: true })
        .eq("id", deliveryId);
      if (error) throw error;

      await (supabase as any).from("bounty_messages").insert({
        bounty_id: bountyId, sender_id: user!.id,
        content: "✅ Script aprovado pelo solicitante! Prosseguindo para pagamento.",
      });

      toast.success("Script aprovado! Agora você pode pagar com segurança. ✅");
      queryClient.invalidateQueries({ queryKey: ["bounty-deliveries", bountyId] });
    } catch (err: any) {
      toast.error("Erro ao aprovar: " + err.message);
    }
  };

  // Dispute delivery
  const handleDispute = async (deliveryId: string) => {
    if (!disputeReason.trim()) { toast.error("Descreva o motivo da disputa."); return; }
    try {
      const { error } = await (supabase as any)
        .from("bounty_deliveries")
        .update({ disputed: true, dispute_reason: disputeReason.trim() })
        .eq("id", deliveryId);
      if (error) throw error;

      await (supabase as any).from("bounty_messages").insert({
        bounty_id: bountyId, sender_id: user!.id,
        content: `⚠️ Disputa aberta: "${disputeReason.trim()}" — aguardando revisão do admin.`,
      });

      toast.success("Disputa registrada. Um administrador irá analisar. ⚠️");
      setDisputeReason("");
      queryClient.invalidateQueries({ queryKey: ["bounty-deliveries", bountyId] });
    } catch (err: any) {
      toast.error("Erro ao disputar: " + err.message);
    }
  };

  // Admin resolve dispute
  const handleResolveDispute = async (deliveryId: string) => {
    if (!isAdmin) return;
    try {
      const { error } = await (supabase as any)
        .from("bounty_deliveries")
        .update({ dispute_resolved: true, dispute_resolved_by: user!.id })
        .eq("id", deliveryId);
      if (error) throw error;
      toast.success("Disputa resolvida.");
      queryClient.invalidateQueries({ queryKey: ["bounty-deliveries", bountyId] });
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  // Secure download (full version)
  const handleDownload = async (deliveryId: string) => {
    setDownloading(deliveryId);
    try {
      const { data, error } = await supabase.functions.invoke("download-bounty-delivery", {
        body: { delivery_id: deliveryId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.code && data?.obfuscated) {
        // Obfuscated code returned as text — create blob download
        const blob = new Blob([data.code], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.file_name || "script.lua";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Download iniciado (protegido)! 🔒");
      } else if (data?.url) {
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
  const latestDelivery = deliveries?.[0];
  const anyApproved = deliveries?.some((d: any) => d.test_approved);
  const anyDisputed = deliveries?.some((d: any) => d.disputed && !d.dispute_resolved);

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
        <div className="p-4 border-b border-white/5 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-neon-green flex items-center gap-1.5">
            <FileCode className="h-3.5 w-3.5" /> Entregas ({deliveries.length})
          </p>

          {deliveries.map((del: any) => {
            const canFullDownload = isModderUser || isAdmin || (isRequesterUser && (del.released || !isPaid));
            const canTest = isRequesterUser && !del.test_approved && !del.disputed && isPaid && !del.released;
            const isDisputed = del.disputed && !del.dispute_resolved;
            const isResolved = del.disputed && del.dispute_resolved;

            return (
              <div key={del.id} className={`p-3 border ${
                del.test_approved ? "bg-neon-green/5 border-neon-green/20" :
                isDisputed ? "bg-destructive/5 border-destructive/20" :
                "bg-[#030304] border-white/5"
              }`}>
                {/* File info row */}
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileCode className="h-4 w-4 text-neon-cyan shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-white truncate">{del.file_name}</p>
                      <p className="text-[9px] text-muted-foreground/50 font-mono">
                        {formatDistanceToNow(new Date(del.delivered_at), { locale: ptBR, addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0">
                    {del.test_approved && del.released ? (
                      <span className="text-[9px] text-neon-green font-mono flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Aprovado & Liberado
                      </span>
                    ) : del.test_approved ? (
                      <span className="text-[9px] text-neon-green font-mono flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Aprovado — aguardando pagamento
                      </span>
                    ) : isDisputed ? (
                      <span className="text-[9px] text-destructive font-mono flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Em disputa
                      </span>
                    ) : isResolved ? (
                      <span className="text-[9px] text-yellow-500 font-mono flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Disputa resolvida
                      </span>
                    ) : isPaid ? (
                      <span className="text-[9px] text-yellow-500 font-mono flex items-center gap-1">
                        <Timer className="h-3 w-3" /> Aguardando teste
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  {/* Test button — requester only, paid bounties */}
                  {canTest && (() => {
                    const usedTests = getTestCountForDelivery(del.id);
                    const testsExhausted = usedTests >= 2;
                    return (
                      <Button
                        size="sm"
                        onClick={() => handleTestDownload(del.id)}
                        disabled={testing === del.id || testsExhausted}
                        className="h-7 px-3 rounded-none bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 text-[10px] font-black uppercase tracking-widest"
                      >
                        {testing === del.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FlaskConical className="h-3 w-3 mr-1" />}
                        {testsExhausted ? "Testes esgotados" : `Testar (${2 - usedTests}/2)`}
                      </Button>
                    );
                  })()}

                  {/* Approve button — requester, after testing */}
                  {isRequesterUser && canTest && (
                    <Button
                      size="sm"
                      onClick={() => handleApprove(del.id)}
                      className="h-7 px-3 rounded-none bg-neon-green/10 hover:bg-neon-green/20 text-neon-green border border-neon-green/30 text-[10px] font-black uppercase tracking-widest"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" /> Aprovar
                    </Button>
                  )}

                  {/* Dispute button — requester */}
                  {isRequesterUser && canTest && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 rounded-none border-destructive/30 text-destructive hover:bg-destructive/10 text-[10px] font-black uppercase tracking-widest"
                        >
                          <XCircle className="h-3 w-3 mr-1" /> Disputar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-[#050505] border-white/10 rounded-none">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">Abrir Disputa</AlertDialogTitle>
                          <AlertDialogDescription className="text-muted-foreground text-xs">
                            Descreva o problema encontrado. Um administrador irá analisar e decidir. O pagamento NÃO será processado até a disputa ser resolvida.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <Textarea
                          value={disputeReason}
                          onChange={(e) => setDisputeReason(e.target.value)}
                          placeholder="Ex: O script não é o que foi combinado, não funciona no jogo X..."
                          className="bg-[#030304] border-white/10 rounded-none text-sm font-mono resize-none"
                          rows={3}
                          maxLength={500}
                        />
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-none">Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDispute(del.id)}
                            className="bg-destructive hover:bg-destructive/90 rounded-none"
                            disabled={!disputeReason.trim()}
                          >
                            Enviar Disputa
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

                  {/* Full download — modder, admin, or released */}
                  {canFullDownload && (
                    <Button
                      size="sm"
                      onClick={() => handleDownload(del.id)}
                      disabled={downloading === del.id}
                      className="h-7 px-3 rounded-none bg-neon-green/10 hover:bg-neon-green/20 text-neon-green border border-neon-green/30 text-[10px] font-black uppercase tracking-widest"
                    >
                      {downloading === del.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                      Baixar
                    </Button>
                  )}

                  {/* Admin resolve dispute */}
                  {isAdmin && isDisputed && (
                    <Button
                      size="sm"
                      onClick={() => handleResolveDispute(del.id)}
                      className="h-7 px-3 rounded-none bg-neon-purple/10 hover:bg-neon-purple/20 text-neon-purple border border-neon-purple/30 text-[10px] font-black uppercase tracking-widest"
                    >
                      <Shield className="h-3 w-3 mr-1" /> Resolver Disputa
                    </Button>
                  )}
                </div>

                {/* Dispute reason display */}
                {isDisputed && del.dispute_reason && (
                  <div className="mt-2 p-2 bg-destructive/5 border border-destructive/10">
                    <p className="text-[10px] text-destructive font-mono font-bold mb-0.5">Motivo da disputa:</p>
                    <p className="text-xs text-foreground/70">{del.dispute_reason}</p>
                  </div>
                )}

                {/* Locked message for requester */}
                {isRequesterUser && !canFullDownload && !canTest && isPaid && !del.test_approved && !isDisputed && (
                  <p className="text-[9px] text-muted-foreground/50 font-mono mt-2">
                    🔒 Baixe a versão de teste, verifique se funciona e depois aprove para liberar o pagamento.
                  </p>
                )}
              </div>
            );
          })}

          {/* Summary for requester */}
          {isRequesterUser && isPaid && hasDeliveries && !anyApproved && !anyDisputed && (
            <div className="p-3 bg-yellow-500/5 border border-yellow-500/20">
              <p className="text-[10px] text-yellow-500 font-mono font-bold flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5" /> TESTE ANTES DE PAGAR
              </p>
              <p className="text-xs text-foreground/60 mt-1">
                Baixe a versão de teste (funciona por 5 minutos) para verificar se o script está correto.
                Depois aprove para liberar o pagamento, ou dispute se houver problemas.
              </p>
            </div>
          )}

          {isRequesterUser && anyApproved && !isPurchaseCompleted && isPaid && (
            <div className="p-3 bg-neon-green/5 border border-neon-green/20">
              <p className="text-[10px] text-neon-green font-mono font-bold flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" /> SCRIPT APROVADO — PRONTO PARA PAGAR
              </p>
              <p className="text-xs text-foreground/60 mt-1">
                Você confirmou que o script funciona. Clique em "Pagar e Concluir" acima para finalizar.
              </p>
            </div>
          )}

          {anyDisputed && (
            <div className="p-3 bg-destructive/5 border border-destructive/20">
              <p className="text-[10px] text-destructive font-mono font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> DISPUTA EM ABERTO
              </p>
              <p className="text-xs text-foreground/60 mt-1">
                O pagamento está bloqueado até um administrador resolver a disputa.
                O modder pode enviar uma nova versão enquanto isso.
              </p>
            </div>
          )}
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
                    <button onClick={() => handleDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive/50 hover:text-destructive p-0.5">
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
          {isModderUser && bountyStatus === "in_progress" && (
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept=".lua" onChange={handleFileUpload} className="hidden" />
              <Button
                size="sm" variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-none text-[10px] font-black uppercase tracking-widest border-neon-green/30 text-neon-green hover:bg-neon-green/10"
              >
                {uploading ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Upload className="h-3 w-3 mr-1.5" />}
                {uploading ? "Enviando..." : "Entregar Script (.lua)"}
              </Button>
              <span className="text-[9px] text-muted-foreground/40 font-mono">
                O cliente testa por 5 min antes de pagar
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <textarea
              value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..." rows={1} maxLength={2000}
              className="flex-1 bg-[#050505] border border-white/10 focus:border-neon-cyan/30 focus:outline-none focus:ring-1 focus:ring-neon-cyan/20 px-4 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 resize-none"
            />
            <button onClick={handleSend} disabled={sending || !message.trim()}
              className="shrink-0 h-10 w-10 flex items-center justify-center bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
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
