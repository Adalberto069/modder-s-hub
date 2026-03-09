import { useState } from "react";
import LuaCodeEditor from "@/components/LuaCodeEditor";
import ScriptAnalysis from "@/components/ScriptAnalysis";
import { ModerationMessages } from "@/components/ModerationMessages";
import { useParams, Link } from "react-router-dom";
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
  Copy, Check, Gamepad2, Tag, List, BookOpen, FileCode, ShoppingCart, Key,
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [pixData, setPixData] = useState<{ init_point: string; sandbox_init_point?: string; purchase_id: string } | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);

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

  const handlePurchase = async () => {
    if (!user) { setShowLoginPrompt(true); return; }
    if (!script) return;
    setPurchasing(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: { script_id: script.id },
      });

      if (error) throw new Error(error.message || "Erro ao criar pagamento");
      if (data?.error) throw new Error(data.error);

      // Use sandbox_init_point for test, init_point for production
      const paymentUrl = data.sandbox_init_point || data.init_point;

      setPixData({
        init_point: data.init_point,
        sandbox_init_point: data.sandbox_init_point,
        purchase_id: data.purchase_id,
      });

      // Open Mercado Pago checkout in new tab
      window.open(paymentUrl, "_blank");
      toast.success("Checkout do Mercado Pago aberto! Complete o pagamento lá.");
    } catch (err: any) {
      toast.error("Erro na compra: " + err.message);
    } finally {
      setPurchasing(false);
    }
  };

  // Poll for payment confirmation via edge function
  const handleCheckPayment = async () => {
    if (!pixData || !user) return;
    setCheckingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-pix-payment", {
        body: { purchase_id: pixData.purchase_id },
      });

      if (error) throw new Error(error.message);

      if (data?.status === "approved" && data?.license_key) {
        setPurchaseSuccess(data.license_key);
        setPixData(null);
        toast.success("Pagamento confirmado! 🎉");
        queryClient.invalidateQueries({ queryKey: ["script-license", id, user.id] });
      } else {
        toast.info("Pagamento ainda não confirmado. Aguarde alguns segundos após pagar.");
      }
    } catch {
      toast.error("Erro ao verificar pagamento");
    } finally {
      setCheckingPayment(false);
    }
  };

  const handleRenew = async () => {
    if (!user || !script || !existingLicense) return;
    setPurchasing(true);

    try {
      const durationDays = (script as any).license_duration_days;
      if (!durationDays) return;

      // Create renewal purchase
      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          user_id: user.id,
          script_id: script.id,
          amount: Number(script.price) || 0,
          status: "completed",
        })
        .select("id")
        .single();

      if (purchaseError) throw purchaseError;

      // Extend from now (if expired) or from current expiration (if still active)
      const baseDate = isLicenseExpired ? new Date() : new Date(existingLicense.expires_at!);
      const newExpiresAt = new Date(baseDate.getTime() + durationDays * 86400000).toISOString();

      const { error: updateError } = await supabase
        .from("licenses")
        .update({ expires_at: newExpiresAt } as any)
        .eq("id", existingLicense.id);

      if (updateError) throw updateError;

      toast.success(`Licença renovada! Nova expiração: ${new Date(newExpiresAt).toLocaleDateString("pt-BR")}`);
      queryClient.invalidateQueries({ queryKey: ["script-license", id, user.id] });
      queryClient.invalidateQueries({ queryKey: ["my-licenses"] });
    } catch (err: any) {
      toast.error("Erro na renovação: " + err.message);
    } finally {
      setPurchasing(false);
    }
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
      <div className="container py-8 max-w-5xl">
        <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar ao Marketplace
        </Link>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="md:col-span-2 space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-start gap-3 mb-2 flex-wrap">
                <h1 className="text-2xl font-bold flex-1">{script.title}</h1>
                <div className="flex gap-2 shrink-0 flex-wrap">
                  {!scriptIsActive && (
                    <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
                      Inativo
                    </Badge>
                  )}
                  {(script as any).security_status === "verified" && (
                    <Badge className="bg-accent/20 text-accent border-accent/30 gap-1">
                      <ShieldCheck className="h-3 w-3" /> Verificado
                    </Badge>
                  )}
                  {(script as any).security_status === "under_review" && (
                    <Badge className="bg-primary/20 text-primary border-primary/30 gap-1">
                      <Clock className="h-3 w-3" /> Em Revisão
                    </Badge>
                  )}
                  {(script as any).security_status === "flagged" && (
                    <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
                      <ShieldX className="h-3 w-3" /> Flagrado
                    </Badge>
                  )}
                  {(script as any).security_status === "rejected" && (
                    <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
                      <ShieldAlert className="h-3 w-3" /> Rejeitado
                    </Badge>
                  )}
                  {script.is_verified && !(script as any).security_status && (
                    <Badge className="bg-primary/20 text-primary border-primary/30 gap-1">
                      <ShieldCheck className="h-3 w-3" /> Verificado
                    </Badge>
                  )}
                  <Badge variant="outline" className={st.className}>{st.label}</Badge>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {gameName && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Gamepad2 className="h-3 w-3" /> {gameName}
                  </Badge>
                )}
                {script.categories && (
                  <Badge variant="secondary" className="text-[10px]">{(script.categories as any).name}</Badge>
                )}
                {scriptVersion && (
                  <Badge variant="outline" className="text-[10px]">v{scriptVersion}</Badge>
                )}
              </div>
            </div>

            {/* Image Gallery */}
            {allMedia.length > 0 && (
              <div className="relative rounded-lg overflow-hidden neon-border group">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={galleryIndex}
                    src={allMedia[galleryIndex]?.url}
                    alt={script.title}
                    className="w-full aspect-video object-cover"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  />
                </AnimatePresence>
                {allMedia.length > 1 && (
                  <>
                    <button onClick={() => setGalleryIndex((p) => (p === 0 ? allMedia.length - 1 : p - 1))} className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/70 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button onClick={() => setGalleryIndex((p) => (p === allMedia.length - 1 ? 0 : p + 1))} className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/70 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      {allMedia.map((_, i) => (
                        <button key={i} onClick={() => setGalleryIndex(i)} className={`w-2 h-2 rounded-full transition-colors ${i === galleryIndex ? "bg-primary" : "bg-muted-foreground/40"}`} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {script.video_url && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Play className="h-4 w-4 text-destructive" /> Demonstração
                </h3>
                <YouTubeEmbed url={script.video_url} />
              </div>
            )}

            {/* Description */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <FileCode className="h-4 w-4 text-primary" /> Descrição
              </h3>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">{script.description ?? "Sem descrição."}</p>
            </div>

            {/* Features */}
            {scriptFeatures.length > 0 && (
              <Card className="neon-border bg-card/80">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <List className="h-4 w-4 text-accent" /> Features
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {scriptFeatures.map((f: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                        <span className="text-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Code Preview */}
            {luaCode && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-neon-green" /> Preview do Código
                </h3>
                <CodeBlock code={luaCode.split("\n").slice(0, 20).join("\n") + (luaCode.split("\n").length > 20 ? "\n-- ..." : "")} />
                <ScriptAnalysis code={luaCode} scriptId={id} />
              </div>
            )}

            {/* Moderation Messages (visible to script owner) */}
            {isOwner && <ModerationMessages scriptId={script.id} />}

            {/* Tags */}
            {scriptTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {scriptTags.map((t: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-[10px] text-neon-cyan border-neon-cyan/30">
                    <Tag className="h-3 w-3 mr-1" /> #{t}
                  </Badge>
                ))}
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
                      <div key={review.id} className="flex gap-3 p-3 rounded-lg border border-border/30">
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

          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="neon-border bg-card/80">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground"><Download className="h-4 w-4" /> Downloads</span>
                  <span className="font-mono font-bold">{script.download_count}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground"><Star className="h-4 w-4" /> Avaliação</span>
                  <div className="flex items-center gap-1">
                    <StarRating rating={Math.round(Number(script.average_rating))} />
                    <span className="font-mono font-bold text-xs">({script.total_ratings})</span>
                  </div>
                </div>

                {script.is_paid ? (
                  <div className="space-y-3">
                    <p className="text-2xl font-bold font-mono text-primary text-center">R$ {Number(script.price).toFixed(2)}</p>
                    <div className="text-center">
                      {(script as any).license_duration_days ? (
                        <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-400">
                          <Clock className="h-3 w-3 mr-1" /> 
                          {(script as any).license_duration_days === 7 ? "Licença Semanal (7 dias)" : `Licença Mensal (${(script as any).license_duration_days} dias)`}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-accent/30 text-accent">
                          🔑 Licença Permanente
                        </Badge>
                      )}
                    </div>

                    {/* Purchase success state */}
                    {purchaseSuccess && (
                      <Card className="border-accent/30 bg-accent/5">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center gap-2 text-accent text-sm font-semibold">
                            <CheckCircle className="h-4 w-4" /> Compra Realizada!
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Sua Licença:</p>
                            <div className="flex items-center gap-2 bg-secondary/50 rounded p-2">
                              <Key className="h-4 w-4 text-primary shrink-0" />
                              <code className="text-sm font-mono text-primary flex-1">{purchaseSuccess}</code>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(purchaseSuccess); toast.success("Licença copiada!"); }}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <Button className="w-full neon-glow-green" onClick={handleDownloadLoader}>
                            <Download className="mr-2 h-4 w-4" /> Baixar Loader (.lua)
                          </Button>
                          <p className="text-[10px] text-muted-foreground text-center">
                            Sua licença também está disponível no Dashboard
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {/* PIX QR Code waiting for payment */}
                    {pixData && !purchaseSuccess && (
                      <Card className="border-primary/30 bg-primary/5">
                        <CardContent className="p-4 space-y-3">
                          <div className="text-center">
                            <p className="text-sm font-semibold text-primary mb-2">📱 Pague com PIX</p>
                            {pixData.qr_code_base64 && (
                              <img
                                src={`data:image/png;base64,${pixData.qr_code_base64}`}
                                alt="QR Code PIX"
                                className="mx-auto w-48 h-48 rounded-lg border border-border"
                              />
                            )}
                          </div>
                          {pixData.qr_code && (
                            <div>
                              <p className="text-[10px] text-muted-foreground mb-1">Ou copie o código PIX:</p>
                              <div className="flex items-center gap-2 bg-secondary/50 rounded p-2">
                                <code className="text-[10px] font-mono text-foreground flex-1 break-all line-clamp-2">{pixData.qr_code}</code>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => { navigator.clipboard.writeText(pixData.qr_code); toast.success("Código PIX copiado!"); }}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                          <Button className="w-full" variant="outline" onClick={handleCheckPayment} disabled={checkingPayment}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            {checkingPayment ? "Verificando..." : "Já paguei, verificar"}
                          </Button>
                          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setPixData(null)}>
                            Cancelar
                          </Button>
                          <p className="text-[10px] text-muted-foreground text-center">
                            Após o pagamento, clique em "Já paguei" para liberar sua licença
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {!purchaseSuccess && !pixData && existingLicense ? (
                      isLicenseExpired ? (
                        <div className="space-y-2">
                          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                            <p className="text-sm font-semibold text-destructive">❌ Licença Expirada</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Expirou em {new Date(existingLicense.expires_at!).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <div className="bg-secondary/50 rounded p-2">
                            <p className="text-[10px] text-muted-foreground mb-1">Sua Licença:</p>
                            <div className="flex items-center gap-2">
                              <Key className="h-3 w-3 text-muted-foreground shrink-0" />
                              <code className="text-xs font-mono text-muted-foreground flex-1">{(existingLicense as any).license_key}</code>
                            </div>
                          </div>
                          {scriptIsActive && (
                            <Button className="w-full neon-glow-purple" onClick={handleRenew} disabled={purchasing}>
                              <Clock className="mr-2 h-4 w-4" />
                              {purchasing ? "Processando..." : `Renovar por R$ ${Number(script.price).toFixed(2)}`}
                            </Button>
                          )}
                          <p className="text-[10px] text-muted-foreground text-center">
                            +{(script as any).license_duration_days} dias adicionais
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 justify-center text-accent text-sm">
                            <CheckCircle className="h-4 w-4" /><span>Já adquirido</span>
                          </div>
                          <div className="bg-secondary/50 rounded p-2">
                            <p className="text-[10px] text-muted-foreground mb-1">Sua Licença:</p>
                            <div className="flex items-center gap-2">
                              <Key className="h-3 w-3 text-primary shrink-0" />
                              <code className="text-xs font-mono text-primary flex-1">{(existingLicense as any).license_key}</code>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText((existingLicense as any).license_key); toast.success("Licença copiada!"); }}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {existingLicense.expires_at && (
                            <div className="text-center space-y-2">
                              <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-400">
                                ⏳ Expira: {new Date(existingLicense.expires_at).toLocaleDateString("pt-BR")}
                              </Badge>
                              {scriptIsActive && (script as any).license_duration_days && (
                                <Button variant="outline" size="sm" className="w-full" onClick={handleRenew} disabled={purchasing}>
                                  <Clock className="mr-2 h-3 w-3" />
                                  {purchasing ? "..." : `Estender (+${(script as any).license_duration_days} dias)`}
                                </Button>
                              )}
                            </div>
                          )}
                          <Button className="w-full neon-glow-green" onClick={handleDownloadLoader}>
                            <Download className="mr-2 h-4 w-4" /> Baixar Loader (.lua)
                          </Button>
                        </div>
                      )
                    ) : !purchaseSuccess && !pixData ? (
                      scriptIsActive ? (
                        <Button className="w-full neon-glow-purple" onClick={handlePurchase} disabled={purchasing}>
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          {purchasing ? "Gerando PIX..." : "Comprar Script"}
                        </Button>
                      ) : (
                        <div className="text-center p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                          <p className="text-sm text-destructive font-semibold">Script Indisponível</p>
                          <p className="text-[10px] text-muted-foreground mt-1">Este script foi desativado pelo criador.</p>
                        </div>
                      )
                    ) : null}
                  </div>
                ) : (
                  <Button className="w-full neon-glow-green" onClick={handleDownloadFree}>
                    <Download className="mr-2 h-4 w-4" /> Download Grátis
                  </Button>
                )}

                {script.external_link && !script.is_paid && (
                  <Button variant="outline" className="w-full" onClick={() => {
                    if (!user) { setShowLoginPrompt(true); return; }
                    window.open(script.external_link!, "_blank");
                  }}>
                    <ExternalLink className="mr-2 h-4 w-4" /> Link Externo
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Modder info */}
            <Card className="neon-border bg-card/80">
              <CardContent className="p-4">
                <Link to={`/modder/${script.modder_id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <Avatar className="h-10 w-10">
                    {modderProfile?.avatar_url && <AvatarImage src={modderProfile.avatar_url} />}
                    <AvatarFallback className="bg-secondary"><User className="h-5 w-5 text-muted-foreground" /></AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">{modderProfile?.display_name ?? modderProfile?.username}</p>
                    <p className="text-xs text-muted-foreground font-mono">{modderProfile?.reputation_score ?? 0} pts</p>
                  </div>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <LoginPromptDialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt} />
    </Layout>
  );
}
