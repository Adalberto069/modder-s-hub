import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { BookOpen, Play, Clock, Plus, Pencil, Trash2, Loader2, Search, Star } from "lucide-react";
import { motion } from "framer-motion";

const CATEGORIES = [
  { value: "geral", label: "Geral", icon: "📖" },
  { value: "scripts-lua", label: "Scripts Lua", icon: "💻" },
  { value: "root", label: "Root", icon: "🔓" },
  { value: "virtualizado", label: "Virtualizado", icon: "📱" },
  { value: "iniciante", label: "Iniciante", icon: "🌱" },
];

const categoryLabels: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));

interface TutorialForm {
  title: string;
  description: string;
  content: string;
  category: string;
  video_url: string;
  thumbnail_url: string;
}

const emptyForm: TutorialForm = {
  title: "", description: "", content: "", category: "geral", video_url: "", thumbnail_url: "",
};

export default function Tutorials() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TutorialForm>(emptyForm);

  const { data: tutorials = [], isLoading } = useQuery({
    queryKey: ["tutorials"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tutorials")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Fetch average ratings for all tutorials
  const tutorialIds = tutorials.map((t: any) => t.id);
  const { data: ratings = [] } = useQuery({
    queryKey: ["tutorial-ratings-all", tutorialIds],
    queryFn: async () => {
      if (tutorialIds.length === 0) return [];
      const { data } = await supabase
        .from("tutorial_ratings")
        .select("tutorial_id, rating")
        .in("tutorial_id", tutorialIds);
      return data ?? [];
    },
    enabled: tutorialIds.length > 0,
  });

  const ratingMap = useMemo(() => {
    const map: Record<string, { avg: number; count: number }> = {};
    ratings.forEach((r: any) => {
      if (!map[r.tutorial_id]) map[r.tutorial_id] = { avg: 0, count: 0 };
      map[r.tutorial_id].count++;
      map[r.tutorial_id].avg += r.rating;
    });
    Object.keys(map).forEach(k => {
      map[k].avg = map[k].avg / map[k].count;
    });
    return map;
  }, [ratings]);

  const saveTutorial = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        description: form.description || null,
        content: form.content || null,
        category: form.category,
        video_url: form.video_url || null,
        thumbnail_url: form.thumbnail_url || null,
        author_id: user!.id,
      };
      if (editingId) {
        const { error } = await supabase.from("tutorials").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tutorials").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutorials"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(editingId ? "Tutorial atualizado!" : "Tutorial criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTutorial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tutorials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutorials"] });
      toast.success("Tutorial excluído!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (t: any) => {
    setEditingId(t.id);
    setForm({
      title: t.title,
      description: t.description || "",
      content: t.content || "",
      category: t.category,
      video_url: t.video_url || "",
      thumbnail_url: t.thumbnail_url || "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const filtered = useMemo(() => {
    let result = tutorials;
    if (activeCategory !== "all") {
      result = result.filter((t: any) => t.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t: any) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [tutorials, activeCategory, search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tutorials.forEach((t: any) => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    return counts;
  }, [tutorials]);

  return (
    <Layout>
      <div className="container py-8 max-w-6xl">
        {/* Hero header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold font-mono mb-2">
                <span className="text-neon-cyan">Tutoriais</span> & Guias
              </h1>
              <p className="text-muted-foreground max-w-lg">
                Aprenda do zero ao avançado. Guias passo a passo para scripts, root, virtualização e muito mais.
              </p>
            </div>
            {isAdmin && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNew} className="neon-glow-purple shrink-0">
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingId ? "Editar Tutorial" : "Novo Tutorial"}</DialogTitle>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(e) => { e.preventDefault(); saveTutorial.mutate(); }}
                  >
                    <div className="space-y-2">
                      <Label>Título *</Label>
                      <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                    </div>
                    <div className="space-y-2">
                      <Label>Conteúdo (Markdown)</Label>
                      <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8} placeholder="Use ## para subtítulos, - para listas, **negrito**, etc." />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>URL do Vídeo (YouTube)</Label>
                      <Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
                    </div>
                    <div className="space-y-2">
                      <Label>URL da Thumbnail</Label>
                      <Input value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="https://..." />
                    </div>
                    <Button type="submit" className="w-full neon-glow-green" disabled={saveTutorial.isPending || !form.title.trim()}>
                      {saveTutorial.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                      {editingId ? "Salvar" : "Adicionar"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Search */}
          <div className="relative max-w-md mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tutoriais..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={activeCategory === "all" ? "default" : "outline"}
              className="cursor-pointer px-3 py-1.5 text-xs transition-all hover:scale-105"
              onClick={() => setActiveCategory("all")}
            >
              Todos ({tutorials.length})
            </Badge>
            {CATEGORIES.map((cat) => (
              <Badge
                key={cat.value}
                variant={activeCategory === cat.value ? "default" : "outline"}
                className="cursor-pointer px-3 py-1.5 text-xs transition-all hover:scale-105"
                onClick={() => setActiveCategory(cat.value)}
              >
                {cat.icon} {cat.label} {categoryCounts[cat.value] ? `(${categoryCounts[cat.value]})` : ""}
              </Badge>
            ))}
          </div>
        </div>

        {/* Results count */}
        {!isLoading && (
          <p className="text-xs text-muted-foreground mb-4">
            {filtered.length} tutorial{filtered.length !== 1 ? "is" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
          </p>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <BookOpen className="h-14 w-14 mx-auto text-muted-foreground/30" />
            <p className="text-muted-foreground">
              {search ? "Nenhum tutorial encontrado para essa busca." : "Nenhum tutorial disponível ainda."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
                    <Card className="group overflow-hidden neon-border hover:neon-glow-purple transition-all duration-300 bg-card/80 backdrop-blur-sm h-full flex flex-col">
                      {/* Thumbnail */}
                      <div className="aspect-video bg-secondary/40 flex items-center justify-center overflow-hidden relative">
                        {tutorial.thumbnail_url ? (
                          <img
                            src={tutorial.thumbnail_url}
                            alt={tutorial.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                        ) : (
                          <BookOpen className="h-12 w-12 text-muted-foreground/20" />
                        )}
                        {tutorial.video_url && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-background/70 backdrop-blur-sm rounded-full p-3 group-hover:scale-110 transition-transform duration-300">
                              <Play className="h-6 w-6 text-neon-pink fill-neon-pink/30" />
                            </div>
                          </div>
                        )}
                        {/* Admin overlay */}
                        {isAdmin && (
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <Button size="icon" variant="secondary" className="h-7 w-7" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(tutorial); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="destructive" className="h-7 w-7" onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteTutorial.mutate(tutorial.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>

                      <CardContent className="p-4 space-y-2.5 flex-1 flex flex-col">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {categoryLabels[tutorial.category] ?? tutorial.category}
                          </Badge>
                          {rating && (
                            <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                              <Star className="h-3 w-3 fill-amber-400" />
                              {rating.avg.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                          {tutorial.title}
                        </h3>
                        {tutorial.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{tutorial.description}</p>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1 mt-auto">
                          <Clock className="h-3 w-3" />
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
