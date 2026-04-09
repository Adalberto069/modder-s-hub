import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, XCircle, Eye, MessageSquare, Shield } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";

export function AdminDisputesTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState(false);

  const { data: disputes, isLoading } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bounty_deliveries")
        .select("*")
        .eq("disputed", true)
        .eq("dispute_resolved", false)
        .order("delivered_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: resolvedDisputes } = useQuery({
    queryKey: ["admin-disputes-resolved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bounty_deliveries")
        .select("*")
        .eq("disputed", true)
        .eq("dispute_resolved", true)
        .order("delivered_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Fetch bounty info for all disputes
  const bountyIds = [...new Set([...(disputes ?? []), ...(resolvedDisputes ?? [])].map(d => d.bounty_id))];
  const { data: bounties } = useQuery({
    queryKey: ["admin-dispute-bounties", bountyIds],
    queryFn: async () => {
      if (bountyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("bounties")
        .select("id, title, requester_id, assigned_modder_id, reward_amount")
        .in("id", bountyIds);
      if (error) throw error;
      return data;
    },
    enabled: bountyIds.length > 0,
  });

  const modderIds = [...new Set([...(disputes ?? []), ...(resolvedDisputes ?? [])].map(d => d.modder_id))];
  const requesterIds = [...new Set((bounties ?? []).map(b => b.requester_id))];
  const allUserIds = [...new Set([...modderIds, ...requesterIds])];

  const { data: profiles } = useQuery({
    queryKey: ["admin-dispute-profiles", allUserIds],
    queryFn: async () => {
      if (allUserIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", allUserIds);
      if (error) throw error;
      return data;
    },
    enabled: allUserIds.length > 0,
  });

  const bountyMap = Object.fromEntries((bounties ?? []).map(b => [b.id, b]));
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
  const getName = (uid: string) => {
    const p = profileMap[uid];
    return p?.display_name || p?.username || uid.slice(0, 8);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!disputes) return;
    if (selectedIds.size === disputes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(disputes.map(d => d.id)));
    }
  };

  const resolveDispute = async (deliveryId: string, favor: "requester" | "modder") => {
    if (!user) return;
    setResolving(true);
    try {
      const { error } = await supabase
        .from("bounty_deliveries")
        .update({
          dispute_resolved: true,
          dispute_resolved_by: user.id,
        })
        .eq("id", deliveryId);
      if (error) throw error;

      // If resolved in favor of requester, we could cancel the bounty or re-open
      const delivery = disputes?.find(d => d.id === deliveryId);
      if (delivery) {
        const bounty = bountyMap[delivery.bounty_id];
        if (favor === "requester" && bounty) {
          // Re-open bounty so requester can find another modder
          await supabase.from("bounties").update({ status: "open", assigned_modder_id: null }).eq("id", bounty.id);
        }

        // Notify both parties
        const notifs = [
          {
            user_id: delivery.modder_id,
            title: "Disputa Resolvida",
            message: favor === "modder"
              ? "A disputa foi resolvida a seu favor."
              : "A disputa foi resolvida a favor do solicitante.",
            type: favor === "modder" ? "success" : "warning",
            link: `/bounties/${delivery.bounty_id}`,
          },
        ];
        if (bounty) {
          notifs.push({
            user_id: bounty.requester_id,
            title: "Disputa Resolvida",
            message: favor === "requester"
              ? "A disputa foi resolvida a seu favor. A encomenda foi reaberta."
              : "A disputa foi resolvida a favor do modder.",
            type: favor === "requester" ? "success" : "warning",
            link: `/bounties/${delivery.bounty_id}`,
          });
        }
        await supabase.from("notifications").insert(notifs);
      }

      toast.success("Disputa resolvida com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-disputes-resolved"] });
    } catch (err: any) {
      toast.error("Erro ao resolver disputa: " + err.message);
    } finally {
      setResolving(false);
    }
  };

  const resolveBatch = async (favor: "requester" | "modder") => {
    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos uma disputa.");
      return;
    }
    setResolving(true);
    try {
      for (const id of selectedIds) {
        await resolveDispute(id, favor);
      }
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} disputa(s) resolvida(s) em massa!`);
    } catch {
      // errors already toasted individually
    } finally {
      setResolving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-white/10 bg-[#050505] rounded-none">
        <CardContent className="p-8 text-center text-muted-foreground">Carregando disputas...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-[#050505] rounded-none">
        <CardHeader className="border-b border-white/5 bg-[#030304]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Disputas Abertas ({disputes?.length ?? 0})
            </CardTitle>
            {(disputes?.length ?? 0) > 0 && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[10px] uppercase tracking-widest border-accent/30 text-accent"
                  disabled={selectedIds.size === 0 || resolving}
                  onClick={() => resolveBatch("requester")}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Favor Solicitante ({selectedIds.size})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[10px] uppercase tracking-widest border-primary/30 text-primary"
                  disabled={selectedIds.size === 0 || resolving}
                  onClick={() => resolveBatch("modder")}
                >
                  <Shield className="h-3 w-3 mr-1" />
                  Favor Modder ({selectedIds.size})
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(!disputes || disputes.length === 0) ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma disputa aberta no momento.</p>
          ) : (
            <>
              {/* Select all */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-[#030304]">
                <Checkbox
                  checked={selectedIds.size === disputes.length && disputes.length > 0}
                  onCheckedChange={toggleAll}
                />
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Selecionar Todos</span>
              </div>

              {disputes.map(delivery => {
                const bounty = bountyMap[delivery.bounty_id];
                return (
                  <div key={delivery.id} className="flex items-start gap-3 p-4 border-b border-white/5 hover:bg-[#08080a] transition-colors">
                    <Checkbox
                      checked={selectedIds.has(delivery.id)}
                      onCheckedChange={() => toggleSelect(delivery.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-white uppercase tracking-tight italic truncate">
                          {bounty?.title ?? "Encomenda Desconhecida"}
                        </span>
                        <Badge variant="destructive" className="text-[10px]">Em Disputa</Badge>
                        {bounty && (
                          <Badge variant="outline" className="text-[10px] text-accent border-accent/30">
                            R$ {bounty.reward_amount}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                        <div>
                          <span className="text-[9px] uppercase tracking-widest block mb-0.5">Modder</span>
                          <span className="text-foreground font-medium">{getName(delivery.modder_id)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-widest block mb-0.5">Solicitante</span>
                          <span className="text-foreground font-medium">{bounty ? getName(bounty.requester_id) : "—"}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-widest block mb-0.5">Data Entrega</span>
                          <span className="text-foreground font-medium">
                            {format(new Date(delivery.delivered_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>

                      {delivery.dispute_reason && (
                        <div className="bg-destructive/10 border border-destructive/20 p-3 mt-2">
                          <p className="text-[10px] uppercase tracking-widest text-destructive mb-1 font-bold">Motivo da Disputa</p>
                          <p className="text-xs text-foreground">{delivery.dispute_reason}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-7 border-accent/30 text-accent"
                          disabled={resolving}
                          onClick={() => resolveDispute(delivery.id, "requester")}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" /> Favor Solicitante
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-7 border-primary/30 text-primary"
                          disabled={resolving}
                          onClick={() => resolveDispute(delivery.id, "modder")}
                        >
                          <Shield className="h-3 w-3 mr-1" /> Favor Modder
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[10px] h-7"
                          onClick={() => window.open(`/bounties/${delivery.bounty_id}`, "_blank")}
                        >
                          <Eye className="h-3 w-3 mr-1" /> Ver Encomenda
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>

      {/* Resolved disputes history */}
      {resolvedDisputes && resolvedDisputes.length > 0 && (
        <Card className="border-white/10 bg-[#050505] rounded-none">
          <CardHeader className="border-b border-white/5 bg-[#030304]">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
              <CheckCircle className="w-4 h-4 text-accent" />
              Disputas Resolvidas (Últimas {resolvedDisputes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {resolvedDisputes.map(delivery => {
              const bounty = bountyMap[delivery.bounty_id];
              return (
                <div key={delivery.id} className="flex items-center justify-between p-4 border-b border-white/5 opacity-60">
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-sm text-white truncate block">
                      {bounty?.title ?? "Encomenda"}
                    </span>
                    <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                      <span>Modder: {getName(delivery.modder_id)}</span>
                      <span>Arquivo: {delivery.file_name}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-accent border-accent/30">Resolvida</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
