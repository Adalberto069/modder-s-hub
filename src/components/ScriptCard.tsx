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
      <Card className="group overflow-hidden border-neon-purple/20 hover:border-neon-purple/40 hover:shadow-neon-purple/10 transition-all duration-500 bg-card/40 backdrop-blur-md h-full flex flex-col shadow-lg">
        <div className="aspect-video bg-secondary/30 flex items-center justify-center overflow-hidden relative">
          {thumbnailUrl ? (
            <img 
              src={thumbnailUrl} 
              alt={title} 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
              loading="lazy"
            />
          ) : (
            <Code className="h-6 w-6 sm:h-10 sm:w-10 text-muted-foreground/20 group-hover:scale-110 transition-transform duration-700" />
          )}
          
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10">
            {isPaid ? (
              <span className="bg-background/80 backdrop-blur-md px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold text-neon-pink border border-neon-pink/30 shadow-neon-pink/20 shadow-lg">
                R$ {price?.toFixed(0)}
              </span>
            ) : (
              <span className="bg-background/80 backdrop-blur-md px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold text-neon-green border border-neon-green/30 shadow-neon-green/20 shadow-lg">
                Grátis
              </span>
            )}
          </div>
          
          <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 z-10 flex flex-wrap gap-0.5 sm:gap-1">
             <Badge variant="outline" className={`${st.className} text-[7px] sm:text-[9px] h-4 sm:h-5 px-1 sm:px-2 backdrop-blur-sm border-white/10 font-bold uppercase tracking-tight`}>
                {st.label}
             </Badge>
             {categorySlug && (
               <Badge variant="outline" className="bg-background/50 backdrop-blur-sm text-[7px] sm:text-[9px] h-4 sm:h-5 px-1 sm:px-2 border-white/10 text-muted-foreground uppercase hidden sm:inline-flex">
                 {categorySlug === "scripts-lua" ? "Lua" : categorySlug}
               </Badge>
             )}
          </div>
          
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>

        <CardContent className="p-2.5 sm:p-4 space-y-2 sm:space-y-4 flex-1 flex flex-col">
          <div className="space-y-1 sm:space-y-2">
            <h3 className="font-bold text-[11px] sm:text-base line-clamp-1 group-hover:text-neon-purple transition-colors duration-300 leading-tight">
              {title}
            </h3>
            
            <div className="flex flex-wrap items-center gap-1 sm:gap-2" onClick={(e) => e.stopPropagation()}>
              <Link 
                to={`/modder/${modderId}`} 
                className="flex items-center gap-1 text-[9px] sm:text-xs text-muted-foreground/80 hover:text-neon-purple transition-colors duration-300 bg-white/5 py-0.5 px-1.5 sm:px-2 rounded-full border border-white/5"
              >
                <span className="truncate max-w-[60px] sm:max-w-[80px]">@{modderName}</span>
              </Link>
              <div className="scale-[0.65] sm:scale-90 origin-left flex items-center gap-1">
                <UserRoleBadge userId={modderId} />
                <UserBadges userId={modderId} compact />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] sm:text-xs text-muted-foreground/60 pt-2 sm:pt-3 mt-auto border-t border-white/5">
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
            
            <div className="hidden sm:flex items-center gap-1 font-mono text-neon-purple/70 font-bold group-hover:translate-x-0.5 transition-transform text-[10px]">
              DETALHES
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
