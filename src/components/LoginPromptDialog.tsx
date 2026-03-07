import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, MessageSquare, Download, Heart, Code } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LoginPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginPromptDialog({ open, onOpenChange }: LoginPromptDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-center p-8">
        <div className="flex justify-center mb-4">
          <div className="h-14 w-14 rounded-full bg-primary/15 flex items-center justify-center">
            <Lock className="h-7 w-7 text-primary" />
          </div>
        </div>

        <h2 className="text-xl font-bold font-mono">Você precisa de uma conta</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4">Crie uma conta para:</p>

        <ul className="text-left space-y-2.5 mb-6 mx-auto max-w-[220px]">
          {[
            { icon: MessageSquare, text: "Comentar" },
            { icon: Download, text: "Baixar scripts" },
            { icon: Heart, text: "Favoritar conteúdo" },
            { icon: Code, text: "Publicar scripts" },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5 text-sm text-foreground">
              <Icon className="h-4 w-4 text-accent shrink-0" />
              {text}
            </li>
          ))}
        </ul>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => { onOpenChange(false); navigate("/auth?tab=login"); }}
          >
            Entrar
          </Button>
          <Button
            className="flex-1 neon-glow-green"
            onClick={() => { onOpenChange(false); navigate("/auth?tab=signup"); }}
          >
            Criar conta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
