import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Smartphone, Monitor, ExternalLink, Download, Shield, Cpu, Box,
  Gamepad2, Wrench, Plus, Pencil, Trash2, BookOpen, Terminal, Zap
} from "lucide-react";
import { motion } from "framer-motion";
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
    enabled: !!isAdmin,
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
      toast.success(editingId ? "Ferramenta atualizada! 💠" : "Ferramenta adicionada! 💠");
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
      toast.success("Ferramenta removida! 🗑️");
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

  const renderGrid = (filtered: any[]) => {
    const grouped: Record<string, any[]> = {};
    filtered.forEach((t) => {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category].push(t);
    });

    return Object.entries(grouped).map(([cat, items]) => (
      <div key={cat} className="space-y-6 pt-6 mb-12">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-bold   text-neon-green flex items-center gap-3">
             <span className="w-8 h-[2px] bg-neon-green" />
             {categoryLabels[cat] ?? cat}
          </h2>
          <div className="flex-1 h-[1px] bg-foreground/10" />
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((tool: any, i: number) => (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -5 }}
              className="h-full"
            >
              <Card className="h-full bg-card border-border hover:border-neon-green/40 rounded-md group transition-all duration-500 overflow-hidden relative shadow-lg">
                
                <CardContent className="p-6 flex flex-col h-full relative z-10">
                  <div className="flex items-start justify-between mb-6">
                    <div className="p-3 bg-foreground/5 border border-border group-hover:border-neon-green/40 text-neon-green transition-all shadow-xl shadow-none">
                      {iconMap[tool.icon] || <Wrench className="h-6 w-6" />}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline" className="bg-glass/60 border-border text-xs  font-bold  gap-2 py-1.5 px-3 rounded-md">
                        {platformIcon(tool.platform)}
                        {platformLabel(tool.platform)}
                      </Badge>
                      {isAdmin && (
                        <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Button aria-label="Editar ferramenta" size="icon" variant="ghost" className="h-8 w-8 hover:bg-foreground/10 rounded-md" onClick={() => openEdit(tool)}>
                            <Pencil className="h-3.5 w-3.5 text-foreground/70" />
                          </Button>
                          <Button aria-label="Excluir ferramenta" size="icon" variant="ghost" className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-md" onClick={() => deleteTool.mutate(tool.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4 flex-1">
                    <h3 className="font-bold text-xl tracking-tight  group-hover:text-neon-green transition-colors">
                      {tool.name}
                    </h3>
                    <p className="text-xs font-sans text-muted-foreground/80 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-8">
                    {(tool.tags || []).map((tag: string) => (
                      <Badge key={tag} className="bg-foreground/5 border-border text-xs font-bold   py-0.5 px-2 text-muted-foreground group-hover:bg-neon-green/10 group-hover:text-neon-green group-hover:border-neon-green/30 transition-colors rounded-md">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 mt-auto">
                    {tool.download_url && (
                      <Button size="sm" className="w-full bg-neon-green hover:bg-neon-green/90 text-primary-foreground font-bold   text-xs h-10 shadow-neon transition-all hover:scale-[1.02] active:scale-95 rounded-md" asChild>
                        <a href={tool.download_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" />
                          Fazer Download
                        </a>
                      </Button>
                    )}

                    {(tool.external_url || tool.tutorial_id) && (
                      <div className={`grid gap-2 ${tool.download_url ? "mt-1" : ""} ${tool.external_url && tool.tutorial_id ? "grid-cols-2" : "grid-cols-1"}`}>
                        {tool.external_url && (
                          <Button size="sm" variant="ghost" className="w-full bg-foreground/5 hover:bg-foreground/10 text-foreground font-bold   text-xs h-9 transition-colors rounded-md" asChild>
                            <a href={tool.external_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5 mr-2" />
                              Site Oficial
                            </a>
                          </Button>
                        )}

                        {tool.tutorial_id && (
                          <Button size="sm" variant="outline" className="w-full border-border text-foreground/70 hover:text-foreground hover:bg-foreground/10 font-bold   text-xs h-9 rounded-md" asChild>
                            <a href={`/tutorial/${tool.tutorial_id}`}>
                              <BookOpen className="h-3.5 w-3.5 mr-2" />
                              Ver Guia
                            </a>
                          </Button>
                        )}
                      </div>
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
      <div className="container py-12 sm:py-20 max-w-7xl">
        {/* Header Terminal */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8 relative border-b border-border pb-8 mb-10">
          <PageHeader eyebrow="HIDDENMOD / FERRAMENTAS" title={<>Prepare seu <span className="text-primary">jogo.</span></>} description="Game Guardian, emuladores e utilitários para Android e PC." />

          {isAdmin && (
            <div className="relative z-10 w-full md:w-auto mt-4 md:mt-0">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNew} className="w-full md:w-auto h-14 px-8 bg-primary text-primary-foreground hover:bg-neon-purple/90 font-bold   text-xs rounded-md shadow-neon transition-all hover:-translate-y-1 gap-3">
                    <Terminal className="h-5 w-5" /> Nova ferramenta
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl bg-background border-border p-0 overflow-hidden font-sans text-foreground rounded-md">
                  <div className="p-6 sm:p-8 border-b border-border bg-card">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold tracking-tighter  flex items-center gap-3">
                        <Terminal className="h-6 w-6 text-neon-purple" />
                        Editar ferramenta
                      </DialogTitle>
                    </DialogHeader>
                  </div>
                  
                  <div className="p-6 sm:p-8 max-h-[65vh] overflow-y-auto custom-scrollbar bg-background">
                    <form
                      id="tool-form"
                      className="space-y-8"
                      onSubmit={(e) => {
                         e.preventDefault();
                         saveTool.mutate();
                      }}
                    >
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3 col-span-2">
                          <Label className="text-xs  font-bold  opacity-60">Nome</Label>
                          <Input 
                            value={form.name} 
                            onChange={(e) => setForm({ ...form, name: e.target.value })} 
                            required 
                            placeholder="GameGuardian, F1 VM, etc..."
                            className="bg-card border-border h-12 rounded-md focus-visible:ring-neon-purple"
                          />
                        </div>

                        <div className="space-y-3 col-span-2">
                          <Label className="text-xs  font-bold  opacity-60">Descrição</Label>
                          <Textarea 
                            value={form.description} 
                            onChange={(e) => setForm({ ...form, description: e.target.value })} 
                            className="bg-card border-border min-h-[100px] resize-none rounded-md focus-visible:ring-neon-purple"
                            placeholder="Descreva as capacidades desta ferramenta..."
                          />
                        </div>

                        <div className="space-y-3">
                          <Label className="text-xs  font-bold  opacity-60">Ambiente</Label>
                          <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                             <SelectTrigger className="bg-card border-border h-12 rounded-md"><SelectValue /></SelectTrigger>
                             <SelectContent className="bg-card border-border rounded-md">
                               <SelectItem value="android">Android</SelectItem>
                               <SelectItem value="pc">PC</SelectItem>
                               <SelectItem value="both">Híbrido (Ambos)</SelectItem>
                             </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-xs  font-bold  opacity-60">Classificação</Label>
                          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                             <SelectTrigger className="bg-card border-border h-12 rounded-md"><SelectValue /></SelectTrigger>
                             <SelectContent className="bg-card border-border rounded-md">
                               <SelectItem value="cheat-engine">Mecanismo de Memória</SelectItem>
                               <SelectItem value="virtualizer">Emulação / Virtualização</SelectItem>
                               <SelectItem value="utility">Utilitário de Sistema</SelectItem>
                             </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-xs  font-bold  opacity-60">Ícone</Label>
                          <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                             <SelectTrigger className="bg-card border-border h-12 rounded-md"><SelectValue /></SelectTrigger>
                             <SelectContent className="bg-card border-border rounded-md">
                               {Object.keys(iconMap).map((k) => (
                                 <SelectItem key={k} value={k}>{k}</SelectItem>
                               ))}
                             </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-xs  font-bold  opacity-60">Doc. Relacionada (Guia)</Label>
                          <Select value={form.tutorial_id} onValueChange={(v) => setForm({ ...form, tutorial_id: v })}>
                             <SelectTrigger className="bg-card border-border h-12 rounded-md"><SelectValue placeholder="Nenhum vínculo" /></SelectTrigger>
                             <SelectContent className="bg-card border-border rounded-md">
                               <SelectItem value="none">-- Desvincular --</SelectItem>
                               {tutorials.map((t: any) => (
                                 <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                               ))}
                             </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="space-y-3 p-4 border border-border bg-card">
                        <Label className="text-xs  font-bold  opacity-60 flex items-center gap-2">
                          <Zap className="h-3 w-3 text-neon-purple" /> Links
                        </Label>
                        <div className="grid sm:grid-cols-2 gap-4 mt-2!">
                          <Input 
                            value={form.external_url} 
                            onChange={(e) => setForm({ ...form, external_url: e.target.value })} 
                            placeholder="Site do Autor (https://...)" 
                            className="bg-background border-border h-12 rounded-md focus-visible:ring-neon-purple"
                          />
                          <Input 
                            value={form.download_url} 
                            onChange={(e) => setForm({ ...form, download_url: e.target.value })} 
                            placeholder="Download Direto (https://...)" 
                            className="bg-background border-border h-12 rounded-md focus-visible:ring-neon-purple"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-xs  font-bold  opacity-60">Tags (Vírgula)</Label>
                        <Input 
                          value={form.tags} 
                          onChange={(e) => setForm({ ...form, tags: e.target.value })} 
                          placeholder="root, 64-bit, bypass..." 
                          className="bg-card border-border h-12 rounded-md focus-visible:ring-neon-purple"
                        />
                      </div>

                      <Button type="submit" disabled={saveTool.isPending} className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold   text-xs rounded-md shadow-neon">
                        {saveTool.isPending ? "Processando..." : (editingId ? "Atualizar Software" : "Publicar Software")}
                      </Button>
                    </form>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Content Render */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
             <div className="w-12 h-12 rounded-full border-2 border-neon-green border-t-transparent animate-spin" />
             <p className="text-sm font-sans text-muted-foreground  ">Carregando ferramentas...</p>
          </div>
        ) : tools.length > 0 ? (
          <div className="space-y-8">
            {renderGrid(tools)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center border border-border/60 bg-card">
             <Terminal className="h-12 w-12 text-muted-foreground/30 mb-6" />
             <p className="text-xl font-bold  tracking-tight text-foreground mb-2">Nenhuma ferramenta</p>
             <p className="text-sm font-sans text-muted-foreground  ">Nenhuma ferramenta disponível no momento.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
