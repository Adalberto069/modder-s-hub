import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
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
      return (data ?? []).map((b: any) => ({
        ...b,
        application_count: b.bounty_applications?.length ?? 0,
      }));
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

  const filtered = bounties?.filter((b: any) =>
    !search || b.title.toLowerCase().includes(search.toLowerCase()) || b.description?.toLowerCase().includes(search.toLowerCase()) || b.game_name?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <Layout>
      {/* Hero */}
      <section className="relative border-b border-white/5 overflow-hidden bg-[#030304]">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(168,85,247,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-neon-purple/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-neon-cyan/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="container relative py-10 sm:py-16 md:py-24 px-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4 sm:mb-6">
              <div className="h-[1px] w-6 sm:w-8 bg-neon-purple/60" />
              <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.25em] sm:tracking-[0.3em] text-neon-purple/80">
                Sistema de Encomendas
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tighter text-white mb-3 sm:mb-4 leading-none">
              Bounty{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-cyan">
                Board
              </span>
            </h1>
            <p className="text-muted-foreground text-xs sm:text-base max-w-xl leading-relaxed font-mono">
              Precisa de um script custom? Poste uma encomenda e deixa os modders da comunidade fazerem por você.
            </p>

            <div className="flex items-center gap-3 sm:gap-4 mt-5 sm:mt-8 flex-wrap">
              {user && (
                <PostBountyDialog>
                  <button
                    id="post-bounty-btn"
                    className="flex items-center gap-2 bg-neon-purple hover:bg-neon-purple/90 text-white px-4 sm:px-6 py-2.5 sm:py-3 font-black uppercase tracking-widest text-[10px] sm:text-xs shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] w-full sm:w-auto justify-center"
                  >
                    <Target className="h-4 w-4" />
                    Postar Encomenda
                  </button>
                </PostBountyDialog>
              )}
              {isModder && (
                <span className="flex items-center gap-2 text-[10px] sm:text-xs text-neon-green font-mono border border-neon-green/20 px-3 sm:px-4 py-2.5 sm:py-3 bg-neon-green/5">
                  <Zap className="h-3 w-3 shrink-0" />
                  <span className="leading-tight">Você pode se candidatar às encomendas abertas</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-b border-white/5 bg-[#050505]">
        <div className="container">
          <div className="grid grid-cols-3 divide-x divide-white/5">
            <StatItem icon={<Target className="h-4 w-4" />} value={stats?.total ?? 0} label="Total" color="text-neon-purple" />
            <StatItem icon={<TrendingUp className="h-4 w-4" />} value={stats?.open ?? 0} label="Abertas" color="text-neon-green" />
            <StatItem icon={<Trophy className="h-4 w-4" />} value={stats?.completed ?? 0} label="Concluídas" color="text-neon-cyan" />
          </div>
        </div>
      </section>

      {/* Filters & List */}
      <section className="container py-5 sm:py-8 px-3 sm:px-6 space-y-5 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Status filters */}
          <div className="flex gap-1 p-1 bg-[#050505] border border-white/5 overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-1">
            {STATUS_FILTERS.map((f) => {
              if (f.value === "mine" && !user) return null;
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                    statusFilter === f.value
                      ? "bg-neon-purple text-white"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  {f.value === "mine" && <UserCheck className="h-3 w-3" />}
                  {f.label}
                </button>
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
              className="pl-9 h-10 bg-[#050505] border-white/10 focus-visible:ring-neon-purple rounded-none text-sm font-mono"
            />
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-none bg-white/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center space-y-4">
            <div className="h-16 w-16 mx-auto rounded-none bg-neon-purple/5 border border-neon-purple/10 flex items-center justify-center">
              <Target className="h-8 w-8 text-neon-purple/30" />
            </div>
            <p className="text-muted-foreground font-mono text-sm">
              {search ? "Nenhuma encomenda encontrada para essa busca." :
               statusFilter === "mine" ? "Você ainda não postou nenhuma encomenda." :
               "Nenhuma encomenda disponível no momento."}
            </p>
            {user && !search && statusFilter !== "mine" && (
              <PostBountyDialog>
                <button className="text-xs text-neon-purple underline underline-offset-4 font-mono">
                  Seja o primeiro a postar uma encomenda →
                </button>
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
    <div className="flex flex-col items-center py-4 sm:py-6 gap-1 sm:gap-1.5 hover:bg-white/[0.02] transition-colors px-2">
      <div className={`${color} mb-0.5 sm:mb-1`}>{icon}</div>
      <p className="text-lg sm:text-2xl font-black font-mono leading-none">{value}</p>
      <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold text-center leading-tight">{label}</p>
    </div>
  );
}
