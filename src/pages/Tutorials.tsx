import { useState } from "react";
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
import { BookOpen, Play, Clock, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const getYouTubeEmbedUrl = (url: string) => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
};

const CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "scripts-lua", label: "Scripts Lua" },
  { value: "root", label: "Root" },
  { value: "virtualizado", label: "Virtualizado" },
  { value: "iniciante", label: "Iniciante" },
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TutorialForm>(emptyForm);

  const { data: tutorials, isLoading } = useQuery({
    queryKey: ["tutorials"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tutorials")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

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

  const categories = [...new Set((tutorials ?? []).map((t: any) => t.category))];
  const filtered = activeCategory === "all"
    ? tutorials
    : tutorials?.filter((t: any) => t.category === activeCategory);

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="h-7 w-7 text-neon-cyan" />
              <h1 className="text-3xl font-bold">Tutoriais</h1>
            </div>
            <p className="text-muted-foreground max-w-xl">
              Aprenda a usar scripts, configurar seu dispositivo e tirar o máximo proveito da plataforma.
            </p>
          </div>
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNew} className="neon-glow-purple">
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar Tutorial" : "Novo Tutorial"}</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveTutorial.mutate();
                  }}
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
                    <Label>Conteúdo</Label>
                    <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} placeholder="Texto completo do tutorial..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
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
                  <Button type="submit" className="w-full" disabled={saveTutorial.isPending || !form.title.trim()}>
                    {saveTutorial.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    {editingId ? "Salvar" : "Adicionar"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Badge
            variant={activeCategory === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setActiveCategory("all")}
          >
            Todos
          </Badge>
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setActiveCategory(cat)}
            >
              {categoryLabels[cat] ?? cat}
            </Badge>
          ))}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered?.map((tutorial: any, i: number) => (
              <motion.div
                key={tutorial.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="group overflow-hidden neon-border hover:neon-glow-purple transition-all duration-300 bg-card/80 backdrop-blur-sm h-full flex flex-col">
                  {/* Thumbnail */}
                  <div className="aspect-video bg-secondary/50 flex items-center justify-center overflow-hidden relative">
                    {tutorial.thumbnail_url ? (
                      <img src={tutorial.thumbnail_url} alt={tutorial.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <BookOpen className="h-12 w-12 text-muted-foreground/30" />
                    )}
                    {tutorial.video_url && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-background/70 rounded-full p-3">
                          <Play className="h-6 w-6 text-neon-pink" />
                        </div>
                      </div>
                    )}
                    {/* Admin actions overlay */}
                    {isAdmin && (
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="secondary" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEdit(tutorial); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="destructive" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); deleteTutorial.mutate(tutorial.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
                    <Badge variant="secondary" className="text-[10px] w-fit">
                      {categoryLabels[tutorial.category] ?? tutorial.category}
                    </Badge>
                    <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                      {tutorial.title}
                    </h3>
                    {tutorial.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{tutorial.description}</p>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1 mt-auto">
                      <Clock className="h-3 w-3" />
                      {new Date(tutorial.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {(filtered?.length ?? 0) === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-12">
                Nenhum tutorial disponível ainda. Em breve!
              </p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
