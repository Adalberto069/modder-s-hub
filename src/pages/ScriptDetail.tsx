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
  Copy, Check, Gamepad2, Tag, List, BookOpen, FileCode, ShoppingCart, Key, CreditCard, QrCode, Info,
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
    <div className="aspect-video rounded-xl overflow-hidden border border-white/10">
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
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 sm:h-5 sm:w-5 transition-colors ${
            (interactive ? hover || rating : rating) >= i
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/20"
          } ${interactive ? "cursor-pointer hover:scale-110 transition-transform" : ""}`}
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
    <div className="relative rounded-xl overflow-hidden border border-white/5 bg-[hsl(240,15%,3%)]">
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/50 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-destructive/60" />
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-primary/60" />
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-accent/60" />
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

export default function ScriptDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const { user, isAdmin } = useAuth();
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
  const [testingScript, setTestingScript] = useState(false);
  const [pixData, setPixData] = useState<{
    purchase_id: string;
    qr_code: string | null;
    qr_code_base64: string | null;
  } | null>(null);
  const [pixPolling, setPixPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

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
    }, 5000);
  }, [id, user?.id, queryClient]);

  const { data: script, isLoading: scriptLoading } = useQuery({
    queryKey: ["script", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("scripts").select("*, categories(name, slug)").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: scriptCode } = useQuery({
    queryKey: ["script-code", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("script_code").select("lua_code").eq("script_id", id!).single();
      if (error) throw error;
      return data?.lua_code ?? null;
    },
    enabled: !!id && !!script && !!user && (user.id === script.modder_id || isAdmin),
  });

  const { data: scriptPurchases } = useQuery({
    queryKey: ["script-purchases", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("script_purchases").select("*").eq("script_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!script,
  });

  const { data: modderProfile } = useQuery({
    queryKey: ["modder-profile", script?.modder_id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, user_id, username, display_name, avatar_url, bio, reputation_score, total_downloads, total_positive_reviews, created_at, updated_at").eq("user_id", script!.modder_id).single();
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
      const { data } = await supabase.from("script_reviews").select("*").eq("script_id", id!).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: existingLicense } = useQuery({
    queryKey: ["script-license", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("script_licenses")
        .select("*")
        .eq("script_id", id!)
        .eq("user_id", user!.id)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
    enabled: !!id && !!user && !!script?.is_paid,
  });

  const { data: hasPurchased } = useQuery({
    queryKey: ["script-purchase-completed", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("script_purchases")
        .select("id")
        .eq("script_id", id!)
        .eq("user_id", user!.id)
        .eq("status", "completed")
        .maybeSingle();
      return !!data;
    },
    enabled: !!id && !!user && !!script?.is_paid,
  });

  const { data: hasTestedScript } = useQuery({
    queryKey: ["script-test-log", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("script_test_logs")
        .select("id")
        .eq("script_id", id!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!id && !!user && !!script?.is_paid,
  });

  const isLicenseExpired = existingLicense?.expires_at && new Date(existingLicense.expires_at) < new Date();

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
      const { data } = await supabase.from("profiles").select("id, user_id, username, display_name, avatar_url, bio, reputation_score, total_downloads, total_positive_reviews, created_at, updated_at").in("user_id", reviewerIds);
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
    -- Powered by Hidden Mod
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

    // Use download-script edge function to get secure URL
    const { data: downloadData, error: dlError } = await supabase.functions.invoke("download-script", {
      body: { script_id: script.id },
    });

    const downloadUrl = downloadData?.url || script.external_link;
    if (downloadUrl) {
      const gameName = downloadData?.game_name || (script as any).game_name;
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

  const handleTestScript = async () => {
    if (!user) { setShowLoginPrompt(true); return; }
    if (!script) return;
    setTestingScript(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-marketplace-script", {
        body: { script_id: script.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const blob = new Blob([data.test_code], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.file_name || "teste.lua";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Teste de ${data.expires_minutes} minutos baixado! Execute no GameGuardian.`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar teste");
    } finally {
      setTestingScript(false);
    }
  };

  const handleReview = async () => {
    if (!user) { setShowLoginPrompt(true); return; }
    if (!script || newRating === 0) { toast.error("Selecione uma avaliação."); return; }
    setSubmitting(true);
    const existing = reviews?.find((r: any) => r.user_id === user.id);
    if (existing) {
      await supabase.from("script_reviews").update({ rating: newRating, comment: newComment || null }).eq("id", existing.id);
      toast.success("Avaliação atualizada!");
    } else {
      const { error } = await supabase.from("script_reviews").insert({ script_id: script.id, user_id: user.id, rating: newRating, comment: newComment || null });
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
    return (
      <Layout>
        <div className="container py-16 max-w-6xl">
          <div className="animate-pulse space-y-6">
            <div className="h-4 bg-secondary/40 rounded w-40" />
            <div className="rounded-2xl border border-white/5 bg-card/30 p-6 sm:p-8">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-2/5 aspect-[4/3] bg-secondary/30 rounded-xl" />
                <div className="flex-1 space-y-4">
                  <div className="h-6 bg-secondary/40 rounded w-3/4" />
                  <div className="h-4 bg-secondary/30 rounded w-1/2" />
                  <div className="h-10 bg-secondary/20 rounded w-48" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
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
  const luaCode = scriptCode?.lua_code ?? null;
  const gameName = (script as any).game_name;
  const scriptVersion = (script as any).version;
  const isApk = (script as any).script_type === "apk";
  const apkMeta = {
    version: (script as any).apk_version,
    minAndroid: (script as any).apk_min_android,
    packageName: (script as any).apk_package_name,
    sizeMb: (script as any).apk_size_mb,
    changelog: (script as any).apk_changelog,
    originalApp: (script as any).apk_original_app,
  };

  return (
    <Layout>
      <div className="container py-4 sm:py-8 px-3 sm:px-6 max-w-6xl">
        {/* Back link */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          <Link to="/marketplace" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6 sm:mb-8 group">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Marketplace</span>
          </Link>
        </motion.div>

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative mb-6 sm:mb-10 p-4 sm:p-8 rounded-2xl border border-white/5 bg-card/30 backdrop-blur-xl overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -z-10" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 blur-[80px] -z-10" />

          <div className="flex flex-col md:flex-row md:items-start gap-5 sm:gap-8">
            {/* Gallery */}
            <div className="w-full md:w-2/5 space-y-3">
              {allMedia.length > 0 ? (
                <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl aspect-[4/3] bg-secondary/20 group">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={galleryIndex}
                      src={allMedia[galleryIndex]?.url}
                      alt={script.title}
                      className="w-full h-full object-cover"
                      initial={{ opacity: 0, scale: 1.05 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  </AnimatePresence>

                  {allMedia.length > 1 && (
                    <>
                      <button
                        onClick={() => setGalleryIndex((p) => (p === 0 ? allMedia.length - 1 : p - 1))}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-md rounded-full p-1.5 sm:p-2 border border-white/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:bg-primary/50"
                      >
                        <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                      <button
                        onClick={() => setGalleryIndex((p) => (p === allMedia.length - 1 ? 0 : p + 1))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-md rounded-full p-1.5 sm:p-2 border border-white/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:bg-primary/50"
                      >
                        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                    </>
                  )}

                  {allMedia.length > 1 && (
                    <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5 px-4">
                      {allMedia.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setGalleryIndex(i)}
                          className={`transition-all duration-300 rounded-full ${
                            i === galleryIndex ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-white/30 hover:bg-white/50"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full aspect-[4/3] rounded-xl bg-secondary/20 flex items-center justify-center border border-dashed border-white/10">
                  <FileCode className="h-12 w-12 text-muted-foreground/15" />
                </div>
              )}

              {/* Thumbnail strip on desktop */}
              {allMedia.length > 1 && (
                <div className="hidden sm:flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {allMedia.map((m, i) => (
                    <button
                      key={i}
                      onClick={() => setGalleryIndex(i)}
                      className={`w-16 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                        i === galleryIndex ? "border-primary shadow-md" : "border-white/5 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={m.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 space-y-4 sm:space-y-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest px-2">
                    {script.categories && (script.categories as any).name}
                  </Badge>
                  <Badge variant="outline" className={`${st.className} text-[9px] sm:text-[10px] uppercase font-bold tracking-widest px-2`}>
                    {st.label}
                  </Badge>
                  {!scriptIsActive && (
                    <Badge variant="destructive" className="text-[9px] sm:text-[10px] uppercase font-bold px-2">Inativo</Badge>
                  )}
                  {script.is_paid && (
                    <Badge variant="secondary" className="bg-[hsl(var(--neon-pink)/0.1)] text-[hsl(var(--neon-pink))] border-[hsl(var(--neon-pink)/0.2)] text-[9px] sm:text-[10px] font-bold">
                      <ShoppingCart className="h-3 w-3 mr-1" /> Premium
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <h1 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight">
                    {script.title}
                  </h1>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5">
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                      <span className="font-bold">{script.average_rating ? Number(script.average_rating).toFixed(1) : "N/A"}</span>
                      <span className="text-muted-foreground">({script.total_ratings || 0})</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5">
                      <Download className="h-3 w-3 text-[hsl(var(--neon-cyan))]" />
                      <span className="font-bold">{script.download_count}</span>
                    </div>
                    {scriptVersion && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 font-mono text-[10px]">
                        v{scriptVersion}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modder info */}
              <Link to={`/modder/${script.modder_id}`} className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-white/[0.03] border border-white/5 w-fit group hover:border-primary/20 transition-all">
                <Avatar className="h-9 w-9 sm:h-10 sm:w-10 border-2 border-white/10 group-hover:border-primary/40 transition-all">
                  <AvatarImage src={modderProfile?.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-xs">
                    {modderProfile?.username?.[0].toUpperCase() || "M"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Por</p>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-xs sm:text-sm">@{modderProfile?.display_name || modderProfile?.username || "Modder"}</p>
                    <ShieldCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[hsl(var(--neon-cyan))]" />
                  </div>
                </div>
              </Link>

              {/* Quick description on desktop */}
              {script.description && (
                <p className="hidden lg:block text-sm text-muted-foreground/80 leading-relaxed line-clamp-3">
                  {script.description}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Main Content + Sidebar */}
        <div className="grid lg:grid-cols-3 gap-5 sm:gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6 sm:space-y-8">
            {script.video_url && (
              <section>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Play className="h-4 w-4 text-destructive" /> Demonstração
                </h3>
                <YouTubeEmbed url={script.video_url} />
              </section>
            )}

            {/* Description (mobile + full) */}
            <section className="space-y-3">
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <FileCode className="h-4 w-4 sm:h-5 sm:w-5 text-primary" /> Sobre o Script
              </h3>
              <div className="p-4 sm:p-6 rounded-xl border border-white/5 bg-white/[0.03] text-sm text-muted-foreground leading-relaxed">
                {script.description ?? "Sem descrição fornecida pelo autor."}
              </div>
            </section>

            {/* Features & Tags */}
            {(scriptFeatures.length > 0 || scriptTags.length > 0) && (
              <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                {scriptFeatures.length > 0 && (
                  <Card className="border-white/5 bg-white/[0.03] overflow-hidden">
                    <CardHeader className="pb-3 border-b border-white/5 bg-white/[0.02]">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <List className="h-4 w-4 text-accent" /> Funcionalidades
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <ul className="space-y-2">
                        {scriptFeatures.map((f: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <CheckCircle className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {scriptTags.length > 0 && (
                  <Card className="border-white/5 bg-white/[0.03] overflow-hidden">
                    <CardHeader className="pb-3 border-b border-white/5 bg-white/[0.02]">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Tag className="h-4 w-4 text-[hsl(var(--neon-cyan))]" /> Tags
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 flex flex-wrap gap-1.5">
                      {scriptTags.map((t: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px] text-[hsl(var(--neon-cyan))] border-[hsl(var(--neon-cyan)/0.2)] bg-[hsl(var(--neon-cyan)/0.05)]">
                          #{t}
                        </Badge>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Code Preview — only visible to the script owner */}
            {luaCode && isOwner && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <FileCode className="h-4 w-4 sm:h-5 sm:w-5 text-neon-purple" /> Seu Código (Revisão)
                  </h3>
                  <Badge variant="outline" className="border-neon-purple/30 text-neon-purple bg-neon-purple/5 text-[10px]">
                    👁️ Visível só para você
                  </Badge>
                </div>
                <CodeBlock code={luaCode.split("\n").slice(0, 20).join("\n") + (luaCode.split("\n").length > 20 ? "\n-- ..." : "")} />
                <ScriptAnalysis code={luaCode} scriptId={id} />
              </section>
            )}


            {/* Related Tutorial */}
            {relatedTutorial && (
              <Card className="border-white/5 bg-white/[0.03]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-[hsl(var(--neon-pink))]" /> Tutorial Relacionado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Link to={`/tutorial/${relatedTutorial.id}`} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors">
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
            <Card className="border-white/5 bg-white/[0.03]">
              <CardHeader>
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Avaliações ({reviews?.length ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {user ? (
                  <div className="space-y-3 p-3 sm:p-4 rounded-xl bg-secondary/20 border border-white/5">
                    <p className="text-xs text-muted-foreground font-medium">Sua avaliação:</p>
                    <StarRating rating={newRating} onRate={setNewRating} interactive />
                    <Textarea placeholder="Comentário (opcional)" value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={2} className="text-sm bg-background/50" />
                    <Button size="sm" onClick={handleReview} disabled={submitting || newRating === 0} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      {submitting ? "Enviando..." : "Enviar Avaliação"}
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-secondary/10 text-center border border-white/5">
                    <p className="text-xs text-muted-foreground mb-2">Faça login para avaliar este script.</p>
                    <Button size="sm" variant="outline" onClick={() => setShowLoginPrompt(true)}>Entrar</Button>
                  </div>
                )}

                <div className="space-y-2">
                  {reviews?.map((review: any) => {
                    const rProfile = profileMap[review.user_id];
                    return (
                      <div key={review.id} className="flex gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
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
                    <p className="text-xs text-muted-foreground text-center py-6">Nenhuma avaliação ainda. Seja o primeiro!</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            {/* Checkout Card */}
            <Card className="relative overflow-hidden border-white/10 bg-[#050505] rounded-none shadow-[0_0_30px_rgba(168,85,247,0.06)]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/8 blur-[40px] -z-10" />
              <div className="h-1 w-full bg-gradient-to-r from-neon-purple via-neon-pink to-neon-cyan" />

              <CardHeader className="pb-3 border-b border-white/10 font-mono">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                  <span className="live-dot" /> // checkout · secure_link
                </CardTitle>
              </CardHeader>

              <CardContent className="p-5 sm:p-6 space-y-5 font-mono">
                <div className="flex flex-col items-center gap-2 py-3 ascii-frame">
                  {script.is_paid ? (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">R$</span>
                        <span className="text-4xl sm:text-5xl font-black text-white tabular-nums">{Number(script.price).toFixed(2)}</span>
                      </div>
                      <Badge variant="outline" className="rounded-none border-neon-pink/30 text-neon-pink bg-neon-pink/5 px-3 py-1 text-[9px] uppercase tracking-widest font-black">
                        <Key className="h-3 w-3 mr-1.5" /> {(script as any).license_duration_days ? `${(script as any).license_duration_days} DIAS` : "VITALÍCIO"}
                      </Badge>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl sm:text-4xl font-black uppercase text-neon-green tracking-tight">FREE//OPEN</span>
                      <Badge variant="outline" className="rounded-none border-neon-green/30 text-neon-green bg-neon-green/5 px-3 py-1 text-[9px] uppercase tracking-widest font-black">ACESSO LIVRE</Badge>
                    </>
                  )}
                </div>

                <div className="space-y-3">
                  {isOwner ? (
                    <div className="bg-neon-purple/5 border border-neon-purple/20 rounded-none p-4 text-center">
                      <Badge className="bg-neon-purple text-white rounded-none mb-2 text-[9px] uppercase tracking-widest font-black">// owner</Badge>
                      <p className="text-xs font-black uppercase tracking-widest text-neon-purple">Você é o autor deste payload</p>
                    </div>
                  ) : script.is_paid && !isAdmin && !hasPurchased ? (
                    <>
                      {purchaseSuccess || (existingLicense && !isLicenseExpired) ? (
                        <div className="space-y-4">
                          <div className="bg-neon-green/5 border border-neon-green/20 rounded-none p-4 space-y-3">
                            <div className="flex items-center gap-2 text-neon-green text-[11px] font-black uppercase tracking-widest">
                              <CheckCircle className="h-4 w-4" /> LICENÇA ATIVA
                            </div>
                            <div className="bg-[#030304] rounded-none p-2.5 border border-white/10 flex items-center justify-between">
                              <code className="text-[10px] sm:text-xs font-mono text-neon-green truncate flex-1 mr-2">
                                {purchaseSuccess || (existingLicense as any).license_key}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 hover:bg-neon-green/10 shrink-0 rounded-none"
                                onClick={() => {
                                  navigator.clipboard.writeText(purchaseSuccess || (existingLicense as any).license_key);
                                  toast.success("Chave copiada!");
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button className="w-full h-12 rounded-none bg-neon-green hover:bg-neon-green/90 text-black font-black uppercase tracking-widest text-xs border border-neon-green shadow-[0_0_20px_rgba(57,255,20,0.2)]" onClick={handleDownloadLoader}>
                              <Download className="mr-2 h-4 w-4" /> // baixar loader
                            </Button>
                          </div>

                          {existingLicense?.expires_at && (
                            <div className="text-center">
                              <p className="text-[9px] text-muted-foreground uppercase font-black tracking-[0.25em] mb-1">// expira em</p>
                              <Badge variant="outline" className="font-mono text-[10px] border-white/10 px-3 rounded-none bg-[#030304] text-foreground">
                                {new Date(existingLicense.expires_at).toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' })}
                              </Badge>
                            </div>
                          )}
                        </div>
                      ) : isLicenseExpired ? (
                        <div className="space-y-3">
                          <div className="bg-destructive/5 border border-destructive/30 rounded-none p-3 text-center">
                            <p className="text-[11px] font-black uppercase tracking-widest text-destructive mb-0.5">// LICENÇA EXPIRADA</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Renove para continuar.</p>
                          </div>
                          <Button className="w-full h-12 rounded-none bg-neon-purple hover:bg-neon-purple/90 text-white font-black uppercase tracking-widest text-xs border border-neon-purple shadow-[0_0_20px_rgba(168,85,247,0.25)] overflow-hidden relative group" onClick={handleRenew} disabled={purchasing}>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            <Clock className="mr-2 h-4 w-4" /> {purchasing ? "INICIANDO..." : "// renovar acesso"}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Button className="w-full h-12 rounded-none bg-neon-purple hover:bg-neon-purple/90 text-white font-black uppercase tracking-widest text-xs border border-neon-purple shadow-[0_0_20px_rgba(168,85,247,0.25)] overflow-hidden relative group" onClick={openPaymentMethodModal} disabled={purchasing}>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            <CreditCard className="mr-2 h-4 w-4" /> {purchasing ? "PROCESSANDO..." : "// adquirir agora"}
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full h-10 rounded-none border-neon-cyan/30 bg-transparent text-neon-cyan hover:bg-neon-cyan/10 hover:text-neon-cyan text-[10px] font-black uppercase tracking-widest"
                            onClick={handleTestScript}
                            disabled={testingScript || !!hasTestedScript}
                          >
                            <Play className="mr-2 h-3.5 w-3.5" />
                            {hasTestedScript ? "// teste já consumido" : testingScript ? "// gerando teste..." : "// test_drive 3min"}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <Button className="w-full h-12 rounded-none bg-neon-green hover:bg-neon-green/90 text-black font-black uppercase tracking-widest text-xs border border-neon-green shadow-[0_0_20px_rgba(57,255,20,0.2)] group" onClick={handleDownloadFree}>
                      <Download className="mr-2 h-4 w-4 group-hover:translate-y-0.5 transition-transform" /> // baixar agora
                    </Button>
                  )}

                  {!hasAccess && (
                    <p className="text-[9px] text-center text-muted-foreground/60 px-2 uppercase tracking-widest">
                      ao adquirir, você concorda com nossos termos.
                    </p>
                  )}
                </div>

                {/* Trust info */}
                <div className="p-3 rounded-none bg-[#030304] border border-white/10 space-y-1.5">
                  <p className="text-[9px] text-muted-foreground leading-relaxed flex items-start gap-1.5 uppercase tracking-widest">
                    <ShieldCheck className="h-3 w-3 text-neon-green shrink-0 mt-0.5" />
                    pagamento seguro · mercado pago
                  </p>
                  <p className="text-[9px] text-muted-foreground leading-relaxed flex items-start gap-1.5 uppercase tracking-widest">
                    <CreditCard className="h-3 w-3 text-neon-purple shrink-0 mt-0.5" />
                    Aceitamos Pix e Cartão de crédito
                  </p>
                  <p className="text-[9px] text-muted-foreground leading-relaxed flex items-start gap-1.5 uppercase tracking-widest">
                    <Info className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                    no pix, aparece o nome do vendedor no banco
                  </p>
                  <p className="text-[9px] text-muted-foreground leading-relaxed flex items-start gap-1.5 uppercase tracking-widest">
                    <CheckCircle className="h-3 w-3 text-neon-green shrink-0 mt-0.5" />
                    entrega automática após confirmação
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                  <div className="text-center">
                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Reviews</p>
                    <p className="text-lg font-black">{script.total_ratings || 0}</p>
                  </div>
                  <div className="text-center border-l border-white/5">
                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Status</p>
                    <p className={`text-xs font-black uppercase ${st.className.split(' ')[1]}`}>{st.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trust signals */}
            <Card className="border-white/5 bg-white/[0.03]">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[hsl(var(--neon-cyan)/0.1)] border border-[hsl(var(--neon-cyan)/0.2)]">
                    <ShieldCheck className="h-4 w-4 text-[hsl(var(--neon-cyan))]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold mb-0.5">Ofuscação Avançada</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">Código protegido com marca d'água única.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold mb-0.5">Verificado</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">Testado pela equipe Hidden Mod.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <LoginPromptDialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt} />

      {/* Payment Method Modal */}
      {showPaymentMethodModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
            <Card className="w-full max-w-sm bg-[#050505] border border-white/10 rounded-none font-mono">
              <div className="h-1 w-full bg-gradient-to-r from-neon-purple via-neon-pink to-neon-cyan" />
              <CardHeader className="text-center pb-2 border-b border-white/10">
                <CardTitle className="text-xs uppercase tracking-[0.3em] font-black text-foreground">// método de pagamento</CardTitle>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  {pendingRenewal ? "renovação" : "selecione um trilho"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {(() => {
                  const basePrice = Number(script?.price ?? 0);
                  const pixFee = Math.round(basePrice * 0.01 * 100) / 100;
                  const cardFee = Math.round(basePrice * 0.0499 * 100) / 100;
                  const pixTotal = Math.round((basePrice + pixFee) * 100) / 100;
                  const cardTotal = Math.round((basePrice + cardFee) * 100) / 100;
                  return (
                    <>
                      <Button
                        className="w-full h-auto py-3 justify-start gap-3 bg-[#030304] border border-neon-green/30 hover:bg-neon-green/10 hover:border-neon-green/50 text-foreground rounded-none transition-colors"
                        variant="outline"
                        onClick={() => handlePurchase(pendingRenewal, "pix")}
                        disabled={purchasing}
                      >
                        <QrCode className="h-5 w-5 text-neon-green shrink-0" />
                        <div className="text-left flex-1">
                          <p className="font-black text-xs uppercase tracking-widest text-neon-green">// PIX</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">instantâneo</p>
                          <div className="mt-1 text-[10px] text-muted-foreground space-y-0.5 normal-case tracking-normal">
                            <p>Subtotal: R$ {basePrice.toFixed(2)}</p>
                            <p>Taxa Pix (1%): R$ {pixFee.toFixed(2)}</p>
                            <p className="text-neon-green font-black">Total: R$ {pixTotal.toFixed(2)}</p>
                          </div>
                        </div>
                      </Button>

                      <Button
                        className="w-full h-auto py-3 justify-start gap-3 bg-[#030304] border border-neon-purple/30 hover:bg-neon-purple/10 hover:border-neon-purple/50 text-foreground rounded-none transition-colors"
                        variant="outline"
                        onClick={() => handlePurchase(pendingRenewal, "card")}
                        disabled={purchasing}
                      >
                        <CreditCard className="h-5 w-5 text-neon-purple shrink-0" />
                        <div className="text-left flex-1">
                          <p className="font-black text-xs uppercase tracking-widest text-neon-purple">// cartão</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">parcele em até 12x</p>
                          <div className="mt-1 text-[10px] text-muted-foreground space-y-0.5 normal-case tracking-normal">
                            <p>Subtotal: R$ {basePrice.toFixed(2)}</p>
                            <p>Taxa Cartão (4.99%): R$ {cardFee.toFixed(2)}</p>
                            <p className="text-neon-purple font-black">Total: R$ {cardTotal.toFixed(2)}</p>
                          </div>
                        </div>
                      </Button>
                    </>
                  );
                })()}

                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground rounded-none uppercase tracking-widest text-[10px] font-black"
                  onClick={() => { setShowPaymentMethodModal(false); setPendingRenewal(false); }}
                >
                  // cancelar
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* PIX QR Code Modal */}
      {pixData && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
            <Card className="w-full max-w-sm bg-[#050505] border border-neon-green/30 rounded-none font-mono">
              <div className="h-1 w-full bg-gradient-to-r from-neon-green via-neon-cyan to-neon-purple" />
              <CardHeader className="text-center pb-2 border-b border-white/10">
                <CardTitle className="text-xs uppercase tracking-[0.3em] font-black text-neon-green">// pagar com pix</CardTitle>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">escaneie ou copie o código</p>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {pixData.qr_code_base64 && (
                  <div className="flex justify-center">
                    <div className="p-3 bg-white rounded-none border border-neon-green/40">
                      <img
                        src={`data:image/png;base64,${pixData.qr_code_base64}`}
                        alt="QR Code PIX"
                        className="w-44 h-44 sm:w-48 sm:h-48"
                      />
                    </div>
                  </div>
                )}

                {pixData.qr_code && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground text-center uppercase tracking-widest">// copia e cola</p>
                    <div className="flex items-center gap-2 bg-[#030304] rounded-none p-2 border border-white/10">
                      <code className="text-[10px] font-mono text-foreground flex-1 break-all line-clamp-3">
                        {pixData.qr_code}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0 rounded-none hover:bg-neon-green/10"
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
                  <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-neon-green">
                    <div className="h-3 w-3 border-2 border-neon-green border-t-transparent rounded-full animate-spin" />
                    aguardando pagamento...
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full rounded-none border-white/10 bg-transparent hover:bg-white/5 uppercase tracking-widest text-[10px] font-black"
                  onClick={() => {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    setPixPolling(false);
                    setPixData(null);
                    setPurchasing(false);
                  }}
                >
                  // cancelar
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}
