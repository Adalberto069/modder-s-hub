import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

const STORAGE_KEY = "platform-warning-seen";

export function PlatformWarningDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem(STORAGE_KEY);
    if (!seen) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle className="text-lg">Aviso Importante</DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed">
            Todas as transações devem ser realizadas <strong className="text-foreground">exclusivamente pela plataforma</strong>.
            Negociações externas não possuem garantia nem suporte. 
            Se alguém tentar negociar fora da plataforma, utilize o botão de denúncia disponível no perfil ou na página do script.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleClose} className="w-full">
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
