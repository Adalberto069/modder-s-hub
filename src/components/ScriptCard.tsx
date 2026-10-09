import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Star, Code, ArrowUpRight, Heart, Smartphone } from "lucide-react";
import { UserRoleBadge } from "@/components/UserRoleBadge";
import { UserBadges } from "@/components/UserBadges";
import { useFavorites } from "@/hooks/use-favorites";

interface ScriptCardProps {
  id: string; title: string; modderName: string; modderId: string;
  status: "working" | "detected" | "updating";
  downloadCount: number; averageRating: number; isPaid: boolean; price?: number;
  thumbnailUrl?: string | null; categorySlug?: string; scriptType?: string; apkVersion?: string | null;
}
const statusConfig = {
  working: { label: "Atualizado", className: "text-primary border-primary/30" },
  detected: { label: "Detectado", className: "text-destructive border-destructive/30" },
  updating: { label: "Em atualização", className: "text-neon-cyan border-neon-cyan/30" },
};
export function ScriptCard({ id, title, modderName, modderId, status, downloadCount, averageRating, isPaid, price, thumbnailUrl, categorySlug, scriptType, apkVersion }: ScriptCardProps) {
  const st = statusConfig[status] ?? statusConfig.updating;
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(id);
  const isApk = scriptType === "apk";
  return (
    <Card className="group relative overflow-hidden rounded-lg border-border hover:border-primary/50 transition-all duration-300 bg-card h-full flex flex-col shadow-none hover:shadow-neon">
      <Link to={`/script/${id}`} aria-label={`Ver ${title}`} className="script-thumbnail aspect-video bg-surface flex items-center justify-center overflow-hidden relative border-b border-border">
        {thumbnailUrl ? <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" /> : <div className="flex flex-col items-center gap-3 text-muted-foreground">{isApk ? <Smartphone className="h-12 w-12 text-neon-cyan/50" /> : <Code className="h-12 w-12 text-primary/50" />}<span className="text-[10px] uppercase">{isApk ? "Android / Gaming" : "Lua / Game Guardian"}</span></div>}
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
          <Badge variant="outline" className={`bg-glass/90 backdrop-blur-md text-[10px] rounded-sm ${st.className}`}>{st.label}</Badge>
          <Badge variant="outline" className="bg-glass/90 text-neon-cyan border-border text-[10px] rounded-sm">{isApk ? (apkVersion ? `APK / v${apkVersion}` : 'APK MOD') : (categorySlug === 'scripts-lua' ? 'LUA' : categorySlug ?? 'LUA')}</Badge>
        </div>
      </Link>
      <Button variant="outline" size="icon" aria-label={fav ? `Remover ${title} dos favoritos` : `Favoritar ${title}`} title={fav ? 'Remover dos favoritos' : 'Favoritar'} className="absolute top-3 right-3 h-8 w-8 bg-glass/80 backdrop-blur-md" onClick={() => toggleFavorite.mutate(id)}><Heart className={fav ? 'text-neon-cyan fill-neon-cyan' : 'text-foreground'} /></Button>
      <CardContent className="p-4 sm:p-5 flex-1 flex flex-col gap-3">
        <Link to={`/script/${id}`} className="block"><h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors leading-snug break-words">{title}</h3></Link>
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Link to={`/modder/${modderId}`} className="text-xs text-muted-foreground hover:text-primary truncate max-w-40">{modderName}</Link>
          <div className="flex gap-1"><UserRoleBadge userId={modderId} /><UserBadges userId={modderId} compact /></div>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground"><span className="flex gap-1.5 items-center"><Download className="h-3.5 w-3.5 text-neon-cyan" />{downloadCount.toLocaleString('pt-BR')}</span><span className="flex gap-1.5 items-center"><Star className="h-3.5 w-3.5 text-rating" />{averageRating.toFixed(1)}</span></div>
        <div className="mt-auto pt-4 border-t border-border flex items-center justify-between gap-2">
          <span className={`font-display text-xl font-bold ${isPaid ? 'text-foreground' : 'text-primary'}`}>{isPaid ? `R$ ${(price ?? 0).toFixed(2).replace('.', ',')}` : 'Grátis'}</span>
          <Button asChild variant="ghost" size="sm" className="text-primary"><Link to={`/script/${id}`}>Ver {isApk ? 'APK' : 'script'}<ArrowUpRight /></Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}
