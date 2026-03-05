import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  Download, Star, ExternalLink, ArrowLeft, User, ShieldCheck,
  ChevronLeft, ChevronRight, Play, MessageSquare, Lock, Eye, EyeOff, CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

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

export default function ScriptDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Password unlock state
  const [enteredPassword, setEnteredPassword] = useState("");
  const [showPwInput, setShowPwInput] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

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
      const { data } = await supabase
        .from("script_images")
        .select("*")
        .eq("script_id", id!)
        .order("sort_order");
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: reviews } = useQuery({
    queryKey: ["script-reviews", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("*")
        .eq("script_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  // Check if user already has access
  const { data: existingAccess } = useQuery({
    queryKey: ["script-access", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("script_access")
        .select("id")
        .eq("script_id", id!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!id && !!user && !!script?.is_paid,
  });

  // Check if user is the owner
  const isOwner = user && script && script.modder_id === user.id;
  const hasAccess = !!existingAccess || unlocked || isOwner;

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

  const profileMap = (reviewerProfiles ?? []).reduce((acc: any, p: any) => {
    acc[p.user_id] = p;
    return acc;
  }, {});

  const handleUnlockWithPassword = async () => {
    if (!user || !script || !enteredPassword.trim()) return;
    setUnlocking(true);

    // Validate password using DB function
    const { data: isValid, error } = await supabase.rpc("validate_script_password", {
      _script_id: script.id,
      _password: enteredPassword.trim(),
    });

    if (error || !isValid) {
      toast.error("Senha incorreta ou expirada!");
      setUnlocking(false);
      return;
    }

    // Grant access
    await supabase.from("script_access").insert({
      script_id: script.id,
      user_id: user.id,
    });

    setUnlocked(true);
    toast.success("Acesso desbloqueado! Agora você pode baixar.");
    setEnteredPassword("");
    setShowPwInput(false);
    setUnlocking(false);
    queryClient.invalidateQueries({ queryKey: ["script-access", id, user.id] });
  };

  const handleDownload = async () => {
    if (!script) return;
    await supabase.from("scripts").update({ download_count: script.download_count + 1 }).eq("id", script.id);
    if (script.file_url) window.open(script.file_url, "_blank");
    else if (script.external_link) window.open(script.external_link, "_blank");
    toast.success("Download iniciado!");
  };

  const handleReview = async () => {
    if (!user || !script || newRating === 0) {
      toast.error("Selecione uma avaliação de 1 a 5 estrelas.");
      return;
    }
    setSubmitting(true);

    const existing = reviews?.find((r: any) => r.user_id === user.id);
    if (existing) {
      await supabase.from("reviews").update({ rating: newRating, comment: newComment || null }).eq("id", existing.id);
      toast.success("Avaliação atualizada!");
    } else {
      const { error } = await supabase.from("reviews").insert({
        script_id: script.id,
        user_id: user.id,
        rating: newRating,
        comment: newComment || null,
      });
      if (error) {
        toast.error(error.message);
        setSubmitting(false);
        return;
      }
      toast.success("Avaliação enviada!");
    }

    const allReviews = [...(reviews ?? []).filter((r: any) => r.user_id !== user.id), { rating: newRating }];
    const avg = allReviews.reduce((s: number, r: any) => s + r.rating, 0) / allReviews.length;
    await supabase.from("scripts").update({ average_rating: avg, total_ratings: allReviews.length }).eq("id", script.id);

    setNewComment("");
    setNewRating(0);
    setSubmitting(false);
    queryClient.invalidateQueries({ queryKey: ["script-reviews", id] });
    queryClient.invalidateQueries({ queryKey: ["script", id] });
  };

  if (!script) {
    return (
      <Layout>
        <div className="container py-16 text-center text-muted-foreground">Carregando...</div>
      </Layout>
    );
  }

  const st = statusConfig[script.status] ?? statusConfig.working;
  const allMedia = [
    ...(script.thumbnail_url ? [{ type: "image" as const, url: script.thumbnail_url }] : []),
    ...(images ?? []).map((img: any) => ({ type: "image" as const, url: img.image_url })),
  ];

  return (
    <Layout>
      <div className="container py-8 max-w-5xl">
        <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar ao Marketplace
        </Link>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="md:col-span-2 space-y-6">
            <div>
              <div className="flex items-start gap-3 mb-2 flex-wrap">
                <h1 className="text-2xl font-bold flex-1">{script.title}</h1>
                <div className="flex gap-2 shrink-0">
                  {script.is_verified && (
                    <Badge className="bg-primary/20 text-primary border-primary/30 gap-1">
                      <ShieldCheck className="h-3 w-3" /> Verificado
                    </Badge>
                  )}
                  <Badge variant="outline" className={st.className}>{st.label}</Badge>
                </div>
              </div>
              {script.categories && (
                <Badge variant="secondary" className="text-xs">{(script.categories as any).name}</Badge>
              )}
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
                    <button
                      onClick={() => setGalleryIndex((p) => (p === 0 ? allMedia.length - 1 : p - 1))}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/70 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setGalleryIndex((p) => (p === allMedia.length - 1 ? 0 : p + 1))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/70 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      {allMedia.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setGalleryIndex(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${i === galleryIndex ? "bg-primary" : "bg-muted-foreground/40"}`}
                        />
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

            <div>
              <h3 className="text-sm font-semibold mb-2">Descrição</h3>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">{script.description ?? "Sem descrição."}</p>
            </div>

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
                    <Textarea
                      placeholder="Comentário (opcional)"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                    <Button size="sm" onClick={handleReview} disabled={submitting || newRating === 0} className="neon-glow-purple">
                      {submitting ? "Enviando..." : "Enviar Avaliação"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    <Link to="/auth" className="text-primary hover:underline">Faça login</Link> para avaliar.
                  </p>
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
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Download className="h-4 w-4" /> Downloads
                  </span>
                  <span className="font-mono font-bold">{script.download_count}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Star className="h-4 w-4" /> Avaliação
                  </span>
                  <div className="flex items-center gap-1">
                    <StarRating rating={Math.round(Number(script.average_rating))} />
                    <span className="font-mono font-bold text-xs">({script.total_ratings})</span>
                  </div>
                </div>

                {script.is_paid ? (
                  <div className="space-y-3">
                    <p className="text-2xl font-bold font-mono text-primary text-center">R$ {Number(script.price).toFixed(2)}</p>

                    {hasAccess ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 justify-center text-accent text-sm">
                          <CheckCircle className="h-4 w-4" />
                          <span>Acesso desbloqueado</span>
                        </div>
                        <Button className="w-full neon-glow-green" onClick={handleDownload}>
                          <Download className="mr-2 h-4 w-4" /> Download
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {!showPwInput ? (
                          <Button
                            className="w-full neon-glow-purple"
                            onClick={() => {
                              if (!user) {
                                toast.error("Faça login para desbloquear");
                                return;
                              }
                              setShowPwInput(true);
                            }}
                          >
                            <Lock className="mr-2 h-4 w-4" /> Desbloquear com Senha
                          </Button>
                        ) : (
                          <div className="space-y-2">
                            <div className="relative">
                              <Input
                                type="password"
                                value={enteredPassword}
                                onChange={(e) => setEnteredPassword(e.target.value)}
                                placeholder="Digite a senha"
                                className="pr-10"
                                onKeyDown={(e) => e.key === "Enter" && handleUnlockWithPassword()}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 neon-glow-purple"
                                onClick={handleUnlockWithPassword}
                                disabled={unlocking || !enteredPassword.trim()}
                              >
                                {unlocking ? "Validando..." : "Confirmar"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setShowPwInput(false); setEnteredPassword(""); }}
                              >
                                Cancelar
                              </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground text-center">
                              Insira a senha fornecida pelo modder após o pagamento
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <Button className="w-full neon-glow-green" onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" /> Download Grátis
                  </Button>
                )}

                {script.external_link && !script.is_paid && (
                  <Button variant="outline" className="w-full" onClick={() => window.open(script.external_link!, "_blank")}>
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
                    <AvatarFallback className="bg-secondary">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </AvatarFallback>
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
    </Layout>
  );
}
