import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Star, Code, ShoppingCart, Unlock } from "lucide-react";
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
      <Card className="group overflow-hidden border-white/[0.06] hover:border-primary/40 transition-all duration-500 bg-card/50 backdrop-blur-md h-full flex flex-col shadow-lg hover:shadow-primary/10 hover:shadow-xl hover:-translate-y-0.5">
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

          {/* Status badge */}
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
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>

        {/* Content */}
        <CardContent className="p-2.5 sm:p-4 flex-1 flex flex-col gap-2 sm:gap-3">
          {/* Title + Modder */}
          <div className="flex-1 space-y-1.5">
            <h3 className="font-bold text-[11px] sm:text-sm line-clamp-2 group-hover:text-primary transition-colors duration-300 leading-tight">
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

          {/* Stats row */}
          <div className="flex items-center gap-2 sm:gap-3 text-[9px] sm:text-[11px] text-muted-foreground/50">
            <span className="flex items-center gap-0.5 sm:gap-1">
              <Download className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              {downloadCount}
            </span>
            <span className="flex items-center gap-0.5 sm:gap-1">
              <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-amber-400 fill-amber-400" />
              <span className="font-bold text-amber-400/90">{averageRating.toFixed(1)}</span>
            </span>
          </div>

          {/* CTA — price + buy button (ALWAYS at bottom) */}
          <div className={`mt-auto pt-2 sm:pt-3 border-t border-white/5 flex items-center justify-between gap-2`}>
            {isPaid ? (
              <>
                <div className="flex flex-col leading-none">
                  <span className="text-[8px] text-muted-foreground/50 uppercase tracking-widest">Preço</span>
                  <span className="text-base sm:text-lg font-black text-[hsl(var(--neon-pink))]">
                    R$ {price?.toFixed(2)}
                  </span>
                </div>
                <span className="flex items-center gap-1 bg-[hsl(var(--neon-pink)/0.12)] hover:bg-[hsl(var(--neon-pink)/0.22)] text-[hsl(var(--neon-pink))] border border-[hsl(var(--neon-pink)/0.3)] transition-all duration-300 font-bold text-[9px] sm:text-[11px] px-2.5 sm:px-3 py-1.5 rounded-full group-hover:shadow-[0_0_12px_hsl(var(--neon-pink)/0.3)]">
                  <ShoppingCart className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Comprar
                </span>
              </>
            ) : (
              <>
                <div className="flex flex-col leading-none">
                  <span className="text-[8px] text-muted-foreground/50 uppercase tracking-widest">Preço</span>
                  <span className="text-base sm:text-lg font-black text-accent">Grátis</span>
                </div>
                <span className="flex items-center gap-1 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 transition-all duration-300 font-bold text-[9px] sm:text-[11px] px-2.5 sm:px-3 py-1.5 rounded-full group-hover:shadow-[0_0_12px_hsl(var(--neon-green)/0.3)]">
                  <Unlock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Acessar
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
