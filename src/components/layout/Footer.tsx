import { Terminal } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/30 py-8 sm:py-12">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-10">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-neon-purple" />
              <span className="font-mono font-black text-lg">
                Hidden<span className="text-neon-green">Mod</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A plataforma #1 para scripts Game Guardian com licenças seguras e ofuscação profissional.
            </p>
          </div>

          {/* Plataforma */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Plataforma</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/marketplace" className="hover:text-foreground transition-colors">Marketplace</Link></li>
              <li><Link to="/tutorials" className="hover:text-foreground transition-colors">Tutoriais</Link></li>
              <li><Link to="/ferramentas" className="hover:text-foreground transition-colors">Ferramentas</Link></li>
              <li><Link to="/forum" className="hover:text-foreground transition-colors">Fórum</Link></li>
            </ul>
          </div>

          {/* Conta */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Conta</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/dashboard" className="hover:text-foreground transition-colors">Painel</Link></li>
              <li><Link to="/profile/settings" className="hover:text-foreground transition-colors">Configurações</Link></li>
              <li><Link to="/auth" className="hover:text-foreground transition-colors">Login / Registro</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/privacidade" className="hover:text-foreground transition-colors">Política de Privacidade</Link></li>
              <li><Link to="/termos" className="hover:text-foreground transition-colors">Termos de Uso</Link></li>
              <li><Link to="/forum" className="hover:text-foreground transition-colors">Contato (Fórum)</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Hidden Mod. Todos os direitos reservados.
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            Feito para Modders 🎮
          </p>
        </div>
      </div>
    </footer>
  );
}
