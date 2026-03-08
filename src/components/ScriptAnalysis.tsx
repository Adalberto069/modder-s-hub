import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Shield, ShieldAlert, ShieldX, ShieldCheck,
  AlertTriangle, Loader2, Scan, FileSearch,
} from "lucide-react";

interface Threat {
  type: string;
  severity: string;
  description: string;
  line: string;
}

interface AnalysisResult {
  classification: "safe" | "suspicious" | "malicious";
  securityScore: number;
  threats: Threat[];
  summary: string;
  functionality: string;
}

interface ScriptAnalysisProps {
  code: string;
  onAnalysisComplete?: (result: AnalysisResult) => void;
}

const classificationConfig = {
  safe: {
    label: "Seguro",
    icon: ShieldCheck,
    className: "bg-accent/20 text-accent border-accent/30",
    progressColor: "bg-accent",
  },
  suspicious: {
    label: "Suspeito",
    icon: ShieldAlert,
    className: "bg-primary/20 text-primary border-primary/30",
    progressColor: "bg-primary",
  },
  malicious: {
    label: "Malicioso",
    icon: ShieldX,
    className: "bg-destructive/20 text-destructive border-destructive/30",
    progressColor: "bg-destructive",
  },
};

const severityConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Baixo", className: "bg-muted text-muted-foreground" },
  medium: { label: "Médio", className: "bg-primary/20 text-primary" },
  high: { label: "Alto", className: "bg-destructive/30 text-destructive" },
  critical: { label: "Crítico", className: "bg-destructive text-destructive-foreground" },
};

const threatTypeLabels: Record<string, string> = {
  system_command: "Comando do Sistema",
  network_abuse: "Abuso de Rede",
  filesystem: "Manipulação de Arquivos",
  obfuscation: "Ofuscação",
  encoded_payload: "Payload Codificado",
  reverse_shell: "Shell Reverso",
  persistence: "Persistência",
};

export default function ScriptAnalysis({ code, onAnalysisComplete }: ScriptAnalysisProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    if (!code.trim()) return;
    setAnalyzing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("analyze-script", {
        body: { code },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setResult(data);
      onAnalysisComplete?.(data);
    } catch (err: any) {
      setError(err.message || "Erro ao analisar o script");
    } finally {
      setAnalyzing(false);
    }
  };

  if (!result) {
    return (
      <Card className="neon-border bg-card/80">
        <CardContent className="py-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <Shield className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Analise o código para verificar riscos de segurança e gerar uma descrição automática.
            </p>
            <Button
              onClick={analyze}
              disabled={analyzing || !code.trim()}
              className="gap-2"
            >
              {analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Scan className="h-4 w-4" />
              )}
              {analyzing ? "Analisando..." : "Analisar Script"}
            </Button>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = classificationConfig[result.classification] || classificationConfig.safe;
  const Icon = config.icon;

  return (
    <Card className="neon-border bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-primary" /> Análise de Segurança
          </span>
          <Badge variant="outline" className={config.className}>
            <Icon className="h-3 w-3 mr-1" /> {config.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Security Score */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Pontuação de Segurança</span>
            <span className="font-mono font-bold">{result.securityScore}/100</span>
          </div>
          <Progress value={result.securityScore} className="h-2" />
        </div>

        {/* Summary */}
        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
          <p className="text-sm text-muted-foreground">{result.summary}</p>
        </div>

        {/* Functionality */}
        {result.functionality && (
          <div className="p-3 rounded-lg bg-secondary/30 border border-border">
            <p className="text-xs font-semibold text-foreground mb-1">O que faz:</p>
            <p className="text-sm text-muted-foreground">{result.functionality}</p>
          </div>
        )}

        {/* Threats */}
        {result.threats.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              {result.threats.length} ameaça(s) detectada(s)
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {result.threats.map((threat, i) => {
                const sev = severityConfig[threat.severity] || severityConfig.low;
                return (
                  <div key={i} className="p-2.5 rounded-lg bg-secondary/20 border border-border text-xs space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={sev.className + " text-[10px]"}>
                        {sev.label}
                      </Badge>
                      <span className="text-muted-foreground">
                        {threatTypeLabels[threat.type] || threat.type}
                      </span>
                    </div>
                    <p className="text-foreground">{threat.description}</p>
                    {threat.line && (
                      <code className="block text-[10px] text-muted-foreground bg-background/50 rounded px-2 py-1 font-mono truncate">
                        {threat.line}
                      </code>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Re-analyze */}
        <Button
          variant="outline"
          size="sm"
          onClick={analyze}
          disabled={analyzing}
          className="w-full gap-2"
        >
          {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scan className="h-3.5 w-3.5" />}
          {analyzing ? "Analisando..." : "Reanalisar"}
        </Button>
      </CardContent>
    </Card>
  );
}
