import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ScriptCard } from "@/components/ScriptCard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { User, Download, Star, Trophy, Calendar, Code, BookOpen, Info, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserBadges } from "@/components/UserBadges";
import { RoleBadge } from "@/components/RoleBadge";
import { useAuth } from "@/lib/auth";

export default function ModderProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user, isAdmin } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["modder-profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, user_id, username, display_name, avatar_url, bio, reputation_score, total_downloads, total_positive_reviews, created_at, updated_at")
        .or(`id.eq.${userId},user_id.eq.${userId}`)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  const { data: scripts, isLoading: scriptsLoading } = useQuery({
    queryKey: ["modder-scripts", userId, profile?.id, profile?.user_id],
    queryFn: async () => {
      // modder_id relates to profiles.id in the schema
      const searchId = profile?.id || userId;
      const { data } = await supabase
        .from("scripts")
        .select("*, categories(slug)")
        .eq("modder_id", searchId!)
        .eq("publish_status", "published")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: tutorials } = useQuery({
    queryKey: ["modder-tutorials", userId, profile?.user_id],
    queryFn: async () => {
      // tutorials author_id usually relates to auth.user_id/profiles.user_id
      const searchId = profile?.user_id || userId;
      const { data } = await supabase
        .from("tutorials")
        .select("*")
        .or(`author_id.eq.${searchId},author_id.eq.${profile?.id}`)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: userRoles } = useQuery({
    queryKey: ["user-roles-public", userId, profile?.user_id],
    queryFn: async () => {
      const searchId = profile?.user_id || userId;
      if (!searchId || searchId === "undefined") return [];
      
      const { data } = await supabase
        .from("user_roles")
        .select("role, approved")
        .or(`user_id.eq.${searchId}${profile?.id ? `,user_id.eq.${profile.id}` : ""}`)
      return data?.filter((r: any) => r.approved).map((r: any) => r.role) ?? [];
    },
    enabled: !!userId && userId !== "undefined",
  });

  const { data: topModders } = useQuery({
    queryKey: ["top-modders"],
    queryFn: async () => {
      // Only consider profiles that actually have published scripts and meaningful reputation
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .gt("reputation_score", 0)
        .order("reputation_score", { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  const isElite = topModders && topModders.length > 0 && topModders.some((m: any) => m.user_id === profile?.user_id);

  // If they are elite, they are "modder-elite". 
  // If they have scripts or the modder role, they are "modder".
  // Otherwise, they are "member".
  // Display logic: Admin (Red) always wins. 
  // Then Modder (Purple) if they have the role or have published scripts.
  // Member as fallback.
  const displayRole: "admin" | "modder" | "member" = 
    userRoles?.includes("admin") ? "admin" : 
    (userRoles?.includes("modder") || (scripts && scripts.length > 0)) ? "modder" : "member";

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
        <div className="relative rounded-2xl overflow-hidden border border-white/5 bg-card/40 backdrop-blur-xl shadow-2xl">
          {/* Gradient backdrop with neon glow */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-purple via-neon-cyan to-neon-pink opacity-50" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-neon-purple/20 blur-[80px] rounded-full" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-neon-cyan/10 blur-[80px] rounded-full" />

          <div className="relative p-8 sm:p-10">
            <div className="flex flex-col sm:flex-row items-center gap-8 text-center sm:text-left">
              {/* Avatar with luxury border */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-tr from-neon-purple to-neon-cyan rounded-full opacity-60 group-hover:opacity-100 transition duration-500 blur" />
                <div className="relative h-32 w-32 rounded-full bg-[#0a0a0c] border border-white/10 flex items-center justify-center shrink-0 shadow-2xl overflow-hidden">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.username} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  ) : (
                    <User className="h-16 w-16 text-muted-foreground/50" />
                  )}
                </div>
              </div>

              {/* Info section */}
              <div className="flex-1 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3 justify-center sm:justify-start flex-wrap">
                    <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60">
                      {profile.display_name ?? profile.username}
                    </h1>
                    <RoleBadge role={displayRole} />
                    {isElite && (
                      <Badge className="bg-neon-purple text-white border-none shadow-neon-purple/50 animate-pulse">ELITE</Badge>
                    )}
                  </div>
                  <p className="text-sm font-mono text-neon-purple/80">@{profile.username}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                  <UserBadges userId={userId!} authId={profile.user_id} />
                </div>

                {profile.bio && (
                  <p className="text-base text-muted-foreground leading-relaxed max-w-2xl border-l-2 border-white/5 pl-4 py-1 italic">
                    "{profile.bio}"
                  </p>
                )}

                <div className="flex items-center gap-4 justify-center sm:justify-start pt-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                    <Calendar className="h-3.5 w-3.5 text-neon-purple" />
                    Membro desde {memberSince}
                  </div>
                  {profile.reputation_score > 100 && (
                    <div className="flex items-center gap-1.5 text-xs text-neon-green bg-neon-green/5 px-3 py-1.5 rounded-full border border-neon-green/10">
                      <Trophy className="h-3.5 w-3.5" />
                      Modder Referência
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Luxury Stats bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-white/5 bg-white/5 backdrop-blur-md">
            <StatItem icon={<Code className="h-5 w-5" />} value={scripts?.length ?? 0} label="Scripts Publicados" color="text-neon-purple" />
            <StatItem icon={<Download className="h-5 w-5" />} value={totalDownloads.toLocaleString()} label="Downloads Totais" color="text-neon-pink" />
            <StatItem icon={<Star className="h-5 w-5" />} value={avgRating.toFixed(1)} label="Avaliação Média" color="text-neon-cyan" />
            <StatItem icon={<Trophy className="h-5 w-5" />} value={profile.reputation_score} label="Score de Reputação" color="text-neon-green" />
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
          <TabsContent value="tutorials" className="space-y-4">
            {isAdmin && (
              <div className="flex justify-end">
                <Button asChild size="sm" className="bg-neon-purple hover:bg-neon-purple/90 text-white font-black uppercase tracking-widest text-[10px] gap-2">
                  <Link to="/tutorial/new">
                    <Plus className="h-3.5 w-3.5" /> Criar novo tutorial
                  </Link>
                </Button>
              </div>
            )}
            {tutorials && tutorials.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {tutorials.map((t: any) => (
                  <Card key={t.id} className="group relative overflow-hidden border-neon-purple/20 bg-card/40 backdrop-blur-md hover:border-neon-purple/40 transition-all duration-500 shadow-lg hover:shadow-neon-purple/10">
                    <CardContent className="p-0">
                      <Link to={`/tutorial/${t.id}`} className="block">
                        <div className="relative h-44 w-full overflow-hidden">
                          {t.thumbnail_url ? (
                            <img src={t.thumbnail_url} alt={t.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                          ) : (
                            <div className="w-full h-full bg-secondary/50 flex items-center justify-center">
                              <BookOpen className="h-10 w-10 text-muted-foreground/20" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-60" />
                          <Badge className="absolute top-3 left-3 bg-neon-purple/80 text-white border-none backdrop-blur-md">{t.category}</Badge>
                        </div>
                        <div className="p-5 space-y-3">
                          <h3 className="font-bold text-lg line-clamp-1 group-hover:text-neon-purple transition-colors uppercase tracking-tight">{t.title}</h3>
                          {t.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{t.description}</p>
                          )}
                          <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">
                              Publicado em {new Date(t.created_at).toLocaleDateString("pt-BR")}
                            </span>
                            <div className="flex items-center gap-1 text-neon-purple group-hover:gap-2 transition-all">
                              <span className="text-[10px] font-bold">VER TUTORIAL</span>
                              <BookOpen className="h-3 w-3" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-white/10 bg-white/5">
                <CardContent className="py-20 text-center space-y-3">
                  <BookOpen className="h-10 w-10 text-muted-foreground/20 mx-auto" />
                  <p className="text-muted-foreground font-medium">Nenhum tutorial publicado ainda.</p>
                  {isAdmin && (
                    <Button asChild size="sm" variant="outline" className="mt-2 gap-2">
                      <Link to="/tutorial/new">
                        <Plus className="h-3.5 w-3.5" /> Criar primeiro tutorial
                      </Link>
                    </Button>
                  )}
                  {!isAdmin && user?.id === profile.user_id && (
                    <p className="text-[11px] text-muted-foreground/60 italic">
                      Apenas administradores publicam tutoriais oficiais. Entre em contato com a equipe para sugerir conteúdo.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about">
            <Card className="border-white/5 bg-card/40 backdrop-blur-md overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/5 blur-[40px] -z-10" />
              <CardContent className="p-8 space-y-8">
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neon-purple">Trajetória e Bio</h3>
                  <p className="text-lg text-foreground/80 leading-relaxed font-medium">
                    {profile.bio || "Esse criador de elite preferiu manter sua biografia um mistério por enquanto."}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 border-t border-white/5">
                  <div className="space-y-1">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Membro da Comunidade</h3>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-neon-purple" />
                      <p className="font-bold">{memberSince}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Arsenal de Conteúdo</h3>
                    <div className="flex items-center gap-2">
                      <Code className="h-4 w-4 text-neon-pink" />
                      <p className="font-bold">{(scripts?.length ?? 0) + (tutorials?.length ?? 0)} Publicações</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Impacto no Mercado</h3>
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-neon-green" />
                      <p className="font-bold">{totalDownloads.toLocaleString("pt-BR")} Downloads</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Selo de Qualidade</h3>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-neon-cyan" />
                      <p className="font-bold">{avgRating.toFixed(1)} / 5.0 (Média)</p>
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
    <div className="flex flex-col items-center py-6 gap-2 group hover:bg-white/5 transition-colors">
      <div className={`${color} p-2 rounded-lg bg-white/5 border border-white/5 group-hover:scale-110 transition-transform`}>{icon}</div>
      <p className="text-2xl font-black font-mono tracking-tighter">{value}</p>
      <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70">{label}</p>
    </div>
  );
}
