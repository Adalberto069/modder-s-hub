import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ScriptCard } from "@/components/ScriptCard";
import { Button } from "@/components/ui/button";
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
import { TerminalBackdrop } from "@/components/TerminalBackdrop";

function ScriptCardSkeleton() {
  return (
    <div className="rounded-none border border-border/5 bg-surface overflow-hidden animate-pulse">
      <div className="aspect-video bg-surface" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-foreground/5 rounded-none w-3/4" />
        <div className="h-3 bg-foreground/5 rounded-none w-1/2" />
        <div className="flex justify-between pt-3 border-t border-border/5">
          <div className="h-3 bg-foreground/5 rounded-none w-16" />
          <div className="h-3 bg-foreground/5 rounded-none w-12" />
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
          <div className="relative overflow-hidden border-b border-border pb-8 mb-6 signal-divider">
            <TerminalBackdrop className="catalog-terminal" />
            <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <p className="text-primary text-xs mb-3">HIDDENMOD / MARKETPLACE</p>
                <h1 data-text={activeTab === 'script' ? 'Repositório de Scripts.' : 'APKs de jogos.'} className="glitch text-3xl sm:text-5xl font-extrabold text-foreground">{activeTab === 'script' ? 'Repositório de Scripts' : 'APKs de jogos'}<span className="text-primary">.</span></h1>
                <p className="text-muted-foreground text-xs sm:text-sm mt-3">{activeTab === 'script' ? 'Lua no comando. Game Guardian em ação.' : 'Seu jogo. Outras possibilidades.'}</p>
              </div>
              <div className="relative w-full md:w-80 shrink-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                <Input aria-label={activeTab === 'script' ? 'Buscar scripts' : 'Buscar APKs'} placeholder={activeTab === 'script' ? 'Buscar scripts...' : 'Buscar APKs...'} className="pl-11 bg-surface border-border h-12 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Tabs + Filters */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/5 pb-4">
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full sm:w-auto">
                <TabsList className="bg-surface border border-border/5 p-1 h-auto w-full rounded-none font-mono">
                  <TabsTrigger value="script" className="gap-2 px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all flex-1 rounded-none text-[10px] uppercase font-black tracking-widest shadow-neon">
                    <Code className="h-3.5 w-3.5" /> Scripts Lua
                  </TabsTrigger>
                  <TabsTrigger value="apk" className="gap-2 px-6 py-2.5 data-[state=active]:bg-neon-cyan data-[state=active]:text-background transition-all flex-1 rounded-none text-[10px] uppercase font-black tracking-widest shadow-neon">
                    <Package className="h-3.5 w-3.5" /> APKs de jogos
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-2">
                {!isLoading && (
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hidden sm:block">
                    <span className="font-black text-neon-green">[{totalResults}]</span> resultados
                  </p>
                )}
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col lg:flex-row gap-4 bg-surface border border-border/5 p-4 rounded-none font-mono">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <SlidersHorizontal className="h-4 w-4 text-primary shrink-0 hidden sm:block" />
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <Button size="sm"
                    variant="outline"
                    className={`cursor-pointer whitespace-nowrap px-4 py-1.5 transition-all duration-200 text-[9px] uppercase tracking-widest rounded-none shrink-0 ${
                      activeCategory === "all" ? "bg-primary text-primary-foreground border-primary shadow-neon" : "border-border/10 hover:border-border/30 bg-surface text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setFilter("category", "all")}
                  >
                    Todas
                  </Button>
                  {categories?.map((cat: any) => (
                    <Button size="sm"
                      key={cat.id}
                      variant="outline"
                      className={`cursor-pointer whitespace-nowrap px-4 py-1.5 transition-all duration-200 text-[9px] uppercase tracking-widest rounded-none shrink-0 ${
                         activeCategory === cat.slug ? "bg-primary text-primary-foreground border-primary shadow-neon" : "border-border/10 hover:border-border/30 bg-surface text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setFilter("category", cat.slug)}
                    >
                      {cat.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 lg:border-l border-border/5 lg:pl-4 pt-4 lg:pt-0 border-t lg:border-t-0">
                {[
                  { key: "all", label: "TUDO", active: "bg-foreground/10 text-foreground border-border/20" },
                  { key: "free", label: "Grátis", active: "bg-neon-green/10 text-neon-green border-neon-green/30" },
                  { key: "paid", label: "Pagos", active: "bg-neon-pink/10 text-neon-pink border-neon-pink/30" },
                ].map((item) => (
                  <Button size="sm"
                    key={item.key}
                    variant="outline"
                    className={`cursor-pointer px-4 py-1.5 transition-all text-[9px] font-black uppercase tracking-widest whitespace-nowrap rounded-none ${
                       priceFilter === item.key ? item.active : "border-border/10 bg-surface text-muted-foreground hover:bg-foreground/5"
                    }`}
                    onClick={() => setFilter("price", item.key)}
                  >
                    {item.label}
                  </Button>
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
                <Button size="sm"
                  key={item.key}
                  variant="outline"
                  className={`cursor-pointer px-3 py-1.5 transition-all text-[9px] font-black uppercase tracking-widest whitespace-nowrap rounded-none flex items-center gap-1.5 ${
                    sortBy === item.key ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30" : "border-border/10 bg-surface text-muted-foreground hover:bg-foreground/5"
                  }`}
                  onClick={() => setFilter("sort", item.key)}
                >
                  <item.icon className="h-3 w-3" />
                  {item.label}
                </Button>
              ))}

              {user && (
                <Button size="sm"
                  variant="outline"
                  className={`cursor-pointer px-3 py-1.5 transition-all text-[9px] font-black uppercase tracking-widest whitespace-nowrap rounded-none flex items-center gap-1.5 ml-auto ${
                    showFavs ? "bg-neon-pink/10 text-neon-pink border-neon-pink/30" : "border-border/10 bg-surface text-muted-foreground hover:bg-foreground/5"
                  }`}
                  onClick={toggleFavs}
                >
                  <Heart className={`h-3 w-3 ${showFavs ? "fill-neon-pink" : ""}`} />
                  Favoritos {favorites.length > 0 && `(${favorites.length})`}
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Grid */}
        {isLoading ? (
          <div className="catalog-bento">
            {Array.from({ length: 8 }).map((_, i) => (
              <ScriptCardSkeleton key={i} />
            ))}
          </div>
        ) : displayScripts && displayScripts.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="catalog-bento"
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
                  scriptType={script.script_type}
                  apkVersion={script.apk_version}
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
            <div className="p-4 bg-surface border border-border/5 mb-4 shadow-neon">
              {showFavs ? <Heart className="h-8 w-8 text-muted-foreground" /> : <Search className="h-8 w-8 text-muted-foreground" />}
            </div>
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-1">
              {showFavs ? "Nenhum favorito encontrado" : activeTab === "script" ? "Nenhum script encontrado" : "Nenhum APK encontrado"}
            </p>
            <p className="text-[9px] uppercase tracking-widest text-primary">
              {showFavs ? "Adicione scripts aos favoritos clicando no ❤️" : "Verifique os parâmetros de busca e filtros ativos."}
            </p>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
