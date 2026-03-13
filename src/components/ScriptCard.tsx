import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Star, Code, Package } from "lucide-react";
import { UserRoleBadge } from "@/components/UserRoleBadge";
import { UserBadges } from "@/components/UserBadges";

interface ScriptCardProps {
  id: string;
  title: string;
  modderName: string;
  modderId: string;
  status: "working" | "detected" | "updating";
  downloadCount: number;
  averageRating: number;
  isPaid: boolean;
  price?: number;
  thumbnailUrl?: string | null;
  categorySlug?: string;
}

const statusConfig = {
  working: { label: "Working", className: "bg-neon-green/20 text-neon-green border-neon-green/30" },
  detected: { label: "Detected", className: "bg-destructive/20 text-destructive border-destructive/30" },
  updating: { label: "Updating", className: "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/30" },
};

export function ScriptCard({
  id, title, modderName, modderId, status, downloadCount, averageRating, isPaid, price, thumbnailUrl, categorySlug,
}: ScriptCardProps) {
  const st = statusConfig[status];

  return (
    <Link to={`/script/${id}`}>
      <Card className="group overflow-hidden neon-border hover:neon-glow-purple transition-all duration-300 bg-card/80 backdrop-blur-sm">
        <div className="aspect-video bg-secondary/50 flex items-center justify-center overflow-hidden relative">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <Code className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground/30" />
          )}
          {isPaid ? (
            <div className="absolute top-2 right-2 sm:hidden">
              <span className="bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-bold text-neon-pink border border-neon-pink/20">
                R$ {price?.toFixed(0)}
              </span>
            </div>
          ) : (
            <div className="absolute top-2 right-2 sm:hidden">
              <span className="bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-bold text-neon-green border border-neon-green/20">
                Grátis
              </span>
            </div>
          )}
        </div>
        <CardContent className="p-2 sm:p-4 space-y-2 sm:space-y-3">
          <div className="flex items-start justify-between gap-1.5">
            <h3 className="font-semibold text-xs sm:text-sm line-clamp-1 group-hover:text-primary transition-colors flex-1">{title}</h3>
            <Badge variant="outline" className={st.className + " text-[8px] sm:text-[10px] shrink-0 h-4 px-1"}>
              {st.label}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Link to={`/modder/${modderId}`} className="text-[10px] sm:text-xs text-muted-foreground hover:text-neon-purple transition-colors truncate max-w-[60px] sm:max-w-none">
              @{modderName}
            </Link>
            <div className="scale-75 sm:scale-100 origin-left">
              <UserRoleBadge userId={modderId} />
            </div>
            <UserBadges userId={modderId} compact />
          </div>
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground pt-1 sm:pt-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="flex items-center gap-1"><Download className="h-2.5 w-2.5 sm:h-3 sm:w-3" />{downloadCount}</span>
              <span className="flex items-center gap-1"><Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-neon-green" />{averageRating.toFixed(1)}</span>
            </div>
            <div className="hidden sm:block">
              {isPaid ? (
                <span className="font-mono font-bold text-neon-pink text-xs">R$ {price?.toFixed(2)}</span>
              ) : (
                <Badge variant="outline" className="text-[10px] border-neon-green/30 text-neon-green px-1">Grátis</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
