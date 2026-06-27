import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export function useFavorites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: favorites = [] } = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("script_favorites")
        .select("script_id")
        .eq("user_id", user.id);
      return data?.map((f: any) => f.script_id) ?? [];
    },
    enabled: !!user,
  });

  const toggleFavorite = useMutation({
    mutationFn: async (scriptId: string) => {
      if (!user) throw new Error("Login necessário");
      
      const isFav = favorites.includes(scriptId);
      if (isFav) {
        await supabase
          .from("script_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("script_id", scriptId);
      } else {
        await supabase
          .from("script_favorites")
          .insert({ user_id: user.id, script_id: scriptId });
      }
      return !isFav;
    },
    onSuccess: (added) => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      toast.success(added ? "Adicionado aos favoritos!" : "Removido dos favoritos");
    },
    onError: () => {
      toast.error("Faça login para favoritar scripts");
    },
  });

  const isFavorite = (scriptId: string) => favorites.includes(scriptId);

  return { favorites, toggleFavorite, isFavorite };
}
