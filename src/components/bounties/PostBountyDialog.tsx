import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Plus, Target, DollarSign, Gamepad2, Calendar, Smartphone, Code2 } from "lucide-react";

interface PostBountyDialogProps {
  children?: React.ReactNode;
}

export function PostBountyDialog({ children }: PostBountyDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deliveryType, setDeliveryType] = useState<"script" | "apk">("script");
  const [form, setForm] = useState({
    title: "",
    description: "",
    game_name: "",
    category_id: "",
    reward_amount: "",
    deadline: "",
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name, icon");
      return data ?? [];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Você precisa estar logado!"); return; }
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Preencha título e descrição.");
      return;
    }

    setLoading(true);
    const typeTag = deliveryType === "apk" ? "[APK MOD] " : "[SCRIPT] ";
    const descPrefix = deliveryType === "apk"
      ? "🎯 Tipo de entrega esperada: APK MOD (.apk instalável)\n\n"
      : "🎯 Tipo de entrega esperada: SCRIPT (.lua para GameGuardian)\n\n";
    const { error } = await (supabase as any).from("bounties").insert({
      title: typeTag + form.title.trim(),
      description: descPrefix + form.description.trim(),
      game_name: form.game_name.trim() || null,
      category_id: form.category_id || null,
      reward_amount: Number(form.reward_amount) || 0,
      deadline: form.deadline || null,
      requester_id: user.id,
      status: "open",
    });

    setLoading(false);
    if (error) { toast.error("Erro ao criar encomenda: " + error.message); return; }

    toast.success("Encomenda criada com sucesso! 🎯");
    queryClient.invalidateQueries({ queryKey: ["bounties"] });
    setOpen(false);
    setDeliveryType("script");
    setForm({ title: "", description: "", game_name: "", category_id: "", reward_amount: "", deadline: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button className="bg-neon-purple hover:bg-neon-purple/90 text-primary-foreground shadow-sm rounded-md font-bold   text-xs h-12 px-6">
            <Plus className="mr-2 h-4 w-4" /> Nova Encomenda
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-card border-border rounded-md p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b border-border/60 bg-surface">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold   text-foreground">
            <Target className="h-4 w-4 text-neon-purple" />
            Postar Nova Encomenda
          </DialogTitle>
          <p className="text-xs text-muted-foreground   mt-1">
            Descreva o script que você precisa e defina uma recompensa
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 font-mono">
          <div className="space-y-2">
            <Label className="text-xs   text-muted-foreground">
              Tipo de entrega *
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeliveryType("script")}
                className={`flex items-center justify-center gap-2 p-3 border rounded-md text-xs font-bold   transition-all ${
                  deliveryType === "script"
                    ? "border-neon-purple bg-neon-purple/10 text-neon-purple"
                    : "border-border bg-surface text-muted-foreground hover:border-white/20"
                }`}
              >
                <Code2 className="h-4 w-4" /> Script (.lua)
              </button>
              <button
                type="button"
                onClick={() => setDeliveryType("apk")}
                className={`flex items-center justify-center gap-2 p-3 border rounded-md text-xs font-bold   transition-all ${
                  deliveryType === "apk"
                    ? "border-neon-green bg-neon-green/10 text-neon-green"
                    : "border-border bg-surface text-muted-foreground hover:border-white/20"
                }`}
              >
                <Smartphone className="h-4 w-4" /> APK Mod
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs   text-muted-foreground">
              Título da Encomenda *
            </Label>
            <Input
              id="bounty-title"
              placeholder="Ex: Script de modo deus para Free Fire"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="bg-surface border-border focus-visible:ring-neon-purple rounded-md text-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs   text-muted-foreground">
              Descrição Detalhada *
            </Label>
            <Textarea
              id="bounty-description"
              placeholder="Descreva exatamente o que você precisa, qual versão do jogo, funcionalidades, etc..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              className="bg-surface border-border focus-visible:ring-neon-purple rounded-md text-sm resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs   text-muted-foreground flex items-center gap-1">
                <Gamepad2 className="h-3 w-3" /> Jogo
              </Label>
              <Input
                id="bounty-game"
                placeholder="Free Fire, PUBG..."
                value={form.game_name}
                onChange={(e) => setForm({ ...form, game_name: e.target.value })}
                className="bg-surface border-border focus-visible:ring-neon-purple rounded-md text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs   text-muted-foreground">
                Categoria
              </Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger id="bounty-category" className="bg-surface border-border focus:ring-neon-purple rounded-md text-sm">
                  <SelectValue placeholder="Escolher..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border rounded-md">
                  {categories?.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id} className="text-sm">
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs   text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-neon-green" /> Recompensa (R$)
              </Label>
              <Input
                id="bounty-reward"
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={form.reward_amount}
                onChange={(e) => setForm({ ...form, reward_amount: e.target.value })}
                className="bg-surface border-border focus-visible:ring-neon-green rounded-md text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs   text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Prazo (opcional)
              </Label>
              <Input
                id="bounty-deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="bg-surface border-border focus-visible:ring-neon-purple rounded-md text-sm"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-border/60 flex items-center justify-between">
            <p className="text-xs text-muted-foreground/60">
              * A recompensa é simbólica — pagamento offline combinado entre as partes.
            </p>
            <Button
              type="submit"
              disabled={loading}
              className="bg-neon-purple hover:bg-neon-purple/90 text-primary-foreground rounded-md font-bold   text-xs h-10 px-6"
            >
              {loading ? "Postando..." : "Postar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
