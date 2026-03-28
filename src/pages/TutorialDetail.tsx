import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  ArrowLeft, BookOpen, Clock, Star, Play, MessageSquare, Send,
  Loader2, Lightbulb, AlertTriangle, ChevronRight, Lock, Copy, Check,
  List, ChevronUp, Eye, Hash, Video, Link2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  const px = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          className={`transition-all duration-200 ${interactive ? "cursor-pointer hover:scale-125" : "cursor-default"}`}
          onClick={() => onRate?.(star)}
          onMouseEnter={() => interactive && setHover(star)}
          onMouseLeave={() => interactive && setHover(0)}
        >
          <Star
            className={`${px} transition-all duration-200 ${
              star <= (hover || rating)
                ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]"
                : "text-muted-foreground/20"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

/** Parse content into structured blocks */
interface ParsedBlock {
  type: 'heading' | 'tip' | 'warning' | 'code' | 'step' | 'bullet' | 'image' | 'video' | 'text';
  content: string;
  lang?: string;
  alt?: string;
  url?: string;
}

function parseContent(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    if (trimmed.startsWith("## ")) {
      blocks.push({ type: 'heading', content: trimmed.replace(/^##\s*/, "") });
      i++; continue;
    }

    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim() || "code";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({ type: 'code', content: codeLines.join("\n"), lang });
      continue;
    }

    if (trimmed.startsWith("💡") || trimmed.toLowerCase().startsWith("dica:")) {
      blocks.push({ type: 'tip', content: trimmed.replace(/^💡\s*|^dica:\s*/i, "") });
      i++; continue;
    }

    if (trimmed.startsWith("⚠️") || trimmed.toLowerCase().startsWith("atenção:")) {
      blocks.push({ type: 'warning', content: trimmed.replace(/^⚠️\s*|^atenção:\s*/i, "").replace(/^\*\*|\*\*$/g, "") });
      i++; continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\./)?.[1] || "1";
      blocks.push({ type: 'step', content: trimmed.replace(/^\d+\.\s*/, ""), lang: num });
      i++; continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      blocks.push({ type: 'bullet', content: trimmed.slice(2) });
      i++; continue;
    }

    const imgMatch = trimmed.match(/!\[(.*?)\]\((.*?)\)/);
    if (imgMatch) {
      blocks.push({ type: 'image', content: imgMatch[1], url: imgMatch[2] });
      i++; continue;
    }

    const videoMatch = trimmed.match(/\[video\]\((.*?)\)/) || trimmed.match(/^(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11}.*)$/);
    if (videoMatch) {
      const videoUrl = videoMatch[1] || videoMatch[0];
      const embedUrl = getYouTubeEmbedUrl(videoUrl);
      if (embedUrl) {
        blocks.push({ type: 'video', content: videoUrl, url: embedUrl });
        i++; continue;
      }
    }

    blocks.push({ type: 'text', content: trimmed });
    i++;
  }

  return blocks;
}

function renderInline(text: string) {
  // Bold: **text**
  // Link: [label](url)
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
    }
    const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      return (
        <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
          {linkMatch[1]}
        </a>
      );
    }
    return part;
  });
}

/** Table of Contents extracted from headings */
function TableOfContents({ blocks, activeSection }: { blocks: ParsedBlock[]; activeSection: string }) {
  const headings = blocks.filter(b => b.type === 'heading');
  if (headings.length < 2) return null;

  return (
    <nav className="space-y-1">
      <div className="flex items-center gap-2 mb-3 px-2">
        <List className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Índice</span>
      </div>
      {headings.map((h, idx) => {
        const slug = h.content.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        const isActive = activeSection === slug;
        return (
          <a
            key={idx}
            href={`#section-${slug}`}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(`section-${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={`block px-3 py-1.5 rounded-lg text-xs transition-all duration-200 border-l-2 ${
              isActive
                ? "border-primary bg-primary/10 text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            {h.content}
          </a>
        );
      })}
    </nav>
  );
}

/** Content Renderer with improved styling */
function ContentRenderer({ content, onSectionIds }: { content: string; onSectionIds?: (ids: string[]) => void }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const blocks = useMemo(() => parseContent(content), [content]);

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
    toast.success("Código copiado!");
  };

  useEffect(() => {
    if (onSectionIds) {
      const ids = blocks.filter(b => b.type === 'heading').map(b => b.content.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''));
      onSectionIds(ids);
    }
  }, [blocks, onSectionIds]);

  return (
    <div className="space-y-6">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            const slug = block.content.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
            return (
              <div key={idx} id={`section-${slug}`} className="scroll-mt-24 pt-6 first:pt-0">
                <h2 className="text-lg sm:text-xl font-bold font-mono text-foreground flex items-center gap-3 group">
                  <div className="h-7 w-1.5 rounded-full bg-gradient-to-b from-primary to-primary/40 shadow-[0_0_12px_hsl(var(--primary)/0.4)]" />
                  <span>{block.content}</span>
                  <a href={`#section-${slug}`} className="opacity-0 group-hover:opacity-50 transition-opacity">
                    <Hash className="h-4 w-4" />
                  </a>
                </h2>
                <div className="h-px bg-gradient-to-r from-primary/20 via-border/30 to-transparent mt-3" />
              </div>
            );
          }

          case 'tip':
            return (
              <motion.div key={idx} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                className="flex gap-4 p-4 rounded-xl bg-neon-cyan/5 border border-neon-cyan/20 backdrop-blur-sm">
                <div className="p-2 rounded-lg bg-neon-cyan/10 text-neon-cyan shrink-0 h-fit">
                  <Lightbulb className="h-5 w-5" />
                </div>
                <div className="space-y-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neon-cyan/70">Dica</span>
                  <p className="text-sm text-foreground/90 leading-relaxed">{renderInline(block.content)}</p>
                </div>
              </motion.div>
            );

          case 'warning':
            return (
              <motion.div key={idx} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                className="flex gap-4 p-4 rounded-xl bg-destructive/5 border border-destructive/20 backdrop-blur-sm">
                <div className="p-2 rounded-lg bg-destructive/10 text-destructive shrink-0 h-fit">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-destructive/70">Atenção</span>
                  <p className="text-sm text-foreground/90 leading-relaxed">{renderInline(block.content)}</p>
                </div>
              </motion.div>
            );

          case 'code':
            return (
              <motion.div key={idx} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="relative group rounded-xl overflow-hidden border border-white/5 shadow-2xl">
                {/* Header bar */}
                <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
                      <div className="h-2.5 w-2.5 rounded-full bg-neon-green/60" />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground/50 uppercase ml-2">{block.lang}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => copyToClipboard(block.content, idx)}
                  >
                    {copiedIdx === idx ? <Check className="h-3 w-3 text-neon-green" /> : <Copy className="h-3 w-3" />}
                    {copiedIdx === idx ? "Copiado!" : "Copiar"}
                  </Button>
                </div>
                {/* Code */}
                <pre className="bg-slate-950/90 p-5 text-[13px] font-mono overflow-x-auto custom-scrollbar">
                  <code className="block text-neon-green/90 leading-relaxed whitespace-pre">{block.content}</code>
                </pre>
              </motion.div>
            );

          case 'step':
            return (
              <motion.div key={idx} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                className="flex gap-4 items-start group">
                <div className="relative shrink-0 mt-0.5">
                  <div className="absolute inset-0 bg-primary/30 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm font-black shadow-lg">
                    {block.lang}
                  </span>
                </div>
                <div className="pt-1.5 flex-1 min-w-0">
                  <p className="text-[15px] text-foreground/85 leading-relaxed">{renderInline(block.content)}</p>
                </div>
              </motion.div>
            );

          case 'bullet':
            return (
              <div key={idx} className="flex gap-3 items-start pl-2">
                <ChevronRight className="h-4 w-4 text-primary mt-1 shrink-0" />
                <p className="text-[15px] text-foreground/85 leading-relaxed">{renderInline(block.content)}</p>
              </div>
            );

          case 'image':
            return (
              <motion.div key={idx} initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                className="my-4 rounded-2xl overflow-hidden border border-border/20 shadow-2xl bg-black/20 group">
                <img src={block.url} alt={block.content} className="w-full object-contain max-h-[500px] group-hover:scale-[1.01] transition-transform duration-700" loading="lazy" />
                {block.content && (
                  <div className="px-4 py-2 bg-secondary/30 border-t border-border/10">
                    <p className="text-[11px] text-muted-foreground italic text-center">{block.content}</p>
                  </div>
                )}
              </motion.div>
            );

          case 'video':
            return (
              <motion.div key={idx} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="my-6 rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black/30">
                <div className="aspect-video">
                  <iframe
                    src={block.url}
                    title="Vídeo do tutorial"
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              </motion.div>
            );

          case 'bullet_list':
            return (
              <ul key={idx} className="space-y-2 pl-2">
                {(block as any).items?.map((item: string, i: number) => (
                  <li key={i} className="flex gap-3 items-start">
                    <ChevronRight className="h-4 w-4 text-primary mt-1 shrink-0" />
                    <p className="text-[15px] text-foreground/85 leading-relaxed">{renderInline(item)}</p>
                  </li>
                ))}
              </ul>
            );

          case 'link':
            return (
              <div key={idx} className="my-4">
                <a href={block.url} target="_blank" rel="noopener noreferrer" 
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all font-bold text-sm">
                  <Link2 className="h-4 w-4" />
                  {(block as any).label || block.content}
                </a>
              </div>
            );

          case 'divider':
            return <Separator key={idx} className="my-8 bg-border/20" />;

          default:
            return <p key={idx} className="text-[15px] text-foreground/80 leading-relaxed">{renderInline(block.content)}</p>;
        }
      })}
    </div>
  );
}

/** Reading progress bar */
function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5">
      <div
        className="h-full bg-gradient-to-r from-primary via-neon-cyan to-neon-green transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export default function TutorialDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [userRating, setUserRating] = useState(0);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Track scroll for back-to-top
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Track active section via IntersectionObserver
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  useEffect(() => {
    if (sectionIds.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id.replace('section-', ''));
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(`section-${id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sectionIds]);

  const { data: tutorial } = useQuery({
    queryKey: ["tutorial", id],
    queryFn: async () => {
      const { data } = await supabase.from("tutorials").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: authorProfile } = useQuery({
    queryKey: ["tutorial-author", tutorial?.author_id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", tutorial!.author_id).single();
      return data;
    },
    enabled: !!tutorial?.author_id,
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
      const { data } = await supabase.from("tutorial_ratings").select("*").eq("tutorial_id", id!);
      return data ?? [];
    },
    enabled: !!id,
  });

  const avgRating = allRatings.length > 0
    ? allRatings.reduce((s: number, r: any) => s + r.rating, 0) / allRatings.length
    : 0;

  const existingRating = allRatings.find((r: any) => r.user_id === user?.id);

  useState(() => {
    if (existingRating) setUserRating(existingRating.rating);
  });

  const { data: relatedTutorials = [] } = useQuery({
    queryKey: ["related-tutorials", tutorial?.category, id],
    queryFn: async () => {
      const { data } = await supabase.from("tutorials").select("*").eq("category", tutorial!.category).neq("id", id!).limit(3);
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
        await supabase.from("tutorial_ratings").insert({ tutorial_id: id!, user_id: user.id, rating });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutorial-ratings", id] });
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

  const blocks = useMemo(() => tutorial?.content ? parseContent(tutorial.content) : [], [tutorial?.content]);

  if (!loading && !user) {
    return (
      <Layout>
        <div className="container py-20 max-w-lg text-center">
          <Lock className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-3">Acesso Restrito</h1>
          <p className="text-muted-foreground mb-6">Você precisa estar logado para acessar este tutorial.</p>
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
  const readingTime = tutorial.content ? Math.max(1, Math.ceil(tutorial.content.split(/\s+/).length / 200)) : 1;

  return (
    <Layout>
      <ReadingProgress />

      <div className="container py-6 max-w-6xl">
        {/* Back */}
        <Link to="/tutorials">
          <Button variant="ghost" size="sm" className="mb-4 gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar aos Tutoriais
          </Button>
        </Link>

        {/* Header Hero */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-card via-card to-secondary/30 border border-border/30 p-6 sm:p-8">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-grid-pattern opacity-30" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

            <div className="relative">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Badge className="bg-primary/15 text-primary border-primary/20 hover:bg-primary/20">
                  {categoryLabels[tutorial.category] ?? tutorial.category}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(tutorial.created_at).toLocaleDateString("pt-BR")}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  ~{readingTime} min de leitura
                </span>
                {avgRating > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <Star className="h-3.5 w-3.5 fill-amber-400" />
                    {avgRating.toFixed(1)} ({allRatings.length})
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-mono leading-tight mb-3">{tutorial.title}</h1>

              {tutorial.description && (
                <p className="text-muted-foreground max-w-2xl leading-relaxed">{tutorial.description}</p>
              )}

              {/* Author info */}
              {authorProfile && (
                <div className="flex items-center gap-3 mt-5 pt-5 border-t border-border/20">
                  <Avatar className="h-9 w-9">
                    {authorProfile.avatar_url && <AvatarImage src={authorProfile.avatar_url} />}
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {(authorProfile.username ?? "U").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{authorProfile.display_name || authorProfile.username}</p>
                    <p className="text-xs text-muted-foreground">Autor do tutorial</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Video */}
        {embedUrl && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
            <div className="aspect-video rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black/30">
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
            <img src={tutorial.thumbnail_url} alt={tutorial.title} className="w-full rounded-xl border border-border/20 shadow-lg" loading="lazy" />
          </motion.div>
        )}

        {/* Main content area with sidebar */}
        <div className="flex gap-8 mb-10">
          {/* Sticky Table of Contents - desktop only */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24">
              <TableOfContents blocks={blocks} activeSection={activeSection} />
            </div>
          </aside>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex-1 min-w-0"
          >
            {tutorial.content ? (
              <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-xl">
                <CardContent className="p-5 sm:p-8">
                  <ContentRenderer content={tutorial.content} onSectionIds={setSectionIds} />
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
        </div>

        {/* Rating */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="mb-10">
          <Card className="bg-card/40 backdrop-blur-md border-primary/10 overflow-hidden">
            <CardContent className="p-8 text-center space-y-4 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
              <div className="relative space-y-4">
                <h3 className="font-bold font-mono text-lg">Avalie este Tutorial</h3>
                <div className="flex justify-center">
                  <StarRating
                    rating={userRating || (existingRating?.rating ?? 0)}
                    onRate={handleRate}
                    interactive
                  />
                </div>
                <p className="text-xs text-muted-foreground/70">
                  {allRatings.length > 0
                    ? `${allRatings.length} avaliação(ões) · Média: ${avgRating.toFixed(1)}`
                    : "Seja o primeiro a avaliar!"}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Comments */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-10">
          <h3 className="text-xl font-bold font-mono mb-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-neon-cyan/10 text-neon-cyan">
              <MessageSquare className="h-5 w-5" />
            </div>
            Comentários ({comments.length})
          </h3>

          {/* Comment input */}
          <Card className="mb-6 bg-card/40 border-border/20">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0 mt-1">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {user ? (user.email?.charAt(0).toUpperCase() || "U") : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <Textarea
                    placeholder="Deixe um comentário..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onClick={() => { if (!user) setShowLoginPrompt(true); }}
                    readOnly={!user}
                    className="min-h-[60px] bg-background/50 border-border/20 resize-none"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={!commentText.trim() || submitComment.isPending}
                      onClick={handleComment}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Enviar
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comments list */}
          <div className="space-y-3">
            {comments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum comentário ainda. Seja o primeiro!</p>
            )}
            {comments.map((comment: any) => {
              const author = profileMap[comment.user_id];
              return (
                <Card key={comment.id} className="bg-card/30 border-border/15">
                  <CardContent className="p-4">
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
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h3 className="text-lg font-bold font-mono mb-4">Tutoriais Relacionados</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedTutorials.map((t: any) => (
                <Link key={t.id} to={`/tutorial/${t.id}`}>
                  <Card className="group overflow-hidden border-border/20 hover:border-primary/30 transition-all duration-300 bg-card/80 h-full">
                    <div className="aspect-video bg-secondary/40 flex items-center justify-center overflow-hidden relative">
                      {t.thumbnail_url ? (
                        <img src={t.thumbnail_url} alt={t.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      ) : (
                        <BookOpen className="h-8 w-8 text-muted-foreground/20" />
                      )}
                      {t.video_url && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-background/70 rounded-full p-2 group-hover:scale-110 transition-transform">
                            <Play className="h-4 w-4 text-primary" />
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

        {/* Back to top floating button */}
        <AnimatePresence>
          {showScrollTop && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed bottom-6 right-6 z-40"
            >
              <Button
                size="icon"
                className="h-10 w-10 rounded-full shadow-lg bg-primary/90 hover:bg-primary"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                <ChevronUp className="h-5 w-5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <LoginPromptDialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt} />
      </div>
    </Layout>
  );
}
