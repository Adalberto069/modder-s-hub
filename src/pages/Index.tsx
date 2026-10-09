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
import hubImage from "@/assets/hiddenmod-gaming-hub.jpg";
import { TerminalBackdrop } from "@/components/TerminalBackdrop";
import { MarqueeTicker } from "@/components/MarqueeTicker";
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
        .select("id, user_id, username, display_name, avatar_url, bio, reputation_score, total_downloads, total_positive_reviews, created_at, updated_at")
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
      <section className="relative overflow-hidden border-b border-border bg-background signal-divider">
        <img src={hubImage} alt="Console de jogos com iluminação verde e ciano" width={1920} height={1024} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-right" />
        <div className="absolute inset-0 hero-shade" />
        <TerminalBackdrop />
        <div className="container relative py-12 sm:py-16 lg:py-20">
          <div className="max-w-xl">
            <p className="flex flex-wrap items-center gap-3 text-xs text-primary mb-5"><span className="h-px w-8 bg-primary" /> HIDDENMOD / MODDING UNDERGROUND</p>
            <div aria-hidden="true" className="mb-4 flex items-center gap-3 text-neon-cyan"><span className="font-handwritten text-lg -rotate-3"><span className="text-muted-foreground line-through decoration-primary">padrão</span> não. elite.</span><span className="handwritten-arrow" /></div>
            <h1 data-text="HiddenMod." className="glitch text-5xl sm:text-7xl font-extrabold leading-none text-foreground mb-5">Hidden<span className="text-primary">Mod</span><span className="text-primary">.</span></h1>
            <p className="font-display text-xl sm:text-2xl font-semibold text-foreground mb-4">Menos limites. Mais controle.</p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md mb-6">Scripts Lua para Game Guardian. APKs de jogos modificados. Feitos por quem não joga no padrão.</p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="h-12" onClick={() => navigate('/marketplace')}>Abrir repositório <ChevronRight /></Button>
              <Button size="lg" variant="outline" className="h-12 bg-glass/60" onClick={() => navigate('/marketplace?type=apk')}>APKs de jogos <Code /></Button>
            </div>
            <p aria-hidden="true" className="mt-4 text-[10px] text-muted-foreground">[LUA / ANDROID] <span className="text-primary">// além do padrão</span></p>
          </div>
          <div className="flex flex-wrap gap-6 sm:gap-10 mt-10 pt-5 border-t border-foreground/10 max-w-xl">
            {[
              { label: 'Publicações', value: stats?.scripts ?? 0 },
              { label: 'Membros', value: stats?.users ?? 0 },
              { label: 'Downloads', value: stats?.downloads ?? 0 },
            ].map(item => <div key={item.label}><p className="font-display font-bold text-xl text-foreground">{item.value.toLocaleString('pt-BR')}</p><p className="text-[10px] text-muted-foreground mt-1 uppercase">{item.label}</p></div>)}
          </div>
        </div>
      </section>
      <MarqueeTicker />

      {/* ══════════════ RECENT BREACHES (MARKETPLACE PREVIEW) ══════════════ */}
      <section className="relative overflow-hidden py-10 sm:py-16 bg-background border-t border-border signal-divider">
        <TerminalBackdrop className="catalog-terminal" />
        <div className="container relative px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-end justify-between mb-7 sm:mb-9 gap-4">
            <div>
              <h2 data-text="Repositório em destaque" className="glitch text-3xl sm:text-4xl font-black uppercase tracking-normal text-foreground">
                Repositório <span className="text-primary">em destaque</span>
              </h2>
              <p className="text-muted-foreground font-mono text-sm mt-2">O código é deles. O próximo movimento é seu.</p>
            </div>
            <Button variant="ghost" onClick={() => navigate("/marketplace")} className="text-muted-foreground hover:text-foreground uppercase font-bold text-xs">
              ver tudo <ChevronRight className="ml-2 w-4 h-4" />
            </Button>
          </div>

          <div className="catalog-bento">
            {scripts?.slice(0, 6).map((script: any, i: number) => (
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
                  scriptType={script.script_type}
                  apkVersion={script.apk_version}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ TOP MODDERS (COMPACT ROW) ══════════════ */}
      <section className="py-12 sm:py-16 bg-surface border-t border-foreground/5">
        <div className="container px-4 sm:px-6">
          <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-[1px] w-6 bg-primary/60" />
                <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-primary/80">Ranking</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-normal text-foreground">
                Top <span className="text-primary/80">modders</span>
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/marketplace?tab=modders")}
              className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary"
            >
              ver todos →
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {hallOfFameModders.slice(0, 3).map((profile: any, i: number) => {
              const roleKey = hallRolesMap[profile.user_id] || hallRolesMap[profile.id];
              const displayRole: "admin" | "modder" | "member" = roleKey === "admin" ? "admin" : "modder";
              return (
                <Button variant="ghost"
                  key={profile.id}
                  onClick={() => setSelectedModder(profile)}
                  className="flex items-center gap-3 h-auto whitespace-normal justify-start p-3 bg-surface border border-foreground/10 hover:border-primary/40 hover:bg-surface transition-all text-left group"
                >
                  <span className="text-[10px] font-mono text-primary/60 font-black w-4 shrink-0">#{i + 1}</span>
                  <Avatar className="h-10 w-10 rounded-none border border-foreground/10 bg-background shrink-0">
                    <AvatarImage src={profile.avatar_url} />
                    <AvatarFallback className="bg-transparent text-foreground text-sm font-black">
                      {(profile.display_name || profile.username || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm uppercase tracking-normal text-foreground truncate group-hover:text-primary transition-colors">
                      {profile.display_name || profile.username || "Anonymous"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <RoleBadge role={displayRole} />
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      </section>


      {/* ══════════════ FINAL CTA ══════════════ */}
      <section className="py-12 sm:py-16 bg-surface border-t border-neon-green/20 relative">
        <div className="container px-4 text-center max-w-3xl mx-auto relative z-10">
          <Network className="w-12 h-12 text-neon-green mx-auto mb-6 opacity-50" />
          <h2 className="text-4xl sm:text-6xl font-black uppercase tracking-normal text-foreground mb-6">
            {user ? <>bora <span className="text-neon-green">operar</span></> : <>entra na <span className="text-neon-green">rede</span></>}
          </h2>
          <p className="text-muted-foreground font-mono text-sm sm:text-base mb-10 border-l-2 border-r-2 border-neon-green/30 inline-block px-6">
            {user
              ? "explore o marketplace, poste encomendas ou publique um novo mod."
              : "cadastro grátis. compre scripts, peça encomendas ou aplique como modder e comece a vender hoje."}
          </p>
          <div className="flex justify-center flex-col sm:flex-row gap-4">
             {!user && (
               <Button size="lg" onClick={() => navigate("/auth?tab=signup")} className="h-14 px-10 bg-foreground text-background hover:bg-foreground/90 font-black uppercase tracking-widest rounded-none text-xs w-full sm:w-auto">
                 criar conta
               </Button>
             )}
             {user && (
               <Button size="lg" onClick={() => navigate("/bounties")} className="h-14 px-10 bg-neon-green text-background hover:bg-neon-green/90 font-black uppercase tracking-widest rounded-none text-xs w-full sm:w-auto">
                 ver encomendas
               </Button>
             )}
             <Button size="lg" onClick={() => navigate("/marketplace")} variant="outline" className="h-14 px-10 text-foreground border-foreground/20 hover:bg-foreground/5 font-black uppercase tracking-widest rounded-none text-xs w-full sm:w-auto">
               ver marketplace
             </Button>
          </div>

        </div>
      </section>

      {/* ══════════════ MODDER DIALOG ══════════════ */}
      <Dialog open={!!selectedModder} onOpenChange={(open) => !open && setSelectedModder(null)}>
        <DialogContent className="max-w-md bg-surface border-foreground/10 p-0 overflow-hidden font-mono text-foreground rounded-none">
          {selectedModder && (() => {
            const roleKey = hallRolesMap[selectedModder.user_id] || hallRolesMap[selectedModder.id];
            const displayRole: "admin" | "modder" | "member" = roleKey === "admin" ? "admin" : "modder";
            return (
              <div className="flex flex-col">
                <div className="h-2 w-full bg-primary" />
                <div className="p-8 pb-4">
                  <div className="flex justify-between items-start mb-8">
                     <span className="text-[10px] text-muted-foreground tracking-widest uppercase opacity-50">Authorized Personnel Only</span>
                     <Fingerprint className="w-5 h-5 text-primary" />
                  </div>
                  
                  <div className="flex gap-6 items-center mb-8">
                    <Avatar className="h-20 w-20 rounded-none border border-foreground/20 bg-background">
                      <AvatarImage src={selectedModder.avatar_url} />
                      <AvatarFallback className="bg-transparent text-foreground text-2xl font-black">
                        {(selectedModder.display_name || selectedModder.username || "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <h3 className="text-2xl font-black uppercase tracking-normal">{selectedModder.display_name || selectedModder.username}</h3>
                      <p className="text-xs text-muted-foreground uppercase opacity-70 mt-1 mb-2">ID: {selectedModder.id.substring(0, 12)}</p>
                      <RoleBadge role={displayRole} />
                    </div>
                  </div>

                  <div className="bg-surface border border-foreground/5 p-4 mb-8">
                     <p className="text-xs text-muted-foreground leading-relaxed lowercase">
                       {selectedModder.bio ? `> ${selectedModder.bio}` : "> no public data available for this operative."}
                     </p>
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-border/10 border-t border-b border-foreground/10 py-4 mb-8">
                    {[
                       { value: selectedModder.reputation_score ?? 0, label: "REP" },
                       { value: selectedModder.total_downloads ?? 0, label: "EXFIL" },
                       { value: selectedModder.total_positive_reviews ?? 0, label: "TRUST" },
                    ].map(st => (
                      <div key={st.label} className="text-center">
                        <p className="text-xl font-black text-foreground">{st.value}</p>
                        <p className="text-[9px] text-muted-foreground mt-1">{st.label}</p>
                      </div>
                    ))}
                  </div>

                  <Button
                    size="lg"
                    className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 font-black uppercase tracking-widest text-xs rounded-none"
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
