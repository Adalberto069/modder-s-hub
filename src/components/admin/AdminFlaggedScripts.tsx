import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  ShieldAlert, ShieldX, ShieldCheck, Shield,
  AlertTriangle, CheckCircle, Eye, Trash2,
} from "lucide-react";

const classificationConfig: Record<string, { label: string; icon: any; className: string }> = {
  safe: { label: "Seguro", icon: ShieldCheck, className: "bg-accent/20 text-accent border-accent/30" },
  suspicious: { label: "Suspeito", icon: ShieldAlert, className: "bg-primary/20 text-primary border-primary/30" },
  malicious: { label: "Malicioso", icon: ShieldX, className: "bg-destructive/20 text-destructive border-destructive/30" },
};

export function AdminFlaggedScripts() {
  const queryClient = useQueryClient();

  const { data: analyses, isLoading } = useQuery({
    queryKey: ["admin-flagged-analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("script_analyses" as any)
        .select("*")
        .in("classification", ["suspicious", "malicious"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: allAnalyses } = useQuery({
    queryKey: ["admin-all-analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("script_analyses" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Fetch script titles for flagged analyses
  const scriptIds = [...new Set((analyses ?? []).map((a: any) => a.script_id))];
  const { data: scripts } = useQuery({
    queryKey: ["flagged-scripts-titles", scriptIds],
    queryFn: async () => {
      if (scriptIds.length === 0) return [];
      const { data } = await supabase
        .from("scripts")
        .select("id, title, modder_id, publish_status")
        .in("id", scriptIds);
      return data ?? [];
    },
    enabled: scriptIds.length > 0,
  });

  const scriptMap = (scripts ?? []).reduce((acc: any, s: any) => { acc[s.id] = s; return acc; }, {});

  const markReviewed = async (analysisId: string) => {
    const { error } = await supabase
      .from("script_analyses" as any)
      .update({ reviewed: true, reviewed_at: new Date().toISOString() } as any)
      .eq("id", analysisId);
    if (error) toast.error(error.message);
    else {
      toast.success("Marcado como revisado!");
      queryClient.invalidateQueries({ queryKey: ["admin-flagged-analyses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-analyses"] });
    }
  };

  const deleteAnalysis = async (analysisId: string) => {
    const { error } = await supabase
      .from("script_analyses" as any)
      .delete()
      .eq("id", analysisId);
    if (error) toast.error(error.message);
    else {
      toast.success("Análise removida!");
      queryClient.invalidateQueries({ queryKey: ["admin-flagged-analyses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-analyses"] });
    }
  };

  const flaggedCount = analyses?.filter((a: any) => !a.reviewed).length ?? 0;
  const totalAnalyses = allAnalyses?.length ?? 0;

  return (
    <Card className="neon-border bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Análises de Segurança
          </span>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">{totalAnalyses} total</Badge>
            {flaggedCount > 0 && (
              <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30 text-xs gap-1">
                <AlertTriangle className="h-3 w-3" /> {flaggedCount} flagged
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>}

        {!isLoading && (analyses?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum script flagrado. Tudo limpo! ✅
          </p>
        )}

        {analyses?.map((analysis: any) => {
          const config = classificationConfig[analysis.classification] || classificationConfig.safe;
          const Icon = config.icon;
          const script = scriptMap[analysis.script_id];

          return (
            <div
              key={analysis.id}
              className={`p-4 rounded-lg border ${
                analysis.reviewed
                  ? "bg-secondary/20 border-border opacity-60"
                  : "bg-secondary/30 border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="outline" className={config.className + " text-[10px] gap-1"}>
                      <Icon className="h-3 w-3" /> {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Score: {analysis.security_score}/100
                    </span>
                    {analysis.reviewed && (
                      <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/30 gap-1">
                        <CheckCircle className="h-3 w-3" /> Revisado
                      </Badge>
                    )}
                  </div>
                  {script ? (
                    <Link to={`/script/${script.id}`} className="text-sm font-semibold hover:text-primary transition-colors">
                      {script.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-muted-foreground">Script removido</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(analysis.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                    })}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {script && (
                    <Link to={`/script/${script.id}`}>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Ver script">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                  {!analysis.reviewed && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-accent" onClick={() => markReviewed(analysis.id)} title="Marcar como revisado">
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteAnalysis(analysis.id)} title="Remover análise">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Summary */}
              {analysis.summary && (
                <p className="text-xs text-muted-foreground mb-2">{analysis.summary}</p>
              )}

              {/* Security Score Bar */}
              <Progress value={analysis.security_score} className="h-1.5 mb-2" />

              {/* Threats summary */}
              {Array.isArray(analysis.threats) && analysis.threats.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {analysis.threats.map((t: any, i: number) => (
                    <Badge key={i} variant="outline" className="text-[9px] bg-destructive/10 text-destructive border-destructive/20">
                      {t.description}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
