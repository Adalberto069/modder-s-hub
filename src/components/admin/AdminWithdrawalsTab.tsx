import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, Copy, Landmark } from "lucide-react";

export function AdminWithdrawalsTab() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [actionType, setActionType] = useState<"complete" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  // Fetch withdrawals
  const { data: withdrawals } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("withdrawals")
        .select("*, profiles:modder_id(username, display_name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const pending = withdrawals?.filter((w) => w.status === "pending") ?? [];
  const history = withdrawals?.filter((w) => w.status !== "pending") ?? [];

  const openActionDialog = (withdrawal: any, type: "complete" | "reject") => {
    setSelectedWithdrawal(withdrawal);
    setActionType(type);
    setAdminNotes(withdrawal.admin_notes || "");
    setDialogOpen(true);
  };

  const handleProcess = async () => {
    if (!selectedWithdrawal || !actionType) return;
    
    setProcessing(true);
    const newStatus = actionType === "complete" ? "completed" : "rejected";
    
    const { error } = await supabase
      .from("withdrawals")
      .update({
        status: newStatus,
        admin_notes: adminNotes || null,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", selectedWithdrawal.id);

    if (error) {
      toast.error(`Erro ao ${actionType === "complete" ? "concluir" : "rejeitar"} saque: ` + error.message);
    } else {
      toast.success(actionType === "complete" ? "Saque concluído com sucesso!" : "Saque rejeitado.");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    }
    setProcessing(false);
  };

  const copyPix = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Chave PIX copiada!");
  };

  return (
    <div className="space-y-6">
      <Card className="neon-border bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent" />
            Saques Pendentes ({pending.length})
          </CardTitle>
          <CardDescription>
            Realize o pagamento manualmente via PIX e então marque o saque como concluído.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pending.map((w) => (
              <div key={w.id} className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-lg text-primary">R$ {Number(w.amount).toFixed(2)}</p>
                    <p className="text-sm font-medium">Modder: {w.profiles?.display_name || w.profiles?.username}</p>
                    <p className="text-xs text-muted-foreground">
                      Solicitado em: {new Date(w.created_at).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  <div className="bg-background/50 p-3 rounded border border-border/50 min-w-[250px]">
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">
                      Chave PIX ({w.pix_key_type})
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-secondary px-2 py-1 rounded flex-1 select-all">
                        {w.pix_key}
                      </code>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyPix(w.pix_key)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="border-accent text-accent hover:bg-accent/10 h-10" 
                      onClick={() => openActionDialog(w, "complete")}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" /> Concluir
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-destructive text-destructive hover:bg-destructive/10 h-10" 
                      onClick={() => openActionDialog(w, "reject")}
                    >
                      <XCircle className="h-4 w-4 mr-2" /> Rejeitar
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {pending.length === 0 && (
              <p className="text-center text-muted-foreground py-6">Nenhum saque pendente no momento.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="neon-border bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="w-5 h-5" />
            Histórico (Últimos saques processados)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {history.slice(0, 20).map((w) => (
              <div key={w.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">R$ {Number(w.amount).toFixed(2)}</p>
                    <Badge variant={w.status === "completed" ? "default" : "destructive"} className="text-[10px]">
                      {w.status === "completed" ? "Concluído" : "Rejeitado"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Modder: {w.profiles?.display_name || w.profiles?.username}</p>
                  <p className="text-xs text-muted-foreground">Processado em: {new Date(w.completed_at || w.created_at).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                  {w.admin_notes && (
                    <p className="text-[11px] text-muted-foreground mt-1 px-2 py-1 bg-background rounded max-w-lg">Nota: {w.admin_notes}</p>
                  )}
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <p className="text-center text-muted-foreground py-6">Nenhum histórico encontrado.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "complete" ? "Confirmar Pagamento de Saque" : "Rejeitar Saque"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "complete" 
                ? "Confirme que você já realizou a transferência PIX para a conta do Modder."
                : "Informe o motivo (opcional) pelo qual este saque está sendo cancelado."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 border-t">
            {selectedWithdrawal && (
              <div className="text-sm bg-secondary/30 p-3 rounded">
                <p><strong>Modder:</strong> {selectedWithdrawal.profiles?.display_name}</p>
                <p><strong>Valor:</strong> R$ {Number(selectedWithdrawal.amount).toFixed(2)}</p>
                <p><strong>Chave PIX:</strong> {selectedWithdrawal.pix_key} ({selectedWithdrawal.pix_key_type})</p>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Nota Interna / Motivo</label>
              <Input 
                value={adminNotes} 
                onChange={(e) => setAdminNotes(e.target.value)} 
                placeholder="Ex: Comprovante #1234, ou motivo da rejeição..." 
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button 
              variant={actionType === "complete" ? "default" : "destructive"} 
              onClick={handleProcess} 
              disabled={processing}
              className={actionType === "complete" ? "neon-glow-green text-foreground" : ""}
            >
              {processing ? "Processando..." : actionType === "complete" ? "Confirmar Pagamento" : "Rejeitar agora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
