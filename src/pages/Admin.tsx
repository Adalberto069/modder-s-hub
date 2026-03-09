import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Users, Code, CheckCircle, XCircle, Trash2, Plus, Pencil, Eye, EyeOff, Clock, FileX, Send, Shield,
  UserCheck, ShieldCheck, ShieldOff, Key, Ban, ShoppingCart, Copy, DollarSign, Percent, Search, AlertTriangle,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminBadges } from "@/components/admin/AdminBadges";
import { AdminFlaggedScripts } from "@/components/admin/AdminFlaggedScripts";
import { AdminModerationQueue } from "@/components/admin/AdminModerationQueue";
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
      <div className={`flex items-center justify-between p-3 rounded-lg bg-secondary/30 gap-2 ${!script.is_active ? 'opacity-60' : ''}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm truncate">{script.title}</p>
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Painel Admin</h1>
          <Button onClick={() => navigate("/script/new")} className="neon-glow-purple">
            <Plus className="mr-2 h-4 w-4" /> Novo Script
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Card className="neon-border bg-card/80">
            <CardContent className="p-4 text-center">
              <Users className="h-5 w-5 mx-auto text-neon-purple mb-1" />
              <p className="text-2xl font-bold font-mono">{stats?.users}</p>
              <p className="text-xs text-muted-foreground">Usuários</p>
            </CardContent>
          </Card>
          <Card className="neon-border bg-card/80">
            <CardContent className="p-4 text-center">
              <Code className="h-5 w-5 mx-auto text-neon-green mb-1" />
              <p className="text-2xl font-bold font-mono">{stats?.scripts}</p>
              <p className="text-xs text-muted-foreground">Scripts</p>
            </CardContent>
          </Card>
          <Card className="neon-border bg-card/80">
            <CardContent className="p-4 text-center">
              <ShoppingCart className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold font-mono">{stats?.purchases}</p>
              <p className="text-xs text-muted-foreground">Compras</p>
            </CardContent>
          </Card>
          <Card className="neon-border bg-card/80">
            <CardContent className="p-4 text-center">
              <Shield className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold font-mono">{pendingModders?.length}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>
        </div>

        {/* Financial Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="neon-border bg-card/80 border-accent/30">
            <CardContent className="p-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto text-accent mb-1" />
              <p className="text-2xl font-bold font-mono text-accent">R$ {(stats?.totalSales ?? 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Total de Vendas</p>
            </CardContent>
          </Card>
          <Card className="neon-border bg-card/80 border-primary/30">
            <CardContent className="p-4 text-center">
              <Percent className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold font-mono text-primary">R$ {(stats?.totalCommission ?? 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Comissão Plataforma (20%)</p>
            </CardContent>
          </Card>
          <Card className="neon-border bg-card/80 border-neon-green/30">
            <CardContent className="p-4 text-center">
              <Key className="h-5 w-5 mx-auto text-neon-green mb-1" />
              <p className="text-2xl font-bold font-mono text-neon-green">R$ {(stats?.totalModderEarnings ?? 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Ganhos dos Modders</p>
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
        <Tabs defaultValue="scripts">
          <TabsList className="mb-4 grid w-full grid-cols-3">
            <TabsTrigger value="scripts" className="text-xs gap-1">
              <Code className="h-3 w-3" /> Scripts
            </TabsTrigger>
            <TabsTrigger value="licenses" className="text-xs gap-1">
              <Key className="h-3 w-3" /> Licenças
            </TabsTrigger>
            <TabsTrigger value="purchases" className="text-xs gap-1">
              <ShoppingCart className="h-3 w-3" /> Compras
            </TabsTrigger>
          </TabsList>

          {/* Scripts Tab */}
          <TabsContent value="scripts">
            <Card className="neon-border bg-card/80">
              <CardHeader>
                <CardTitle>Gerenciar Scripts</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="pending_review">
                  <TabsList className="mb-4 grid w-full grid-cols-4">
                    <TabsTrigger value="pending_review" className="text-xs gap-1">
                      <Send className="h-3 w-3" /> Revisão ({pendingReview.length})
                    </TabsTrigger>
                    <TabsTrigger value="published" className="text-xs gap-1">
                      <Eye className="h-3 w-3" /> Publicados ({published.length})
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
            <Card className="neon-border bg-card/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" /> Gerenciar Licenças
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
            <Card className="neon-border bg-card/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" /> Histórico de Compras
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
            <LuaCodeEditor value={codeDialogContent} readOnly onChange={() => {}} minHeight="300px" />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
