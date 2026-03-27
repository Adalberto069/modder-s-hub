import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleBadge } from "@/components/RoleBadge";

interface UserRoleBadgeProps {
  userId: string;
}

export function UserRoleBadge({ userId }: UserRoleBadgeProps) {
  const { data: role } = useQuery({
    queryKey: ["user-role-display", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_display_role", {
        _user_id: userId,
      });
      if (error || !data) return "member" as const;
      return data as "admin" | "modder" | "member";
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  if (!role) return null;

  return <RoleBadge role={role} />;
}
