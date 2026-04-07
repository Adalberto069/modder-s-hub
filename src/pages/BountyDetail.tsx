import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Target, Gamepad2, Clock, DollarSign, User, CheckCircle, XCircle,
  ArrowLeft, Send, Shield, Trophy, AlertTriangle, Calendar
} from "lucide-react";

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  open: { label: "Aberta", color: "text-neon-green", bg: "bg-neon-green/10", border: "border-neon-green/30" },
  in_progress: { label: "Em Andamento", color: "text-neon-cyan", bg: "bg-neon-cyan/10", border: "border-neon-cyan/30" },
  completed: { label: "Concluída", color: "text-neon-purple", bg: "bg-neon-purple/10", border: "border-neon-purple/30" },
  cancelled: { label: "Cancelada", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
};

export default function BountyDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isModder, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [applyMessage, setApplyMessage] = useState("");
  const [applying, setApplying] = useState(false);

  const { data: bounty, isLoading } = useQuery({
    queryKey: ["bounty", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bounties")
        .select(`
          *,
          profiles:requester_id(username, display_name, user_id),
          categories(name, icon)
        `)
        .eq("id", id)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: applications } = useQuery({
    queryKey: ["bounty-applications", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bounty_applications")
        .select(`
          *,
          profiles:modder_id(username, display_name, user_id)
        `)
        .eq("bounty_id", id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!id,
  });

  const isRequester = user?.id === bounty?.requester_id;
  const hasApplied = applications?.some((a: any) => a.modder_id === user?.id);
  const myApplication = applications?.find((a: any) => a.modder_id === user?.id);

  const handleApply = async () => {
    if (!user) { toast.error("Faça login para se candidatar."); return; }
    if (!isModder) { toast.error("Apenas modders aprovados podem se candidatar."); return; }
    if (!applyMessage.trim()) { toast.error("Escreva uma mensagem de candidatura."); return; }

    setApplying(true);
    const { error } = await (supabase as any).from("bounty_applications").insert({
      bounty_id: id,
      modder_id: user.id,
      message: applyMessage.trim(),
      status: "pending",
    });
    setApplying(false);

    if (error) {
      if (error.code === "23505") toast.error("Você já se candidatou para essa encomenda.");
      else toast.error("Erro ao candidatar: " + error.message);
      return;
    }

    toast.success("Candidatura enviada! 🚀");
    setApplyMessage("");
    queryClient.invalidateQueries({ queryKey: ["bounty-applications", id] });

    // Notify requester
    await (supabase as any).from("notifications").insert({
      user_id: bounty?.requester_id,
      title: "Nova candidatura! 👾",
      message: `Um modder se candidatou à sua encomenda: "${bounty?.title}"`,
      type: "info",
      link: `/bounties/${id}`,
    });
  };

  const handleAcceptModder = async (application: any) => {
    if (!isRequester && !isAdmin) return;

    // Update application status to accepted
    const { error: appError } = await (supabase as any)
      .from("bounty_applications")
      .update({ status: "accepted" })
      .eq("id", application.id);

    if (appError) { toast.error(appError.message); return; }

    // Reject all others
    await (supabase as any)
      .from("bounty_applications")
      .update({ status: "rejected" })
      .eq("bounty_id", id)
      .neq("id", application.id);

    // Update bounty status
    await (supabase as any)
      .from("bounties")
      .update({ status: "in_progress", assigned_modder_id: application.modder_id })
      .eq("id", id);

    toast.success("Modder aceito! A encomenda está em andamento. ✅");

    // Notify modder
    await (supabase as any).from("notifications").insert({
      user_id: application.modder_id,
      title: "Candidatura aceita! 🎯",
      message: `Sua candidatura para "${bounty?.title}" foi aceita! Entre em contato com o solicitante.`,
      type: "success",
      link: `/bounties/${id}`,
    });

    queryClient.invalidateQueries({ queryKey: ["bounty", id] });
    queryClient.invalidateQueries({ queryKey: ["bounty-applications", id] });
  };

  const handleMarkCompleted = async () => {
    if (!isRequester && !isAdmin) return;
    await (supabase as any)
      .from("bounties")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Encomenda marcada como concluída! 🏆");
    queryClient.invalidateQueries({ queryKey: ["bounty", id] });
  };

  const handleCancelBounty = async () => {
    if (!isRequester && !isAdmin) return;
    if (!window.confirm("Tem certeza que quer cancelar essa encomenda?")) return;
    await (supabase as any).from("bounties").update({ status: "cancelled" }).eq("id", id);
    toast.success("Encomenda cancelada.");
    navigate("/bounties");
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-8 max-w-4xl space-y-6">
          <Skeleton className="h-12 w-3/4 rounded-none bg-white/5" />
          <Skeleton className="h-48 rounded-none bg-white/5" />
          <Skeleton className="h-32 rounded-none bg-white/5" />
        </div>
      </Layout>
    );
  }

  if (!bounty) {
    return (
      <Layout>
        <div className="container py-24 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground font-mono">Encomenda não encontrada.</p>
          <Link to="/bounties" className="text-neon-purple text-sm underline mt-4 inline-block">← Voltar ao Bounty Board</Link>
        </div>
      </Layout>
    );
  }

  const status = statusConfig[bounty.status] ?? statusConfig.open;
  const isDeadlineExpired = bounty.deadline && new Date(bounty.deadline) < new Date();

  return (
    <Layout>
      <div className="container py-8 max-w-4xl space-y-6">
        {/* Back */}
        <Link to="/bounties" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-neon-purple transition-colors font-mono">
          <ArrowLeft className="h-3 w-3" /> Bounty Board
        </Link>

        {/* Main Card */}
        <div className="relative overflow-hidden border border-white/5 bg-[#050505]">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-neon-purple/50 via-neon-cyan/30 to-transparent" />

          <div className="p-8 space-y-6">
            {/* Title + Status */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-neon-purple" />
                  <h1 className="text-2xl font-black uppercase tracking-tighter text-white">{bounty.title}</h1>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant="outline" className={`text-[10px] font-black uppercase tracking-widest rounded-none ${status.color} ${status.bg} ${status.border}`}>
                    {status.label}
                  </Badge>
                  {bounty.game_name && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-neon-cyan bg-neon-cyan/5 border border-neon-cyan/10 px-2 py-0.5">
                      <Gamepad2 className="h-2.5 w-2.5" /> {bounty.game_name}
                    </span>
                  )}
                  {bounty.categories && (
                    <span className="text-[10px] font-medium text-muted-foreground bg-white/5 border border-white/5 px-2 py-0.5">
                      {bounty.categories.icon} {bounty.categories.name}
                    </span>
                  )}
                  {isDeadlineExpired && (
                    <span className="text-[10px] font-medium text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 flex items-center gap-1">
                      <AlertTriangle className="h-2.5 w-2.5" /> PRAZO EXPIRADO
                    </span>
                  )}
                </div>
              </div>

              {/* Reward — only visible to requester and admin */}
              {(isRequester || isAdmin) && Number(bounty.reward_amount) > 0 && (
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Recompensa (privada)</p>
                  <p className="text-3xl font-black text-neon-green font-mono flex items-center gap-1">
                    <DollarSign className="h-6 w-6" />
                    R$ {Number(bounty.reward_amount).toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="bg-[#030304] border border-white/5 p-5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-3">DESCRIÇÃO</p>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{bounty.description}</p>
            </div>

            {/* Meta info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono border-t border-white/5 pt-4">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Solicitante</p>
                <Link to={`/modder/${bounty.profiles?.user_id}`} className="flex items-center gap-1 text-neon-purple hover:underline">
                  <User className="h-3 w-3" />
                  {bounty.profiles?.display_name ?? bounty.profiles?.username ?? "Anônimo"}
                </Link>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Postado</p>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(bounty.created_at), { locale: ptBR, addSuffix: true })}
                </span>
              </div>
              {bounty.deadline && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Prazo</p>
                  <span className={`flex items-center gap-1 ${isDeadlineExpired ? "text-destructive" : "text-muted-foreground"}`}>
                    <Calendar className="h-3 w-3" />
                    {new Date(bounty.deadline).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              )}
            </div>

            {/* Owner actions */}
            {(isRequester || isAdmin) && bounty.status !== "completed" && bounty.status !== "cancelled" && (
              <div className="flex gap-2 border-t border-white/5 pt-4">
                {bounty.status === "in_progress" && (
                  <Button onClick={handleMarkCompleted} size="sm" className="bg-neon-green/10 hover:bg-neon-green/20 text-neon-green border border-neon-green/30 rounded-none font-black uppercase tracking-widest text-[10px]">
                    <Trophy className="h-3.5 w-3.5 mr-1.5" /> Marcar Concluída
                  </Button>
                )}
                <Button onClick={handleCancelBounty} size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10 rounded-none font-black uppercase tracking-widest text-[10px]">
                  <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancelar Encomenda
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Applications Section */}
        <div className="border border-white/5 bg-[#050505]">
          <div className="p-5 border-b border-white/5 bg-[#030304] flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
              <Shield className="h-4 w-4 text-neon-purple" />
              Candidaturas {(isRequester || isAdmin) ? `(${applications?.length ?? 0})` : ""}
            </h2>
            {bounty.status === "open" && <span className="text-[10px] font-mono text-neon-green animate-pulse">● ACEITANDO</span>}
          </div>

          <div className="p-5 space-y-4">
            {/* Apply form — only for modders who haven't applied and aren't the requester */}
            {isModder && !isRequester && bounty.status === "open" && !hasApplied && (
              <div className="bg-[#030304] border border-neon-purple/20 p-5 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-neon-purple">Enviar Candidatura</p>
                <Textarea
                  id="apply-message"
                  placeholder="> Descreva sua experiência, prazo estimado e como você faria esse script..."
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  rows={4}
                  className="bg-[#050505] border-white/10 focus-visible:ring-neon-purple rounded-none text-sm font-mono resize-none"
                />
                <Button
                  onClick={handleApply}
                  disabled={applying}
                  className="bg-neon-purple hover:bg-neon-purple/90 text-white rounded-none font-black uppercase tracking-widest text-[10px] h-10 px-6"
                >
                  <Send className="h-3.5 w-3.5 mr-2" />
                  {applying ? "Enviando..." : "Candidatar-se"}
                </Button>
              </div>
            )}

            {/* Prompt to login if not authenticated */}
            {!user && bounty.status === "open" && (
              <div className="py-8 text-center space-y-2">
                <Target className="h-8 w-8 text-neon-purple/20 mx-auto" />
                <p className="text-sm text-muted-foreground font-mono">Faça login como modder para se candidatar.</p>
              </div>
            )}

            {/* Modder sees only their own application status */}
            {user && !isRequester && !isAdmin && hasApplied && myApplication && (
              <div className={`p-4 border text-sm font-mono ${
                myApplication.status === "accepted" ? "border-neon-green/30 bg-neon-green/5 text-neon-green" :
                myApplication.status === "rejected" ? "border-destructive/30 bg-destructive/5 text-destructive" :
                "border-white/10 bg-white/5 text-muted-foreground"
              }`}>
                {myApplication.status === "accepted" && "✅ Sua candidatura foi aceita! Entre em contato com o solicitante."}
                {myApplication.status === "rejected" && "❌ Sua candidatura foi recusada."}
                {myApplication.status === "pending" && "⏳ Candidatura enviada. Aguardando resposta do solicitante."}
              </div>
            )}

            {/* Non-modder authenticated user who isn't requester/admin */}
            {user && !isRequester && !isAdmin && !isModder && bounty.status === "open" && (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground font-mono">Apenas modders aprovados podem se candidatar.</p>
              </div>
            )}

            {/* Full applications list — ONLY for requester and admin */}
            {(isRequester || isAdmin) && (
              applications && applications.length > 0 ? (
                <div className="space-y-3">
                  {applications.map((app: any) => (
                    <div key={app.id} className={`p-4 border transition-colors ${
                      app.status === "accepted" ? "border-neon-green/30 bg-neon-green/5" :
                      app.status === "rejected" ? "border-white/5 opacity-40" :
                      "border-white/5 bg-[#030304]"
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <Link to={`/modder/${app.profiles?.user_id}`} className="text-xs font-black text-neon-cyan hover:underline font-mono">
                              @{app.profiles?.display_name ?? app.profiles?.username}
                            </Link>
                            <span className="text-[10px] text-muted-foreground/50 font-mono">
                              {formatDistanceToNow(new Date(app.created_at), { locale: ptBR, addSuffix: true })}
                            </span>
                            {app.status === "accepted" && (
                              <Badge variant="outline" className="text-[10px] rounded-none text-neon-green border-neon-green/30 bg-neon-green/10">Aceito</Badge>
                            )}
                            {app.status === "rejected" && (
                              <Badge variant="outline" className="text-[10px] rounded-none text-destructive border-destructive/30 bg-destructive/10">Recusado</Badge>
                            )}
                          </div>
                          <p className="text-sm text-foreground/70 leading-relaxed">{app.message}</p>
                        </div>

                        {/* Accept button */}
                        {bounty.status === "open" && app.status === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => handleAcceptModder(app)}
                            className="shrink-0 bg-neon-green/10 hover:bg-neon-green/20 text-neon-green border border-neon-green/30 rounded-none font-black uppercase tracking-widest text-[10px] h-8 px-3"
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Aceitar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Target className="h-10 w-10 text-neon-purple/20 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm font-mono">Nenhuma candidatura recebida ainda.</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
