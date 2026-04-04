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
  Code, ShieldCheck, Key, Store, Zap, Users, ChevronRight, Trophy,
  Eye, Activity, Cpu, Terminal, Fingerprint, Network, SearchCode
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { UserBadges } from "@/components/UserBadges";
import { RoleBadge } from "@/components/RoleBadge";
import { useState } from "react";

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
      {/* ══════════════ TERMINAL HERO ══════════════ */}
      <section className="relative min-h-[85vh] sm:min-h-[92vh] flex items-center justify-center overflow-hidden bg-[#030304]">
        {/* Animated Grid & Glows Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[#030304] z-0" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center bg-repeat opacity-[0.15] [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
          
          {/* Neon Floating Orbs */}
          <motion.div 
            animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3] }}
            transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
            className="absolute top-[10%] left-[20%] w-[300px] h-[300px] bg-neon-green/15 blur-[120px] rounded-full mix-blend-screen"
          />
          <motion.div 
            animate={{ y: [0, 30, 0], x: [0, -30, 0], opacity: [0.2, 0.5, 0.2] }}
            transition={{ repeat: Infinity, duration: 10, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] bg-neon-purple/20 blur-[150px] rounded-full mix-blend-screen"
          />
        </div>

        <div className="container relative z-10 px-4 sm:px-6 w-full flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center w-full max-w-4xl"
          >
            {/* Top Badge */}
            <Badge variant="outline" className="mb-8 bg-[#0a0f0d] border-neon-green/30 text-neon-green font-mono tracking-widest uppercase py-1.5 px-4 text-[10px] sm:text-xs">
              <Terminal className="h-3.5 w-3.5 mr-2 animate-pulse" />
              Hidden Protocol Active
            </Badge>

            {/* Main Title */}
            <h1 className="text-center font-black tracking-tighter uppercase leading-[0.85] text-white drop-shadow-2xl mb-6">
              <span className="block text-4xl sm:text-6xl md:text-8xl">Uncover The</span>
              <span className="block text-5xl sm:text-7xl md:text-9xl text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/40 italic flex items-center justify-center gap-2 sm:gap-4 mt-2">
                 Hidden
                 <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="inline-block"
                 >
                   <Fingerprint className="w-10 h-10 sm:w-16 sm:h-16 md:w-24 md:h-24 text-neon-green drop-shadow-[0_0_20px_rgba(57,255,20,0.6)]" />
                 </motion.span>
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-center text-sm sm:text-lg md:text-xl text-muted-foreground font-mono max-w-2xl lowercase tracking-wider leading-relaxed mb-10 border-l-2 border-white/10 pl-4">
              [ o cofre underground da elite. scripts lua ofuscados, 
              APKs modded e o mercado negro seguro que você procurava. ]
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button
                size="lg"
                className="h-14 sm:h-16 px-8 sm:px-10 bg-neon-green hover:bg-neon-green/90 text-black font-black uppercase tracking-widest text-xs sm:text-sm rounded-none border border-neon-green shadow-[0_0_20px_rgba(57,255,20,0.2)] hover:shadow-[0_0_30px_rgba(57,255,20,0.4)] transition-all flex group"
                onClick={() => navigate("/marketplace")}
              >
                <SearchCode className="mr-3 h-5 w-5 group-hover:scale-110 transition-transform" />
                Acessar o Vault
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 sm:h-16 px-8 sm:px-10 border-white/20 bg-transparent hover:bg-white/5 text-white font-black uppercase tracking-widest text-xs sm:text-sm rounded-none transition-all flex group"
                onClick={() => navigate("/auth")}
              >
                Desbloquear Acesso
                <ChevronRight className="ml-3 h-5 w-5 opacity-50 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
              </Button>
            </div>

            {/* Quick Stats Terminal */}
            <div className="w-full mt-16 sm:mt-24 border border-white/10 bg-[#050505]/80 backdrop-blur-md flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-white/10 p-1 font-mono">
              {[
                { label: "PAYLOADS", val: stats?.scripts ?? 0, color: "text-neon-purple" },
                { label: "OPERATIVES", val: stats?.users ?? 0, color: "text-neon-cyan" },
                { label: "EXFILTRATIONS", val: stats?.downloads ?? 0, color: "text-neon-green" }
              ].map((st) => (
                <div key={st.label} className="flex-1 flex items-center justify-between sm:justify-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                   <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{st.label}</span>
                   <span className={`text-xl sm:text-2xl font-black ${st.color}`}>{st.val.toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════ CORE CAPABILITIES (BENTO BOX) ══════════════ */}
      <section className="py-20 sm:py-32 bg-[#050505] relative border-t border-white/5">
        <div className="container px-4 sm:px-6">
          <div className="mb-12 sm:mb-20">
            <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tighter text-white">
              System <br className="hidden sm:block" />
              <span className="text-muted-foreground">Capabilities</span>
            </h2>
          </div>

          {/* Bento Box Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[250px] sm:auto-rows-[300px]">
             {/* Box 1 (Span 2 cols) */}
             <div className="md:col-span-2 relative rounded-xl border border-white/10 bg-gradient-to-br from-[#0a0a0c] to-[#050505] p-6 sm:p-10 overflow-hidden group">
               <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-neon-purple/5 blur-[80px] rounded-full group-hover:bg-neon-purple/10 transition-colors" />
               <ShieldCheck className="w-10 h-10 text-neon-purple mb-6" />
               <h3 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white mb-2 leading-none">Military Grade<br/>Obfuscation</h3>
               <p className="text-muted-foreground font-mono text-sm max-w-sm mt-4">
                 Sistemas impenetráveis. Transformamos código legível em ruído completo para proteger sua propriedade intelectual contra engenharia reversa.
               </p>
             </div>

             {/* Box 2 (1 col) */}
             <div className="md:col-span-1 relative rounded-xl border border-white/10 bg-gradient-to-br from-[#0a0a0c] to-[#050505] p-6 overflow-hidden group">
               <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-neon-green/5 blur-[60px] rounded-full group-hover:bg-neon-green/10 transition-colors" />
               <Key className="w-8 h-8 text-neon-green mb-4" />
               <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white mb-2 leading-none">Quantum Licenses</h3>
               <p className="text-muted-foreground font-mono text-xs mt-3">
                 Autenticação em milissegundos. Servidor blindado para gerenciar acessos ativos, banimentos e assinaturas dos seus usuários.
               </p>
               <div className="absolute bottom-6 right-6 opacity-20">
                 <ShieldCheck className="w-24 h-24" />
               </div>
             </div>

             {/* Box 3 (1 col) */}
             <div className="md:col-span-1 relative rounded-xl border border-white/10 bg-gradient-to-br from-[#0a0a0c] to-[#050505] p-6 overflow-hidden group">
               <div className="absolute -bottom-10 -left-10 w-[150px] h-[150px] bg-neon-cyan/5 blur-[50px] rounded-full group-hover:bg-neon-cyan/10 transition-colors" />
               <Activity className="w-8 h-8 text-neon-cyan mb-4" />
               <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white mb-2 leading-none">Zero Downtime</h3>
               <p className="text-muted-foreground font-mono text-xs mt-3">
                 Infraestrutura global robusta. Seus scripts e mods sempre disponíveis na velocidade da luz.
               </p>
             </div>

             {/* Box 4 (Span 2 cols) */}
             <div className="md:col-span-2 relative rounded-xl border border-white/10 bg-[#101014] p-6 sm:p-10 overflow-hidden group flex flex-col justify-end">
               <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10 mix-blend-overlay" />
               <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                 <div>
                    <Store className="w-10 h-10 text-white mb-6" />
                    <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mb-2 leading-none">Hidden Mod Marketplace</h3>
                    <p className="text-muted-foreground font-mono text-sm max-w-sm">Compre e venda seguro. O ponto de encontro oficial para modders sérios monetizarem sua arte.</p>
                 </div>
                 <Button onClick={() => navigate("/marketplace")} variant="outline" className="shrink-0 bg-transparent border-white/20 hover:bg-white hover:text-black hover:border-white uppercase font-black text-xs h-12 px-6 rounded-none">
                   Explorar Loja
                 </Button>
               </div>
             </div>
          </div>
        </div>
      </section>

      {/* ══════════════ RECENT BREACHES (MARKETPLACE PREVIEW) ══════════════ */}
      <section className="py-20 sm:py-32 bg-[#030304] border-t border-white/5">
        <div className="container px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-end justify-between mb-10 sm:mb-16 gap-4">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">
                Transmissões <span className="text-neon-cyan/80">Recentes</span>
              </h2>
              <p className="text-muted-foreground font-mono text-sm mt-2">Últimos payloads e scripts homologados no cofre.</p>
            </div>
            <Button variant="ghost" onClick={() => navigate("/marketplace")} className="text-muted-foreground hover:text-white uppercase font-bold text-xs">
              Ver todos os logs <ChevronRight className="ml-2 w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {scripts?.slice(0, 4).map((script: any, i: number) => (
              <motion.div
                key={script.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
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

      {/* ══════════════ SYNDICATE OPERATORS (HALL OF FAME) ══════════════ */}
      <section className="py-20 sm:py-32 bg-[#050505] relative border-t border-white/5 overflow-hidden">
        <div className="container px-4 sm:px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tighter text-white">
              Syndicate <span className="text-neon-purple/80">Operators</span>
            </h2>
            <p className="text-muted-foreground font-mono text-sm mt-2 uppercase tracking-widest">Os cérebros por trás do cofre.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {hallOfFameModders.slice(0, 4).map((profile: any, i: number) => {
              const roleKey = hallRolesMap[profile.user_id] || hallRolesMap[profile.id];
              const displayRole: "admin" | "modder" | "member" = roleKey === "admin" ? "admin" : "modder";
              
              return (
                <div 
                  key={profile.id} 
                  className="bg-[#08080a] border border-white/10 flex flex-col items-center p-6 sm:p-8 cursor-pointer hover:bg-[#0c0c0f] hover:border-white/20 transition-all font-mono group"
                  onClick={() => setSelectedModder(profile)}
                >
                  <div className="w-full flex justify-between items-center mb-6 opacity-50">
                     <span className="text-[9px] uppercase tracking-widest text-muted-foreground">ID_TAG</span>
                     <Fingerprint className="w-4 h-4 text-neon-purple" />
                  </div>
                  
                  <Avatar className="h-24 w-24 rounded-none border border-white/20 bg-black mb-6 grayscale group-hover:grayscale-0 transition-all">
                    <AvatarImage src={profile.avatar_url} />
                    <AvatarFallback className="bg-transparent text-white text-3xl font-black">
                      {(profile.display_name || profile.username || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <h3 className="font-black text-lg uppercase tracking-wider text-white mb-1">
                    {profile.display_name || profile.username || "Anonymous"}
                  </h3>
                  <p className="text-[10px] text-muted-foreground tracking-widest mb-4">
                     {profile.id.substring(0, 8).toUpperCase()}
                  </p>
                  
                  <div className="w-full h-[1px] bg-white/10 mb-4" />
                  
                  <div className="flex justify-between w-full items-center">
                    <RoleBadge role={displayRole} />
                    <div className="flex gap-1">
                       <UserBadges userId={profile.user_id} compact />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════ FINAL CTA ══════════════ */}
      <section className="py-24 sm:py-32 bg-[#0a0f0d] border-t border-neon-green/20 relative">
        <div className="container px-4 text-center max-w-3xl mx-auto relative z-10">
          <Network className="w-12 h-12 text-neon-green mx-auto mb-6 opacity-50" />
          <h2 className="text-4xl sm:text-6xl font-black uppercase tracking-tighter text-white mb-6">
            Initialize <span className="text-neon-green">Connection</span>
          </h2>
          <p className="text-muted-foreground font-mono text-sm sm:text-base mb-10 border-l-2 border-r-2 border-neon-green/30 inline-block px-6">
            Você leu o código. Viu do que somos capazes.
            Cadastre-se hoje e entre para o lado Hidden da força.
          </p>
          <div className="flex justify-center flex-col sm:flex-row gap-4">
             <Button size="lg" onClick={() => navigate("/auth?tab=signup")} className="h-14 px-10 bg-white text-black hover:bg-white/90 font-black uppercase tracking-widest rounded-none text-xs w-full sm:w-auto">
               Estabelecer Acesso
             </Button>
             <Button size="lg" onClick={() => navigate("/marketplace")} variant="outline" className="h-14 px-10 text-white border-white/20 hover:bg-white/5 font-black uppercase tracking-widest rounded-none text-xs w-full sm:w-auto">
               Explorar Arquivos
             </Button>
          </div>
        </div>
      </section>

      {/* ══════════════ MODDER DIALOG ══════════════ */}
      <Dialog open={!!selectedModder} onOpenChange={(open) => !open && setSelectedModder(null)}>
        <DialogContent className="max-w-md bg-[#050505] border-white/10 p-0 overflow-hidden font-mono text-white rounded-none">
          {selectedModder && (() => {
            const roleKey = hallRolesMap[selectedModder.user_id] || hallRolesMap[selectedModder.id];
            const displayRole: "admin" | "modder" | "member" = roleKey === "admin" ? "admin" : "modder";
            return (
              <div className="flex flex-col">
                <div className="h-2 w-full bg-neon-purple" />
                <div className="p-8 pb-4">
                  <div className="flex justify-between items-start mb-8">
                     <span className="text-[10px] text-muted-foreground tracking-widest uppercase opacity-50">Authorized Personnel Only</span>
                     <Fingerprint className="w-5 h-5 text-neon-purple" />
                  </div>
                  
                  <div className="flex gap-6 items-center mb-8">
                    <Avatar className="h-20 w-20 rounded-none border border-white/20 bg-black">
                      <AvatarImage src={selectedModder.avatar_url} />
                      <AvatarFallback className="bg-transparent text-white text-2xl font-black">
                        {(selectedModder.display_name || selectedModder.username || "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <h3 className="text-2xl font-black uppercase tracking-tight">{selectedModder.display_name || selectedModder.username}</h3>
                      <p className="text-xs text-muted-foreground uppercase opacity-70 mt-1 mb-2">ID: {selectedModder.id.substring(0, 12)}</p>
                      <RoleBadge role={displayRole} />
                    </div>
                  </div>

                  <div className="bg-[#0a0a0c] border border-white/5 p-4 mb-8">
                     <p className="text-xs text-muted-foreground leading-relaxed lowercase">
                       {selectedModder.bio ? `> ${selectedModder.bio}` : "> no public data available for this operative."}
                     </p>
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-b border-white/10 py-4 mb-8">
                    {[
                       { value: selectedModder.reputation_score ?? 0, label: "REP" },
                       { value: selectedModder.total_downloads ?? 0, label: "EXFIL" },
                       { value: selectedModder.total_positive_reviews ?? 0, label: "TRUST" },
                    ].map(st => (
                      <div key={st.label} className="text-center">
                        <p className="text-xl font-black text-white">{st.value}</p>
                        <p className="text-[9px] text-muted-foreground mt-1">{st.label}</p>
                      </div>
                    ))}
                  </div>

                  <Button
                    size="lg"
                    className="w-full h-12 bg-white text-black hover:bg-white/90 font-black uppercase tracking-widest text-xs rounded-none"
                    onClick={() => {
                      setSelectedModder(null);
                      navigate(`/modder/${selectedModder.user_id}`);
                    }}
                  >
                    Acessar Dossiê Completo
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
