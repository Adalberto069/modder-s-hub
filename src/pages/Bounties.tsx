import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { PageHeader } from "@/components/layout/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BountyCard } from "@/components/bounties/BountyCard";
import { PostBountyDialog } from "@/components/bounties/PostBountyDialog";
import { useAuth } from "@/lib/auth";
import { Target, Search, Trophy, TrendingUp, Zap, UserCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "open", label: "Abertas" },
  { value: "in_progress", label: "Em Andamento" },
  { value: "completed", label: "Concluídas" },
  { value: "mine", label: "Minhas" },
];

export default function Bounties() {
  const { user, isModder } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [typeFilter, setTypeFilter] = useState<"all" | "script" | "apk">("all");

  const { data: bounties, isLoading } = useQuery({
    queryKey: ["bounties", statusFilter, user?.id],
    queryFn: async () => {
      let query = (supabase as any)
        .from("bounties")
        .select(`
          *,
          profiles:requester_id(username, display_name, user_id),
          categories(name, icon),
          bounty_applications(id)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter === "mine" && user) {
        query = query.eq("requester_id", user.id);
      } else if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data } = await query;
      return (data ?? []).map((b: any) => {
        const t = (b.title ?? "").toUpperCase();
        const delivery_type: "apk" | "script" = t.startsWith("[APK") ? "apk" : "script";
        return {
          ...b,
          application_count: b.bounty_applications?.length ?? 0,
          delivery_type,
        };
      });
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["bounties-stats"],
    queryFn: async () => {
      const { count: total } = await (supabase as any).from("bounties").select("*", { count: "exact", head: true });
      const { count: open } = await (supabase as any).from("bounties").select("*", { count: "exact", head: true }).eq("status", "open");
      const { count: completed } = await (supabase as any).from("bounties").select("*", { count: "exact", head: true }).eq("status", "completed");
      return { total: total ?? 0, open: open ?? 0, completed: completed ?? 0 };
    },
  });

  const filtered = bounties?.filter((b: any) => {
    if (typeFilter !== "all" && b.delivery_type !== typeFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return b.title.toLowerCase().includes(q) || b.description?.toLowerCase().includes(q) || b.game_name?.toLowerCase().includes(q);
  }) ?? [];

  const scriptCount = bounties?.filter((b: any) => b.delivery_type === "script").length ?? 0;
  const apkCount = bounties?.filter((b: any) => b.delivery_type === "apk").length ?? 0;


  return (
    <Layout>
      {/* Hero */}
      <section className="relative border-b border-border/60 overflow-hidden bg-background">
        <div className="container relative py-8 sm:py-12 px-4">
          <div className="max-w-none">
            <PageHeader eyebrow="HIDDENMOD / ENCOMENDAS" title={<>Seu próximo <span className="text-primary">projeto.</span></>} description="Encomende um script Lua ou um APK de jogo aos modders da comunidade." />

            <div className="flex items-center gap-3 sm:gap-4 mt-5 sm:mt-8 flex-wrap">
              {user && (
                <PostBountyDialog>
                  <Button variant="ghost"
                    id="post-bounty-btn"
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 sm:px-6 py-2.5 sm:py-3 font-bold   text-xs sm:text-xs shadow-neon transition-all duration-300 hover:shadow-neon w-full sm:w-auto justify-center"
                  >
                    <Target className="h-4 w-4" />
                    Postar Encomenda
                  </Button>
                </PostBountyDialog>
              )}
              {isModder && (
                <span className="flex items-center gap-2 text-xs sm:text-xs text-neon-green font-sans border border-neon-green/20 px-3 sm:px-4 py-2.5 sm:py-3 bg-neon-green/5">
                  <Zap className="h-3 w-3 shrink-0" />
                  <span className="leading-tight">Você pode se candidatar às encomendas abertas</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-b border-border/60 bg-card">
        <div className="container">
          <div className="grid grid-cols-3 divide-x divide-border/5">
            <StatItem icon={<Target className="h-4 w-4" />} value={stats?.total ?? 0} label="Total" color="text-neon-purple" />
            <StatItem icon={<TrendingUp className="h-4 w-4" />} value={stats?.open ?? 0} label="Abertas" color="text-neon-green" />
            <StatItem icon={<Trophy className="h-4 w-4" />} value={stats?.completed ?? 0} label="Concluídas" color="text-neon-cyan" />
          </div>
        </div>
      </section>

      {/* Filters & List */}
      <section className="container py-5 sm:py-8 px-3 sm:px-6 space-y-5 sm:space-y-6">
        {/* Type chips (Script vs APK) */}
        <div className="flex gap-1 p-1 bg-card border border-border/60 overflow-x-auto scrollbar-none">
          {[
            { v: "all", label: `Tudo (${(scriptCount + apkCount) || 0})` },
            { v: "script", label: `Scripts .lua (${scriptCount})` },
            { v: "apk", label: `APK Mods (${apkCount})` },
          ].map((f) => (
            <Button variant="ghost"
              key={f.v}
              onClick={() => setTypeFilter(f.v as any)}
              className={`px-3 py-1.5 text-xs font-bold   transition-colors whitespace-nowrap ${
                typeFilter === f.v
                  ? f.v === "apk"
                    ? "bg-neon-green text-primary-foreground"
                    : f.v === "script"
                      ? "bg-neon-cyan text-primary-foreground"
                      : "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Status filters */}
          <div className="flex gap-1 p-1 bg-card border border-border/60 overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-1">
            {STATUS_FILTERS.map((f) => {
              if (f.value === "mine" && !user) return null;
              return (
                <Button variant="ghost"
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 text-xs font-bold   transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                    statusFilter === f.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.value === "mine" && <UserCheck className="h-3 w-3" />}
                  {f.label}
                </Button>
              );
            })}
          </div>


          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="bounty-search"
              placeholder="Buscar encomendas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-card border-border focus-visible:ring-neon-purple rounded-md text-sm font-sans"
            />
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-md bg-foreground/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center space-y-4">
            <div className="h-16 w-16 mx-auto rounded-md bg-neon-purple/5 border border-neon-purple/10 flex items-center justify-center">
              <Target className="h-8 w-8 text-neon-purple/30" />
            </div>
            <p className="text-muted-foreground font-sans text-sm">
              {search ? "Nenhuma encomenda encontrada para essa busca." :
               statusFilter === "mine" ? "Você ainda não postou nenhuma encomenda." :
               "Nenhuma encomenda disponível no momento."}
            </p>
            {user && !search && statusFilter !== "mine" && (
              <PostBountyDialog>
                <Button variant="ghost" className="text-xs text-neon-purple underline underline-offset-4 font-sans">
                  Seja o primeiro a postar uma encomenda →
                </Button>
              </PostBountyDialog>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((bounty: any) => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}

function StatItem({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center py-4 sm:py-6 gap-1 sm:gap-1.5 hover:bg-foreground/[0.02] transition-colors px-2">
      <div className={`${color} mb-0.5 sm:mb-1`}>{icon}</div>
      <p className="text-lg sm:text-2xl font-bold font-sans leading-none">{value}</p>
      <p className="text-xs sm:text-xs   text-muted-foreground/70 font-bold text-center leading-tight">{label}</p>
    </div>
  );
}
