import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Você realmente quer excluir?",
  description = "Esta ação é permanente e não pode ser desfeita.",
  itemName,
  confirmLabel = "Sim, excluir",
  cancelLabel = "Cancelar",
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#0a0a0c] border-white/10 font-mono max-w-sm">
        <AlertDialogHeader>
          <div className="flex justify-center mb-2">
            <div className="h-12 w-12 rounded-full bg-destructive/15 border border-destructive/30 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-base uppercase tracking-widest">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-xs text-muted-foreground">
            {itemName ? (
              <>
                <span className="text-white/80 break-all">"{itemName}"</span>
                <br />
              </>
            ) : null}
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel className="rounded-none border-white/10 text-xs uppercase tracking-widest">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs uppercase tracking-widest"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
