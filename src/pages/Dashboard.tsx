import { useState } from "react";
import { validateFileWithToast } from "@/lib/secure-upload";
import { Layout } from "@/components/layout/Layout";
import { ModderFinanceTab } from "@/components/modder/ModderFinanceTab";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, Download, Star, DollarSign, Plus, Trash2, Code, Package, Pencil, Key, Copy, ShoppingBag, EyeOff, Eye, Clock, RefreshCw } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { user, isModder, loading, profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("purchases");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<string>("working");
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scriptType, setScriptType] = useState<string>("script");

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*");
      return data ?? [];
    },
  });

  // Modder scripts
  const { data: myScripts } = useQuery({
    queryKey: ["my-scripts", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("scripts")
        .select("*, categories(name)")
        .eq("modder_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user && isModder,
  });

  // Purchased scripts with licenses (for ALL users)
  const { data: myLicenses } = useQuery({
    queryKey: ["my-licenses", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("licenses")
        .select("*, scripts(id, title, description, game_name, thumbnail_url, version)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  if (loading) return <Layout><div className="container py-16 text-center">Carregando...</div></Layout>;
  if (!user) return <Navigate to="/auth" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    let fileUrl = null;
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

    const { error } = await supabase.from("scripts").insert({
      modder_id: user.id,
      title,
      description,
      category_id: categoryId || null,
      status: status as any,
      is_paid: isPaid,
      price: isPaid ? parseFloat(price) : 0,
      file_url: fileUrl,
      external_link: externalLink || null,
      script_type: scriptType as any,
    });

    if (error) {
      toast.error("Erro: " + error.message);
      setSubmitting(false);
      return;
    }

    toast.success(scriptType === "script" ? "Script publicado!" : "APK/Mod publicado!");
    setTitle(""); setDescription(""); setCategoryId(""); setStatus("working");
    setIsPaid(false); setPrice(""); setExternalLink(""); setFile(null);
    setScriptType("script"); setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ["my-scripts"] });
    setSubmitting(false);
  };

  const handleDelete = async (scriptId: string) => {
    // Check if script has purchases using SECURITY DEFINER function
    const { data: scriptHasPurchases } = await supabase.rpc("script_has_purchases", { _script_id: scriptId });
    if (scriptHasPurchases) {
      toast.error("Este script possui compras e não pode ser excluído. Você pode desativá-lo.");
      return;
    }
    const { error } = await supabase.from("scripts").delete().eq("id", scriptId);
    if (error) toast.error(error.message);
    else {
      toast.success("Removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["my-scripts"] });
    }
  };

  const handleToggleActive = async (scriptId: string, currentActive: boolean) => {
    const { error } = await supabase.from("scripts").update({ is_active: !currentActive } as any).eq("id", scriptId);
    if (error) { toast.error(error.message); return; }
    toast.success(currentActive ? "Script desativado. Compradores existentes ainda têm acesso." : "Script reativado!");
    queryClient.invalidateQueries({ queryKey: ["my-scripts"] });
  };

  const handleDownloadLoader = (license: any) => {
    const script = license.scripts;
    if (!script) return;

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "rdagqukqmphvlxbrefil";
    const baseUrl = `https://${projectId}.supabase.co/functions/v1`;

    const loaderCode = `-- ========================================
-- ${script.title} - Loader
-- Powered by ModHub License System
-- ========================================

local license = "${license.license_key}"

-- Verify license
local checkUrl = "${baseUrl}/check-license?key=" .. license
local checkResponse = gg.makeRequest(checkUrl)

if checkResponse == nil or checkResponse.content ~= "valid" then
  gg.alert("❌ Licença inválida ou banida!\\n\\nVerifique sua licença no dashboard.")
  os.exit()
end

gg.toast("✅ Licença válida! Carregando script...")

-- Load protected script
local scriptUrl = "${baseUrl}/get-script?key=" .. license
local scriptResponse = gg.makeRequest(scriptUrl)

if scriptResponse == nil or scriptResponse.content == nil then
  gg.alert("❌ Erro ao carregar o script.")
  os.exit()
end

-- Execute the script
local fn, err = load(scriptResponse.content)
if fn then
  fn()
else
  gg.alert("❌ Erro no script: " .. tostring(err))
end
`;

    const blob = new Blob([loaderCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = script.title?.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim();
    a.download = `${safeName || "loader"}.lua`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Loader baixado!");
  };

  const totalDownloads = myScripts?.reduce((sum: number, s: any) => sum + s.download_count, 0) ?? 0;

  // Real earnings from purchases
  const { data: modderPurchases } = useQuery({
    queryKey: ["modder-earnings", user?.id],
    queryFn: async () => {
      // Get all script IDs from this modder
      const scriptIds = myScripts?.map((s: any) => s.id) ?? [];
      if (scriptIds.length === 0) return [];
      const { data } = await supabase
        .from("purchases")
        .select("amount, platform_commission, modder_earnings")
        .in("script_id", scriptIds);
      return data ?? [];
    },
    enabled: !!user && isModder && (myScripts?.length ?? 0) > 0,
  });

  const totalEarnings = modderPurchases?.reduce((sum: number, p: any) => sum + Number(p.modder_earnings || 0), 0) ?? 0;
  const totalCommission = modderPurchases?.reduce((sum: number, p: any) => sum + Number(p.platform_commission || 0), 0) ?? 0;
  const totalSales = modderPurchases?.length ?? 0;

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
          {isModder && (
            <Button onClick={() => navigate("/script/new")} className="neon-glow-purple w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Novo Conteúdo
            </Button>
          )}
        </div>

        {/* Stats - only for modders */}
        {isModder && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="neon-border bg-card/80">
              <CardContent className="p-4 text-center">
                <Upload className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold font-mono">{myScripts?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Publicações</p>
              </CardContent>
            </Card>
            <Card className="neon-border bg-card/80">
              <CardContent className="p-4 text-center">
                <Download className="h-5 w-5 mx-auto text-accent mb-1" />
                <p className="text-2xl font-bold font-mono">{totalDownloads}</p>
                <p className="text-xs text-muted-foreground">Downloads</p>
              </CardContent>
            </Card>
            <Card className="neon-border bg-card/80">
              <CardContent className="p-4 text-center">
                <ShoppingBag className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold font-mono">{totalSales}</p>
                <p className="text-xs text-muted-foreground">Vendas</p>
              </CardContent>
            </Card>
            <Card className="neon-border bg-card/80">
              <CardContent className="p-4 text-center">
                <DollarSign className="h-5 w-5 mx-auto text-accent mb-1" />
                <p className="text-2xl font-bold font-mono text-accent">R$ {totalEarnings.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Ganhos (80%)</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`mb-6 grid w-full ${isModder ? "grid-cols-3" : "grid-cols-1"}`}>
            <TabsTrigger value="purchases" className="gap-1.5 text-xs sm:text-sm">
              <ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Meus </span>Scripts Comprados
            </TabsTrigger>
            {isModder && (
              <>
                <TabsTrigger value="my-scripts" className="gap-1.5 text-xs sm:text-sm">
                  <Code className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Minhas </span>Publicações
                </TabsTrigger>
                <TabsTrigger value="finance" className="gap-1.5 text-xs sm:text-sm">
                  <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Meu </span>Financeiro
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Purchased Scripts Tab */}
          <TabsContent value="purchases">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" /> Scripts Adquiridos
            </h2>
            <div className="space-y-3">
              {myLicenses?.map((license: any) => (
                <Card key={license.id} className="neon-border bg-card/80">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {license.scripts?.thumbnail_url ? (
                          <img src={license.scripts.thumbnail_url} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-secondary flex items-center justify-center shrink-0">
                            <Code className="h-5 w-5 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{license.scripts?.title ?? "Script"}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {license.scripts?.game_name && (
                              <Badge variant="secondary" className="text-[10px]">🎮 {license.scripts.game_name}</Badge>
                            )}
                            {license.scripts?.version && (
                              <Badge variant="outline" className="text-[10px]">v{license.scripts.version}</Badge>
                            )}
                            <Badge variant={license.status === "active" ? "default" : "destructive"} className="text-[10px]">
                              {license.status === "active" ? "✅ Ativa" : "🚫 Banida"}
                            </Badge>
                            {license.expires_at ? (() => {
                              const now = new Date();
                              const expires = new Date(license.expires_at);
                              const diffMs = expires.getTime() - now.getTime();
                              if (diffMs <= 0) {
                                return (
                                  <Badge variant="destructive" className="text-[10px]">
                                    ❌ Expirada
                                  </Badge>
                                );
                              }
                              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                              const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                              const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                              let timeLabel = "";
                              if (diffDays > 0) timeLabel = `${diffDays}d ${diffHours}h restantes`;
                              else if (diffHours > 0) timeLabel = `${diffHours}h ${diffMinutes}min restantes`;
                              else timeLabel = `${diffMinutes}min restantes`;
                              const urgentClass = diffDays <= 3 ? "border-destructive/50 text-destructive" : "border-yellow-500/30 text-yellow-400";
                              return (
                                <Badge variant="outline" className={`text-[10px] ${urgentClass}`}>
                                  ⏳ {timeLabel}
                                </Badge>
                              );
                            })() : (
                              <Badge variant="outline" className="text-[10px] border-accent/30 text-accent">
                                ♾️ Permanente
                              </Badge>
                            )}
                          </div>
                          {license.scripts?.description && (
                            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{license.scripts.description}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* License Key */}
                    <div className="mt-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
                      <p className="text-[10px] text-muted-foreground mb-1">Licença:</p>
                      <div className="flex items-center gap-2">
                        <Key className="h-3.5 w-3.5 text-primary shrink-0" />
                        <code className="text-sm font-mono text-primary flex-1">{license.license_key}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => { navigator.clipboard.writeText(license.license_key); toast.success("Licença copiada!"); }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Download Loader or Renew */}
                    {license.status === "active" && (
                      license.expires_at && new Date(license.expires_at) < new Date() ? (
                        <Button className="w-full mt-3 neon-glow-purple" size="sm" onClick={() => navigate(`/script/${license.scripts?.id}`)}>
                          <RefreshCw className="mr-2 h-4 w-4" /> Renovar Licença
                        </Button>
                      ) : (
                        <Button className="w-full mt-3 neon-glow-green" size="sm" onClick={() => handleDownloadLoader(license)}>
                          <Download className="mr-2 h-4 w-4" /> Baixar Loader (.lua)
                        </Button>
                      )
                    )}
                  </CardContent>
                </Card>
              ))}
              {(myLicenses?.length ?? 0) === 0 && (
                <Card className="neon-border bg-card/80">
                  <CardContent className="p-8 text-center">
                    <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">Nenhum script comprado ainda.</p>
                    <Button variant="outline" className="mt-3" onClick={() => navigate("/marketplace")}>
                      Ir ao Marketplace
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Modder Scripts Tab */}
          {isModder && (
            <TabsContent value="my-scripts">
              {/* Upload form */}
              {showForm && (
                <Card className="neon-border bg-card/80 mb-8">
                  <CardHeader>
                    <CardTitle>Nova Publicação</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label className="mb-2 block">Tipo de conteúdo</Label>
                        <Tabs value={scriptType} onValueChange={setScriptType}>
                          <TabsList className="grid w-full max-w-xs grid-cols-2">
                            <TabsTrigger value="script" className="gap-2">
                              <Code className="h-4 w-4" /> Script
                            </TabsTrigger>
                            <TabsTrigger value="apk" className="gap-2">
                              <Package className="h-4 w-4" /> APK / Mod
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label>Título</Label>
                          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
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
                      </div>
                      <div>
                        <Label>Descrição</Label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label>Status</Label>
                          <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="working">Working</SelectItem>
                              <SelectItem value="detected">Detected</SelectItem>
                              <SelectItem value="updating">Updating</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-4 pt-6">
                          <Switch checked={isPaid} onCheckedChange={setIsPaid} />
                          <Label>Pago</Label>
                          {isPaid && <Input type="number" placeholder="Preço (R$)" value={price} onChange={(e) => setPrice(e.target.value)} className="w-32" step="0.01" />}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label>Arquivo (upload)</Label>
                          <Input type="file" onChange={async (e) => {
                            const f = e.target.files?.[0] ?? null;
                            if (!f) {
                              setFile(null);
                              return;
                            }
                            const safeName = await validateFileWithToast({ file: f, type: "script", maxSizeMB: 20 });
                            if (!safeName) {
                              e.target.value = "";
                              setFile(null);
                              return;
                            }
                            setFile(f);
                          }} />
                        </div>
                        <div>
                          <Label>Miniatura (upload)</Label>
                          <div className="flex gap-2">
                            <Input 
                              type="file" 
                              accept=".jpg,.jpeg,.png,.webp"
                              className="text-xs"
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                const safeName = await validateFileWithToast({ file: f, type: "image", maxSizeMB: 1 });
                                if (!safeName) {
                                  e.target.value = "";
                                  return;
                                }
                                toast.info("Enviando miniatura...");
                                const path = `thumbnails/${user.id}/${safeName}`;
                                const { error: uploadError } = await supabase.storage.from("scripts").upload(path, f);
                                if (uploadError) {
                                  toast.error("Erro no upload: " + uploadError.message);
                                  return;
                                }
                                const { data: publicData } = supabase.storage.from("scripts").getPublicUrl(path);
                                setExternalLink(publicData.publicUrl); // Using externalLink as a temporary holder or I should add a state
                                toast.success("Miniatura enviada!");
                              }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">Apenas JPG/PNG/WebP, Máx 1MB.</p>
                        </div>
                      </div>

                      <div>
                        <Label>Link externo ou URL da Miniatura</Label>
                        <Input value={externalLink} onChange={(e) => setExternalLink(e.target.value)} placeholder="https://..." />
                      </div>
                      <Button type="submit" disabled={submitting} className="neon-glow-purple">
                        {submitting ? "Publicando..." : `Publicar ${scriptType === "script" ? "Script" : "APK/Mod"}`}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              <h2 className="text-xl font-bold mb-4">Minhas Publicações</h2>
              <div className="space-y-3">
                {myScripts?.map((script: any) => (
                  <Card key={script.id} className={`neon-border bg-card/80 ${!script.is_active ? 'opacity-60' : ''}`}>
                    <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {script.script_type === "apk" ? (
                            <Package className="h-4 w-4 text-primary" />
                          ) : (
                            <Code className="h-4 w-4 text-primary" />
                          )}
                          <p className="font-semibold">{script.title}</p>
                          {script.is_paid && <Badge variant="secondary" className="text-[10px]">R$ {Number(script.price).toFixed(2)}</Badge>}
                          {!script.is_active && <Badge variant="destructive" className="text-[10px]">Inativo</Badge>}
                        </div>
                         <div className="flex flex-wrap gap-2 sm:gap-3 text-xs text-muted-foreground mt-1">
                           <span>{script.categories?.name}</span>
                           <span>{script.download_count} downloads</span>
                           <Badge variant="outline" className="text-[10px]">{script.status}</Badge>
                           <Badge variant="secondary" className="text-[10px]">{script.script_type === "apk" ? "APK" : "Script"}</Badge>
                         </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/script/${script.id}/edit`)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={script.is_active ? "text-primary" : "text-accent"}
                          onClick={() => handleToggleActive(script.id, script.is_active)}
                          title={script.is_active ? "Desativar script" : "Reativar script"}
                        >
                          {script.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(script.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {myScripts?.length === 0 && <p className="text-muted-foreground">Nenhuma publicação ainda.</p>}
              </div>
            </TabsContent>
          )}

          {/* Finance Tab */}
          {isModder && (
            <TabsContent value="finance">
              <ModderFinanceTab totalEarnings={totalEarnings} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}
