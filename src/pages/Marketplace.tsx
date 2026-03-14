import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ScriptCard } from "@/components/ScriptCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useModderProfiles } from "@/hooks/use-modder-profiles";
import { Search, Code, Shield, Monitor, Package, Store } from "lucide-react";


const categoryIcons: Record<string, any> = {
  root: Shield,
  virtualizado: Monitor,
  "scripts-lua": Code,
  "apks-mod": Package,
};

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

  return (
    <Layout>
      <div className="container py-10 px-4 sm:px-6 max-w-7xl">
        {/* Header Section */}
        <div className="mb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div className="space-y-2">
              <Badge variant="outline" className="border-neon-purple/30 text-neon-purple font-mono mb-2 px-3 py-1 bg-neon-purple/5">
                <Store className="h-3 w-3 mr-1.5" /> Marketplace Elite
              </Badge>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                Nexus <span className="text-neon-purple">Market</span>
              </h1>
              <p className="text-muted-foreground/80 max-w-xl text-sm sm:text-base leading-relaxed">
                Explore scripts de elite, ofuscados e verificados pela nossa comunidade. 
                Segurança máxima para seus moddings favoritos.
              </p>
            </div>
            
            {/* Search */}
            <div className="relative w-full md:max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-neon-purple" />
              <Input
                placeholder={activeTab === "script" ? "Buscar scripts premium..." : "Buscar APKs / Mods..."}
                className="pl-10 bg-background/50 border-white/5 focus:border-neon-purple/50 focus:ring-neon-purple/20 transition-all duration-300 h-12 text-base"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="absolute inset-0 rounded-md bg-neon-purple/5 opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-sm pointer-events-none" />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-8">
            <TabsList className="bg-white/5 border border-white/5 p-1 h-auto w-fit">
              <TabsTrigger value="script" className="gap-2 px-6 py-2.5 data-[state=active]:bg-neon-purple data-[state=active]:text-white transition-all">
                <Code className="h-4 w-4" /> Scripts
              </TabsTrigger>
              <TabsTrigger value="apk" className="gap-2 px-6 py-2.5 data-[state=active]:bg-neon-purple data-[state=active]:text-white transition-all">
                <Package className="h-4 w-4" /> APKs / Mods
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-card/30 backdrop-blur-md border border-white/5 p-4 rounded-xl shadow-xl">
            <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mr-2">Categorias:</div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none w-full sm:w-auto">
              <Badge
                variant={activeCategory === "all" ? "default" : "outline"}
                className={`cursor-pointer whitespace-nowrap px-4 py-1.5 transition-all duration-300 ${
                  activeCategory === "all" ? "bg-neon-purple hover:bg-neon-purple/90" : "border-white/10 hover:border-neon-purple/30 bg-white/5"
                }`}
                onClick={() => setFilter("category", "all")}
              >
                Todos
              </Badge>
              {categories?.map((cat: any) => (
                <Badge
                  key={cat.id}
                  variant={activeCategory === cat.slug ? "default" : "outline"}
                  className={`cursor-pointer whitespace-nowrap px-4 py-1.5 transition-all duration-300 ${
                    activeCategory === cat.slug ? "bg-neon-purple hover:bg-neon-purple/90" : "border-white/10 hover:border-neon-purple/30 bg-white/5"
                  }`}
                  onClick={() => setFilter("category", cat.slug)}
                >
                  {cat.name}
                </Badge>
              ))}
            </div>
            
            <div className="hidden sm:block w-px h-6 bg-white/10 mx-2" />
            
            <div className="flex items-center gap-2">
              <Badge
                variant={priceFilter === "all" ? "default" : "outline"}
                className={`cursor-pointer px-3 py-1 transition-all ${
                  priceFilter === "all" ? "bg-secondary text-secondary-foreground" : "border-white/10 bg-white/5 text-muted-foreground"
                }`}
                onClick={() => setFilter("price", "all")}
              >
                Preço: Todos
              </Badge>
              <Badge
                variant={priceFilter === "free" ? "default" : "outline"}
                className={`cursor-pointer px-3 py-1 transition-all ${
                  priceFilter === "free" ? "bg-neon-green/20 text-neon-green border-neon-green/30" : "border-white/10 bg-white/5 text-muted-foreground"
                }`}
                onClick={() => setFilter("price", "free")}
              >
                Grátis
              </Badge>
              <Badge
                variant={priceFilter === "paid" ? "default" : "outline"}
                className={`cursor-pointer px-3 py-1 transition-all ${
                  priceFilter === "paid" ? "bg-neon-pink/20 text-neon-pink border-neon-pink/30" : "border-white/10 bg-white/5 text-muted-foreground"
                }`}
                onClick={() => setFilter("price", "paid")}
              >
                Pago
              </Badge>
            </div>
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {scripts?.map((script: any) => (
              <ScriptCard
                key={script.id}
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
            ))}
            {scripts?.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-12">
                {activeTab === "script" ? "Nenhum script encontrado." : "Nenhum APK/Mod encontrado."}
              </p>
            )}
          </div>
        )}
      </div>
      
    </Layout>
  );
}
