import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScriptCard } from "@/components/ScriptCard";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useModderProfiles } from "@/hooks/use-modder-profiles";
import { Code, Shield, Monitor, Package, Trophy, ArrowRight, Zap } from "lucide-react";

const categoryIcons: Record<string, any> = {
  root: Shield,
  virtualizado: Monitor,
  "scripts-lua": Code,
  "apks-mod": Package,
};

export default function Index() {
  const navigate = useNavigate();

  const { data: scripts } = useQuery({
    queryKey: ["featured-scripts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("scripts")
        .select("*, categories(slug)")
        .order("download_count", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const { data: topModders } = useQuery({
    queryKey: ["top-modders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("reputation_score", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*");
      return data ?? [];
    },
  });

  return (
    <Layout>
      {/* Hero */}
      <section className="gradient-hero bg-grid-pattern relative overflow-hidden">
        <div className="container py-20 md:py-32 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="outline" className="mb-4 neon-border text-neon-purple font-mono">
              <Zap className="h-3 w-3 mr-1" /> Plataforma #1 para Modders Mobile
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
              Scripts & Mods para{" "}
              <span className="text-neon-purple">Games Mobile</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Descubra, baixe e compartilhe scripts Lua para Game Guardian e APKs modificados. 
              A maior comunidade de modders mobile.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="neon-glow-purple font-semibold" onClick={() => navigate("/marketplace")}>
                Explorar Marketplace <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="neon-border" onClick={() => navigate("/auth?tab=signup")}>
                Criar Conta
              </Button>
            </div>
          </motion.div>
        </div>
        {/* Decorative gradient orbs */}
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -right-32 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
      </section>

      {/* Categories */}
      <section className="container py-12">
        <h2 className="text-2xl font-bold mb-6">Categorias</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories?.map((cat: any) => {
            const Icon = categoryIcons[cat.slug] ?? Code;
            return (
              <motion.button
                key={cat.id}
                whileHover={{ scale: 1.03 }}
                className="p-6 rounded-lg neon-border bg-card/50 hover:neon-glow-purple transition-all text-center space-y-2"
                onClick={() => navigate(`/marketplace?category=${cat.slug}`)}
              >
                <Icon className="h-8 w-8 mx-auto text-neon-purple" />
                <p className="font-semibold text-sm">{cat.name}</p>
                <p className="text-xs text-muted-foreground">{cat.description}</p>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Top Modders */}
      <section className="container py-12">
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="h-6 w-6 text-neon-green" />
          <h2 className="text-2xl font-bold">Top Modders</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {topModders?.map((modder: any, i: number) => (
            <motion.div
              key={modder.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-4 rounded-lg neon-border-green bg-card/50 text-center space-y-2 cursor-pointer hover:neon-glow-green transition-all"
              onClick={() => navigate(`/modder/${modder.user_id}`)}
            >
              <div className="text-2xl font-bold font-mono text-neon-green">#{i + 1}</div>
              <p className="font-semibold text-sm truncate">{modder.display_name ?? modder.username}</p>
              <p className="text-xs text-muted-foreground font-mono">{modder.reputation_score} pts</p>
            </motion.div>
          ))}
          {(!topModders || topModders.length === 0) && (
            <p className="text-sm text-muted-foreground col-span-full">Nenhum modder ainda. Seja o primeiro!</p>
          )}
        </div>
      </section>

      {/* Featured Scripts */}
      <section className="container py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Scripts em Destaque</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/marketplace")}>
            Ver todos <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {scripts?.map((script: any) => (
            <ScriptCard
              key={script.id}
              id={script.id}
              title={script.title}
              modderName={"Modder"}
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
          {(!scripts || scripts.length === 0) && (
            <p className="text-sm text-muted-foreground col-span-full">Nenhum script publicado ainda.</p>
          )}
        </div>
      </section>
    </Layout>
  );
}
