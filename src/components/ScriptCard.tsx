import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Star, Code, ShoppingCart, Unlock, Heart, Smartphone } from "lucide-react";
import { UserRoleBadge } from "@/components/UserRoleBadge";
import { UserBadges } from "@/components/UserBadges";
import { useFavorites } from "@/hooks/use-favorites";

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
  scriptType?: string;
  apkVersion?: string | null;
}

const statusConfig = {
  working: { label: "WORKING_OK", className: "bg-[#030304] text-neon-green border-white/10" },
  detected: { label: "DETECTED_RISK", className: "bg-[#030304] text-destructive border-white/10" },
  updating: { label: "UPDATING_NOW", className: "bg-[#030304] text-neon-cyan border-white/10" },
};

export function ScriptCard({
  id, title, modderName, modderId, status, downloadCount, averageRating, isPaid, price, thumbnailUrl, categorySlug, scriptType, apkVersion,
}: ScriptCardProps) {
  const st = statusConfig[status];
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(id);
  const isApk = scriptType === "apk";

  return (
    <Link to={`/script/${id}`} className="block h-full">
      <Card className="group overflow-hidden border-white/10 hover:border-neon-purple/50 transition-all duration-300 bg-[#050505] rounded-none h-full flex flex-col shadow-none hover:shadow-[0_0_15px_rgba(168,85,247,0.1)]">
        {/* Thumbnail */}
        <div className="aspect-video bg-[#030304] border-b border-white/5 flex items-center justify-center overflow-hidden relative">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out opacity-80 group-hover:opacity-100"
              loading="lazy"
            />
          ) : (
            isApk
              ? <Smartphone className="h-6 w-6 sm:h-10 sm:w-10 text-neon-cyan/20" />
              : <Code className="h-6 w-6 sm:h-10 sm:w-10 text-white/5 shadow-neon-cyan" />
          )}

          {/* Favorite button */}
          <button
            className="absolute top-2 right-2 z-20 p-1.5 bg-[#050505]/80 border border-white/10 hover:border-neon-pink/50 transition-all duration-200"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite.mutate(id);
            }}
          >
            <Heart className={`h-3.5 w-3.5 transition-colors ${fav ? "text-neon-pink fill-neon-pink" : "text-muted-foreground hover:text-neon-pink"}`} />
          </button>

          {isApk && (
            <div className="absolute top-2 left-2 z-10">
              <Badge variant="outline" className="bg-neon-cyan text-[#050505] border-neon-cyan text-[8px] sm:text-[9px] rounded-none font-mono uppercase tracking-widest gap-1 font-black">
                <Smartphone className="h-2.5 w-2.5" /> APK MOD
              </Badge>
            </div>
          )}

          <div className="absolute bottom-2 left-2 z-10 flex flex-wrap gap-1">
            <Badge variant="outline" className={`${st.className} text-[8px] sm:text-[9px] rounded-none font-mono uppercase tracking-widest`}>
              {st.label}
            </Badge>
            {isApk && apkVersion ? (
              <Badge variant="outline" className="bg-[#030304] text-neon-cyan border-neon-cyan/30 text-[8px] sm:text-[9px] rounded-none uppercase tracking-widest font-mono hidden sm:inline-flex">
                v{apkVersion}
              </Badge>
            ) : categorySlug && (
              <Badge variant="outline" className="bg-[#030304] text-white/70 border-white/10 text-[8px] sm:text-[9px] rounded-none uppercase tracking-widest font-mono hidden sm:inline-flex">
                {categorySlug === "scripts-lua" ? "LUA" : categorySlug}
              </Badge>
            )}
          </div>

          <div className="absolute inset-0 bg-neon-purple/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mix-blend-overlay pointer-events-none" />
        </div>
        {/* Content */}
        <CardContent className="p-4 flex-1 flex flex-col gap-3 font-mono">
          <div className="flex-1 space-y-2">
            <h3 className="font-black text-sm uppercase tracking-tight text-white group-hover:text-neon-purple transition-colors duration-300 leading-tight italic truncate">
              {title}
            </h3>
            <div className="flex flex-wrap items-center gap-1 sm:gap-2" onClick={(e) => e.stopPropagation()}>
              <Link
                to={`/modder/${modderId}`}
                className="flex items-center gap-1 text-[9px] sm:text-[10px] uppercase font-black tracking-widest text-muted-foreground hover:text-white transition-colors duration-200 border border-white/5 bg-[#030304] px-2 py-0.5"
              >
                <span className="truncate max-w-[80px] sm:max-w-[100px]">{modderName}</span>
              </Link>
              <div className="scale-[0.7] sm:scale-[0.8] origin-left flex items-center gap-1">
                <UserRoleBadge userId={modderId} />
                <UserBadges userId={modderId} compact />
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 sm:gap-4 text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-widest">
            <span className="flex items-center gap-1.5 border border-white/5 px-1.5 py-0.5 bg-[#030304]">
              <Download className="h-3 w-3 text-neon-cyan" />
              {downloadCount}
            </span>
            <span className="flex items-center gap-1.5 border border-white/5 px-1.5 py-0.5 bg-[#030304]">
              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
              <span className="font-black text-amber-500">{averageRating.toFixed(1)}</span>
            </span>
          </div>

          {/* CTA */}
          <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between gap-2">
            {isPaid ? (
              <>
                <div className="flex flex-col leading-none space-y-1">
                  <span className="text-[8px] text-muted-foreground uppercase tracking-widest font-black">Transferência</span>
                  <span className="text-sm sm:text-base font-black text-[#a855f7]">
                    R$ {price?.toFixed(2)}
                  </span>
                </div>
                <span className="flex items-center gap-2 bg-neon-purple hover:bg-neon-purple/90 text-white transition-all duration-300 font-black uppercase tracking-widest text-[9px] sm:text-[10px] px-3 py-1.5 group-hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] border border-neon-purple">
                  {isApk ? <Download className="h-3 w-3" /> : <ShoppingCart className="h-3 w-3" />}
                  {isApk ? "Baixar" : "Aquisição"}
                </span>
              </>
            ) : (
              <>
                <div className="flex flex-col leading-none space-y-1">
                  <span className="text-[8px] text-muted-foreground uppercase tracking-widest font-black">{isApk ? "APK" : "Acesso"}</span>
                  <span className="text-sm sm:text-base font-black text-neon-green">{isApk ? "Grátis" : "Livre"}</span>
                </div>
                <span className="flex items-center gap-2 bg-transparent hover:bg-neon-green/10 text-neon-green border border-neon-green/50 transition-all duration-300 font-black uppercase tracking-widest text-[9px] sm:text-[10px] px-3 py-1.5 group-hover:shadow-[0_0_15px_rgba(57,255,20,0.1)]">
                  {isApk ? <Download className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  {isApk ? "Baixar" : "Operar"}
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
