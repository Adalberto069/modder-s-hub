import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
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
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-neon-green flex items-center gap-3">
             <span className="w-8 h-[2px] bg-neon-green" />
             {categoryLabels[cat] ?? cat}
          </h2>
          <div className="flex-1 h-[1px] bg-white/10" />
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
              <Card className="h-full bg-[#050505] border-white/10 hover:border-neon-green/40 rounded-none group transition-all duration-500 overflow-hidden relative shadow-lg">
                <div className="absolute top-0 right-0 w-32 h-32 bg-neon-green/5 blur-[50px] group-hover:bg-neon-green/10 transition-colors" />
                
                <CardContent className="p-6 flex flex-col h-full relative z-10">
                  <div className="flex items-start justify-between mb-6">
                    <div className="p-3 bg-white/5 border border-white/10 group-hover:border-neon-green/40 text-neon-green transition-all shadow-xl shadow-black/20">
                      {iconMap[tool.icon] || <Wrench className="h-6 w-6" />}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline" className="bg-black/60 border-white/10 text-[9px] uppercase font-black tracking-widest gap-2 py-1.5 px-3 rounded-none">
                        {platformIcon(tool.platform)}
                        {platformLabel(tool.platform)}
                      </Badge>
                      {isAdmin && (
                        <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10 rounded-none" onClick={() => openEdit(tool)}>
                            <Pencil className="h-3.5 w-3.5 text-white/70" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-none" onClick={() => deleteTool.mutate(tool.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4 flex-1">
                    <h3 className="font-black text-xl tracking-tight uppercase group-hover:text-neon-green transition-colors">
                      {tool.name}
                    </h3>
                    <p className="text-xs font-mono text-muted-foreground/80 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-8">
                    {(tool.tags || []).map((tag: string) => (
                      <Badge key={tag} className="bg-white/5 border-white/10 text-[9px] font-black uppercase tracking-widest py-0.5 px-2 text-muted-foreground group-hover:bg-neon-green/10 group-hover:text-neon-green group-hover:border-neon-green/30 transition-colors rounded-none">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 mt-auto">
                    {tool.download_url ? (
                      <Button size="sm" className="w-full bg-neon-green hover:bg-neon-green/90 text-black font-black uppercase tracking-widest text-[10px] h-10 shadow-[0_0_15px_rgba(57,255,20,0.1)] transition-all hover:scale-[1.02] active:scale-95 rounded-none" asChild>
                        <a href={tool.download_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" />
                          Fazer Download
                        </a>
                      </Button>
                    ) : (
                       <Button size="sm" variant="outline" className="w-full border-white/10 text-muted-foreground/40 font-black uppercase tracking-widest text-[10px] h-10 pointer-events-none rounded-none">
                        Indisponível
                      </Button>
                    )}
                    
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {tool.external_url && (
                        <Button size="sm" variant="ghost" className="w-full bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[9px] h-9 transition-colors rounded-none" asChild>
                          <a href={tool.external_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5 mr-2" />
                            Site Oficial
                          </a>
                        </Button>
                      )}

                      {tool.tutorial_id && (
                        <Button size="sm" variant="outline" className={`w-full border-white/10 text-white/70 hover:text-white hover:bg-white/10 font-black uppercase tracking-widest text-[9px] h-9 rounded-none ${!tool.external_url ? 'col-span-2' : ''}`} asChild>
                          <a href={`/tutorial/${tool.tutorial_id}`}>
                            <BookOpen className="h-3.5 w-3.5 mr-2" />
                            Ver Guia
                          </a>
                        </Button>
                      )}
                    </div>
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
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8 relative overflow-hidden p-8 sm:p-12 border border-white/10 bg-[#030304] mb-12">
          {/* Background Grid */}
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10 mix-blend-overlay" />
          <div className="absolute top-0 right-0 w-full h-[2px] bg-gradient-to-r from-transparent via-neon-green/50 to-transparent" />
          <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-neon-green/10 blur-[100px] rounded-full" />
          
          <div className="relative z-10 space-y-6 max-w-2xl">
             <div className="flex items-center gap-3">
                <Badge className="bg-[#050505] text-neon-green border border-neon-green/30 text-[10px] font-black tracking-widest uppercase py-1.5 px-4 rounded-none">
                  Hidden Arsenal
                </Badge>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-neon-green" />
                  <div className="w-1.5 h-1.5 bg-neon-green/40" />
                  <div className="w-1.5 h-1.5 bg-neon-green/20" />
                </div>
             </div>
             
             <div className="space-y-4">
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter uppercase leading-none">
                Hidden <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-green to-white drop-shadow-[0_0_15px_rgba(57,255,20,0.4)]">
                  Toolkit
                </span>
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground font-mono tracking-widest uppercase flex items-start sm:items-center gap-3 border-l-2 border-neon-green/50 pl-4 py-1">
                <Zap className="h-5 w-5 text-neon-green shrink-0" />
                <span>As ferramentas homologadas pela elite do modding. Baixe emuladores, GG e utilitários limpos.</span>
              </p>
             </div>
          </div>

          {isAdmin && (
            <div className="relative z-10 w-full md:w-auto mt-4 md:mt-0">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNew} className="w-full md:w-auto h-14 px-8 bg-neon-purple text-white hover:bg-neon-purple/90 font-black uppercase tracking-widest text-xs rounded-none shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all hover:-translate-y-1 gap-3">
                    <Terminal className="h-5 w-5" /> Novo Software
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl bg-[#030304] border-white/10 p-0 overflow-hidden font-mono text-white rounded-none">
                  <div className="p-6 sm:p-8 border-b border-white/10 bg-[#050505]">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-black tracking-tighter uppercase flex items-center gap-3">
                        <Terminal className="h-6 w-6 text-neon-purple" />
                        Configurar Toolkit
                      </DialogTitle>
                    </DialogHeader>
                  </div>
                  
                  <div className="p-6 sm:p-8 max-h-[65vh] overflow-y-auto custom-scrollbar bg-[#030304]">
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
                          <Label className="text-[10px] uppercase font-black tracking-widest opacity-60">Nome Operacional</Label>
                          <Input 
                            value={form.name} 
                            onChange={(e) => setForm({ ...form, name: e.target.value })} 
                            required 
                            placeholder="GameGuardian, F1 VM, etc..."
                            className="bg-[#050505] border-white/10 h-12 rounded-none focus-visible:ring-neon-purple"
                          />
                        </div>

                        <div className="space-y-3 col-span-2">
                          <Label className="text-[10px] uppercase font-black tracking-widest opacity-60">Resumo Técnico</Label>
                          <Textarea 
                            value={form.description} 
                            onChange={(e) => setForm({ ...form, description: e.target.value })} 
                            className="bg-[#050505] border-white/10 min-h-[100px] resize-none rounded-none focus-visible:ring-neon-purple"
                            placeholder="Descreva as capacidades desta ferramenta..."
                          />
                        </div>

                        <div className="space-y-3">
                          <Label className="text-[10px] uppercase font-black tracking-widest opacity-60">Ambiente</Label>
                          <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                             <SelectTrigger className="bg-[#050505] border-white/10 h-12 rounded-none"><SelectValue /></SelectTrigger>
                             <SelectContent className="bg-[#050505] border-white/10 rounded-none">
                               <SelectItem value="android">Android</SelectItem>
                               <SelectItem value="pc">PC</SelectItem>
                               <SelectItem value="both">Híbrido (Ambos)</SelectItem>
                             </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-[10px] uppercase font-black tracking-widest opacity-60">Classificação</Label>
                          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                             <SelectTrigger className="bg-[#050505] border-white/10 h-12 rounded-none"><SelectValue /></SelectTrigger>
                             <SelectContent className="bg-[#050505] border-white/10 rounded-none">
                               <SelectItem value="cheat-engine">Mecanismo de Memória</SelectItem>
                               <SelectItem value="virtualizer">Emulação / Virtualização</SelectItem>
                               <SelectItem value="utility">Utilitário de Sistema</SelectItem>
                             </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-[10px] uppercase font-black tracking-widest opacity-60">Ícone no Terminal</Label>
                          <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                             <SelectTrigger className="bg-[#050505] border-white/10 h-12 rounded-none"><SelectValue /></SelectTrigger>
                             <SelectContent className="bg-[#050505] border-white/10 rounded-none">
                               {Object.keys(iconMap).map((k) => (
                                 <SelectItem key={k} value={k}>{k}</SelectItem>
                               ))}
                             </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-[10px] uppercase font-black tracking-widest opacity-60">Doc. Relacionada (Guia)</Label>
                          <Select value={form.tutorial_id} onValueChange={(v) => setForm({ ...form, tutorial_id: v })}>
                             <SelectTrigger className="bg-[#050505] border-white/10 h-12 rounded-none"><SelectValue placeholder="Nenhum vínculo" /></SelectTrigger>
                             <SelectContent className="bg-[#050505] border-white/10 rounded-none">
                               <SelectItem value="none">-- Desvincular --</SelectItem>
                               {tutorials.map((t: any) => (
                                 <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                               ))}
                             </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="space-y-3 p-4 border border-white/10 bg-[#050505]">
                        <Label className="text-[10px] uppercase font-black tracking-widest opacity-60 flex items-center gap-2">
                          <Zap className="h-3 w-3 text-neon-purple" /> Vetores de Conexão
                        </Label>
                        <div className="grid sm:grid-cols-2 gap-4 mt-2!">
                          <Input 
                            value={form.external_url} 
                            onChange={(e) => setForm({ ...form, external_url: e.target.value })} 
                            placeholder="Site do Autor (https://...)" 
                            className="bg-[#030304] border-white/10 h-12 rounded-none focus-visible:ring-neon-purple"
                          />
                          <Input 
                            value={form.download_url} 
                            onChange={(e) => setForm({ ...form, download_url: e.target.value })} 
                            placeholder="Download Direto (https://...)" 
                            className="bg-[#030304] border-white/10 h-12 rounded-none focus-visible:ring-neon-purple"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-[10px] uppercase font-black tracking-widest opacity-60">Tags (Vírgula)</Label>
                        <Input 
                          value={form.tags} 
                          onChange={(e) => setForm({ ...form, tags: e.target.value })} 
                          placeholder="root, 64-bit, bypass..." 
                          className="bg-[#050505] border-white/10 h-12 rounded-none focus-visible:ring-neon-purple"
                        />
                      </div>

                      <Button type="submit" disabled={saveTool.isPending} className="w-full h-14 bg-neon-purple hover:bg-neon-purple/90 text-white font-black uppercase tracking-widest text-xs rounded-none shadow-[0_0_15px_rgba(168,85,247,0.3)]">
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
             <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Iniciando protocolo de leitura...</p>
          </div>
        ) : tools.length > 0 ? (
          <div className="space-y-8">
            {renderGrid(tools)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center border border-white/5 bg-[#050505]">
             <Terminal className="h-12 w-12 text-muted-foreground/30 mb-6" />
             <p className="text-xl font-black uppercase tracking-tight text-white mb-2">Sem Dados</p>
             <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Nenhuma ferramenta foi injetada no banco de dados.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
