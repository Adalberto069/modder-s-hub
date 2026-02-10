import { useParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ScriptCard } from "@/components/ScriptCard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { User, Download, Star, Trophy } from "lucide-react";

export default function ModderProfile() {
  const { userId } = useParams<{ userId: string }>();

  const { data: profile } = useQuery({
    queryKey: ["modder-profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", userId!).single();
      return data;
    },
    enabled: !!userId,
  });

  const { data: scripts } = useQuery({
    queryKey: ["modder-scripts", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("scripts")
        .select("*, categories(slug)")
        .eq("modder_id", userId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  if (!profile) {
    return <Layout><div className="container py-16 text-center text-muted-foreground">Carregando...</div></Layout>;
  }

  return (
    <Layout>
      <div className="container py-8 max-w-4xl">
        {/* Profile header */}
        <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 p-6 rounded-lg neon-border bg-card/50">
          <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <User className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-2xl font-bold">{profile.display_name ?? profile.username}</h1>
            <p className="text-sm text-muted-foreground font-mono">@{profile.username}</p>
            {profile.bio && <p className="text-sm text-muted-foreground mt-2">{profile.bio}</p>}
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <Trophy className="h-5 w-5 mx-auto text-neon-green mb-1" />
              <p className="text-lg font-bold font-mono">{profile.reputation_score}</p>
              <p className="text-xs text-muted-foreground">Reputação</p>
            </div>
            <div>
              <Download className="h-5 w-5 mx-auto text-neon-purple mb-1" />
              <p className="text-lg font-bold font-mono">{profile.total_downloads}</p>
              <p className="text-xs text-muted-foreground">Downloads</p>
            </div>
            <div>
              <Star className="h-5 w-5 mx-auto text-neon-cyan mb-1" />
              <p className="text-lg font-bold font-mono">{profile.total_positive_reviews}</p>
              <p className="text-xs text-muted-foreground">Avaliações +</p>
            </div>
          </div>
        </div>

        {/* Scripts */}
        <h2 className="text-xl font-bold mb-4">Scripts publicados</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {scripts?.map((script: any) => (
            <ScriptCard
              key={script.id}
              id={script.id}
              title={script.title}
              modderName={profile?.username ?? ""}
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
          {scripts?.length === 0 && <p className="text-muted-foreground col-span-full">Nenhum script publicado.</p>}
        </div>
      </div>
    </Layout>
  );
}
