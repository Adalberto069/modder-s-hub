import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Play, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

const categoryLabels: Record<string, string> = {
  geral: "Geral",
  "scripts-lua": "Scripts Lua",
  root: "Root",
  virtualizado: "Virtualizado",
  iniciante: "Iniciante",
};

export default function Tutorials() {
  const [activeCategory, setActiveCategory] = useState("all");

  const { data: tutorials, isLoading } = useQuery({
    queryKey: ["tutorials"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tutorials")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const categories = [...new Set((tutorials ?? []).map((t: any) => t.category))];
  const filtered = activeCategory === "all"
    ? tutorials
    : tutorials?.filter((t: any) => t.category === activeCategory);

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="h-7 w-7 text-neon-cyan" />
          <h1 className="text-3xl font-bold">Tutoriais</h1>
        </div>

        <p className="text-muted-foreground mb-6 max-w-xl">
          Aprenda a usar scripts, configurar seu dispositivo e tirar o máximo proveito da plataforma.
        </p>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Badge
            variant={activeCategory === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setActiveCategory("all")}
          >
            Todos
          </Badge>
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setActiveCategory(cat)}
            >
              {categoryLabels[cat] ?? cat}
            </Badge>
          ))}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered?.map((tutorial: any, i: number) => (
              <motion.div
                key={tutorial.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="group overflow-hidden neon-border hover:neon-glow-purple transition-all duration-300 bg-card/80 backdrop-blur-sm h-full">
                  {/* Thumbnail */}
                  <div className="aspect-video bg-secondary/50 flex items-center justify-center overflow-hidden relative">
                    {tutorial.thumbnail_url ? (
                      <img src={tutorial.thumbnail_url} alt={tutorial.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <BookOpen className="h-12 w-12 text-muted-foreground/30" />
                    )}
                    {tutorial.video_url && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-background/70 rounded-full p-3">
                          <Play className="h-6 w-6 text-neon-pink" />
                        </div>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {categoryLabels[tutorial.category] ?? tutorial.category}
                    </Badge>
                    <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                      {tutorial.title}
                    </h3>
                    {tutorial.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{tutorial.description}</p>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1">
                      <Clock className="h-3 w-3" />
                      {new Date(tutorial.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {(filtered?.length ?? 0) === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-12">
                Nenhum tutorial disponível ainda. Em breve!
              </p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
