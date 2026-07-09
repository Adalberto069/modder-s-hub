import { useState, useEffect, useRef } from "react";
import { validateFileWithToast } from "@/lib/secure-upload";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import {
  User, Lock, Eye, EyeOff, Shield, Mail, Camera,
  Settings, Bell, Download, Trash2, UserX, CheckCircle, XCircle,
  Send, Palette, Languages, Upload,
} from "lucide-react";
import { DEFAULT_AVATARS } from "@/lib/default-avatars";
import { cn } from "@/lib/utils";

function PasswordField({
  id, label, value, onChange, show, onToggle, placeholder,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
          placeholder={placeholder}
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
    </div>
  );
}

export default function ProfileSettings() {
  const { user, profile, loading, isModder } = useAuth();
  const isOAuthUser = user?.app_metadata?.provider && user.app_metadata.provider !== "email";
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Account
  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [sendingResetEmail, setSendingResetEmail] = useState(false);

  // Preferences (local state for now)
  
  const [language, setLanguage] = useState("pt-BR");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyUpdates, setNotifyUpdates] = useState(true);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

  const isEmailVerified = !!user.email_confirmed_at;

  const handleSave = async () => {
    if (!username.trim()) {
      toast.error("Username é obrigatório");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({
        user_id: user.id,
        email: user.email ?? null,
        display_name: displayName || null,
        username: username.trim(),
        bio: bio || null,
        avatar_url: avatarUrl || null,
      }, { onConflict: "user_id" });

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Perfil atualizado!");
      setTimeout(() => window.location.reload(), 500);
    }
    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const safeName = await validateFileWithToast({ file, type: "image", maxSizeMB: 2 });
    if (!safeName) return;

    setUploadingAvatar(true);
    const filePath = `avatars/${user.id}/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("scripts")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro ao enviar imagem: " + uploadError.message);
      setUploadingAvatar(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("scripts")
      .getPublicUrl(filePath);

    setAvatarUrl(publicUrl);
    toast.success("Avatar enviado!");
    setUploadingAvatar(false);
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

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) {
      toast.error("Digite o novo email");
      return;
    }
    setChangingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) {
      toast.error("Erro ao alterar email: " + error.message);
    } else {
      toast.success("Email de confirmação enviado para o novo endereço!");
      setNewEmail("");
    }
    setChangingEmail(false);
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email!,
    });
    if (error) {
      toast.error("Erro ao reenviar: " + error.message);
    } else {
      toast.success("Email de verificação reenviado!");
    }
    setResendingVerification(false);
  };

  const handleDeleteAccount = async () => {
    toast.error("Para excluir sua conta, entre em contato com o suporte.");
  };

  const handleDeactivateAccount = async () => {
    toast.info("Funcionalidade em breve. Entre em contato com o suporte.");
  };

  const handleDownloadData = () => {
    const data = {
      profile: { username, displayName, bio, avatarUrl },
      email: user.email,
      created_at: user.created_at,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meus-dados-${username}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Dados exportados!");
  };

  return (
    <Layout>
      <div className="container py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Configurações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seu perfil, conta e preferências</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="w-full grid grid-cols-5 bg-secondary/50 p-1">
            <TabsTrigger value="profile" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-primary/20">
              <User className="h-3.5 w-3.5 hidden sm:block" /> Perfil
            </TabsTrigger>
            <TabsTrigger value="account" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-primary/20">
              <Mail className="h-3.5 w-3.5 hidden sm:block" /> Conta
            </TabsTrigger>
            <TabsTrigger value="security" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-primary/20">
              <Lock className="h-3.5 w-3.5 hidden sm:block" /> Segurança
            </TabsTrigger>
            <TabsTrigger value="preferences" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-primary/20">
              <Palette className="h-3.5 w-3.5 hidden sm:block" /> Preferências
            </TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-primary/20">
              <Shield className="h-3.5 w-3.5 hidden sm:block" /> Privacidade
            </TabsTrigger>
          </TabsList>

          {/* ======================== PROFILE TAB ======================== */}
          <TabsContent value="profile" className="space-y-6">
            {/* Avatar Section */}
            <Card className="neon-border bg-card/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="h-4 w-4 text-primary" /> Foto de Perfil
                </CardTitle>
                <CardDescription>Escolha um avatar padrão ou envie sua própria imagem</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-5">
                  <div className="relative group">
                    <Avatar className="h-24 w-24 ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
                      {avatarUrl ? <AvatarImage src={avatarUrl} alt="Avatar" /> : null}
                      <AvatarFallback className="bg-secondary text-2xl">
                        <User className="h-10 w-10 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 rounded-full bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <Upload className="h-5 w-5 text-foreground" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{displayName || username || "Seu perfil"}</p>
                    <p className="text-xs text-muted-foreground">@{username || "username"}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs mt-1"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      {uploadingAvatar ? "Enviando..." : "Enviar foto"}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm text-muted-foreground mb-3">Ou escolha um avatar padrão:</p>
                  <div className="flex gap-3 flex-wrap">
                    {DEFAULT_AVATARS.map((url) => (
                      <button
                        key={url}
                        onClick={() => setAvatarUrl(url)}
                        className={cn(
                          "relative rounded-full overflow-hidden h-12 w-12 ring-2 ring-offset-2 ring-offset-background transition-all",
                          avatarUrl === url ? "ring-primary scale-110" : "ring-transparent hover:ring-muted-foreground/50"
                        )}
                      >
                        <img src={url} alt="Avatar" className="h-full w-full object-cover" />
                        {avatarUrl === url && (
                          <div className="absolute inset-0 bg-background/40 flex items-center justify-center">
                            <CheckCircle className="h-4 w-4 text-accent" />
                          </div>
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => setAvatarUrl("")}
                      className={cn(
                        "rounded-full h-12 w-12 ring-2 ring-offset-2 ring-offset-background transition-all flex items-center justify-center bg-secondary",
                        !avatarUrl ? "ring-primary scale-110" : "ring-transparent hover:ring-muted-foreground/50"
                      )}
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Profile Info */}
            <Card className="neon-border bg-card/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Informações do Perfil
                </CardTitle>
                <CardDescription>Dados visíveis publicamente no seu perfil</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username *</Label>
                    <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="seu_username" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="display-name">Nome de exibição</Label>
                    <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Seu nome público" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio / Descrição</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder="Conte um pouco sobre você..."
                    maxLength={500}
                  />
                  <p className="text-[11px] text-muted-foreground text-right">{bio.length}/500</p>
                </div>


                <Button onClick={handleSave} disabled={saving} className="neon-glow-purple w-full">
                  {saving ? "Salvando..." : "Salvar Perfil"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ======================== ACCOUNT TAB ======================== */}
          <TabsContent value="account" className="space-y-6">
            {/* Email Info */}
            <Card className="neon-border bg-card/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" /> Endereço de Email
                </CardTitle>
                <CardDescription>Email associado à sua conta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.email}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {isEmailVerified ? (
                        <Badge variant="outline" className="text-[10px] gap-1 border-accent/30 text-accent">
                          <CheckCircle className="h-3 w-3" /> Verificado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1 border-destructive/30 text-destructive">
                          <XCircle className="h-3 w-3" /> Não verificado
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {!isEmailVerified && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResendVerification}
                    disabled={resendingVerification}
                    className="w-full"
                  >
                    <Send className="h-3.5 w-3.5 mr-2" />
                    {resendingVerification ? "Enviando..." : "Reenviar email de verificação"}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Change Email */}
            <Card className="neon-border bg-card/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" /> Alterar Email
                </CardTitle>
                <CardDescription>Um email de confirmação será enviado para o novo endereço</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-email">Novo Email</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="novo@email.com"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleChangeEmail}
                  disabled={changingEmail || !newEmail.trim()}
                  className="w-full"
                >
                  {changingEmail ? "Enviando..." : "Alterar Email"}
                </Button>
              </CardContent>
            </Card>

          </TabsContent>

          {/* ======================== SECURITY TAB ======================== */}
          <TabsContent value="security" className="space-y-6">
            <Card className="neon-border bg-card/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  {isOAuthUser ? "Definir Senha" : "Alterar Senha"}
                </CardTitle>
                <CardDescription>
                  {isOAuthUser
                    ? "Você entrou com Google. Defina uma senha para também acessar via email."
                    : "Atualize sua senha de acesso à plataforma"}
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
                    placeholder="Digite sua senha atual"
                  />
                )}
                <PasswordField
                  id="new-password"
                  label="Nova Senha"
                  value={newPassword}
                  onChange={setNewPassword}
                  show={showNewPw}
                  onToggle={() => setShowNewPw(!showNewPw)}
                  placeholder="Mínimo 6 caracteres"
                />
                <PasswordField
                  id="confirm-password"
                  label="Confirmar Nova Senha"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  show={showConfirmPw}
                  onToggle={() => setShowConfirmPw(!showConfirmPw)}
                  placeholder="Repita a nova senha"
                />
                <Button
                  onClick={handleChangePassword}
                  disabled={changingPassword || !newPassword || !confirmPassword || (!isOAuthUser && !currentPassword)}
                  className="w-full neon-glow-purple"
                >
                  {changingPassword ? "Alterando..." : isOAuthUser ? "Definir Senha" : "Alterar Senha"}
                </Button>
              </CardContent>
            </Card>

            {/* Reset via Email */}
            <Card className="neon-border bg-card/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" /> Redefinir Senha por Email
                </CardTitle>
                <CardDescription>
                  Receba um link no seu email para redefinir sua senha de forma segura
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={sendingResetEmail}
                  onClick={async () => {
                    if (!user.email) {
                      toast.error("Nenhum email vinculado à conta");
                      return;
                    }
                    setSendingResetEmail(true);
                    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (error) {
                      toast.error("Erro ao enviar email: " + error.message);
                    } else {
                      toast.success("Email de redefinição enviado! Verifique sua caixa de entrada.");
                    }
                    setSendingResetEmail(false);
                  }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendingResetEmail ? "Enviando..." : "Enviar Link de Redefinição"}
                </Button>
              </CardContent>
            </Card>

            {/* Login Info */}
            <Card className="neon-border bg-card/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Informações de Login
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">Provedor de autenticação</span>
                  <Badge variant="secondary" className="text-xs capitalize">
                    {user.app_metadata?.provider || "email"}
                  </Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">Conta criada em</span>
                  <span className="text-sm">
                    {new Date(user.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">Último login</span>
                  <span className="text-sm">
                    {user.last_sign_in_at
                      ? new Date(user.last_sign_in_at).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ======================== PREFERENCES TAB ======================== */}
          <TabsContent value="preferences" className="space-y-6">


            <Card className="neon-border bg-card/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Languages className="h-4 w-4 text-primary" /> Idioma
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Idioma da interface</p>
                    <p className="text-xs text-muted-foreground">Selecione o idioma de exibição</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">Português (BR)</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="neon-border bg-card/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" /> Notificações
                </CardTitle>
                <CardDescription>Gerencie suas preferências de notificação</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Notificações por email</p>
                    <p className="text-xs text-muted-foreground">Receba atualizações importantes por email</p>
                  </div>
                  <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Novos scripts e atualizações</p>
                    <p className="text-xs text-muted-foreground">Seja notificado sobre novos conteúdos</p>
                  </div>
                  <Switch checked={notifyUpdates} onCheckedChange={setNotifyUpdates} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ======================== PRIVACY TAB ======================== */}
          <TabsContent value="privacy" className="space-y-6">
            <Card className="neon-border bg-card/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" /> Exportar Dados
                </CardTitle>
                <CardDescription>Baixe uma cópia dos seus dados pessoais</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={handleDownloadData} className="w-full">
                  <Download className="h-4 w-4 mr-2" /> Baixar meus dados
                </Button>
              </CardContent>
            </Card>

            <Card className="neon-border bg-card/80 border-destructive/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <UserX className="h-4 w-4" /> Desativar Conta
                </CardTitle>
                <CardDescription>Desative temporariamente sua conta. Você pode reativá-la depois.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full border-destructive/30 text-destructive hover:bg-destructive/10" onClick={handleDeactivateAccount}>
                  <UserX className="h-4 w-4 mr-2" /> Desativar minha conta
                </Button>
              </CardContent>
            </Card>

            <Card className="neon-border bg-card/80 border-destructive/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <Trash2 className="h-4 w-4" /> Excluir Conta
                </CardTitle>
                <CardDescription>Esta ação é permanente e não pode ser desfeita. Todos os seus dados serão removidos.</CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir minha conta permanentemente
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso irá excluir permanentemente sua conta
                        e remover todos os dados associados dos nossos servidores.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Sim, excluir minha conta
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
