import { useState, useEffect, useRef, useCallback } from "react";
import LuaCodeEditor from "@/components/LuaCodeEditor";
import ScriptAnalysis from "@/components/ScriptAnalysis";
import { ModerationMessages } from "@/components/ModerationMessages";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  Download, Star, ExternalLink, ArrowLeft, User, ShieldCheck, ShieldAlert, ShieldX,
  ChevronLeft, ChevronRight, Play, MessageSquare, Lock, CheckCircle, Clock,
  Copy, Check, Gamepad2, Tag, List, BookOpen, FileCode, ShoppingCart, Key, CreditCard, QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { LoginPromptDialog } from "@/components/LoginPromptDialog";

const statusConfig: Record<string, { label: string; className: string }> = {
  working: { label: "Working", className: "bg-accent/20 text-accent border-accent/30" },
  detected: { label: "Detected", className: "bg-destructive/20 text-destructive border-destructive/30" },
  updating: { label: "Updating", className: "bg-primary/20 text-primary border-primary/30" },
};

function YouTubeEmbed({ url }: { url: string }) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  if (!match) return null;
  return (
    <div className="aspect-video rounded-lg overflow-hidden neon-border">
      <iframe
        src={`https://www.youtube.com/embed/${match[1]}`}
        className="w-full h-full"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    </div>
  );
}

function StarRating({ rating, onRate, interactive = false }: { rating: number; onRate?: (r: number) => void; interactive?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-5 w-5 transition-colors ${
            (interactive ? hover || rating : rating) >= i
              ? "fill-accent text-accent"
              : "text-muted-foreground/30"
          } ${interactive ? "cursor-pointer" : ""}`}
          onClick={() => interactive && onRate?.(i)}
          onMouseEnter={() => interactive && setHover(i)}
          onMouseLeave={() => interactive && setHover(0)}
        />
      ))}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-lg overflow-hidden border border-border bg-[hsl(240,15%,3%)]">
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/50 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-destructive/60" />
            <span className="w-3 h-3 rounded-full bg-primary/60" />
            <span className="w-3 h-3 rounded-full bg-accent/60" />
          </div>
          <span className="text-[10px] text-muted-foreground font-mono ml-2">script.lua</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado!" : "Copiar"}
        </Button>
      </div>
      <LuaCodeEditor value={code} readOnly minHeight="200px" />
    </div>
  );
}

function generateLicenseKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segments: string[] = [];
  for (let s = 0; s < 3; s++) {
    let seg = "";
    for (let i = 0; i < 4; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(seg);
  }
  return segments.join("-");
}

export default function ScriptDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [pendingRenewal, setPendingRenewal] = useState(false);
  const [pixData, setPixData] = useState<{
    purchase_id: string;
    qr_code: string | null;
    qr_code_base64: string | null;
  } | null>(null);
  const [pixPolling, setPixPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Handle card payment return via query params
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    if (paymentStatus === "success") {
      toast.success("Pagamento com cartão aprovado! Sua licença será ativada em instantes.");
      queryClient.invalidateQueries({ queryKey: ["script-license", id, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-licenses"] });
      setSearchParams({}, { replace: true });
    } else if (paymentStatus === "failure") {
      toast.error("Pagamento com cartão falhou. Tente novamente.");
      setSearchParams({}, { replace: true });
    } else if (paymentStatus === "pending") {
      toast.info("Pagamento pendente. Você será notificado quando for aprovado.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient, id, user?.id]);

  // Poll PIX payment status
  const startPolling = useCallback((purchaseId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setPixPolling(true);

    pollingRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-pix-payment", {
          body: { purchase_id: purchaseId },
        });
        if (error) return;
        if (data?.status === "completed" && data?.license_key) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setPixPolling(false);
          setPixData(null);
          setPurchaseSuccess(data.license_key);
          setPurchasing(false);
          toast.success("Pagamento PIX confirmado! Licença ativada.");
          queryClient.invalidateQueries({ queryKey: ["script-license", id, user?.id] });
          queryClient.invalidateQueries({ queryKey: ["my-licenses"] });
        } else if (data?.status === "rejected" || data?.status === "cancelled") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setPixPolling(false);
          setPixData(null);
          setPurchasing(false);
          toast.error("Pagamento PIX foi rejeitado ou cancelado.");
        }
      } catch {
        // continue polling
      }
    }, 5000); // Poll every 5 seconds
  }, [id, user?.id, queryClient]);

  const { data: script } = useQuery({
    queryKey: ["script", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("scripts")
        .select("*, categories(name, slug)")
        .eq("id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: modderProfile } = useQuery({
    queryKey: ["modder-profile", script?.modder_id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", script!.modder_id).single();
      return data;
    },
    enabled: !!script?.modder_id,
  });

  const { data: images } = useQuery({
    queryKey: ["script-images", id],
    queryFn: async () => {
      const { data } = await supabase.from("script_images").select("*").eq("script_id", id!).order("sort_order");
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: reviews } = useQuery({
    queryKey: ["script-reviews", id],
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("*").eq("script_id", id!).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  // Check if user already has a license for this script (active or expired)
  const { data: existingLicense } = useQuery({
    queryKey: ["script-license", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("licenses")
        .select("*")
        .eq("script_id", id!)
        .eq("user_id", user!.id)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
    enabled: !!id && !!user && !!script?.is_paid,
  });

  const isLicenseExpired = existingLicense?.expires_at && new Date(existingLicense.expires_at) < new Date();

  // Related tutorial
  const relatedTutorialId = (script as any)?.related_tutorial_id;
  const { data: relatedTutorial } = useQuery({
    queryKey: ["related-tutorial", relatedTutorialId],
    queryFn: async () => {
      const { data } = await supabase.from("tutorials").select("id, title, description, thumbnail_url").eq("id", relatedTutorialId).single();
      return data;
    },
    enabled: !!relatedTutorialId,
  });

  const isOwner = user && script && script.modder_id === user.id;
  const hasAccess = (!!existingLicense && !isLicenseExpired) || isOwner || (script && !script.is_paid);

  const reviewerIds = [...new Set(reviews?.map((r: any) => r.user_id) ?? [])];
  const { data: reviewerProfiles } = useQuery({
    queryKey: ["reviewer-profiles", reviewerIds],
    queryFn: async () => {
      if (reviewerIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("*").in("user_id", reviewerIds);
      return data ?? [];
    },
    enabled: reviewerIds.length > 0,
  });

  const profileMap = (reviewerProfiles ?? []).reduce((acc: any, p: any) => { acc[p.user_id] = p; return acc; }, {});

  const handlePurchase = async (isRenewal = false, paymentMethod: "pix" | "card" = "pix") => {
    if (!user) { setShowLoginPrompt(true); return; }
    if (!script) return;
    setPurchasing(true);
    setShowPaymentMethodModal(false);
    try {
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: { script_id: script.id, is_renewal: isRenewal, payment_method: paymentMethod },
      });
      if (error) throw error;

      if (paymentMethod === "card" && data?.init_point) {
        // Redirect to Mercado Pago checkout
        window.location.href = data.init_point;
        return;
      }

      if (data?.qr_code || data?.qr_code_base64) {
        setPixData({
          purchase_id: data.purchase_id,
          qr_code: data.qr_code,
          qr_code_base64: data.qr_code_base64,
        });
        startPolling(data.purchase_id);
      } else {
        throw new Error("Falha ao gerar pagamento");
      }
    } catch (err: any) {
      toast.error("Erro ao iniciar pagamento: " + (err.message || "Tente novamente"));
      setPurchasing(false);
    }
  };

  const handleRenew = async () => {
    if (!user || !script || !existingLicense) return;
    setPendingRenewal(true);
    setShowPaymentMethodModal(true);
  };

  const openPaymentMethodModal = () => {
    if (!user) { setShowLoginPrompt(true); return; }
    setPendingRenewal(false);
    setShowPaymentMethodModal(true);
  };

  const handleDownloadLoader = () => {
    if (!script || !user) return;
    const license = existingLicense || (purchaseSuccess ? { license_key: purchaseSuccess } : null);
    if (!license) return;

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "rdagqukqmphvlxbrefil";
    const baseUrl = `https://${projectId}.supabase.co/functions/v1`;

    const loaderCode = `-- ========================================
-- ${script.title} - Loader
-- Powered by ModHub License System
-- ========================================

local license = "${(license as any).license_key}"

-- Verify license
local checkUrl = "${baseUrl}/check-license?key=" .. license
local checkResponse = gg.makeRequest(checkUrl)

if checkResponse == nil then
  gg.alert("❌ Erro de conexão. Verifique sua internet.")
  os.exit()
end

if checkResponse.content == "expired" then
  gg.alert("⏳ Sua licença expirou!\\n\\nRenove no marketplace.")
  os.exit()
end

if checkResponse.content ~= "valid" then
  gg.alert("❌ Licença inválida ou banida!\\n\\nVerifique sua licença no dashboard.")
  os.exit()
end

gg.toast("✅ Licença válida! Carregando script...")

-- Load protected script
local scriptUrl = "${baseUrl}/get-script?key=" .. license
local scriptResponse = gg.makeRequest(scriptUrl)

if scriptResponse == nil or scriptResponse.content == nil then
  gg.alert("❌ Erro ao carregar o script.")
  os.exit()
end

-- Execute the script
local fn, err = load(scriptResponse.content)
if fn then
  fn()
else
  gg.alert("❌ Erro no script: " .. tostring(err))
end
`;

    const blob = new Blob([loaderCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = script.title.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim();
    a.download = `${safeName || "loader"}.lua`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Loader baixado!");
  };

  const handleDownloadFree = async () => {
    if (!script) return;
    if (!user) { setShowLoginPrompt(true); return; }
    const secStatus = (script as any).security_status;
    if (secStatus === "flagged" || secStatus === "under_review" || secStatus === "rejected") {
      toast.error("Este script está em análise de segurança e não pode ser baixado no momento.");
      return;
    }
    await supabase.from("scripts").update({ download_count: script.download_count + 1 }).eq("id", script.id);

    const downloadUrl = script.file_url || script.external_link;
    if (downloadUrl) {
      const gameName = (script as any).game_name;
      const safeName = [gameName, script.title]
        .filter(Boolean)
        .join(" - ")
        .replace(/[^a-zA-Z0-9\s\-_().àáâãéêíóôõúçÀÁÂÃÉÊÍÓÔÕÚÇ]/g, "")
        .trim();
      const ext = script.file_url?.match(/\.(\w+)$/)?.[1] || "lua";

      try {
        const response = await fetch(downloadUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${safeName || "script"}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        window.open(downloadUrl, "_blank");
      }
    }
    toast.success("Download iniciado!");
  };

  const handleReview = async () => {
    if (!user) { setShowLoginPrompt(true); return; }
    if (!script || newRating === 0) { toast.error("Selecione uma avaliação."); return; }
    setSubmitting(true);
    const existing = reviews?.find((r: any) => r.user_id === user.id);
    if (existing) {
      await supabase.from("reviews").update({ rating: newRating, comment: newComment || null }).eq("id", existing.id);
      toast.success("Avaliação atualizada!");
    } else {
      const { error } = await supabase.from("reviews").insert({ script_id: script.id, user_id: user.id, rating: newRating, comment: newComment || null });
      if (error) { toast.error(error.message); setSubmitting(false); return; }
      toast.success("Avaliação enviada!");
    }
    const allReviews = [...(reviews ?? []).filter((r: any) => r.user_id !== user.id), { rating: newRating }];
    const avg = allReviews.reduce((s: number, r: any) => s + r.rating, 0) / allReviews.length;
    await supabase.from("scripts").update({ average_rating: avg, total_ratings: allReviews.length }).eq("id", script.id);
    setNewComment(""); setNewRating(0); setSubmitting(false);
    queryClient.invalidateQueries({ queryKey: ["script-reviews", id] });
    queryClient.invalidateQueries({ queryKey: ["script", id] });
  };

  if (!script) {
    return <Layout><div className="container py-16 text-center text-muted-foreground">Carregando...</div></Layout>;
  }

  const scriptIsActive = (script as any).is_active !== false;
  const isInactiveBuyer = !scriptIsActive && existingLicense;

  const st = statusConfig[script.status] ?? statusConfig.working;
  const allMedia = [
    ...(script.thumbnail_url ? [{ type: "image" as const, url: script.thumbnail_url }] : []),
    ...(images ?? []).map((img: any) => ({ type: "image" as const, url: img.image_url })),
  ];
  const scriptFeatures = (script as any).features ?? [];
  const scriptTags = (script as any).tags ?? [];
  const luaCode = (script as any).lua_code;
  const gameName = (script as any).game_name;
  const scriptVersion = (script as any).version;

  return (
    <Layout>
      <div className="container py-8 max-w-6xl">
        <Link to="/marketplace" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-neon-purple transition-colors mb-8 group">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> 
          <span className="font-medium">Voltar ao Marketplace</span>
        </Link>

        {/* Hero Header Section */}
        <div className="relative mb-10 p-6 sm:p-8 rounded-2xl border border-white/5 bg-card/30 backdrop-blur-xl overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-neon-purple/5 blur-[100px] -z-10" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-neon-green/5 blur-[80px] -z-10" />
          
          <div className="flex flex-col md:flex-row md:items-start gap-8">
            {/* Gallery / Image Preview */}
            <div className="w-full md:w-2/5 space-y-4">
              {allMedia.length > 0 ? (
                <div className="relative rounded-xl overflow-hidden border border-white/10 group shadow-2xl aspect-[4/3] bg-secondary/20">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={galleryIndex}
                      src={allMedia[galleryIndex]?.url}
                      alt={script.title}
                      className="w-full h-full object-cover"
                      initial={{ opacity: 0, scale: 1.1 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
                    />
                  </AnimatePresence>
                  
                  {allMedia.length > 1 && (
                    <>
                      <button 
                        onClick={() => setGalleryIndex((p) => (p === 0 ? allMedia.length - 1 : p - 1))} 
                        className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-md rounded-full p-2 border border-white/10 opacity-0 group-hover:opacity-100 transition-all hover:bg-neon-purple/50"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => setGalleryIndex((p) => (p === allMedia.length - 1 ? 0 : p + 1))} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-md rounded-full p-2 border border-white/10 opacity-0 group-hover:opacity-100 transition-all hover:bg-neon-purple/50"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                  
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 px-4">
                    {allMedia.map((_, i) => (
                      <button 
                        key={i} 
                        onClick={() => setGalleryIndex(i)} 
                        className={`transition-all duration-300 rounded-full ${
                          i === galleryIndex ? "w-6 h-1.5 bg-neon-purple" : "w-1.5 h-1.5 bg-white/30 hover:bg-white/50"
                        }`} 
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="w-full aspect-square rounded-xl bg-secondary/30 flex items-center justify-center border border-dashed border-white/10">
                  <FileCode className="h-16 w-16 text-muted-foreground/20" />
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="flex-1 space-y-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-neon-purple/30 text-neon-purple bg-neon-purple/5 text-[10px] uppercase font-bold tracking-widest px-2.5">
                    {script.categories && (script.categories as any).name}
                  </Badge>
                  <Badge variant="outline" className={`${st.className} text-[10px] uppercase font-bold tracking-widest px-2.5`}>
                    {st.label}
                  </Badge>
                  {!scriptIsActive && (
                    <Badge variant="destructive" className="text-[10px] uppercase font-bold px-2.5">Inativo</Badge>
                  )}
                  {script.is_paid && (
                    <Badge variant="secondary" className="bg-neon-pink/10 text-neon-pink border-neon-pink/20 text-[10px] font-bold">
                       <ShoppingCart className="h-3 w-3 mr-1" /> Premium
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                    {script.title}
                  </h1>
                  
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                      <span className="font-bold">{script.average_rating ? Number(script.average_rating).toFixed(1) : "N/A"}</span>
                      <span className="text-muted-foreground">({script.total_ratings || 0} reviews)</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                      <Download className="h-3 w-3 text-neon-cyan" />
                      <span className="font-bold">{script.download_count}</span>
                      <span className="text-muted-foreground">downloads</span>
                    </div>
                    {scriptVersion && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 font-mono">
                        <Badge variant="outline" className="border-none p-0 text-[10px]">VER: {scriptVersion}</Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 w-fit">
                <Link to={`/modder/${script.modder_id}`} className="flex items-center gap-3 group">
                  <Avatar className="h-10 w-10 border-2 border-white/10 group-hover:border-neon-purple transition-all duration-300">
                    <AvatarImage src={modderProfile?.avatar_url} />
                    <AvatarFallback className="bg-primary/10">
                      {modderProfile?.username?.[0].toUpperCase() || "M"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Desenvolvido por</p>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-sm">@{modderProfile?.display_name || modderProfile?.username || "Modder"}</p>
                      <ShieldCheck className="h-3.5 w-3.5 text-neon-cyan" />
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">

            {script.video_url && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Play className="h-4 w-4 text-destructive" /> Demonstração
                </h3>
                <YouTubeEmbed url={script.video_url} />
              </div>
            )}

            {/* Description */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FileCode className="h-5 w-5 text-neon-purple" /> Sobre o Script
              </h3>
              <div className="p-6 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm text-muted-foreground leading-relaxed">
                {script.description ?? "Sem descrição relevante fornecida pelo autor."}
              </div>
            </div>

            {/* Features & Tags */}
            <div className="grid sm:grid-cols-2 gap-6">
              {scriptFeatures.length > 0 && (
                <Card className="border-white/5 bg-white/5 backdrop-blur-sm overflow-hidden">
                  <CardHeader className="pb-3 border-b border-white/5 bg-white/5">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <List className="h-4 w-4 text-neon-green" /> Funcionalidades
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ul className="space-y-2.5">
                      {scriptFeatures.map((f: string, i: number) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                          <CheckCircle className="h-3.5 w-3.5 text-neon-green shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {scriptTags.length > 0 && (
                <Card className="border-white/5 bg-white/5 backdrop-blur-sm overflow-hidden">
                  <CardHeader className="pb-3 border-b border-white/5 bg-white/5">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Tag className="h-4 w-4 text-neon-cyan" /> Tags de Busca
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 flex flex-wrap gap-2">
                    {scriptTags.map((t: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px] text-neon-cyan border-neon-cyan/20 bg-neon-cyan/5">
                        #{t}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Code Preview */}
            {luaCode && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <FileCode className="h-5 w-5 text-neon-green" /> Estrutura do Código
                  </h3>
                  <Badge variant="outline" className="border-neon-green/30 text-neon-green bg-neon-green/5">Preview Seguro</Badge>
                </div>
                <CodeBlock code={luaCode.split("\n").slice(0, 20).join("\n") + (luaCode.split("\n").length > 20 ? "\n-- ..." : "")} />
                <ScriptAnalysis code={luaCode} scriptId={id} />
              </div>
            )}

            {/* Related Tutorial */}
            {relatedTutorial && (
              <Card className="neon-border bg-card/80">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-neon-pink" /> Tutorial Relacionado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Link to={`/tutorial/${relatedTutorial.id}`} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    {relatedTutorial.thumbnail_url ? (
                      <img src={relatedTutorial.thumbnail_url} alt="" className="w-16 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-16 h-10 rounded bg-secondary flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{relatedTutorial.title}</p>
                      {relatedTutorial.description && (
                        <p className="text-[10px] text-muted-foreground truncate">{relatedTutorial.description}</p>
                      )}
                    </div>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Reviews */}
            <Card className="neon-border bg-card/80">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Avaliações ({reviews?.length ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {user ? (
                  <div className="space-y-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
                    <p className="text-xs text-muted-foreground">Sua avaliação:</p>
                    <StarRating rating={newRating} onRate={setNewRating} interactive />
                    <Textarea placeholder="Comentário (opcional)" value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={2} className="text-sm" />
                    <Button size="sm" onClick={handleReview} disabled={submitting || newRating === 0} className="neon-glow-purple">
                      {submitting ? "Enviando..." : "Enviar Avaliação"}
                    </Button>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-secondary/20 text-center">
                    <p className="text-xs text-muted-foreground mb-2">Faça login para avaliar este script.</p>
                    <Button size="sm" variant="outline" onClick={() => setShowLoginPrompt(true)}>Entrar</Button>
                  </div>
                )}

                <div className="space-y-3">
                  {reviews?.map((review: any) => {
                    const rProfile = profileMap[review.user_id];
                    return (
                      <div key={review.id} className="flex gap-3 p-3 rounded-lg border border-border/30 text-card-foreground">
                        <Avatar className="h-8 w-8 shrink-0">
                          {rProfile?.avatar_url && <AvatarImage src={rProfile.avatar_url} />}
                          <AvatarFallback className="bg-secondary text-[10px]">
                            {(rProfile?.username ?? "U").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold">{rProfile?.display_name ?? rProfile?.username ?? "Usuário"}</span>
                            <StarRating rating={review.rating} />
                          </div>
                          {review.comment && <p className="text-xs text-muted-foreground">{review.comment}</p>}
                        </div>
                      </div>
                    );
                  })}
                  {(reviews?.length ?? 0) === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma avaliação ainda. Seja o primeiro!</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar / Purchase Experience */}
          <div className="space-y-6">
            <Card className="relative overflow-hidden border-neon-purple/20 bg-card/40 backdrop-blur-xl shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/10 blur-[40px] -z-10" />
              
              <CardHeader className="pb-3 border-b border-white/5">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Checkout Elite</CardTitle>
              </CardHeader>
              
              <CardContent className="p-6 space-y-6">
                <div className="flex flex-col items-center gap-2 py-4">
                  {script.is_paid ? (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-muted-foreground">R$</span>
                        <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/50">{Number(script.price).toFixed(2)}</span>
                      </div>
                      <Badge variant="outline" className="border-neon-pink/30 text-neon-pink bg-neon-pink/5 px-4 py-1">
                        <Key className="h-3 w-3 mr-2" /> {(script as any).license_duration_days ? `${(script as any).license_duration_days} dias de acesso` : "Acesso Vitalício"}
                      </Badge>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-black text-neon-green">Grátis</span>
                      <Badge variant="outline" className="border-neon-green/30 text-neon-green bg-neon-green/5 px-4 py-1">Acesso Livre</Badge>
                    </>
                  )}
                </div>

                <div className="space-y-3">
                  {script.is_paid ? (
                    <>
                      {purchaseSuccess || (existingLicense && !isLicenseExpired) ? (
                        <div className="space-y-4">
                          <div className="bg-neon-green/5 border border-neon-green/20 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-neon-green text-sm font-bold">
                              <CheckCircle className="h-4 w-4" /> Licença Ativa
                            </div>
                            <div className="bg-black/40 rounded-lg p-3 border border-white/5 flex items-center justify-between group">
                              <code className="text-xs font-mono text-neon-purple truncate flex-1 mr-2">
                                {purchaseSuccess || (existingLicense as any).license_key}
                              </code>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 hover:bg-neon-purple/20"
                                onClick={() => {
                                  navigator.clipboard.writeText(purchaseSuccess || (existingLicense as any).license_key);
                                  toast.success("Chave copiada!");
                                }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <Button className="w-full bg-neon-purple hover:bg-neon-purple/90 text-white font-bold h-12 rounded-xl shadow-neon-purple/20" onClick={handleDownloadLoader}>
                              <Download className="mr-2 h-4 w-4" /> Baixar Loader
                            </Button>
                          </div>
                          
                          {existingLicense?.expires_at && (
                            <div className="text-center">
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-2">Expira em</p>
                              <Badge variant="outline" className="font-mono text-[11px] border-white/10 px-3">
                                {new Date(existingLicense.expires_at).toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' })}
                              </Badge>
                            </div>
                          )}
                        </div >
                      ) : isLicenseExpired ? (
                        <div className="space-y-4">
                          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-center">
                            <p className="text-sm font-bold text-destructive mb-1">Licença Expirada</p>
                            <p className="text-[11px] text-muted-foreground leading-tight">Renove seu acesso para continuar utilizando este script elite.</p>
                          </div>
                          <Button className="w-full bg-neon-purple hover:bg-neon-purple/90 text-white font-bold h-12 rounded-xl overflow-hidden relative group" onClick={handleRenew} disabled={purchasing}>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            <Clock className="mr-2 h-4 w-4" /> {purchasing ? "Iniciando..." : "Renovar Acesso"}
                          </Button>
                        </div>
                      ) : (
                        <Button className="w-full bg-neon-purple hover:bg-neon-purple/90 text-white font-bold h-12 rounded-xl overflow-hidden relative group" onClick={openPaymentMethodModal} disabled={purchasing}>
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                          <CreditCard className="mr-2 h-4 w-4" /> {purchasing ? "Processando..." : "Comprar Agora"}
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button className="w-full bg-neon-green hover:bg-neon-green/90 text-black font-bold h-12 rounded-xl group" onClick={handleDownloadFree}>
                      <Download className="mr-2 h-4 w-4 group-hover:translate-y-0.5 transition-transform" /> Baixar Agora
                    </Button>
                  )}

                  {!hasAccess && (
                    <p className="text-[10px] text-center text-muted-foreground px-4">
                      Ao adquirir, você concorda com nossos termos de uso e política de modders.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest text-center">Reviews</p>
                    <p className="text-lg font-black text-center">{script.total_ratings || 0}</p>
                  </div>
                  <div className="space-y-1 border-l border-white/5">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest text-center">Status</p>
                    <p className={`text-xs font-black text-center uppercase ${st.className.split(' ')[1]}`}>{st.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Support / Quick Info */}
            <Card className="border-white/5 bg-white/5 backdrop-blur-sm">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20">
                    <ShieldCheck className="h-4 w-4 text-neon-cyan" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold mb-0.5">Sistema de Ofuscação</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">Código protegido anti-reverso com marca d'água de comprador única.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-neon-purple/10 border border-neon-purple/20">
                    <CheckCircle className="h-4 w-4 text-neon-purple" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold mb-0.5">Verificado Elite</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">Script testado manualmente pela equipe de segurança Nexus Marketplace.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <LoginPromptDialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt} />

      {/* Payment Method Selection Modal */}
      {showPaymentMethodModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm bg-card border-primary/30">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg">Escolha o método de pagamento</CardTitle>
              <p className="text-xs text-muted-foreground">
                {script?.price ? `R$ ${Number(script.price).toFixed(2)}` : ""}
                {pendingRenewal ? " (Renovação)" : ""}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full h-14 justify-start gap-3 bg-accent/10 border border-accent/30 hover:bg-accent/20 text-foreground"
                variant="outline"
                onClick={() => handlePurchase(pendingRenewal, "pix")}
                disabled={purchasing}
              >
                <QrCode className="h-6 w-6 text-accent shrink-0" />
                <div className="text-left">
                  <p className="font-semibold text-sm">PIX</p>
                  <p className="text-[10px] text-muted-foreground">Pagamento instantâneo</p>
                </div>
              </Button>

              <Button
                className="w-full h-14 justify-start gap-3 bg-primary/10 border border-primary/30 hover:bg-primary/20 text-foreground"
                variant="outline"
                onClick={() => handlePurchase(pendingRenewal, "card")}
                disabled={purchasing}
              >
                <CreditCard className="h-6 w-6 text-primary shrink-0" />
                <div className="text-left">
                  <p className="font-semibold text-sm">Cartão de Crédito</p>
                  <p className="text-[10px] text-muted-foreground">Parcele em até 12x</p>
                </div>
              </Button>

              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => { setShowPaymentMethodModal(false); setPendingRenewal(false); }}
              >
                Cancelar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* PIX QR Code Modal */}
      {pixData && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm bg-card border-primary/30">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg">Pagar com PIX</CardTitle>
              <p className="text-xs text-muted-foreground">Escaneie o QR Code ou copie o código</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {pixData.qr_code_base64 && (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${pixData.qr_code_base64}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 rounded-lg"
                  />
                </div>
              )}

              {pixData.qr_code && (
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground text-center">Código PIX (Copia e Cola):</p>
                  <div className="flex items-center gap-2 bg-secondary/50 rounded p-2">
                    <code className="text-[10px] font-mono text-foreground flex-1 break-all line-clamp-3">
                      {pixData.qr_code}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(pixData.qr_code!);
                        toast.success("Código PIX copiado!");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              {pixPolling && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Aguardando pagamento...
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (pollingRef.current) clearInterval(pollingRef.current);
                  setPixPolling(false);
                  setPixData(null);
                  setPurchasing(false);
                }}
              >
                Cancelar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </Layout>
  );
}
