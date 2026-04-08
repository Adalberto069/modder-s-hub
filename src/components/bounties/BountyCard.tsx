import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Target, Gamepad2, Clock, User, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BountyCardProps {
  bounty: {
    id: string;
    title: string;
    description: string;
    game_name?: string | null;
    reward_amount: number;
    status: string;
    deadline?: string | null;
    created_at: string;
    profiles?: { username?: string; display_name?: string } | null;
    categories?: { name?: string; icon?: string } | null;
    application_count?: number;
  };
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  open: { label: "Aberta", color: "text-neon-green", bg: "bg-neon-green/10", border: "border-neon-green/30" },
  in_progress: { label: "Em Andamento", color: "text-neon-cyan", bg: "bg-neon-cyan/10", border: "border-neon-cyan/30" },
  completed: { label: "Concluída", color: "text-neon-purple", bg: "bg-neon-purple/10", border: "border-neon-purple/30" },
  cancelled: { label: "Cancelada", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
};

export function BountyCard({ bounty }: BountyCardProps) {
  const status = statusConfig[bounty.status] ?? statusConfig.open;
  const isExpired = bounty.deadline && new Date(bounty.deadline) < new Date();
  const timeAgo = formatDistanceToNow(new Date(bounty.created_at), { locale: ptBR, addSuffix: true });
  const appCount = bounty.application_count ?? 0;

  return (
    <Link to={`/bounties/${bounty.id}`} className="group block">
      <div className="relative overflow-hidden border border-white/5 bg-[#050505] hover:border-neon-purple/30 hover:bg-[#07070a] transition-all duration-300 hover:shadow-[0_0_20px_rgba(168,85,247,0.08)] h-full flex flex-col">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neon-purple/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="p-5 space-y-3 flex-1 flex flex-col">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="shrink-0 h-8 w-8 rounded-none bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center group-hover:bg-neon-purple/20 transition-colors">
                <Target className="h-4 w-4 text-neon-purple" />
              </div>
              <h3 className="font-black text-sm uppercase tracking-tight text-white truncate group-hover:text-neon-purple transition-colors line-clamp-1">
                {bounty.title}
              </h3>
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] shrink-0 font-black uppercase tracking-widest rounded-none ${status.color} ${status.bg} ${status.border}`}
            >
              {status.label}
            </Badge>
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
            {bounty.description}
          </p>

          {/* Tags row */}
          <div className="flex flex-wrap gap-1.5">
            {bounty.game_name && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-neon-cyan bg-neon-cyan/5 border border-neon-cyan/10 px-2 py-0.5">
                <Gamepad2 className="h-2.5 w-2.5" />
                {bounty.game_name}
              </span>
            )}
            {bounty.categories?.name && (
              <span className="text-[10px] font-medium text-muted-foreground bg-white/5 border border-white/5 px-2 py-0.5">
                {bounty.categories.icon} {bounty.categories.name}
              </span>
            )}
            {isExpired && (
              <span className="text-[10px] font-medium text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5">
                EXPIRADA
              </span>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                <User className="h-2.5 w-2.5" />
                {bounty.profiles?.display_name ?? bounty.profiles?.username ?? "Anônimo"}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                <Clock className="h-2.5 w-2.5" />
                {timeAgo}
              </span>
            </div>
            {appCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-neon-cyan/80">
                <Users className="h-2.5 w-2.5" />
                {appCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
