import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Plus, Send, ArrowLeft, Search, ThumbsUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LoginPromptDialog } from "@/components/LoginPromptDialog";
import { UserRoleBadge } from "@/components/UserRoleBadge";
import { UserBadges } from "@/components/UserBadges";

const CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "duvida", label: "Dúvida" },
  { value: "bug", label: "Bug Report" },
  { value: "sugestao", label: "Sugestão" },
  { value: "ajuda", label: "Ajuda" },
];

function categoryColor(cat: string) {
  switch (cat) {
    case "duvida": return "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30";
    case "bug": return "bg-destructive/10 text-destructive border-destructive/30";
    case "sugestao": return "bg-neon-green/10 text-neon-green border-neon-green/30";
    case "ajuda": return "bg-neon-pink/10 text-neon-pink border-neon-pink/30";
    default: return "bg-neon-purple/10 text-neon-purple border-neon-purple/30";
  }
}

export default function Forum() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("geral");
  const [replyContent, setReplyContent] = useState("");
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const requireAuth = (action: () => void) => {
    if (!user) { setShowLoginPrompt(true); return; }
    action();
  };

  // Fetch posts
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["forum-posts", filterCat, search],
    queryFn: async () => {
      let q = supabase
        .from("forum_posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (filterCat !== "all") q = q.eq("category", filterCat);
      if (search.trim()) q = q.ilike("title", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Fetch profiles for posts
  const userIds = [...new Set(posts.map((p: any) => p.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["forum-profiles", userIds],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data } = await supabase.from("profiles").select("*").in("user_id", userIds);
      return data ?? [];
    },
    enabled: userIds.length > 0,
  });
  const profileMap = Object.fromEntries((profiles as any[]).map((p) => [p.user_id, p]));

  // Fetch selected post replies
  const { data: replies = [] } = useQuery({
    queryKey: ["forum-replies", selectedPost],
    queryFn: async () => {
      if (!selectedPost) return [];
      const { data, error } = await supabase
        .from("forum_replies")
        .select("*")
        .eq("post_id", selectedPost)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPost,
  });

  // Fetch reply profiles
  const replyUserIds = [...new Set(replies.map((r: any) => r.user_id))];
  const { data: replyProfiles = [] } = useQuery({
    queryKey: ["forum-reply-profiles", replyUserIds],
    queryFn: async () => {
      if (!replyUserIds.length) return [];
      const { data } = await supabase.from("profiles").select("*").in("user_id", replyUserIds);
      return data ?? [];
    },
    enabled: replyUserIds.length > 0,
  });
  const replyProfileMap = Object.fromEntries((replyProfiles as any[]).map((p) => [p.user_id, p]));

  // Reply count per post
  const { data: replyCounts = [] } = useQuery({
    queryKey: ["forum-reply-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("forum_replies").select("post_id");
      return data ?? [];
    },
  });
  const replyCountMap: Record<string, number> = {};
  (replyCounts as any[]).forEach((r) => {
    replyCountMap[r.post_id] = (replyCountMap[r.post_id] || 0) + 1;
  });

  // Fetch likes for replies
  const replyIds = replies.map((r: any) => r.id);
  const { data: allLikes = [] } = useQuery({
    queryKey: ["forum-reply-likes", replyIds],
    queryFn: async () => {
      if (!replyIds.length) return [];
      const { data } = await supabase.from("forum_reply_likes").select("*").in("reply_id", replyIds);
      return data ?? [];
    },
    enabled: replyIds.length > 0,
  });

  const likesPerReply: Record<string, number> = {};
  const userLikedReply: Record<string, boolean> = {};
  (allLikes as any[]).forEach((l) => {
    likesPerReply[l.reply_id] = (likesPerReply[l.reply_id] || 0) + 1;
    if (user && l.user_id === user.id) userLikedReply[l.reply_id] = true;
  });

  // Toggle like
  const toggleLike = useMutation({
    mutationFn: async (replyId: string) => {
      if (!user) throw new Error("Login necessário");
      if (userLikedReply[replyId]) {
        await supabase.from("forum_reply_likes").delete().eq("reply_id", replyId).eq("user_id", user.id);
      } else {
        await supabase.from("forum_reply_likes").insert({ reply_id: replyId, user_id: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-reply-likes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Create post
  const createPost = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Login necessário");
      const { error } = await supabase.from("forum_posts").insert({
        user_id: user.id,
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
      setNewPostOpen(false);
      setNewTitle("");
      setNewContent("");
      setNewCategory("geral");
      toast.success("Post criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Create reply
  const createReply = useMutation({
    mutationFn: async () => {
      if (!user || !selectedPost) throw new Error("Login necessário");
      const { error } = await supabase.from("forum_replies").insert({
        post_id: selectedPost,
        user_id: user.id,
        content: replyContent.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-replies", selectedPost] });
      queryClient.invalidateQueries({ queryKey: ["forum-reply-counts"] });
      setReplyContent("");
      toast.success("Resposta enviada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activePost = posts.find((p: any) => p.id === selectedPost);

  // Detail view
  if (selectedPost && activePost) {
    const author = profileMap[activePost.user_id] || replyProfileMap[activePost.user_id];
    return (
      <Layout>
        <div className="container py-6 max-w-3xl">
          <Button variant="ghost" size="sm" className="mb-4 gap-2" onClick={() => setSelectedPost(null)}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Card className="neon-border bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  {author?.avatar_url ? <AvatarImage src={author.avatar_url} /> : null}
                  <AvatarFallback className="bg-secondary text-xs">{(author?.username ?? "U").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{author?.display_name ?? author?.username ?? "Usuário"}</span>
                    <UserRoleBadge userId={activePost.user_id} />
                    <UserBadges userId={activePost.user_id} compact />
                    <Badge variant="outline" className={`text-[10px] ${categoryColor(activePost.category)}`}>
                      {CATEGORIES.find((c) => c.value === activePost.category)?.label ?? activePost.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activePost.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold font-mono mt-1">{activePost.title}</h2>
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{activePost.content}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Replies */}
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">{replies.length} resposta(s)</h3>
            <AnimatePresence>
              {replies.map((reply: any) => {
                const rAuthor = replyProfileMap[reply.user_id] || profileMap[reply.user_id];
                return (
                  <motion.div key={reply.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <Card className="bg-secondary/30">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            {rAuthor?.avatar_url ? <AvatarImage src={rAuthor.avatar_url} /> : null}
                            <AvatarFallback className="bg-secondary text-[10px]">{(rAuthor?.username ?? "U").charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">{rAuthor?.display_name ?? rAuthor?.username ?? "Usuário"}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true, locale: ptBR })}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{reply.content}</p>
                            <button
                              className={`flex items-center gap-1 mt-2 text-xs transition-colors ${userLikedReply[reply.id] ? "text-neon-green" : "text-muted-foreground hover:text-neon-green"}`}
                              onClick={() => requireAuth(() => toggleLike.mutate(reply.id))}
                            >
                              <ThumbsUp className={`h-3.5 w-3.5 ${userLikedReply[reply.id] ? "fill-current" : ""}`} />
                              {likesPerReply[reply.id] || 0}
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Reply input */}
            <div className="flex gap-2 mt-4">
              <Textarea
                placeholder="Escreva sua resposta..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onClick={() => { if (!user) setShowLoginPrompt(true); }}
                readOnly={!user}
                className="min-h-[60px] flex-1"
              />
              <Button
                size="icon"
                className="neon-glow-green shrink-0 self-end"
                disabled={!replyContent.trim() || createReply.isPending}
                onClick={() => requireAuth(() => createReply.mutate())}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <LoginPromptDialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt} />
        </div>
      </Layout>
    );
  }

  // List view
  return (
    <Layout>
      <div className="container py-6 max-w-3xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold font-mono">
              <span className="text-neon-green">Fórum</span> de Dúvidas
            </h1>
            <p className="text-sm text-muted-foreground">Pergunte, ajude e interaja com a comunidade</p>
          </div>
          <Dialog open={newPostOpen} onOpenChange={setNewPostOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="neon-glow-purple gap-2" onClick={(e) => { if (!user) { e.preventDefault(); setShowLoginPrompt(true); } }}>
                <Plus className="h-4 w-4" /> Nova Pergunta
              </Button>
            </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-mono">Nova Pergunta</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  <Input placeholder="Título da pergunta" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={120} />
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea placeholder="Descreva sua dúvida em detalhes..." value={newContent} onChange={(e) => setNewContent(e.target.value)} className="min-h-[120px]" />
                  <Button
                    className="w-full neon-glow-green"
                    disabled={!newTitle.trim() || !newContent.trim() || createPost.isPending}
                    onClick={() => createPost.mutate()}
                  >
                    {createPost.isPending ? "Publicando..." : "Publicar"}
                  </Button>
                </div>
              </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Posts */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-12">Carregando...</p>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum post encontrado. Seja o primeiro a perguntar!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post: any) => {
              const author = profileMap[post.user_id];
              const count = replyCountMap[post.id] || 0;
              return (
                <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card
                    className="neon-border bg-card/60 hover:bg-card/90 transition-colors cursor-pointer"
                    onClick={() => setSelectedPost(post.id)}
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 shrink-0 hidden sm:flex">
                          {author?.avatar_url ? <AvatarImage src={author.avatar_url} /> : null}
                          <AvatarFallback className="bg-secondary text-[10px]">{(author?.username ?? "U").charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] ${categoryColor(post.category)}`}>
                              {CATEGORIES.find((c) => c.value === post.category)?.label ?? post.category}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {author?.display_name ?? author?.username ?? "Usuário"} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold mt-1 truncate">{post.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{post.content}</p>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                          <MessageSquare className="h-4 w-4" />
                          <span className="text-xs">{count}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        <LoginPromptDialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt} />
      </div>
    </Layout>
  );
}
