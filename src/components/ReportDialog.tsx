import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { LoginPromptDialog } from "@/components/LoginPromptDialog";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportedUserId?: string;
  scriptId?: string;
  targetName?: string;
}

export function ReportDialog({ open, onOpenChange, reportedUserId, scriptId, targetName }: ReportDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      setShowLogin(true);
      return;
    }

    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error("Descreva o motivo da denúncia.");
      return;
    }
    if (trimmed.length < 10) {
      toast.error("O motivo deve ter pelo menos 10 caracteres.");
      return;
    }
    if (trimmed.length > 1000) {
      toast.error("O motivo deve ter no máximo 1000 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("reports" as any).insert({
        reporter_id: user.id,
        reported_user_id: reportedUserId || null,
        script_id: scriptId || null,
        reason: trimmed,
      } as any);

      if (error) throw error;

      toast.success("Denúncia enviada com sucesso. Nossa equipe irá analisar.");
      setReason("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao enviar denúncia: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <Flag className="h-5 w-5 text-destructive" />
              </div>
              <DialogTitle className="text-lg">
                Denunciar {targetName ? `"${targetName}"` : ""}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm">
              Descreva o motivo da denúncia. Exemplos: tentativa de negociação fora da plataforma, conteúdo inadequado, fraude, etc.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Descreva o que aconteceu..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[120px] resize-none"
            maxLength={1000}
          />
          <p className="text-xs text-muted-foreground text-right">{reason.length}/1000</p>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleSubmit} disabled={submitting || !reason.trim()}>
              {submitting ? "Enviando..." : "Enviar Denúncia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LoginPromptDialog open={showLogin} onOpenChange={setShowLogin} />
    </>
  );
}
