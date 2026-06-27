import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, LinkIcon } from "lucide-react";

export function AdminWithdrawalsTab() {
  const { isAdmin } = useAuth();

  // Fetch all modder profiles with their MP connection status
  const { data: modders } = useQuery({
    queryKey: ["admin-modder-accounts"],
    queryFn: async () => {
      // Get all modder role users
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "modder")
        .eq("approved", true);

      if (!roles || roles.length === 0) return [];

      const userIds = roles.map(r => r.user_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", userIds);

      // Check MP connections (admin can see via service - we query what's available)
      const { data: mpAccounts } = await (supabase as any)
        .from("modder_mp_accounts")
        .select("user_id, mp_user_id, connected_at")
        .in("user_id", userIds);

      const mpMap = new Map<string, any>((mpAccounts ?? []).map((a: any) => [a.user_id, a]));

      return (profiles ?? []).map(p => ({
        ...p,
        mp_connected: mpMap.has(p.user_id),
        mp_user_id: mpMap.get(p.user_id)?.mp_user_id,
        mp_connected_at: mpMap.get(p.user_id)?.connected_at,
      }));
    },
    enabled: isAdmin,
  });

  // Fetch completed purchases to show earnings per modder
  const { data: purchases } = useQuery({
    queryKey: ["admin-modder-earnings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("script_purchases")
        .select("script_id, modder_earnings, status, amount, platform_commission")
        .eq("status", "completed");
      return data ?? [];
    },
    enabled: isAdmin,
  });

  // Get script -> modder mapping
  const { data: scripts } = useQuery({
    queryKey: ["admin-scripts-modder-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("scripts")
        .select("id, modder_id");
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const scriptModderMap = new Map((scripts ?? []).map(s => [s.id, s.modder_id]));

  const modderEarnings = new Map<string, { total: number; platformTotal: number; count: number }>();
  (purchases ?? []).forEach(p => {
    const modderId = scriptModderMap.get(p.script_id);
    if (!modderId) return;
    const existing = modderEarnings.get(modderId) || { total: 0, platformTotal: 0, count: 0 };
    existing.total += Number(p.modder_earnings);
    existing.platformTotal += Number(p.platform_commission);
    existing.count += 1;
    modderEarnings.set(modderId, existing);
  });

  const connected = modders?.filter(m => m.mp_connected) ?? [];
  const notConnected = modders?.filter(m => !m.mp_connected) ?? [];

  const totalPlatformRevenue = Array.from(modderEarnings.values()).reduce((s, e) => s + e.platformTotal, 0);

  return (
    <div className="space-y-6">
      {/* Platform Revenue Summary */}
      <Card className="bg-[#050505] border-white/10 rounded-none font-mono">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="bg-primary/5 border border-primary/20 p-3">
              <LinkIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Receita Plataforma (20%)</p>
              <p className="text-2xl font-bold text-foreground mt-1">R$ {totalPlatformRevenue.toFixed(2)}</p>
              <p className="text-[9px] text-muted-foreground mt-1">
                {connected.length} modder(s) conectado(s) • Split automático via Mercado Pago Marketplace
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Modders */}
      <Card className="bg-[#050505] border-white/10 rounded-none font-mono">
        <CardHeader className="border-b border-white/5 bg-[#030304]">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-accent" />
            Modders Conectados ({connected.length})
          </CardTitle>
          <CardDescription className="text-[10px] uppercase font-mono mt-1">
            Pagamentos são divididos automaticamente: 80% modder, 20% plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-2">
            {connected.map(m => {
              const earnings = modderEarnings.get(m.user_id);
              return (
                <div key={m.user_id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-[#030304] border border-white/5 gap-2">
                  <div>
                    <p className="text-xs font-bold text-foreground">{m.display_name || m.username}</p>
                    <p className="text-[9px] text-muted-foreground">
                      MP ID: {m.mp_user_id} • Conectado em {new Date(m.mp_connected_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {earnings && (
                      <span className="text-[10px] text-muted-foreground">
                        {earnings.count} vendas • R$ {earnings.total.toFixed(2)} recebidos
                      </span>
                    )}
                    <Badge variant="outline" className="text-[9px] rounded-none border-accent/30 text-accent uppercase tracking-widest">
                      Ativo
                    </Badge>
                  </div>
                </div>
              );
            })}
            {connected.length === 0 && (
              <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest py-4">
                Nenhum modder conectou o Mercado Pago ainda.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Not Connected Modders */}
      <Card className="bg-[#050505] border-white/10 rounded-none font-mono">
        <CardHeader className="border-b border-white/5 bg-[#030304]">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            Modders Sem Conexão ({notConnected.length})
          </CardTitle>
          <CardDescription className="text-[10px] uppercase font-mono mt-1">
            Estes modders precisam conectar o Mercado Pago para vender scripts pagos.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-2">
            {notConnected.map(m => (
              <div key={m.user_id} className="flex items-center justify-between p-3 bg-[#030304] border border-white/5">
                <p className="text-xs font-bold text-foreground">{m.display_name || m.username}</p>
                <Badge variant="outline" className="text-[9px] rounded-none border-destructive/30 text-destructive uppercase tracking-widest">
                  Não conectado
                </Badge>
              </div>
            ))}
            {notConnected.length === 0 && (
              <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest py-4">
                Todos os modders estão conectados!
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
