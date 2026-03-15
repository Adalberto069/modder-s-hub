import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  ArrowLeft, BookOpen, Clock, Star, Play, MessageSquare, Send,
  Loader2, Lightbulb, AlertTriangle, ChevronRight, Lock, Copy, Check
} from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LoginPromptDialog } from "@/components/LoginPromptDialog";

const CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "scripts-lua", label: "Scripts Lua" },
  { value: "root", label: "Root" },
  { value: "virtualizado", label: "Virtualizado" },
  { value: "iniciante", label: "Iniciante" },
];
const categoryLabels: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));

function getYouTubeEmbedUrl(url: string) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function StarRating({ rating, onRate, interactive = false, size = "md" }: {
  rating: number;
  onRate?: (r: number) => void;
  interactive?: boolean;
  size?: "sm" | "md";
}) {
  const [hover, setHover] = useState(0);
  const px = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          className={`transition-colors ${interactive ? "cursor-pointer hover:scale-110" : "cursor-default"}`}
          onClick={() => onRate?.(star)}
          onMouseEnter={() => interactive && setHover(star)}
          onMouseLeave={() => interactive && setHover(0)}
        >
          <Star
            className={`${px} transition-colors ${
              star <= (hover || rating)
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

/** Renders content with premium formatting support */
function ContentRenderer({ content }: { content: string }) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Código copiado!");
  };

  // Parse content into structured blocks first, handling multi-line code blocks properly
  interface ParsedBlock {
    type: 'heading' | 'tip' | 'warning' | 'code' | 'step' | 'bullet' | 'image' | 'video' | 'text';
    content: string;
    lang?: string;
    alt?: string;
    url?: string;
  }

  const blocks: ParsedBlock[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    // Section heading
    if (trimmed.startsWith("## ")) {
      blocks.push({ type: 'heading', content: trimmed.replace(/^##\s*/, "") });
      i++; continue;
    }

    // Multi-line code block
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim() || "code";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      blocks.push({ type: 'code', content: codeLines.join("\n"), lang });
      continue;
    }

    // Tip
    if (trimmed.startsWith("💡") || trimmed.toLowerCase().startsWith("dica:")) {
      blocks.push({ type: 'tip', content: trimmed.replace(/^💡\s*|^dica:\s*/i, "") });
      i++; continue;
    }

    // Warning
    if (trimmed.startsWith("⚠️") || trimmed.toLowerCase().startsWith("atenção:")) {
      blocks.push({ type: 'warning', content: trimmed.replace(/^⚠️\s*|^atenção:\s*/i, "").replace(/^\*\*|\*\*$/g, "") });
      i++; continue;
    }

    // Numbered step
    if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\./)?.[1] || "1";
      blocks.push({ type: 'step', content: trimmed.replace(/^\d+\.\s*/, ""), lang: num });
      i++; continue;
    }

    // Bullet
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      blocks.push({ type: 'bullet', content: trimmed.slice(2) });
      i++; continue;
    }

    // Image
    const imgMatch = trimmed.match(/!\[(.*?)\]\((.*?)\)/);
    if (imgMatch) {
      blocks.push({ type: 'image', content: imgMatch[1], url: imgMatch[2] });
      i++; continue;
    }

    // Video embed (YouTube URL on its own line or [video](url))
    const videoMatch = trimmed.match(/\[video\]\((.*?)\)/) || trimmed.match(/^(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11}.*)$/);
    if (videoMatch) {
      const videoUrl = videoMatch[1] || videoMatch[0];
      const embedUrl = getYouTubeEmbedUrl(videoUrl);
      if (embedUrl) {
        blocks.push({ type: 'video', content: videoUrl, url: embedUrl });
        i++; continue;
      }
    }

    // Normal text
    blocks.push({ type: 'text', content: trimmed });
    i++;
  }

  return (
    <div className="space-y-6">
      {blocks.map((block, idx) => {
        const delay = `${Math.min(idx * 50, 500)}ms`;

        switch (block.type) {
          case 'heading':
            return (
              <h2 key={idx} className="text-xl font-bold font-mono text-foreground mt-8 mb-4 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: delay }}>
                <div className="h-6 w-1.5 bg-primary rounded-full shadow-[0_0_10px_rgba(216,180,254,0.5)]" />
                {block.content}
              </h2>
            );

          case 'tip':
            return (
              <motion.div key={idx} whileHover={{ scale: 1.01 }}
                className="flex gap-4 p-4 rounded-xl bg-neon-cyan/5 border border-neon-cyan/20 backdrop-blur-sm shadow-lg shadow-neon-cyan/5">
                <div className="p-2 rounded-lg bg-neon-cyan/10 text-neon-cyan shrink-0 h-fit">
                  <Lightbulb className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neon-cyan/70">Dica Útil</span>
                  <p className="text-sm text-foreground/90 leading-relaxed font-medium">{renderInline(block.content)}</p>
                </div>
              </motion.div>
            );

          case 'warning':
            return (
              <motion.div key={idx} whileHover={{ scale: 1.01 }}
                className="flex gap-4 p-4 rounded-xl bg-destructive/5 border border-destructive/20 backdrop-blur-sm shadow-lg shadow-destructive/5">
                <div className="p-2 rounded-lg bg-destructive/10 text-destructive shrink-0 h-fit">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-destructive/70">Atenção</span>
                  <p className="text-sm text-foreground/90 leading-relaxed font-medium">{renderInline(block.content)}</p>
                </div>
              </motion.div>
            );

          case 'code':
            return (
              <div key={idx} className="relative group">
                <div className="absolute top-0 right-0 p-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <span className="text-[10px] font-mono text-muted-foreground bg-background/50 px-2 py-0.5 rounded border border-border/20 uppercase">
                    {block.lang}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/50 hover:bg-background/80" onClick={() => copyToClipboard(block.content)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <pre className="bg-slate-950/80 rounded-xl p-5 text-[13px] font-mono overflow-x-auto border border-white/5 shadow-2xl min-h-[60px]">
                  <code className="block text-neon-green/90 leading-relaxed whitespace-pre">{block.content}</code>
                </pre>
              </div>
            );

          case 'step':
            return (
              <div key={idx} className="flex gap-4 items-start group">
                <div className="relative shrink-0 mt-0.5">
                  <div className="absolute inset-0 bg-primary/40 blur-md rounded-full group-hover:bg-primary/60 transition-colors" />
                  <span className="relative flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-black shadow-lg">
                    {block.lang}
                  </span>
                </div>
                <p className="text-[15px] text-foreground/80 leading-relaxed font-medium pt-1">{renderInline(block.content)}</p>
              </div>
            );

          case 'bullet':
            return (
              <div key={idx} className="flex gap-3 items-start pl-2">
                <div className="h-2 w-2 rounded-full bg-accent mt-2.5 shadow-[0_0_8px_hsl(var(--accent))]" />
                <p className="text-[15px] text-foreground/85 leading-relaxed">{renderInline(block.content)}</p>
              </div>
            );

          case 'image':
            return (
              <div key={idx} className="my-4 rounded-2xl overflow-hidden border border-border/20 shadow-2xl bg-black/20 group relative">
                <img src={block.url} alt={block.content} className="w-full object-contain max-h-[500px] group-hover:scale-[1.02] transition-transform duration-700" loading="lazy" />
                {block.content && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-border/20 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/70">{block.content}</p>
                  </div>
                )}
              </div>
            );

          case 'video':
            return (
              <div key={idx} className="my-4 aspect-video rounded-xl overflow-hidden shadow-2xl border border-white/10">
                <iframe
                  src={block.url}
                  title="Vídeo do tutorial"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            );

          default:
            return <p key={idx} className="text-[15px] text-foreground/85 leading-relaxed font-medium">{renderInline(block.content)}</p>;
        }
      })}
    </div>
  );
}

function renderInline(text: string) {
  // Simple bold handling
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function TutorialDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [userRating, setUserRating] = useState(0);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const { data: tutorial } = useQuery({
    queryKey: ["tutorial", id],
    queryFn: async () => {
      const { data } = await supabase.from("tutorials").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["tutorial-comments", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tutorial_comments")
        .select("*")
        .eq("tutorial_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const commentUserIds = [...new Set(comments.map((c: any) => c.user_id))];
  const { data: commentProfiles = [] } = useQuery({
    queryKey: ["comment-profiles", commentUserIds],
    queryFn: async () => {
      if (commentUserIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("*").in("user_id", commentUserIds);
      return data ?? [];
    },
    enabled: commentUserIds.length > 0,
  });
  const profileMap = commentProfiles.reduce((acc: any, p: any) => { acc[p.user_id] = p; return acc; }, {});

  const { data: allRatings = [] } = useQuery({
    queryKey: ["tutorial-ratings", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tutorial_ratings")
        .select("*")
        .eq("tutorial_id", id!);
      return data ?? [];
    },
    enabled: !!id,
  });

  const avgRating = allRatings.length > 0
    ? allRatings.reduce((s: number, r: any) => s + r.rating, 0) / allRatings.length
    : 0;

  const existingRating = allRatings.find((r: any) => r.user_id === user?.id);

  // Set initial user rating
  useState(() => {
    if (existingRating) setUserRating(existingRating.rating);
  });

  // Related tutorials
  const { data: relatedTutorials = [] } = useQuery({
    queryKey: ["related-tutorials", tutorial?.category, id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tutorials")
        .select("*")
        .eq("category", tutorial!.category)
        .neq("id", id!)
        .limit(3);
      return data ?? [];
    },
    enabled: !!tutorial?.category && !!id,
  });

  const submitComment = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Login necessário");
      const { error } = await supabase.from("tutorial_comments").insert({
        tutorial_id: id!,
        user_id: user.id,
        content: commentText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutorial-comments", id] });
      setCommentText("");
      toast.success("Comentário enviado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submitRating = useMutation({
    mutationFn: async (rating: number) => {
      if (!user) throw new Error("Login necessário");
      if (existingRating) {
        await supabase.from("tutorial_ratings").update({ rating }).eq("id", existingRating.id);
      } else {
        await supabase.from("tutorial_ratings").insert({
          tutorial_id: id!,
          user_id: user.id,
          rating,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutorial-ratings", id] });
      queryClient.invalidateQueries({ queryKey: ["tutorial-ratings-all"] });
      toast.success("Avaliação salva!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleRate = (rating: number) => {
    if (!user) { setShowLoginPrompt(true); return; }
    setUserRating(rating);
    submitRating.mutate(rating);
  };

  const handleComment = () => {
    if (!user) { setShowLoginPrompt(true); return; }
    if (!commentText.trim()) return;
    submitComment.mutate();
  };

  if (!loading && !user) {
    return (
      <Layout>
        <div className="container py-20 max-w-lg text-center">
          <Lock className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-3">Acesso Restrito</h1>
          <p className="text-muted-foreground mb-6">
            Você precisa estar logado para acessar este tutorial.
          </p>
          <Button onClick={() => navigate("/auth?tab=login")}>Entrar</Button>
          <LoginPromptDialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt} />
        </div>
      </Layout>
    );
  }

  if (!tutorial) {
    return (
      <Layout>
        <div className="container py-20 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const embedUrl = tutorial.video_url ? getYouTubeEmbedUrl(tutorial.video_url) : null;

  return (
    <Layout>
      <div className="container py-6 max-w-4xl">
        {/* Back */}
        <Link to="/tutorials">
          <Button variant="ghost" size="sm" className="mb-4 gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar aos Tutoriais
          </Button>
        </Link>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="secondary">{categoryLabels[tutorial.category] ?? tutorial.category}</Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(tutorial.created_at).toLocaleDateString("pt-BR")}
            </span>
            {avgRating > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <Star className="h-3.5 w-3.5 fill-amber-400" />
                {avgRating.toFixed(1)} ({allRatings.length})
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-mono leading-tight">{tutorial.title}</h1>
          {tutorial.description && (
            <p className="text-muted-foreground mt-2 leading-relaxed">{tutorial.description}</p>
          )}
        </motion.div>

        {/* Video */}
        {embedUrl && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="aspect-video rounded-xl overflow-hidden shadow-2xl border border-white/10">
              <iframe
                src={embedUrl}
                title={tutorial.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
          </motion.div>
        )}

        {/* Thumbnail if no video */}
        {tutorial.thumbnail_url && !tutorial.video_url && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
            <img src={tutorial.thumbnail_url} alt={tutorial.title} className="w-full rounded-xl neon-border" loading="lazy" />
          </motion.div>
        )}

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-10"
        >
          {tutorial.content ? (
            <Card className="bg-card/60 backdrop-blur-sm neon-border">
              <CardContent className="p-6 sm:p-8">
                <ContentRenderer content={tutorial.content} />
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card/60">
              <CardContent className="p-8 text-center">
                <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground italic">Conteúdo em breve.</p>
              </CardContent>
            </Card>
          )}
        </motion.div>

           <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-10"
        >
          <Card className="bg-card/40 backdrop-blur-md border-neon-purple/20 shadow-lg shadow-neon-purple/5 overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-neon-purple/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <CardContent className="p-8 text-center space-y-4 relative">
              <h3 className="font-bold font-mono text-lg tracking-wider">Avalie este Tutorial</h3>
              <div className="flex justify-center">
                <StarRating
                  rating={userRating || (existingRating?.rating ?? 0)}
                  onRate={handleRate}
                  interactive
                />
              </div>
              <p className="text-xs text-muted-foreground/70 uppercase tracking-widest font-bold">
                {allRatings.length > 0
                  ? `${allRatings.length} avaliação(ões) · Média: ${avgRating.toFixed(1)}`
                  : "Seja o primeiro a avaliar!"}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Comments */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-10"
        >
            <h3 className="text-xl font-bold font-mono mb-6 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-neon-cyan/10 text-neon-cyan">
                <MessageSquare className="h-5 w-5" />
              </div>
              Feed de Comentários ({comments.length})
            </h3>

          {/* Comment input */}
          <div className="flex gap-2 mb-6">
            <Textarea
              placeholder="Deixe um comentário..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onClick={() => { if (!user) setShowLoginPrompt(true); }}
              readOnly={!user}
              className="min-h-[60px] flex-1"
            />
            <Button
              size="icon"
              className="neon-glow-green shrink-0 self-end"
              disabled={!commentText.trim() || submitComment.isPending}
              onClick={handleComment}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Comments list */}
          <div className="space-y-3">
            {comments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum comentário ainda. Seja o primeiro!</p>
            )}
            {comments.map((comment: any) => {
              const author = profileMap[comment.user_id];
              return (
                <Card key={comment.id} className="bg-secondary/30">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        {author?.avatar_url ? <AvatarImage src={author.avatar_url} /> : null}
                          <AvatarFallback className="bg-background border border-border/20 text-[10px] font-bold">
                            {(author?.username ?? "U").charAt(0).toUpperCase()}
                          </AvatarFallback>
                     </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{author?.display_name ?? author?.username ?? "Usuário"}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </motion.div>

        <Separator className="mb-10" />

        {/* Related tutorials */}
        {relatedTutorials.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-lg font-bold font-mono mb-4">Tutoriais Relacionados</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedTutorials.map((t: any) => (
                <Link key={t.id} to={`/tutorial/${t.id}`}>
                  <Card className="group overflow-hidden neon-border hover:neon-glow-purple transition-all duration-300 bg-card/80 h-full">
                    <div className="aspect-video bg-secondary/40 flex items-center justify-center overflow-hidden relative">
                      {t.thumbnail_url ? (
                        <img src={t.thumbnail_url} alt={t.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      ) : (
                        <BookOpen className="h-8 w-8 text-muted-foreground/20" />
                      )}
                      {t.video_url && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-background/70 rounded-full p-2">
                            <Play className="h-4 w-4 text-neon-pink" />
                          </div>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h4 className="text-xs font-semibold line-clamp-2 group-hover:text-primary transition-colors">{t.title}</h4>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        <LoginPromptDialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt} />
      </div>
    </Layout>
  );
}
