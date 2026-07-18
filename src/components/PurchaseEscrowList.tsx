import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Shield, CheckCircle2, AlertTriangle, Clock, Loader2 } from "lucide-react";

type PurchaseType = "script" | "bounty";

interface Row {
  id: string;
  type: PurchaseType;
  title: string;
  amount: number;
  escrow_status: "held" | "released" | "disputed" | "refunded";
  escrow_release_at: string | null;
  created_at: string;
}

function formatCountdown(target: string): string {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return "liberando…";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function PurchaseEscrowList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tick, setTick] = useState(0);
  const [disputeFor, setDisputeFor] = useState<Row | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["my-escrow-purchases", user?.id, tick],
    queryFn: async (): Promise<Row[]> => {
      if (!user) return [];
      const [scripts, bounties] = await Promise.all([
        supabase
          .from("script_purchases")
          .select("id, amount, escrow_status, escrow_release_at, created_at, scripts:script_id(title)")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .in("escrow_status", ["held", "disputed"])
          .order("created_at", { ascending: false }),
        supabase
          .from("bounty_purchases")
          .select("id, amount, escrow_status, escrow_release_at, created_at, bounties:bounty_id(title)")
          .eq("payer_id", user.id)
          .eq("status", "completed")
          .in("escrow_status", ["held", "disputed"])
          .order("created_at", { ascending: false }),
      ]);
      const s: Row[] = (scripts.data ?? []).map((r: any) => ({
        id: r.id,
        type: "script",
        title: r.scripts?.title ?? "Script",
        amount: Number(r.amount),
        escrow_status: r.escrow_status,
        escrow_release_at: r.escrow_release_at,
        created_at: r.created_at,
      }));
      const b: Row[] = (bounties.data ?? []).map((r: any) => ({
        id: r.id,
        type: "bounty",
        title: r.bounties?.title ?? "Encomenda",
        amount: Number(r.amount),
        escrow_status: r.escrow_status,
        escrow_release_at: r.escrow_release_at,
        created_at: r.created_at,
      }));
      return [...s, ...b].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    },
    enabled: !!user,
  });

  const list = useMemo(() => rows ?? [], [rows]);

  const confirm = async (row: Row) => {
    setBusy(row.id);
    const { error } = await supabase.functions.invoke("confirm-purchase", {
      body: { purchase_id: row.id, purchase_type: row.type },
    });
    setBusy(null);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Pagamento liberado ao modder. Obrigado!");
    queryClient.invalidateQueries({ queryKey: ["my-escrow-purchases"] });
  };

  const openDispute = async () => {
    if (!disputeFor) return;
    if (disputeReason.trim().length < 10) {
      return toast.error("Descreva o problema com pelo menos 10 caracteres");
    }
    setBusy(disputeFor.id);
    const { error } = await supabase.functions.invoke("open-dispute", {
      body: { purchase_id: disputeFor.id, purchase_type: disputeFor.type, reason: disputeReason },
    });
    setBusy(null);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Disputa aberta. Um admin analisará seu caso.");
    setDisputeFor(null);
    setDisputeReason("");
    queryClient.invalidateQueries({ queryKey: ["my-escrow-purchases"] });
  };

  if (isLoading || list.length === 0) return null;

  return (
    <>
      <Card className="bg-[#050505] border-neon-purple/20 rounded-none font-mono mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-white/5">
            <Shield className="h-4 w-4 text-neon-purple" />
            <p className="text-[10px] font-black uppercase tracking-widest text-neon-purple">
              Compras em custódia · {list.length}
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            O pagamento do modder fica retido por 12h após o primeiro download. Se não funcionar,
            <span className="text-yellow-400"> abra uma disputa</span> antes do prazo. Se funcionou, 
            <span className="text-neon-green"> confirme o recebimento</span> pra liberar na hora.
          </p>

          {list.map((r) => (
            <div key={r.id} className="p-3 bg-[#030304] border border-white/5 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{r.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    R$ {r.amount.toFixed(2)} · {r.type === "script" ? "Script" : "Encomenda"}
                  </p>
                </div>
                {r.escrow_status === "disputed" ? (
                  <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 rounded-none text-[9px]">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Em disputa
                  </Badge>
                ) : r.escrow_release_at ? (
                  <Badge variant="outline" className="rounded-none text-[9px] border-neon-purple/30 text-neon-purple">
                    <Clock className="h-3 w-3 mr-1" /> {formatCountdown(r.escrow_release_at)}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="rounded-none text-[9px]">
                    Aguardando download
                  </Badge>
                )}
              </div>

              {r.escrow_status === "held" && (
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => confirm(r)}
                    disabled={busy === r.id}
                    className="rounded-none bg-neon-green/10 text-neon-green border border-neon-green/30 hover:bg-neon-green/20 text-[10px] uppercase font-black tracking-widest h-9 flex-1"
                  >
                    {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                    Confirmar recebimento
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDisputeFor(r)}
                    disabled={busy === r.id}
                    className="rounded-none border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 text-[10px] uppercase font-black tracking-widest h-9 flex-1"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" /> Abrir disputa
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!disputeFor} onOpenChange={(o) => { if (!o) { setDisputeFor(null); setDisputeReason(""); } }}>
        <DialogContent className="bg-[#050505] border-white/10 rounded-none">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-widest">Abrir disputa</DialogTitle>
            <DialogDescription className="text-[10px]">
              Descreva o problema com o produto. O modder e um admin serão notificados. Use com honestidade — abrir disputas falsas pode gerar bloqueio da conta.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            rows={5}
            placeholder="Ex: O APK travou ao abrir. Testei em Android 11 conforme informado, mas fecha na tela inicial."
            className="bg-[#030304] border-white/10 rounded-none resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeFor(null)} className="rounded-none">Cancelar</Button>
            <Button onClick={openDispute} disabled={busy === disputeFor?.id} className="rounded-none bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 hover:bg-yellow-500/30">
              {busy === disputeFor?.id && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Enviar disputa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
