import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScriptCard } from "@/components/ScriptCard";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useModderProfiles } from "@/hooks/use-modder-profiles";
import { useAuth } from "@/lib/auth";
import {
  Code, Shield, Lock, ArrowRight, Zap, ShieldCheck, Key, Store,
  Download, Star, Users, ChevronRight, Trophy, Heart,
  CalendarDays, Eye, Sparkles, Activity, Cpu, Hexagon, BookOpen
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserBadges } from "@/components/UserBadges";
import { RoleBadge } from "@/components/RoleBadge";
import { useState } from "react";
import heroBg from "@/assets/hero-bg.jpg";

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
  const hallOfFameModders = Object.values(profileMap).length > 0 
    ? Array.from(new Set(Object.values(profileMap))) 
    : topModders;

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
      for (const r of data ?? []) {
        const current = map[r.user_id];
        if (r.role === "admin" || (!current && r.role === "modder")) {
          map[r.user_id] = r.role;
        }
      }
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
      {/* ══════════════ MONUMENTAL HERO ══════════════ */}
      <section className="relative min-h-[80vh] sm:min-h-[92vh] flex items-center justify-center overflow-hidden">
        {/* Futuristic Background */}
        <div className="absolute inset-0 z-0">
          <img src={heroBg} alt="" className="w-full h-full object-cover opacity-30 grayscale" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050507] via-background/90 to-background" />
          {/* Neon Particles / Elements */}
          <div className="absolute top-1/4 left-1/4 w-[250px] sm:w-[500px] h-[250px] sm:h-[500px] bg-neon-purple/10 blur-[80px] sm:blur-[120px] rounded-full animate-pulse-neon" />
          <div className="absolute bottom-1/4 right-1/4 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-neon-cyan/5 blur-[100px] sm:blur-[150px] rounded-full animate-pulse-neon" style={{ animationDelay: "2s" }} />
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        </div>

        <div className="container relative z-10 px-4 sm:px-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="flex justify-center">
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Badge variant="outline" className="bg-neon-purple/5 border-neon-purple/20 text-neon-purple font-black tracking-[0.15em] sm:tracking-[0.3em] uppercase py-1.5 px-3 sm:py-2 sm:px-6 italic backdrop-blur-md text-[9px] sm:text-xs">
                  <Sparkles className="h-3.5 w-3.5 mr-2 animate-spin-slow" />
                  Nexus Intelligence protocol v4.0
                </Badge>
              </motion.div>
            </div>

            <div className="space-y-4">
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-4xl sm:text-7xl lg:text-9xl font-black tracking-tighter uppercase italic leading-[0.85] text-white drop-shadow-2xl"
              >
                Forge your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple via-white to-neon-cyan drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]">
                  Legacy
                </span>
              </motion.h1>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-sm sm:text-2xl text-muted-foreground font-mono max-w-2xl mx-auto uppercase tracking-wider leading-relaxed"
              >
                A elite do modding mobile se encontra aqui. Scripts ofuscados, 
                proteção avançada e o marketplace supremo.
              </motion.p>
            </div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6"
            >
              <Button
                size="lg"
                className="h-12 sm:h-16 px-6 sm:px-12 bg-neon-purple hover:bg-neon-purple/90 text-white font-black uppercase tracking-widest text-xs sm:text-sm rounded-2xl shadow-2xl shadow-neon-purple/20 transition-all hover:scale-105 active:scale-95 group"
                onClick={() => navigate("/marketplace")}
              >
                <Store className="mr-3 h-5 w-5 group-hover:rotate-12 transition-transform" />
                Acessar Hub de Elite
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 sm:h-16 px-6 sm:px-12 border-white/10 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-xs sm:text-sm rounded-2xl transition-all"
                onClick={() => navigate("/auth")}
              >
                Fazer Parte do Clã
                <ArrowRight className="ml-3 h-5 w-5" />
              </Button>
            </motion.div>

            {/* Quick stats floating console */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 1 }}
              className="pt-8 sm:pt-16 max-w-4xl mx-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden p-1 shadow-2xl shadow-black/50">
                {[
                  { icon: Code, value: stats?.scripts ?? 0, label: "Neural Scripts", color: "text-neon-purple" },
                  { icon: Users, value: stats?.users ?? 0, label: "Active Operatives", color: "text-neon-green" },
                  { icon: Activity, value: stats?.downloads ?? 0, label: "Data Transmissions", color: "text-neon-cyan" },
                ].map((stat, i) => (
                  <div key={stat.label} className="bg-[#0a0a0c]/60 p-3 sm:p-6 flex flex-col items-center justify-center gap-1 sm:gap-2 group hover:bg-white/5 transition-colors">
                    <stat.icon className={`h-5 w-5 ${stat.color} mb-1`} />
                    <p className="text-xl sm:text-3xl font-black font-mono tracking-tighter text-white">
                      {stat.value.toLocaleString("pt-BR")}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 italic">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════ CORE CAPABILITIES (REPLACING BENEFITS) ══════════════ */}
      <section className="relative py-16 sm:py-32 border-y border-white/5 bg-[#050507]">
        <div className="container px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-end justify-between mb-10 sm:mb-20 gap-6 sm:gap-8">
            <div className="space-y-4 max-w-2xl">
              <Badge className="bg-neon-green/10 text-neon-green border border-neon-green/20 text-[10px] font-black tracking-widest px-4 py-1 uppercase">
                System Capabilities
              </Badge>
              <h2 className="text-3xl sm:text-5xl font-black italic uppercase tracking-tighter">
                Tecnologia que <span className="text-neon-green">domina</span> o cenário
              </h2>
            </div>
            <p className="text-muted-foreground font-medium max-w-sm text-left sm:text-right italic border-l-2 sm:border-l-0 sm:border-r-2 border-neon-green pl-4 sm:pl-0 sm:pr-6 text-sm">
              Desenvolvido por modders, para modders. Segurança máxima e performance extrema em cada linha de código.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8">
            {[
              {
                icon: ShieldCheck,
                title: "Neural Obfuscation",
                description: "Proteção de nível militar contra engenharia reversa. Seu código vira uma fortaleza impenetrável.",
                color: "text-neon-purple",
                glow: "shadow-neon-purple/20",
                bg: "bg-neon-purple/5",
              },
              {
                icon: Key,
                title: "Quantum Licenses",
                description: "Gerenciamento dinâmico de chaves com verificação em nanossegundos. Controle total do seu software.",
                color: "text-neon-green",
                glow: "shadow-neon-green/20",
                bg: "bg-neon-green/5",
              },
              {
                icon: Cpu,
                title: "Infinite Engine",
                description: "Nossa infraestrutura escala com você. Downloads ultra-rápidos e estabilidade garantida 24/7.",
                color: "text-neon-cyan",
                glow: "shadow-neon-cyan/20",
                bg: "bg-neon-cyan/5",
              },
            ].map((cap, i) => (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
              >
                <div className={`p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/5 bg-[#0a0a0c]/40 backdrop-blur-xl hover:border-white/20 transition-all duration-500 group relative overflow-hidden`}>
                  <div className={`absolute -top-24 -right-24 w-48 h-48 ${cap.color} opacity-5 blur-[80px] rounded-full group-hover:opacity-10 transition-opacity`} />
                  <div className="relative z-10 space-y-6">
                    <div className={`h-16 w-16 rounded-2xl ${cap.bg} border border-white/10 flex items-center justify-center group-hover:scale-110 transition-all duration-500 shadow-xl ${cap.glow}`}>
                      <cap.icon className={`h-8 w-8 ${cap.color}`} />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-lg sm:text-2xl font-black italic uppercase tracking-tighter text-white">{cap.title}</h3>
                      <p className="text-sm text-muted-foreground font-medium leading-relaxed">{cap.description}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ HALL OF FAME ══════════════ */}
      <section className="py-16 sm:py-32 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] sm:w-[800px] h-1 bg-gradient-to-r from-transparent via-neon-purple/30 to-transparent" />
        <div className="container px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-20 space-y-4">
            <h2 className="text-3xl sm:text-6xl font-black italic uppercase tracking-tighter">
              Nexus <span className="text-neon-purple">Commanders</span>
            </h2>
            <p className="text-muted-foreground uppercase font-black tracking-[0.4em] text-[10px] italic">
              Hall da Fama - Operadores Nível Elite
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {hallOfFameModders.slice(0, 4).map((profile: any, i: number) => {
              const roleKey = hallRolesMap[profile.user_id] || hallRolesMap[profile.id];
              const displayRole: "admin" | "modder" | "member" = 
                roleKey === "admin" ? "admin" : "modder"; 
              return (
                <motion.div
                  key={profile.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -10 }}
                  className="relative group cursor-pointer"
                  onClick={() => setSelectedModder(profile)}
                >
                  <Card className="bg-[#0a0a0c]/60 backdrop-blur-2xl border-white/5 hover:border-neon-purple/40 transition-all duration-500 p-8 rounded-3xl overflow-hidden text-center h-full flex flex-col items-center">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                      <Hexagon className="h-12 w-12 text-neon-purple" />
                    </div>
                    
                    <div className="relative mb-6">
                       <div className="absolute inset-0 bg-neon-purple/20 blur-2xl rounded-full scale-0 group-hover:scale-100 transition-transform duration-500" />
                       <Avatar className="h-28 w-28 border-2 border-white/5 relative z-10 grayscale group-hover:grayscale-0 transition-all duration-500">
                        <AvatarImage src={profile.avatar_url} />
                        <AvatarFallback className="bg-primary/5 text-3xl font-black italic">
                          {(profile.display_name || profile.username || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    <div className="space-y-1 mb-6">
                      <h3 className="font-black text-xl italic uppercase tracking-tighter">
                        {profile.display_name || profile.username || "Anonymous"}
                      </h3>
                      <p className="text-[10px] font-mono text-muted-foreground/60 tracking-widest">
                        CODE_SIG: {profile.id.substring(0, 8).toUpperCase()}
                      </p>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                      <RoleBadge role={displayRole} />
                      <div className="flex gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                         <UserBadges userId={profile.user_id} compact />
                      </div>
                    </div>

                    <div className="mt-auto pt-8 flex items-center gap-2">
                       <Trophy className="h-3 w-3 text-neon-purple" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Verified Elite</span>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════ MARKETPLACE PREVIEW ══════════════ */}
      <section className="py-32 bg-[#0a0a0c]/80 backdrop-blur-sm border-y border-white/5">
        <div className="container px-6">
          <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-6 text-center md:text-left">
            <div className="space-y-2">
              <h2 className="text-5xl font-black italic uppercase tracking-tighter">
                Últimas <span className="text-neon-cyan text-glow-cyan">Injeções</span>
              </h2>
              <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Acesso liberado aos novos sistemas de elite</p>
            </div>
            <Button
              variant="outline"
              className="h-12 px-8 border-white/10 bg-white/5 hover:bg-white/10 font-bold uppercase tracking-widest text-xs group transition-all"
              onClick={() => navigate("/marketplace")}
            >
              Protocolo Marketplace Completo
              <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {scripts?.map((script: any, i: number) => (
              <motion.div
                key={script.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
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
          </div>
        </div>
      </section>

      {/* ══════════════ CTA FINAL (THE MOVEMENT) ══════════════ */}
      <section className="py-40 relative">
        <div className="container px-6">
          <div className="relative rounded-[40px] overflow-hidden border border-white/10 p-12 sm:p-24 text-center">
            {/* Background elements */}
            <div className="absolute inset-0 bg-[#0a0a0c]/80 backdrop-blur-2xl z-0" />
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-neon-purple/10 via-transparent to-neon-cyan/5 z-0" />

            <div className="relative z-10 space-y-10 max-w-3xl mx-auto">
              <div className="flex justify-center flex-col items-center gap-4">
                 <div className="w-2.5 h-2.5 rounded-full bg-neon-purple animate-ping" />
                 <h2 className="text-5xl sm:text-7xl font-black italic uppercase tracking-tighter leading-tight drop-shadow-2xl">
                   Join the <br />
                   <span className="text-neon-purple">Nexus Generation</span>
                 </h2>
              </div>
              
              <p className="text-xl text-muted-foreground leading-relaxed font-medium">
                Não somos apenas uma plataforma, somos o futuro do modding.
                O portal da elite está aberto para novos membros de alto nível.
              </p>

              <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8">
                <Button
                  size="lg"
                  className="h-16 px-16 bg-white text-black hover:bg-white/90 font-black uppercase tracking-widest text-sm rounded-2xl group transition-all"
                  onClick={() => navigate("/auth?tab=signup")}
                >
                  Criar Credenciais
                  <Zap className="ml-3 h-5 w-5 fill-current group-hover:scale-110 transition-transform" />
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="h-16 px-12 text-white hover:bg-white/5 font-black uppercase tracking-widest text-sm rounded-2xl border border-white/5"
                  onClick={() => navigate("/tutorials")}
                >
                  <BookOpen className="mr-3 h-5 w-5" />
                  Nexus Academy
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ MODDER PROFILE DIALOG (ELITE VERSION) ══════════════ */}
      <Dialog open={!!selectedModder} onOpenChange={(open) => !open && setSelectedModder(null)}>
        <DialogContent className="max-w-xl bg-[#0a0a0c]/95 backdrop-blur-3xl border-white/10 p-0 overflow-hidden shadow-3xl">
          {selectedModder && (() => {
            const roleKey = hallRolesMap[selectedModder.user_id] || hallRolesMap[selectedModder.id];
            const displayRole: "admin" | "modder" | "member" = 
              roleKey === "admin" ? "admin" : "modder";
            return (
              <div className="relative">
                <div className="h-32 bg-gradient-to-r from-neon-purple/20 to-neon-cyan/10" />
                <div className="p-10 -mt-20 flex flex-col items-center text-center space-y-6">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-neon-purple/30 blur-2xl rounded-full animate-pulse" />
                    <Avatar className="h-40 w-40 border-4 border-white relative z-10">
                      <AvatarImage src={selectedModder.avatar_url} />
                      <AvatarFallback className="bg-primary/5 text-4xl font-black italic">
                        {(selectedModder.display_name || selectedModder.username || "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-4xl font-black italic uppercase tracking-tighter">{selectedModder.display_name || selectedModder.username}</h3>
                      <p className="text-xs font-mono text-muted-foreground/60 tracking-[0.3em] uppercase">Security Level: {displayRole.toUpperCase()}</p>
                    </div>
                    <RoleBadge role={displayRole} />
                  </div>

                  <div className="flex flex-wrap justify-center gap-2">
                    <UserBadges userId={selectedModder.user_id} />
                  </div>
                  
                  {selectedModder.bio && (
                    <p className="text-sm text-muted-foreground leading-relaxed font-medium italic max-w-xs pt-4 border-t border-white/5">
                        "{selectedModder.bio}"
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-6 w-full py-8 border-y border-white/5">
                    {[
                       { value: selectedModder.reputation_score ?? 0, label: "Reputação" },
                       { value: selectedModder.total_downloads ?? 0, label: "Exports" },
                       { value: selectedModder.total_positive_reviews ?? 0, label: "Vouches" },
                    ].map(st => (
                      <div key={st.label} className="text-center group">
                        <p className="text-2xl font-black font-mono group-hover:text-neon-purple transition-colors">{st.value}</p>
                        <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">{st.label}</p>
                      </div>
                    ))}
                  </div>

                  <Button
                    size="lg"
                    className="w-full h-14 bg-neon-purple hover:bg-neon-purple/90 text-white font-black uppercase tracking-widest text-xs rounded-2xl group transition-all"
                    onClick={() => {
                      setSelectedModder(null);
                      navigate(`/modder/${selectedModder.user_id}`);
                    }}
                  >
                    Abrir Perfil Completo
                    <Eye className="ml-3 h-5 w-5 transition-transform group-hover:scale-110" />
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

