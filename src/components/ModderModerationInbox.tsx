import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, ShieldAlert, Check, ExternalLink, CheckCheck, Archive } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";

export function ModderModerationInbox() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showHistory, setShowHistory] = useState(false);

  const { data: messages } = useQuery({
    queryKey: ["modder-moderation-inbox", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("moderation_messages" as any)
        .select("*, scripts(id, title)")
        .eq("recipient_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as any[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const markAllRead = async () => {
    if (!user) return;
    const unreadIds = (messages ?? []).filter((m) => !m.is_read).map((m) => m.id);
    if (unreadIds.length === 0) return;
    const { error } = await supabase
      .from("moderation_messages" as any)
      .update({ is_read: true } as any)
      .in("id", unreadIds);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["modder-moderation-inbox"] });
  };

  const markRead = async (id: string) => {
    const { error } = await supabase
      .from("moderation_messages" as any)
      .update({ is_read: true } as any)
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["modder-moderation-inbox"] });
  };

  if (!messages || messages.length === 0) return null;

  const unread = messages.filter((m) => !m.is_read);
  const read = messages.filter((m) => m.is_read);
  const visible = showHistory ? messages : unread;
  const unreadCount = unread.length;

  // Hide entirely when no unread and not viewing history
  if (unreadCount === 0 && !showHistory && read.length > 0) {
    return (
      <Card className="border-white/5 bg-white/[0.02] mb-6">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2 font-mono uppercase tracking-widest text-muted-foreground">
            <ShieldAlert className="h-4 w-4" />
            Moderação · sem novas mensagens
          </CardTitle>
          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setShowHistory(true)}>
            <Archive className="h-3 w-3 mr-1" /> Ver histórico ({read.length})
          </Button>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5 mb-6">
      <CardHeader className="pb-3 flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="text-sm flex items-center gap-2 font-mono uppercase tracking-widest">
          <ShieldAlert className="h-4 w-4 text-primary" />
          Mensagens da Moderação
          {unreadCount > 0 && (
            <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">
              {unreadCount} nova(s)
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={markAllRead}>
              <CheckCheck className="h-3 w-3 mr-1" /> Marcar todas
            </Button>
          )}
          {read.length > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setShowHistory((v) => !v)}>
              <Archive className="h-3 w-3 mr-1" /> {showHistory ? "Ocultar histórico" : `Histórico (${read.length})`}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
        <p className="text-[10px] text-muted-foreground/70 font-mono mb-2">
          ⓘ Mensagens lidas são apagadas automaticamente após 30 dias.
        </p>
        {visible.map((msg: any) => (
          <div
            key={msg.id}
            className={`p-3 rounded-lg border text-sm ${
              msg.is_read
                ? "bg-secondary/20 border-border"
                : "bg-primary/10 border-primary/30"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground">
                  {new Date(msg.created_at).toLocaleString("pt-BR")}
                </span>
                {!msg.is_read && (
                  <Badge variant="outline" className="text-[9px] bg-primary/20 text-primary border-primary/30">
                    Nova
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {msg.script_id && (
                  <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[10px]">
                    <Link to={`/script/${msg.script_id}`}>
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Ver script
                    </Link>
                  </Button>
                )}
                {!msg.is_read && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[10px]"
                    onClick={() => markRead(msg.id)}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Marcar lida
                  </Button>
                )}
              </div>
            </div>
            {msg.scripts?.title && (
              <p className="text-[11px] text-muted-foreground mb-1">
                Sobre: <span className="text-foreground font-semibold">{msg.scripts.title}</span>
              </p>
            )}
            <p className="text-foreground whitespace-pre-wrap">{msg.message}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
