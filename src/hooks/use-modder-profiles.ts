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
        .in("id", modderIds);
      const map: Record<string, any> = {};
      data?.forEach((p: any) => { map[p.id] = p; });
      return map;
    },
    enabled: modderIds.length > 0,
  });
}
