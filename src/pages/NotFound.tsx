import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Terminal, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-neon-purple/5 blur-[150px] -z-10 rounded-full" />
      <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-neon-cyan/5 blur-[100px] -z-10 rounded-full" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0, 0, 0.2, 1] }}
        className="text-center px-6 max-w-lg"
      >
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-neon-purple/10 border border-neon-purple/20 mb-6">
          <Terminal className="h-9 w-9 text-neon-purple" />
        </div>

        {/* Error code */}
        <div className="mb-2">
          <span className="text-[100px] sm:text-[140px] font-black leading-none bg-gradient-to-b from-foreground/80 to-foreground/10 bg-clip-text text-transparent">
            404
          </span>
        </div>

        {/* Message */}
        <h1 className="text-xl sm:text-2xl font-bold mb-2">
          Rota não encontrada
        </h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          O caminho{" "}
          <code className="font-mono text-neon-purple bg-neon-purple/10 px-1.5 py-0.5 rounded text-xs">
            {location.pathname}
          </code>{" "}
          não existe no HiddenMod.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild className="neon-glow-purple gap-2">
            <Link to="/">
              <Home className="h-4 w-4" />
              Voltar ao Início
            </Link>
          </Button>
          <Button variant="outline" onClick={() => window.history.back()} className="gap-2 border-white/10">
            <ArrowLeft className="h-4 w-4" />
            Página Anterior
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
