import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Clock, Code, Layers, Download, Trophy, ShieldCheck, Award,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  clock: Clock,
  code: Code,
  layers: Layers,
  download: Download,
  trophy: Trophy,
  "shield-check": ShieldCheck,
  award: Award,
};

interface UserBadgesProps {
  userId: string;
  compact?: boolean;
}

export function UserBadges({ userId, compact = false }: UserBadgesProps) {
  const { data: badges, isLoading } = useQuery({
    queryKey: ["user-badges", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_badges")
        .select("earned_at, badge_definitions(slug, name, description, icon, color, sort_order)")
        .eq("user_id", userId)
        .order("earned_at", { ascending: true });

      return (data ?? [])
        .map((b: any) => ({
          ...b.badge_definitions,
          earned_at: b.earned_at,
        }))
        .sort((a: any, b: any) => a.sort_order - b.sort_order);
    },
    enabled: !!userId,
  });

  if (isLoading || !badges || badges.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "mt-2"}`}>
        {badges.map((badge: any) => {
          const Icon = iconMap[badge.icon] ?? Award;
          return (
            <Tooltip key={badge.slug}>
              <TooltipTrigger asChild>
                <div
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80"
                  style={{
                    borderColor: badge.color,
                    color: badge.color,
                    backgroundColor: `${badge.color}15`,
                  }}
                >
                  <Icon className="h-3 w-3" />
                  {!compact && <span>{badge.name}</span>}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px] text-center">
                <p className="font-semibold">{badge.name}</p>
                <p className="text-xs text-muted-foreground">{badge.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
