import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ImpersonationBanner() {
  const [impersonating, setImpersonating] = useState(false);
  const [targetName, setTargetName] = useState("");

  useEffect(() => {
    const data = localStorage.getItem("admin_impersonation");
    if (data) {
      try {
        const parsed = JSON.parse(data);
        setImpersonating(true);
        setTargetName(parsed.targetName || "usuário");
      } catch {
        setImpersonating(false);
      }
    }
  }, []);

  const handleReturn = async () => {
    const data = localStorage.getItem("admin_impersonation");
    if (!data) return;

    try {
      const { refresh_token } = JSON.parse(data);
      // Sign out current impersonated session
      await supabase.auth.signOut();
      // Restore admin session
      const { error } = await supabase.auth.refreshSession({ refresh_token });
      if (error) {
        toast.error("Erro ao restaurar sessão admin. Faça login novamente.");
        console.error("Restore error:", error);
      } else {
        toast.success("Sessão admin restaurada!");
      }
    } catch (e) {
      console.error("Return error:", e);
      toast.error("Erro ao voltar. Faça login novamente.");
    } finally {
      localStorage.removeItem("admin_impersonation");
      setImpersonating(false);
      window.location.href = "/admin";
    }
  };

  if (!impersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-center gap-3 shadow-lg">
      <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />
      <span className="text-xs font-bold uppercase tracking-wider">
        Modo Suporte — Navegando como <strong>{targetName}</strong>
      </span>
      <Button
        size="sm"
        variant="secondary"
        onClick={handleReturn}
        className="h-7 text-xs font-bold uppercase tracking-wider gap-1"
      >
        <LogOut className="h-3 w-3" />
        Voltar ao Admin
      </Button>
    </div>
  );
}
