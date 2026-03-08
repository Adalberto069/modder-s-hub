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
        <div className="aspect-video bg-secondary/50 flex items-center justify-center overflow-hidden">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <Code className="h-12 w-12 text-muted-foreground/30" />
          )}
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{title}</h3>
            <Badge variant="outline" className={st.className + " text-[10px] shrink-0"}>
              {st.label}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Link to={`/modder/${modderId}`} className="text-xs text-muted-foreground hover:text-neon-purple transition-colors">
              @{modderName}
            </Link>
            <UserRoleBadge userId={modderId} />
            <UserBadges userId={modderId} compact />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><Download className="h-3 w-3" />{downloadCount}</span>
              <span className="flex items-center gap-1"><Star className="h-3 w-3 text-neon-green" />{averageRating.toFixed(1)}</span>
            </div>
            {isPaid ? (
              <span className="font-mono font-bold text-neon-pink">R$ {price?.toFixed(2)}</span>
            ) : (
              <Badge variant="outline" className="text-[10px] border-neon-green/30 text-neon-green">Grátis</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
