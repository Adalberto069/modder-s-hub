import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KeyRound, Copy, Timer } from "lucide-react";
import { toast } from "sonner";

function useTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);
}

export function TestSessionsList() {
  const { user } = useAuth();
  useTick();

  const { data: sessions } = useQuery({
    queryKey: ["test-sessions", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("script_test_sessions")
        .select("id, access_code, expires_at, duration_minutes, script_id, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      const ids = [...new Set((data ?? []).map((s: any) => s.script_id))];
      let titles: Record<string, string> = {};
      if (ids.length) {
        const { data: scripts } = await supabase
          .from("scripts")
          .select("id, title")
          .in("id", ids);
        titles = Object.fromEntries((scripts ?? []).map((s: any) => [s.id, s.title]));
      }
      return (data ?? []).map((s: any) => ({ ...s, title: titles[s.script_id] ?? "Script" }));
    },
  });

  if (!sessions?.length) return null;

  return (
    <Card className="border-white/10 bg-card/40 p-4 sm:p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <KeyRound className="h-4 w-4 text-neon-cyan" />
        <h3 className="text-xs font-black uppercase tracking-widest">Códigos de teste</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">
        Digite o código no GameGuardian ao executar o arquivo de teste. Ele expira junto com o tempo de teste.
      </p>

      <div className="space-y-3">
        {sessions.map((s: any) => {
          const msLeft = new Date(s.expires_at).getTime() - Date.now();
          const expired = msLeft <= 0;
          const mm = Math.max(0, Math.floor(msLeft / 60000));
          const ss = Math.max(0, Math.floor((msLeft % 60000) / 1000));
          return (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-background/40 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-bold">{s.title}</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  {expired ? "Código expirado" : `Expira em ${mm}:${String(ss).padStart(2, "0")}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {expired ? (
                  <Badge variant="outline" className="border-destructive/40 text-destructive text-[10px]">
                    EXPIRADO
                  </Badge>
                ) : (
                  <>
                    <code className="rounded bg-secondary/40 px-2 py-1 font-mono text-sm tracking-widest text-neon-cyan">
                      {s.access_code}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Copiar código de teste"
                      onClick={() => {
                        navigator.clipboard.writeText(s.access_code);
                        toast.success("Código copiado!");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
