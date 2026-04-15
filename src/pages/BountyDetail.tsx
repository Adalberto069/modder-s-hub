import { useState, useEffect, useCallback, useRef } from "react";
import { BountyChat } from "@/components/bounties/BountyChat";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
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
  ArrowLeft, Send, Shield, Trophy, AlertTriangle, Calendar, Heart,
  Trash2, RefreshCw, UserMinus, CreditCard, QrCode, Loader2, Copy, CheckCheck, Download
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";

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
  const [searchParams] = useSearchParams();
  const [applyMessage, setApplyMessage] = useState("");
  const [applying, setApplying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card">("pix");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [pixData, setPixData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Start polling for PIX payment
  const startPixPolling = useCallback((purchaseId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setPollingStatus("pending");
    
    const poll = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-bounty-payment", {
          body: { purchase_id: purchaseId },
        });
        if (error) return;
        
        const status = data?.status;
        setPollingStatus(status);
        
        if (status === "completed") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          toast.success("Pagamento confirmado! 🎉 O download já está liberado.");
          setPixData(null);
          setShowPaymentDialog(false);
          invalidateAll();
        } else if (status === "rejected" || status === "cancelled") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          toast.error("Pagamento " + (status === "rejected" ? "rejeitado" : "cancelado") + ". Tente novamente.");
          setPixData(null);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    // Poll every 5 seconds
    poll();
    pollingRef.current = setInterval(poll, 5000);
  }, [queryClient, id]);

  // Handle payment callback
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    if (paymentStatus === "success") {
      toast.success("Pagamento confirmado! 🎉 O download já está liberado.");
      invalidateAll();
    } else if (paymentStatus === "failure") {
      toast.error("Pagamento falhou. Tente novamente.");
    }
  }, [searchParams, id, queryClient]);

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

  // Check existing bounty purchase
  const { data: bountyPurchase } = useQuery({
    queryKey: ["bounty-purchase", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bounty_purchases")
        .select("*")
        .eq("bounty_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id && !!user,
  });

  // Check deliveries for approval/dispute status
  const { data: deliveries } = useQuery({
    queryKey: ["bounty-deliveries-status", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bounty_deliveries")
        .select("id, test_approved, disputed, dispute_resolved, released")
        .eq("bounty_id", id);
      return data ?? [];
    },
    enabled: !!id && !!user,
  });

  const isRequester = user?.id === bounty?.requester_id;
  const hasApplied = applications?.some((a: any) => a.modder_id === user?.id);
  const myApplication = applications?.find((a: any) => a.modder_id === user?.id);
  const hasApprovedDelivery = deliveries?.some((d: any) => d.test_approved);
  const hasOpenDispute = deliveries?.some((d: any) => d.disputed && !d.dispute_resolved);
  const hasAnyDelivery = deliveries && deliveries.length > 0;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["bounty", id] });
    queryClient.invalidateQueries({ queryKey: ["bounty-applications", id] });
    queryClient.invalidateQueries({ queryKey: ["bounty-purchase", id] });
    queryClient.invalidateQueries({ queryKey: ["bounty-deliveries-status", id] });
  };

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
    invalidateAll();
  };

  const handleAcceptModder = async (application: any) => {
    if (!isRequester && !isAdmin) return;

    const { error: appError } = await (supabase as any)
      .from("bounty_applications")
      .update({ status: "accepted" })
      .eq("id", application.id);

    if (appError) { toast.error(appError.message); return; }

    await (supabase as any)
      .from("bounty_applications")
      .update({ status: "rejected" })
      .eq("bounty_id", id)
      .neq("id", application.id);

    await (supabase as any)
      .from("bounties")
      .update({ status: "in_progress", assigned_modder_id: application.modder_id })
      .eq("id", id);

    toast.success("Modder aceito! A encomenda está em andamento. ✅");
    invalidateAll();
  };

  // ---- Payment ----
  const handleInitPayment = async () => {
    if (!user || !isRequester) return;

    setPaymentLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-bounty-payment", {
        body: { bounty_id: id, payment_method: paymentMethod },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (paymentMethod === "card" && data?.init_point) {
        window.open(data.init_point, "_blank");
        setShowPaymentDialog(false);
        toast.info("Redirecionando para o Mercado Pago...");
      } else if (paymentMethod === "pix") {
        setPixData(data);
        // Start auto-polling for PIX payment confirmation
        if (data?.purchase_id) {
          startPixPolling(data.purchase_id);
        }
      }
    } catch (err: any) {
      toast.error("Erro ao criar pagamento: " + (err.message || "Tente novamente"));
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleCopyPix = async () => {
    if (pixData?.qr_code) {
      await navigator.clipboard.writeText(pixData.qr_code);
      setCopied(true);
      toast.success("Código Pix copiado!");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleMarkCompleted = async () => {
    if (!isRequester && !isAdmin) return;

    const rewardAmount = Number(bounty?.reward_amount);
    const isPaid = rewardAmount > 0;

    // Block if there's an open dispute
    if (hasOpenDispute && !isAdmin) {
      toast.error("Há uma disputa em aberto. Aguarde resolução do admin.");
      return;
    }

    // Block if paid but no delivery approved (unless admin)
    if (isPaid && isRequester && hasAnyDelivery && !hasApprovedDelivery && !isAdmin) {
      toast.error("Teste e aprove o script entregue antes de pagar.");
      return;
    }

    // If paid bounty and no completed purchase, need to pay first
    if (isPaid && isRequester && (!bountyPurchase || bountyPurchase.status !== "completed")) {
      setShowPaymentDialog(true);
      return;
    }

    await (supabase as any)
      .from("bounties")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Encomenda marcada como concluída! 🏆");
    invalidateAll();
  };

  const handleCancelBounty = async () => {
    if (!isRequester && !isAdmin) return;
    await (supabase as any).from("bounties").update({ status: "cancelled" }).eq("id", id);
    toast.success("Encomenda cancelada.");
    navigate("/bounties");
  };

  // ---- Admin actions ----
  const handleDeleteBounty = async () => {
    if (!isAdmin) return;
    await (supabase as any).from("bounty_messages").delete().eq("bounty_id", id);
    await (supabase as any).from("bounty_applications").delete().eq("bounty_id", id);
    await (supabase as any).from("bounty_purchases").delete().eq("bounty_id", id);
    const { error } = await (supabase as any).from("bounties").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Encomenda excluída pelo admin.");
    navigate("/bounties");
  };

  const handleChangeStatus = async (newStatus: string) => {
    if (!isAdmin) return;
    const updates: any = { status: newStatus };
    if (newStatus === "completed") updates.completed_at = new Date().toISOString();
    if (newStatus === "open") { updates.assigned_modder_id = null; }
    await (supabase as any).from("bounties").update(updates).eq("id", id);
    toast.success(`Status alterado para: ${statusConfig[newStatus]?.label ?? newStatus}`);
    invalidateAll();
  };

  const handleUnassignModder = async () => {
    if (!isAdmin) return;
    await (supabase as any).from("bounties").update({ status: "open", assigned_modder_id: null }).eq("id", id);
    await (supabase as any).from("bounty_applications").update({ status: "pending" }).eq("bounty_id", id);
    toast.success("Modder desatribuído. Encomenda reaberta.");
    invalidateAll();
  };

  const handleDeleteApplication = async (appId: string) => {
    if (!isAdmin) return;
    const { error } = await (supabase as any).from("bounty_applications").delete().eq("id", appId);
    if (error) { toast.error(error.message); return; }
    toast.success("Candidatura removida.");
    invalidateAll();
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
  const rewardAmount = Number(bounty.reward_amount);
  const isPaid = rewardAmount > 0;
  const isPurchaseCompleted = bountyPurchase?.status === "completed";

  // Fee calculations for display
  const pixFee = Math.round(rewardAmount * 0.01 * 100) / 100;
  const cardFee = Math.round(rewardAmount * 0.0499 * 100) / 100;
  const pixTotal = Math.round((rewardAmount + pixFee) * 100) / 100;
  const cardTotal = Math.round((rewardAmount + cardFee) * 100) / 100;

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
            {/* Title + Status + Reward */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-2 flex-1">
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
                  {isPurchaseCompleted && (
                    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest rounded-none text-neon-green bg-neon-green/10 border-neon-green/30">
                      ✅ Pago
                    </Badge>
                  )}
                </div>
              </div>

              {/* Reward — PUBLIC */}
              <div className="text-right shrink-0">
                {isPaid ? (
                  <>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Recompensa</p>
                    <p className="text-3xl font-black text-neon-green font-mono flex items-center gap-1 justify-end">
                      <DollarSign className="h-6 w-6" />
                      R$ {rewardAmount.toFixed(2).replace('.', ',')}
                    </p>
                    <p className="text-[9px] text-muted-foreground/50 font-mono mt-0.5">
                      Pagamento via Mercado Pago
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    <Heart className="h-5 w-5 text-neon-cyan" />
                    <p className="text-sm font-black text-neon-cyan uppercase tracking-widest">Voluntário</p>
                    <p className="text-[9px] text-muted-foreground/50 font-mono">Sem recompensa</p>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="bg-[#030304] border border-white/5 p-5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-3">DESCRIÇÃO</p>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{bounty.description}</p>
            </div>

            {/* Meta info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono border-t border-white/5 pt-4">
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
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Tipo</p>
                <span className={`flex items-center gap-1 ${isPaid ? "text-neon-green" : "text-neon-cyan"}`}>
                  {isPaid ? <DollarSign className="h-3 w-3" /> : <Heart className="h-3 w-3" />}
                  {isPaid ? `R$ ${rewardAmount.toFixed(2).replace('.', ',')}` : "Voluntário"}
                </span>
              </div>
            </div>

            {/* Delivery info */}
            {bounty.status === "in_progress" && (isRequester || bounty.assigned_modder_id === user?.id) && (
              <div className="bg-neon-cyan/5 border border-neon-cyan/20 p-4">
                <p className="text-[10px] uppercase tracking-widest text-neon-cyan font-mono font-bold mb-2">🔐 Entrega Segura (Escrow)</p>
                <p className="text-xs text-foreground/70 leading-relaxed">
                  O modder envia o script .lua pelo botão de upload no chat. O arquivo fica <strong className="text-neon-green">protegido e trancado</strong> até o pagamento ser confirmado.
                </p>
                <ul className="text-xs text-foreground/60 mt-1 space-y-1 ml-4 list-disc">
                  <li>Modder faz upload → arquivo fica em custódia</li>
                  <li>Solicitante paga a recompensa → download é liberado automaticamente</li>
                  <li>Ninguém pode pegar o script sem pagar, e ninguém paga sem o script estar entregue</li>
                </ul>
                {isPaid && !isPurchaseCompleted && isRequester && (
                  <div className="mt-3 p-3 bg-neon-green/5 border border-neon-green/20">
                    <p className="text-[10px] text-neon-green font-mono font-bold mb-1">💰 Pagamento Pendente</p>
                    <p className="text-[10px] text-foreground/60">
                      Ao clicar em "Pagar e Concluir", o download do script será liberado automaticamente.
                    </p>
                    <div className="flex gap-4 mt-2 text-[9px] text-muted-foreground font-mono">
                      <span>Pix: R$ {pixTotal.toFixed(2).replace('.', ',')} (+1%)</span>
                      <span>Cartão: R$ {cardTotal.toFixed(2).replace('.', ',')} (+4,99%)</span>
                    </div>
                  </div>
                )}
                {isPurchaseCompleted && (
                  <p className="text-[10px] text-neon-green font-mono mt-2">✅ Pagamento confirmado — download liberado!</p>
                )}
              </div>
            )}

            {/* Owner/Admin actions */}
            {(isRequester || isAdmin) && bounty.status !== "completed" && bounty.status !== "cancelled" && (
              <div className="flex flex-wrap gap-2 border-t border-white/5 pt-4">
                {bounty.status === "in_progress" && (
                  <Button
                    onClick={handleMarkCompleted}
                    size="sm"
                    disabled={isRequester && !isAdmin && (hasOpenDispute || (isPaid && hasAnyDelivery && !hasApprovedDelivery))}
                    className="bg-neon-green/10 hover:bg-neon-green/20 text-neon-green border border-neon-green/30 rounded-none font-black uppercase tracking-widest text-[10px] disabled:opacity-30"
                  >
                    <Trophy className="h-3.5 w-3.5 mr-1.5" />
                    {isPaid && isRequester && !isPurchaseCompleted
                      ? hasApprovedDelivery ? "Pagar e Concluir" : "Aprove o script para pagar"
                      : "Marcar Concluída"}
                  </Button>
                )}
                <Button onClick={handleCancelBounty} size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10 rounded-none font-black uppercase tracking-widest text-[10px]">
                  <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancelar Encomenda
                </Button>
              </div>
            )}

            {/* Admin Panel */}
            {isAdmin && (
              <div className="border border-neon-purple/20 bg-neon-purple/5 p-4 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-neon-purple flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Painel Admin
                </p>
                <div className="flex flex-wrap gap-2">
                  {bounty.status !== "open" && (
                    <Button size="sm" variant="outline" onClick={() => handleChangeStatus("open")}
                      className="rounded-none text-[10px] font-bold uppercase tracking-widest border-neon-green/20 text-neon-green hover:bg-neon-green/10">
                      <RefreshCw className="h-3 w-3 mr-1" /> Reabrir
                    </Button>
                  )}
                  {bounty.status !== "completed" && (
                    <Button size="sm" variant="outline" onClick={() => handleChangeStatus("completed")}
                      className="rounded-none text-[10px] font-bold uppercase tracking-widest border-neon-purple/20 text-neon-purple hover:bg-neon-purple/10">
                      <Trophy className="h-3 w-3 mr-1" /> Forçar Conclusão
                    </Button>
                  )}
                  {bounty.status !== "cancelled" && (
                    <Button size="sm" variant="outline" onClick={() => handleChangeStatus("cancelled")}
                      className="rounded-none text-[10px] font-bold uppercase tracking-widest border-destructive/20 text-destructive hover:bg-destructive/10">
                      <XCircle className="h-3 w-3 mr-1" /> Forçar Cancelamento
                    </Button>
                  )}
                  {bounty.assigned_modder_id && (
                    <Button size="sm" variant="outline" onClick={handleUnassignModder}
                      className="rounded-none text-[10px] font-bold uppercase tracking-widest border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10">
                      <UserMinus className="h-3 w-3 mr-1" /> Desatribuir Modder
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline"
                        className="rounded-none text-[10px] font-bold uppercase tracking-widest border-destructive/30 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3 w-3 mr-1" /> Excluir Encomenda
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-[#050505] border-white/10 rounded-none">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">Excluir encomenda?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso excluirá permanentemente a encomenda, todas as candidaturas, mensagens e pagamentos. Essa ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-none">Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteBounty} className="bg-destructive hover:bg-destructive/90 rounded-none">
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
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
            {isModder && !isRequester && bounty.status === "open" && !hasApplied && (
              <div className="bg-[#030304] border border-neon-purple/20 p-5 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-neon-purple">Enviar Candidatura</p>
                {isPaid && (
                  <p className="text-xs text-neon-green/70 font-mono">
                    💰 Recompensa: R$ {rewardAmount.toFixed(2).replace('.', ',')} (você recebe 80%)
                  </p>
                )}
                {!isPaid && (
                  <p className="text-xs text-neon-cyan/70 font-mono">
                    💙 Encomenda voluntária — sem recompensa em dinheiro
                  </p>
                )}
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

            {!user && bounty.status === "open" && (
              <div className="py-8 text-center space-y-2">
                <Target className="h-8 w-8 text-neon-purple/20 mx-auto" />
                <p className="text-sm text-muted-foreground font-mono">Faça login como modder para se candidatar.</p>
              </div>
            )}

            {user && !isRequester && !isAdmin && hasApplied && myApplication && (
              <div className={`p-4 border text-sm font-mono ${
                myApplication.status === "accepted" ? "border-neon-green/30 bg-neon-green/5 text-neon-green" :
                myApplication.status === "rejected" ? "border-destructive/30 bg-destructive/5 text-destructive" :
                "border-white/10 bg-white/5 text-muted-foreground"
              }`}>
                {myApplication.status === "accepted" && "✅ Sua candidatura foi aceita! Use o chat abaixo para comunicação."}
                {myApplication.status === "rejected" && "❌ Sua candidatura foi recusada."}
                {myApplication.status === "pending" && "⏳ Candidatura enviada. Aguardando resposta do solicitante."}
              </div>
            )}

            {user && !isRequester && !isAdmin && !isModder && bounty.status === "open" && (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground font-mono">Apenas modders aprovados podem se candidatar.</p>
              </div>
            )}

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
                        <div className="flex gap-1.5 shrink-0">
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
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteApplication(app.id)}
                              className="h-8 w-8 p-0 border-destructive/20 text-destructive hover:bg-destructive/10 rounded-none"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
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

        {/* Chat */}
        {bounty.assigned_modder_id && (
          <BountyChat
            bountyId={bounty.id}
            bountyStatus={bounty.status}
            requesterId={bounty.requester_id}
            assignedModderId={bounty.assigned_modder_id}
            isAdmin={isAdmin}
            isPaid={isPaid}
            isPurchaseCompleted={isPurchaseCompleted}
          />
        )}

        {/* Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="bg-[#050505] border-white/10 rounded-none max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white font-black uppercase tracking-widest text-sm">
                💰 Pagar Encomenda
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Pague a recompensa de R$ {rewardAmount.toFixed(2).replace('.', ',')} para o modder. O valor inclui taxa de processamento.
              </DialogDescription>
            </DialogHeader>

            {!pixData ? (
              <div className="space-y-4">
                {/* Method selection */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod("pix")}
                    className={`p-4 border text-left transition-colors ${
                      paymentMethod === "pix"
                        ? "border-neon-green/50 bg-neon-green/5"
                        : "border-white/10 bg-[#030304] hover:border-white/20"
                    }`}
                  >
                    <QrCode className={`h-5 w-5 mb-2 ${paymentMethod === "pix" ? "text-neon-green" : "text-muted-foreground"}`} />
                    <p className="text-xs font-black uppercase text-white">Pix</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Taxa: 1%</p>
                    <p className="text-sm font-black text-neon-green mt-1 font-mono">
                      R$ {pixTotal.toFixed(2).replace('.', ',')}
                    </p>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("card")}
                    className={`p-4 border text-left transition-colors ${
                      paymentMethod === "card"
                        ? "border-neon-cyan/50 bg-neon-cyan/5"
                        : "border-white/10 bg-[#030304] hover:border-white/20"
                    }`}
                  >
                    <CreditCard className={`h-5 w-5 mb-2 ${paymentMethod === "card" ? "text-neon-cyan" : "text-muted-foreground"}`} />
                    <p className="text-xs font-black uppercase text-white">Cartão</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Taxa: 4,99%</p>
                    <p className="text-sm font-black text-neon-cyan mt-1 font-mono">
                      R$ {cardTotal.toFixed(2).replace('.', ',')}
                    </p>
                  </button>
                </div>

                {/* Breakdown */}
                <div className="bg-[#030304] border border-white/5 p-3 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Recompensa</span>
                    <span>R$ {rewardAmount.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxa ({paymentMethod === "pix" ? "1%" : "4,99%"})</span>
                    <span>R$ {(paymentMethod === "pix" ? pixFee : cardFee).toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold border-t border-white/10 pt-1.5">
                    <span>Total</span>
                    <span>R$ {(paymentMethod === "pix" ? pixTotal : cardTotal).toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex justify-between text-neon-green/70 text-[10px]">
                    <span>Modder recebe (80%)</span>
                    <span>R$ {(rewardAmount * 0.8).toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>

                <Button
                  onClick={handleInitPayment}
                  disabled={paymentLoading}
                  className="w-full bg-neon-green/10 hover:bg-neon-green/20 text-neon-green border border-neon-green/30 rounded-none font-black uppercase tracking-widest text-[10px] h-11"
                >
                  {paymentLoading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</>
                  ) : (
                    <>{paymentMethod === "pix" ? <QrCode className="h-4 w-4 mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
                    Pagar R$ {(paymentMethod === "pix" ? pixTotal : cardTotal).toFixed(2).replace('.', ',')}</>
                  )}
                </Button>
              </div>
            ) : (
              /* PIX QR Code with auto-polling */
              <div className="space-y-4">
                <div className="text-center">
                  {pixData.qr_code_base64 && (
                    <img
                      src={`data:image/png;base64,${pixData.qr_code_base64}`}
                      alt="QR Code Pix"
                      className="mx-auto w-48 h-48 bg-white p-2"
                    />
                  )}
                </div>

                {pixData.qr_code && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Pix Copia e Cola</p>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={pixData.qr_code}
                        className="flex-1 bg-[#030304] border border-white/10 px-3 py-2 text-[10px] font-mono text-foreground/70 truncate"
                      />
                      <Button
                        onClick={handleCopyPix}
                        size="sm"
                        variant="outline"
                        className="rounded-none border-neon-green/30 text-neon-green hover:bg-neon-green/10 shrink-0"
                      >
                        {copied ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Polling status indicator */}
                <div className="flex items-center justify-center gap-2 py-2">
                  {pollingStatus === "pending" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-neon-cyan" />
                      <p className="text-xs text-neon-cyan font-mono animate-pulse">
                        Aguardando pagamento... verificando automaticamente
                      </p>
                    </>
                  ) : pollingStatus === "completed" ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-neon-green" />
                      <p className="text-xs text-neon-green font-mono font-bold">
                        Pagamento confirmado! ✅
                      </p>
                    </>
                  ) : (
                    <p className="text-[10px] text-muted-foreground/50 font-mono text-center">
                      O pagamento será confirmado automaticamente após o Pix.
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => { 
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    pollingRef.current = null;
                    setPixData(null); 
                    setShowPaymentDialog(false); 
                  }}
                  variant="outline"
                  className="w-full rounded-none text-[10px] font-bold uppercase tracking-widest"
                >
                  Fechar
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
