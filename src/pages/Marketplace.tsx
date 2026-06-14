import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ScriptCard } from "@/components/ScriptCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useModderProfiles } from "@/hooks/use-modder-profiles";
import { useFavorites } from "@/hooks/use-favorites";
import { useAuth } from "@/lib/auth";
import { Search, Code, Package, Store, SlidersHorizontal, Sparkles, ArrowDownAZ, TrendingUp, Star, Heart } from "lucide-react";
import { motion } from "framer-motion";

function ScriptCardSkeleton() {
  return (
    <div className="rounded-none border border-white/5 bg-[#050505] overflow-hidden animate-pulse">
      <div className="aspect-video bg-[#030304]" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-white/5 rounded-none w-3/4" />
        <div className="h-3 bg-white/5 rounded-none w-1/2" />
        <div className="flex justify-between pt-3 border-t border-white/5">
          <div className="h-3 bg-white/5 rounded-none w-16" />
          <div className="h-3 bg-white/5 rounded-none w-12" />
        </div>
      </div>
    </div>
  );
}

export default function Marketplace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const activeCategory = searchParams.get("category") ?? "all";
  const priceFilter = searchParams.get("price") ?? "all";
  const activeTab = searchParams.get("type") ?? "script";
  const sortBy = searchParams.get("sort") ?? "recent";
  const showFavs = searchParams.get("favs") === "1";
  const { user } = useAuth();
  const { favorites } = useFavorites();

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*");
      return data ?? [];
    },
  });

  const { data: scripts, isLoading } = useQuery({
    queryKey: ["scripts", activeCategory, priceFilter, search, activeTab, sortBy],
    queryFn: async () => {
      let query = supabase
        .from("scripts")
        .select("*, categories(slug, name)")
        .eq("script_type", activeTab)
        .eq("is_verified", true)
        .eq("is_active", true);

      if (activeCategory !== "all") {
        const cat = categories?.find((c: any) => c.slug === activeCategory);
        if (cat) query = query.eq("category_id", cat.id);
      }

      if (priceFilter === "free") query = query.eq("is_paid", false);
      if (priceFilter === "paid") query = query.eq("is_paid", true);

      if (search) query = query.ilike("title", `%${search}%`);

      // Sorting
      if (sortBy === "popular") query = query.order("download_count", { ascending: false });
      else if (sortBy === "rating") query = query.order("average_rating", { ascending: false });
      else query = query.order("created_at", { ascending: false });

      const { data } = await query;
      return data ?? [];
    },
    enabled: !!categories,
  });

  // Filter favorites client-side
  const displayScripts = useMemo(() => {
    if (!scripts) return [];
    if (showFavs && favorites.length > 0) {
      return scripts.filter((s: any) => favorites.includes(s.id));
    }
    return scripts;
  }, [scripts, showFavs, favorites]);

  const modderIds = useMemo(() => {
    const ids = displayScripts?.map((s: any) => s.modder_id) ?? [];
    return [...new Set(ids)];
  }, [displayScripts]);

  const { data: modderProfiles } = useModderProfiles(modderIds);

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") params.delete(key);
    else params.set(key, value);
    setSearchParams(params);
  };

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("type", value);
    setSearchParams(params);
  };

  const toggleFavs = () => {
    const params = new URLSearchParams(searchParams);
    if (showFavs) params.delete("favs");
    else params.set("favs", "1");
    setSearchParams(params);
  };

  const totalResults = displayScripts?.length ?? 0;

  return (
    <Layout>
      <div className="container py-6 sm:py-10 px-3 sm:px-6 max-w-7xl">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="relative overflow-hidden border border-white/10 bg-[#050505] p-5 sm:p-10 mb-6 sm:mb-8 rounded-none">
            <div className="absolute top-0 right-0 w-72 h-72 bg-neon-purple/5 blur-[100px] -z-10" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-neon-cyan/5 blur-[60px] -z-10" />

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 sm:gap-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 font-mono flex-wrap">
                  <Badge variant="outline" className="border-neon-purple/30 text-neon-purple px-2 py-0.5 bg-neon-purple/5 text-[9px] sm:text-[10px] uppercase tracking-widest rounded-none">
                    <Store className="h-3 w-3 mr-1" /> ROOT_MARKET
                  </Badge>
                  <Badge variant="outline" className="border-neon-cyan/30 text-neon-cyan px-2 py-0.5 bg-neon-cyan/5 text-[9px] sm:text-[10px] uppercase tracking-widest rounded-none">
                    <Sparkles className="h-3 w-3 mr-1" /> ELITE_TIER
                  </Badge>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">
                    Mercado <span className="text-neon-purple shadow-neon-purple">Negro</span>
                  </h1>
                  <p className="text-muted-foreground max-w-xl text-[11px] sm:text-sm leading-relaxed mt-2 font-mono uppercase tracking-widest">
                    Acesse o repositório central de payloads, scripts e vulnerabilidades. Transmissões seguras e verificadas.
                  </p>
                </div>
              </div>

              {/* Search */}
              <div className="relative w-full md:w-96 group shrink-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-neon-purple" />
                <Input
                  placeholder={activeTab === "script" ? ">_ BUSCAR SCRIPTS..." : ">_ BUSCAR APKS..."}
                  className="pl-12 bg-[#030304] border-white/10 focus-visible:ring-neon-purple rounded-none h-11 sm:h-14 text-neon-green font-mono uppercase tracking-widest text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Tabs + Filters */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/5 pb-4">
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full sm:w-auto">
                <TabsList className="bg-[#030304] border border-white/5 p-1 h-auto w-full rounded-none font-mono">
                  <TabsTrigger value="script" className="gap-2 px-6 py-2.5 data-[state=active]:bg-neon-purple data-[state=active]:text-white transition-all flex-1 rounded-none text-[10px] uppercase font-black tracking-widest data-[state=active]:shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                    <Code className="h-3.5 w-3.5" /> LUA_PAYLOADS
                  </TabsTrigger>
                  <TabsTrigger value="apk" className="gap-2 px-6 py-2.5 data-[state=active]:bg-neon-cyan data-[state=active]:text-[#050505] transition-all flex-1 rounded-none text-[10px] uppercase font-black tracking-widest data-[state=active]:shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                    <Package className="h-3.5 w-3.5" /> MOD_APKS
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-2">
                {!isLoading && (
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hidden sm:block">
                    <span className="font-black text-neon-green">[{totalResults}]</span> RECORDS
                  </p>
                )}
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col lg:flex-row gap-4 bg-[#050505] border border-white/5 p-4 rounded-none font-mono">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <SlidersHorizontal className="h-4 w-4 text-neon-purple shrink-0 hidden sm:block" />
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <Badge
                    variant="outline"
                    className={`cursor-pointer whitespace-nowrap px-4 py-1.5 transition-all duration-200 text-[9px] uppercase tracking-widest rounded-none shrink-0 ${
                      activeCategory === "all" ? "bg-neon-purple text-white border-neon-purple shadow-[0_0_10px_rgba(168,85,247,0.2)]" : "border-white/10 hover:border-white/30 bg-[#030304] text-muted-foreground hover:text-white"
                    }`}
                    onClick={() => setFilter("category", "all")}
                  >
                    --ALL_SYSTEMS--
                  </Badge>
                  {categories?.map((cat: any) => (
                    <Badge
                      key={cat.id}
                      variant="outline"
                      className={`cursor-pointer whitespace-nowrap px-4 py-1.5 transition-all duration-200 text-[9px] uppercase tracking-widest rounded-none shrink-0 ${
                         activeCategory === cat.slug ? "bg-neon-purple text-white border-neon-purple shadow-[0_0_10px_rgba(168,85,247,0.2)]" : "border-white/10 hover:border-white/30 bg-[#030304] text-muted-foreground hover:text-white"
                      }`}
                      onClick={() => setFilter("category", cat.slug)}
                    >
                      {cat.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 lg:border-l border-white/5 lg:pl-4 pt-4 lg:pt-0 border-t lg:border-t-0">
                {[
                  { key: "all", label: "TUDO", active: "bg-white/10 text-white border-white/20" },
                  { key: "free", label: "FREE", active: "bg-neon-green/10 text-neon-green border-neon-green/30" },
                  { key: "paid", label: "PAID", active: "bg-neon-pink/10 text-neon-pink border-neon-pink/30" },
                ].map((item) => (
                  <Badge
                    key={item.key}
                    variant="outline"
                    className={`cursor-pointer px-4 py-1.5 transition-all text-[9px] font-black uppercase tracking-widest whitespace-nowrap rounded-none ${
                       priceFilter === item.key ? item.active : "border-white/10 bg-[#030304] text-muted-foreground hover:bg-white/5"
                    }`}
                    onClick={() => setFilter("price", item.key)}
                  >
                    {item.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Sort + Favorites Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none font-mono">
              {[
                { key: "recent", label: "Recentes", icon: ArrowDownAZ },
                { key: "popular", label: "Popular", icon: TrendingUp },
                { key: "rating", label: "Avaliação", icon: Star },
              ].map((item) => (
                <Badge
                  key={item.key}
                  variant="outline"
                  className={`cursor-pointer px-3 py-1.5 transition-all text-[9px] font-black uppercase tracking-widest whitespace-nowrap rounded-none flex items-center gap-1.5 ${
                    sortBy === item.key ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30" : "border-white/10 bg-[#030304] text-muted-foreground hover:bg-white/5"
                  }`}
                  onClick={() => setFilter("sort", item.key)}
                >
                  <item.icon className="h-3 w-3" />
                  {item.label}
                </Badge>
              ))}

              {user && (
                <Badge
                  variant="outline"
                  className={`cursor-pointer px-3 py-1.5 transition-all text-[9px] font-black uppercase tracking-widest whitespace-nowrap rounded-none flex items-center gap-1.5 ml-auto ${
                    showFavs ? "bg-neon-pink/10 text-neon-pink border-neon-pink/30" : "border-white/10 bg-[#030304] text-muted-foreground hover:bg-white/5"
                  }`}
                  onClick={toggleFavs}
                >
                  <Heart className={`h-3 w-3 ${showFavs ? "fill-neon-pink" : ""}`} />
                  Favoritos {favorites.length > 0 && `(${favorites.length})`}
                </Badge>
              )}
            </div>
          </div>
        </motion.div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <ScriptCardSkeleton key={i} />
            ))}
          </div>
        ) : displayScripts && displayScripts.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5"
          >
            {displayScripts.map((script: any, index: number) => (
              <motion.div
                key={script.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.04 }}
              >
                <ScriptCard
                  id={script.id}
                  title={script.title}
                  modderName={modderProfiles?.[script.modder_id]?.display_name || modderProfiles?.[script.modder_id]?.username || "Modder"}
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
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center font-mono"
          >
            <div className="p-4 bg-[#030304] border border-white/5 mb-4 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
              {showFavs ? <Heart className="h-8 w-8 text-muted-foreground" /> : <Search className="h-8 w-8 text-muted-foreground" />}
            </div>
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-1">
              {showFavs ? "SYS: NENHUM FAVORITO ENCONTRADO" : activeTab === "script" ? "SYS_ERR: NO PAYLOAD FOUND" : "SYS_ERR: NO MOD FOUND"}
            </p>
            <p className="text-[9px] uppercase tracking-widest text-[#a855f7]">
              {showFavs ? "Adicione scripts aos favoritos clicando no ❤️" : "Verifique os parâmetros de busca e filtros ativos."}
            </p>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
