import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useModderProfiles(modderIds: string[]) {
  return useQuery({
    queryKey: ["modder-profiles", modderIds],
    queryFn: async () => {
      if (modderIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .or(`id.in.(${modderIds.join(",")}),user_id.in.(${modderIds.join(",")})`);
      const map: Record<string, any> = {};
      data?.forEach((p: any) => { 
        map[p.id] = p; 
        map[p.user_id] = p; // Map by both to be extremely safe
      });
      return map;
    },
    enabled: modderIds.length > 0,
  });
}
