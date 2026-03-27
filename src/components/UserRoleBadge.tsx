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
      const { data, error } = await (supabase.rpc as any)("get_user_display_role", {
        _user_id: userId,
      });
      if (error || !data) return "member" as const;
      const r = data as string;
      if (r === "admin") return "admin" as const;
      if (r === "modder") return "modder" as const;
      return "member" as const;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  if (!role) return null;

  return <RoleBadge role={role} />;
}
