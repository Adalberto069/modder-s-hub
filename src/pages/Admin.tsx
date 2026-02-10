import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { Users, Code, CheckCircle, XCircle, Trash2 } from "lucide-react";

export default function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();

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
        .select("*")
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
      return { users: usersCount ?? 0, scripts: scriptsCount ?? 0 };
    },
    enabled: isAdmin,
  });

  if (loading) return <Layout><div className="container py-16 text-center">Carregando...</div></Layout>;
  if (!user || !isAdmin) return <Navigate to="/" />;

  const approveModder = async (roleId: string) => {
    const { error } = await supabase.from("user_roles").update({ approved: true, approved_at: new Date().toISOString() }).eq("id", roleId);
    if (error) toast.error(error.message);
    else {
      toast.success("Modder aprovado!");
      queryClient.invalidateQueries({ queryKey: ["pending-modders"] });
    }
  };

  const rejectModder = async (roleId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) toast.error(error.message);
    else {
      toast.success("Solicitação rejeitada.");
      queryClient.invalidateQueries({ queryKey: ["pending-modders"] });
    }
  };

  const deleteScript = async (scriptId: string) => {
    const { error } = await supabase.from("scripts").delete().eq("id", scriptId);
    if (error) toast.error(error.message);
    else {
      toast.success("Script removido!");
      queryClient.invalidateQueries({ queryKey: ["admin-scripts"] });
    }
  };

  return (
    <Layout>
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6">Painel Admin</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
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
              <Users className="h-5 w-5 mx-auto text-neon-cyan mb-1" />
              <p className="text-2xl font-bold font-mono">{pendingModders?.length}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending modders */}
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
                  <Button size="sm" variant="outline" className="text-neon-green border-neon-green/30" onClick={() => approveModder(req.id)}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => rejectModder(req.id)}>
                    <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                  </Button>
                </div>
              </div>
            ))}
            {pendingModders?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>}
          </CardContent>
        </Card>

        {/* All scripts */}
        <Card className="neon-border bg-card/80">
          <CardHeader><CardTitle>Todos os Scripts</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {allScripts?.map((script: any) => (
              <div key={script.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-semibold text-sm">{script.title}</p>
                  <p className="text-xs text-muted-foreground">{script.download_count} downloads</p>
                </div>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteScript(script.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {allScripts?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum script na plataforma.</p>}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
