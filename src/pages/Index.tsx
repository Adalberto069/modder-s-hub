import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScriptCard } from "@/components/ScriptCard";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useModderProfiles } from "@/hooks/use-modder-profiles";
import {
  Code, Shield, Lock, ArrowRight, Zap, ShieldCheck, Key, Store,
  Download, Star, Users, ChevronRight, Quote,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import heroBg from "@/assets/hero-bg.jpg";
import type { Easing } from "framer-motion";

const easeOut: Easing = [0, 0, 0.2, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.5, ease: easeOut },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function Index() {
  const navigate = useNavigate();

  const { data: scripts } = useQuery({
    queryKey: ["featured-scripts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("scripts")
        .select("*, categories(slug)")
        .eq("publish_status", "published")
        .order("download_count", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const modderIds = [...new Set(scripts?.map((s: any) => s.modder_id as string) ?? [])];
  const { data: modderProfiles } = useModderProfiles(modderIds);
  const profileMap = modderProfiles ?? {};

  const { data: stats } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const [scriptsRes, profilesRes] = await Promise.all([
        supabase.from("scripts").select("download_count", { count: "exact" }).eq("publish_status", "published"),
        supabase.from("profiles").select("id", { count: "exact" }),
      ]);
      const totalDownloads = (scriptsRes.data ?? []).reduce((s: number, r: any) => s + (r.download_count || 0), 0);
      return {
        scripts: scriptsRes.count ?? 0,
        users: profilesRes.count ?? 0,
        downloads: totalDownloads,
      };
    },
  });

  const testimonials = [
    {
      name: "João",
      location: "SP",
      comment: "O loader funcionou perfeitamente! Sistema de licença muito profissional.",
      rating: 5,
    },
    {
      name: "Carlos",
      location: "RJ",
      comment: "Melhor marketplace de scripts que já usei. Rápido, seguro e organizado.",
      rating: 5,
    },
    {
      name: "Ana",
      location: "MG",
      comment: "A ofuscação dos scripts é excelente. Meus scripts ficaram 100% protegidos.",
      rating: 5,
    },
  ];

  return (
    <Layout>
      {/* ══════════════ HERO ══════════════ */}
      <section className="relative min-h-[85vh] sm:min-h-[90vh] flex items-center overflow-hidden">
        {/* Background image + overlays */}
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-background/75 sm:bg-background/70" />
          <div className="absolute inset-0 bg-grid-pattern" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* Animated orbs - smaller on mobile */}
        <div className="absolute top-20 left-4 sm:left-10 w-40 sm:w-72 h-40 sm:h-72 bg-primary/20 rounded-full blur-[80px] sm:blur-[120px] animate-pulse-neon" />
        <div className="absolute bottom-20 right-4 sm:right-10 w-52 sm:w-96 h-52 sm:h-96 bg-accent/15 rounded-full blur-[100px] sm:blur-[150px] animate-pulse-neon" />

        <div className="container relative z-10 py-12 sm:py-20 px-4 sm:px-6">
          <motion.div
            className="max-w-3xl mx-auto sm:mx-0"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            <motion.div variants={fadeUp} custom={0}>
              <Badge variant="outline" className="neon-border text-neon-green font-mono mb-6 px-4 py-1.5">
                <Zap className="h-3.5 w-3.5 mr-1.5" /> Plataforma #1 de Scripts GG
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5 sm:mb-6"
            >
              Scripts exclusivos para{" "}
              <span className="text-neon-purple">Game Guardian</span>
              <span className="hidden sm:inline"><br /></span>{" "}
              <span className="text-neon-green">seguros, ofuscados</span> e com licenças únicas
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-base sm:text-xl text-muted-foreground max-w-xl mb-8 sm:mb-10 leading-relaxed"
            >
              Baixe hoje e proteja suas criações. Marketplace profissional com sistema de licenças, 
              ofuscação avançada e suporte dedicado.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button
                size="lg"
                className="neon-glow-purple font-semibold text-base h-12 sm:h-13 px-6 sm:px-8 w-full sm:w-auto"
                onClick={() => navigate("/marketplace")}
              >
                <Store className="mr-2 h-5 w-5" /> Ver Scripts
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="neon-border font-semibold text-base h-12 sm:h-13 px-6 sm:px-8 hover:bg-primary/10 w-full sm:w-auto"
                onClick={() => navigate("/dashboard")}
              >
                Painel do Usuário <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>

            {/* Quick stats */}
            <motion.div variants={fadeUp} custom={4} className="flex flex-wrap gap-4 sm:gap-8 mt-10 sm:mt-14">
              {[
                { icon: Code, value: stats?.scripts ?? 0, label: "Scripts" },
                { icon: Users, value: stats?.users ?? 0, label: "Usuários" },
                { icon: Download, value: stats?.downloads ?? 0, label: "Downloads" },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-2 sm:gap-3">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-xl font-bold font-mono">{stat.value.toLocaleString("pt-BR")}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════ BENEFITS ══════════════ */}
      <section className="relative py-14 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-card/30 to-background" />
        <div className="container relative z-10">
          <motion.div
            className="text-center mb-10 sm:mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="neon-border mb-4 font-mono">
              Por que escolher o ModHub?
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Tudo que você precisa em <span className="text-neon-purple">um só lugar</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: ShieldCheck,
                title: "Scripts Ofuscados",
                description:
                  "Proteja seus scripts contra leaks e engenharia reversa. Nossa ofuscação avançada garante que seu código fique inacessível.",
                color: "text-neon-purple",
                glow: "neon-glow-purple",
                border: "neon-border",
                bg: "bg-primary/5",
              },
              {
                icon: Key,
                title: "Licença Segura",
                description:
                  "Cada usuário recebe uma licença única com verificação em tempo real. Controle total sobre quem usa seus scripts.",
                color: "text-neon-green",
                glow: "neon-glow-green",
                border: "neon-border-green",
                bg: "bg-accent/5",
              },
              {
                icon: Store,
                title: "Marketplace Profissional",
                description:
                  "Painel completo para criadores e compradores. Sistema de moderação, avaliações e categorização inteligente.",
                color: "text-neon-cyan",
                glow: "",
                border: "border border-[hsl(var(--neon-cyan)/0.3)]",
                bg: "bg-[hsl(var(--neon-cyan)/0.05)]",
              },
            ].map((benefit, i) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
              >
                <Card
                  className={`${benefit.border} ${benefit.bg} h-full group hover:${benefit.glow} transition-all duration-300 cursor-default`}
                >
                  <CardContent className="p-5 sm:p-8 space-y-4">
                    <div
                      className={`h-14 w-14 rounded-xl ${benefit.bg} border ${benefit.border} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                    >
                      <benefit.icon className={`h-7 w-7 ${benefit.color}`} />
                    </div>
                    <h3 className="text-xl font-bold">{benefit.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ MARKETPLACE HIGHLIGHTS ══════════════ */}
      <section className="py-14 sm:py-24">
        <div className="container">
          <motion.div
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 gap-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div>
              <Badge variant="outline" className="neon-border-green mb-3 font-mono">
                <Star className="h-3 w-3 mr-1" /> Em destaque
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Scripts mais <span className="text-neon-green">populares</span>
              </h2>
            </div>
            <Button
              variant="outline"
              className="neon-border group"
              onClick={() => navigate("/marketplace")}
            >
              Ver todos
              <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {scripts?.map((script: any, i: number) => (
              <motion.div
                key={script.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <ScriptCard
                  id={script.id}
                  title={script.title}
                  modderName={profileMap[script.modder_id]?.display_name ?? profileMap[script.modder_id]?.username ?? "Modder"}
                  modderId={script.modder_id}
                  status={script.status}
                  downloadCount={script.download_count}
                  averageRating={Number(script.average_rating)}
                  isPaid={script.is_paid}
                  price={Number(script.price)}
                  thumbnailUrl={script.thumbnail_url}
                  categorySlug={script.categories?.slug}
                />
              </motion.div>
            ))}
            {(!scripts || scripts.length === 0) && (
              <div className="col-span-full text-center py-16">
                <Code className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum script publicado ainda. Seja o primeiro!</p>
                <Button
                  variant="outline"
                  className="mt-4 neon-border"
                  onClick={() => navigate("/auth?tab=signup")}
                >
                  Criar Conta
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════ TESTIMONIALS ══════════════ */}
      <section className="relative py-14 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-card/20 to-background" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[200px]" />

        <div className="container relative z-10">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge variant="outline" className="neon-border mb-4 font-mono">
              <Quote className="h-3 w-3 mr-1" /> Depoimentos
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              O que nossos <span className="text-neon-purple">usuários</span> dizem
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
              >
                <Card className="neon-border bg-card/60 h-full">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex gap-0.5">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} className="h-4 w-4 fill-accent text-accent" />
                      ))}
                    </div>
                    <p className="text-foreground/90 leading-relaxed italic">
                      "{t.comment}"
                    </p>
                    <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                      <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{t.name[0]}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.location}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ CTA FINAL ══════════════ */}
      <section className="py-14 sm:py-24">
        <div className="container">
          <motion.div
            className="relative rounded-2xl overflow-hidden neon-border"
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-card to-accent/10" />
            <div className="absolute inset-0 bg-grid-pattern opacity-50" />

            <div className="relative z-10 px-8 py-16 sm:px-16 sm:py-20 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Pronto para começar?
              </h2>
              <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-8">
                Junte-se à comunidade de modders e tenha acesso a scripts exclusivos com proteção profissional.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="neon-glow-purple font-semibold text-base h-13 px-10"
                  onClick={() => navigate("/marketplace")}
                >
                  <Store className="mr-2 h-5 w-5" /> Explorar Marketplace
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="neon-border font-semibold text-base h-13 px-10"
                  onClick={() => navigate("/auth?tab=signup")}
                >
                  Criar Conta Grátis
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
