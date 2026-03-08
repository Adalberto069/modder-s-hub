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
  Loader2, Lightbulb, AlertTriangle, ChevronRight, Lock,
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

/** Renders content with basic formatting support */
function ContentRenderer({ content }: { content: string }) {
  const sections = content.split(/\n(?=##\s)/).filter(Boolean);

  return (
    <div className="space-y-6">
      {sections.map((section, i) => {
        const lines = section.split("\n");
        const isHeading = lines[0]?.startsWith("## ");

        return (
          <div key={i}>
            {isHeading && (
              <h2 className="text-lg font-bold font-mono text-foreground mb-3 flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                {lines[0].replace(/^##\s*/, "")}
              </h2>
            )}
            <div className="space-y-2">
              {lines.slice(isHeading ? 1 : 0).map((line, j) => {
                const trimmed = line.trim();
                if (!trimmed) return null;

                // Tip callout
                if (trimmed.startsWith("💡") || trimmed.toLowerCase().startsWith("dica:")) {
                  return (
                    <div key={j} className="flex gap-2.5 p-3 rounded-lg bg-neon-cyan/5 border border-neon-cyan/20">
                      <Lightbulb className="h-4 w-4 text-neon-cyan shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground/90">{trimmed.replace(/^💡\s*|^dica:\s*/i, "")}</p>
                    </div>
                  );
                }

                // Warning callout
                if (trimmed.startsWith("⚠️") || trimmed.toLowerCase().startsWith("atenção:")) {
                  return (
                    <div key={j} className="flex gap-2.5 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground/90">{trimmed.replace(/^⚠️\s*|^atenção:\s*/i, "")}</p>
                    </div>
                  );
                }

                // Code block
                if (trimmed.startsWith("```") || trimmed.startsWith("`")) {
                  const code = trimmed.replace(/^```\w*\s*|```$/g, "").replace(/^`|`$/g, "");
                  return (
                    <pre key={j} className="bg-secondary/60 rounded-lg p-3 text-xs font-mono overflow-x-auto border border-border">
                      <code>{code}</code>
                    </pre>
                  );
                }

                // Numbered step
                if (/^\d+\.\s/.test(trimmed)) {
                  const num = trimmed.match(/^(\d+)\./)?.[1];
                  const text = trimmed.replace(/^\d+\.\s*/, "");
                  return (
                    <div key={j} className="flex gap-3 items-start">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0 mt-0.5">
                        {num}
                      </span>
                      <p className="text-sm text-foreground/85 leading-relaxed">{renderInline(text)}</p>
                    </div>
                  );
                }

                // Bullet
                if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                  return (
                    <div key={j} className="flex gap-2.5 items-start pl-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0 mt-2" />
                      <p className="text-sm text-foreground/85 leading-relaxed">{renderInline(trimmed.slice(2))}</p>
                    </div>
                  );
                }

                // Normal text
                return <p key={j} className="text-sm text-foreground/85 leading-relaxed">{renderInline(trimmed)}</p>;
              })}
            </div>
          </div>
        );
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
            <div className="aspect-video rounded-xl overflow-hidden neon-border">
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

        {/* Rating section */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-10"
        >
          <Card className="bg-card/60 neon-border">
            <CardContent className="p-6 text-center space-y-3">
              <h3 className="font-semibold font-mono">Avalie este tutorial</h3>
              <StarRating
                rating={userRating || (existingRating?.rating ?? 0)}
                onRate={handleRate}
                interactive
              />
              <p className="text-xs text-muted-foreground">
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
          <h3 className="text-lg font-bold font-mono mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-neon-cyan" />
            Comentários ({comments.length})
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
                        <AvatarFallback className="bg-secondary text-[10px]">
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
