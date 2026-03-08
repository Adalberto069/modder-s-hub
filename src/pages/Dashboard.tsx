import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, Download, Star, DollarSign, Plus, Trash2, Code, Package, Lock, Eye, EyeOff, Pencil } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { user, isModder, loading, profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<string>("working");
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scriptType, setScriptType] = useState<string>("script");

  // Password protection for paid scripts
  const [scriptPassword, setScriptPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordPermanent, setPasswordPermanent] = useState(true);
  const [passwordExpiry, setPasswordExpiry] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*");
      return data ?? [];
    },
  });

  const { data: myScripts } = useQuery({
    queryKey: ["my-scripts", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("scripts")
        .select("*, categories(name)")
        .eq("modder_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  if (loading) return <Layout><div className="container py-16 text-center">Carregando...</div></Layout>;
  if (!user) return <Navigate to="/auth" />;
  if (!isModder) {
    return (
      <Layout>
        <div className="container py-16 text-center space-y-4">
          <h1 className="text-2xl font-bold">Acesso Restrito</h1>
          <p className="text-muted-foreground">Você precisa ser um Modder aprovado para acessar o Dashboard.</p>
        </div>
      </Layout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (isPaid && !scriptPassword.trim()) {
      toast.error("Scripts pagos precisam de uma senha de proteção");
      return;
    }

    setSubmitting(true);

    let fileUrl = null;
    if (file) {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("scripts").upload(path, file);
      if (uploadError) {
        toast.error("Erro no upload: " + uploadError.message);
        setSubmitting(false);
        return;
      }
      const { data: publicData } = supabase.storage.from("scripts").getPublicUrl(path);
      fileUrl = publicData.publicUrl;
    }

    const { data: insertedScript, error } = await supabase.from("scripts").insert({
      modder_id: user.id,
      title,
      description,
      category_id: categoryId || null,
      status: status as any,
      is_paid: isPaid,
      price: isPaid ? parseFloat(price) : 0,
      file_url: fileUrl,
      external_link: externalLink || null,
      script_type: scriptType as any,
    }).select("id").single();

    if (error) {
      toast.error("Erro: " + error.message);
      setSubmitting(false);
      return;
    }

    // If paid, create password protection
    if (isPaid && insertedScript) {
      const { error: pwError } = await supabase.from("script_passwords").insert({
        script_id: insertedScript.id,
        password: scriptPassword.trim(),
        is_permanent: passwordPermanent,
        expires_at: !passwordPermanent && passwordExpiry ? new Date(passwordExpiry).toISOString() : null,
      });
      if (pwError) {
        toast.error("Script criado, mas erro na senha: " + pwError.message);
      }
    }

    toast.success(scriptType === "script" ? "Script publicado!" : "APK/Mod publicado!");
    setTitle(""); setDescription(""); setCategoryId(""); setStatus("working");
    setIsPaid(false); setPrice(""); setExternalLink(""); setFile(null);
    setScriptType("script"); setScriptPassword(""); setPasswordPermanent(true);
    setPasswordExpiry(""); setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ["my-scripts"] });
    setSubmitting(false);
  };

  const handleDelete = async (scriptId: string) => {
    const { error } = await supabase.from("scripts").delete().eq("id", scriptId);
    if (error) toast.error(error.message);
    else {
      toast.success("Removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["my-scripts"] });
    }
  };

  const totalDownloads = myScripts?.reduce((sum: number, s: any) => sum + s.download_count, 0) ?? 0;
  const simulatedEarnings = myScripts?.reduce((sum: number, s: any) => sum + (s.is_paid ? s.download_count * Number(s.price) * 0.7 : 0), 0) ?? 0;

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Button onClick={() => navigate("/script/new")} className="neon-glow-purple">
            <Plus className="mr-2 h-4 w-4" /> Novo Conteúdo
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="neon-border bg-card/80">
            <CardContent className="p-4 text-center">
              <Upload className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold font-mono">{myScripts?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Publicações</p>
            </CardContent>
          </Card>
          <Card className="neon-border bg-card/80">
            <CardContent className="p-4 text-center">
              <Download className="h-5 w-5 mx-auto text-accent mb-1" />
              <p className="text-2xl font-bold font-mono">{totalDownloads}</p>
              <p className="text-xs text-muted-foreground">Downloads</p>
            </CardContent>
          </Card>
          <Card className="neon-border bg-card/80">
            <CardContent className="p-4 text-center">
              <Star className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold font-mono">{profile?.reputation_score ?? 0}</p>
              <p className="text-xs text-muted-foreground">Reputação</p>
            </CardContent>
          </Card>
          <Card className="neon-border bg-card/80">
            <CardContent className="p-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto text-destructive mb-1" />
              <p className="text-2xl font-bold font-mono">R$ {simulatedEarnings.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Ganhos (simulado)</p>
            </CardContent>
          </Card>
        </div>

        {/* Upload form */}
        {showForm && (
          <Card className="neon-border bg-card/80 mb-8">
            <CardHeader>
              <CardTitle>Nova Publicação</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type selector */}
                <div>
                  <Label className="mb-2 block">Tipo de conteúdo</Label>
                  <Tabs value={scriptType} onValueChange={setScriptType}>
                    <TabsList className="grid w-full max-w-xs grid-cols-2">
                      <TabsTrigger value="script" className="gap-2">
                        <Code className="h-4 w-4" /> Script
                      </TabsTrigger>
                      <TabsTrigger value="apk" className="gap-2">
                        <Package className="h-4 w-4" /> APK / Mod
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Título</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {categories?.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="working">Working</SelectItem>
                        <SelectItem value="detected">Detected</SelectItem>
                        <SelectItem value="updating">Updating</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-4 pt-6">
                    <Switch checked={isPaid} onCheckedChange={setIsPaid} />
                    <Label>Pago</Label>
                    {isPaid && <Input type="number" placeholder="Preço (R$)" value={price} onChange={(e) => setPrice(e.target.value)} className="w-32" step="0.01" />}
                  </div>
                </div>

                {/* Password protection for paid */}
                {isPaid && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Lock className="h-4 w-4 text-primary" />
                        Proteção por Senha
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Defina uma senha que os compradores receberão após o pagamento para desbloquear o download.
                      </p>
                      <div>
                        <Label>Senha do Script</Label>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={scriptPassword}
                            onChange={(e) => setScriptPassword(e.target.value)}
                            placeholder="Crie uma senha forte"
                            className="pr-10"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Switch checked={passwordPermanent} onCheckedChange={setPasswordPermanent} />
                        <Label className="text-sm">{passwordPermanent ? "Senha permanente (Full)" : "Senha com prazo"}</Label>
                      </div>
                      {!passwordPermanent && (
                        <div>
                          <Label>Expira em</Label>
                          <Input
                            type="datetime-local"
                            value={passwordExpiry}
                            onChange={(e) => setPasswordExpiry(e.target.value)}
                            required={!passwordPermanent}
                          />
                          <p className="text-xs text-muted-foreground mt-1">A senha deixará de funcionar após esta data</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Arquivo (upload)</Label>
                    <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <div>
                    <Label>Link externo (opcional)</Label>
                    <Input value={externalLink} onChange={(e) => setExternalLink(e.target.value)} placeholder="https://..." />
                  </div>
                </div>
                <Button type="submit" disabled={submitting} className="neon-glow-purple">
                  {submitting ? "Publicando..." : `Publicar ${scriptType === "script" ? "Script" : "APK/Mod"}`}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* My Scripts */}
        <h2 className="text-xl font-bold mb-4">Minhas Publicações</h2>
        <div className="space-y-3">
          {myScripts?.map((script: any) => (
            <Card key={script.id} className="neon-border bg-card/80">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {script.script_type === "apk" ? (
                      <Package className="h-4 w-4 text-primary" />
                    ) : (
                      <Code className="h-4 w-4 text-primary" />
                    )}
                    <p className="font-semibold">{script.title}</p>
                    {script.is_paid && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    <span>{script.categories?.name}</span>
                    <span>{script.download_count} downloads</span>
                    <Badge variant="outline" className="text-[10px]">{script.status}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{script.script_type === "apk" ? "APK" : "Script"}</Badge>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(script.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
          {myScripts?.length === 0 && <p className="text-muted-foreground">Nenhuma publicação ainda.</p>}
        </div>
      </div>
    </Layout>
  );
}
