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
  Terminal, Zap, Sparkles, Filter
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

  const filterTools = (platform?: string) =>
    platform ? tools.filter((t: any) => t.platform === platform || t.platform === "both") : tools;

  const renderGrid = (filtered: any[]) => {
    const grouped: Record<string, any[]> = {};
    filtered.forEach((t) => {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category].push(t);
    });

    return Object.entries(grouped).map(([cat, items]) => (
      <div key={cat} className="space-y-6 pt-6">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-neon-green/80 flex items-center gap-3">
             <span className="w-8 h-[1px] bg-neon-green/30" />
             {categoryLabels[cat] ?? cat}
          </h2>
          <div className="flex-1 h-[1px] bg-white/5" />
        </div>
        
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((tool: any, i: number) => (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -5 }}
              className="h-full"
            >
              <Card className="h-full bg-[#0a0a0c]/40 backdrop-blur-xl border-white/5 hover:border-neon-purple/30 group transition-all duration-500 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/5 blur-[60px] rounded-full group-hover:bg-neon-purple/10 transition-colors" />
                
                <CardContent className="p-6 flex flex-col h-full relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 group-hover:border-neon-purple/40 text-neon-purple transition-all duration-500 shadow-xl shadow-black/20">
                      {iconMap[tool.icon] || <Wrench className="h-6 w-6" />}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline" className="bg-black/40 border-white/10 text-[10px] uppercase font-black tracking-widest gap-2 py-1 px-3">
                        {platformIcon(tool.platform)}
                        {platformLabel(tool.platform)}
                      </Badge>
                      {isAdmin && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10" onClick={() => openEdit(tool)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10" onClick={() => deleteTool.mutate(tool.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4 flex-1">
                    <h3 className="font-black text-lg tracking-tighter uppercase italic group-hover:text-neon-purple transition-colors">
                      {tool.name}
                    </h3>
                    <p className="text-xs text-muted-foreground/80 font-medium leading-relaxed">
                      {tool.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {(tool.tags || []).map((tag: string) => (
                      <Badge key={tag} className="bg-white/5 border-none text-[9px] font-black uppercase tracking-tighter py-0 px-2 text-muted-foreground/60 group-hover:bg-neon-purple/10 group-hover:text-neon-purple transition-colors">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    {tool.download_url ? (
                      <Button size="sm" className="bg-neon-purple hover:bg-neon-purple/90 text-white font-black uppercase tracking-widest text-[9px] h-9 shadow-lg shadow-neon-purple/20 transition-all hover:scale-105 active:scale-95" asChild>
                        <a href={tool.download_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3.5 w-3.5 mr-2" />
                          Baixar agora
                        </a>
                      </Button>
                    ) : (
                       <Button size="sm" variant="outline" className="border-white/10 text-muted-foreground/40 font-black uppercase tracking-widest text-[9px] h-9 pointer-events-none">
                        Indisponível
                      </Button>
                    )}
                    
                    {tool.external_url && (
                      <Button size="sm" variant="ghost" className="hover:bg-white/5 text-muted-foreground hover:text-white font-black uppercase tracking-widest text-[9px] h-9 transition-colors" asChild>
                        <a href={tool.external_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-2" />
                          Site Oficial
                        </a>
                      </Button>
                    )}

                    {tool.tutorial_id && (
                      <Button size="sm" variant="outline" className="col-span-2 mt-1 border-neon-cyan/20 bg-neon-cyan/5 text-neon-cyan hover:bg-neon-cyan/10 font-black uppercase tracking-widest text-[9px] h-9 border-dashed" asChild>
                        <a href={`/tutorial/${tool.tutorial_id}`}>
                          <BookOpen className="h-3.5 w-3.5 mr-2" />
                          Ver tutorial completo
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
      <div className="container py-12 space-y-12">
        {/* Header Elite */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8 relative overflow-hidden p-8 rounded-3xl border border-white/5 bg-[#0a0a0c]/20">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-neon-purple/50 to-transparent" />
          <div className="absolute -left-20 -top-20 w-64 h-64 bg-neon-purple/10 blur-[100px] rounded-full" />
          
          <div className="relative z-10 space-y-4">
             <div className="flex items-center gap-3">
                <Badge className="bg-neon-purple/10 text-neon-purple border border-neon-purple/20 text-[10px] font-black tracking-[0.2em] uppercase py-1 px-4 italic">
                  Nexus Intelligence
                </Badge>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-neon-purple" />
                  <div className="w-1.5 h-1.5 rounded-full bg-neon-purple/40" />
                  <div className="w-1.5 h-1.5 rounded-full bg-neon-purple/20" />
                </div>
             </div>
             
             <div className="space-y-1">
              <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase italic">
                Nexus <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-cyan drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]">Toolkit</span>
              </h1>
              <p className="text-sm text-muted-foreground font-mono tracking-widest uppercase flex items-center gap-3">
                <Zap className="h-4 w-4 text-neon-purple animate-pulse" /> Arsenal Completo para Desenvolvimento de Elite
              </p>
             </div>
          </div>

          {isAdmin && (
            <div className="relative z-10">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNew} className="h-12 px-8 bg-white text-black hover:bg-white/90 font-black uppercase tracking-widest text-xs rounded-xl shadow-xl shadow-white/10 transition-all hover:scale-105 active:scale-95 gap-2">
                    <Plus className="h-5 w-5" /> Adicionar Ferramenta
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl bg-[#0a0a0c]/95 backdrop-blur-2xl border-white/10 shadow-3xl p-0 overflow-hidden">
                  <div className="p-8 border-b border-white/5">
                    <DialogHeader>
                      <DialogTitle className="text-3xl font-black tracking-tighter uppercase italic">Configurar Nexus Gear</DialogTitle>
                    </DialogHeader>
                  </div>
                  
                  <div className="p-8 max-h-[65vh] overflow-y-auto custom-scrollbar">
                    <form
                      id="tool-form"
                      className="space-y-6"
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveTool.mutate();
                      }}
                    >
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2 col-span-2">
                          <Label className="text-[10px] uppercase font-black tracking-widest opacity-60 italic">Identificação</Label>
                          <Input 
                            value={form.name} 
                            onChange={(e) => setForm({ ...form, name: e.target.value })} 
                            required 
                            placeholder="Nome da ferramenta..."
                            className="bg-white/5 border-white/10 h-12"
                          />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label className="text-[10px] uppercase font-black tracking-widest opacity-60 italic">Resumo Técnico</Label>
                          <Textarea 
                            value={form.description} 
                            onChange={(e) => setForm({ ...form, description: e.target.value })} 
                            className="bg-white/5 border-white/10 min-h-[100px] resize-none"
                            placeholder="Descreva as capacidades desta ferramenta..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black tracking-widest opacity-60 italic">Plataforma</Label>
                          <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                            <SelectTrigger className="bg-white/5 border-white/10 h-12"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#0a0a0c] border-white/10">
                              <SelectItem value="android">Android</SelectItem>
                              <SelectItem value="pc">PC</SelectItem>
                              <SelectItem value="both">Ambos (Universal)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black tracking-widest opacity-60 italic">Categoria</Label>
                          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                            <SelectTrigger className="bg-white/5 border-white/10 h-12"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#0a0a0c] border-white/10">
                              <SelectItem value="cheat-engine">Editor de Memória</SelectItem>
                              <SelectItem value="virtualizer">Virtualizador</SelectItem>
                              <SelectItem value="utility">Utilitário do Sistema</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black tracking-widest opacity-60 italic">Ícone Visual</Label>
                          <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                            <SelectTrigger className="bg-white/5 border-white/10 h-12"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#0a0a0c] border-white/10">
                              {Object.keys(iconMap).map((k) => (
                                <SelectItem key={k} value={k}>{k}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black tracking-widest opacity-60 italic">Tutorial Nexus</Label>
                          <Select value={form.tutorial_id} onValueChange={(v) => setForm({ ...form, tutorial_id: v })}>
                            <SelectTrigger className="bg-white/5 border-white/10 h-12"><SelectValue placeholder="Nenhum vinculado" /></SelectTrigger>
                            <SelectContent className="bg-[#0a0a0c] border-white/10">
                              <SelectItem value="none">Nenhum vínculo</SelectItem>
                              {tutorials.map((t: any) => (
                                <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black tracking-widest opacity-60 italic">URLs de Transmissão</Label>
                        <div className="grid gap-3">
                          <Input 
                            value={form.external_url} 
                            onChange={(e) => setForm({ ...form, external_url: e.target.value })} 
                            placeholder="Site oficial (https://...)" 
                            className="bg-white/5 border-white/10 h-12"
                          />
                          <Input 
                            value={form.download_url} 
                            onChange={(e) => setForm({ ...form, download_url: e.target.value })} 
                            placeholder="Link direto para download (https://...)" 
                            className="bg-white/5 border-white/10 h-12 text-neon-purple"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black tracking-widest opacity-60 italic">Tags de Indexação</Label>
                        <Input 
                          value={form.tags} 
                          onChange={(e) => setForm({ ...form, tags: e.target.value })} 
                          placeholder="Root, Leve, Grátis..." 
                          className="bg-white/5 border-white/10 h-12"
                        />
                      </div>
                    </form>
                  </div>

                  <div className="p-8 bg-white/5 border-t border-white/5">
                    <Button 
                      form="tool-form"
                      type="submit" 
                      className="w-full h-14 bg-neon-purple hover:bg-neon-purple/90 text-white font-black uppercase tracking-[0.3em] text-xs shadow-2xl shadow-neon-purple/20 transition-all hover:scale-[1.02]" 
                      disabled={saveTool.isPending}
                    >
                      {saveTool.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : editingId ? "Atualizar Registro" : "Registrar Ferramenta Elite"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Content Section */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
            <Loader2 className="h-12 w-12 animate-spin text-neon-purple" />
            <p className="text-xs font-black uppercase tracking-[0.4em]">Sincronizando Toolkit...</p>
          </div>
        ) : (
          <div className="space-y-12">
            <Tabs defaultValue="all" className="w-full">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                 <TabsList className="bg-transparent h-auto p-0 gap-8">
                  <TabsTrigger value="all" className="p-0 h-10 bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-white text-muted-foreground/60 font-black uppercase tracking-widest text-[11px] relative group border-none">
                    <span className="flex items-center gap-2 px-1 relative z-10">
                       <Zap className="h-3 w-3" /> Todos
                    </span>
                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-neon-purple scale-x-0 group-data-[state=active]:scale-x-100 transition-transform origin-left" />
                  </TabsTrigger>
                  <TabsTrigger value="android" className="p-0 h-10 bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-white text-muted-foreground/60 font-black uppercase tracking-widest text-[11px] relative group border-none">
                    <span className="flex items-center gap-2 px-1 relative z-10">
                       <Smartphone className="h-3 w-3" /> Android
                    </span>
                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-neon-purple scale-x-0 group-data-[state=active]:scale-x-100 transition-transform origin-left" />
                  </TabsTrigger>
                  <TabsTrigger value="pc" className="p-0 h-10 bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-white text-muted-foreground/60 font-black uppercase tracking-widest text-[11px] relative group border-none">
                    <span className="flex items-center gap-2 px-1 relative z-10">
                       <Monitor className="h-3 w-3" /> PC Hardware
                    </span>
                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-neon-purple scale-x-0 group-data-[state=active]:scale-x-100 transition-transform origin-left" />
                  </TabsTrigger>
                </TabsList>

                <div className="hidden sm:flex items-center gap-3 text-muted-foreground/40 font-mono text-[10px] uppercase tracking-tighter">
                   <Filter className="h-3 w-3" /> Filtrando por categoria de sistema
                </div>
              </div>

              <AnimatePresence mode="wait">
                <TabsContent value="all" className="mt-8">
                  {renderGrid(filterTools())}
                </TabsContent>
                <TabsContent value="android" className="mt-8">
                  {renderGrid(filterTools("android"))}
                </TabsContent>
                <TabsContent value="pc" className="mt-8">
                  {renderGrid(filterTools("pc"))}
                </TabsContent>
              </AnimatePresence>
            </Tabs>
            
            {/* Elite Footer Info */}
            <div className="pt-24 pb-12 text-center space-y-4">
               <div className="flex items-center justify-center gap-2 text-neon-purple/30">
                  <span className="w-12 h-[1px] bg-current" />
                  <Sparkles className="h-4 w-4" />
                  <span className="w-12 h-[1px] bg-current" />
               </div>
               <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground/30">
                  Nexus Gear Protection System Loaded
               </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
