import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { Check, User, Lock, Eye, EyeOff, Shield, Mail } from "lucide-react";
import { DEFAULT_AVATARS } from "@/lib/default-avatars";
import { cn } from "@/lib/utils";

export default function ProfileSettings() {
  const { user, profile, loading } = useAuth();
  const isOAuthUser = user?.app_metadata?.provider && user.app_metadata.provider !== "email";
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setUsername(profile.username ?? "");
      setBio(profile.bio ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

  if (loading) return <Layout><div className="container py-16 text-center text-muted-foreground">Carregando...</div></Layout>;
  if (!user) return <Navigate to="/auth" />;

  const handleSave = async () => {
    if (!username.trim()) {
      toast.error("Username é obrigatório");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName || null,
        username: username.trim(),
        bio: bio || null,
        avatar_url: avatarUrl || null,
      })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Perfil atualizado!");
      setTimeout(() => window.location.reload(), 500);
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setChangingPassword(true);

    // For email users, verify current password first
    if (!isOAuthUser) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPassword,
      });
      if (signInError) {
        toast.error("Senha atual incorreta");
        setChangingPassword(false);
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error("Erro ao alterar senha: " + error.message);
    } else {
      toast.success(isOAuthUser ? "Senha definida com sucesso!" : "Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
  };

  

  return (
    <Layout>
      <div className="container py-8 max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground">Gerencie seu perfil e conta</p>
        </div>

        {/* Account Info */}
        <Card className="neon-border bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Conta</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-xs text-muted-foreground">Email da conta</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Avatar */}
        <Card className="neon-border bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Avatar</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <Avatar className="h-20 w-20 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="Avatar" /> : null}
                <AvatarFallback className="bg-secondary">
                  <User className="h-10 w-10 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{displayName || username}</p>
                <p className="text-xs text-muted-foreground">@{username}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-3">Escolha um avatar:</p>
            <div className="flex gap-3 flex-wrap">
              {DEFAULT_AVATARS.map((url) => (
                <button
                  key={url}
                  onClick={() => setAvatarUrl(url)}
                  className={cn(
                    "relative rounded-full overflow-hidden h-14 w-14 ring-2 ring-offset-2 ring-offset-background transition-all",
                    avatarUrl === url ? "ring-primary scale-110" : "ring-transparent hover:ring-muted-foreground/50"
                  )}
                >
                  <img src={url} alt="Avatar option" className="h-full w-full object-cover" />
                  {avatarUrl === url && (
                    <div className="absolute inset-0 bg-background/40 flex items-center justify-center">
                      <Check className="h-5 w-5 text-accent" />
                    </div>
                  )}
                </button>
              ))}
              <button
                onClick={() => setAvatarUrl("")}
                className={cn(
                  "rounded-full h-14 w-14 ring-2 ring-offset-2 ring-offset-background transition-all flex items-center justify-center bg-secondary",
                  !avatarUrl ? "ring-primary scale-110" : "ring-transparent hover:ring-muted-foreground/50"
                )}
              >
                <User className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Profile Info */}
        <Card className="neon-border bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Informações do Perfil</CardTitle>
            </div>
            <CardDescription>Dados visíveis publicamente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Username *</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div>
              <Label>Nome de exibição</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Seu nome público" />
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Fale um pouco sobre você..." />
            </div>
            <Button onClick={handleSave} disabled={saving} className="neon-glow-purple w-full">
              {saving ? "Salvando..." : "Salvar Perfil"}
            </Button>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="neon-border bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                {isOAuthUser ? "Definir Senha" : "Alterar Senha"}
              </CardTitle>
            </div>
            <CardDescription>
              {isOAuthUser
                ? "Você entrou com Google. Defina uma senha para também poder entrar com email e senha."
                : "Atualize sua senha de acesso"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isOAuthUser && (
              <PasswordField
                id="current-password"
                label="Senha Atual"
                value={currentPassword}
                onChange={setCurrentPassword}
                show={showCurrentPw}
                onToggle={() => setShowCurrentPw(!showCurrentPw)}
              />
            )}
            <PasswordField
              id="new-password"
              label="Nova Senha"
              value={newPassword}
              onChange={setNewPassword}
              show={showNewPw}
              onToggle={() => setShowNewPw(!showNewPw)}
            />
            <div>
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword || !newPassword || !confirmPassword || (!isOAuthUser && !currentPassword)}
              variant="outline"
              className="w-full"
            >
              {changingPassword ? "Alterando..." : isOAuthUser ? "Definir Senha" : "Alterar Senha"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
