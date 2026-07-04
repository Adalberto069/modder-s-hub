import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { BookOpen, Play, Clock, Plus, Pencil, Trash2, Loader2, Search, Star, Lock, Terminal, Cpu, Package, ShieldCheck, Zap, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import { LoginPromptDialog } from "@/components/LoginPromptDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

const CATEGORIES = [
  { value: "geral", label: "Geral", icon: "📖" },
  { value: "scripts-lua", label: "Scripts Lua", icon: "💻" },
  { value: "root", label: "Root", icon: "🔓" },
  { value: "virtualizado", label: "Virtualizado", icon: "📱" },
  { value: "iniciante", label: "Iniciante", icon: "🌱" },
];

// Tópicos sugeridos específicos do HiddenMod (atalhos para busca)
const HIDDENMOD_TOPICS = [
  { q: "game guardian", label: "Game Guardian", desc: "instalar, configurar, anexar processo", icon: Cpu, hover: "hover:border-neon-purple/50", color: "text-neon-purple" },
  { q: "lua", label: "Scripts Lua", desc: "gg.* api, hooks, menus interativos", icon: Terminal, hover: "hover:border-neon-green/50", color: "text-neon-green" },
  { q: "apk", label: "APKs & Loaders", desc: "hidden_loader, virtualizadores, splits", icon: Package, hover: "hover:border-neon-cyan/50", color: "text-neon-cyan" },
  { q: "watermark", label: "Watermark & Licença", desc: "como funciona o lacre por comprador", icon: ShieldCheck, hover: "hover:border-neon-pink/50", color: "text-neon-pink" },
  { q: "root", label: "Root vs No-Root", desc: "magisk, exposed, virtual space", icon: Zap, hover: "hover:border-neon-purple/50", color: "text-neon-purple" },
  { q: "virtualizado", label: "Virtualizado", desc: "vmos, f1vm, parallel space", icon: Smartphone, hover: "hover:border-neon-cyan/50", color: "text-neon-cyan" },
];

const categoryLabels: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));

export default function Tutorials() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [tutorialToDelete, setTutorialToDelete] = useState<{ id: string; title: string } | null>(null);

  const { data: tutorials = [], isLoading } = useQuery({
    queryKey: ["tutorials"],
    queryFn: async () => {
      const { data } = await supabase.from("tutorials").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const tutorialIds = tutorials.map((t: any) => t.id);
  const { data: ratings = [] } = useQuery({
    queryKey: ["tutorial-ratings-all", tutorialIds],
    queryFn: async () => {
      if (tutorialIds.length === 0) return [];
      const { data } = await supabase.from("tutorial_ratings").select("tutorial_id, rating").in("tutorial_id", tutorialIds);
      return data ?? [];
    },
    enabled: !!user && tutorialIds.length > 0,
  });

  const ratingMap = useMemo(() => {
    const map: Record<string, { avg: number; count: number }> = {};
    ratings.forEach((r: any) => {
      if (!map[r.tutorial_id]) map[r.tutorial_id] = { avg: 0, count: 0 };
      map[r.tutorial_id].count++;
      map[r.tutorial_id].avg += r.rating;
    });
    Object.keys(map).forEach(k => { map[k].avg = map[k].avg / map[k].count; });
    return map;
  }, [ratings]);

  const deleteTutorial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tutorials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tutorials"] }); toast.success("Tutorial excluído!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let result = tutorials;
    if (activeCategory !== "all") result = result.filter((t: any) => t.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t: any) => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)));
    }
    return result;
  }, [tutorials, activeCategory, search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tutorials.forEach((t: any) => { counts[t.category] = (counts[t.category] || 0) + 1; });
    return counts;
  }, [tutorials]);

  if (!loading && !user) {
    return (
      <Layout>
        <div className="container py-16 sm:py-20 px-4 max-w-lg text-center">
          <Lock className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 sm:mb-6 text-muted-foreground" />
          <h1 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3">Acesso Restrito</h1>
          <p className="text-sm text-muted-foreground mb-4 sm:mb-6">Você precisa estar logado para acessar os tutoriais.</p>
          <Button onClick={() => navigate("/auth?tab=login")}>Entrar</Button>
          <LoginPromptDialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-5 sm:py-8 px-3 sm:px-4 max-w-6xl">
        {/* Hero header */}
        <div className="mb-8">
          <div className="relative overflow-hidden border border-white/10 bg-[#050505] p-6 sm:p-10 mb-8 rounded-none">
            <div className="absolute top-0 right-0 w-72 h-72 bg-neon-cyan/5 blur-[100px] -z-10" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-neon-purple/5 blur-[80px] -z-10" />
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 font-mono">
                  <Badge variant="outline" className="border-neon-cyan/30 text-neon-cyan px-2 py-0.5 bg-neon-cyan/5 text-[10px] uppercase tracking-widest rounded-none">
                    <BookOpen className="h-3 w-3 mr-1" /> EDUCATION_MODULE
                  </Badge>
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">
                    Central de <span className="text-neon-cyan shadow-neon-cyan">Treinamento</span>
                  </h1>
                  <p className="text-muted-foreground max-w-xl text-xs sm:text-sm leading-relaxed mt-2 font-mono uppercase tracking-widest">
                    Aprenda táticas de nível root, do zero ao avançado. Documentação completa para exploração e deobfuscamento.
                  </p>
                </div>
              </div>
              {isAdmin && (
                <Button onClick={() => navigate("/tutorial/new")} className="bg-neon-purple hover:bg-neon-purple/90 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] rounded-none font-black uppercase tracking-widest text-[10px] shrink-0 w-full sm:w-auto h-12 px-6">
                  <Plus className="h-4 w-4 mr-2" /> Novo Registro
                </Button>
              )}
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col lg:flex-row gap-4 bg-[#050505] border border-white/5 p-4 rounded-none font-mono relative">
            
            {/* Search */}
            <div className="relative w-full lg:w-96 shrink-0 lg:border-r border-white/5 lg:pr-4 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-neon-cyan" />
              <Input 
                placeholder=">_ QUERY_DATABASE..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="pl-10 bg-[#030304] border-white/10 focus-visible:ring-neon-cyan rounded-none h-12 text-neon-green font-mono uppercase tracking-widest text-[10px]" 
              />
            </div>

            {/* Category filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-1 min-w-0">
              <Badge
                variant="outline"
                className={`cursor-pointer whitespace-nowrap px-4 py-1.5 transition-all duration-200 text-[9px] uppercase tracking-widest rounded-none shrink-0 ${
                  activeCategory === "all" ? "bg-neon-cyan text-[#050505] border-neon-cyan shadow-[0_0_10px_rgba(34,211,238,0.2)]" : "border-white/10 hover:border-white/30 bg-[#030304] text-muted-foreground hover:text-white"
                }`}
                onClick={() => setActiveCategory("all")}
              >
                [TODOS: {tutorials.length}]
              </Badge>
              {CATEGORIES.map((cat) => (
                <Badge
                  key={cat.value}
                  variant="outline"
                   className={`cursor-pointer whitespace-nowrap px-4 py-1.5 transition-all duration-200 text-[9px] uppercase tracking-widest rounded-none shrink-0 ${
                    activeCategory === cat.value ? "bg-neon-cyan text-[#050505] border-neon-cyan shadow-[0_0_10px_rgba(34,211,238,0.2)]" : "border-white/10 hover:border-white/30 bg-[#030304] text-muted-foreground hover:text-white"
                  }`}
                  onClick={() => setActiveCategory(cat.value)}
                >
                  {cat.icon} {cat.label} {categoryCounts[cat.value] ? `[${categoryCounts[cat.value]}]` : ""}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Tópicos rápidos do HiddenMod */}
        {!search && activeCategory === "all" && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3 font-mono">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">// quick_topics ·</span>
              <span className="text-[10px] uppercase tracking-widest text-neon-green">hiddenmod_stack</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
              {HIDDENMOD_TOPICS.map((topic) => {
                const Icon = topic.icon;
                return (
                  <button
                    key={topic.q}
                    onClick={() => setSearch(topic.q)}
                    className={`group text-left bg-[#050505] border border-white/10 ${topic.hover} hover:bg-[#080808] transition-all duration-200 p-3 rounded-none font-mono`}
                  >
                    <Icon className={`h-4 w-4 mb-2 ${topic.color} group-hover:scale-110 transition-transform`} />
                    <div className="text-[10px] sm:text-[11px] font-black text-white uppercase tracking-tight leading-tight">
                      {topic.label}
                    </div>
                    <div className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-widest mt-1 leading-tight line-clamp-2">
                      {topic.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Results count */}
        {!isLoading && (
          <p className="text-[10px] sm:text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4 sm:mb-6">
            <span className="font-black text-neon-cyan">[{filtered.length}]</span> REGISTROS ENCONTRADOS
          </p>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 sm:py-20">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 sm:py-20 space-y-3">
            <BookOpen className="h-10 w-10 sm:h-14 sm:w-14 mx-auto text-muted-foreground/30" />
            <p className="text-xs sm:text-sm text-muted-foreground">
              {search ? "Nenhum tutorial encontrado." : "Nenhum tutorial disponível ainda."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {filtered.map((tutorial: any, i: number) => {
              const rating = ratingMap[tutorial.id];
              return (
                <motion.div
                  key={tutorial.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                >
                  <Link to={`/tutorial/${tutorial.id}`} className="block h-full">
                    <Card className="group overflow-hidden border-white/10 hover:border-neon-cyan/50 transition-all duration-300 bg-[#050505] rounded-none h-full flex flex-col shadow-none hover:shadow-[0_0_15px_rgba(34,211,238,0.1)]">
                      {/* Thumbnail */}
                      <div className="aspect-video bg-[#030304] border-b border-white/5 flex items-center justify-center overflow-hidden relative">
                        {tutorial.thumbnail_url ? (
                          <img src={tutorial.thumbnail_url} alt={tutorial.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out opacity-80 group-hover:opacity-100" loading="lazy" />
                        ) : (
                          <BookOpen className="h-8 w-8 sm:h-12 sm:w-12 text-white/5 shadow-neon-purple" />
                        )}
                        {tutorial.video_url && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-[#050505]/80 border border-white/10 backdrop-blur-sm rounded-none p-3 group-hover:scale-110 transition-transform duration-300">
                              <Play className="h-4 w-4 sm:h-6 sm:w-6 text-neon-cyan fill-neon-cyan/30" />
                            </div>
                          </div>
                        )}
                        {isAdmin && (
                          <div className="absolute top-0 right-0 p-1 flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-[#050505] border-b border-l border-white/10">
                            <Button aria-label="Editar tutorial" size="icon" variant="ghost" className="h-6 w-6 rounded-none hover:bg-white/10 text-muted-foreground hover:text-white" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/tutorial/${tutorial.id}/edit`); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button aria-label="Excluir tutorial" size="icon" variant="ghost" className="h-6 w-6 rounded-none hover:bg-destructive/20 text-destructive" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTutorialToDelete({ id: tutorial.id, title: tutorial.title }); }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}

                        <div className="absolute top-0 left-0 p-1 bg-[#050505] border-b border-r border-white/10 z-10 hidden sm:block">
                           <span className="text-[7px] text-muted-foreground uppercase font-mono tracking-widest">[{tutorial.id.substring(0,6)}]</span>
                        </div>

                        {/* Glitch Overlay Effect on Hover */}
                        <div className="absolute inset-0 bg-neon-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mix-blend-overlay pointer-events-none" />
                      </div>

                      <CardContent className="p-4 flex-1 flex flex-col gap-3 font-mono">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[8px] sm:text-[9px] bg-[#030304] text-white/70 border-white/10 px-2 uppercase tracking-widest rounded-none">
                            {categoryLabels[tutorial.category] ?? tutorial.category}
                          </Badge>
                          {rating && (
                            <div className="flex items-center gap-1.5 border border-white/5 bg-[#030304] px-1.5 py-0.5">
                              <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 fill-amber-500 text-amber-500" />
                              <span className="text-[8px] sm:text-[9px] font-black text-amber-500 uppercase tracking-widest">{rating.avg.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        <h3 className="font-black text-sm uppercase tracking-tight text-white group-hover:text-neon-cyan transition-colors duration-300 leading-tight italic truncate">
                          {tutorial.title}
                        </h3>
                        {tutorial.description && (
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest line-clamp-2 leading-relaxed hidden sm:block">
                            {tutorial.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-widest pt-3 mt-auto border-t border-white/5">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-neon-purple" />
                            {new Date(tutorial.created_at).toLocaleDateString("pt-BR")}
                          </div>
                           <span className="bg-transparent hover:bg-white/5 text-muted-foreground transition-all duration-300 font-black px-2 py-1">
                             <BookOpen className="inline h-3 w-3 mr-1" /> DOC
                           </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      <ConfirmDeleteDialog
        open={!!tutorialToDelete}
        onOpenChange={(o) => { if (!o) setTutorialToDelete(null); }}
        title="Excluir tutorial?"
        description="Esta ação é permanente. O tutorial será removido para todos os usuários."
        itemName={tutorialToDelete?.title}
        onConfirm={() => {
          if (tutorialToDelete) {
            deleteTutorial.mutate(tutorialToDelete.id);
            setTutorialToDelete(null);
          }
        }}
      />
    </Layout>
  );
}
