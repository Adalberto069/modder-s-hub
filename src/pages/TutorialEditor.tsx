import { useState, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Eye, Send, Plus, Trash2, Loader2,
  FileText, Video, BookOpen, Lightbulb, AlertTriangle,
  Image, Code, Link2, GripVertical, ChevronRight, Sparkles, Wand2,
} from "lucide-react";
import { motion } from "framer-motion";
import { validateFileWithToast } from "@/lib/secure-upload";

const CATEGORIES = [
  { value: "geral", label: "Geral", icon: "📖" },
  { value: "scripts-lua", label: "Scripts Lua", icon: "💻" },
  { value: "root", label: "Root", icon: "🔓" },
  { value: "virtualizado", label: "Virtualizado", icon: "📱" },
  { value: "iniciante", label: "Iniciante", icon: "🌱" },
];

const TAG_SUGGESTIONS = [
  "Android", "iOS", "Lua", "Root", "Sem Root", "Iniciante", "Avançado",
  "Game Guardian", "Virtual Space", "Parallel Space", "APK Mod",
];

interface ContentBlock {
  id: string;
  type: "text" | "step" | "code" | "image" | "tip" | "warning" | "video";
  content: string;
  language?: string;
  imageUrl?: string;
  stepNumber?: number;
}

interface TutorialFormData {
  title: string;
  description: string;
  category: string;
  tags: string[];
  thumbnail_url: string;
  video_url: string;
  contentBlocks: ContentBlock[];
  tips: string[];
  troubleshooting: { problem: string; solution: string }[];
  relatedTutorialIds: string[];
}

const createEmptyBlock = (type: ContentBlock["type"]): ContentBlock => ({
  id: crypto.randomUUID(),
  type,
  content: "",
});

const emptyForm: TutorialFormData = {
  title: "",
  description: "",
  category: "geral",
  tags: [],
  thumbnail_url: "",
  video_url: "",
  contentBlocks: [createEmptyBlock("text")],
  tips: [""],
  troubleshooting: [{ problem: "", solution: "" }],
  relatedTutorialIds: [],
};

/** Serialize content blocks to the markdown-ish format the ContentRenderer understands */
function serializeContent(form: TutorialFormData): string {
  const parts: string[] = [];

  // Content blocks
  let stepCounter = 0;
  form.contentBlocks.forEach((block) => {
    if (!block.content.trim() && block.type !== "image" && block.type !== "video") return;
    switch (block.type) {
      case "text":
        parts.push(block.content);
        break;
      case "step":
        stepCounter++;
        parts.push(`${stepCounter}. ${block.content}`);
        break;
      case "code":
        parts.push(`\`\`\`${block.language || ""}\n${block.content}\n\`\`\``);
        break;
      case "image":
        if (block.imageUrl) parts.push(`![${block.content || "imagem"}](${block.imageUrl})`);
        break;
      case "video":
        if (block.content.trim()) parts.push(`[video](${block.content.trim()})`);
        break;
      case "tip":
        parts.push(`💡 ${block.content}`);
        break;
      case "warning":
        parts.push(`⚠️ ${block.content}`);
        break;
    }
  });

  // Tips section
  const validTips = form.tips.filter((t) => t.trim());
  if (validTips.length > 0) {
    parts.push("");
    parts.push("## Dicas");
    validTips.forEach((tip) => parts.push(`💡 ${tip}`));
  }

  // Troubleshooting section
  const validTrouble = form.troubleshooting.filter((t) => t.problem.trim() || t.solution.trim());
  if (validTrouble.length > 0) {
    parts.push("");
    parts.push("## Solução de Problemas");
    validTrouble.forEach((t) => {
      if (t.problem.trim()) parts.push(`⚠️ **${t.problem}**`);
      if (t.solution.trim()) parts.push(`${t.solution}`);
    });
  }

  return parts.join("\n");
}

/** Parse existing content back into blocks (best-effort) */
function parseContentToBlocks(content: string): ContentBlock[] {
  if (!content) return [createEmptyBlock("text")];
  const blocks: ContentBlock[] = [];
  const lines = content.split("\n");
  let i = 0;
  let textAccum = "";

  const flushText = () => {
    if (textAccum.trim()) {
      blocks.push({ id: crypto.randomUUID(), type: "text", content: textAccum.trim() });
      textAccum = "";
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip section headers that are tips/troubleshooting (handled separately)
    if (trimmed === "## Dicas" || trimmed === "## Solução de Problemas") {
      flushText();
      break; // Stop parsing main content blocks
    }

    if (trimmed.startsWith("```")) {
      flushText();
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ id: crypto.randomUUID(), type: "code", content: codeLines.join("\n"), language: lang });
      i++;
      continue;
    }

    if (trimmed.startsWith("💡")) {
      flushText();
      blocks.push({ id: crypto.randomUUID(), type: "tip", content: trimmed.replace(/^💡\s*/, "") });
      i++;
      continue;
    }

    if (trimmed.startsWith("⚠️")) {
      flushText();
      blocks.push({ id: crypto.randomUUID(), type: "warning", content: trimmed.replace(/^⚠️\s*/, "") });
      i++;
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      flushText();
      blocks.push({ id: crypto.randomUUID(), type: "step", content: trimmed.replace(/^\d+\.\s*/, "") });
      i++;
      continue;
    }

    textAccum += (textAccum ? "\n" : "") + line;
    i++;
  }
  flushText();

  return blocks.length > 0 ? blocks : [createEmptyBlock("text")];
}

function parseTips(content: string): string[] {
  const match = content.match(/## Dicas\n([\s\S]*?)(?=\n## |$)/);
  if (!match) return [""];
  return match[1].split("\n").filter((l) => l.trim().startsWith("💡")).map((l) => l.replace(/^💡\s*/, ""));
}

function parseTroubleshooting(content: string): { problem: string; solution: string }[] {
  const match = content.match(/## Solução de Problemas\n([\s\S]*?)$/);
  if (!match) return [{ problem: "", solution: "" }];
  const lines = match[1].split("\n").filter((l) => l.trim());
  const items: { problem: string; solution: string }[] = [];
  let current: { problem: string; solution: string } | null = null;
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("⚠️")) {
      if (current) items.push(current);
      current = { problem: trimmed.replace(/^⚠️\s*\*\*|\*\*$/g, ""), solution: "" };
    } else if (current) {
      current.solution = (current.solution ? current.solution + "\n" : "") + trimmed;
    }
  });
  if (current) items.push(current);
  return items.length > 0 ? items : [{ problem: "", solution: "" }];
}

// ─── Section Card wrapper ───
function SectionCard({ title, description, icon: Icon, children, delay = 0, variant = "purple" }: {
  title: string;
  description?: string;
  icon: any;
  children: React.ReactNode;
  delay?: number;
  variant?: "purple" | "green" | "cyan";
}) {
  const variantStyles = {
    purple: "border-neon-purple/20 shadow-neon-purple/5 hover:border-neon-purple/40",
    green: "border-neon-green/20 shadow-neon-green/5 hover:border-neon-green/40",
    cyan: "border-neon-cyan/20 shadow-neon-cyan/5 hover:border-neon-cyan/40",
  }[variant];

  const iconStyles = {
    purple: "text-neon-purple",
    green: "text-neon-green",
    cyan: "text-neon-cyan",
  }[variant];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}>
      <Card className={`bg-card/40 backdrop-blur-md transition-all duration-300 shadow-lg ${variantStyles}`}>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-bold font-mono flex items-center gap-2">
            <div className={`p-1.5 rounded-lg bg-background/50 border border-border/20 ${iconStyles}`}>
              <Icon className="h-4 w-4" />
            </div>
            {title}
          </CardTitle>
          {description && <CardDescription className="text-xs text-muted-foreground/70">{description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Content Block Editor ───
function BlockEditor({ block, onChange, onRemove }: {
  block: ContentBlock;
  onChange: (b: ContentBlock) => void;
  onRemove: () => void;
}) {
  const typeLabel: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
    text: { label: "Texto", icon: FileText, color: "text-foreground", bgColor: "bg-foreground/5" },
    step: { label: "Passo", icon: ChevronRight, color: "text-neon-purple", bgColor: "bg-neon-purple/10" },
    code: { label: "Código", icon: Code, color: "text-neon-green", bgColor: "bg-neon-green/10" },
    image: { label: "Imagem", icon: Image, color: "text-neon-pink", bgColor: "bg-neon-pink/10" },
    video: { label: "Vídeo", icon: Video, color: "text-neon-pink", bgColor: "bg-neon-pink/10" },
    tip: { label: "Dica", icon: Lightbulb, color: "text-neon-cyan", bgColor: "bg-neon-cyan/10" },
    warning: { label: "Aviso", icon: AlertTriangle, color: "text-destructive", bgColor: "bg-destructive/10" },
  };

  const info = typeLabel[block.type];
  const IconComp = info.icon;

  return (
    <div className="group relative border border-border/30 rounded-xl p-4 bg-background/30 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab active:cursor-grabbing" />
          <div className={`p-1.5 rounded-md ${info.bgColor} ${info.color}`}>
            <IconComp className="h-3.5 w-3.5" />
          </div>
          <span className="text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-widest">{info.label}</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 rounded-full bg-background/50 opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive" 
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-3">
        {block.type === "code" && (
          <div className="relative">
            <Input
              placeholder="Linguagem (ex: lua, js)"
              value={block.language || ""}
              onChange={(e) => onChange({ ...block, language: e.target.value })}
              className="h-8 text-xs bg-background/50 border-border/20 font-mono w-48"
            />
          </div>
        )}

        {block.type === "image" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">URL da Imagem</Label>
                <Input
                  placeholder="https://..."
                  value={block.imageUrl || ""}
                  onChange={(e) => onChange({ ...block, imageUrl: e.target.value })}
                  className="h-9 text-sm bg-background/50 border-border/20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">Legenda / Alt</Label>
                <Input
                  placeholder="Descrição da imagem"
                  value={block.content}
                  onChange={(e) => onChange({ ...block, content: e.target.value })}
                  className="h-9 text-sm bg-background/50 border-border/20"
                />
              </div>
            </div>
            {block.imageUrl && (
              <div className="relative rounded-lg overflow-hidden border border-border/20 aspect-video bg-black/20">
                <img src={block.imageUrl} alt={block.content} className="w-full h-full object-contain" />
              </div>
            )}
          </div>
        ) : block.type === "video" ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">URL do YouTube</Label>
              <Input
                placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                value={block.content}
                onChange={(e) => onChange({ ...block, content: e.target.value })}
                className="h-9 text-sm bg-background/50 border-border/20"
              />
            </div>
            {block.content && (() => {
              const match = block.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
              return match ? (
                <div className="aspect-video rounded-lg overflow-hidden border border-border/20">
                  <iframe
                    src={`https://www.youtube.com/embed/${match[1]}`}
                    className="w-full h-full"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              ) : (
                <p className="text-xs text-destructive">URL do YouTube inválida</p>
              );
            })()}
          </div>
        ) : (
          <Textarea
            placeholder={
              block.type === "step" ? "Descreva este passo..."
                : block.type === "tip" ? "Escreva uma dica valiosa..."
                : block.type === "warning" ? "Escreva um aviso importante..."
                : block.type === "code" ? "-- Cole seu código aqui..."
                : "Escreva o conteúdo do bloco..."
            }
            value={block.content}
            onChange={(e) => onChange({ ...block, content: e.target.value })}
            rows={block.type === "code" ? 8 : 4}
            className={`text-sm bg-background/50 border-border/20 focus:border-primary/40 resize-none transition-all ${
              block.type === "code" ? "font-mono text-xs bg-slate-950/50" : ""
            }`}
          />
        )}
      </div>
    </div>
  );
}

// ─── Preview component ───
function TutorialPreview({ form }: { form: TutorialFormData }) {
  const content = serializeContent(form);
  return (
    <div className="space-y-6 p-6">
      <div>
        <Badge variant="secondary" className="mb-2">
          {CATEGORIES.find((c) => c.value === form.category)?.label ?? form.category}
        </Badge>
        <h1 className="text-2xl font-bold font-mono">{form.title || "Sem título"}</h1>
        {form.description && <p className="text-muted-foreground mt-1">{form.description}</p>}
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {form.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
            ))}
          </div>
        )}
      </div>

      {form.video_url && (
        <div className="aspect-video rounded-lg overflow-hidden bg-secondary">
          <iframe
            src={`https://www.youtube.com/embed/${form.video_url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1] || ""}`}
            className="w-full h-full"
            allowFullScreen
          />
        </div>
      )}

      {content && (
        <div className="prose-sm text-sm text-foreground/85 whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
}

// ─── Main Editor ───
export default function TutorialEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!id;
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("edit");
  const [tagInput, setTagInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [form, setForm] = useState<TutorialFormData>(emptyForm);

  // Load existing tutorial
  const { data: existing, isLoading } = useQuery({
    queryKey: ["tutorial-edit", id],
    queryFn: async () => {
      const { data } = await supabase.from("tutorials").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  // All tutorials for "related" picker
  const { data: allTutorials = [] } = useQuery({
    queryKey: ["tutorials"],
    queryFn: async () => {
      const { data } = await supabase.from("tutorials").select("id, title, category").order("title");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (existing) {
      const content = existing.content || "";
      setForm({
        title: existing.title,
        description: existing.description || "",
        category: existing.category,
        tags: [],
        thumbnail_url: existing.thumbnail_url || "",
        video_url: existing.video_url || "",
        contentBlocks: parseContentToBlocks(content),
        tips: parseTips(content).length > 0 ? parseTips(content) : [""],
        troubleshooting: parseTroubleshooting(content),
        relatedTutorialIds: [],
      });
    }
  }, [existing]);

  if (!isAdmin) return <Navigate to="/tutorials" />;

  const handleGenerateWithAI = async () => {
    if (!form.title.trim()) {
      toast.error("Digite um título primeiro para a IA saber o que gerar!");
      return;
    }

    setIsGenerating(true);
    toast.info("A IA está escrevendo seu tutorial... Isso pode levar alguns segundos.");
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-tutorial', {
        body: { title: form.title }
      });

      if (error) throw error;

      if (data) {
        setForm(f => ({
          ...f,
          description: data.description || f.description,
          contentBlocks: data.blocks.map((b: any) => ({
            id: crypto.randomUUID(),
            type: b.type,
            content: b.content,
            language: b.language || (b.type === "code" ? "lua" : undefined)
          })),
          tips: data.tips && data.tips.length > 0 ? data.tips : f.tips,
          troubleshooting: data.troubleshooting && data.troubleshooting.length > 0 
            ? data.troubleshooting 
            : f.troubleshooting
        }));
        toast.success("Tutorial gerado com sucesso! Agora é só revisar.");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar com IA: " + (e.message || "Verifique se a GEMINI_API_KEY está configurada."));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const content = serializeContent(form);
      const payload = {
        title: form.title,
        description: form.description || null,
        content: content || null,
        category: form.category,
        video_url: form.video_url || null,
        thumbnail_url: form.thumbnail_url || null,
        author_id: user!.id,
      };

      if (isEditing) {
        const { error } = await supabase.from("tutorials").update(payload).eq("id", id!);
        if (error) throw error;
        toast.success("Tutorial atualizado!");
      } else {
        const { error } = await supabase.from("tutorials").insert(payload);
        if (error) throw error;
        toast.success("Tutorial criado!");
      }

      queryClient.invalidateQueries({ queryKey: ["tutorials"] });
      navigate("/tutorials");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addBlock = (type: ContentBlock["type"]) => {
    setForm((f) => ({ ...f, contentBlocks: [...f.contentBlocks, createEmptyBlock(type)] }));
  };

  const updateBlock = (idx: number, block: ContentBlock) => {
    setForm((f) => {
      const blocks = [...f.contentBlocks];
      blocks[idx] = block;
      return { ...f, contentBlocks: blocks };
    });
  };

  const removeBlock = (idx: number) => {
    setForm((f) => ({
      ...f,
      contentBlocks: f.contentBlocks.length > 1 ? f.contentBlocks.filter((_, i) => i !== idx) : f.contentBlocks,
    }));
  };

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !form.tags.includes(t)) {
      setForm((f) => ({ ...f, tags: [...f.tags, t] }));
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-20 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-6 max-w-5xl">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/tutorials")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold font-mono">
                {isEditing ? "Editar Tutorial" : "Novo Tutorial"}
              </h1>
              <p className="text-xs text-muted-foreground">
                Preencha as seções abaixo para estruturar o tutorial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-8">
                <TabsTrigger value="edit" className="text-xs px-3 h-7">
                  <FileText className="h-3 w-3 mr-1" /> Editor
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs px-3 h-7">
                  <Eye className="h-3 w-3 mr-1" /> Preview
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button onClick={handleSave} disabled={saving || !form.title.trim()} className="neon-glow-green h-8 text-xs">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              {isEditing ? "Salvar" : "Publicar"}
            </Button>
          </div>
        </div>

        {activeTab === "preview" ? (
          <Card className="bg-card/80 backdrop-blur-sm neon-border">
            <TutorialPreview form={form} />
          </Card>
        ) : (
          <div className="space-y-5">
            {/* 1. Basic Information */}
            <SectionCard title="Informações Básicas" description="Título, descrição e categorização do tutorial" icon={FileText} delay={0} variant="purple">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Título *</Label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-[10px] gap-1.5 text-neon-purple hover:text-neon-purple hover:bg-neon-purple/10"
                      onClick={handleGenerateWithAI}
                      disabled={isGenerating || !form.title.trim()}
                    >
                      {isGenerating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Gerar com IA
                    </Button>
                  </div>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Ex: Como instalar scripts Lua no Android"
                    className="text-sm"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Descrição curta</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Uma breve descrição que aparecerá nos cards de listagem"
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.icon} {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Thumbnail URL</Label>
                  <Input
                    value={form.thumbnail_url}
                    onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
                    placeholder="https://..."
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5 text-right">
                   <Label className="text-xs">Ou Enviar Imagem</Label>
                   <Input 
                      type="file" 
                      accept=".jpg,.jpeg,.png,.webp"
                      className="h-9 text-xs"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const safeName = await validateFileWithToast({ file: f, type: "image", maxSizeMB: 1 });
                        if (!safeName) {
                          e.target.value = "";
                          return;
                        }
                        toast.info("Enviando miniatura...");
                        const path = `tutorial-thumbnails/${user!.id}/${safeName}`;
                        const { error: uploadError } = await supabase.storage.from("scripts").upload(path, f);
                        if (uploadError) {
                          toast.error("Erro no upload: " + uploadError.message);
                          return;
                        }
                        const { data: publicData } = supabase.storage.from("scripts").getPublicUrl(path);
                        setForm(f => ({ ...f, thumbnail_url: publicData.publicUrl }));
                        toast.success("Miniatura enviada!");
                      }}
                   />
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <Label className="text-xs">Tags</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] gap-1 cursor-pointer hover:bg-destructive/20" onClick={() => removeTag(tag)}>
                      {tag} ×
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
                    placeholder="Adicionar tag..."
                    className="h-8 text-xs flex-1"
                  />
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => addTag(tagInput)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {TAG_SUGGESTIONS.filter((t) => !form.tags.includes(t)).slice(0, 6).map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-[10px] cursor-pointer hover:bg-secondary transition-colors"
                      onClick={() => addTag(tag)}
                    >
                      + {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Thumbnail preview */}
              {form.thumbnail_url && (
                <div className="mt-2">
                  <img src={form.thumbnail_url} alt="Thumbnail preview" className="max-h-40 rounded-lg object-contain border border-border" />
                </div>
              )}
            </SectionCard>

            {/* 2. Video Section */}
            <SectionCard title="Vídeo" description="Embed de vídeo do YouTube (opcional)" icon={Video} delay={0.05} variant="cyan">
              <div className="space-y-1.5">
                <Label className="text-xs">URL do YouTube</Label>
                <Input
                  value={form.video_url}
                  onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
                  placeholder="https://youtube.com/watch?v=... ou https://youtu.be/..."
                  className="text-sm"
                />
              </div>
              {form.video_url && (() => {
                const match = form.video_url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                if (!match) return null;
                return (
                  <div className="aspect-video max-h-64 rounded-lg overflow-hidden bg-secondary">
                    <iframe
                      src={`https://www.youtube.com/embed/${match[1]}`}
                      className="w-full h-full"
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                );
              })()}
            </SectionCard>

            {/* 3. Tutorial Content */}
            <SectionCard title="Conteúdo do Tutorial" description="Adicione blocos de conteúdo: texto, passos, código, imagens, dicas e avisos" icon={BookOpen} delay={0.1} variant="purple">
              <div className="space-y-3">
                {form.contentBlocks.map((block, idx) => (
                  <BlockEditor
                    key={block.id}
                    block={block}
                    onChange={(b) => updateBlock(idx, b)}
                    onRemove={() => removeBlock(idx)}
                  />
                ))}
              </div>

              <Separator />

              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] text-muted-foreground mr-1 self-center">Adicionar bloco:</span>
                {[
                  { type: "text" as const, label: "Texto", icon: FileText },
                  { type: "step" as const, label: "Passo", icon: ChevronRight },
                  { type: "code" as const, label: "Código", icon: Code },
                  { type: "image" as const, label: "Imagem", icon: Image },
                  { type: "tip" as const, label: "Dica", icon: Lightbulb },
                  { type: "warning" as const, label: "Aviso", icon: AlertTriangle },
                ].map(({ type, label, icon: I }) => (
                  <Button key={type} variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => addBlock(type)}>
                    <I className="h-3 w-3" /> {label}
                  </Button>
                ))}
              </div>
            </SectionCard>

            {/* 4. Tips */}
            <SectionCard title="Dicas" description="Dicas úteis que serão destacadas no tutorial" icon={Lightbulb} delay={0.15} variant="green">
              {form.tips.map((tip, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={tip}
                    onChange={(e) => {
                      const tips = [...form.tips];
                      tips[idx] = e.target.value;
                      setForm((f) => ({ ...f, tips }));
                    }}
                    placeholder="Escreva uma dica..."
                    className="text-sm flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => {
                      if (form.tips.length > 1) {
                        setForm((f) => ({ ...f, tips: f.tips.filter((_, i) => i !== idx) }));
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setForm((f) => ({ ...f, tips: [...f.tips, ""] }))}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar dica
              </Button>
            </SectionCard>

            {/* 5. Troubleshooting */}
            <SectionCard title="Solução de Problemas" description="Problemas comuns e suas soluções" icon={AlertTriangle} delay={0.2}>
              {form.troubleshooting.map((item, idx) => (
                <div key={idx} className="border border-border/50 rounded-lg p-3 bg-secondary/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Problema #{idx + 1}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        if (form.troubleshooting.length > 1) {
                          setForm((f) => ({ ...f, troubleshooting: f.troubleshooting.filter((_, i) => i !== idx) }));
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                  <Input
                    value={item.problem}
                    onChange={(e) => {
                      const t = [...form.troubleshooting];
                      t[idx] = { ...t[idx], problem: e.target.value };
                      setForm((f) => ({ ...f, troubleshooting: t }));
                    }}
                    placeholder="Descreva o problema..."
                    className="text-sm"
                  />
                  <Textarea
                    value={item.solution}
                    onChange={(e) => {
                      const t = [...form.troubleshooting];
                      t[idx] = { ...t[idx], solution: e.target.value };
                      setForm((f) => ({ ...f, troubleshooting: t }));
                    }}
                    placeholder="Descreva a solução..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setForm((f) => ({ ...f, troubleshooting: [...f.troubleshooting, { problem: "", solution: "" }] }))}
              >
                <Plus className="h-3 w-3 mr-1" /> Adicionar problema
              </Button>
            </SectionCard>

            {/* 6. Related Tutorials */}
            <SectionCard title="Tutoriais Relacionados" description="Selecione tutoriais que serão sugeridos ao final da página" icon={Link2} delay={0.25}>
              <div className="flex flex-wrap gap-2">
                {allTutorials
                  .filter((t: any) => t.id !== id)
                  .map((t: any) => {
                    const selected = form.relatedTutorialIds.includes(t.id);
                    return (
                      <Badge
                        key={t.id}
                        variant={selected ? "default" : "outline"}
                        className="cursor-pointer text-[10px] transition-all hover:scale-105"
                        onClick={() => {
                          setForm((f) => ({
                            ...f,
                            relatedTutorialIds: selected
                              ? f.relatedTutorialIds.filter((r) => r !== t.id)
                              : [...f.relatedTutorialIds, t.id],
                          }));
                        }}
                      >
                        {t.title}
                      </Badge>
                    );
                  })}
                {allTutorials.filter((t: any) => t.id !== id).length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum outro tutorial disponível.</p>
                )}
              </div>
            </SectionCard>

            {/* Bottom actions */}
            <div className="flex justify-end gap-2 pt-2 pb-8">
              <Button variant="outline" onClick={() => navigate("/tutorials")}>Cancelar</Button>
              <Button onClick={() => setActiveTab("preview")} variant="secondary">
                <Eye className="h-4 w-4 mr-1" /> Preview
              </Button>
              <Button onClick={handleSave} disabled={saving || !form.title.trim()} className="neon-glow-green">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                {isEditing ? "Salvar alterações" : "Publicar tutorial"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
