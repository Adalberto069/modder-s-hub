import { Link } from "react-router-dom";
import { HiddenMark } from "@/components/brand/HiddenMark";

export function Footer() {
  return (
    <footer className="relative border-t border-border bg-surface py-10 sm:py-14 overflow-hidden">
      <div className="container relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-10">
          <div className="space-y-3 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <HiddenMark size={24} />
              <span className="font-display font-extrabold text-lg">
                Hidden<span className="text-primary">Mod</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Scripts para Game Guardian e APKs de jogos. Feitos pela comunidade HiddenMod.
            </p>
          </div>

          <FooterCol title="Explore" links={[
            ["Marketplace", "/marketplace"],
            ["Tutoriais", "/tutorials"],
            ["Ferramentas", "/ferramentas"],
            ["Encomendas", "/bounties"],
            ["Fórum", "/forum"],
          ]} />
          <FooterCol title="Sua conta" links={[
            ["Painel", "/dashboard"],
            ["Configurações", "/profile/settings"],
            ["Login / Registro", "/auth"],
          ]} />
          <FooterCol title="Informações" links={[
            ["Privacidade", "/privacidade"],
            ["Termos", "/termos"],
            ["Contato (Fórum)", "/forum"],
          ]} />
        </div>

        <div className="border-t border-border pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>
            © {new Date().getFullYear()} HiddenMod. Todos os direitos reservados.
          </p>
          <p className="text-neon-cyan">Seu jogo. Outro nível.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">
        {title}
      </h4>
      <ul className="space-y-3 text-sm text-muted-foreground">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link to={href} className="hover:text-neon-green transition-colors">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
