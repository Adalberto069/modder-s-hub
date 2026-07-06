import { useState, useEffect, useCallback } from "react";
import { validateFileWithToast } from "@/lib/secure-upload";
import { detectLuaObfuscation } from "@/lib/lua-obfuscation";
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
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [apkUploading, setApkUploading] = useState(false);
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
      // Pass script_id so the edge function updates security status server-side
      const { data: scanResult, error } = await supabase.functions.invoke("analyze-script", {
        body: { code, script_id: scriptId },
      });

      if (error || scanResult?.error) {
        console.error("Auto-scan failed:", error || scanResult?.error);
        return requestedStatus;
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

      // Route based on server-side classification result
      if (scanResult.classification === "malicious") {
        toast.error("🚫 Script MALICIOSO detectado! Publicação bloqueada automaticamente.");
        return "draft";
      }

      if (scanResult.classification === "suspicious") {
        const finalStatus = requestedStatus === "published" ? "pending_review" : requestedStatus;
        toast.warning("⚠️ Padrões suspeitos detectados. Script enviado para moderação.");
        return finalStatus;
      }

      if (requestedStatus === "published") {
        toast.success("✅ Script verificado e publicado automaticamente!");
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

    // Bloqueia código já ofuscado/empacotado — HiddenMod faz a proteção no servidor
    if (luaCode && luaCode.trim()) {
      const check = detectLuaObfuscation(luaCode);
      if (check.obfuscated) {
        await (supabase as any).from("script_upload_blocks").insert({
          user_id: user.id,
          script_id: id ?? null,
          reason: check.reason ?? "obfuscation detected",
          source: "pasted_code",
          metadata: {
            title,
            code_length: luaCode.length,
            target_publish_status: targetPublishStatus,
            user_agent: navigator.userAgent,
          },
        });
        toast.error("🚫 Envio bloqueado: o código parece ofuscado/empacotado. " + check.reason + " Envie o código-fonte original — a HiddenMod aplica a proteção automaticamente.");
        return;
      }
    }

    setSubmitting(true);

    let fileUrl = existingScript?.file_url ?? null;
    if (file) {
      const safeName = await validateFileWithToast({ file, type: "script", maxSizeMB: 20 });
      if (!safeName) { setSubmitting(false); return; }

      // Lê o conteúdo do .lua e bloqueia se vier ofuscado
      try {
        const fileText = await file.text();
        const fileCheck = detectLuaObfuscation(fileText);
        if (fileCheck.obfuscated) {
          await (supabase as any).from("script_upload_blocks").insert({
            user_id: user.id,
            script_id: id ?? null,
            reason: fileCheck.reason ?? "obfuscation detected",
            source: "uploaded_file",
            metadata: {
              title,
              file_name: file.name,
              file_size: file.size,
              target_publish_status: targetPublishStatus,
              user_agent: navigator.userAgent,
            },
          });
          toast.error("🚫 Arquivo .lua bloqueado: " + fileCheck.reason + " Envie a fonte original.");
          setSubmitting(false);
          return;
        }
      } catch {
        // se não conseguir ler, segue (validateFileWithToast já checou tipo/tamanho)
      }

      const path = `${user.id}/${safeName}`;
      // Upload .lua files to private bucket
      const { error: uploadError } = await supabase.storage.from("scripts-private").upload(path, file, { upsert: true });
      if (uploadError) {
        toast.error("Erro no upload: " + uploadError.message);
        setSubmitting(false);
        return;
      }
      // Store just the path, not a public URL
      fileUrl = path;
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

        // Anti-resale: compute code hash and check for duplicates on publish
        if (targetPublishStatus === "published" || targetPublishStatus === "pending_review") {
          const codeNormalized = luaCode.replace(/\s+/g, " ").trim();
          const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeNormalized));
          const codeHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

          // Check if another script has the same hash
          const { data: duplicates } = await (supabase as any)
            .from("scripts")
            .select("id, title, modder_id")
            .eq("code_hash", codeHash)
            .neq("id", savedScriptId!)
            .eq("publish_status", "published");

          if (duplicates && duplicates.length > 0) {
            const dup = duplicates[0];
            if (dup.modder_id !== user.id) {
              toast.error(`🚫 Código duplicado detectado! Este script é idêntico a "${dup.title}" já publicado por outro modder. Publicação bloqueada.`);
              // Revert to draft
              await supabase.from("scripts").update({ publish_status: "draft" } as any).eq("id", savedScriptId!);
              setSubmitting(false);
              return;
            }
          }

          // Save the hash
          await supabase.from("scripts").update({ code_hash: codeHash } as any).eq("id", savedScriptId!);
        }
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

  const statusBadge = () => {
    if (publishStatus === "published") return null;
    const map: Record<string, { label: string; cls: string }> = {
      draft: { label: "Rascunho", cls: "bg-white/5 text-muted-foreground border-white/10" },
      pending_review: { label: "Em revisão", cls: "bg-neon-purple/10 text-neon-purple border-neon-purple/30" },
      archived: { label: "Arquivado", cls: "bg-destructive/10 text-destructive border-destructive/30" },
    };
    const m = map[publishStatus] ?? { label: publishStatus, cls: "bg-white/5 text-muted-foreground border-white/10" };
    return <Badge variant="outline" className={`text-[10px] uppercase tracking-widest font-bold ${m.cls}`}>{m.label}</Badge>;
  };

  const SectionCard = ({ icon: Icon, title, hint, children }: any) => (
    <Card className="border-white/5 bg-card/40 rounded-xl shadow-none">
      <CardHeader className="pb-3 border-b border-white/5">
        <CardTitle className="text-xs font-black uppercase tracking-[0.18em] flex items-center gap-2 text-foreground/90">
          <Icon className="h-3.5 w-3.5 text-neon-purple" /> {title}
        </CardTitle>
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </CardHeader>
      <CardContent className="p-5 space-y-5">{children}</CardContent>
    </Card>
  );

  const FieldLabel = ({ children }: { children: React.ReactNode }) => (
    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{children}</Label>
  );

  const inputCls = "bg-white/[0.03] border-white/10 focus-visible:border-neon-purple/50 focus-visible:ring-neon-purple/20 h-10";

  return (
    <Layout>
      <div className="container py-8 max-w-4xl pb-32">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {isEditing ? "Editar script" : "Novo script"}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Preencha as informações abaixo. Você pode salvar como rascunho a qualquer momento.
            </p>
          </div>
          {statusBadge()}
        </div>

        <div className="space-y-5">
          {/* 1. Fundamentos */}
          <SectionCard icon={FileCode} title="Fundamentos" hint="O básico para publicar o script.">
            <div className="space-y-2">
              <FieldLabel>Tipo de projeto</FieldLabel>
              <Tabs value={scriptType} onValueChange={setScriptType} className="w-full">
                <TabsList className="grid w-full max-w-xs grid-cols-2 bg-white/5 border border-white/10 p-1 h-10">
                  <TabsTrigger value="script" className="gap-2 text-xs data-[state=active]:bg-neon-purple data-[state=active]:text-white">
                    <Code className="h-3.5 w-3.5" /> Lua Script
                  </TabsTrigger>
                  <TabsTrigger value="apk" className="gap-2 text-xs data-[state=active]:bg-neon-cyan data-[state=active]:text-white">
                    <Package className="h-3.5 w-3.5" /> APK Mod
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <FieldLabel>Título *</FieldLabel>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Hidden Mod Script v1.0" className={inputCls} required />
              </div>
              <div className="space-y-2">
                <FieldLabel><span className="inline-flex items-center gap-1"><Gamepad2 className="h-3 w-3" /> Jogo alvo</span></FieldLabel>
                <Input value={gameName} onChange={(e) => setGameName(e.target.value)} placeholder="Ex: Free Fire" className={inputCls} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Versão</FieldLabel>
                <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" className={`${inputCls} font-mono`} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Categoria</FieldLabel>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-[#0a0a0c] border-white/10">
                    {categories?.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel>Status operacional</FieldLabel>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0a0a0c] border-white/10">
                    <SelectItem value="working" className="text-neon-green">Working</SelectItem>
                    <SelectItem value="detected" className="text-neon-pink">Detected</SelectItem>
                    <SelectItem value="updating" className="text-neon-cyan">Updating</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel>Descrição</FieldLabel>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Explique o que o script faz e como usar..."
                className="bg-white/[0.03] border-white/10 focus-visible:border-neon-purple/50 focus-visible:ring-neon-purple/20 resize-none"
              />
            </div>
          </SectionCard>

          {/* 2. Código Lua */}
          {scriptType === "script" && (
            <SectionCard
              icon={Code}
              title="Código Lua"
              hint="Cole seu código original OU envie o arquivo .lua. Nunca envie código já ofuscado — a HiddenMod aplica a proteção automaticamente."
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FieldLabel>Enviar arquivo .lua (opcional)</FieldLabel>
                  {file && <span className="text-[10px] font-mono text-neon-cyan truncate max-w-[200px]">{file.name}</span>}
                </div>
                <Input
                  type="file"
                  accept=".lua"
                  onChange={async (e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (!f) { setFile(null); return; }
                    const safeName = await validateFileWithToast({ file: f, type: "script", maxSizeMB: 20 });
                    if (!safeName) { e.target.value = ""; setFile(null); return; }
                    setFile(f);
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const content = ev.target?.result as string;
                      if (content) setLuaCode(content);
                    };
                    reader.readAsText(f);
                  }}
                  className="bg-white/[0.03] border-white/10 h-10 file:bg-neon-cyan/20 file:text-neon-cyan file:border-none file:px-3 file:mr-3 file:text-xs file:font-bold hover:file:bg-neon-cyan/30 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Código-fonte (editável)</FieldLabel>
                <div className="rounded-lg overflow-hidden border border-white/10 bg-[hsl(240,15%,3%)]">
                  <LuaCodeEditor
                    value={luaCode}
                    onChange={setLuaCode}
                    minHeight="260px"
                    placeholder="-- Cole ou escreva seu código Lua original aqui"
                  />
                </div>
              </div>

              {luaCode.trim().length > 10 && (
                <div className="pt-2 border-t border-white/5">
                  <div className="mb-3">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-neon-green">Análise de segurança</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Verificamos o código antes da publicação.</p>
                  </div>
                  <ScriptAnalysis code={luaCode} scriptId={id} onAnalysisComplete={setLastAnalysis} />
                </div>
              )}
            </SectionCard>
          )}

          {/* 3. Mídia */}
          <SectionCard icon={Upload} title="Mídia" hint="Capa, vídeo demonstrativo e link externo.">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldLabel>URL da thumbnail</FieldLabel>
                <Input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="https://..." className={inputCls} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Upload direto (máx 1MB)</FieldLabel>
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
                  className="bg-white/[0.03] border-white/10 h-10 file:bg-neon-purple/20 file:text-neon-purple file:border-none file:px-3 file:mr-3 file:text-xs file:font-bold hover:file:bg-neon-purple/30 cursor-pointer"
                />
              </div>
            </div>
            {thumbnailUrl && (
              <div className="rounded-lg overflow-hidden border border-white/10 w-32 h-20">
                <img src={thumbnailUrl} alt="preview" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldLabel>Vídeo (YouTube/Vimeo)</FieldLabel>
                <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className={inputCls} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Link externo (Discord, GitHub...)</FieldLabel>
                <Input value={externalLink} onChange={(e) => setExternalLink(e.target.value)} placeholder="https://..." className={inputCls} />
              </div>
            </div>
          </SectionCard>

          {/* 4. Divulgação */}
          <SectionCard icon={Tag} title="Divulgação" hint="Funcionalidades, tags e tutorial de apoio ajudam usuários a encontrar seu script.">
            <div className="space-y-2">
              <FieldLabel><span className="inline-flex items-center gap-1"><List className="h-3 w-3" /> Funcionalidades</span></FieldLabel>
              <div className="flex gap-2">
                <Input
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
                  placeholder="Ex: Anti-Ban, Speed Hack..."
                  className={inputCls}
                />
                <Button type="button" variant="outline" size="icon" onClick={addFeature} className="h-10 w-10 border-white/10 hover:bg-neon-cyan/10"><Plus className="h-4 w-4 text-neon-cyan" /></Button>
              </div>
              {features.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {features.map((f, i) => (
                    <Badge key={i} className="bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20 px-2 py-0.5 gap-1 font-normal">
                      {f}
                      <button onClick={() => setFeatures(features.filter((_, j) => j !== i))} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <FieldLabel>Tags de busca</FieldLabel>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  placeholder="Ex: roblox, farm..."
                  className={inputCls}
                />
                <Button type="button" variant="outline" size="icon" onClick={addTag} className="h-10 w-10 border-white/10 hover:bg-neon-pink/10"><Plus className="h-4 w-4 text-neon-pink" /></Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tags.map((t, i) => (
                    <Badge key={i} className="bg-neon-pink/10 text-neon-pink border-neon-pink/20 px-2 py-0.5 gap-1 font-normal">
                      #{t}
                      <button onClick={() => setTags(tags.filter((_, j) => j !== i))} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <FieldLabel><span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3" /> Tutorial de apoio</span></FieldLabel>
              <Select value={relatedTutorialId} onValueChange={setRelatedTutorialId}>
                <SelectTrigger className={inputCls}><SelectValue placeholder="Nenhum tutorial vinculado" /></SelectTrigger>
                <SelectContent className="bg-[#0a0a0c] border-white/10">
                  <SelectItem value="none">Nenhum tutorial vinculado</SelectItem>
                  {tutorials?.map((t: any) => (<SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </SectionCard>

          {/* 5. Monetização */}
          <SectionCard icon={Lock} title="Monetização" hint="Defina se o script é gratuito ou pago e o modelo de licença.">
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <Switch checked={isPaid} onCheckedChange={setIsPaid} disabled={!!licenseFieldsLocked} className="data-[state=checked]:bg-orange-500" />
                <div className="space-y-0.5 min-w-0">
                  <Label className="text-sm font-bold">{isPaid ? "Script pago" : "Script gratuito"}</Label>
                  <p className="text-[11px] text-muted-foreground">{isPaid ? "Será vendido no marketplace." : "Livre para download."}</p>
                </div>
              </div>
              {!isPaid && <Badge variant="outline" className="text-neon-green border-neon-green/30 shrink-0">Free</Badge>}
            </div>

            {licenseFieldsLocked && (
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 flex gap-2 items-start">
                <Lock className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-orange-200/80 leading-relaxed">Licença bloqueada — este script já tem compradores. Alterações requerem aprovação admin.</p>
              </div>
            )}

            {isPaid && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FieldLabel>Preço (R$)</FieldLabel>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">R$</span>
                    <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" min="0" step="0.01" disabled={!!licenseFieldsLocked} className={`${inputCls} pl-10 font-bold`} />
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Duração da licença</FieldLabel>
                  <Select value={licenseType} onValueChange={setLicenseType} disabled={!!licenseFieldsLocked}>
                    <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#0a0a0c] border-white/10">
                      <SelectItem value="permanent">Permanente (vitalício)</SelectItem>
                      <SelectItem value="monthly">Mensal (30 dias)</SelectItem>
                      <SelectItem value="weekly">Semanal (7 dias)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#050505]/95 backdrop-blur-xl z-40">
        <div className="container max-w-4xl py-3 flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave("draft")}
            disabled={submitting}
            className="flex-1 h-11 border-white/10 bg-white/5 hover:bg-white/10 font-bold uppercase tracking-widest text-[11px]"
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar rascunho
          </Button>

          {!isAdmin && (
            <Button
              onClick={() => handleSave("pending_review")}
              disabled={submitting}
              className="flex-1 h-11 bg-neon-purple hover:bg-neon-purple/90 text-white font-bold uppercase tracking-widest text-[11px]"
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar para aprovação
            </Button>
          )}

          {isAdmin && (
            <Button
              onClick={() => handleSave("published")}
              disabled={submitting || lastAnalysis?.classification === "malicious"}
              className={`flex-1 h-11 font-bold uppercase tracking-widest text-[11px] ${
                lastAnalysis?.classification === "malicious"
                  ? "bg-destructive/20 text-destructive border border-destructive/30 cursor-not-allowed"
                  : "bg-neon-green hover:bg-neon-green/90 text-black"
              }`}
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : lastAnalysis?.classification === "malicious" ? <ShieldX className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {lastAnalysis?.classification === "malicious" ? "Publicação bloqueada" : "Publicar"}
            </Button>
          )}

          {isAdmin && isEditing && (
            <Button
              variant="outline"
              onClick={() => handleSave("archived")}
              disabled={submitting}
              className="h-11 sm:w-32 border-destructive/20 text-destructive hover:bg-destructive/5 font-bold uppercase tracking-widest text-[11px]"
            >
              Arquivar
            </Button>
          )}
        </div>
      </div>
    </Layout>
  );
}
