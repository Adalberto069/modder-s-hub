import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  ShieldAlert, ShieldX, ShieldCheck, Shield,
  AlertTriangle, CheckCircle, XCircle, Eye, Trash2,
  MessageSquare, Loader2, Clock, Send, ScrollText,
} from "lucide-react";

const classificationConfig: Record<string, { label: string; icon: any; className: string }> = {
  safe: { label: "Seguro", icon: ShieldCheck, className: "bg-accent/20 text-accent border-accent/30" },
  suspicious: { label: "Suspeito", icon: ShieldAlert, className: "bg-primary/20 text-primary border-primary/30" },
  malicious: { label: "Malicioso", icon: ShieldX, className: "bg-destructive/20 text-destructive border-destructive/30" },
};

export function AdminModerationQueue() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState<Record<string, string>>({});
  const [sendingMsg, setSendingMsg] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  // Fetch scripts under review or flagged
  const { data: moderationScripts, isLoading } = useQuery({
    queryKey: ["moderation-queue"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("scripts")
        .select("*, categories(name)") as any)
        .in("security_status", ["under_review", "flagged"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Fetch analyses for these scripts
  const scriptIds = (moderationScripts ?? []).map((s: any) => s.id);
  const { data: analyses } = useQuery({
    queryKey: ["moderation-analyses", scriptIds],
    queryFn: async () => {
      if (scriptIds.length === 0) return [];
      const { data } = await supabase
        .from("script_analyses" as any)
        .select("*")
        .in("script_id", scriptIds)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: scriptIds.length > 0,
  });

  // Fetch modder profiles
  const modderIds = [...new Set((moderationScripts ?? []).map((s: any) => s.modder_id))];
  const { data: modderProfiles } = useQuery({
    queryKey: ["modder-profiles-mod", modderIds],
    queryFn: async () => {
      if (modderIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("*").in("user_id", modderIds);
      return data ?? [];
    },
    enabled: modderIds.length > 0,
  });

  // Audit logs
  const { data: auditLogs } = useQuery({
    queryKey: ["moderation-audit-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("moderation_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as any[];
    },
    enabled: showLogs,
  });

  const profileMap = (modderProfiles ?? []).reduce((acc: any, p: any) => { acc[p.user_id] = p; return acc; }, {});
  const analysisMap = (analyses ?? []).reduce((acc: any, a: any) => {
    if (!acc[a.script_id]) acc[a.script_id] = a;
    return acc;
  }, {} as Record<string, any>);

  const logAction = async (scriptId: string, action: string, details: string, prevStatus: string, newStatus: string) => {
    await supabase.from("moderation_logs" as any).insert({
      script_id: scriptId,
      moderator_id: user!.id,
      action,
      details,
      previous_status: prevStatus,
      new_status: newStatus,
    } as any);
  };

  const approveScript = async (script: any) => {
    const { error } = await supabase.from("scripts").update({
      publish_status: "published",
      security_status: "verified",
      is_verified: true,
    } as any).eq("id", script.id);

    if (error) { toast.error(error.message); return; }

    await logAction(script.id, "approve", "Script aprovado e verificado pelo moderador", script.security_status, "verified");

    // Mark analysis as reviewed
    const analysis = analysisMap[script.id];
    if (analysis) {
      await supabase.from("script_analyses" as any)
        .update({ reviewed: true, reviewed_at: new Date().toISOString() } as any)
        .eq("id", analysis.id);
    }

    // Notify modder
    await supabase.from("notifications" as any).insert({
      user_id: script.modder_id,
      title: "✅ Script aprovado!",
      message: `Seu script "${script.title}" foi aprovado pela moderação e está publicado.`,
      type: "success",
      link: `/script/${script.id}`,
    } as any);

    toast.success("✅ Script aprovado e publicado com selo Verificado!");
    queryClient.invalidateQueries({ queryKey: ["moderation-queue"] });
    queryClient.invalidateQueries({ queryKey: ["admin-scripts"] });
  };

  const rejectScript = async (script: any) => {
    const { error } = await supabase.from("scripts").update({
      publish_status: "archived",
      security_status: "rejected",
    } as any).eq("id", script.id);

    if (error) { toast.error(error.message); return; }

    await logAction(script.id, "reject", "Script rejeitado pelo moderador", script.security_status, "rejected");

    // Send rejection message to author
    await supabase.from("moderation_messages" as any).insert({
      script_id: script.id,
      sender_id: user!.id,
      recipient_id: script.modder_id,
      message: `Seu script "${script.title}" foi rejeitado pela moderação devido a padrões de segurança detectados. Revise o código e reenvie.`,
    } as any);

    // Notify modder
    await supabase.from("notifications" as any).insert({
      user_id: script.modder_id,
      title: "❌ Script rejeitado",
      message: `Seu script "${script.title}" foi rejeitado pela moderação. Verifique as mensagens para mais detalhes.`,
      type: "error",
      link: `/script/${script.id}`,
    } as any);

    toast.success("Script rejeitado. Autor notificado.");
    queryClient.invalidateQueries({ queryKey: ["moderation-queue"] });
    queryClient.invalidateQueries({ queryKey: ["admin-scripts"] });
  };

  const sendMessage = async (script: any) => {
    const msg = messageText[script.id]?.trim();
    if (!msg) return;

    setSendingMsg(script.id);
    const { error } = await supabase.from("moderation_messages" as any).insert({
      script_id: script.id,
      sender_id: user!.id,
      recipient_id: script.modder_id,
      message: msg,
    } as any);

    if (error) { toast.error(error.message); setSendingMsg(null); return; }

    await logAction(script.id, "message", `Mensagem enviada ao autor: ${msg.substring(0, 100)}`, script.security_status, script.security_status);

    // Notify modder via bell notification
    await supabase.from("notifications" as any).insert({
      user_id: script.modder_id,
      title: "💬 Mensagem da Moderação",
      message: `Nova mensagem sobre "${script.title}": ${msg.substring(0, 120)}${msg.length > 120 ? "..." : ""}`,
      type: "info",
      link: `/dashboard`,
    } as any);

    setMessageText((prev) => ({ ...prev, [script.id]: "" }));
    setSendingMsg(null);
    toast.success("Mensagem enviada e modder notificado!");
  };

  return (
    <Card className="neon-border bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Fila de Moderação
          </span>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">
              {moderationScripts?.length ?? 0} pendente(s)
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLogs(!showLogs)}
              className="gap-1 text-xs"
            >
              <ScrollText className="h-3.5 w-3.5" />
              {showLogs ? "Ocultar Log" : "Ver Log"}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>}

        {!isLoading && (moderationScripts?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum script aguardando moderação. ✅
          </p>
        )}

        {moderationScripts?.map((script: any) => {
          const analysis = analysisMap[script.id];
          const config = analysis ? (classificationConfig[analysis.classification] || classificationConfig.safe) : null;
          const modder = profileMap[script.modder_id];
          const Icon = config?.icon || Shield;

          return (
            <div key={script.id} className="p-4 rounded-lg border border-border bg-secondary/20 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Link to={`/script/${script.id}`} className="font-semibold text-sm hover:text-primary transition-colors">
                      {script.title}
                    </Link>
                    {config && (
                      <Badge variant="outline" className={config.className + " text-[10px] gap-1"}>
                        <Icon className="h-3 w-3" /> {config.label}
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-[10px] ${
                      script.security_status === "flagged"
                        ? "bg-destructive/20 text-destructive border-destructive/30"
                        : "bg-primary/20 text-primary border-primary/30"
                    }`}>
                      {script.security_status === "flagged" ? "🚩 Flagrado" : "🔍 Em Revisão"}
                    </Badge>
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span>Por: {modder?.display_name || modder?.username || "Desconhecido"}</span>
                    {script.game_name && <span>🎮 {script.game_name}</span>}
                    <span>{new Date(script.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Link to={`/script/${script.id}`}>
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Ver script">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-accent" onClick={() => approveScript(script)} title="Aprovar">
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => rejectScript(script)} title="Rejeitar">
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Analysis details */}
              {analysis && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">Score: {analysis.security_score}/100</span>
                    <Progress value={analysis.security_score} className="h-1.5 flex-1 max-w-[200px]" />
                  </div>
                  {analysis.summary && (
                    <p className="text-xs text-muted-foreground bg-background/50 rounded p-2">{analysis.summary}</p>
                  )}
                  {Array.isArray(analysis.threats) && analysis.threats.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {analysis.threats.map((t: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-[9px] bg-destructive/10 text-destructive border-destructive/20">
                          {t.type}: {t.description}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Message to author */}
              <div className="flex gap-2">
                <Textarea
                  value={messageText[script.id] || ""}
                  onChange={(e) => setMessageText((prev) => ({ ...prev, [script.id]: e.target.value }))}
                  placeholder="Enviar mensagem ao autor (ex: por que usar os.execute?)..."
                  className="text-xs min-h-[60px]"
                  rows={2}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sendMessage(script)}
                  disabled={!messageText[script.id]?.trim() || sendingMsg === script.id}
                  className="shrink-0 self-end gap-1"
                >
                  {sendingMsg === script.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Enviar
                </Button>
              </div>
            </div>
          );
        })}

        {/* Audit Logs */}
        {showLogs && (
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-muted-foreground" /> Log de Moderação
            </h3>
            {(auditLogs?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhuma ação registrada.</p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {auditLogs?.map((log: any) => (
                  <div key={log.id} className="flex items-center gap-2 text-[10px] text-muted-foreground p-2 rounded bg-background/30">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                    <Badge variant="outline" className={`text-[9px] ${
                      log.action === "approve" ? "text-accent border-accent/30" :
                      log.action === "reject" ? "text-destructive border-destructive/30" :
                      "text-primary border-primary/30"
                    }`}>
                      {log.action === "approve" ? "Aprovado" : log.action === "reject" ? "Rejeitado" : "Mensagem"}
                    </Badge>
                    {log.details && <span className="truncate flex-1">{log.details}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
