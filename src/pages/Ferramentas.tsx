import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Smartphone, Monitor, ExternalLink, Download, Shield, Cpu, Box,
  Gamepad2, Wrench, Plus, Pencil, Trash2, BookOpen, Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { LoginPromptDialog } from "@/components/LoginPromptDialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

const iconMap: Record<string, React.ReactNode> = {
  Gamepad2: <Gamepad2 className="h-6 w-6" />,
  Shield: <Shield className="h-6 w-6" />,
  Smartphone: <Smartphone className="h-6 w-6" />,
  Box: <Box className="h-6 w-6" />,
  Cpu: <Cpu className="h-6 w-6" />,
  Monitor: <Monitor className="h-6 w-6" />,
  Wrench: <Wrench className="h-6 w-6" />,
};

const categoryLabels: Record<string, string> = {
  "cheat-engine": "Editores de Memória",
  virtualizer: "Virtualizadores / Emuladores",
  utility: "Utilitários",
};

const platformIcon = (p: string) =>
  p === "android" ? <Smartphone className="h-4 w-4" /> : p === "pc" ? <Monitor className="h-4 w-4" /> : null;

const platformLabel = (p: string) =>
  p === "android" ? "Android" : p === "pc" ? "PC" : "Ambos";

interface ToolForm {
  name: string;
  description: string;
  platform: string;
  category: string;
  external_url: string;
  download_url: string;
  icon: string;
  tags: string;
  tutorial_id: string;
}

const emptyForm: ToolForm = {
  name: "", description: "", platform: "android", category: "utility",
  external_url: "", download_url: "", icon: "Wrench", tags: "", tutorial_id: "",
};

export default function Ferramentas() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ToolForm>(emptyForm);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const { data: tools = [], isLoading } = useQuery({
    queryKey: ["tools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tools")
        .select("*, tutorials(id, title)")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: tutorials = [] } = useQuery({
    queryKey: ["tutorials-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutorials")
        .select("id, title")
        .order("title");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const saveTool = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description,
        platform: form.platform,
        category: form.category,
        external_url: form.external_url || null,
        download_url: form.download_url || null,
        icon: form.icon,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        tutorial_id: form.tutorial_id && form.tutorial_id !== "none" ? form.tutorial_id : null,
      };
      if (editingId) {
        const { error } = await supabase.from("tools").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tools").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(editingId ? "Ferramenta atualizada!" : "Ferramenta adicionada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTool = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tools").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      toast.success("Ferramenta removida!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (tool: any) => {
    setEditingId(tool.id);
    setForm({
      name: tool.name,
      description: tool.description || "",
      platform: tool.platform,
      category: tool.category,
      external_url: tool.external_url || "",
      download_url: tool.download_url || "",
      icon: tool.icon || "Wrench",
      tags: (tool.tags || []).join(", "),
      tutorial_id: tool.tutorial_id || "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const filterTools = (platform?: string) =>
    platform ? tools.filter((t: any) => t.platform === platform || t.platform === "both") : tools;

  const renderGrid = (filtered: any[]) => {
    const grouped: Record<string, any[]> = {};
    filtered.forEach((t) => {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category].push(t);
    });

    return Object.entries(grouped).map(([cat, items]) => (
      <div key={cat} className="space-y-4">
        <h2 className="text-lg font-semibold font-mono text-neon-green flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          {categoryLabels[cat] ?? cat}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((tool: any, i: number) => (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="h-full border-border/50 hover:neon-border transition-all duration-300 group">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg bg-secondary text-neon-purple">
                      {iconMap[tool.icon] || <Wrench className="h-6 w-6" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="flex items-center gap-1 text-xs">
                        {platformIcon(tool.platform)}
                        {platformLabel(tool.platform)}
                      </Badge>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(tool)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteTool.mutate(tool.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className="font-bold text-base mb-1 group-hover:text-neon-purple transition-colors">
                    {tool.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3 flex-1">
                    {tool.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {(tool.tags || []).map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-auto">
                    {tool.external_url && (
                      user ? (
                        <Button size="sm" variant="outline" className="flex-1 text-xs" asChild>
                          <a href={tool.external_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            Site Oficial
                          </a>
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setShowLoginPrompt(true)}>
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          Site Oficial
                        </Button>
                      )
                    )}
                    {tool.download_url && (
                      user ? (
                        <Button size="sm" className="flex-1 text-xs neon-glow-purple" asChild>
                          <a href={tool.download_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3.5 w-3.5 mr-1" />
                            Download
                          </a>
                        </Button>
                      ) : (
                        <Button size="sm" className="flex-1 text-xs neon-glow-purple" onClick={() => setShowLoginPrompt(true)}>
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Download
                        </Button>
                      )
                    )}
                    {tool.tutorials && (
                      <Button size="sm" variant="secondary" className="flex-1 text-xs" asChild>
                        <a href={`/tutorials`}>
                          <BookOpen className="h-3.5 w-3.5 mr-1" />
                          Tutorial
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    ));
  };

  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold font-mono mb-2">
              <span className="text-neon-purple">Ferramentas</span> & Instalações
            </h1>
            <p className="text-muted-foreground">
              Tudo que você precisa para começar a moddar — editores de memória, virtualizadores e emuladores para Android e PC.
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
                  <DialogTitle>{editingId ? "Editar Ferramenta" : "Nova Ferramenta"}</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveTool.mutate();
                  }}
                >
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Plataforma</Label>
                      <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="android">Android</SelectItem>
                          <SelectItem value="pc">PC</SelectItem>
                          <SelectItem value="both">Ambos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cheat-engine">Editor de Memória</SelectItem>
                          <SelectItem value="virtualizer">Virtualizador</SelectItem>
                          <SelectItem value="utility">Utilitário</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Ícone</Label>
                    <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.keys(iconMap).map((k) => (
                          <SelectItem key={k} value={k}>{k}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Link Externo (Site Oficial)</Label>
                    <Input value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} placeholder="https://..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Link de Download</Label>
                    <Input value={form.download_url} onChange={(e) => setForm({ ...form, download_url: e.target.value })} placeholder="https://..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Tags (separadas por vírgula)</Label>
                    <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Root, Leve, Grátis" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tutorial Associado</Label>
                    <Select value={form.tutorial_id} onValueChange={(v) => setForm({ ...form, tutorial_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {tutorials.map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={saveTool.isPending}>
                    {saveTool.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    {editingId ? "Salvar" : "Adicionar"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="bg-secondary">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="android" className="flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5" /> Android
              </TabsTrigger>
              <TabsTrigger value="pc" className="flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5" /> PC
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-8 mt-6">
              {renderGrid(filterTools())}
            </TabsContent>
            <TabsContent value="android" className="space-y-8 mt-6">
              {renderGrid(filterTools("android"))}
            </TabsContent>
            <TabsContent value="pc" className="space-y-8 mt-6">
              {renderGrid(filterTools("pc"))}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}
