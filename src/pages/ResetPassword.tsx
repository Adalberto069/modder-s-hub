import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Terminal, Lock } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });
    
    // Also check hash for type=recovery
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem!");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Senha atualizada com sucesso!");
      navigate("/");
    }
    setLoading(false);
  };

  if (!isRecovery) {
    return (
      <Layout>
        <div className="container flex items-center justify-center py-16">
          <Card className="w-full max-w-md neon-border bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6 text-center">
              <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Verificando link de recuperação...</p>
              <p className="text-xs text-muted-foreground mt-2">
                Se você chegou aqui por engano,{" "}
                <button className="text-neon-purple hover:underline" onClick={() => navigate("/auth")}>
                  volte ao login
                </button>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container flex items-center justify-center py-16">
        <Card className="w-full max-w-md neon-border bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <Terminal className="h-10 w-10 mx-auto text-neon-purple mb-2" />
            <CardTitle className="font-mono">Nova Senha</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <Label htmlFor="new-password">Nova Senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirmar Senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full neon-glow-purple" disabled={loading}>
                {loading ? "Atualizando..." : "Atualizar Senha"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
