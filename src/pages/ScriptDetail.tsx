import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Download, Star, ExternalLink, ArrowLeft, User } from "lucide-react";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; className: string }> = {
  working: { label: "Working", className: "bg-neon-green/20 text-neon-green border-neon-green/30" },
  detected: { label: "Detected", className: "bg-destructive/20 text-destructive border-destructive/30" },
  updating: { label: "Updating", className: "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/30" },
};

export default function ScriptDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const { data: script } = useQuery({
    queryKey: ["script", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("scripts")
        .select("*, categories(name, slug)")
        .eq("id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: modderProfile } = useQuery({
    queryKey: ["modder-profile", script?.modder_id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", script!.modder_id).single();
      return data;
    },
    enabled: !!script?.modder_id,
  });

  const handleDownload = async () => {
    if (!script) return;

    // Increment download count
    await supabase.from("scripts").update({ download_count: script.download_count + 1 }).eq("id", script.id);

    if (script.file_url) {
      window.open(script.file_url, "_blank");
    } else if (script.external_link) {
      window.open(script.external_link, "_blank");
    }
    toast.success("Download iniciado!");
  };

  if (!script) {
    return (
      <Layout>
        <div className="container py-16 text-center text-muted-foreground">Carregando...</div>
      </Layout>
    );
  }

  const st = statusConfig[script.status] ?? statusConfig.working;

  return (
    <Layout>
      <div className="container py-8 max-w-4xl">
        <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar ao Marketplace
        </Link>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="md:col-span-2 space-y-6">
            <div>
              <div className="flex items-start gap-3 mb-2">
                <h1 className="text-2xl font-bold flex-1">{script.title}</h1>
                <Badge variant="outline" className={st.className}>{st.label}</Badge>
              </div>
              {script.categories && (
                <Badge variant="secondary" className="text-xs">{script.categories.name}</Badge>
              )}
            </div>

            {script.thumbnail_url && (
              <div className="rounded-lg overflow-hidden neon-border">
                <img src={script.thumbnail_url} alt={script.title} className="w-full" />
              </div>
            )}

            <div className="prose prose-invert max-w-none">
              <p className="text-muted-foreground whitespace-pre-wrap">{script.description ?? "Sem descrição."}</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="neon-border bg-card/80">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Download className="h-4 w-4" /> Downloads
                  </span>
                  <span className="font-mono font-bold">{script.download_count}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Star className="h-4 w-4" /> Avaliação
                  </span>
                  <span className="font-mono font-bold">{Number(script.average_rating).toFixed(1)}</span>
                </div>

                {script.is_paid ? (
                  <div className="text-center">
                    <p className="text-2xl font-bold font-mono text-neon-pink mb-2">R$ {Number(script.price).toFixed(2)}</p>
                    <Button className="w-full neon-glow-purple">Comprar</Button>
                  </div>
                ) : (
                  <Button className="w-full neon-glow-green" onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" /> Download Grátis
                  </Button>
                )}

                {script.external_link && (
                  <Button variant="outline" className="w-full" onClick={() => window.open(script.external_link!, "_blank")}>
                    <ExternalLink className="mr-2 h-4 w-4" /> Link Externo
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Modder info */}
            <Card className="neon-border bg-card/80">
              <CardContent className="p-4">
                <Link to={`/modder/${script.modder_id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{modderProfile?.display_name ?? modderProfile?.username}</p>
                    <p className="text-xs text-muted-foreground font-mono">{modderProfile?.reputation_score ?? 0} pts</p>
                  </div>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
