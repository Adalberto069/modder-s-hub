import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScriptCard } from "@/components/ScriptCard";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useModderProfiles } from "@/hooks/use-modder-profiles";
import { useAuth } from "@/lib/auth";
import {
  Code, Shield, Lock, ArrowRight, Zap, ShieldCheck, Key, Store,
  Download, Star, Users, ChevronRight, Quote, MessageCircle, Trophy, Heart,
  CalendarDays, Eye,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserBadges } from "@/components/UserBadges";
import { UserRoleBadge } from "@/components/UserRoleBadge";
import { RoleBadge } from "@/components/RoleBadge";
import { useState } from "react";
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
  const { user } = useAuth();
  const [selectedModder, setSelectedModder] = useState<any>(null);

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
  
  // Also fetch top modders by reputation as fallbacks or for the hall of fame
  const { data: topModders = [] } = useQuery({
    queryKey: ["top-modders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("reputation_score", { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  const { data: profileMap = {} } = useModderProfiles(modderIds);

  // Combine featured modders with top modders for the Hall of Fame
  // Fallback to topModders if the specific map is empty (still loading or no matches)
  const hallOfFameModders = Object.values(profileMap).length > 0 
    ? Array.from(new Set(Object.values(profileMap))) 
    : topModders;

  // Fetch roles for hall of fame modders
  const hallIds = hallOfFameModders.flatMap((p: any) => [p.user_id, p.id].filter(Boolean));
  const { data: hallRolesMap = {} } = useQuery({
    queryKey: ["hall-roles", hallIds.join(",")],
    queryFn: async () => {
      if (hallIds.length === 0) return {};
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, role, approved")
        .in("user_id", hallIds)
        .eq("approved", true);
      
      const map: Record<string, string> = {};
      
      // First, map roles to user_ids, priorizing admin
      for (const r of data ?? []) {
        const current = map[r.user_id];
        if (r.role === "admin" || (!current && r.role === "modder")) {
          map[r.user_id] = r.role;
        }
      }

      // Also map the same roles to the profile IDs so they can be looked up either way
      for (const profile of hallOfFameModders) {
        if (profile.user_id && map[profile.user_id]) {
          map[profile.id] = map[profile.user_id];
        }
      }
      
      return map;
    },
    enabled: hallIds.length > 0,
  });

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
              Faça parte da maior elite de modders mobile. Marketplace profissional, 
              ofuscação avançada e uma comunidade focada em evolução constante.
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

      {/* ══════════════ TOP MODDERS / HALL DA FAMA ══════════════ */}
      <section className="py-14 sm:py-24 bg-card/10">
        <div className="container">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge variant="outline" className="neon-border mb-4 font-mono">
              <Trophy className="h-3.5 w-3.5 mr-1.5 text-accent" /> Hall da Fama
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              A Elite dos <span className="text-neon-purple">Criadores</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
              Conheça os modders que mais contribuem e elevam o nível dos scripts Game Guardian em nossa plataforma.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {hallOfFameModders.slice(0, 4).map((profile: any, i: number) => {
              const roleKey = hallRolesMap[profile.user_id] || hallRolesMap[profile.id];
              // On the Home/Hall cards, we want the RoleBadge to show the ACTUAL role (Admin/Modder)
              // because we already have the "MODDER ELITE" decorative star below.
              const displayRole: "admin" | "modder" | "member" = 
                roleKey === "admin" ? "admin" : "modder"; 
              return (
                <motion.div
                  key={profile.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex flex-col items-center p-6 rounded-xl border border-border/50 bg-background/50 hover:neon-border transition-all group cursor-pointer"
                  onClick={() => setSelectedModder(profile)}
                >
                  <div className="relative mb-4">
                    <Avatar className="h-20 w-20 border-2 border-primary/20 group-hover:border-primary transition-colors">
                      <AvatarImage src={profile.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-xl font-bold">
                        {(profile.display_name || profile.username || "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 bg-background border border-border rounded-full p-1">
                      <ShieldCheck className="h-4 w-4 text-neon-green" />
                    </div>
                  </div>
                  <h3 className="font-bold text-lg text-center line-clamp-1">
                    {profile.display_name || profile.username || "Modder"}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    @{profile.username || "user"}
                  </p>
                  <div className="mt-2">
                    <RoleBadge role={displayRole} />
                  </div>
                  <UserBadges userId={profile.user_id} compact />
                  <div className="flex items-center gap-1 mt-3">
                    <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                    <span className="text-[10px] font-bold tracking-wider text-amber-500">MODDER ELITE</span>
                  </div>
                </motion.div>
              );
            })}
            {hallOfFameModders.length === 0 && (
              <div className="col-span-full text-center py-10 opacity-50">
                <Users className="h-10 w-10 mx-auto mb-2" />
                <p>Nenhum criador em destaque no momento.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════ MODDER PROFILE DIALOG ══════════════ */}
      <Dialog open={!!selectedModder} onOpenChange={(open) => !open && setSelectedModder(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedModder && (() => {
            const roleKey = hallRolesMap[selectedModder.user_id] || hallRolesMap[selectedModder.id];
            const displayRole: "admin" | "modder" | "member" = 
              roleKey === "admin" ? "admin" : "modder";
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="sr-only">Perfil do Criador</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center text-center space-y-4">
                  <Avatar className="h-24 w-24 border-2 border-primary/30">
                    <AvatarImage src={selectedModder.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-2xl font-bold">
                      {(selectedModder.display_name || selectedModder.username || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold">{selectedModder.display_name || selectedModder.username}</h3>
                    <p className="text-sm text-muted-foreground font-mono">@{selectedModder.username}</p>
                  </div>
                  <RoleBadge role={displayRole} />
                  <UserBadges userId={selectedModder.user_id} />
                  {selectedModder.bio && (
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{selectedModder.bio}</p>
                  )}
                  <div className="grid grid-cols-3 gap-4 w-full pt-2 border-t border-border">
                    <div className="text-center">
                      <p className="text-lg font-bold font-mono">{selectedModder.reputation_score ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Reputação</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold font-mono">{selectedModder.total_downloads ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Downloads</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold font-mono">{selectedModder.total_positive_reviews ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avaliações</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    Membro desde {new Date(selectedModder.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                  </div>
                  <Button
                    className="w-full mt-2"
                    onClick={() => {
                      setSelectedModder(null);
                      navigate(`/modder/${selectedModder.user_id}`);
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" /> Ver Perfil Completo
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ══════════════ COMMUNITY SOCIALS ══════════════ */}
      <section className="relative py-14 sm:py-24 overflow-hidden border-y border-border/30">
        <div className="absolute inset-0 bg-primary/5" />
        <div className="container relative z-10 flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 space-y-6 text-center lg:text-left">
            <Badge variant="outline" className="neon-border-green font-mono">
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Nossa Comunidade
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
              Não apenas use códigos, <br />
              <span className="text-neon-green">faça parte do movimento</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
              Troque conhecimento, aprenda com os melhores modders e evolua seus códigos. Nossa casa é o lugar onde a elite se encontra.
            </p>
            <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-4">
              <Button 
                size="lg" 
                className="bg-[#5865F2] hover:bg-[#4752C4] text-white border-none px-8"
                onClick={() => window.open("https://discord.gg/your-invite", "_blank")}
              >
                <Users className="mr-2 h-5 w-5" /> Discord Oficial
              </Button>
              <Button 
                size="lg" 
                className="bg-[#0088cc] hover:bg-[#0077b5] text-white border-none px-8"
                onClick={() => window.open("https://t.me/your-group", "_blank")}
              >
                <MessageCircle className="mr-2 h-5 w-5" /> Grupo Telegram
              </Button>
            </div>
          </div>
          <div className="flex-1 w-full max-w-md">
            <div className="relative aspect-square sm:aspect-video lg:aspect-square flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 rounded-3xl blur-2xl animate-pulse" />
              <Card className="relative w-full border-2 border-primary/30 bg-background/80 backdrop-blur-xl p-8 rounded-3xl overflow-hidden shadow-2xl">
                <div className="space-y-6">
                  <div className="flex items-center gap-4 border-b border-border pb-6">
                    <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <Heart className="h-6 w-6 text-primary animate-bounce-slow" />
                    </div>
                    <div>
                      <p className="font-bold">+1,200 Membros</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-widest">Ativos no chat</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {[
                      "Tutoriais exclusivos",
                      "Troca de métodos de ofuscação",
                      "Suporte direto de modders",
                      "Eventos e competições"
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-neon-green shadow-[0_0_8px_hsl(var(--neon-green))]" />
                        <span className="text-sm font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
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

            <div className="relative z-10 px-5 py-12 sm:px-16 sm:py-20 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Pronto para evoluir?
              </h2>
              <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-8">
                Junte-se à nossa família de modders e tenha acesso a proteção profissional e conhecimento de elite.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="neon-glow-purple font-semibold text-base h-13 px-10"
                  onClick={() => navigate("/marketplace")}
                >
                  <Store className="mr-2 h-5 w-5" /> Explorar Hub
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="neon-border font-semibold text-base h-13 px-10"
                  onClick={() => navigate(user ? "/forum" : "/auth?tab=signup")}
                >
                  {user ? "Ir para o Fórum" : "Juntar-se à Comunidade"}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
