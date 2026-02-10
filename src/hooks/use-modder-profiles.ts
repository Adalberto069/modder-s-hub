import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useModderProfiles(modderIds: string[]) {
  return useQuery({
    queryKey: ["modder-profiles", modderIds],
    queryFn: async () => {
      if (modderIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", modderIds);
      const map: Record<string, { username: string; display_name: string | null }> = {};
      data?.forEach((p: any) => { map[p.user_id] = p; });
      return map;
    },
    enabled: modderIds.length > 0,
  });
}
