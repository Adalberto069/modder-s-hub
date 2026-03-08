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
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("approved", true);
      const roles = (data ?? []).map((r: any) => r.role as string);
      if (roles.includes("admin")) return "admin" as const;
      if (roles.includes("modder")) return "modder" as const;
      return "member" as const;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  if (!role) return null;

  return <RoleBadge role={role} />;
}
