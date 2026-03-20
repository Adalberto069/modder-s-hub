import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Star, Code, ArrowRight } from "lucide-react";
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
  working: { label: "Working", className: "bg-accent/20 text-accent border-accent/30" },
  detected: { label: "Detected", className: "bg-destructive/20 text-destructive border-destructive/30" },
  updating: { label: "Updating", className: "bg-[hsl(var(--neon-cyan)/0.2)] text-[hsl(var(--neon-cyan))] border-[hsl(var(--neon-cyan)/0.3)]" },
};

export function ScriptCard({
  id, title, modderName, modderId, status, downloadCount, averageRating, isPaid, price, thumbnailUrl, categorySlug,
}: ScriptCardProps) {
  const st = statusConfig[status];

  return (
    <Link to={`/script/${id}`} className="block h-full">
      <Card className="group overflow-hidden border-white/[0.06] hover:border-primary/30 transition-all duration-500 bg-card/50 backdrop-blur-md h-full flex flex-col shadow-lg hover:shadow-primary/5 hover:shadow-xl">
        {/* Thumbnail */}
        <div className="aspect-video bg-secondary/20 flex items-center justify-center overflow-hidden relative">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              loading="lazy"
            />
          ) : (
            <Code className="h-6 w-6 sm:h-10 sm:w-10 text-muted-foreground/15 group-hover:scale-110 transition-transform duration-700" />
          )}

          {/* Price badge */}
          <div className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 z-10">
            {isPaid ? (
              <span className="bg-background/80 backdrop-blur-md px-2 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[11px] font-bold text-[hsl(var(--neon-pink))] border border-[hsl(var(--neon-pink)/0.3)] shadow-lg">
                R$ {price?.toFixed(0)}
              </span>
            ) : (
              <span className="bg-background/80 backdrop-blur-md px-2 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[11px] font-bold text-accent border border-accent/30 shadow-lg">
                Grátis
              </span>
            )}
          </div>

          {/* Status + Category */}
          <div className="absolute bottom-1.5 left-1.5 sm:bottom-2.5 sm:left-2.5 z-10 flex flex-wrap gap-1">
            <Badge variant="outline" className={`${st.className} text-[7px] sm:text-[9px] h-4 sm:h-5 px-1.5 sm:px-2 backdrop-blur-sm border-white/10 font-bold uppercase tracking-tight`}>
              {st.label}
            </Badge>
            {categorySlug && (
              <Badge variant="outline" className="bg-background/50 backdrop-blur-sm text-[7px] sm:text-[9px] h-4 sm:h-5 px-1.5 sm:px-2 border-white/10 text-muted-foreground uppercase hidden sm:inline-flex">
                {categorySlug === "scripts-lua" ? "Lua" : categorySlug}
              </Badge>
            )}
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end justify-center pb-3">
            <span className="text-[10px] sm:text-xs font-bold text-primary flex items-center gap-1 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
              Ver detalhes <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Content */}
        <CardContent className="p-2.5 sm:p-4 space-y-2 sm:space-y-3 flex-1 flex flex-col">
          <div className="space-y-1.5 sm:space-y-2 flex-1">
            <h3 className="font-bold text-[11px] sm:text-sm line-clamp-1 group-hover:text-primary transition-colors duration-300 leading-tight">
              {title}
            </h3>

            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Link
                to={`/modder/${modderId}`}
                className="flex items-center gap-1 text-[9px] sm:text-[11px] text-muted-foreground/70 hover:text-primary transition-colors duration-200 bg-white/[0.03] py-0.5 px-1.5 sm:px-2 rounded-full border border-white/5"
              >
                <span className="truncate max-w-[55px] sm:max-w-[90px]">@{modderName}</span>
              </Link>
              <div className="scale-[0.6] sm:scale-[0.85] origin-left flex items-center gap-0.5">
                <UserRoleBadge userId={modderId} />
                <UserBadges userId={modderId} compact />
              </div>
            </div>
          </div>

          {/* Footer stats */}
          <div className="flex items-center justify-between text-[9px] sm:text-[11px] text-muted-foreground/50 pt-2 mt-auto border-t border-white/5">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="flex items-center gap-0.5 sm:gap-1">
                <Download className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                {downloadCount}
              </span>
              <span className="flex items-center gap-0.5 sm:gap-1">
                <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-amber-400 fill-amber-400" />
                <span className="font-bold text-amber-400/90">{averageRating.toFixed(1)}</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
