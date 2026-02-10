import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ScriptCard } from "@/components/ScriptCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Search, Code, Shield, Monitor, Package } from "lucide-react";

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

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*");
      return data ?? [];
    },
  });

  const { data: scripts, isLoading } = useQuery({
    queryKey: ["scripts", activeCategory, priceFilter, search],
    queryFn: async () => {
      let query = supabase
        .from("scripts")
        .select("*, categories(slug, name)")
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

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") params.delete(key);
    else params.set(key, value);
    setSearchParams(params);
  };

  return (
    <Layout>
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6">Marketplace</h1>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar scripts..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Badge
            variant={activeCategory === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilter("category", "all")}
          >
            Todos
          </Badge>
          {categories?.map((cat: any) => (
            <Badge
              key={cat.id}
              variant={activeCategory === cat.slug ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilter("category", cat.slug)}
            >
              {cat.name}
            </Badge>
          ))}
          <div className="w-px bg-border mx-2" />
          <Badge
            variant={priceFilter === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilter("price", "all")}
          >
            Todos
          </Badge>
          <Badge
            variant={priceFilter === "free" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilter("price", "free")}
          >
            Grátis
          </Badge>
          <Badge
            variant={priceFilter === "paid" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilter("price", "paid")}
          >
            Pago
          </Badge>
        </div>

        {/* Grid */}
        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {scripts?.map((script: any) => (
              <ScriptCard
                key={script.id}
                id={script.id}
                title={script.title}
                modderName={"Modder"}
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
              <p className="text-muted-foreground col-span-full text-center py-12">Nenhum script encontrado.</p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
