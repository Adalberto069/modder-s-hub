import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { Check, User } from "lucide-react";
import { DEFAULT_AVATARS } from "@/lib/default-avatars";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function ProfileSettings() {
  const { user, profile, loading } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setUsername(profile.username ?? "");
      setBio(profile.bio ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

  if (loading) return <Layout><div className="container py-16 text-center">Carregando...</div></Layout>;
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
      // Force page reload to refresh auth context profile
      setTimeout(() => window.location.reload(), 500);
    }
    setSaving(false);
  };

  return (
    <Layout>
      <div className="container py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Configurações do Perfil</h1>

        <Card className="neon-border bg-card/80 mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Avatar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <Avatar className="h-20 w-20">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt="Avatar" />
                ) : null}
                <AvatarFallback className="bg-secondary">
                  <User className="h-10 w-10 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{displayName || username}</p>
                <p className="text-xs text-muted-foreground">@{username}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-3">Escolha um avatar padrão:</p>
            <div className="flex gap-3 flex-wrap">
              {DEFAULT_AVATARS.map((url) => (
                <button
                  key={url}
                  onClick={() => setAvatarUrl(url)}
                  className={cn(
                    "relative rounded-full overflow-hidden h-16 w-16 ring-2 ring-offset-2 ring-offset-background transition-all",
                    avatarUrl === url ? "ring-neon-purple scale-110" : "ring-transparent hover:ring-muted-foreground/50"
                  )}
                >
                  <img src={url} alt="Avatar option" className="h-full w-full object-cover" />
                  {avatarUrl === url && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Check className="h-6 w-6 text-neon-green" />
                    </div>
                  )}
                </button>
              ))}
              <button
                onClick={() => setAvatarUrl("")}
                className={cn(
                  "rounded-full h-16 w-16 ring-2 ring-offset-2 ring-offset-background transition-all flex items-center justify-center bg-secondary",
                  !avatarUrl ? "ring-neon-purple scale-110" : "ring-transparent hover:ring-muted-foreground/50"
                )}
              >
                <User className="h-6 w-6 text-muted-foreground" />
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="neon-border bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Username</Label>
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
      </div>
    </Layout>
  );
}
