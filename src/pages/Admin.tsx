import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Navigate, useNavigate } from "react-router-dom";
import { Users, Code, CheckCircle, XCircle, Trash2, Plus, Pencil, Eye, Clock, FileX, Send, Shield, UserCheck, ShieldCheck, ShieldOff } from "lucide-react";
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
      return { users: usersCount ?? 0, scripts: scriptsCount ?? 0, modders: moddersCount };
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
    const { error } = await supabase.from("scripts").delete().eq("id", scriptId);
    if (error) toast.error(error.message);
    else { toast.success("Script removido!"); queryClient.invalidateQueries({ queryKey: ["admin-scripts"] }); }
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

  const pendingReview = allScripts?.filter((s: any) => s.publish_status === "pending_review") ?? [];
  const published = allScripts?.filter((s: any) => s.publish_status === "published" || !s.publish_status) ?? [];
  const drafts = allScripts?.filter((s: any) => s.publish_status === "draft") ?? [];
  const archived = allScripts?.filter((s: any) => s.publish_status === "archived") ?? [];

  const ScriptRow = ({ script }: { script: any }) => {
    const ps = publishStatusConfig[(script as any).publish_status ?? "published"] ?? publishStatusConfig.published;
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm truncate">{script.title}</p>
            <Badge variant="outline" className={`text-[10px] ${ps.className}`}>{ps.label}</Badge>
            {script.is_verified && <Badge variant="outline" className="text-[10px] bg-accent/20 text-accent border-accent/30">✅ Verificado</Badge>}
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
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteScript(script.id)} title="Excluir">
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="neon-border bg-card/80">
            <CardContent className="p-4 text-center">
              <Users className="h-5 w-5 mx-auto text-neon-purple mb-1" />
              <p className="text-2xl font-bold font-mono">{stats?.users}</p>
              <p className="text-xs text-muted-foreground">Usuários Total</p>
            </CardContent>
          </Card>
          <Card className="neon-border bg-card/80">
            <CardContent className="p-4 text-center">
              <UserCheck className="h-5 w-5 mx-auto text-neon-cyan mb-1" />
              <p className="text-2xl font-bold font-mono">{stats?.modders}</p>
              <p className="text-xs text-muted-foreground">Modders</p>
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
              <Clock className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold font-mono">{pendingReview.length}</p>
              <p className="text-xs text-muted-foreground">Em Revisão</p>
            </CardContent>
          </Card>
          <Card className="neon-border bg-card/80">
            <CardContent className="p-4 text-center">
              <Shield className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold font-mono">{pendingModders?.length}</p>
              <p className="text-xs text-muted-foreground">Modders Pendentes</p>
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

        {/* Scripts Management with Tabs */}
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
    </Layout>
  );
}
