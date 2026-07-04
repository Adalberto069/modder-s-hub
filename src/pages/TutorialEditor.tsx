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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Eye, Send, Plus, Trash2, Loader2,
  FileText, Video, BookOpen, Lightbulb, AlertTriangle,
  Image, Code, Link2, GripVertical, ChevronRight, Sparkles, Wand2,
  ArrowUp, ArrowDown, Copy, Check, Hash, Star, Minus, List
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  type: "text" | "step" | "code" | "image" | "tip" | "warning" | "video" | "link" | "bullet_list" | "divider";
  content: string;
  language?: string;
  imageUrl?: string;
  url?: string;
  label?: string;
  items?: string[];
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

function serializeContent(form: TutorialFormData): string {
  const parts: string[] = [];
  let stepCounter = 0;
  form.contentBlocks.forEach((block) => {
    if (!block.content.trim() && block.type !== "image" && block.type !== "video") return;
    switch (block.type) {
      case "text": parts.push(block.content); break;
      case "step": stepCounter++; parts.push(`${stepCounter}. ${block.content}`); break;
      case "code": parts.push(`\`\`\`${block.language || ""}\n${block.content}\n\`\`\``); break;
      case "image": if (block.imageUrl) parts.push(`![${block.content || "imagem"}](${block.imageUrl})`); break;
      case "video": if (block.content.trim()) parts.push(`[video](${block.content.trim()})`); break;
      case "tip": parts.push(`💡 ${block.content}`); break;
      case "warning": parts.push(`⚠️ ${block.content}`); break;
      case "link": if (block.url) parts.push(`[${block.label || block.content}](${block.url})`); break;
      case "divider": parts.push("---"); break;
      case "bullet_list": if (block.items) block.items.forEach(item => parts.push(`- ${item}`)); break;
    }
  });

  const validTips = form.tips.filter((t) => t.trim());
  if (validTips.length > 0) {
    parts.push("", "## Dicas");
    validTips.forEach((tip) => parts.push(`💡 ${tip}`));
  }

  const validTrouble = form.troubleshooting.filter((t) => t.problem.trim() || t.solution.trim());
  if (validTrouble.length > 0) {
    parts.push("", "## Solução de Problemas");
    validTrouble.forEach((t) => {
      if (t.problem.trim()) parts.push(`⚠️ **${t.problem}**`);
      if (t.solution.trim()) parts.push(`${t.solution}`);
    });
  }

  return parts.join("\n");
}

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

    if (trimmed === "## Dicas" || trimmed === "## Solução de Problemas") { flushText(); break; }

    if (trimmed.startsWith("```")) {
      flushText();
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { codeLines.push(lines[i]); i++; }
      blocks.push({ id: crypto.randomUUID(), type: "code", content: codeLines.join("\n"), language: lang });
      i++; continue;
    }
    if (trimmed.startsWith("💡")) { flushText(); blocks.push({ id: crypto.randomUUID(), type: "tip", content: trimmed.replace(/^💡\s*/, "") }); i++; continue; }
    if (trimmed.startsWith("⚠️")) { flushText(); blocks.push({ id: crypto.randomUUID(), type: "warning", content: trimmed.replace(/^⚠️\s*/, "") }); i++; continue; }
    const videoMatch = trimmed.match(/^\[video\]\((.*?)\)$/);
    if (videoMatch) { flushText(); blocks.push({ id: crypto.randomUUID(), type: "video", content: videoMatch[1] }); i++; continue; }
    if (/^\d+\.\s/.test(trimmed)) { flushText(); blocks.push({ id: crypto.randomUUID(), type: "step", content: trimmed.replace(/^\d+\.\s*/, "") }); i++; continue; }
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
function SectionCard({ title, description, icon: Icon, children, delay = 0, variant = "purple", collapsible = false }: {
  title: string;
  description?: string;
  icon: any;
  children: React.ReactNode;
  delay?: number;
  variant?: "purple" | "green" | "cyan";
  collapsible?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const borderColor = {
    purple: "border-primary/15 hover:border-primary/30",
    green: "border-accent/15 hover:border-accent/30",
    cyan: "border-neon-cyan/15 hover:border-neon-cyan/30",
  }[variant];

  const iconColor = {
    purple: "text-primary bg-primary/10",
    green: "text-accent bg-accent/10",
    cyan: "text-neon-cyan bg-neon-cyan/10",
  }[variant];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.25 }}>
      <Card className={`bg-card/50 backdrop-blur-md transition-all duration-300 shadow-md ${borderColor}`}>
        <CardHeader className="pb-3 cursor-pointer" onClick={() => collapsible && setCollapsed(!collapsed)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold font-mono flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg ${iconColor}`}>
                <Icon className="h-4 w-4" />
              </div>
              {title}
            </CardTitle>
            {collapsible && (
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${collapsed ? "" : "rotate-90"}`} />
            )}
          </div>
          {description && <CardDescription className="text-[11px] text-muted-foreground/60 ml-9">{description}</CardDescription>}
        </CardHeader>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={collapsible ? { height: 0, opacity: 0 } : false} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <CardContent className="space-y-4 pt-0">{children}</CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// ─── Content Block Editor ───
function BlockEditor({ block, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast, index }: {
  block: ContentBlock;
  onChange: (b: ContentBlock) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  index: number;
}) {
  const typeLabel: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
    text: { label: "Texto", icon: FileText, color: "text-foreground", bgColor: "bg-foreground/5" },
    step: { label: "Passo", icon: ChevronRight, color: "text-primary", bgColor: "bg-primary/10" },
    code: { label: "Código", icon: Code, color: "text-neon-green", bgColor: "bg-neon-green/10" },
    image: { label: "Imagem", icon: Image, color: "text-neon-pink", bgColor: "bg-neon-pink/10" },
    video: { label: "Vídeo", icon: Video, color: "text-neon-pink", bgColor: "bg-neon-pink/10" },
    tip: { label: "Dica", icon: Lightbulb, color: "text-neon-cyan", bgColor: "bg-neon-cyan/10" },
    warning: { label: "Aviso", icon: AlertTriangle, color: "text-destructive", bgColor: "bg-destructive/10" },
    link: { label: "Link", icon: Link2, color: "text-primary", bgColor: "bg-primary/10" },
    bullet_list: { label: "Lista", icon: List, color: "text-neon-purple", bgColor: "bg-neon-purple/10" },
    divider: { label: "Divisor", icon: Minus, color: "text-muted-foreground", bgColor: "bg-muted/10" },
  };

  const info = typeLabel[block.type];
  const IconComp = info.icon;

  return (
    <motion.div layout className="group relative border border-border/20 rounded-xl p-4 bg-background/30 backdrop-blur-sm hover:border-primary/20 transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <Button variant="ghost" size="icon" className="h-4 w-4 p-0" disabled={isFirst} onClick={onMoveUp}>
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-4 w-4 p-0" disabled={isLast} onClick={onMoveDown}>
              <ArrowDown className="h-3 w-3" />
            </Button>
          </div>
          <div className={`p-1.5 rounded-md ${info.bgColor} ${info.color}`}>
            <IconComp className="h-3.5 w-3.5" />
          </div>
          <span className="text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-widest">{info.label}</span>
          <span className="text-[9px] text-muted-foreground/40 font-mono">#{index + 1}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-3">
        {block.type === "code" && (
          <Input
            placeholder="Linguagem (ex: lua, js)"
            value={block.language || ""}
            onChange={(e) => onChange({ ...block, language: e.target.value })}
            className="h-8 text-xs bg-background/50 border-border/20 font-mono w-48"
          />
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
                  <iframe src={`https://www.youtube.com/embed/${match[1]}`} className="w-full h-full" allowFullScreen loading="lazy" />
                </div>
              ) : (
                <p className="text-xs text-destructive">URL do YouTube inválida</p>
              );
            })()}
          </div>
        ) : block.type === "link" ? (
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Rótulo (ex: Baixar Script)"
              value={block.label || ""}
              onChange={(e) => onChange({ ...block, label: e.target.value })}
              className="h-9 text-sm bg-background/50 border-border/20"
            />
            <Input
              placeholder="URL (https://...)"
              value={block.url || ""}
              onChange={(e) => onChange({ ...block, url: e.target.value })}
              className="h-9 text-sm bg-background/50 border-border/20"
            />
          </div>
        ) : block.type === "bullet_list" ? (
          <div className="space-y-2">
            {(block.items || [""]).map((item, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={item}
                  onChange={(e) => {
                    const items = [...(block.items || [""])];
                    items[i] = e.target.value;
                    onChange({ ...block, items });
                  }}
                  placeholder="Item da lista..."
                  className="h-8 text-sm bg-background/50 border-border/20"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                  const items = (block.items || []).filter((_, idx) => idx !== i);
                  onChange({ ...block, items: items.length ? items : [""] });
                }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => onChange({ ...block, items: [...(block.items || []), ""] })}>
              <Plus className="h-3 w-3" /> Adicionar Item
            </Button>
          </div>
        ) : block.type === "divider" ? (
          <div className="h-px bg-border/20 my-4" />
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
            rows={block.type === "code" ? 8 : 3}
            className={`text-sm bg-background/50 border-border/20 focus:border-primary/40 resize-none transition-all ${
              block.type === "code" ? "font-mono text-xs bg-slate-950/50" : ""
            }`}
          />
        )}
      </div>
    </motion.div>
  );
}

// ─── Live Preview (renders blocks properly) ───
function LivePreview({ form }: { form: TutorialFormData }) {
  function getYouTubeEmbedUrl(url: string) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  }

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
      return part;
    });
  };

  let stepCounter = 0;

  return (
    <div className="space-y-8 p-6 sm:p-8">
      {/* Header */}
      <div className="space-y-3">
        <Badge className="bg-primary/15 text-primary border-primary/20">
          {CATEGORIES.find((c) => c.value === form.category)?.label ?? form.category}
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold font-mono">{form.title || "Sem título"}</h1>
        {form.description && <p className="text-muted-foreground leading-relaxed">{form.description}</p>}
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {form.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* Video */}
      {form.video_url && (() => {
        const embed = getYouTubeEmbedUrl(form.video_url);
        return embed ? (
          <div className="aspect-video rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black/30">
            <iframe src={embed} className="w-full h-full" allowFullScreen loading="lazy" />
          </div>
        ) : null;
      })()}

      {/* Content blocks */}
      <div className="space-y-6">
        {form.contentBlocks.map((block, idx) => {
          if (!block.content.trim() && block.type !== "image" && block.type !== "video") return null;

          switch (block.type) {
            case "text":
              return <p key={idx} className="text-[15px] text-foreground/80 leading-relaxed">{renderInline(block.content)}</p>;

            case "step":
              stepCounter++;
              return (
                <div key={idx} className="flex gap-4 items-start">
                  <span className="flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm font-black shadow-lg shrink-0">
                    {stepCounter}
                  </span>
                  <p className="text-[15px] text-foreground/85 leading-relaxed pt-1.5">{renderInline(block.content)}</p>
                </div>
              );

            case "code":
              return (
                <div key={idx} className="rounded-xl overflow-hidden border border-white/5 shadow-xl">
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                        <div className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
                        <div className="h-2.5 w-2.5 rounded-full bg-neon-green/60" />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground/50 uppercase ml-2">{block.language || "code"}</span>
                    </div>
                  </div>
                  <pre className="bg-slate-950/90 p-5 text-[13px] font-mono overflow-x-auto">
                    <code className="block text-neon-green/90 leading-relaxed whitespace-pre">{block.content}</code>
                  </pre>
                </div>
              );

            case "tip":
              return (
                <div key={idx} className="flex gap-4 p-4 rounded-xl bg-neon-cyan/5 border border-neon-cyan/20">
                  <div className="p-2 rounded-lg bg-neon-cyan/10 text-neon-cyan shrink-0 h-fit"><Lightbulb className="h-5 w-5" /></div>
                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neon-cyan/70">Dica</span>
                    <p className="text-sm text-foreground/90 leading-relaxed">{renderInline(block.content)}</p>
                  </div>
                </div>
              );

            case "warning":
              return (
                <div key={idx} className="flex gap-4 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                  <div className="p-2 rounded-lg bg-destructive/10 text-destructive shrink-0 h-fit"><AlertTriangle className="h-5 w-5" /></div>
                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-destructive/70">Atenção</span>
                    <p className="text-sm text-foreground/90 leading-relaxed">{renderInline(block.content)}</p>
                  </div>
                </div>
              );

            case "video":
              const embedUrl = getYouTubeEmbedUrl(block.content);
              return embedUrl ? (
                <div key={idx} className="aspect-video rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black/30">
                  <iframe src={embedUrl} className="w-full h-full" allowFullScreen loading="lazy" />
                </div>
              ) : null;

            case "image":
              return block.imageUrl ? (
                <div key={idx} className="rounded-2xl overflow-hidden border border-border/20 shadow-lg bg-black/20">
                  <img src={block.imageUrl} alt={block.content} className="w-full object-contain max-h-[400px]" />
                  {block.content && <div className="px-4 py-2 bg-secondary/30 border-t border-border/10"><p className="text-[11px] text-muted-foreground italic text-center">{block.content}</p></div>}
                </div>
              ) : null;

            case "link":
              return block.url ? (
                <div key={idx} className="my-4">
                  <a href={block.url} target="_blank" rel="noopener noreferrer" 
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all font-bold text-sm">
                    <Link2 className="h-4 w-4" />
                    {block.label || block.content || "Link"}
                  </a>
                </div>
              ) : null;

            case "bullet_list":
              return block.items ? (
                <ul key={idx} className="space-y-2 pl-2">
                  {block.items.map((item, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <ChevronRight className="h-4 w-4 text-primary mt-1 shrink-0" />
                      <p className="text-[15px] text-foreground/85 leading-relaxed">{renderInline(item)}</p>
                    </li>
                  ))}
                </ul>
              ) : null;

            case "divider":
              return <Separator key={idx} className="my-8 bg-border/20" />;

            default: return null;
          }
        })}
      </div>

      {/* Tips section */}
      {form.tips.some(t => t.trim()) && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold font-mono flex items-center gap-3">
            <div className="h-6 w-1.5 rounded-full bg-gradient-to-b from-primary to-primary/40" />
            Dicas
          </h2>
          {form.tips.filter(t => t.trim()).map((tip, idx) => (
            <div key={idx} className="flex gap-4 p-4 rounded-xl bg-neon-cyan/5 border border-neon-cyan/20">
              <div className="p-2 rounded-lg bg-neon-cyan/10 text-neon-cyan shrink-0 h-fit"><Lightbulb className="h-5 w-5" /></div>
              <p className="text-sm text-foreground/90 leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      )}

      {/* Troubleshooting */}
      {form.troubleshooting.some(t => t.problem.trim()) && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold font-mono flex items-center gap-3">
            <div className="h-6 w-1.5 rounded-full bg-gradient-to-b from-destructive to-destructive/40" />
            Solução de Problemas
          </h2>
          {form.troubleshooting.filter(t => t.problem.trim()).map((item, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex gap-4 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                <div className="p-2 rounded-lg bg-destructive/10 text-destructive shrink-0 h-fit"><AlertTriangle className="h-5 w-5" /></div>
                <div className="space-y-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-destructive/70">Problema</span>
                  <p className="text-sm text-foreground/90 font-medium">{item.problem}</p>
                </div>
              </div>
              {item.solution.trim() && (
                <p className="text-sm text-foreground/75 pl-14 leading-relaxed">{item.solution}</p>
              )}
            </div>
          ))}
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
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  const [form, setForm] = useState<TutorialFormData>(emptyForm);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["tutorial-edit", id],
    queryFn: async () => {
      const { data } = await supabase.from("tutorials").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

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
    if (!aiPrompt.trim()) { toast.error("Descreva o que você quer no tutorial"); return; }
    setIsGenerating(true);
    toast.info("A IA está escrevendo seu tutorial...");
    try {
      const { data, error } = await supabase.functions.invoke('generate-tutorial', { body: { prompt: aiPrompt } });
      if (error) throw error;
      if (data) {
        const validCats = ["geral", "scripts-lua", "root", "virtualizado", "iniciante"];
        setForm(f => ({
          ...f,
          title: data.title || f.title,
          category: validCats.includes(data.category) ? data.category : f.category,
          description: data.description || f.description,
          contentBlocks: (data.blocks || [])
            .filter((b: any) => {
              // A IA não tem imagens reais — descarta blocos de imagem para evitar "foto quebrada"
              if (b.type === "image") return false;
              // Descarta vídeo/link sem URL
              if ((b.type === "video" || b.type === "link") && !b.url) return false;
              return true;
            })
            .map((b: any) => ({
              id: crypto.randomUUID(),
              type: b.type,
              content: b.content || "",
              language: b.language || (b.type === "code" ? "lua" : undefined),
              url: b.url,
              label: b.label,
              items: b.items,
              imageUrl: b.imageUrl,
            })),
          tips: data.tips?.length > 0 ? data.tips : f.tips,
          troubleshooting: data.troubleshooting?.length > 0 ? data.troubleshooting : f.troubleshooting
        }));
        toast.success("Tutorial gerado com sucesso!");
        setAiOpen(false);
        setActiveTab("preview");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar: " + (e.message || "Tente novamente"));
    } finally { setIsGenerating(false); }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Título é obrigatório"); return; }
    setSaving(true);
    try {
      const content = serializeContent(form);
      const payload = {
        title: form.title, description: form.description || null,
        content: content || null, category: form.category,
        video_url: form.video_url || null, thumbnail_url: form.thumbnail_url || null,
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
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const addBlock = (type: ContentBlock["type"]) => {
    setForm((f) => ({ ...f, contentBlocks: [...f.contentBlocks, createEmptyBlock(type)] }));
  };

  const updateBlock = (idx: number, block: ContentBlock) => {
    setForm((f) => { const blocks = [...f.contentBlocks]; blocks[idx] = block; return { ...f, contentBlocks: blocks }; });
  };

  const removeBlock = (idx: number) => {
    setForm((f) => ({ ...f, contentBlocks: f.contentBlocks.length > 1 ? f.contentBlocks.filter((_, i) => i !== idx) : f.contentBlocks }));
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    setForm((f) => {
      const blocks = [...f.contentBlocks];
      const target = idx + dir;
      if (target < 0 || target >= blocks.length) return f;
      [blocks[idx], blocks[target]] = [blocks[target], blocks[idx]];
      return { ...f, contentBlocks: blocks };
    });
  };

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !form.tags.includes(t)) setForm((f) => ({ ...f, tags: [...f.tags, t] }));
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

  const blockCount = form.contentBlocks.filter(b => b.content.trim()).length;
  const wordCount = form.contentBlocks.reduce((acc, b) => acc + b.content.split(/\s+/).filter(Boolean).length, 0);

  return (
    <Layout>
      <div className="container py-6 max-w-6xl">
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
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {blockCount} blocos · {wordCount} palavras
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-9">
                <TabsTrigger value="edit" className="text-xs px-4 h-7 gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Editor
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs px-4 h-7 gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> Preview
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs gap-1.5 border-primary/30 text-primary hover:text-primary hover:bg-primary/10"
              onClick={() => setAiOpen(true)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Gerar com IA
            </Button>

            <Button onClick={handleSave} disabled={saving || !form.title.trim()} className="h-9 text-xs gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {isEditing ? "Salvar" : "Publicar"}
            </Button>
          </div>
        </div>

        {activeTab === "preview" ? (
          <Card className="bg-card/80 backdrop-blur-sm border-border/20 shadow-xl">
            <LivePreview form={form} />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-5">
            {/* Main editor column */}
            <div className="space-y-5">
              {/* Basic Info */}
              <SectionCard title="Informações Básicas" icon={FileText} delay={0} variant="purple">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Título *</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Ex: Como instalar scripts Lua no Android"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Descrição curta</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Breve descrição para os cards de listagem"
                      rows={2}
                      className="text-sm resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Categoria</Label>
                      <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Vídeo (YouTube)</Label>
                      <Input
                        value={form.video_url}
                        onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
                        placeholder="https://youtu.be/..."
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* Content Blocks */}
              <SectionCard title="Conteúdo do Tutorial" description="Adicione e organize blocos de conteúdo" icon={BookOpen} delay={0.05} variant="purple">
                <div className="space-y-3">
                  <AnimatePresence>
                    {form.contentBlocks.map((block, idx) => (
                      <BlockEditor
                        key={block.id}
                        block={block}
                        index={idx}
                        onChange={(b) => updateBlock(idx, b)}
                        onRemove={() => removeBlock(idx)}
                        onMoveUp={() => moveBlock(idx, -1)}
                        onMoveDown={() => moveBlock(idx, 1)}
                        isFirst={idx === 0}
                        isLast={idx === form.contentBlocks.length - 1}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                <Separator className="opacity-30" />

                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-muted-foreground mr-1 self-center">Adicionar:</span>
                  {([
                    { type: "text" as const, label: "Texto", icon: FileText },
                    { type: "step" as const, label: "Passo", icon: ChevronRight },
                    { type: "code" as const, label: "Código", icon: Code },
                    { type: "image" as const, label: "Imagem", icon: Image },
                    { type: "video" as const, label: "Vídeo", icon: Video },
                    { type: "tip" as const, label: "Dica", icon: Lightbulb },
                    { type: "warning" as const, label: "Aviso", icon: AlertTriangle },
                  ]).map(({ type, label, icon: I }) => (
                    <Button key={type} variant="outline" size="sm" className="h-7 text-[10px] gap-1 border-border/30" onClick={() => addBlock(type)}>
                      <I className="h-3 w-3" /> {label}
                    </Button>
                  ))}
                </div>
              </SectionCard>

              {/* Tips */}
              <SectionCard title="Dicas" icon={Lightbulb} delay={0.1} variant="green" collapsible>
                {form.tips.map((tip, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={tip}
                      onChange={(e) => { const tips = [...form.tips]; tips[idx] = e.target.value; setForm((f) => ({ ...f, tips })); }}
                      placeholder="Escreva uma dica..."
                      className="text-sm flex-1"
                    />
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                      onClick={() => { if (form.tips.length > 1) setForm((f) => ({ ...f, tips: f.tips.filter((_, i) => i !== idx) })); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setForm((f) => ({ ...f, tips: [...f.tips, ""] }))}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar dica
                </Button>
              </SectionCard>

              {/* Troubleshooting */}
              <SectionCard title="Solução de Problemas" icon={AlertTriangle} delay={0.15} collapsible>
                {form.troubleshooting.map((item, idx) => (
                  <div key={idx} className="border border-border/30 rounded-lg p-3 bg-secondary/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">Problema #{idx + 1}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6"
                        onClick={() => { if (form.troubleshooting.length > 1) setForm((f) => ({ ...f, troubleshooting: f.troubleshooting.filter((_, i) => i !== idx) })); }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <Input value={item.problem} onChange={(e) => { const t = [...form.troubleshooting]; t[idx] = { ...t[idx], problem: e.target.value }; setForm((f) => ({ ...f, troubleshooting: t })); }} placeholder="Descreva o problema..." className="text-sm" />
                    <Textarea value={item.solution} onChange={(e) => { const t = [...form.troubleshooting]; t[idx] = { ...t[idx], solution: e.target.value }; setForm((f) => ({ ...f, troubleshooting: t })); }} placeholder="Descreva a solução..." rows={2} className="text-sm resize-none" />
                  </div>
                ))}
                <Button variant="outline" size="sm" className="text-xs"
                  onClick={() => setForm((f) => ({ ...f, troubleshooting: [...f.troubleshooting, { problem: "", solution: "" }] }))}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar problema
                </Button>
              </SectionCard>

              {/* Bottom actions */}
              <div className="flex justify-end gap-2 pt-2 pb-8">
                <Button variant="outline" onClick={() => navigate("/tutorials")}>Cancelar</Button>
                <Button onClick={() => setActiveTab("preview")} variant="secondary" className="gap-1.5">
                  <Eye className="h-4 w-4" /> Preview
                </Button>
                <Button onClick={handleSave} disabled={saving || !form.title.trim()} className="gap-1.5">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isEditing ? "Salvar" : "Publicar"}
                </Button>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-5 hidden lg:block">
              {/* Thumbnail */}
              <SectionCard title="Thumbnail" icon={Image} variant="cyan">
                <div className="space-y-3">
                  <Input
                    value={form.thumbnail_url}
                    onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
                    placeholder="URL da imagem..."
                    className="h-9 text-xs"
                  />
                  <Input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="h-9 text-xs"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const safeName = await validateFileWithToast({ file: f, type: "image", maxSizeMB: 1 });
                      if (!safeName) { e.target.value = ""; return; }
                      toast.info("Enviando...");
                      const path = `tutorial-thumbnails/${user!.id}/${safeName}`;
                      const { error: uploadError } = await supabase.storage.from("scripts").upload(path, f);
                      if (uploadError) { toast.error(uploadError.message); return; }
                      const { data: publicData } = supabase.storage.from("scripts").getPublicUrl(path);
                      setForm(prev => ({ ...prev, thumbnail_url: publicData.publicUrl }));
                      toast.success("Thumbnail enviada!");
                    }}
                  />
                  {form.thumbnail_url && (
                    <div className="rounded-lg overflow-hidden border border-border/20">
                      <img src={form.thumbnail_url} alt="Thumbnail" className="w-full aspect-video object-cover" />
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Tags */}
              <SectionCard title="Tags" icon={Hash} variant="green">
                <div className="flex flex-wrap gap-1.5">
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
                  <Button variant="outline" size="sm" className="h-8" onClick={() => addTag(tagInput)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {TAG_SUGGESTIONS.filter((t) => !form.tags.includes(t)).slice(0, 8).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[9px] cursor-pointer hover:bg-secondary transition-colors" onClick={() => addTag(tag)}>
                      + {tag}
                    </Badge>
                  ))}
                </div>
              </SectionCard>

              {/* Related */}
              <SectionCard title="Relacionados" icon={Link2} variant="cyan" collapsible>
                <div className="flex flex-wrap gap-1.5">
                  {allTutorials.filter((t: any) => t.id !== id).map((t: any) => {
                    const selected = form.relatedTutorialIds.includes(t.id);
                    return (
                      <Badge key={t.id} variant={selected ? "default" : "outline"}
                        className="cursor-pointer text-[9px] transition-all hover:scale-105"
                        onClick={() => {
                          setForm((f) => ({
                            ...f,
                            relatedTutorialIds: selected ? f.relatedTutorialIds.filter((r) => r !== t.id) : [...f.relatedTutorialIds, t.id],
                          }));
                        }}>
                        {t.title}
                      </Badge>
                    );
                  })}
                  {allTutorials.filter((t: any) => t.id !== id).length === 0 && (
                    <p className="text-[10px] text-muted-foreground">Nenhum disponível.</p>
                  )}
                </div>
              </SectionCard>
            </div>
          </div>
        )}
      </div>

      <Dialog open={aiOpen} onOpenChange={(o) => { if (!isGenerating) setAiOpen(o); }}>
        <DialogContent className="sm:max-w-2xl bg-card/95 backdrop-blur border-primary/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono">
              <Sparkles className="h-4 w-4 text-primary" />
              Gerar tutorial com IA
            </DialogTitle>
            <DialogDescription className="text-xs">
              Descreva livremente o que o tutorial deve ensinar. A IA vai criar o título, categoria, blocos, dicas e soluções automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Briefing / Prompt</Label>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={`Ex: Ensine iniciantes a criar o primeiro script Lua no Game Guardian para modificar dinheiro em jogos offline. Foque em passos práticos, cite o uso de gg.searchNumber e gg.editAll, e mostre um exemplo curto de código.`}
              rows={9}
              className="text-sm resize-none font-mono bg-background/60 border-border/30 focus:border-primary/50"
              disabled={isGenerating}
            />
            <p className="text-[10px] text-muted-foreground/70">
              Dica: quanto mais contexto (público-alvo, nível, exemplos que quer), melhor o resultado.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAiOpen(false)} disabled={isGenerating}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleGenerateWithAI} disabled={isGenerating || !aiPrompt.trim()} className="gap-1.5">
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {isGenerating ? "Gerando..." : "Gerar tutorial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Layout>
  );
}
