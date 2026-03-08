import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, ShieldAlert } from "lucide-react";

export function ModerationMessages({ scriptId }: { scriptId: string }) {
  const { user } = useAuth();

  const { data: messages } = useQuery({
    queryKey: ["moderation-messages", scriptId],
    queryFn: async () => {
      const { data } = await supabase
        .from("moderation_messages" as any)
        .select("*")
        .eq("script_id", scriptId)
        .eq("recipient_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  if (!messages || messages.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" /> Mensagens da Moderação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {messages.map((msg: any) => (
          <div key={msg.id} className="p-3 rounded-lg bg-secondary/30 border border-border text-sm">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground">
                {new Date(msg.created_at).toLocaleString("pt-BR")}
              </span>
              {!msg.is_read && (
                <Badge variant="outline" className="text-[9px] bg-primary/20 text-primary border-primary/30">Nova</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{msg.message}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
