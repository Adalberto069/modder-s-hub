import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { UserCheck, LogIn, Search, Shield, Code, User, Plus, X, Settings2, Ban, ShieldOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";

type AppRole = "user" | "modder" | "admin";
const ALL_ROLES: AppRole[] = ["user", "modder", "admin"];


export function AdminUsersTab() {
  const [search, setSearch] = useState("");
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [rolesUser, setRolesUser] = useState<any | null>(null);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<any | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banning, setBanning] = useState(false);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();


  const { data: users } = useQuery({
    queryKey: ["admin-all-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*, user_roles(role, approved)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = users?.filter((u: any) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;

    const username = (u.username || "").toLowerCase();
    const displayName = (u.display_name || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    const userId = (u.user_id || "").toLowerCase();
    const profileId = (u.id || "").toLowerCase();
    
    return (
      username.includes(q) ||
      displayName.includes(q) ||
      email.includes(q) ||
      userId.includes(q) ||
      profileId.includes(q)
    );
  });

  const getRoleBadges = (userRoles: any[]) => {
    if (!userRoles) return null;
    return userRoles
      .filter((r: any) => r.approved)
      .map((r: any) => {
        const colors: Record<string, string> = {
          admin: "bg-destructive/20 text-destructive border-destructive/30",
          modder: "bg-accent/20 text-accent border-accent/30",
          user: "bg-muted text-muted-foreground border-border",
        };
        return (
          <Badge key={r.role} variant="outline" className={`text-[10px] ${colors[r.role] || ""}`}>
            {r.role === "admin" && <Shield className="h-3 w-3 mr-1" />}
            {r.role === "modder" && <Code className="h-3 w-3 mr-1" />}
            {r.role === "user" && <User className="h-3 w-3 mr-1" />}
            {r.role}
          </Badge>
        );
      });
  };

  const handleImpersonate = async (targetUserId: string, displayName: string) => {
    if (!window.confirm(`⚠️ Você vai entrar na conta de "${displayName}" para suporte. Deseja continuar?`)) return;

    setImpersonating(targetUserId);
    try {
      // Save current admin session
      const { data: { session: adminSession } } = await supabase.auth.getSession();
      if (!adminSession) {
        toast.error("Sessão admin não encontrada");
        return;
      }

      // Call edge function to get session tokens directly
      const { data, error } = await supabase.functions.invoke("impersonate-user", {
        body: { target_user_id: targetUserId },
      });

      if (error || !data?.access_token) {
        toast.error(data?.error || "Erro ao gerar acesso");
        return;
      }

      // Store admin session for restoration
      localStorage.setItem("admin_impersonation", JSON.stringify({
        refresh_token: adminSession.refresh_token,
        targetName: displayName,
      }));

      // Set the impersonated session directly
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (sessionError) {
        console.error("Session error:", sessionError);
        localStorage.removeItem("admin_impersonation");
        toast.error("Erro ao fazer login como o usuário: " + sessionError.message);
        return;
      }

      toast.success(`Logado como ${displayName}!`);
      window.location.href = "/";
    } catch (e) {
      console.error("Impersonate error:", e);
      localStorage.removeItem("admin_impersonation");
      toast.error("Erro inesperado ao impersonar usuário");
    } finally {
      setImpersonating(null);
    }
  };

  const refreshUsers = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-all-users"] });
  };

  const addRole = async (userId: string, role: AppRole) => {
    setSavingRole(`${userId}-${role}-add`);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role, approved: true });
    setSavingRole(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Patente "${role}" adicionada`);
    refreshUsers();
    setRolesUser((prev: any) => prev ? { ...prev, user_roles: [...(prev.user_roles || []), { role, approved: true }] } : prev);
  };

  const removeRole = async (userId: string, role: AppRole) => {
    if (role === "admin" && userId === currentUser?.id) {
      toast.error("Você não pode remover sua própria patente de admin");
      return;
    }
    setSavingRole(`${userId}-${role}-rm`);
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    setSavingRole(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Patente "${role}" removida`);
    refreshUsers();
    setRolesUser((prev: any) => prev ? { ...prev, user_roles: (prev.user_roles || []).filter((r: any) => r.role !== role) } : prev);
  };

  const handleBanToggle = async () => {
    if (!banTarget) return;
    const isBanned = !!banTarget.is_banned;
    setBanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-ban-user", {
        body: {
          target_user_id: banTarget.user_id,
          action: isBanned ? "unban" : "ban",
          reason: isBanned ? null : banReason.trim() || null,
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Erro ao processar");
        return;
      }
      toast.success(isBanned ? "Conta desbanida" : "Conta banida");
      setBanTarget(null);
      setBanReason("");
      refreshUsers();
    } catch (e: any) {
      toast.error(e?.message || "Erro inesperado");
    } finally {
      setBanning(false);
    }
  };

  const totalUsers = users?.length ?? 0;
  const totalModders = users?.filter((u: any) => u.user_roles?.some((r: any) => r.role === "modder" && r.approved)).length ?? 0;
  const totalAdmins = users?.filter((u: any) => u.user_roles?.some((r: any) => r.role === "admin" && r.approved)).length ?? 0;
  const totalBanned = users?.filter((u: any) => u.is_banned).length ?? 0;

  return (
    <Card className="border-white/10 bg-[#050505] rounded-none">
      <CardHeader className="border-b border-white/5 bg-[#030304]">

        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
          <UserCheck className="w-4 h-4 text-neon-purple" />
          Gerenciamento de Usuários
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            { label: "Total", value: totalUsers, icon: User, color: "text-white border-white/10" },
            { label: "Modders", value: totalModders, icon: Code, color: "text-accent border-accent/30" },
            { label: "Admins", value: totalAdmins, icon: Shield, color: "text-destructive border-destructive/30" },
            { label: "Banidos", value: totalBanned, icon: Ban, color: "text-orange-500 border-orange-500/30" },
          ].map((s) => (
            <div key={s.label} className={`border ${s.color} bg-[#030304] p-2 flex items-center gap-2`}>
              <s.icon className="h-4 w-4" />
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-black">{s.value}</span>
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{s.label}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por email, username, nome ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-[#030304] border-white/10 rounded-none text-sm"
          />
        </div>

        <div className="text-[10px] text-muted-foreground mb-2 uppercase tracking-widest">
          {filtered?.length ?? 0} usuário(s) encontrado(s)
        </div>

        <div className="space-y-1 max-h-[600px] overflow-y-auto">
          {filtered && filtered.length > 0 ? (
            filtered.map((user: any) => {
              const name = user.display_name || user.username;
              const isAdmin = user.user_roles?.some((r: any) => r.role === "admin" && r.approved);
              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 border-b border-white/5 bg-[#050505] hover:bg-[#08080a] transition-colors gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-sm text-white truncate">{name}</span>
                      {getRoleBadges(user.user_roles)}
                    </div>
                    <div className="flex gap-3 text-[10px] text-muted-foreground">
                      <span>@{user.username}</span>
                      {user.email && <span className="text-secondary-foreground/60">{user.email}</span>}
                      <span>Rep: {user.reputation_score ?? 0}</span>
                      <span>Downloads: {user.total_downloads ?? 0}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRolesUser(user)}
                      className="text-[10px] uppercase tracking-widest font-bold gap-1 rounded-none border-neon-purple/30 text-neon-purple hover:bg-neon-purple/10"
                      title="Gerenciar patentes"
                    >
                      <Settings2 className="h-3 w-3" />
                      <span className="hidden sm:inline">Patentes</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isAdmin || impersonating === user.user_id}
                      onClick={() => handleImpersonate(user.user_id, name)}
                      className="text-[10px] uppercase tracking-widest font-bold gap-1 rounded-none border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-30"
                      title={isAdmin ? "Não é possível impersonar outro admin" : "Entrar como este usuário"}
                    >
                      <LogIn className="h-3 w-3" />
                      <span className="hidden sm:inline">{impersonating === user.user_id ? "Entrando..." : "Entrar como"}</span>
                    </Button>
                  </div>

                </div>
              );
            })
          ) : (
            <div className="py-12 text-center border border-dashed border-white/5 bg-[#030304]/50">
              <Search className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {search ? `Nenhum usuário encontrado para "${search}"` : "Nenhum usuário registrado"}
              </p>
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={!!rolesUser} onOpenChange={(o) => !o && setRolesUser(null)}>
        <DialogContent className="max-w-md bg-[#050505] border-white/10 rounded-none">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm uppercase tracking-widest text-white">
              Patentes de {rolesUser?.display_name || rolesUser?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {ALL_ROLES.map((role) => {
              const has = rolesUser?.user_roles?.some((r: any) => r.role === role && r.approved);
              const Icon = role === "admin" ? Shield : role === "modder" ? Code : User;
              const savingAdd = savingRole === `${rolesUser?.user_id}-${role}-add`;
              const savingRm = savingRole === `${rolesUser?.user_id}-${role}-rm`;
              return (
                <div key={role} className="flex items-center justify-between p-3 border border-white/10 bg-[#030304]">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-neon-purple" />
                    <span className="text-sm font-bold uppercase tracking-widest text-white">{role}</span>
                    {has && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Ativo</Badge>}
                  </div>
                  {has ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingRm}
                      onClick={() => removeRole(rolesUser.user_id, role)}
                      className="text-[10px] uppercase font-bold gap-1 rounded-none border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-3 w-3" /> {savingRm ? "..." : "Remover"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingAdd}
                      onClick={() => addRole(rolesUser.user_id, role)}
                      className="text-[10px] uppercase font-bold gap-1 rounded-none border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <Plus className="h-3 w-3" /> {savingAdd ? "..." : "Adicionar"}
                    </Button>
                  )}
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground mt-3">
              As patentes determinam o acesso do usuário ao sistema. Use com cuidado.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
