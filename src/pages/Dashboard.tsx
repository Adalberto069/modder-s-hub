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
import { toast } from "sonner";
import { Upload, Download, Star, DollarSign, Plus, Trash2 } from "lucide-react";
import { Navigate } from "react-router-dom";

export default function Dashboard() {
  const { user, isModder, loading, profile } = useAuth();
  const queryClient = useQueryClient();
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
    setSubmitting(true);

    let fileUrl = null;
    if (file) {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from("scripts").upload(path, file);
      if (uploadError) {
        toast.error("Erro no upload: " + uploadError.message);
        setSubmitting(false);
        return;
      }
      const { data: publicData } = supabase.storage.from("scripts").getPublicUrl(path);
      fileUrl = publicData.publicUrl;
    }

    const { error } = await supabase.from("scripts").insert({
      modder_id: user.id,
      title,
      description,
      category_id: categoryId || null,
      status: status as any,
      is_paid: isPaid,
      price: isPaid ? parseFloat(price) : 0,
      file_url: fileUrl,
      external_link: externalLink || null,
    });

    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Script publicado!");
      setTitle(""); setDescription(""); setCategoryId(""); setStatus("working");
      setIsPaid(false); setPrice(""); setExternalLink(""); setFile(null);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["my-scripts"] });
    }
    setSubmitting(false);
  };

  const handleDelete = async (scriptId: string) => {
    const { error } = await supabase.from("scripts").delete().eq("id", scriptId);
    if (error) toast.error(error.message);
    else {
      toast.success("Script removido!");
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
          <Button onClick={() => setShowForm(!showForm)} className="neon-glow-purple">
            <Plus className="mr-2 h-4 w-4" /> Novo Script
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="neon-border bg-card/80">
            <CardContent className="p-4 text-center">
              <Upload className="h-5 w-5 mx-auto text-neon-purple mb-1" />
              <p className="text-2xl font-bold font-mono">{myScripts?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Scripts</p>
            </CardContent>
          </Card>
          <Card className="neon-border bg-card/80">
            <CardContent className="p-4 text-center">
              <Download className="h-5 w-5 mx-auto text-neon-green mb-1" />
              <p className="text-2xl font-bold font-mono">{totalDownloads}</p>
              <p className="text-xs text-muted-foreground">Downloads</p>
            </CardContent>
          </Card>
          <Card className="neon-border bg-card/80">
            <CardContent className="p-4 text-center">
              <Star className="h-5 w-5 mx-auto text-neon-cyan mb-1" />
              <p className="text-2xl font-bold font-mono">{profile?.reputation_score ?? 0}</p>
              <p className="text-xs text-muted-foreground">Reputação</p>
            </CardContent>
          </Card>
          <Card className="neon-border bg-card/80">
            <CardContent className="p-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto text-neon-pink mb-1" />
              <p className="text-2xl font-bold font-mono">R$ {simulatedEarnings.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Ganhos (simulado)</p>
            </CardContent>
          </Card>
        </div>

        {/* Upload form */}
        {showForm && (
          <Card className="neon-border bg-card/80 mb-8">
            <CardHeader><CardTitle>Novo Script</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  {submitting ? "Publicando..." : "Publicar Script"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* My Scripts */}
        <h2 className="text-xl font-bold mb-4">Meus Scripts</h2>
        <div className="space-y-3">
          {myScripts?.map((script: any) => (
            <Card key={script.id} className="neon-border bg-card/80">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{script.title}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    <span>{script.categories?.name}</span>
                    <span>{script.download_count} downloads</span>
                    <Badge variant="outline" className="text-[10px]">{script.status}</Badge>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(script.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
          {myScripts?.length === 0 && <p className="text-muted-foreground">Nenhum script publicado ainda.</p>}
        </div>
      </div>
    </Layout>
  );
}
