import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  PlayCircle,
  ShieldAlert,
  Ban,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditRun {
  id: string;
  ran_at: string;
  source: string;
  total_issues: number;
  suspicious_purchases_count: number;
  suspicious_bounties_count: number;
  orphan_access_count: number;
  admins_notified: number;
  details: any;
}

export function AdminAuditTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: runs, isLoading } = useQuery({
    queryKey: ["admin-audit-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_runs" as any)
        .select("*")
        .order("ran_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as unknown as AuditRun[];
    },
  });

  const { data: uploadBlocks, isLoading: blocksLoading } = useQuery({
    queryKey: ["admin-script-upload-blocks"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("script_upload_blocks")
        .select("id, created_at, user_id, script_id, reason, source, metadata, profiles:user_id(username, display_name), scripts:script_id(title)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const runNow = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke(
        "audit-suspicious-purchases",
        { headers: { "x-invoke-source": "manual" } as any }
      );
      if (error) throw error;
      toast({ title: "Auditoria executada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-runs"] });
    } catch (e: any) {
      toast({
        title: "Erro ao executar auditoria",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const lastRun = runs?.[0];
  const totalIssuesAcrossRuns = runs?.reduce((s, r) => s + r.total_issues, 0) || 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono text-muted-foreground">
              Última execução
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastRun
                ? formatDistanceToNow(new Date(lastRun.ran_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })
                : "Nunca"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono text-muted-foreground">
              Anomalias acumuladas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {totalIssuesAcrossRuns > 0 ? (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              )}
              {totalIssuesAcrossRuns}
            </div>
          </CardContent>
        </Card>

        <Card className="flex items-center justify-center">
          <CardContent className="pt-6">
            <Button onClick={runNow} disabled={running} className="w-full">
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <PlayCircle className="h-4 w-4 mr-2" />
              )}
              Executar agora
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Histórico de auditorias (últimas 30)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : !runs || runs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma execução registrada ainda. Clique em "Executar agora" para iniciar.
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <Collapsible
                  key={run.id}
                  open={expanded === run.id}
                  onOpenChange={(o) => setExpanded(o ? run.id : null)}
                >
                  <div className="border border-white/10 rounded-md">
                    <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition">
                      <div className="flex items-center gap-3 text-left">
                        {run.total_issues > 0 ? (
                          <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        )}
                        <div>
                          <div className="text-sm font-mono">
                            {new Date(run.ran_at).toLocaleString("pt-BR")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {run.total_issues === 0
                              ? "Nenhuma anomalia"
                              : `${run.total_issues} anomalia(s) — ${run.suspicious_purchases_count} compra(s), ${run.suspicious_bounties_count} bounty(s), ${run.orphan_access_count} órfão(s)`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {run.source}
                        </Badge>
                        {run.admins_notified > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {run.admins_notified} admin(s) notificado(s)
                          </Badge>
                        )}
                        <ChevronDown
                          className={`h-4 w-4 transition ${
                            expanded === run.id ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="p-3 border-t border-white/10 bg-black/30">
                        {run.total_issues === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Nenhum registro suspeito detectado nesta execução.
                          </p>
                        ) : (
                          <pre className="text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap">
                            {JSON.stringify(run.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
