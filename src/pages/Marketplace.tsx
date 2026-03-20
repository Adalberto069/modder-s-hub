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
import { Search, Code, Package, Store, SlidersHorizontal, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

function ScriptCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/5 bg-card/40 overflow-hidden animate-pulse">
      <div className="aspect-video bg-secondary/30" />
      <div className="p-3 sm:p-4 space-y-3">
        <div className="h-4 bg-secondary/40 rounded w-3/4" />
        <div className="h-3 bg-secondary/30 rounded w-1/2" />
        <div className="flex justify-between pt-2 border-t border-white/5">
          <div className="h-3 bg-secondary/20 rounded w-16" />
          <div className="h-3 bg-secondary/20 rounded w-12" />
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

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*");
      return data ?? [];
    },
  });

  const { data: scripts, isLoading } = useQuery({
    queryKey: ["scripts", activeCategory, priceFilter, search, activeTab],
    queryFn: async () => {
      let query = supabase
        .from("scripts")
        .select("*, categories(slug, name)")
        .eq("script_type", activeTab)
        .eq("is_verified", true)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (activeCategory !== "all") {
        const cat = categories?.find((c: any) => c.slug === activeCategory);
        if (cat) query = query.eq("category_id", cat.id);
      }

      if (priceFilter === "free") query = query.eq("is_paid", false);
      if (priceFilter === "paid") query = query.eq("is_paid", true);

      if (search) query = query.ilike("title", `%${search}%`);

      const { data } = await query;
      return data ?? [];
    },
    enabled: !!categories,
  });

  const modderIds = useMemo(() => {
    const ids = scripts?.map((s: any) => s.modder_id) ?? [];
    return [...new Set(ids)];
  }, [scripts]);

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

  const totalResults = scripts?.length ?? 0;

  return (
    <Layout>
      <div className="container py-6 sm:py-10 px-3 sm:px-6 max-w-7xl">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 sm:mb-10"
        >
          <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-card/80 via-card/40 to-transparent p-5 sm:p-8 mb-6 sm:mb-8">
            <div className="absolute top-0 right-0 w-72 h-72 bg-[hsl(var(--neon-purple)/0.08)] blur-[120px] -z-10" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[hsl(var(--neon-cyan)/0.05)] blur-[80px] -z-10" />

            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-primary/30 text-primary font-mono px-2.5 py-0.5 bg-primary/5 text-[10px] sm:text-xs">
                    <Store className="h-3 w-3 mr-1" /> Marketplace
                  </Badge>
                  <Badge variant="outline" className="border-accent/30 text-accent font-mono px-2.5 py-0.5 bg-accent/5 text-[10px] sm:text-xs">
                    <Sparkles className="h-3 w-3 mr-1" /> Elite
                  </Badge>
                </div>
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight">
                  Nexus <span className="text-primary">Market</span>
                </h1>
                <p className="text-muted-foreground/80 max-w-xl text-xs sm:text-base leading-relaxed">
                  Explore scripts de elite, ofuscados e verificados pela nossa comunidade.
                </p>
              </div>

              {/* Search */}
              <div className="relative w-full sm:max-w-xs md:max-w-sm group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  placeholder={activeTab === "script" ? "Buscar scripts..." : "Buscar APKs / Mods..."}
                  className="pl-10 bg-background/60 border-white/5 focus:border-primary/50 focus:ring-primary/20 transition-all duration-300 h-10 sm:h-11 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Tabs + Filters */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <Tabs value={activeTab} onValueChange={handleTabChange}>
                <TabsList className="bg-white/5 border border-white/5 p-1 h-auto w-full sm:w-fit">
                  <TabsTrigger value="script" className="gap-1.5 px-4 sm:px-6 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all flex-1 sm:flex-none text-xs sm:text-sm">
                    <Code className="h-3.5 w-3.5" /> Scripts
                  </TabsTrigger>
                  <TabsTrigger value="apk" className="gap-1.5 px-4 sm:px-6 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all flex-1 sm:flex-none text-xs sm:text-sm">
                    <Package className="h-3.5 w-3.5" /> APKs / Mods
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {!isLoading && (
                <p className="text-xs text-muted-foreground hidden sm:block">
                  <span className="font-bold text-foreground">{totalResults}</span> {totalResults === 1 ? "resultado" : "resultados"}
                </p>
              )}
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 bg-card/30 backdrop-blur-md border border-white/5 p-3 sm:p-4 rounded-xl">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0 hidden sm:block" />
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                  <Badge
                    variant={activeCategory === "all" ? "default" : "outline"}
                    className={`cursor-pointer whitespace-nowrap px-3 py-1 transition-all duration-200 text-[10px] sm:text-xs shrink-0 ${
                      activeCategory === "all" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "border-white/10 hover:border-primary/30 bg-white/5"
                    }`}
                    onClick={() => setFilter("category", "all")}
                  >
                    Todos
                  </Badge>
                  {categories?.map((cat: any) => (
                    <Badge
                      key={cat.id}
                      variant={activeCategory === cat.slug ? "default" : "outline"}
                      className={`cursor-pointer whitespace-nowrap px-3 py-1 transition-all duration-200 text-[10px] sm:text-xs shrink-0 ${
                        activeCategory === cat.slug ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "border-white/10 hover:border-primary/30 bg-white/5"
                      }`}
                      onClick={() => setFilter("category", cat.slug)}
                    >
                      {cat.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 border-t sm:border-t-0 sm:border-l border-white/5 pt-2 sm:pt-0 sm:pl-3">
                {[
                  { key: "all", label: "Todos", active: "bg-secondary text-secondary-foreground" },
                  { key: "free", label: "Grátis", active: "bg-accent/20 text-accent border-accent/30" },
                  { key: "paid", label: "Pago", active: "bg-[hsl(var(--neon-pink)/0.2)] text-[hsl(var(--neon-pink))] border-[hsl(var(--neon-pink)/0.3)]" },
                ].map((item) => (
                  <Badge
                    key={item.key}
                    variant={priceFilter === item.key ? "default" : "outline"}
                    className={`cursor-pointer px-3 py-1 transition-all text-[10px] sm:text-xs whitespace-nowrap ${
                      priceFilter === item.key ? item.active : "border-white/10 bg-white/5 text-muted-foreground"
                    }`}
                    onClick={() => setFilter("price", item.key)}
                  >
                    {item.label}
                  </Badge>
                ))}
              </div>
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
        ) : scripts && scripts.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5"
          >
            {scripts.map((script: any, index: number) => (
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
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="p-4 rounded-2xl bg-secondary/20 border border-white/5 mb-4">
              <Search className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {activeTab === "script" ? "Nenhum script encontrado" : "Nenhum APK/Mod encontrado"}
            </p>
            <p className="text-xs text-muted-foreground/60">Tente mudar os filtros ou buscar por outro termo.</p>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
