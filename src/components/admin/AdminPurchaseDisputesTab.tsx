import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Gavel, User, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

export function AdminPurchaseDisputesTab() {
  const queryClient = useQueryClient();
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data: disputes, isLoading } = useQuery({
    queryKey: ["admin-purchase-disputes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_disputes")
        .select("*")
        .order("created_at", { ascending: false });
      if (!data) return [];
      // Enrich with buyer/modder profiles
      const userIds = Array.from(new Set(data.flatMap((d: any) => [d.opener_id, d.modder_id])));
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", userIds);
      const map = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p]));
      return data.map((d: any) => ({
        ...d,
        opener: map[d.opener_id],
        modder: map[d.modder_id],
      }));
    },
  });

  const resolve = async (dispute: any, favor: "buyer" | "seller") => {
    setBusy(dispute.id);
    const table = dispute.purchase_type === "script" ? "script_purchases" : "bounty_purchases";
    const notes = notesById[dispute.id] || null;
    const now = new Date().toISOString();

    // Update dispute
    const { error: dErr } = await (supabase.from("purchase_disputes") as any)
      .update({
        status: favor === "buyer" ? "resolved_buyer" : "resolved_seller",
        admin_notes: notes,
        resolved_at: now,
      })
      .eq("id", dispute.id);
    if (dErr) { setBusy(null); return toast.error(dErr.message); }

    // Update purchase escrow
    const { error: pErr } = await (supabase.from(table) as any)
      .update({
        escrow_status: favor === "buyer" ? "refunded" : "released",
        escrow_released_at: now,
      })
      .eq("id", dispute.purchase_id);
    if (pErr) { setBusy(null); return toast.error(pErr.message); }

    // Notify both parties
    await (supabase.from("notifications") as any).insert([
      {
        user_id: dispute.opener_id,
        title: favor === "buyer" ? "✅ Disputa resolvida a seu favor" : "❌ Disputa recusada",
        message: favor === "buyer"
          ? "O admin decidiu a seu favor. Se o pagamento não for estornado automaticamente pelo Mercado Pago, entre em contato."
          : "O admin não encontrou motivo válido. O pagamento foi liberado ao modder.",
        type: favor === "buyer" ? "success" : "warning",
        link: "/dashboard",
      },
      {
        user_id: dispute.modder_id,
        title: favor === "seller" ? "💰 Disputa resolvida a seu favor" : "⚠️ Reembolso emitido",
        message: favor === "seller"
          ? "O admin liberou o pagamento em custódia."
          : "O admin decidiu reembolsar o comprador. Reveja a qualidade do produto.",
        type: favor === "seller" ? "success" : "warning",
        link: "/dashboard?tab=finance",
      },
    ]);

    toast.success("Disputa resolvida");
    setBusy(null);
    queryClient.invalidateQueries({ queryKey: ["admin-purchase-disputes"] });
  };

  const open = (disputes ?? []).filter((d: any) => d.status === "open");
  const resolved = (disputes ?? []).filter((d: any) => d.status !== "open");

  return (
    <div className="space-y-6 font-mono">
      <Card className="bg-[#050505] border-yellow-500/20 rounded-none">
        <CardHeader className="border-b border-yellow-500/10 bg-yellow-500/5">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-yellow-400 flex items-center gap-2">
            <Gavel className="h-4 w-4" /> Disputas Abertas ({open.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {!isLoading && open.length === 0 && (
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Nenhuma disputa aberta.</p>
          )}
          {open.map((d: any) => (
            <div key={d.id} className="p-4 border border-white/10 bg-[#030304] space-y-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <Badge variant="outline" className="rounded-none text-[9px] mb-2">
                    {d.purchase_type === "script" ? "SCRIPT" : "ENCOMENDA"}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    <User className="inline h-3 w-3 mr-1" /> Comprador:{" "}
                    <span className="text-foreground">{d.opener?.display_name || d.opener?.username || d.opener_id.slice(0, 8)}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    <User className="inline h-3 w-3 mr-1" /> Modder:{" "}
                    <span className="text-foreground">{d.modder?.display_name || d.modder?.username || d.modder_id.slice(0, 8)}</span>
                  </p>
                </div>
                <p className="text-[9px] text-muted-foreground">{format(new Date(d.created_at), "dd/MM HH:mm")}</p>
              </div>

              <div className="p-3 bg-[#050505] border border-white/5">
                <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Motivo:</p>
                <p className="text-xs whitespace-pre-wrap">{d.reason}</p>
              </div>

              <Textarea
                value={notesById[d.id] ?? ""}
                onChange={(e) => setNotesById({ ...notesById, [d.id]: e.target.value })}
                placeholder="Notas do admin (opcional)"
                rows={2}
                className="bg-[#050505] border-white/10 rounded-none resize-none text-xs"
              />

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => resolve(d, "buyer")}
                  disabled={busy === d.id}
                  className="rounded-none bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 text-[10px] uppercase font-black tracking-widest flex-1"
                >
                  {busy === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                  Reembolsar comprador
                </Button>
                <Button
                  size="sm"
                  onClick={() => resolve(d, "seller")}
                  disabled={busy === d.id}
                  className="rounded-none bg-neon-green/10 text-neon-green border border-neon-green/30 hover:bg-neon-green/20 text-[10px] uppercase font-black tracking-widest flex-1"
                >
                  {busy === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                  Liberar ao modder
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {resolved.length > 0 && (
        <Card className="bg-[#050505] border-white/10 rounded-none">
          <CardHeader className="border-b border-white/5 bg-[#030304]">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">
              Histórico ({resolved.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            {resolved.slice(0, 20).map((d: any) => (
              <div key={d.id} className="flex items-center justify-between p-3 border border-white/5 bg-[#030304]">
                <div>
                  <p className="text-[10px] uppercase tracking-widest">
                    {d.purchase_type} · {d.opener?.display_name || d.opener?.username}
                  </p>
                  {d.admin_notes && <p className="text-[9px] text-muted-foreground mt-1">"{d.admin_notes}"</p>}
                </div>
                <Badge
                  className={`rounded-none text-[9px] ${
                    d.status === "resolved_buyer"
                      ? "bg-red-500/10 text-red-400 border-red-500/30"
                      : "bg-neon-green/10 text-neon-green border-neon-green/30"
                  }`}
                >
                  {d.status === "resolved_buyer" ? "Reembolsado" : "Liberado"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
