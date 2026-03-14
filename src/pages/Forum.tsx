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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Plus, Send, ArrowLeft, Search, ThumbsUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LoginPromptDialog } from "@/components/LoginPromptDialog";
import { UserRoleBadge } from "@/components/UserRoleBadge";
import { UserBadges } from "@/components/UserBadges";
import LuaCodeEditor from "@/components/LuaCodeEditor";
import { Copy, Terminal as TerminalIcon, Code as CodeIcon } from "lucide-react";
import { CodeTerminal } from "@/components/forum/CodeTerminal";

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
  const [newCode, setNewCode] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replyCode, setReplyCode] = useState("");
  const [showReplyCode, setShowReplyCode] = useState(false);
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
        code_content: newCode.trim() || null,
        category: newCategory,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
      setNewPostOpen(false);
      setNewTitle("");
      setNewContent("");
      setNewCode("");
      setShowCodeInput(false);
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
        code_content: replyCode.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-replies", selectedPost] });
      queryClient.invalidateQueries({ queryKey: ["forum-reply-counts"] });
      setReplyContent("");
      setReplyCode("");
      setShowReplyCode(false);
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
        <div className="container py-8 max-w-4xl space-y-8 animate-in fade-in duration-500">
          <Button 
            variant="ghost" 
            size="sm" 
            className="group gap-2 hover:bg-white/5 transition-all text-muted-foreground hover:text-white" 
            onClick={() => setSelectedPost(null)}
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> 
            Voltar para a Sociedade
          </Button>

          {/* Hero Post */}
          <Card className="relative overflow-hidden border-orange-500/20 bg-card/40 backdrop-blur-2xl shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-orange-500 via-neon-purple to-neon-cyan opacity-40" />
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-500/10 blur-[100px] rounded-full" />
            
            <CardContent className="p-8 sm:p-10">
              <div className="flex flex-col md:flex-row items-start gap-8">
                <div className="flex md:flex-col items-center gap-4 shrink-0">
                  <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-tr from-orange-500 to-neon-purple rounded-full opacity-40 blur group-hover:opacity-70 transition duration-500" />
                    <Avatar className="h-16 w-16 border border-white/10 shadow-xl relative bg-[#0a0a0c]">
                      {author?.avatar_url ? <AvatarImage src={author.avatar_url} /> : null}
                      <AvatarFallback className="text-xl">{(author?.username ?? "U").charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <UserRoleBadge userId={activePost.user_id} />
                    <UserBadges userId={activePost.user_id} compact />
                  </div>
                </div>

                <div className="flex-1 space-y-6">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 border-none shadow-sm ${categoryColor(activePost.category)}`}>
                        {CATEGORIES.find((c) => c.value === activePost.category)?.label ?? activePost.category}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground/80 tracking-tight">
                        Transmitido por <span className="text-white font-bold">@{author?.username}</span> · {formatDistanceToNow(new Date(activePost.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    
                    <h2 className="text-3xl font-black tracking-tighter text-white leading-tight uppercase italic">{activePost.title}</h2>
                    <div className="text-lg text-muted-foreground leading-relaxed whitespace-pre-wrap font-medium">
                      {activePost.content}
                    </div>
                    {activePost.code_content && (
                      <CodeTerminal code={activePost.code_content} title={`${activePost.title.toLowerCase().replace(/\s+/g, '_')}.lua`} />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Replies Section */}
          <div className="space-y-6 pt-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-neon-purple drop-shadow-neon-purple">
                {replies.length} Transmissões de Inteligência
              </h3>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            <div className="space-y-4">
              <AnimatePresence>
                {replies.map((reply: any) => {
                  const rAuthor = replyProfileMap[reply.user_id] || profileMap[reply.user_id];
                  return (
                    <motion.div key={reply.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                      <Card className="border-white/5 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-colors duration-300">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <Avatar className="h-10 w-10 border border-white/5 shadow-md">
                              {rAuthor?.avatar_url ? <AvatarImage src={rAuthor.avatar_url} /> : null}
                              <AvatarFallback className="bg-secondary/50 text-xs">{(rAuthor?.username ?? "U").charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-black uppercase tracking-wide text-white/90">{rAuthor?.display_name ?? rAuthor?.username ?? "Membro Nexus"}</span>
                                <UserRoleBadge userId={reply.user_id} />
                                <span className="text-[10px] font-mono text-muted-foreground/60">
                                  {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true, locale: ptBR })}
                                </span>
                              </div>
                              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                              
                              {reply.code_content && (
                                <CodeTerminal code={reply.code_content} title="reply_snippet.lua" />
                              )}

                              <div className="pt-2 flex items-center gap-4">
                                <button
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${userLikedReply[reply.id] ? "bg-neon-green/10 text-neon-green border border-neon-green/20" : "bg-white/5 text-muted-foreground hover:text-white border border-transparent hover:border-white/5"}`}
                                  onClick={() => requireAuth(() => toggleLike.mutate(reply.id))}
                                >
                                  <ThumbsUp className={`h-3 w-3 ${userLikedReply[reply.id] ? "fill-current" : ""}`} />
                                  <span className="font-mono">{likesPerReply[reply.id] || 0}</span>
                                </button>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Resposta Útil</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Elite Reply input */}
            <div className="relative group transition-all mt-8">
              <div className="absolute -inset-1 bg-gradient-to-r from-neon-purple via-transparent to-neon-cyan opacity-10 group-focus-within:opacity-30 blur rounded-2xl transition-opacity" />
              <div className="relative flex gap-3 p-2 bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/10 rounded-2xl">
                <Textarea
                  placeholder="Contribua para a inteligência coletiva..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  onClick={() => { if (!user) setShowLoginPrompt(true); }}
                  readOnly={!user}
                  className="min-h-[60px] flex-1 bg-transparent border-none focus-visible:ring-0 placeholder:text-muted-foreground/40 text-sm resize-none"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-12 w-12 rounded-xl transition-all ${showReplyCode ? "text-neon-purple bg-neon-purple/10" : "text-muted-foreground hover:text-white"}`}
                  onClick={() => setShowReplyCode(!showReplyCode)}
                >
                  <CodeIcon className="h-5 w-5" />
                </Button>
                <Button
                  size="icon"
                  className="h-12 w-12 bg-neon-purple hover:bg-neon-purple/90 text-white shadow-lg shadow-neon-purple/40 rounded-xl shrink-0 self-end transition-transform hover:scale-105 active:scale-95"
                  disabled={!replyContent.trim() || createReply.isPending}
                  onClick={() => requireAuth(() => createReply.mutate())}
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
              <AnimatePresence>
                {showReplyCode && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-3 overflow-hidden"
                  >
                    <div className="p-1 rounded-2xl border border-neon-purple/20 bg-black/40">
                      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neon-purple/60">Nexus Forge Editor Lite</span>
                        <Button variant="ghost" size="sm" className="h-6 text-[9px] uppercase font-black" onClick={() => setReplyCode("")}>Limpar</Button>
                      </div>
                      <LuaCodeEditor 
                        value={replyCode} 
                        onChange={setReplyCode} 
                        minHeight="150px"
                        placeholder="-- Insira seu snippet de ajuda aqui..."
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 uppercase">
              Nexus <span className="text-neon-purple">Society</span>
            </h1>
            <p className="text-sm text-muted-foreground font-mono tracking-widest uppercase flex items-center gap-2">
              <MessageSquare className="h-3 w-3 text-neon-purple" /> Inteligência Coletiva & Elite Modding
            </p>
          </div>
          <Dialog open={newPostOpen} onOpenChange={setNewPostOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-neon-purple hover:bg-neon-purple/90 text-white shadow-lg shadow-neon-purple/20 gap-2 rounded-xl transition-all hover:scale-105" onClick={(e) => { if (!user) { e.preventDefault(); setShowLoginPrompt(true); } }}>
                <Plus className="h-5 w-5" /> Nova Discussão
              </Button>
            </DialogTrigger>
              <DialogContent className="max-w-lg bg-[#0a0a0c]/95 backdrop-blur-xl border-white/10 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black tracking-tighter uppercase italic">Iniciar Discussão Elite</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">O que está na sua mente?</Label>
                    <Input 
                      placeholder="Título da discussão..." 
                      value={newTitle} 
                      onChange={(e) => setNewTitle(e.target.value)} 
                      maxLength={120} 
                      className="bg-white/5 border-white/10 focus:border-neon-purple/50 h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Classificação</Label>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-12"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#0a0a0c] border-white/10">
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Conteúdo Detalhado</Label>
                    <Textarea 
                      placeholder="Descreva em detalhes sua dúvida ou sugestão..." 
                      value={newContent} 
                      onChange={(e) => setNewContent(e.target.value)} 
                      className="min-h-[160px] bg-white/5 border-white/10 focus:border-neon-purple/50 resize-none" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Anexar Código (Opcional)</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={`text-[9px] font-black uppercase tracking-widest h-7 ${showCodeInput ? "text-neon-purple" : ""}`}
                        onClick={() => setShowCodeInput(!showCodeInput)}
                      >
                        {showCodeInput ? "Remover Editor" : "Abrir Editor"}
                      </Button>
                    </div>
                    {showCodeInput && (
                      <div className="rounded-xl border border-white/10 overflow-hidden bg-black/20">
                        <LuaCodeEditor 
                          value={newCode} 
                          onChange={setNewCode} 
                          minHeight="200px" 
                          placeholder="-- Insira seu código Lua aqui..."
                        />
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full h-12 bg-neon-purple hover:bg-neon-purple/90 text-white font-bold uppercase tracking-widest text-xs"
                    disabled={!newTitle.trim() || !newContent.trim() || createPost.isPending}
                    onClick={() => createPost.mutate()}
                  >
                    {createPost.isPending ? "Transmitindo..." : "PUBLICAR NA SOCIEDADE"}
                  </Button>
                </div>
              </DialogContent>
          </Dialog>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8 p-4 rounded-xl bg-card/30 backdrop-blur-md border border-white/5 shadow-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar discussões na Nexus Society..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="pl-10 bg-white/5 border-white/5 focus:border-neon-purple/50 focus:ring-neon-purple/20 h-12" 
            />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-full sm:w-[180px] bg-white/5 border-white/5 h-12">
              <SelectValue placeholder="Filtrar por" />
            </SelectTrigger>
            <SelectContent className="bg-[#0a0a0c] border-white/10">
              <SelectItem value="all">Todas Categorias</SelectItem>
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
          <div className="space-y-4">
            {posts.map((post: any) => {
              const author = profileMap[post.user_id];
              const count = replyCountMap[post.id] || 0;
              return (
                <motion.div key={post.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
                  <Card
                    className="relative overflow-hidden border-white/5 bg-card/40 backdrop-blur-xl hover:bg-card/60 hover:border-neon-purple/30 transition-all duration-300 cursor-pointer shadow-lg group"
                    onClick={() => setSelectedPost(post.id)}
                  >
                    <div className="absolute left-0 top-0 w-1 h-full bg-neon-purple opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="p-6">
                      <div className="flex items-start gap-5">
                        <div className="relative hidden sm:block">
                          <Avatar className="h-12 w-12 border border-white/10 shadow-lg group-hover:border-neon-purple/40 transition-colors">
                            {author?.avatar_url ? <AvatarImage src={author.avatar_url} /> : null}
                            <AvatarFallback className="bg-secondary text-lg">{(author?.username ?? "U").charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1 -right-1">
                            <UserRoleBadge userId={post.user_id} />
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <Badge className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-sm ${categoryColor(post.category)}`}>
                              {CATEGORIES.find((c) => c.value === post.category)?.label ?? post.category}
                            </Badge>
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                              {author?.display_name ?? author?.username ?? "Membro"} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
                            </span>
                            <UserBadges userId={post.user_id} compact />
                          </div>
                          
                          <h3 className="text-lg font-bold group-hover:text-neon-purple transition-colors truncate tracking-tight">{post.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{post.content}</p>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center gap-1 min-w-[60px] p-2 rounded-lg bg-white/5 border border-white/5 group-hover:bg-neon-purple/5 transition-colors">
                          <MessageSquare className="h-5 w-5 text-neon-purple" />
                          <span className="text-sm font-black font-mono">{count}</span>
                          <span className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/50">RESPOSTAS</span>
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
