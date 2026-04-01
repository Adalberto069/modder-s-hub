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

  const validatePixKey = (key: string, type: string): string | null => {
    const cleaned = key.trim();
    if (!cleaned) return "Chave PIX não pode estar vazia.";
    
    switch (type) {
      case "cpf": {
        const cpf = cleaned.replace(/\D/g, "");
        if (cpf.length !== 11) return "CPF deve ter 11 dígitos.";
        if (/^(\d)\1{10}$/.test(cpf)) return "CPF inválido.";
        // Validate CPF check digits
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
        let rest = (sum * 10) % 11;
        if (rest === 10) rest = 0;
        if (rest !== parseInt(cpf[9])) return "CPF inválido.";
        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
        rest = (sum * 10) % 11;
        if (rest === 10) rest = 0;
        if (rest !== parseInt(cpf[10])) return "CPF inválido.";
        return null;
      }
      case "cnpj": {
        const cnpj = cleaned.replace(/\D/g, "");
        if (cnpj.length !== 14) return "CNPJ deve ter 14 dígitos.";
        if (/^(\d)\1{13}$/.test(cnpj)) return "CNPJ inválido.";
        return null;
      }
      case "email": {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleaned)) return "E-mail inválido.";
        return null;
      }
      case "telefone": {
        const phone = cleaned.replace(/\D/g, "");
        if (phone.length < 10 || phone.length > 13) return "Telefone deve ter entre 10 e 13 dígitos (com DDD).";
        return null;
      }
      case "aleatoria": {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(cleaned)) return "Chave aleatória deve estar no formato UUID.";
        return null;
      }
      default:
        return "Tipo de chave inválido.";
    }
  };

  const handleSavePix = async () => {
    if (!pixKey || !pixKeyType) {
      toast.error("Preencha a chave PIX e o tipo.");
      return;
    }
    
    const validationError = validatePixKey(pixKey, pixKeyType);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    
    setSavingPix(true);
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ pix_key: pixKey.trim(), pix_key_type: pixKeyType } as any)
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
        <Card className="bg-[#050505] border-white/10 hover:border-primary/40 rounded-none transition-all group">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-primary/5 border border-primary/20 p-3 group-hover:bg-primary/10 transition-colors">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Ganhos Totais (80%)</p>
                <p className="text-2xl font-bold text-white mt-1">R$ {totalEarnings.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[#050505] border-white/10 hover:border-accent/40 rounded-none transition-all group">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-accent/5 border border-accent/20 p-3 group-hover:bg-accent/10 transition-colors">
                <Wallet className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Saldo Disponível</p>
                <p className="text-2xl font-bold text-accent mt-1">R$ {Math.max(0, availableBalance).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#050505] border-white/10 hover:border-muted/40 rounded-none transition-all group">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-muted/5 border border-muted/20 p-3 group-hover:bg-muted/10 transition-colors">
                <Landmark className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Saques Processados</p>
                <p className="text-2xl font-bold text-white mt-1">R$ {totalWithdrawnOrPending.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono">
        {/* Configuração de PIX */}
        <Card className="bg-[#050505] border-white/10 rounded-none">
          <CardHeader className="border-b border-white/5 bg-[#030304]">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-white">Configurar Chave PIX</CardTitle>
            <CardDescription className="text-[10px] uppercase font-mono mt-1">Defina sua chave PIX para receber seus pagamentos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de Chave</Label>
              <Select value={pixKeyType} onValueChange={setPixKeyType}>
                <SelectTrigger className="bg-[#030304] border-white/10 focus-visible:ring-neon-purple rounded-none h-12 text-xs">
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent className="bg-[#050505] border-white/10 rounded-none text-xs">
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Chave PIX</Label>
              <Input 
                value={pixKey} 
                onChange={(e) => setPixKey(e.target.value)} 
                placeholder=">_ insira sua chave PIX" 
                className="bg-[#030304] border-white/10 focus-visible:ring-neon-purple rounded-none h-12 text-neon-green"
              />
            </div>
            <Button onClick={handleSavePix} disabled={savingPix} className="bg-neon-purple hover:bg-neon-purple/90 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] rounded-none font-black uppercase tracking-widest text-[10px] w-full h-12 mt-2">
              {savingPix ? "Processando..." : "Salvar Chave PIX"}
            </Button>
          </CardContent>
        </Card>

        {/* Solicitar Saque */}
        <Card className="bg-[#050505] border-white/10 rounded-none">
          <CardHeader className="border-b border-white/5 bg-[#030304]">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-white">Solicitar Saque</CardTitle>
            <CardDescription className="text-[10px] uppercase font-mono mt-1">Processamento em até 48h úteis via ADMIN OPS.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor do Saque (R$)</Label>
              <Input 
                type="number" 
                step="0.01"
                min="0.01"
                max={availableBalance}
                value={withdrawalAmount} 
                onChange={(e) => setWithdrawalAmount(e.target.value)} 
                placeholder="R$ 0.00" 
                className="bg-[#030304] border-white/10 focus-visible:ring-neon-green rounded-none h-12 text-neon-green font-black"
              />
            </div>
            
            {!profile?.pix_key ? (
              <p className="text-[10px] text-destructive uppercase tracking-widest font-black mt-2">CONFIGURE CHAVE PIX PARA PROSSEGUIR.</p>
            ) : availableBalance <= 0 ? (
               <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-2">SALDO INSUFICIENTE PARA SAQUE.</p>
            ) : (
              <Button onClick={handleRequestWithdrawal} disabled={requesting || availableBalance <= 0} className="w-full bg-neon-green hover:bg-neon-green/90 text-[#050505] shadow-[0_0_15px_rgba(57,255,20,0.3)] rounded-none font-black uppercase tracking-widest text-[10px] h-12 mt-2">
                {requesting ? "Transmitindo Solicitação..." : "Confirmar Solicitação"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Histórico de Saques */}
      <Card className="bg-[#050505] border-white/10 rounded-none font-mono">
        <CardHeader className="border-b border-white/5 bg-[#030304]">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-white">Histórico de Saques</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {withdrawals?.map((w) => (
              <div key={w.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-[#030304] border border-white/5 rounded-none gap-3 hover:bg-[#08080a] transition-colors">
                <div>
                  <p className="font-black text-sm text-white">R$ {Number(w.amount).toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Solicitado: {new Date(w.created_at).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                  {w.completed_at && (
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Concluído: {new Date(w.completed_at).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                  )}
                  {w.admin_notes && (
                    <p className="text-[10px] text-neon-purple mt-2 block px-2 py-1 bg-neon-purple/10 border border-neon-purple/20">Nota ADMIN: {w.admin_notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[9px] uppercase tracking-widest rounded-none border-white/10 bg-[#050505] ${w.status === 'completed' ? 'text-neon-green' : w.status === 'rejected' ? 'text-destructive' : 'text-accent'}`}>
                    {w.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {w.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                    {w.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                    {w.status === 'completed' ? 'Concluído' : w.status === 'pending' ? 'Em Processamento' : 'Recusado'}
                  </Badge>
                </div>
              </div>
            ))}
            {withdrawals?.length === 0 && (
              <div className="flex border-t border-white/5 mt-4 pt-4 justify-center">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Nenhuma solicitação de saque no registro.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
