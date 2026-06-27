import { useState } from "react";
import { validateFileWithToast } from "@/lib/secure-upload";
import { Layout } from "@/components/layout/Layout";
import { ModderFinanceTab } from "@/components/modder/ModderFinanceTab";
import { ModderModerationInbox } from "@/components/ModderModerationInbox";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Upload, Download, Star, DollarSign, Plus, Trash2, Code, Package, Pencil, Key, 
  Copy, ShoppingBag, EyeOff, Eye, Clock, RefreshCw, TrendingUp, Calendar, ArrowUpRight,
  FolderOpen
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';
import { format, subDays, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

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
        .from("script_licenses")
        .select("*, scripts(id, title, description, game_name, thumbnail_url, version)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const totalDownloads = myScripts?.reduce((sum: number, s: any) => sum + s.download_count, 0) ?? 0;

  // Real earnings from purchases
  const { data: modderPurchases } = useQuery({
    queryKey: ["modder-earnings", user?.id],
    queryFn: async () => {
      // Get all script IDs from this modder
      const scriptIds = myScripts?.map((s: any) => s.id) ?? [];
      if (scriptIds.length === 0) return [];
      const { data } = await supabase
        .from("script_purchases")
        .select("amount, platform_commission, modder_earnings, created_at")
        .in("script_id", scriptIds);
      return data ?? [];
    },
    enabled: !!user && isModder && (myScripts?.length ?? 0) > 0,
  });

  const totalEarnings = modderPurchases?.reduce((sum: number, p: any) => sum + Number(p.modder_earnings || 0), 0) ?? 0;
  const totalSales = modderPurchases?.length ?? 0;

  // Prepare chart data for last 7 days
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayPurchases = modderPurchases?.filter((p: any) => 
      isSameDay(parseISO(p.created_at), date)
    ) ?? [];
    
    const earnings = dayPurchases.reduce((sum: number, p: any) => 
      sum + Number(p.modder_earnings || 0), 0
    );

    return {
      name: format(date, "EEE", { locale: ptBR }),
      date: format(date, "dd/MM"),
      earnings,
    };
  });

  const dailyGrowth = chartData?.[6]?.earnings > (chartData?.[5]?.earnings ?? 0);

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
    -- Powered by Hidden Mod
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


  return (
    <Layout>
      <div className="container py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-8 border border-white/10 bg-[#030304] p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-neon-purple/10 blur-[80px] pointer-events-none" />
          <div className="relative z-10 space-y-1">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Hidden Mod</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest flex items-center gap-2">
              <Code className="w-3 h-3 text-neon-purple" /> Acesso Desenvolvedor
            </p>
          </div>
          {isModder && (
            <Button onClick={() => navigate("/script/new")} className="bg-neon-purple hover:bg-neon-purple/90 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] rounded-none font-black uppercase tracking-widest text-[10px] sm:text-xs h-10 sm:h-12 px-6 w-full sm:w-auto relative z-10 transition-transform hover:-translate-y-1">
              <Plus className="mr-2 h-4 w-4" /> Novo Payload
            </Button>
          )}
        </div>

        {/* Stats - only for modders */}
        {isModder && (
          <div className="space-y-6 mb-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
              <Card className="bg-[#050505] border-white/10 hover:border-primary/40 rounded-none transition-all group">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-primary/5 border border-primary/20 p-2 group-hover:bg-primary/10 transition-colors">
                      <Code className="h-4 w-4 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-[10px] opacity-60">Total</Badge>
                  </div>
                  <p className="text-2xl font-bold text-white leading-none">
                    {myScripts?.length ?? 0}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-black">Publicações</p>
                </CardContent>
              </Card>

              <Card className="bg-[#050505] border-white/10 hover:border-accent/40 rounded-none transition-all group">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-accent/5 border border-accent/20 p-2 group-hover:bg-accent/10 transition-colors">
                      <Download className="h-4 w-4 text-accent" />
                    </div>
                    <Badge variant="outline" className="text-[10px] text-accent/70 border-accent/20">Popularidade</Badge>
                  </div>
                  <p className="text-2xl font-bold text-white leading-none">
                    {totalDownloads}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-black">Downloads</p>
                </CardContent>
              </Card>

              <Card className="bg-[#050505] border-white/10 hover:border-neon-purple/40 rounded-none transition-all group">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-neon-purple/5 border border-neon-purple/20 p-2 group-hover:bg-neon-purple/10 transition-colors">
                      <ShoppingBag className="h-4 w-4 text-neon-purple" />
                    </div>
                    <Badge variant="outline" className="text-[10px] text-neon-purple/70 border-neon-purple/20">Volume</Badge>
                  </div>
                  <p className="text-2xl font-bold text-white leading-none">
                    {totalSales}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-black">Vendas</p>
                </CardContent>
              </Card>

              <Card className="bg-[#050505] border-white/10 hover:border-neon-green/40 rounded-none transition-all group">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-neon-green/5 border border-neon-green/20 p-2 group-hover:bg-neon-green/10 transition-colors">
                      <DollarSign className="h-4 w-4 text-neon-green" />
                    </div>
                    <div className="flex items-center gap-1">
                      <ArrowUpRight className={`h-3 w-3 ${dailyGrowth ? 'text-neon-green' : 'text-[#333]'}`} />
                      <span className="text-[10px] font-black uppercase text-neon-green">Lucro</span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-neon-green leading-none">
                    R$ {totalEarnings.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-black">Ganhos (80%)</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 font-mono">
              <Card className="bg-[#050505] border-white/10 rounded-none shadow-none overflow-hidden">
                <CardHeader className="pb-4 border-b border-white/5 bg-[#030304]">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Desempenho de Vendas
                      </CardTitle>
                      <CardDescription className="text-[9px] uppercase tracking-widest mt-1">Ganhos líquidos nos últimos 7 dias</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-white/10 bg-[#030304] text-[10px] font-black uppercase tracking-widest">
                        <Calendar className="h-3 w-3" /> 
                        Última semana
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--neon-purple))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--neon-purple))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#888' }}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#888' }}
                          tickFormatter={(value) => `R$${value}`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(20, 20, 25, 0.95)', 
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: '#fff'
                          }}
                          itemStyle={{ color: 'hsl(var(--neon-purple))' }}
                          formatter={(value: any) => [`R$ ${value.toFixed(2)}`, 'Ganhos']}
                          labelStyle={{ marginBottom: '4px', fontWeight: 'bold' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="earnings" 
                          stroke="hsl(var(--neon-purple))" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorEarnings)" 
                          animationDuration={1500}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {isModder && <ModderModerationInbox />}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="font-mono">
          <TabsList className={`mb-8 grid w-full ${isModder ? "grid-cols-3" : "grid-cols-1"} p-1 bg-[#050505] border border-white/10 rounded-none h-14`}>
            <TabsTrigger value="purchases" className="text-[9px] sm:text-[10px] tracking-widest uppercase font-black gap-2 data-[state=active]:bg-[#030304] data-[state=active]:text-neon-purple rounded-none h-full">
              <Key className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Meus </span>Arquivos Comprados
            </TabsTrigger>
            {isModder && (
              <>
                <TabsTrigger value="my-scripts" className="text-[9px] sm:text-[10px] tracking-widest uppercase font-black gap-2 data-[state=active]:bg-[#030304] data-[state=active]:text-neon-green rounded-none h-full">
                  <Code className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Minhas Publicações
                </TabsTrigger>
                <TabsTrigger value="finance" className="text-[9px] sm:text-[10px] tracking-widest uppercase font-black gap-2 data-[state=active]:bg-[#030304] data-[state=active]:text-accent rounded-none h-full">
                  <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Meu </span>Financeiro
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Purchased Scripts Tab */}
          <TabsContent value="purchases">
            <h2 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2 text-white bg-[#030304] border border-white/5 p-4 rounded-none">
              <Key className="h-4 w-4 text-neon-purple" /> Scripts Adquiridos
            </h2>
            <div className="space-y-4">
              {myLicenses?.map((license: any) => (
                <Card key={license.id} className="neon-border bg-card/80">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {license.scripts?.thumbnail_url ? (
                          <img src={license.scripts.thumbnail_url} alt="" className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-secondary flex items-center justify-center shrink-0">
                            <Code className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm sm:font-semibold truncate">{license.scripts?.title ?? "Script"}</p>
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
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <Key className="h-3 w-3 text-primary shrink-0" />
                          <code className="text-xs font-mono text-primary truncate flex-1">{license.license_key}</code>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[10px] sm:text-xs self-end sm:self-center"
                          onClick={() => { navigator.clipboard.writeText(license.license_key); toast.success("Copiada!"); }}
                        >
                          <Copy className="h-3 w-3 mr-1" /> Copiar
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
            <TabsContent value="my-scripts" className="space-y-6">
              {/* Upload form */}
              {showForm && (
                <Card className="border-white/10 bg-[#050505] rounded-none p-2 mb-8 relative font-mono">
                  <div className="absolute top-0 right-0 p-1 bg-neon-purple/20 border-b border-l border-neon-purple/50">
                    <span className="text-[8px] uppercase font-black tracking-widest text-neon-purple">MODDER_AUTH_OK</span>
                  </div>
                  <CardHeader className="border-b border-white/5 bg-[#030304] pb-4">
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-white">Init Payload Config</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Classificação do Payload</Label>
                        <Tabs value={scriptType} onValueChange={setScriptType}>
                          <TabsList className="grid w-full max-w-xs grid-cols-2 p-1 bg-[#030304] border border-white/10 rounded-none h-12">
                            <TabsTrigger value="script" className="text-[10px] tracking-widest uppercase font-black gap-2 data-[state=active]:bg-[#0a0a0c] data-[state=active]:text-neon-cyan rounded-none h-full">
                              <Code className="h-4 w-4" /> Script LUA
                            </TabsTrigger>
                            <TabsTrigger value="apk" className="text-[10px] tracking-widest uppercase font-black gap-2 data-[state=active]:bg-[#0a0a0c] data-[state=active]:text-neon-green rounded-none h-full">
                              <Package className="h-4 w-4" /> Mod Menu
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome Operacional</Label>
                          <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="bg-[#030304] border-white/10 focus-visible:ring-neon-purple rounded-none h-12" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Classificação Global</Label>
                          <Select value={categoryId} onValueChange={setCategoryId}>
                            <SelectTrigger className="bg-[#030304] border-white/10 focus-visible:ring-neon-purple rounded-none h-12"><SelectValue placeholder="SORT_BY" /></SelectTrigger>
                            <SelectContent className="bg-[#050505] border-white/10 rounded-none">
                              {categories?.map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Documentação (TXT)</Label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="bg-[#030304] border-white/10 focus-visible:ring-neon-purple rounded-none resize-none p-4" />
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado Operacional</Label>
                          <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="bg-[#030304] border-white/10 focus-visible:ring-neon-purple rounded-none h-12 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#050505] border-white/10 rounded-none text-xs">
                              <SelectItem value="working">WORKING_OK</SelectItem>
                              <SelectItem value="detected">DETECTED_RISK</SelectItem>
                              <SelectItem value="updating">UPDATING_NOW</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-4 pt-8">
                          <Switch checked={isPaid} onCheckedChange={setIsPaid} className="data-[state=checked]:bg-neon-purple" />
                          <Label className="uppercase text-[10px] font-black tracking-widest text-white">Monetização</Label>
                          {isPaid && <Input type="number" placeholder="Value (R$)" value={price} onChange={(e) => setPrice(e.target.value)} className="w-32 bg-[#030304] border-white/10 focus-visible:ring-neon-purple rounded-none text-neon-green font-mono" step="0.01" />}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Upload Raw File</Label>
                          <Input type="file" className="bg-[#030304] border-white/10 focus-visible:ring-neon-purple rounded-none h-12 file:bg-[#050505] file:text-white file:border-0 file:mr-4 file:h-full cursor-pointer text-xs" onChange={async (e) => {
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
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">URL da Miniatura / Link Externo</Label>
                          <div className="flex gap-2 h-12">
                             <Input 
                              type="file" 
                              accept=".jpg,.jpeg,.png,.webp"
                               className="bg-[#030304] border-white/10 focus-visible:ring-neon-purple rounded-none h-12 file:bg-[#050505] file:text-white file:border-0 file:mr-4 file:h-full cursor-pointer text-xs w-full"
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
                                setExternalLink(publicData.publicUrl);
                                toast.success("Miniatura enviada!");
                              }}
                            />
                          </div>
                          <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-widest font-mono">JPG/PNG/WebP, 1MB Max.</p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Endpoint / Thumbnail URL</Label>
                        <Input value={externalLink} onChange={(e) => setExternalLink(e.target.value)} placeholder="https://..." className="bg-[#030304] border-white/10 focus-visible:ring-neon-purple rounded-none h-12 font-mono text-xs" />
                      </div>
                      <Button type="submit" disabled={submitting} className="w-full bg-neon-purple hover:bg-neon-purple/90 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] rounded-none font-black uppercase tracking-widest text-[10px] sm:text-xs h-12 mt-4">
                        {submitting ? "Executando..." : `Deploy ${scriptType === "script" ? "LUA" : "MOD"}`}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <Code className="h-4 w-4 text-neon-green" /> Payload Submissions
                </h2>
                <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-widest border-white/10 bg-[#030304] text-muted-foreground">
                  TOTAL: {myScripts?.length ?? 0}
                </Badge>
              </div>
              <div className="space-y-4">
                {myScripts?.map((script: any) => (
                  <Card key={script.id} className={`bg-[#050505] border border-white/5 rounded-none hover:bg-[#08080a] transition-colors p-0 shadow-none ${!script.is_active ? 'opacity-50 grayscale' : ''}`}>
                    <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {script.script_type === "apk" ? (
                            <Package className="h-4 w-4 text-neon-green" />
                          ) : (
                            <Code className="h-4 w-4 text-neon-cyan" />
                          )}
                          <p className="font-black text-sm uppercase tracking-tight text-white truncate italic">{script.title}</p>
                          {script.is_paid && <Badge variant="secondary" className="text-[9px] uppercase tracking-widest bg-neon-purple/20 text-neon-purple hover:bg-neon-purple/30 rounded-none border-t border-neon-purple/50">R$ {Number(script.price).toFixed(2)}</Badge>}
                          {!script.is_active && <Badge variant="destructive" className="text-[9px] uppercase tracking-widest rounded-none">INATIVO</Badge>}
                        </div>
                         <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground uppercase tracking-widest">
                           <span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" /> {script.categories?.name}</span>
                           <span className="flex items-center gap-1"><Download className="h-3 w-3" /> {script.download_count}</span>
                           <Badge variant="outline" className="text-[9px] border-white/10 bg-[#030304] rounded-none">{script.status}</Badge>
                           <Badge variant="secondary" className="text-[9px] border-white/10 bg-[#030304] rounded-none">{script.script_type === "apk" ? "MOD" : "LUA"}</Badge>
                         </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/5 rounded-none text-muted-foreground hover:text-white transition-colors" onClick={() => navigate(`/script/${script.id}/edit`)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 hover:bg-white/5 rounded-none transition-colors ${script.is_active ? "text-neon-cyan hover:text-neon-cyan" : "text-muted-foreground hover:text-white"}`}
                          onClick={() => handleToggleActive(script.id, script.is_active)}
                          title={script.is_active ? "Desativar script" : "Reativar script"}
                        >
                          {script.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 rounded-none text-destructive transition-colors" onClick={() => handleDelete(script.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <div className="flex border-t border-white/5 mt-4 pt-4 justify-center">
                  {myScripts?.length === 0 && <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Nenhuma transmissão encontrada no terminal.</p>}
                </div>
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
