import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout/Layout";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { MessageSquare, Plus, Send, ArrowLeft, Search, ThumbsUp, Terminal as TerminalIcon, Code as CodeIcon, Network, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LoginPromptDialog } from "@/components/LoginPromptDialog";
import { UserRoleBadge } from "@/components/UserRoleBadge";
import { UserBadges } from "@/components/UserBadges";
import LuaCodeEditor from "@/components/LuaCodeEditor";
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
    case "duvida": return "bg-neon-cyan/5 text-neon-cyan border-neon-cyan/30";
    case "bug": return "bg-destructive/10 text-destructive border-destructive/30";
    case "sugestao": return "bg-neon-green/5 text-neon-green border-neon-green/30";
    case "ajuda": return "bg-neon-pink/5 text-neon-pink border-neon-pink/30";
    default: return "bg-neon-purple/5 text-neon-purple border-neon-purple/30";
  }
}

export default function Forum() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [sortBy, setSortBy] = useState<"recent" | "replies">("recent");
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
  const PAGE_SIZE = 10;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const requireAuth = (action: () => void) => {
    if (!user) { setShowLoginPrompt(true); return; }
    action();
  };

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["forum-posts", filterCat, search],
    queryFn: async () => {
      let q = supabase.from("forum_posts").select("*").order("created_at", { ascending: false });
      if (filterCat !== "all") q = q.eq("category", filterCat);
      if (search.trim()) q = q.ilike("title", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const userIds = [...new Set(posts.map((p: any) => p.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["forum-profiles", userIds],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data } = await supabase.from("profiles").select("id, user_id, username, display_name, avatar_url, bio, reputation_score, total_downloads, total_positive_reviews, created_at, updated_at").in("user_id", userIds);
      return data ?? [];
    },
    enabled: userIds.length > 0,
  });
  const profileMap = Object.fromEntries((profiles as any[]).map((p) => [p.user_id, p]));

  const { data: replies = [] } = useQuery({
    queryKey: ["forum-replies", selectedPost],
    queryFn: async () => {
      if (!selectedPost) return [];
      const { data, error } = await supabase.from("forum_replies").select("*").eq("post_id", selectedPost).order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPost,
  });

  const replyUserIds = [...new Set(replies.map((r: any) => r.user_id))];
  const { data: replyProfiles = [] } = useQuery({
    queryKey: ["forum-reply-profiles", replyUserIds],
    queryFn: async () => {
      if (!replyUserIds.length) return [];
      const { data } = await supabase.from("profiles").select("id, user_id, username, display_name, avatar_url, bio, reputation_score, total_downloads, total_positive_reviews, created_at, updated_at").in("user_id", replyUserIds);
      return data ?? [];
    },
    enabled: replyUserIds.length > 0,
  });
  const replyProfileMap = Object.fromEntries((replyProfiles as any[]).map((p) => [p.user_id, p]));

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

  const toggleLike = useMutation({
    mutationFn: async (replyId: string) => {
      if (!user) throw new Error("Login necessário");
      if (userLikedReply[replyId]) {
        await supabase.from("forum_reply_likes").delete().eq("reply_id", replyId).eq("user_id", user.id);
      } else {
        await supabase.from("forum_reply_likes").insert({ reply_id: replyId, user_id: user.id });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["forum-reply-likes"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const createPost = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Login necessário");
      const { error } = await supabase.from("forum_posts").insert({
        user_id: user.id, title: newTitle.trim(), content: newContent.trim(),
        code_content: newCode.trim() || null, category: newCategory,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
      setNewPostOpen(false); setNewTitle(""); setNewContent(""); setNewCode(""); setShowCodeInput(false); setNewCategory("geral");
      toast.success("Discussão publicada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createReply = useMutation({
    mutationFn: async () => {
      if (!user || !selectedPost) throw new Error("Login necessário");
      const { error } = await supabase.from("forum_replies").insert({
        post_id: selectedPost, user_id: user.id, content: replyContent.trim(),
        code_content: replyCode.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-replies", selectedPost] });
      queryClient.invalidateQueries({ queryKey: ["forum-reply-counts"] });
      setReplyContent(""); setReplyCode(""); setShowReplyCode(false);
      toast.success("Resposta enviada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activePost = posts.find((p: any) => p.id === selectedPost);

  // Reset pagination when filters / search / sort change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filterCat, search, sortBy]);

  const sortedPosts = [...posts].sort((a: any, b: any) =>
    sortBy === "replies"
      ? (replyCountMap[b.id] || 0) - (replyCountMap[a.id] || 0)
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const visiblePosts = sortedPosts.slice(0, visibleCount);
  const hasMore = visibleCount < sortedPosts.length;

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => c + PAGE_SIZE);
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, visiblePosts.length]);

  // Detail view
  if (selectedPost && activePost) {
    const author = profileMap[activePost.user_id] || replyProfileMap[activePost.user_id];
    return (
      <Layout>
        <div className="container py-6 sm:py-10 px-4 max-w-5xl space-y-6 sm:space-y-8">
          <Button 
            aria-label="Voltar"
            variant="ghost" size="sm" 
            className="group gap-2 hover:bg-foreground/5 transition-all text-muted-foreground hover:text-foreground  font-bold  text-xs sm:text-xs rounded-md" 
            onClick={() => setSelectedPost(null)}
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> 
            Voltar ao fórum
          </Button>

          {/* Hero Post */}
          <Card className="rounded-md bg-card border border-border relative overflow-visible">
            {/* Top Accent Line */}
            <div className="absolute top-[-1px] left-0 w-full h-[2px] bg-gradient-to-r from-neon-purple via-neon-cyan to-transparent opacity-80" />
            
            <CardContent className="p-6 sm:p-10 font-sans">
              <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-10">
                {/* Author Info Column */}
                <div className="flex sm:flex-col items-center sm:w-32 shrink-0 border-b sm:border-b-0 sm:border-r border-border/60 pb-6 sm:pb-0 sm:pr-8 gap-4 w-full">
                  <div className="relative group cursor-pointer">
                    <Avatar className="h-16 w-16 sm:h-24 sm:w-24 border border-border rounded-md grayscale group-hover:grayscale-0 transition-all bg-background">
                      {author?.avatar_url ? <AvatarImage src={author.avatar_url} /> : null}
                      <AvatarFallback className="text-xl sm:text-3xl bg-transparent font-bold">{(author?.username ?? "U").charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex flex-col items-center sm:items-end w-full sm:w-auto overflow-hidden">
                    <span className="text-sm font-bold  text-foreground truncate max-w-full">{author?.display_name ?? author?.username ?? "Membro"}</span>
                    <span className="text-xs text-muted-foreground mb-3 truncate max-w-full">{formatDistanceToNow(new Date(activePost.created_at), { addSuffix: true, locale: ptBR })}</span>
                    <div className="flex sm:flex-col gap-2 w-full items-center sm:items-end">
                      <UserRoleBadge userId={activePost.user_id} />
                      <UserBadges userId={activePost.user_id} compact />
                    </div>
                  </div>
                </div>

                {/* Content Column */}
                <div className="flex-1 space-y-6 min-w-0">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                       <ShieldAlert className="w-4 h-4 text-foreground/40" />
                       <Badge className={`text-xs font-bold   px-3 py-1 rounded-md border border-transparent ${categoryColor(activePost.category)}`}>
                        {CATEGORIES.find((c) => c.value === activePost.category)?.label ?? activePost.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground  opacity-60">ID_REF: {activePost.id.split('-')[0]}</span>
                    </div>
                    
                    <h2 className="text-2xl sm:text-4xl font-bold tracking-tighter text-foreground  break-words">{activePost.title}</h2>
                    
                    <div className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans mt-4 p-4 bg-background border border-border/60">
                      {activePost.content}
                    </div>
                    
                    {activePost.code_content && (
                      <div className="mt-6 border border-border">
                        <CodeTerminal code={activePost.code_content} title={`${activePost.title.toLowerCase().replace(/\s+/g, '_')}.lua`} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Replies Section */}
          <div className="space-y-6 pt-6">
            <div className="flex items-center gap-4">
              <h3 className="text-xs font-bold   text-neon-purple flex gap-3 items-center whitespace-nowrap">
                <span className="w-4 h-[2px] bg-neon-purple" />
                {replies.length} respostas
              </h3>
              <div className="h-[1px] flex-1 bg-foreground/10" />
            </div>

            <div className="space-y-4">
              <AnimatePresence>
                {replies.map((reply: any) => {
                  const rAuthor = replyProfileMap[reply.user_id] || profileMap[reply.user_id];
                  return (
                    <motion.div key={reply.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                      <Card className="border border-border/60 bg-card rounded-md hover:border-border transition-colors font-sans">
                        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
                          {/* Reply Profile */}
                          <div className="flex sm:flex-col items-center sm:w-24 shrink-0 gap-3 border-b sm:border-b-0 sm:border-r border-border/60 pb-4 sm:pb-0 sm:pr-4">
                            <Avatar className="h-10 w-10 sm:h-16 sm:w-16 rounded-md border border-border grayscale">
                              {rAuthor?.avatar_url ? <AvatarImage src={rAuthor.avatar_url} /> : null}
                              <AvatarFallback className="bg-background text-xs sm:text-sm font-bold text-foreground">{(rAuthor?.username ?? "U").charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col items-start sm:items-center min-w-0">
                               <span className="text-xs font-bold  tracking-wide text-foreground truncate max-w-[120px] sm:max-w-full">
                                  {rAuthor?.display_name ?? rAuthor?.username ?? "Membro"}
                               </span>
                               <span className="text-xs text-muted-foreground mt-1 mb-2">
                                  {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true, locale: ptBR })}
                               </span>
                               <UserRoleBadge userId={reply.user_id} />
                            </div>
                          </div>

                          {/* Reply Content */}
                          <div className="flex-1 min-w-0 space-y-4">
                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap bg-background p-3 border border-border/60">{reply.content}</p>
                            
                            {reply.code_content && (
                              <div className="border border-border">
                                <CodeTerminal code={reply.code_content} title={`snippet_${reply.id.substring(0,6)}.lua`} />
                              </div>
                            )}

                            <div className="flex items-center justify-end">
                              <Button variant="ghost"
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold   transition-all rounded-md border ${userLikedReply[reply.id] ? "bg-neon-green/10 text-neon-green border-neon-green/30" : "bg-background text-muted-foreground hover:text-foreground border-border hover:border-border/30"}`}
                                onClick={() => requireAuth(() => toggleLike.mutate(reply.id))}
                              >
                                <ThumbsUp className={`h-3 w-3 ${userLikedReply[reply.id] ? "fill-current" : ""}`} />
                                <span>{likesPerReply[reply.id] || 0} curtidas</span>
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Reply Input terminal */}
            <div className="mt-8 border border-border bg-card p-1 font-sans relative">
               <div className="absolute -top-3 left-4 bg-card px-2">
                  <span className="text-xs  font-bold  text-neon-purple">Sua resposta</span>
               </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4 p-2 sm:p-4 pb-2 sm:pb-4">
                <Textarea
                  placeholder="Escreva uma resposta..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  onClick={() => { if (!user) setShowLoginPrompt(true); }}
                  readOnly={!user}
                  className="min-h-[80px] sm:min-h-[60px] flex-1 bg-background border border-border focus-visible:ring-1 focus-visible:ring-neon-purple rounded-md placeholder:text-muted-foreground/30 text-xs text-foreground resize-none p-3"
                />
                <div className="flex flex-row sm:flex-col gap-2 shrink-0 h-[80px] sm:h-auto">
                  <Button
                    variant="outline"
                    className={`flex-1 sm:flex-none sm:h-[48%] rounded-md  font-bold  text-xs transition-all ${showReplyCode ? "border-neon-purple text-neon-purple hover:text-neon-purple/80" : "border-border text-muted-foreground hover:text-foreground hover:bg-background"}`}
                    onClick={() => setShowReplyCode(!showReplyCode)}
                  >
                    <CodeIcon className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Snippet</span>
                  </Button>
                  <Button
                    className="flex-[2] sm:flex-none sm:h-[48%] rounded-md bg-primary hover:bg-primary/90 text-primary-foreground shadow-neon transition-transform hover:-translate-y-[1px] font-bold  text-xs "
                    disabled={!replyContent.trim() || createReply.isPending}
                    onClick={() => requireAuth(() => createReply.mutate())}
                  >
                    <Send className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Enviar</span>
                  </Button>
                </div>
              </div>
              
              <AnimatePresence>
                {showReplyCode && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden p-2 sm:p-4 pt-0"
                  >
                    <div className="border border-border bg-background">
                      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
                        <span className="text-xs font-bold   text-neon-purple">Terminal File</span>
                        <Button aria-label="Limpar código" variant="ghost" className="h-5 px-2 text-xs  font-bold text-foreground/50 hover:text-foreground hover:bg-foreground/5 rounded-md" onClick={() => setReplyCode("")}>WIPE</Button>
                      </div>
                      <LuaCodeEditor 
                        value={replyCode} 
                        onChange={setReplyCode} 
                        minHeight="150px"
                        placeholder="-- Execute syntax here..."
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
      <div className="container py-8 sm:py-16 px-4 max-w-6xl font-sans">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 mb-10 border-b border-border pb-8 relative">
          <PageHeader eyebrow="HIDDENMOD / COMUNIDADE" title={<>Fórum <span className="text-primary">HiddenMod.</span></>} description="Converse com outros jogadores, compartilhe ideias e tire suas dúvidas." />

          <div className="relative z-10 w-full sm:w-auto">
            <Dialog open={newPostOpen} onOpenChange={setNewPostOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto h-14 px-8 bg-primary text-primary-foreground hover:bg-neon-purple/90 font-bold   text-xs rounded-md shadow-neon transition-all hover:-translate-y-1" onClick={(e) => { if (!user) { e.preventDefault(); setShowLoginPrompt(true); } }}>
                  <Plus className="h-4 w-4 mr-3" /> Nova discussão
                </Button>
              </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-2xl bg-background border-border p-0 font-sans text-foreground rounded-md">
                  <div className="p-6 sm:p-8 border-b border-border bg-card">
                    <DialogHeader>
                      <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tighter  flex items-center gap-3">
                        <TerminalIcon className="h-6 w-6 text-neon-purple" />
                        Nova discussão
                      </DialogTitle>
                    </DialogHeader>
                  </div>
                  <div className="p-6 sm:p-8 max-h-[70vh] overflow-y-auto space-y-6 custom-scrollbar bg-background">
                    <div className="space-y-3">
                      <Label className="text-xs sm:text-xs font-bold   text-foreground/60">Cabeçalho</Label>
                      <Input 
                        placeholder="[ Título da Discussão ]" 
                        value={newTitle} 
                        onChange={(e) => setNewTitle(e.target.value)} 
                        maxLength={120} 
                        className="bg-card border-border focus-visible:ring-neon-purple h-12 text-sm rounded-md"
                      />
                    </div>
                    
                    <div className="grid sm:grid-cols-2 gap-6">
                       <div className="space-y-3">
                         <Label className="text-xs sm:text-xs font-bold   text-foreground/60">Categoria</Label>
                         <Select value={newCategory} onValueChange={setNewCategory}>
                           <SelectTrigger className="bg-card border-border h-12 text-sm rounded-md"><SelectValue /></SelectTrigger>
                           <SelectContent className="bg-card border-border rounded-md">
                             {CATEGORIES.map((c) => (
                               <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="space-y-3 flex flex-col justify-end">
                          <Button 
                            variant="outline"
                            className={`w-full h-12  font-bold text-xs  rounded-md transition-all ${showCodeInput ? "bg-primary text-primary-foreground border-neon-purple shadow-neon" : "bg-card text-foreground/50 hover:text-foreground border-border hover:border-border/30"}`}
                            onClick={() => setShowCodeInput(!showCodeInput)}
                          >
                            <CodeIcon className="h-4 w-4 mr-2" />
                            {showCodeInput ? "Anexado" : "Anexar Snippet.LUA"}
                          </Button>
                       </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs sm:text-xs font-bold   text-foreground/60">Mensagem</Label>
                      <Textarea 
                        placeholder=">_ descreva o assunto detalhadamente..." 
                        value={newContent} 
                        onChange={(e) => setNewContent(e.target.value)} 
                        className="min-h-[140px] bg-card border-border focus-visible:ring-neon-purple resize-none text-sm rounded-md p-4" 
                      />
                    </div>
                    
                    {showCodeInput && (
                      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="border border-border font-sans bg-card">
                         <div className="flex justify-between items-center p-2 border-b border-border/60 bg-background">
                            <span className="text-xs text-neon-purple  font-bold px-2 ">Compiler View</span>
                         </div>
                        <LuaCodeEditor value={newCode} onChange={setNewCode} minHeight="200px" placeholder="-- Inject syntax..." />
                      </motion.div>
                    )}

                    <Button
                      className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold   text-xs shadow-neon transition-all rounded-md mt-4"
                      disabled={!newTitle.trim() || !newContent.trim() || createPost.isPending}
                      onClick={() => createPost.mutate()}
                    >
                      {createPost.isPending ? "Processando..." : "Publicar discussão"}
                    </Button>
                  </div>
                </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-3 gap-0 mb-6 border border-border bg-background">
          {[
            { label: "Discussões", value: posts.length },
            { label: "Respostas", value: (replyCounts as any[]).length },
            { label: "Participantes", value: new Set([...userIds, ...(replyCounts as any[]).map((r:any)=>r.user_id)].filter(Boolean)).size },
          ].map((s, i) => (
            <div key={s.label} className={`p-4 sm:p-5 flex flex-col items-center justify-center ${i < 2 ? "border-r border-border" : ""}`}>
              <span className="text-2xl sm:text-3xl font-bold tracking-tighter text-foreground">{s.value}</span>
              <span className="text-xs sm:text-xs font-bold   text-muted-foreground mt-1">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Category Quick Chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[{ value: "all", label: "Todas" }, ...CATEGORIES].map((c) => {
            const active = filterCat === c.value;
            return (
              <Button variant="ghost"
                key={c.value}
                onClick={() => setFilterCat(c.value)}
                className={`px-3 py-1.5 text-xs sm:text-xs font-bold   border rounded-md transition-all ${
                  active
                    ? "bg-primary text-primary-foreground border-neon-purple shadow-neon"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-border/30"
                }`}
              >
                {c.label}
              </Button>
            );
          })}
        </div>

        {/* Filters Bar Protocol */}
        <div className="grid sm:grid-cols-3 gap-0 mb-8 border border-border bg-background">
          <div className="relative sm:col-span-2 flex items-center border-b sm:border-b-0 sm:border-r border-border p-2">
            <Search className="absolute left-6 h-5 w-5 text-foreground/30" />
            <Input 
              placeholder="Buscar discussões..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="pl-14 bg-transparent border-none focus-visible:ring-0 h-10 text-sm placeholder: placeholder: rounded-md placeholder:text-foreground/20" 
            />
          </div>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="sm:col-span-1 bg-transparent border-none focus:ring-0 h-14 text-sm rounded-md   px-6 shadow-none">
              <SelectValue placeholder="SORT_BY" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border rounded-md font-sans">
              <SelectItem value="recent">Mais Recentes</SelectItem>
              <SelectItem value="replies">Mais Comentados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Posts Data Grid */}
        {isLoading ? (
          <div className="border border-border/60 bg-card py-20 flex flex-col items-center">
             <div className="w-10 h-10 border-2 border-neon-purple border-b-transparent rounded-full animate-spin mb-4" />
             <p className="text-xs text-muted-foreground  ">Carregando discussões...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-24 border border-border/60 bg-card flex flex-col items-center">
            <TerminalIcon className="h-12 w-12 text-foreground/10 mb-4" />
            <p className="text-sm font-bold text-foreground  ">Nenhuma discussão</p>
            <p className="text-xs text-muted-foreground mt-2 ">Nenhuma discussão encontrada.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visiblePosts.map((post: any) => {
              const author = profileMap[post.user_id];
              const count = replyCountMap[post.id] || 0;
              return (
                <motion.div key={post.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                  <Card
                    className="border-border/60 bg-card hover:bg-secondary hover:border-border transition-all duration-300 cursor-pointer rounded-md relative group"
                    onClick={() => setSelectedPost(post.id)}
                  >
                    <div className="absolute left-0 top-0 w-1 h-full bg-neon-purple opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                      
                      {/* Left: Avatar/Status */}
                      <div className="hidden sm:flex flex-col items-center shrink-0 w-16">
                        <Avatar className="h-14 w-14 rounded-md border border-border grayscale group-hover:grayscale-0 transition-colors bg-background">
                          {author?.avatar_url ? <AvatarImage src={author.avatar_url} /> : null}
                          <AvatarFallback className="bg-transparent text-foreground font-bold">{(author?.username ?? "U").charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="mt-[-10px] z-10 scale-90">
                          <UserRoleBadge userId={post.user_id} />
                        </div>
                      </div>
                      
                      {/* Center: Info */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge className={`text-xs sm:text-xs font-bold   px-2 py-0.5 rounded-md border ${categoryColor(post.category)}`}>
                            {CATEGORIES.find((c) => c.value === post.category)?.label ?? post.category}
                          </Badge>
                          <span className="text-xs sm:text-xs font-bold   text-muted-foreground truncate group-hover:text-muted-foreground transition-colors">
                            {author?.display_name ?? author?.username ?? "Membro"} // {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        
                        <h3 className="text-base sm:text-xl font-bold text-foreground group-hover:text-neon-purple transition-colors truncate tracking-tight ">{post.title}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-1 opacity-70 bg-background p-2 border border-border/60">{post.content}</p>
                      </div>
                      
                      {/* Right: Interaction */}
                      <div className="flex flex-row sm:flex-col items-center justify-between sm:justify-center w-full sm:w-20 gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-border/60 pt-4 sm:pt-0 pl-0 sm:pl-4">
                        <div className="flex flex-col items-center bg-background border border-border/60 group-hover:border-neon-purple/30 p-2 w-full transition-colors">
                           <MessageSquare className="h-4 w-4 text-neon-purple mb-1" />
                           <span className="text-sm font-bold text-foreground">{count}</span>
                        </div>
                        <span className="text-[7px]  font-bold  text-muted-foreground/50 hidden sm:block">RESPOSTAS</span>
                      </div>

                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}

            {hasMore && (
              <div ref={sentinelRef} className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="w-6 h-6 border-2 border-neon-purple border-b-transparent rounded-full animate-spin" />
                <Button variant="ghost"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="px-4 py-2 text-xs sm:text-xs font-bold   border border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/30 rounded-md transition-all"
                >
                  Carregar mais discussões ({sortedPosts.length - visibleCount})
                </Button>
              </div>
            )}

            {!hasMore && sortedPosts.length > PAGE_SIZE && (
              <p className="text-center py-6 text-xs   text-muted-foreground/40 font-bold">
                // Fim da transmissão — {sortedPosts.length} threads
              </p>
            )}
          </div>
        )}

        <LoginPromptDialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt} />
      </div>
    </Layout>
  );
}
