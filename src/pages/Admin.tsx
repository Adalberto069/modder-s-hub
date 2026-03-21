import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Users, Code, CheckCircle, XCircle, Trash2, Plus, Pencil, Eye, EyeOff, Clock, FileX, Send, Shield,
  UserCheck, ShieldCheck, ShieldOff, Key, Ban, ShoppingCart, Copy, DollarSign, Percent, Search, 
  AlertTriangle, Landmark, TrendingUp, Calendar, BarChart3, Activity
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell
} from 'recharts';
import { format, subDays, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminBadges } from "@/components/admin/AdminBadges";
import { AdminFlaggedScripts } from "@/components/admin/AdminFlaggedScripts";
import { AdminModerationQueue } from "@/components/admin/AdminModerationQueue";
import { AdminWithdrawalsTab } from "@/components/admin/AdminWithdrawalsTab";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import LuaCodeEditor from "@/components/LuaCodeEditor";
import { useState } from "react";

const publishStatusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground border-border" },
  pending_review: { label: "Em Revisão", className: "bg-primary/20 text-primary border-primary/30" },
  published: { label: "Publicado", className: "bg-accent/20 text-accent border-accent/30" },
  archived: { label: "Arquivado", className: "bg-destructive/20 text-destructive border-destructive/30" },
};

export default function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [codeDialogContent, setCodeDialogContent] = useState("");
  const [codeDialogTitle, setCodeDialogTitle] = useState("");
  const [leakCode, setLeakCode] = useState("");
  const [leakResult, setLeakResult] = useState<null | { userId: string; username?: string; displayName?: string; email?: string }>(null);
  const [leakSearching, setLeakSearching] = useState(false);
  const [leakError, setLeakError] = useState("");

  const { data: pendingModders } = useQuery({
    queryKey: ["pending-modders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("*, profiles:user_id(username, display_name)")
        .eq("role", "modder" as any)
        .eq("approved", false);
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: allScripts } = useQuery({
    queryKey: ["admin-scripts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("scripts")
        .select("*, categories(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { count: usersCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const { count: scriptsCount } = await supabase.from("scripts").select("*", { count: "exact", head: true });
      const { data: modderRoles } = await supabase
        .from("user_roles")
        .select("id", { count: "exact", head: false })
        .eq("role", "modder" as any)
        .eq("approved", true);
      const moddersCount = modderRoles?.length ?? 0;
      const { count: purchasesCount } = await supabase.from("purchases").select("*", { count: "exact", head: true });
      const { count: licensesCount } = await supabase.from("licenses").select("*", { count: "exact", head: true });
      // Fetch financial totals
      const { data: purchaseData } = await supabase.from("purchases").select("amount, platform_commission, modder_earnings");
      const totalSales = purchaseData?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) ?? 0;
      const totalCommission = purchaseData?.reduce((sum: number, p: any) => sum + Number(p.platform_commission || 0), 0) ?? 0;
      const totalModderEarnings = purchaseData?.reduce((sum: number, p: any) => sum + Number(p.modder_earnings || 0), 0) ?? 0;
      return {
        users: usersCount ?? 0,
        scripts: scriptsCount ?? 0,
        modders: moddersCount,
        purchases: purchasesCount ?? 0,
        licenses: licensesCount ?? 0,
        totalSales,
        totalCommission,
        totalModderEarnings,
      };
    },
    enabled: isAdmin,
  });

  // All licenses for admin
  const { data: allLicenses } = useQuery({
    queryKey: ["admin-licenses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("licenses")
        .select("*, scripts(title), profiles:user_id(username, display_name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: isAdmin,
  });

  // All purchases for admin
  const { data: allPurchases } = useQuery({
    queryKey: ["admin-purchases"],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchases")
        .select("*, scripts(title), profiles:user_id(username, display_name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: isAdmin,
  });

  // Prepare data for the sales chart
  const last30DaysData = Array.from({ length: 30 }, (_, i) => {
    const date = subDays(new Date(), 29 - i);
    const dayPurchases = allPurchases?.filter((p: any) => 
      isSameDay(parseISO(p.created_at), date)
    ) ?? [];
    
    const count = dayPurchases.length;
    const volume = dayPurchases.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const commission = dayPurchases.reduce((sum: number, p: any) => sum + Number(p.platform_commission || 0), 0);

    return {
      name: format(date, "dd/MM"),
      count,
      volume,
      commission,
    };
  });

  if (loading) return <Layout><div className="container py-16 text-center">Carregando...</div></Layout>;
  if (!user || !isAdmin) return <Navigate to="/" />;

  const approveModder = async (roleId: string, userId: string) => {
    const { error } = await supabase.from("user_roles").update({ approved: true, approved_at: new Date().toISOString() }).eq("id", roleId);
    if (error) { toast.error(error.message); return; }
    await supabase.from("notifications" as any).insert({
      user_id: userId,
      title: "Solicitação Aprovada! 🎉",
      message: "Parabéns! Sua solicitação de Modder foi aprovada. Agora você pode publicar scripts no marketplace.",
      type: "success",
      link: "/dashboard",
    });
    toast.success("Modder aprovado!");
    queryClient.invalidateQueries({ queryKey: ["pending-modders"] });
  };

  const rejectModder = async (roleId: string, userId: string) => {
    await supabase.from("notifications" as any).insert({
      user_id: userId,
      title: "Solicitação Recusada",
      message: "Sua solicitação de Modder foi recusada. Entre em contato com a administração para mais informações.",
      type: "error",
    });
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) { toast.error(error.message); return; }
    toast.success("Solicitação rejeitada.");
    queryClient.invalidateQueries({ queryKey: ["pending-modders"] });
  };

  const deleteScript = async (scriptId: string) => {
    // Check if script has purchases - warn admin
    const { count } = await supabase.from("purchases").select("*", { count: "exact", head: true }).eq("script_id", scriptId);
    if ((count ?? 0) > 0) {
      if (!window.confirm(`⚠️ Este script possui ${count} compra(s). Excluir permanentemente apagará o acesso dos compradores. Deseja continuar?`)) return;
    }
    const { error } = await supabase.from("scripts").delete().eq("id", scriptId);
    if (error) toast.error(error.message);
    else { toast.success("Script removido permanentemente!"); queryClient.invalidateQueries({ queryKey: ["admin-scripts"] }); }
  };

  const toggleScriptActive = async (scriptId: string, currentActive: boolean) => {
    const { error } = await supabase.from("scripts").update({ is_active: !currentActive } as any).eq("id", scriptId);
    if (error) { toast.error(error.message); return; }
    toast.success(currentActive ? "Script desativado. Compradores existentes mantêm acesso." : "Script reativado!");
    queryClient.invalidateQueries({ queryKey: ["admin-scripts"] });
  };

  const updatePublishStatus = async (scriptId: string, newStatus: string) => {
    const { error } = await supabase.from("scripts").update({ publish_status: newStatus } as any).eq("id", scriptId);
    if (error) toast.error(error.message);
    else {
      const labels: Record<string, string> = { published: "Publicado!", archived: "Arquivado!", draft: "Movido para rascunho." };
      toast.success(labels[newStatus] ?? "Status atualizado!");
      queryClient.invalidateQueries({ queryKey: ["admin-scripts"] });
    }
  };

  const viewCode = async (script: any) => {
    setCodeDialogTitle(script.title);
    if (script.lua_code) {
      setCodeDialogContent(script.lua_code);
      setCodeDialogOpen(true);
      return;
    }
    if (script.file_url) {
      try {
        const res = await fetch(script.file_url);
        const text = await res.text();
        setCodeDialogContent(text);
        setCodeDialogOpen(true);
      } catch {
        toast.error("Não foi possível carregar o arquivo.");
      }
      return;
    }
    toast.error("Este script não possui código disponível.");
  };

  const toggleVerify = async (script: any) => {
    const newValue = !script.is_verified;
    const { error } = await supabase.from("scripts").update({ is_verified: newValue }).eq("id", script.id);
    if (error) { toast.error(error.message); return; }
    toast.success(newValue ? "Script verificado! ✅" : "Verificação removida.");
    queryClient.invalidateQueries({ queryKey: ["admin-scripts"] });
  };

  const toggleLicenseBan = async (licenseId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "banned" : "active";
    const { error } = await supabase.from("licenses").update({ status: newStatus }).eq("id", licenseId);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus === "banned" ? "Licença banida!" : "Licença reativada!");
    queryClient.invalidateQueries({ queryKey: ["admin-licenses"] });
  };

  // Leak tracker: extract watermark from obfuscated code
  const extractWatermark = async () => {
    setLeakResult(null);
    setLeakError("");
    if (!leakCode.trim()) { setLeakError("Cole o código ofuscado acima."); return; }

    // The watermark is a hex-encoded user_id stored in a local variable assignment at the top
    // Pattern: local _varname="hexstring"
    const match = leakCode.match(/local\s+\w+\s*=\s*"([0-9a-f]{32,})"/);
    if (!match) { setLeakError("Nenhum watermark encontrado. O código pode não ter sido ofuscado pelo marketplace."); return; }

    const hex = match[1];
    // Decode hex to string (UUID)
    let userId = "";
    try {
      for (let i = 0; i < hex.length; i += 2) {
        userId += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
      }
    } catch {
      setLeakError("Watermark encontrado mas não pôde ser decodificado."); return;
    }

    if (!userId || userId.length < 30) { setLeakError("Watermark decodificado inválido: " + userId); return; }

    setLeakSearching(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name, user_id")
        .eq("user_id", userId)
        .single();

      setLeakResult({
        userId,
        username: profile?.username,
        displayName: profile?.display_name ?? undefined,
      });
    } catch {
      setLeakResult({ userId });
    }
    setLeakSearching(false);
  };

  const pendingReview = allScripts?.filter((s: any) => s.publish_status === "pending_review") ?? [];
  const published = allScripts?.filter((s: any) => s.publish_status === "published" || !s.publish_status) ?? [];
  const drafts = allScripts?.filter((s: any) => s.publish_status === "draft") ?? [];
  const archived = allScripts?.filter((s: any) => s.publish_status === "archived") ?? [];

  const ScriptRow = ({ script }: { script: any }) => {
    const ps = publishStatusConfig[(script as any).publish_status ?? "published"] ?? publishStatusConfig.published;
    return (
      <div className={`flex items-center justify-between p-4 border-b border-white/5 bg-[#050505] hover:bg-[#08080a] transition-colors gap-4 ${!script.is_active ? 'opacity-50 grayscale' : ''}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-black text-sm uppercase tracking-tight text-white truncate italic">{script.title}</p>
            <Badge variant="outline" className={`text-[10px] ${ps.className}`}>{ps.label}</Badge>
            {script.is_verified && <Badge variant="outline" className="text-[10px] bg-accent/20 text-accent border-accent/30">✅ Verificado</Badge>}
            {!script.is_active && <Badge variant="destructive" className="text-[10px]">Inativo</Badge>}
          </div>
          <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
            {(script as any).game_name && <span>🎮 {(script as any).game_name}</span>}
            <span>{script.download_count} downloads</span>
            {script.categories && <span>{(script.categories as any).name}</span>}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => viewCode(script)} title="Ver Código">
            <Code className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={`h-8 w-8 ${script.is_verified ? "text-accent" : "text-muted-foreground"}`}
            onClick={() => toggleVerify(script)}
            title={script.is_verified ? "Remover Verificação" : "Verificar Script"}
          >
            {script.is_verified ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={`h-8 w-8 ${script.is_active ? "text-primary" : "text-accent"}`}
            onClick={() => toggleScriptActive(script.id, script.is_active ?? true)}
            title={script.is_active ? "Desativar Script" : "Reativar Script"}
          >
            {script.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          {(script as any).publish_status === "pending_review" && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-accent" onClick={() => updatePublishStatus(script.id, "published")} title="Aprovar">
              <CheckCircle className="h-4 w-4" />
            </Button>
          )}
          {(script as any).publish_status !== "published" && (script as any).publish_status !== "pending_review" && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-accent" onClick={() => updatePublishStatus(script.id, "published")} title="Publicar">
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(`/script/${script.id}/edit`)} title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteScript(script.id)} title="Excluir Permanentemente">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8 border border-white/10 bg-[#030304] p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-neon-purple/10 blur-[80px] pointer-events-none" />
          <div className="relative z-10 space-y-1">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Terminal Admin</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest flex items-center gap-2">
              <Shield className="w-3 h-3 text-neon-purple" /> Acesso Nível Root
            </p>
          </div>
          <Button onClick={() => navigate("/script/new")} className="bg-neon-purple hover:bg-neon-purple/90 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] rounded-none font-black uppercase tracking-widest text-xs h-12 px-6 relative z-10">
            <Plus className="mr-2 h-4 w-4" /> Novo Payload
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-[#050505] border-white/10 hover:border-neon-purple/40 rounded-none transition-all group font-mono">
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-neon-purple/5 border border-neon-purple/20 p-2 group-hover:bg-neon-purple/10 transition-colors">
                  <Users className="h-4 w-4 text-neon-purple" />
                </div>
                <Badge variant="outline" className="text-[10px] opacity-60">Base</Badge>
              </div>
              <p className="text-2xl font-bold font-mono text-foreground leading-none">{stats?.users}</p>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium">Usuários</p>
            </CardContent>
          </Card>

          <Card className="bg-[#050505] border-white/10 hover:border-neon-green/40 rounded-none transition-all group font-mono">
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-neon-green/5 border border-neon-green/20 p-2 group-hover:bg-neon-green/10 transition-colors">
                  <Code className="h-4 w-4 text-neon-green" />
                </div>
                <Badge variant="outline" className="text-[10px] text-neon-green/70 border-neon-green/20">Ativos</Badge>
              </div>
              <p className="text-2xl font-bold font-mono text-foreground leading-none">{stats?.scripts}</p>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium">Scripts</p>
            </CardContent>
          </Card>

          <Card className="bg-[#050505] border-white/10 hover:border-primary/40 rounded-none transition-all group font-mono">
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-primary/5 border border-primary/20 p-2 group-hover:bg-primary/10 transition-colors">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                </div>
                <Badge variant="outline" className="text-[10px] text-primary/70 border-primary/20">Sucesso</Badge>
              </div>
              <p className="text-2xl font-bold font-mono text-foreground leading-none">{stats?.purchases}</p>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium">Compras</p>
            </CardContent>
          </Card>

          <Card className="bg-[#050505] border-white/10 hover:border-accent/40 rounded-none transition-all group font-mono">
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-accent/5 border border-accent/20 p-2 group-hover:bg-accent/10 transition-colors">
                  <Activity className="h-4 w-4 text-accent" />
                </div>
                <Badge variant="outline" className="text-[10px] text-accent/70 border-accent/20">Crescimento</Badge>
              </div>
              <p className="text-2xl font-bold font-mono text-foreground leading-none">R$ {(stats?.totalSales ?? 0).toFixed(0)}</p>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium">Volume Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Financial Overview & Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 font-mono">
          <Card className="lg:col-span-2 bg-[#050505] border-white/10 rounded-none shadow-none overflow-hidden">
            <CardHeader className="pb-4 border-b border-white/5 bg-[#030304] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
                  <TrendingUp className="h-4 w-4 text-accent" />
                  Plataforma O.S. (Radar)
                </CardTitle>
                <CardDescription className="text-[9px] uppercase tracking-widest mt-1">Volume de transações nos últimos 30 dias</CardDescription>
              </div>
              <Activity className="h-3 w-3 text-muted-foreground/30" />
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={last30DaysData}>
                    <defs>
                      <linearGradient id="adminChart" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#666' }}
                      interval={4}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#666' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(15, 15, 20, 0.95)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        fontSize: '11px'
                      }}
                      formatter={(v: any) => [`R$ ${v.toFixed(2)}`, 'Volume']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="volume" 
                      stroke="hsl(var(--accent))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#adminChart)" 
                      animationDuration={2000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#050505] border-white/10 rounded-none shadow-none overflow-hidden font-mono">
            <CardHeader className="pb-4 border-b border-white/5 bg-[#030304]">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
                <BarChart3 className="h-4 w-4 text-neon-green" />
                Dossiê Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="space-y-6">
                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold inline-block py-1 px-2 uppercase rounded-full text-primary bg-primary/10">
                        Comissão Plataforma (20%)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-primary">
                        R$ {(stats?.totalCommission ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-primary/10">
                    <div style={{ width: "20%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary"></div>
                  </div>
                </div>

                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold inline-block py-1 px-2 uppercase rounded-full text-neon-green bg-neon-green/10">
                        Ganhos Modders (80%)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-neon-green">
                        R$ {(stats?.totalModderEarnings ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-neon-green/10">
                    <div style={{ width: "80%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-neon-green"></div>
                  </div>
                </div>

                <div className="bg-secondary/20 p-4 rounded-lg border border-border/50 mt-4">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Lucro Bruto:</span>
                    <span className="font-bold">R$ {(stats?.totalSales ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Licenças Ativas:</span>
                    <span className="font-bold">{stats?.licenses}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending modders */}
        {(pendingModders?.length ?? 0) > 0 && (
          <Card className="neon-border bg-card/80 mb-8">
            <CardHeader><CardTitle>Solicitações de Modder</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {pendingModders?.map((req: any) => (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div>
                    <p className="font-semibold text-sm">{(req as any).profiles?.display_name ?? (req as any).profiles?.username}</p>
                    <p className="text-xs text-muted-foreground">Solicitado em {new Date(req.requested_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-accent border-accent/30" onClick={() => approveModder(req.id, req.user_id)}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => rejectModder(req.id, req.user_id)}>
                      <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Main admin tabs */}
        <Tabs defaultValue="scripts" className="font-mono">
          <TabsList className="mb-6 grid w-full grid-cols-5 p-1 bg-[#050505] border border-white/10 rounded-none h-14">
            <TabsTrigger value="scripts" className="text-[10px] sm:text-xs tracking-widest uppercase font-black gap-2 data-[state=active]:bg-[#030304] data-[state=active]:text-neon-purple rounded-none h-full">
              <Code className="h-4 w-4" /> <span className="hidden sm:inline">Scripts</span>
            </TabsTrigger>
            <TabsTrigger value="licenses" className="text-[10px] sm:text-xs tracking-widest uppercase font-black gap-2 data-[state=active]:bg-[#030304] data-[state=active]:text-neon-green rounded-none h-full">
              <Key className="h-4 w-4" /> <span className="hidden sm:inline">Licenças</span>
            </TabsTrigger>
            <TabsTrigger value="purchases" className="text-[10px] sm:text-xs tracking-widest uppercase font-black gap-2 data-[state=active]:bg-[#030304] data-[state=active]:text-accent rounded-none h-full">
              <ShoppingCart className="h-4 w-4" /> <span className="hidden sm:inline">Compras</span>
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="text-[10px] sm:text-xs tracking-widest uppercase font-black gap-2 data-[state=active]:bg-[#030304] data-[state=active]:text-primary rounded-none h-full">
              <Landmark className="h-4 w-4" /> <span className="hidden sm:inline">Saques</span>
            </TabsTrigger>
            <TabsTrigger value="leaks" className="text-[10px] sm:text-xs tracking-widest uppercase font-black gap-2 data-[state=active]:bg-[#030304] data-[state=active]:text-destructive rounded-none h-full">
              <AlertTriangle className="h-4 w-4" /> <span className="hidden sm:inline">Vazamentos</span>
            </TabsTrigger>
          </TabsList>

          {/* Scripts Tab */}
          <TabsContent value="scripts">
            <Card className="border-white/10 bg-[#050505] rounded-none">
              <CardHeader className="border-b border-white/5 bg-[#030304]">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
                  <Code className="w-4 h-4 text-neon-purple" />
                  Sistema de Inteligência (Scripts)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Tabs defaultValue="pending_review">
                  <TabsList className="mb-6 grid w-full grid-cols-4 p-1 bg-[#030304] border border-white/5 rounded-none h-12">
                    <TabsTrigger value="pending_review" className="text-[9px] sm:text-[10px] tracking-widest uppercase font-black gap-2 data-[state=active]:bg-[#0a0a0c] data-[state=active]:text-white rounded-none h-full">
                      <Send className="h-3 w-3" /> <span className="hidden sm:inline">Em Análise</span> ({pendingReview.length})
                    </TabsTrigger>
                    <TabsTrigger value="published" className="text-[9px] sm:text-[10px] tracking-widest uppercase font-black gap-2 data-[state=active]:bg-[#0a0a0c] data-[state=active]:text-neon-cyan rounded-none h-full">
                      <Eye className="h-3 w-3" /> <span className="hidden sm:inline">Ativos</span> ({published.length})
                    </TabsTrigger>
                    <TabsTrigger value="drafts" className="text-xs gap-1">
                      <Clock className="h-3 w-3" /> Rascunhos ({drafts.length})
                    </TabsTrigger>
                    <TabsTrigger value="archived" className="text-xs gap-1">
                      <FileX className="h-3 w-3" /> Arquivados ({archived.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="pending_review" className="space-y-2">
                    {pendingReview.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhum script aguardando revisão.</p>}
                    {pendingReview.map((s: any) => <ScriptRow key={s.id} script={s} />)}
                  </TabsContent>

                  <TabsContent value="published" className="space-y-2">
                    {published.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhum script publicado.</p>}
                    {published.map((s: any) => <ScriptRow key={s.id} script={s} />)}
                  </TabsContent>

                  <TabsContent value="drafts" className="space-y-2">
                    {drafts.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhum rascunho.</p>}
                    {drafts.map((s: any) => <ScriptRow key={s.id} script={s} />)}
                  </TabsContent>

                  <TabsContent value="archived" className="space-y-2">
                    {archived.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhum script arquivado.</p>}
                    {archived.map((s: any) => <ScriptRow key={s.id} script={s} />)}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Licenses Tab */}
          <TabsContent value="licenses">
            <Card className="border-white/10 bg-[#050505] rounded-none">
              <CardHeader className="border-b border-white/5 bg-[#030304]">
                <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white">
                  <Key className="h-4 w-4 text-neon-green" /> Hub de Chaves (Licenças)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {allLicenses?.map((license: any) => (
                  <div key={license.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">{license.scripts?.title ?? "Script"}</p>
                        <Badge variant={license.status === "active" ? "default" : "destructive"} className="text-[10px]">
                          {license.status === "active" ? "Ativa" : "Banida"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1 flex-wrap">
                        <span>👤 {(license as any).profiles?.display_name ?? (license as any).profiles?.username ?? "?"}</span>
                        <span className="font-mono">{license.license_key}</span>
                        <span>{new Date(license.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => { navigator.clipboard.writeText(license.license_key); toast.success("Copiado!"); }}
                        title="Copiar licença"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`h-8 ${license.status === "active" ? "text-destructive" : "text-accent"}`}
                        onClick={() => toggleLicenseBan(license.id, license.status)}
                        title={license.status === "active" ? "Banir Licença" : "Reativar Licença"}
                      >
                        {license.status === "active" ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
                {(allLicenses?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma licença registrada.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Purchases Tab */}
          <TabsContent value="purchases">
            <Card className="border-white/10 bg-[#050505] rounded-none">
              <CardHeader className="border-b border-white/5 bg-[#030304]">
                <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white">
                  <ShoppingCart className="h-4 w-4 text-accent" /> Ledger de Transações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {allPurchases?.map((purchase: any) => (
                  <div key={purchase.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div>
                      <p className="font-semibold text-sm">{purchase.scripts?.title ?? "Script"}</p>
                      <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                        <span>👤 {(purchase as any).profiles?.display_name ?? (purchase as any).profiles?.username ?? "?"}</span>
                        <span>R$ {Number(purchase.amount).toFixed(2)}</span>
                        <span className="text-primary">Comissão: R$ {Number((purchase as any).platform_commission || 0).toFixed(2)}</span>
                        <span className="text-accent">Modder: R$ {Number((purchase as any).modder_earnings || 0).toFixed(2)}</span>
                        <span>{new Date(purchase.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-accent/20 text-accent border-accent/30">
                      {purchase.status}
                    </Badge>
                  </div>
                ))}
                {(allPurchases?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma compra registrada.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals">
            <AdminWithdrawalsTab />
          </TabsContent>

          {/* Leak Tracker Tab */}
          <TabsContent value="leaks">
            <Card className="border-white/10 bg-[#050505] rounded-none">
              <CardHeader className="border-b border-white/5 bg-[#030304]">
                <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Rastrear Vazamentos (Security Ops)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Cole o código ofuscado vazado abaixo. O sistema extrairá o watermark embutido e identificará o comprador responsável.
                </p>
                <Textarea
                  placeholder=">_ insira código lua raw/obfuscado aqui..."
                  value={leakCode}
                  onChange={(e) => setLeakCode(e.target.value)}
                  rows={8}
                  className="font-mono text-xs bg-[#030304] border-white/10 focus-visible:ring-neon-purple rounded-none"
                />
                <Button onClick={extractWatermark} disabled={leakSearching} className="bg-neon-purple hover:bg-neon-purple/90 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] rounded-none font-black uppercase tracking-widest text-[10px] sm:text-xs">
                  <Search className="h-4 w-4 mr-2" />
                  {leakSearching ? "Decodificando..." : "Extrair Watermark"}
                </Button>

                {leakError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                    {leakError}
                  </div>
                )}

                {leakResult && (
                  <div className="p-4 rounded-lg bg-secondary/30 border border-primary/30 space-y-2">
                    <h4 className="font-bold text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" /> Comprador Identificado
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">User ID:</span>
                        <p className="font-mono text-xs break-all">{leakResult.userId}</p>
                      </div>
                      {leakResult.username && (
                        <div>
                          <span className="text-muted-foreground">Usuário:</span>
                          <p className="font-semibold">{leakResult.displayName || leakResult.username}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(leakResult.userId); toast.success("User ID copiado!"); }}>
                        <Copy className="h-3 w-3 mr-1" /> Copiar ID
                      </Button>
                      {leakResult.username && (
                        <Button size="sm" variant="outline" onClick={() => navigate(`/modder/${leakResult.username}`)}>
                          <Eye className="h-3 w-3 mr-1" /> Ver Perfil
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Moderation Queue */}
        <div className="mt-8">
          <AdminModerationQueue />
        </div>

        {/* Flagged Scripts */}
        <div className="mt-8">
          <AdminFlaggedScripts />
        </div>

        {/* Badge Management */}
        <div className="mt-8">
          <AdminBadges />
        </div>
      </div>

      {/* Code Viewer Dialog */}
      <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Código: {codeDialogTitle}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <LuaCodeEditor value={codeDialogContent} readOnly onChange={() => { }} minHeight="300px" />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
