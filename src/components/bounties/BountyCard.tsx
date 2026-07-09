import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Target, Gamepad2, Clock, User, Users, Smartphone, FileCode2 } from "lucide-react";
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
    delivery_type?: "apk" | "script";
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
  const isApk = bounty.delivery_type === "apk";
  // Remove prefix from displayed title
  const cleanTitle = bounty.title.replace(/^\[(APK MOD|APK|SCRIPT)\]\s*/i, "");

  return (
    <Link to={`/bounties/${bounty.id}`} className="group block">
      <div className={`relative overflow-hidden border bg-[#050505] hover:bg-[#07070a] transition-all duration-300 h-full flex flex-col ${isApk ? "border-neon-green/20 hover:border-neon-green/40 hover:shadow-[0_0_20px_rgba(57,255,20,0.08)]" : "border-white/5 hover:border-neon-purple/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.08)]"}`}>
        <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${isApk ? "via-neon-green/50" : "via-neon-purple/50"}`} />

        <div className="p-5 space-y-3 flex-1 flex flex-col">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`shrink-0 h-8 w-8 rounded-none border flex items-center justify-center transition-colors ${isApk ? "bg-neon-green/10 border-neon-green/20 group-hover:bg-neon-green/20" : "bg-neon-purple/10 border-neon-purple/20 group-hover:bg-neon-purple/20"}`}>
                {isApk ? <Smartphone className="h-4 w-4 text-neon-green" /> : <Target className="h-4 w-4 text-neon-purple" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-[8px] font-black uppercase tracking-widest px-1 py-[1px] border ${isApk ? "text-neon-green border-neon-green/40 bg-neon-green/5" : "text-neon-cyan border-neon-cyan/40 bg-neon-cyan/5"}`}>
                    {isApk ? "APK MOD" : "SCRIPT .LUA"}
                  </span>
                </div>
                <h3 className={`font-black text-sm uppercase tracking-tight text-white truncate transition-colors line-clamp-1 ${isApk ? "group-hover:text-neon-green" : "group-hover:text-neon-purple"}`}>
                  {cleanTitle}
                </h3>
              </div>
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

          {/* Reward */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            {bounty.reward_amount > 0 ? (
              <span className="text-sm font-black text-neon-green tracking-tight">
                R$ {bounty.reward_amount.toFixed(2).replace('.', ',')}
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-widest text-neon-cyan/70">
                Voluntário
              </span>
            )}
            {appCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-neon-cyan/80">
                <Users className="h-2.5 w-2.5" />
                {appCount} candidatura{appCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Footer */}
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
        </div>
      </div>
    </Link>
  );
}
