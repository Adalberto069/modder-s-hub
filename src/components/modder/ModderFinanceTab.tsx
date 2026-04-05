import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wallet, DollarSign, CheckCircle2, LinkIcon, Loader2, Info } from "lucide-react";

interface ModderFinanceTabProps {
  totalEarnings: number;
}

const getMercadoPagoRedirectBase = () =>
  window.location.hostname.includes("id-preview--")
    ? "https://mod-alchemist-den.lovable.app"
    : window.location.origin;

export function ModderFinanceTab({ totalEarnings }: ModderFinanceTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  // Fetch MP account connection status
  const { data: mpAccount, isLoading: mpLoading } = useQuery({
    queryKey: ["mp-account", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("modder_mp_accounts")
        .select("mp_user_id, connected_at, updated_at")
        .eq("user_id", user?.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Handle OAuth callback (check URL for MP code)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error_description") || params.get("error");

    if (oauthError) {
      const decodedError = decodeURIComponent(oauthError.replace(/\+/g, " "));
      toast.error(
        decodedError.includes("não está pronto")
          ? "O app do Mercado Pago da conta PJ ainda não está liberado ou o redirect configurado não bate com o domínio publicado."
          : decodedError
      );
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (code && state === user?.id) {
      handleOAuthCallback(code);
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [user?.id]);

  const handleConnectMP = async () => {
    setConnecting(true);
    try {
      const redirectUri = `${getMercadoPagoRedirectBase()}/dashboard?tab=finance`;
      const { data, error } = await supabase.functions.invoke("mp-oauth-start", {
        body: { redirect_uri: redirectUri },
      });

      if (error || !data?.oauth_url) {
        toast.error("Erro ao iniciar conexão com Mercado Pago.");
        setConnecting(false);
        return;
      }

      // Redirect to MP OAuth
      window.location.href = data.oauth_url;
    } catch {
      toast.error("Erro inesperado.");
      setConnecting(false);
    }
  };

  const handleOAuthCallback = async (code: string) => {
    setConnecting(true);
    try {
      const redirectUri = `${getMercadoPagoRedirectBase()}/dashboard?tab=finance`;
      const { data, error } = await supabase.functions.invoke("mp-oauth-callback", {
        body: { code, redirect_uri: redirectUri },
      });

      if (error || !data?.success) {
        toast.error("Erro ao conectar Mercado Pago: " + (data?.error || error?.message || "Tente novamente."));
      } else {
        toast.success("Mercado Pago conectado com sucesso! Seus pagamentos serão recebidos automaticamente.");
        queryClient.invalidateQueries({ queryKey: ["mp-account"] });
      }
    } catch {
      toast.error("Erro ao finalizar conexão.");
    }
    setConnecting(false);
  };

  return (
    <div className="space-y-6">
      {/* Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
        <Card className="bg-[#050505] border-white/10 hover:border-primary/40 rounded-none transition-all group">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-primary/5 border border-primary/20 p-3 group-hover:bg-primary/10 transition-colors">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Ganhos Totais (80%)</p>
                <p className="text-2xl font-bold text-foreground mt-1">R$ {totalEarnings.toFixed(2)}</p>
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
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Recebimento</p>
                <p className="text-sm font-bold text-accent mt-1">
                  {mpAccount ? "Split automático via Mercado Pago" : "Não configurado"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conexão Mercado Pago */}
      <Card className="bg-[#050505] border-white/10 rounded-none font-mono">
        <CardHeader className="border-b border-white/5 bg-[#030304]">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">Conta Mercado Pago</CardTitle>
          <CardDescription className="text-[10px] uppercase font-mono mt-1">
            Conecte sua conta para receber pagamentos automaticamente via split (80% direto na sua conta).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {mpLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Carregando...</span>
            </div>
          ) : mpAccount ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-[#030304] border border-white/5">
                <CheckCircle2 className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-xs font-bold text-accent uppercase tracking-widest">Conta Conectada</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    ID: {mpAccount.mp_user_id} • Conectado em {new Date(mpAccount.connected_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Seus pagamentos são recebidos automaticamente. 80% vai direto para sua conta Mercado Pago, 20% fica como comissão da plataforma.
              </p>
              <Button
                onClick={handleConnectMP}
                disabled={connecting}
                variant="outline"
                className="rounded-none border-white/10 text-[10px] uppercase tracking-widest font-black h-10"
              >
                {connecting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <LinkIcon className="h-3 w-3 mr-2" />}
                Reconectar Conta
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-[#030304] border border-primary/20">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
                  Para receber pagamentos dos seus scripts, conecte sua conta Mercado Pago.
                  O dinheiro das vendas vai direto para você — sem necessidade de solicitar saques.
                </p>
              </div>
              <Button
                onClick={handleConnectMP}
                disabled={connecting}
                className="bg-[#009ee3] hover:bg-[#007eb5] text-white rounded-none font-black uppercase tracking-widest text-[10px] w-full h-12"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.28 1.5c-4.94 0-8.97 3.97-8.97 8.85 0 5.85 5.1 10.38 9.76 12.41.12.05.25.08.38.08.13 0 .25-.03.37-.08 4.67-2.03 9.76-6.56 9.76-12.41C22.58 5.47 18.55 1.5 13.61 1.5h-2.33z"/>
                  </svg>
                )}
                {connecting ? "Conectando..." : "Conectar Minha Conta Mercado Pago"}
              </Button>
              <p className="text-[9px] text-muted-foreground text-center uppercase tracking-widest">
                Você será redirecionado para o app publicado para autorizar a conexão com segurança.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sistema de Pagamento Info */}
      <Card className="bg-[#050505] border-accent/20 rounded-none font-mono">
        <CardHeader className="border-b border-accent/10 bg-accent/5">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-accent" />
            <CardTitle className="text-sm font-black uppercase tracking-widest text-accent">Sistema de Pagamento</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-3">
          {[
            { icon: "💰", text: "Utilizamos o Mercado Pago por ter as menores taxas do mercado" },
            { icon: "💳", text: "Aceitamos Pix e Cartão de crédito" },
            { icon: "⚡", text: "O dinheiro cai direto na sua conta, podendo movimentar imediatamente" },
            { icon: "🏦", text: "No pagamento via Pix, aparecerá o nome cadastrado no seu banco para o comprador" },
            { icon: "🔜", text: "Em breve novas formas de pagamento" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-[#030304] border border-white/5">
              <span className="text-sm shrink-0">{item.icon}</span>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">{item.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Info sobre como funciona */}
      <Card className="bg-[#050505] border-white/10 rounded-none font-mono">
        <CardHeader className="border-b border-white/5 bg-[#030304]">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">Como Funciona</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-3">
          {[
            { step: "01", text: "Comprador paga via PIX ou Cartão de Crédito" },
            { step: "02", text: "Mercado Pago divide automaticamente: 80% para você, 20% comissão" },
            { step: "03", text: "Seu dinheiro cai direto na sua conta Mercado Pago" },
            { step: "04", text: "Licença é gerada automaticamente para o comprador" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3 p-3 bg-[#030304] border border-white/5">
              <Badge variant="outline" className="rounded-none border-primary/30 text-primary text-[9px] font-black px-2 py-0.5">
                {item.step}
              </Badge>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{item.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
