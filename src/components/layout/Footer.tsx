import { Terminal } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/50 py-8">
      <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-neon-purple" />
          <span className="font-mono font-bold">Mod<span className="text-neon-green">Hub</span></span>
        </div>
        <p className="text-sm text-muted-foreground">
          © 2026 ModHub. Plataforma para Modders Mobile.
        </p>
      </div>
    </footer>
  );
}
