import { Link } from "react-router-dom";
import { HiddenMark } from "@/components/brand/HiddenMark";

export function Footer() {
  return (
    <footer className="relative border-t border-white/10 bg-[#030305] py-10 sm:py-14 overflow-hidden">
      {/* faint grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />

      <div className="container relative">
        {/* Terminal prompt header */}
        <div className="mb-8 sm:mb-10 font-mono text-[11px] sm:text-xs text-muted-foreground border-l-2 border-neon-green/40 pl-3">
          <span className="text-neon-green">visitor@hidden</span>
          <span className="opacity-60">:~$</span>{" "}
          <span className="text-foreground/80">cat /etc/hidden/about.txt</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-10">
          <div className="space-y-3 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <HiddenMark size={24} />
              <span className="font-mono font-black text-base uppercase">
                Hidden<span className="text-neon-green">//</span>Mod
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed font-mono">
              cofre underground · scripts game guardian · licenças seguras · obfuscação assinada por comprador.
            </p>
            <div className="flex items-center gap-2 pt-1 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              <span className="live-dot" /> sistema operacional
            </div>
          </div>

          <FooterCol title="// plataforma" links={[
            ["Marketplace", "/marketplace"],
            ["Tutoriais", "/tutorials"],
            ["Ferramentas", "/ferramentas"],
            ["Encomendas", "/bounties"],
            ["Fórum", "/forum"],
          ]} />
          <FooterCol title="// conta" links={[
            ["Painel", "/dashboard"],
            ["Configurações", "/profile/settings"],
            ["Login / Registro", "/auth"],
          ]} />
          <FooterCol title="// legal" links={[
            ["Privacidade", "/privacidade"],
            ["Termos", "/termos"],
            ["Contato (Fórum)", "/forum"],
          ]} />
        </div>

        <div className="border-t border-white/10 pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <p>
            © {new Date().getFullYear()} hidden//mod · all signals encrypted
          </p>
          <p className="flex items-center gap-2">
            <span className="opacity-60">node</span>
            <span className="text-neon-green">br-sa-1</span>
            <span className="opacity-30">·</span>
            <span className="opacity-60">v2.0.4a</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-neon-purple/80">
        {title}
      </h4>
      <ul className="space-y-2 text-sm text-muted-foreground font-mono">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link to={href} className="hover:text-neon-green transition-colors">
              {label.toLowerCase()}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
