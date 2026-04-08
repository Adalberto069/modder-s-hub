import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Send, MessageSquare, Lock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import DOMPurify from "dompurify";

interface BountyChatProps {
  bountyId: string;
  bountyStatus: string;
  requesterId: string;
  assignedModderId: string | null;
}

export function BountyChat({ bountyId, bountyStatus, requesterId, assignedModderId }: BountyChatProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isParticipant = user && (user.id === requesterId || user.id === assignedModderId);
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
    enabled: !!isParticipant,
  });

  // Realtime subscription
  useEffect(() => {
    if (!isParticipant) return;

    const channel = supabase
      .channel(`bounty-chat-${bountyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bounty_messages",
          filter: `bounty_id=eq.${bountyId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["bounty-messages", bountyId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bountyId, isParticipant, queryClient]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!user || !message.trim() || !canSend) return;

    const content = message.trim();
    if (content.length > 2000) {
      toast.error("Mensagem muito longa (máx 2000 caracteres).");
      return;
    }

    setSending(true);
    const { error } = await (supabase as any).from("bounty_messages").insert({
      bounty_id: bountyId,
      sender_id: user.id,
      content,
    });
    setSending(false);

    if (error) {
      toast.error("Erro ao enviar mensagem: " + error.message);
      return;
    }

    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isParticipant) return null;

  return (
    <div className="border border-white/5 bg-[#050505]">
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-[#030304] flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
          <MessageSquare className="h-4 w-4 text-neon-cyan" />
          Chat da Encomenda
        </h2>
        <div className="flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">
            Privado
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="p-4 space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10"
      >
        {!messages || messages.length === 0 ? (
          <div className="py-12 text-center">
            <MessageSquare className="h-8 w-8 text-neon-cyan/15 mx-auto mb-3" />
            <p className="text-xs text-muted-foreground/50 font-mono">
              {bountyStatus === "in_progress"
                ? "Nenhuma mensagem ainda. Inicie a conversa!"
                : "Chat disponível apenas durante a execução."}
            </p>
          </div>
        ) : (
          messages.map((msg: any) => {
            const isMine = msg.sender_id === user?.id;
            const name = msg.profiles?.display_name ?? msg.profiles?.username ?? "Anônimo";
            const isRequesterMsg = msg.sender_id === requesterId;

            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}
              >
                {/* Sender info */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest ${
                      isRequesterMsg ? "text-neon-purple/70" : "text-neon-cyan/70"
                    }`}
                  >
                    {isMine ? "Você" : name}
                  </span>
                  <span className="text-[9px] text-muted-foreground/40 font-mono">
                    {formatDistanceToNow(new Date(msg.created_at), { locale: ptBR, addSuffix: true })}
                  </span>
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed ${
                    isMine
                      ? "bg-neon-purple/10 border border-neon-purple/20 text-foreground/90"
                      : "bg-[#030304] border border-white/5 text-foreground/80"
                  }`}
                >
                  {DOMPurify.sanitize(msg.content, { ALLOWED_TAGS: [] })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      {canSend ? (
        <div className="p-4 border-t border-white/5 bg-[#030304]">
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
          <p className="text-[9px] text-muted-foreground/30 font-mono mt-1.5">
            Enter para enviar · Shift+Enter para nova linha · {message.length}/2000
          </p>
        </div>
      ) : bountyStatus === "completed" ? (
        <div className="p-3 border-t border-white/5 text-center">
          <p className="text-[10px] text-muted-foreground/40 font-mono uppercase tracking-widest">
            Encomenda concluída — chat encerrado
          </p>
        </div>
      ) : null}
    </div>
  );
}
