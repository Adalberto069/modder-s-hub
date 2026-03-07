import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Terminal, Mail, CheckCircle, Eye, EyeOff } from "lucide-react";

function PasswordInput({
  id, value, onChange, show, onToggle, ...props
}: {
  id: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
        autoComplete={id.includes("login") ? "current-password" : "new-password"}
        {...props}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function Auth() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "login";
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [signupUsername, setSignupUsername] = useState("");
  const [wantModder, setWantModder] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) toast.error(error.message);
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Login realizado!");
      navigate("/");
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        emailRedirectTo: window.location.origin,
        data: { username: signupUsername },
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      if (wantModder && data.user) {
        await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role: "modder" as any,
          approved: false,
        });
      }
      setSentEmail(signupEmail);
      setShowEmailSent(true);
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
      setShowForgot(false);
    }
    setLoading(false);
  };

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <Layout>
        <div className="container flex items-center justify-center py-16">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </Layout>
    );
  }

  if (showEmailSent) {
    return (
      <Layout>
        <div className="container flex items-center justify-center py-16">
          <Card className="w-full max-w-md neon-border bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-8 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                <Mail className="h-8 w-8 text-accent" />
              </div>
              <h2 className="text-xl font-bold font-mono">Conta criada com sucesso!</h2>
              <p className="text-sm text-muted-foreground">Enviamos um email de confirmação para:</p>
              <p className="text-sm font-medium text-primary break-all">{sentEmail}</p>
              <div className="bg-secondary/50 rounded-lg p-4 text-left space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">Abra sua caixa de entrada e clique no link de confirmação</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">Verifique também a pasta de spam/lixo eletrônico</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">Após confirmar, volte aqui e faça login</p>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setShowEmailSent(false)}>
                Voltar ao Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (showForgot) {
    return (
      <Layout>
        <div className="container flex items-center justify-center py-16">
          <Card className="w-full max-w-md neon-border bg-card/80 backdrop-blur-sm">
            <CardHeader className="text-center">
              <Terminal className="h-10 w-10 mx-auto text-primary mb-2" />
              <CardTitle className="font-mono text-lg">Recuperar Senha</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Informe seu email e enviaremos um link para redefinir sua senha.
                </p>
                <div>
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input id="forgot-email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required autoComplete="email" />
                </div>
                <Button type="submit" className="w-full neon-glow-purple" disabled={loading}>
                  {loading ? "Enviando..." : "Enviar Link"}
                </Button>
                <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShowForgot(false)}>
                  Voltar ao login
                </button>
              </form>
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
            <Terminal className="h-10 w-10 mx-auto text-primary mb-2" />
            <CardTitle className="font-mono">
              Mod<span className="text-accent">Hub</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Google Login */}
            <Button
              type="button"
              variant="outline"
              className="w-full mb-4 gap-2"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Entrar com Google
            </Button>

            <div className="relative mb-4">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">ou</span>
            </div>

            <Tabs defaultValue={defaultTab}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Cadastro</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required autoComplete="email" />
                  </div>
                  <div>
                    <Label htmlFor="login-password">Senha</Label>
                    <PasswordInput id="login-password" value={loginPassword} onChange={setLoginPassword} show={showLoginPw} onToggle={() => setShowLoginPw(!showLoginPw)} required />
                  </div>
                  <div className="text-right">
                    <button type="button" className="text-xs text-muted-foreground hover:text-primary transition-colors" onClick={() => setShowForgot(true)}>
                      Esqueci minha senha
                    </button>
                  </div>
                  <Button type="submit" className="w-full neon-glow-purple" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <Label htmlFor="signup-username">Username</Label>
                    <Input id="signup-username" value={signupUsername} onChange={(e) => setSignupUsername(e.target.value)} required autoComplete="username" />
                  </div>
                  <div>
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required autoComplete="email" />
                  </div>
                  <div>
                    <Label htmlFor="signup-password">Senha</Label>
                    <PasswordInput id="signup-password" value={signupPassword} onChange={setSignupPassword} show={showSignupPw} onToggle={() => setShowSignupPw(!showSignupPw)} required minLength={6} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="want-modder" checked={wantModder} onCheckedChange={(v) => setWantModder(!!v)} />
                    <Label htmlFor="want-modder" className="text-sm">Quero ser Modder (requer aprovação)</Label>
                  </div>
                  <Button type="submit" className="w-full neon-glow-purple" disabled={loading}>
                    {loading ? "Criando..." : "Criar Conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}