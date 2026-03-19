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
import { BookOpen, Play, Clock, Plus, Pencil, Trash2, Loader2, Search, Star, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { LoginPromptDialog } from "@/components/LoginPromptDialog";

const CATEGORIES = [
  { value: "geral", label: "Geral", icon: "📖" },
  { value: "scripts-lua", label: "Scripts Lua", icon: "💻" },
  { value: "root", label: "Root", icon: "🔓" },
  { value: "virtualizado", label: "Virtualizado", icon: "📱" },
  { value: "iniciante", label: "Iniciante", icon: "🌱" },
];

const categoryLabels: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));

export default function Tutorials() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

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
        <div className="mb-5 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold font-mono mb-1 sm:mb-2">
                <span className="text-neon-cyan">Tutoriais</span> & Guias
              </h1>
              <p className="text-xs sm:text-base text-muted-foreground max-w-lg">
                Aprenda do zero ao avançado com guias passo a passo.
              </p>
            </div>
            {isAdmin && (
              <Button onClick={() => navigate("/tutorial/new")} className="neon-glow-purple shrink-0 w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            )}
          </div>

          {/* Search */}
          <div className="relative max-w-full sm:max-w-md mb-4 sm:mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar tutoriais..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 sm:h-10 text-sm" />
          </div>

          {/* Category filters */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
            <Badge
              variant={activeCategory === "all" ? "default" : "outline"}
              className="cursor-pointer px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs transition-all hover:scale-105 whitespace-nowrap"
              onClick={() => setActiveCategory("all")}
            >
              Todos ({tutorials.length})
            </Badge>
            {CATEGORIES.map((cat) => (
              <Badge
                key={cat.value}
                variant={activeCategory === cat.value ? "default" : "outline"}
                className="cursor-pointer px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs transition-all hover:scale-105 whitespace-nowrap"
                onClick={() => setActiveCategory(cat.value)}
              >
                {cat.icon} {cat.label} {categoryCounts[cat.value] ? `(${categoryCounts[cat.value]})` : ""}
              </Badge>
            ))}
          </div>
        </div>

        {/* Results count */}
        {!isLoading && (
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4">
            {filtered.length} tutorial{filtered.length !== 1 ? "is" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
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
                    <Card className="group overflow-hidden border-neon-purple/20 hover:border-neon-purple/40 hover:shadow-neon-purple/10 transition-all duration-500 bg-card/40 backdrop-blur-md h-full flex flex-col shadow-lg">
                      {/* Thumbnail */}
                      <div className="aspect-video bg-secondary/40 flex items-center justify-center overflow-hidden relative">
                        {tutorial.thumbnail_url ? (
                          <img src={tutorial.thumbnail_url} alt={tutorial.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                        ) : (
                          <BookOpen className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground/20" />
                        )}
                        {tutorial.video_url && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-background/70 backdrop-blur-sm rounded-full p-2 sm:p-3 group-hover:scale-110 transition-transform duration-300">
                              <Play className="h-4 w-4 sm:h-6 sm:w-6 text-neon-pink fill-neon-pink/30" />
                            </div>
                          </div>
                        )}
                        {isAdmin && (
                          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <Button size="icon" variant="secondary" className="h-6 w-6 sm:h-7 sm:w-7" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/tutorial/${tutorial.id}/edit`); }}>
                              <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            </Button>
                            <Button size="icon" variant="destructive" className="h-6 w-6 sm:h-7 sm:w-7" onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteTutorial.mutate(tutorial.id); }}>
                              <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>

                      <CardContent className="p-3 sm:p-5 space-y-2 sm:space-y-3 flex-1 flex flex-col">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-[9px] sm:text-[10px] bg-neon-purple/10 text-neon-purple border-neon-purple/20 px-1.5 sm:px-2">
                            {categoryLabels[tutorial.category] ?? tutorial.category}
                          </Badge>
                          {rating && (
                            <div className="flex items-center gap-0.5 sm:gap-1 bg-amber-400/10 px-1.5 py-0.5 rounded-full">
                              <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 fill-amber-400 text-amber-400" />
                              <span className="text-[9px] sm:text-[10px] font-bold text-amber-400">{rating.avg.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        <h3 className="font-bold text-xs sm:text-sm line-clamp-2 group-hover:text-neon-purple transition-colors leading-snug">
                          {tutorial.title}
                        </h3>
                        {tutorial.description && (
                          <p className="text-[10px] sm:text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed hidden sm:block">{tutorial.description}</p>
                        )}
                        <div className="flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] text-muted-foreground/60 pt-1.5 sm:pt-2 mt-auto border-t border-border/10">
                          <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          {new Date(tutorial.created_at).toLocaleDateString("pt-BR")}
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
    </Layout>
  );
}
