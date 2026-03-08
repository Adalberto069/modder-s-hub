import { useState, useEffect, useCallback } from "react";
import { validateFileWithToast } from "@/lib/secure-upload";
import LuaCodeEditor from "@/components/LuaCodeEditor";
import ScriptAnalysis, { type AnalysisResult } from "@/components/ScriptAnalysis";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Save, Eye, Send, ArrowLeft, Plus, X, Code, Package,
  Upload, Lock, EyeOff, Gamepad2, Tag, List, FileCode, BookOpen,
} from "lucide-react";
import { Navigate } from "react-router-dom";

export default function ScriptEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isModder, loading, rolesLoading } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  // Form state
  const [title, setTitle] = useState("");
  const [gameName, setGameName] = useState("");
  const [version, setVersion] = useState("1.0");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<string>("working");
  const [publishStatus, setPublishStatus] = useState<string>("draft");
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [scriptType, setScriptType] = useState<string>("script");
  const [luaCode, setLuaCode] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [relatedTutorialId, setRelatedTutorialId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);

  // Password protection
  const [scriptPassword, setScriptPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordPermanent, setPasswordPermanent] = useState(true);
  const [passwordExpiry, setPasswordExpiry] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*");
      return data ?? [];
    },
  });

  const { data: tutorials } = useQuery({
    queryKey: ["tutorials-list"],
    queryFn: async () => {
      const { data } = await supabase.from("tutorials").select("id, title").order("title");
      return data ?? [];
    },
  });

  // Load existing script for editing
  const { data: existingScript } = useQuery({
    queryKey: ["edit-script", id],
    queryFn: async () => {
      const { data } = await supabase.from("scripts").select("*").eq("id", id!).single();
      return data;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingScript) {
      setTitle(existingScript.title);
      setGameName((existingScript as any).game_name ?? "");
      setVersion((existingScript as any).version ?? "1.0");
      setDescription(existingScript.description ?? "");
      setCategoryId(existingScript.category_id ?? "");
      setStatus(existingScript.status);
      setPublishStatus((existingScript as any).publish_status ?? "published");
      setIsPaid(existingScript.is_paid);
      setPrice(existingScript.price?.toString() ?? "");
      setExternalLink(existingScript.external_link ?? "");
      setVideoUrl(existingScript.video_url ?? "");
      setThumbnailUrl(existingScript.thumbnail_url ?? "");
      setScriptType(existingScript.script_type);
      setLuaCode((existingScript as any).lua_code ?? "");
      setFeatures((existingScript as any).features ?? []);
      setTags((existingScript as any).tags ?? []);
      setRelatedTutorialId((existingScript as any).related_tutorial_id ?? "");
    }
  }, [existingScript]);

  const canEdit = isAdmin || (isModder && existingScript?.modder_id === user?.id);

  if (loading || rolesLoading) return <Layout><div className="container py-16 text-center">Carregando...</div></Layout>;
  if (!user || (!isAdmin && !isModder)) return <Navigate to="/" />;
  if (isEditing && existingScript && !canEdit) return <Navigate to="/" />;

  const addFeature = () => {
    if (newFeature.trim()) {
      setFeatures([...features, newFeature.trim()]);
      setNewFeature("");
    }
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim().toLowerCase())) {
      setTags([...tags, newTag.trim().toLowerCase()]);
      setNewTag("");
    }
  };

  const handleSave = async (targetPublishStatus: string) => {
    if (!user || !title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    // Block publication if script was flagged as malicious
    if (
      targetPublishStatus === "published" &&
      lastAnalysis?.classification === "malicious"
    ) {
      toast.error("🚫 Script classificado como MALICIOSO. A publicação foi bloqueada. Corrija as ameaças detectadas e reanalize.");
      return;
    }

    // Warn on suspicious scripts being published
    if (
      targetPublishStatus === "published" &&
      lastAnalysis?.classification === "suspicious"
    ) {
      toast.warning("⚠️ Script classificado como SUSPEITO. Revise as ameaças antes de publicar.");
    }

    setSubmitting(true);

    let fileUrl = existingScript?.file_url ?? null;
    if (file) {
      const safeName = await validateFileWithToast({ file, type: "script", maxSizeMB: 20 });
      if (!safeName) { setSubmitting(false); return; }
      const path = `${user.id}/${safeName}`;
      const { error: uploadError } = await supabase.storage.from("scripts").upload(path, file);
      if (uploadError) {
        toast.error("Erro no upload: " + uploadError.message);
        setSubmitting(false);
        return;
      }
      const { data: publicData } = supabase.storage.from("scripts").getPublicUrl(path);
      fileUrl = publicData.publicUrl;
    }

    const scriptData: any = {
      title,
      description,
      category_id: categoryId || null,
      status: status as any,
      publish_status: targetPublishStatus,
      is_paid: isPaid,
      price: isPaid ? parseFloat(price) : 0,
      file_url: fileUrl,
      external_link: externalLink || null,
      video_url: videoUrl || null,
      thumbnail_url: thumbnailUrl || null,
      script_type: scriptType as any,
      game_name: gameName || null,
      version: version || "1.0",
      features,
      tags,
      lua_code: luaCode || null,
      related_tutorial_id: relatedTutorialId && relatedTutorialId !== "none" ? relatedTutorialId : null,
    };

    let error;
    if (isEditing) {
      ({ error } = await supabase.from("scripts").update(scriptData).eq("id", id!));
    } else {
      scriptData.modder_id = user.id;
      const { data: inserted, error: insErr } = await supabase.from("scripts").insert(scriptData).select("id").single();
      error = insErr;

      // Handle password for paid scripts
      if (!insErr && isPaid && scriptPassword.trim() && inserted) {
        await supabase.from("script_passwords").insert({
          script_id: inserted.id,
          password: scriptPassword.trim(),
          is_permanent: passwordPermanent,
          expires_at: !passwordPermanent && passwordExpiry ? new Date(passwordExpiry).toISOString() : null,
        });
      }
    }

    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      const statusLabels: Record<string, string> = {
        draft: "Salvo como rascunho!",
        pending_review: "Enviado para revisão!",
        published: "Publicado com sucesso!",
        archived: "Arquivado!",
      };
      toast.success(statusLabels[targetPublishStatus] ?? "Salvo!");
      queryClient.invalidateQueries({ queryKey: ["admin-scripts"] });
      queryClient.invalidateQueries({ queryKey: ["my-scripts"] });
      navigate(isAdmin ? "/admin" : "/dashboard");
    }

    setSubmitting(false);
  };

  return (
    <Layout>
      <div className="container py-8 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold font-mono">
            {isEditing ? "Editar Script" : "Novo Script"}
          </h1>
          {publishStatus !== "published" && (
            <Badge variant="outline" className="text-xs">
              {publishStatus === "draft" ? "Rascunho" : publishStatus === "pending_review" ? "Em Revisão" : publishStatus === "archived" ? "Arquivado" : publishStatus}
            </Badge>
          )}
        </div>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card className="neon-border bg-card/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCode className="h-4 w-4 text-primary" /> Informações Básicas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Tipo de conteúdo</Label>
                <Tabs value={scriptType} onValueChange={setScriptType}>
                  <TabsList className="grid w-full max-w-xs grid-cols-2">
                    <TabsTrigger value="script" className="gap-2"><Code className="h-4 w-4" /> Script</TabsTrigger>
                    <TabsTrigger value="apk" className="gap-2"><Package className="h-4 w-4" /> APK / Mod</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Título *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Auto Farm Script" required />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Gamepad2 className="h-3.5 w-3.5" /> Jogo</Label>
                  <Input value={gameName} onChange={(e) => setGameName(e.target.value)} placeholder="Ex: Roblox, Free Fire" />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>Versão</Label>
                  <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0" />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categories?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status Operacional</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="working">Working</SelectItem>
                      <SelectItem value="detected">Detected</SelectItem>
                      <SelectItem value="updating">Updating</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Descreva o que este script faz..." />
              </div>

              <div>
                <Label>Thumbnail URL</Label>
                <Input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="https://..." />
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card className="neon-border bg-card/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <List className="h-4 w-4 text-accent" /> Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
                  placeholder="Ex: Auto Farm, Anti-Ban..."
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={addFeature}><Plus className="h-4 w-4" /></Button>
              </div>
              {features.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {features.map((f, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 pr-1">
                      {f}
                      <button onClick={() => setFeatures(features.filter((_, j) => j !== i))} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card className="neon-border bg-card/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-4 w-4 text-neon-cyan" /> Tags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  placeholder="Ex: roblox, farm, lua..."
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={addTag}><Plus className="h-4 w-4" /></Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((t, i) => (
                    <Badge key={i} variant="outline" className="gap-1 pr-1 text-neon-cyan border-neon-cyan/30">
                      #{t}
                      <button onClick={() => setTags(tags.filter((_, j) => j !== i))} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lua Code Editor */}
          <Card className="neon-border bg-card/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Code className="h-4 w-4 text-neon-green" /> Código Lua
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative rounded-lg overflow-hidden border border-border bg-[hsl(240,15%,3%)]">
                <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 border-b border-border">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-destructive/60" />
                    <span className="w-3 h-3 rounded-full bg-primary/60" />
                    <span className="w-3 h-3 rounded-full bg-accent/60" />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono ml-2">script.lua</span>
                </div>
                <LuaCodeEditor
                  value={luaCode}
                  onChange={setLuaCode}
                  placeholder="-- Cole ou escreva seu código Lua aqui\n\nlocal player = game.Players.LocalPlayer\nlocal character = player.Character\n\n-- Seu script aqui..."
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Cole o código Lua do script. Será exibido com formatação na página do script.</p>

              {/* Script Analysis */}
              {luaCode.trim().length > 10 && (
                <div className="mt-4">
                  <ScriptAnalysis code={luaCode} scriptId={id} onAnalysisComplete={setLastAnalysis} />
                </div>
              )}

            </CardContent>
          </Card>

          {/* Video & Files */}
          <Card className="neon-border bg-card/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" /> Mídia & Arquivos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>URL do Vídeo (YouTube)</Label>
                <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Arquivo para download</Label>
                  <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} accept=".lua,.zip,.rar,.apk" />
                  {existingScript?.file_url && !file && (
                    <p className="text-[10px] text-muted-foreground mt-1">Arquivo atual mantido. Selecione novo para substituir.</p>
                  )}
                </div>
                <div>
                  <Label>Link externo (opcional)</Label>
                  <Input value={externalLink} onChange={(e) => setExternalLink(e.target.value)} placeholder="https://..." />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Related Tutorial */}
          <Card className="neon-border bg-card/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-neon-pink" /> Tutorial Relacionado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={relatedTutorialId} onValueChange={setRelatedTutorialId}>
                <SelectTrigger><SelectValue placeholder="Nenhum tutorial vinculado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {tutorials?.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Pricing & Protection */}
          <Card className="neon-border bg-card/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" /> Preço & Proteção
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Switch checked={isPaid} onCheckedChange={setIsPaid} />
                <Label>Script Pago</Label>
                {isPaid && (
                  <Input type="number" placeholder="Preço (R$)" value={price} onChange={(e) => setPrice(e.target.value)} className="w-32" step="0.01" />
                )}
              </div>

              {isPaid && !isEditing && (
                <div className="space-y-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
                  <div>
                    <Label>Senha do Script</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={scriptPassword}
                        onChange={(e) => setScriptPassword(e.target.value)}
                        placeholder="Crie uma senha forte"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Switch checked={passwordPermanent} onCheckedChange={setPasswordPermanent} />
                    <Label className="text-sm">{passwordPermanent ? "Senha permanente" : "Senha com prazo"}</Label>
                  </div>
                  {!passwordPermanent && (
                    <div>
                      <Label>Expira em</Label>
                      <Input type="datetime-local" value={passwordExpiry} onChange={(e) => setPasswordExpiry(e.target.value)} />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pb-8">
            <Button
              variant="outline"
              onClick={() => handleSave("draft")}
              disabled={submitting}
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" /> Salvar Rascunho
            </Button>

            {!isAdmin && (
              <Button
                variant="outline"
                onClick={() => handleSave("pending_review")}
                disabled={submitting}
                className="flex-1 border-primary/30 text-primary hover:bg-primary/10"
              >
                <Send className="h-4 w-4 mr-2" /> Enviar para Revisão
              </Button>
            )}

            {isAdmin && (
              <Button
                onClick={() => handleSave("published")}
                disabled={submitting || lastAnalysis?.classification === "malicious"}
                className={`flex-1 ${
                  lastAnalysis?.classification === "malicious"
                    ? "bg-destructive/20 text-destructive border-destructive/30 cursor-not-allowed"
                    : "neon-glow-green bg-accent text-accent-foreground hover:bg-accent/90"
                }`}
                title={lastAnalysis?.classification === "malicious" ? "Bloqueado: script malicioso detectado" : undefined}
              >
                {lastAnalysis?.classification === "malicious" ? (
                  <><ShieldX className="h-4 w-4 mr-2" /> Publicação Bloqueada</>
                ) : (
                  <><Eye className="h-4 w-4 mr-2" /> Publicar</>
                )}
              </Button>
            )}

            {isAdmin && isEditing && (
              <Button
                variant="outline"
                onClick={() => handleSave("archived")}
                disabled={submitting}
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                Arquivar
              </Button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
