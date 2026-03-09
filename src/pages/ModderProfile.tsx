import { useParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ScriptCard } from "@/components/ScriptCard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { User, Download, Star, Trophy, Calendar, Code, BookOpen, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserBadges } from "@/components/UserBadges";
import { RoleBadge } from "@/components/RoleBadge";

export default function ModderProfile() {
  const { userId } = useParams<{ userId: string }>();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["modder-profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", userId!).single();
      return data;
    },
    enabled: !!userId,
  });

  const { data: scripts, isLoading: scriptsLoading } = useQuery({
    queryKey: ["modder-scripts", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("scripts")
        .select("*, categories(slug)")
        .eq("modder_id", userId!)
        .eq("publish_status", "published")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: tutorials } = useQuery({
    queryKey: ["modder-tutorials", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tutorials")
        .select("*")
        .eq("author_id", userId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: userRoles } = useQuery({
    queryKey: ["user-roles-public", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role, approved")
        .eq("user_id", userId!);
      return data?.filter((r: any) => r.approved).map((r: any) => r.role) ?? [];
    },
    enabled: !!userId,
  });

  const displayRole: "admin" | "modder" | "member" = 
    userRoles?.includes("admin") ? "admin" : 
    userRoles?.includes("modder") ? "modder" : "member";

  const totalDownloads = scripts?.reduce((sum, s: any) => sum + (s.download_count || 0), 0) ?? 0;
  const avgRating = scripts && scripts.length > 0
    ? scripts.reduce((sum, s: any) => sum + Number(s.average_rating || 0), 0) / scripts.length
    : 0;
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : "";

  if (profileLoading) {
    return (
      <Layout>
        <div className="container py-8 max-w-5xl space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-6 p-8 rounded-xl bg-card/60 border border-border">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="container py-16 text-center text-muted-foreground">
          Perfil não encontrado.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8 max-w-5xl space-y-6">
        {/* Hero Header */}
        <div className="relative rounded-xl overflow-hidden border border-border bg-card/60">
          {/* Gradient backdrop */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />

          <div className="relative p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Avatar */}
              <div className="h-24 w-24 rounded-full bg-secondary border-2 border-primary/30 flex items-center justify-center shrink-0 shadow-lg shadow-primary/10">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.username} className="h-full w-full rounded-full object-cover" />
                ) : (
                  <User className="h-12 w-12 text-muted-foreground" />
                )}
              </div>

              {/* Info */}
              <div className="text-center sm:text-left flex-1 space-y-1">
                <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                  <h1 className="text-3xl font-bold tracking-tight">
                    {profile.display_name ?? profile.username}
                  </h1>
                  <RoleBadge role={displayRole} />
                </div>
                <p className="text-sm text-muted-foreground font-mono">@{profile.username}</p>
                <UserBadges userId={userId!} />
                {profile.bio && (
                  <p className="text-sm text-muted-foreground mt-2 max-w-lg">{profile.bio}</p>
                )}
                <div className="flex items-center gap-2 justify-center sm:justify-start mt-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Membro desde {memberSince}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <Separator />
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
            <StatItem icon={<Code className="h-4 w-4" />} value={scripts?.length ?? 0} label="Scripts" color="text-primary" />
            <StatItem icon={<Download className="h-4 w-4" />} value={totalDownloads} label="Downloads" color="text-accent" />
            <StatItem icon={<Star className="h-4 w-4" />} value={avgRating.toFixed(1)} label="Média" color="text-[hsl(var(--neon-cyan))]" />
            <StatItem icon={<Trophy className="h-4 w-4" />} value={profile.reputation_score} label="Reputação" color="text-[hsl(var(--neon-pink))]" />
          </div>
        </div>


        {/* Tabs */}
        {/* Tabs */}
        <Tabs defaultValue="scripts" className="space-y-4">
          <TabsList className="w-full grid grid-cols-3 bg-secondary/50">
            <TabsTrigger value="scripts" className="gap-2">
              <Code className="h-4 w-4" /> Scripts
            </TabsTrigger>
            <TabsTrigger value="tutorials" className="gap-2">
              <BookOpen className="h-4 w-4" /> Tutoriais
            </TabsTrigger>
            <TabsTrigger value="about" className="gap-2">
              <Info className="h-4 w-4" /> Sobre
            </TabsTrigger>
          </TabsList>

          {/* Scripts Tab */}
          <TabsContent value="scripts">
            {scriptsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-48 rounded-lg" />
                ))}
              </div>
            ) : scripts && scripts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {scripts.map((script: any) => (
                  <ScriptCard
                    key={script.id}
                    id={script.id}
                    title={script.title}
                    modderName={profile.username}
                    modderId={script.modder_id}
                    status={script.status}
                    downloadCount={script.download_count}
                    averageRating={Number(script.average_rating)}
                    isPaid={script.is_paid}
                    price={Number(script.price)}
                    thumbnailUrl={script.thumbnail_url}
                    categorySlug={script.categories?.slug}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhum script publicado ainda.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tutorials Tab */}
          <TabsContent value="tutorials">
            {tutorials && tutorials.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tutorials.map((t: any) => (
                  <Card key={t.id} className="hover:border-primary/40 transition-colors">
                    <CardContent className="p-4 space-y-2">
                      <a href={`/tutorial/${t.id}`} className="block">
                        {t.thumbnail_url && (
                          <img src={t.thumbnail_url} alt={t.title} className="w-full h-32 object-cover rounded-md mb-3" />
                        )}
                        <h3 className="font-semibold line-clamp-1">{t.title}</h3>
                        {t.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">{t.category}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(t.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhum tutorial publicado ainda.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Bio</h3>
                  <p className="text-foreground">
                    {profile.bio || "Esse criador ainda não adicionou uma bio."}
                  </p>
                </div>
                <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Membro desde</h3>
                    <p className="text-foreground">{memberSince}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Total de publicações</h3>
                    <p className="text-foreground">{(scripts?.length ?? 0) + (tutorials?.length ?? 0)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Downloads totais</h3>
                    <p className="text-foreground">{totalDownloads.toLocaleString("pt-BR")}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Avaliação média</h3>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-[hsl(var(--neon-cyan))] fill-[hsl(var(--neon-cyan))]" />
                      <span className="text-foreground">{avgRating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function StatItem({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center py-4 gap-1">
      <div className={color}>{icon}</div>
      <p className="text-lg font-bold font-mono">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
