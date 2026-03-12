import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wallet, Landmark, DollarSign, Clock, CheckCircle2, XCircle } from "lucide-react";

interface ModderFinanceTabProps {
  totalEarnings: number;
}

export function ModderFinanceTab({ totalEarnings }: ModderFinanceTabProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // PIX State
  const [pixKey, setPixKey] = useState(profile?.pix_key || "");
  const [pixKeyType, setPixKeyType] = useState(profile?.pix_key_type || "");
  const [savingPix, setSavingPix] = useState(false);

  // Withdrawal State
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>("");
  const [requesting, setRequesting] = useState(false);

  // Fetch withdrawals
  const { data: withdrawals } = useQuery({
    queryKey: ["my-withdrawals", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("withdrawals")
        .select("*")
        .eq("modder_id", user?.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  // Calculate available balance
  const totalWithdrawnOrPending = withdrawals?.reduce((sum, w) => {
    if (w.status === "pending" || w.status === "completed") {
      return sum + Number(w.amount);
    }
    return sum;
  }, 0) ?? 0;

  const availableBalance = totalEarnings - totalWithdrawnOrPending;

  const handleSavePix = async () => {
    if (!pixKey || !pixKeyType) {
      toast.error("Preencha a chave PIX e o tipo.");
      return;
    }
    setSavingPix(true);
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ pix_key: pixKey, pix_key_type: pixKeyType } as any)
      .eq("user_id", user?.id);

    if (error) {
      toast.error("Erro ao salvar chave PIX: " + error.message);
    } else {
      toast.success("Chave PIX atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
    setSavingPix(false);
  };

  const handleRequestWithdrawal = async () => {
    if (!profile?.pix_key || !profile?.pix_key_type) {
      toast.error("Configure sua chave PIX primeiro.");
      return;
    }

    const amount = Number(withdrawalAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Valor inválido.");
      return;
    }

    if (amount > availableBalance) {
      toast.error("Saldo insuficiente.");
      return;
    }

    setRequesting(true);
    const { error } = await (supabase as any)
      .from("withdrawals")
      .insert({
        modder_id: user?.id,
        amount,
        pix_key: profile.pix_key,
        pix_key_type: profile.pix_key_type,
        status: "pending",
      });

    if (error) {
      toast.error("Erro ao solicitar saque: " + error.message);
    } else {
      toast.success("Saque solicitado com sucesso!");
      setWithdrawalAmount("");
      queryClient.invalidateQueries({ queryKey: ["my-withdrawals"] });
    }
    setRequesting(false);
  };

  return (
    <div className="space-y-6">
      {/* Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="neon-border bg-card/80">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-primary/20 p-3 rounded-full">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ganhos Totais (80%)</p>
                <p className="text-2xl font-bold">R$ {totalEarnings.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="neon-border bg-card/80">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-accent/20 p-3 rounded-full">
                <Wallet className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo Disponível</p>
                <p className="text-2xl font-bold">R$ {Math.max(0, availableBalance).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="neon-border bg-card/80">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-muted p-3 rounded-full">
                <Landmark className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saques Pendentes/Aprovados</p>
                <p className="text-2xl font-bold">R$ {totalWithdrawnOrPending.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuração de PIX */}
        <Card className="neon-border bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">Configurar Chave PIX</CardTitle>
            <CardDescription>Defina sua chave PIX para receber seus pagamentos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Chave</Label>
              <Select value={pixKeyType} onValueChange={setPixKeyType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                  <SelectItem value="random">Chave Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <Input 
                value={pixKey} 
                onChange={(e) => setPixKey(e.target.value)} 
                placeholder="Sua chave PIX" 
              />
            </div>
            <Button onClick={handleSavePix} disabled={savingPix} className="neon-glow-purple w-full">
              {savingPix ? "Salvando..." : "Salvar Chave PIX"}
            </Button>
          </CardContent>
        </Card>

        {/* Solicitar Saque */}
        <Card className="neon-border bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">Solicitar Saque</CardTitle>
            <CardDescription>Os saques podem levar até 48 horas úteis para serem processados pela administração.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Valor do Saque (R$)</Label>
              <Input 
                type="number" 
                step="0.01"
                min="0.01"
                max={availableBalance}
                value={withdrawalAmount} 
                onChange={(e) => setWithdrawalAmount(e.target.value)} 
                placeholder="0.00" 
              />
            </div>
            
            {!profile?.pix_key ? (
              <p className="text-sm text-destructive">Configure sua chave PIX primeiro para solicitar um saque.</p>
            ) : availableBalance <= 0 ? (
               <p className="text-sm text-muted-foreground">Você não possui saldo disponível para saque.</p>
            ) : (
              <Button onClick={handleRequestWithdrawal} disabled={requesting || availableBalance <= 0} className="w-full neon-glow-green">
                {requesting ? "Solicitando..." : "Confirmar Solicitação"}
              </Button>
            )}
            
          </CardContent>
        </Card>
      </div>

      {/* Histórico de Saques */}
      <Card className="neon-border bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Saques</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {withdrawals?.map((w) => (
              <div key={w.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50 gap-3">
                <div>
                  <p className="font-semibold text-sm">R$ {Number(w.amount).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Solicitado em: {new Date(w.created_at).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                  {w.completed_at && (
                    <p className="text-xs text-muted-foreground">Concluído em: {new Date(w.completed_at).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                  )}
                  {w.admin_notes && (
                    <p className="text-[11px] text-muted-foreground mt-1 block px-2 py-1 bg-background rounded">Nota do admin: {w.admin_notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={w.status === 'completed' ? 'default' : w.status === 'rejected' ? 'destructive' : 'outline'} className="text-[10px]">
                    {w.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {w.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                    {w.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                    {w.status === 'completed' ? 'Concluído' : w.status === 'pending' ? 'Pendente' : 'Recusado'}
                  </Badge>
                </div>
              </div>
            ))}
            {withdrawals?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum saque solicitado ainda.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
