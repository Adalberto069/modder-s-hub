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
  Upload, Lock, EyeOff, Gamepad2, Tag, List, FileCode, BookOpen, ShieldX, Loader2,
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

  // License type: "permanent" | "monthly" | "weekly"
  const [licenseType, setLicenseType] = useState<string>("permanent");

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

  // Check if script has purchases (lock license settings) - uses SECURITY DEFINER function to bypass RLS
  const { data: hasPurchases } = useQuery({
    queryKey: ["script-has-purchases", id],
    queryFn: async () => {
      const { data } = await supabase.rpc("script_has_purchases", { _script_id: id! });
      return data === true;
    },
    enabled: isEditing,
  });

  const licenseFieldsLocked = isEditing && hasPurchases && !isAdmin;

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
      // lua_code now lives in script_code table - fetch separately
      (supabase as any).from("script_code").select("lua_code").eq("script_id", existingScript.id).single().then(({ data }: any) => {
        setLuaCode(data?.lua_code ?? "");
      });
      setFeatures((existingScript as any).features ?? []);
      setTags((existingScript as any).tags ?? []);
      setRelatedTutorialId((existingScript as any).related_tutorial_id ?? "");
      const days = (existingScript as any).license_duration_days;
      if (days == null) setLicenseType("permanent");
      else if (days === 7) setLicenseType("weekly");
      else setLicenseType("monthly");
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

  // Auto-scan script and determine publish routing
  const autoScanAndRoute = async (scriptId: string, code: string, requestedStatus: string): Promise<string> => {
    if (!code || code.trim().length < 10) return requestedStatus;

    try {
      const { data: scanResult, error } = await supabase.functions.invoke("analyze-script", {
        body: { code },
      });

      if (error || scanResult?.error) {
        console.error("Auto-scan failed:", error || scanResult?.error);
        return requestedStatus; // Don't block on scan failure
      }

      // Save analysis
      await supabase.from("script_analyses" as any).insert({
        script_id: scriptId,
        analyzed_by: user!.id,
        classification: scanResult.classification,
        security_score: scanResult.securityScore,
        threats: scanResult.threats,
        summary: scanResult.summary,
        functionality: scanResult.functionality,
      } as any);

      setLastAnalysis(scanResult);

      // Route based on classification
      if (scanResult.classification === "malicious") {
        // Block: force to draft and flag
        await supabase.from("scripts").update({
          publish_status: "draft",
          security_status: "flagged",
        } as any).eq("id", scriptId);
        toast.error("🚫 Script MALICIOSO detectado! Publicação bloqueada automaticamente.");
        return "draft";
      }

      if (scanResult.classification === "suspicious") {
        // Hold for review
        const finalStatus = requestedStatus === "published" ? "pending_review" : requestedStatus;
        await supabase.from("scripts").update({
          publish_status: finalStatus,
          security_status: "under_review",
        } as any).eq("id", scriptId);
        toast.warning("⚠️ Padrões suspeitos detectados. Script enviado para moderação.");
        return finalStatus;
      }

      // Safe: publish as requested and mark verified
      if (requestedStatus === "published") {
        await supabase.from("scripts").update({
          security_status: "verified",
          is_verified: true,
        } as any).eq("id", scriptId);
        toast.success("✅ Script verificado e publicado automaticamente!");
      } else {
        await supabase.from("scripts").update({
          security_status: "safe",
        } as any).eq("id", scriptId);
      }

      return requestedStatus;
    } catch (err) {
      console.error("Scan error:", err);
      return requestedStatus;
    }
  };

  const handleSave = async (targetPublishStatus: string) => {
    if (!user || !title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    // Block publication if already flagged as malicious
    if (
      targetPublishStatus === "published" &&
      lastAnalysis?.classification === "malicious"
    ) {
      toast.error("🚫 Script classificado como MALICIOSO. Corrija as ameaças e reanalize.");
      return;
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
      related_tutorial_id: relatedTutorialId && relatedTutorialId !== "none" ? relatedTutorialId : null,
      license_duration_days: isPaid && licenseType !== "permanent" ? (licenseType === "weekly" ? 7 : 30) : null,
    };

    // Block license changes if script has purchases (unless admin)
    if (isEditing && hasPurchases && !isAdmin) {
      delete scriptData.license_duration_days;
      delete scriptData.is_paid;
      delete scriptData.price;
    }

    let error;
    let savedScriptId = id;

    if (isEditing) {
      ({ error } = await supabase.from("scripts").update(scriptData).eq("id", id!));
    } else {
      scriptData.modder_id = user.id;
      const { data: inserted, error: insErr } = await supabase.from("scripts").insert(scriptData).select("id").single();
      error = insErr;
      savedScriptId = inserted?.id;

    }

    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      // Save lua_code to script_code table
      if (savedScriptId && luaCode) {
        await (supabase as any).from("script_code").upsert({ script_id: savedScriptId, lua_code: luaCode, updated_at: new Date().toISOString() }, { onConflict: "script_id" });
      }
      // Auto-scan if publishing or submitting for review, and script has Lua code
      if (savedScriptId && luaCode && luaCode.trim().length > 10 &&
          (targetPublishStatus === "published" || targetPublishStatus === "pending_review")) {
        toast.info("🔍 Escaneando script automaticamente...");
        await autoScanAndRoute(savedScriptId, luaCode, targetPublishStatus);
      } else {
        const statusLabels: Record<string, string> = {
          draft: "Salvo como rascunho!",
          pending_review: "Enviado para revisão!",
          published: "Publicado com sucesso!",
          archived: "Arquivado!",
        };
        toast.success(statusLabels[targetPublishStatus] ?? "Salvo!");
      }

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

        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 uppercase">
              {isEditing ? "Editar Script Elite" : "Novo Script Elite"}
            </h1>
            <p className="text-xs text-muted-foreground font-mono tracking-widest uppercase">HiddenMarket / Forge</p>
          </div>
          {publishStatus !== "published" && (
            <Badge className="bg-neon-purple/20 text-neon-purple border-neon-purple/30 backdrop-blur-md px-4 py-1.5 animate-pulse">
              {publishStatus === "draft" ? "RASCUNHO" : publishStatus === "pending_review" ? "EM REVISÃO" : publishStatus === "archived" ? "ARQUIVADO" : publishStatus.toUpperCase()}
            </Badge>
          )}
        </div>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card className="relative overflow-hidden border-neon-purple/20 bg-card/40 backdrop-blur-xl shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/5 blur-[40px] -z-10" />
            <CardHeader className="pb-4 border-b border-white/5">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground">
                <FileCode className="h-4 w-4 text-neon-purple" /> Informações Básicas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Tipo de projeto</Label>
                <Tabs value={scriptType} onValueChange={setScriptType} className="w-full">
                  <TabsList className="grid w-full max-w-sm grid-cols-2 bg-white/5 border border-white/5 p-1">
                    <TabsTrigger value="script" className="gap-2 data-[state=active]:bg-neon-purple data-[state=active]:text-white">
                      <Code className="h-4 w-4" /> LUA SCRIPT
                    </TabsTrigger>
                    <TabsTrigger value="apk" className="gap-2 data-[state=active]:bg-neon-cyan data-[state=active]:text-white">
                      <Package className="h-4 w-4" /> APK MOD
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Título do Script *</Label>
                  <Input 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    placeholder="Ex: HiddenMod Auto Kill v2" 
                    className="bg-white/5 border-white/10 focus:border-neon-purple/50 focus:ring-neon-purple/20 h-12"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1">
                    <Gamepad2 className="h-3.5 w-3.5" /> Jogo Alvo
                  </Label>
                  <Input 
                    value={gameName} 
                    onChange={(e) => setGameName(e.target.value)} 
                    placeholder="Ex: Free Fire, Roblox" 
                    className="bg-white/5 border-white/10 focus:border-neon-purple/50 focus:ring-neon-purple/20 h-12"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Versão</Label>
                  <Input 
                    value={version} 
                    onChange={(e) => setVersion(e.target.value)} 
                    placeholder="1.0.0" 
                    className="bg-white/5 border-white/10 focus:border-neon-purple/50 focus:ring-neon-purple/20 h-12 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Categoria</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-12"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="bg-[#0a0a0c] border-white/10">
                      {categories?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Status Operacional</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-12"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#0a0a0c] border-white/10">
                      <SelectItem value="working" className="text-neon-green">WORKING</SelectItem>
                      <SelectItem value="detected" className="text-neon-pink">DETECTED</SelectItem>
                      <SelectItem value="updating" className="text-neon-cyan">UPDATING</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Descrição Detalhada</Label>
                <Textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  rows={4} 
                  placeholder="Explique as funcionalidades e como usar seu script..." 
                  className="bg-white/5 border-white/10 focus:border-neon-purple/50 focus:ring-neon-purple/20 resize-none"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Thumbnail URL</Label>
                  <Input 
                    value={thumbnailUrl} 
                    onChange={(e) => setThumbnailUrl(e.target.value)} 
                    placeholder="https://sua-imagem.com/preview.jpg" 
                    className="bg-white/5 border-white/10 h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Upload Direto</Label>
                  <div className="relative group">
                    <Input 
                      type="file" 
                      accept=".jpg,.jpeg,.png,.webp" 
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const safeName = await validateFileWithToast({ file: f, type: "image", maxSizeMB: 1 });
                        if (!safeName) { e.target.value = ""; return; }
                        toast.info("Enviando miniatura...");
                        const path = `thumbnails/${user!.id}/${safeName}`;
                        const { error: uploadError } = await supabase.storage.from("scripts").upload(path, f);
                        if (uploadError) { toast.error("Erro no upload: " + uploadError.message); return; }
                        const { data: { publicUrl } } = supabase.storage.from("scripts").getPublicUrl(path);
                        setThumbnailUrl(publicUrl);
                        toast.success("Miniatura enviada!");
                      }}
                      className="bg-white/5 border-white/10 h-10 file:bg-neon-purple/20 file:text-neon-purple file:border-none file:px-3 file:mr-3 file:text-xs file:font-bold hover:file:bg-neon-purple/30 transition-all cursor-pointer"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">Máx: 1MB. JPG, PNG ou WebP.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card className="relative overflow-hidden border-white/5 bg-card/40 backdrop-blur-xl shadow-lg">
            <CardHeader className="pb-4 border-b border-white/5">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground">
                <List className="h-4 w-4 text-neon-cyan" /> Funcionalidades (Features)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
                  placeholder="Ex: Anti-Ban Bypass, Speed Hack..."
                  className="bg-white/5 border-white/10 h-11"
                />
                <Button type="button" variant="outline" size="icon" onClick={addFeature} className="h-11 w-11 hover:bg-neon-cyan/20 border-white/10"><Plus className="h-4 w-4 text-neon-cyan" /></Button>
              </div>
              {features.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {features.map((f, i) => (
                    <Badge key={i} className="bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20 px-3 py-1 gap-1 group">
                      {f}
                      <button onClick={() => setFeatures(features.filter((_, j) => j !== i))} className="ml-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card className="relative overflow-hidden border-white/5 bg-card/40 backdrop-blur-xl shadow-lg">
            <CardHeader className="pb-4 border-b border-white/5">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground">
                <Tag className="h-4 w-4 text-neon-pink" /> Tags de Descoberta
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  placeholder="Ex: roblox, farm, injector..."
                  className="bg-white/5 border-white/10 h-11"
                />
                <Button type="button" variant="outline" size="icon" onClick={addTag} className="h-11 w-11 hover:bg-neon-pink/20 border-white/10"><Plus className="h-4 w-4 text-neon-pink" /></Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {tags.map((t, i) => (
                    <Badge key={i} className="bg-neon-pink/10 text-neon-pink border-neon-pink/20 px-3 py-1 gap-1 group">
                      #{t}
                      <button onClick={() => setTags(tags.filter((_, j) => j !== i))} className="ml-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Code Preview */}
          {luaCode && (
            <Card className="relative overflow-hidden border-neon-green/20 bg-[#060608]/90 backdrop-blur-xl shadow-2xl">
              <CardHeader className="pb-4 border-b border-white/5">
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-neon-green">
                  <Code className="h-4 w-4" /> HiddenForge Editor
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[hsl(240,15%,2%)] shadow-inner">
                  <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5">
                    <div className="flex gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">RO/Preview Mode</span>
                  </div>
                  <LuaCodeEditor
                    value={luaCode.split("\n").slice(0, 25).join("\n") + (luaCode.split("\n").length > 25 ? "\n\n-- [CONTEÚDO ADICIONAL OCULTO NO PREVIEW]" : "")}
                    readOnly
                    minHeight="300px"
                  />
                </div>
                
                {/* Script Analysis Integration */}
                {luaCode.trim().length > 10 && (
                  <div className="mt-8 pt-8 border-t border-white/5">
                    <div className="mb-4 space-y-1">
                      <h4 className="text-xs font-black uppercase tracking-widest text-neon-green">Análise de Segurança Automática</h4>
                      <p className="text-[10px] text-muted-foreground">O HiddenMarket analisa seu código em tempo real para garantir padrões de segurança.</p>
                    </div>
                    <ScriptAnalysis code={luaCode} scriptId={id} onAnalysisComplete={setLastAnalysis} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Video & Files */}
          <Card className="relative overflow-hidden border-white/5 bg-card/40 backdrop-blur-xl shadow-lg">
            <CardHeader className="pb-4 border-b border-white/5">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground">
                <Upload className="h-4 w-4 text-neon-cyan" /> Mídia & Arquivos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">URL Vídeo Demonstração (YouTube/Vimeo)</Label>
                <Input 
                  value={videoUrl} 
                  onChange={(e) => setVideoUrl(e.target.value)} 
                  placeholder="https://youtube.com/watch?v=..." 
                  className="bg-white/5 border-white/10 h-11"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Script Principal (.lua)</Label>
                  <Input 
                    type="file" 
                    onChange={async (e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (!f) { setFile(null); return; }
                      const safeName = await validateFileWithToast({ file: f, type: "script", maxSizeMB: 20 });
                      if (!safeName) { e.target.value = ""; setFile(null); return; }
                      setFile(f);
                      if (f.name.toLowerCase().endsWith(".lua")) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const content = ev.target?.result as string;
                          if (content) setLuaCode(content);
                        };
                        reader.readAsText(f);
                      }
                    }} 
                    accept=".lua" 
                    className="bg-white/5 border-white/10 h-11 file:bg-neon-cyan/20 file:text-neon-cyan file:border-none file:px-3 file:mr-3 file:text-xs file:font-bold hover:file:bg-neon-cyan/30 transition-all cursor-pointer"
                  />
                  <p className="text-[10px] text-neon-cyan/80 font-bold uppercase tracking-widest pt-1">⚠️ Apenas .lua permitido.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Link Externo Adicional</Label>
                  <Input 
                    value={externalLink} 
                    onChange={(e) => setExternalLink(e.target.value)} 
                    placeholder="Discord, GitHub, etc." 
                    className="bg-white/5 border-white/10 h-11"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Related Tutorial */}
          <Card className="relative overflow-hidden border-white/5 bg-card/40 backdrop-blur-xl shadow-lg">
            <CardHeader className="pb-4 border-b border-white/5">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground">
                <BookOpen className="h-4 w-4 text-neon-pink" /> Tutorial de Apoio
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Select value={relatedTutorialId} onValueChange={setRelatedTutorialId}>
                <SelectTrigger className="bg-white/5 border-white/10 h-11"><SelectValue placeholder="Selecione um tutorial de suporte" /></SelectTrigger>
                <SelectContent className="bg-[#0a0a0c] border-white/10">
                  <SelectItem value="none">Nenhum tutorial vinculado</SelectItem>
                  {tutorials?.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Pricing & Protection */}
          <Card className="relative overflow-hidden border-orange-500/20 bg-card/40 backdrop-blur-xl shadow-lg">
             <CardHeader className="pb-4 border-b border-white/5">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-orange-500">
                <Lock className="h-4 w-4" /> Monetização & Segurança
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-4">
                  <Switch checked={isPaid} onCheckedChange={setIsPaid} disabled={!!licenseFieldsLocked} className="data-[state=checked]:bg-orange-500" />
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold">{isPaid ? "PROJETO COMERCIAL" : "PROJETO GRATUITO"}</Label>
                    <p className="text-[10px] text-muted-foreground">Defina se seu script será vendido ou livre.</p>
                  </div>
                </div>
                {!isPaid && <Badge variant="outline" className="text-neon-green border-neon-green/30">LIVRE</Badge>}
              </div>

              {licenseFieldsLocked && (
                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex gap-3">
                  <Lock className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-orange-200/80 leading-relaxed font-medium">Configurações de licença bloqueadas. Este script já possui proprietários. Alterações de preço requerem autorização administrativa.</p>
                </div>
              )}

              {isPaid && (
                <div className="grid md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Preço de Venda (R$)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">R$</span>
                      <Input 
                        type="number" 
                        value={price} 
                        onChange={(e) => setPrice(e.target.value)} 
                        placeholder="0.00" 
                        min="0" 
                        step="0.01" 
                        disabled={!!licenseFieldsLocked} 
                        className="bg-white/5 border-white/10 pl-10 h-12 font-bold text-lg"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Modelo de Licença</Label>
                    <Select value={licenseType} onValueChange={setLicenseType} disabled={!!licenseFieldsLocked}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0a0c] border-white/10">
                        <SelectItem value="permanent">💎 Permanente (Vitalício)</SelectItem>
                        <SelectItem value="monthly">📅 Mensal (Subscrição)</SelectItem>
                        <SelectItem value="weekly">⏳ Semanal (Trial/Plus)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground italic pt-1">
                      {licenseType === "permanent" && "O comprador terá acesso vitalício a todas as atualizações."}
                      {licenseType === "monthly" && "Assinatura recorrente disponível por 30 dias."}
                      {licenseType === "weekly" && "Acesso rápido por 7 dias."}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pb-12">
            <Button
              variant="outline"
              onClick={() => handleSave("draft")}
              disabled={submitting}
              className="flex-1 h-14 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 font-bold uppercase tracking-widest text-xs transition-all"
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar como Rascunho
            </Button>

            {!isAdmin && (
              <Button
                variant="outline"
                onClick={() => handleSave("pending_review")}
                disabled={submitting}
                className="flex-1 h-14 rounded-xl border-neon-purple/20 bg-neon-purple/5 text-neon-purple hover:bg-neon-purple/10 font-bold uppercase tracking-widest text-xs shadow-lg shadow-neon-purple/5 transition-all"
              >
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar para Aprovação
              </Button>
            )}

            {isAdmin && (
              <Button
                onClick={() => handleSave("published")}
                disabled={submitting || lastAnalysis?.classification === "malicious"}
                className={`flex-1 h-14 rounded-xl font-bold uppercase tracking-widest text-xs transition-all shadow-xl ${
                  lastAnalysis?.classification === "malicious"
                    ? "bg-destructive/20 text-destructive border-destructive/30 cursor-not-allowed"
                    : "bg-neon-green hover:bg-neon-green/90 text-black shadow-neon-green/20"
                }`}
                title={lastAnalysis?.classification === "malicious" ? "Bloqueado: script malicioso detectado" : undefined}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : lastAnalysis?.classification === "malicious" ? (
                  <ShieldX className="h-4 w-4 mr-2" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                {lastAnalysis?.classification === "malicious" ? "Publicação Bloqueada" : "Lançar no Marketplace"}
              </Button>
            )}

            {isAdmin && isEditing && (
              <Button
                variant="outline"
                onClick={() => handleSave("archived")}
                disabled={submitting}
                className="h-14 px-8 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/5 font-bold uppercase tracking-widest text-xs transition-all"
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
