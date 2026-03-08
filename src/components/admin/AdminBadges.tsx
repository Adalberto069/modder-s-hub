import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Plus, Trash2, Pencil, Award, Clock, Code, Layers, Download, Trophy, ShieldCheck, Search, UserPlus, X,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const ICON_OPTIONS = [
  { value: "award", label: "Award", Icon: Award },
  { value: "clock", label: "Clock", Icon: Clock },
  { value: "code", label: "Code", Icon: Code },
  { value: "layers", label: "Layers", Icon: Layers },
  { value: "download", label: "Download", Icon: Download },
  { value: "trophy", label: "Trophy", Icon: Trophy },
  { value: "shield-check", label: "Shield", Icon: ShieldCheck },
];

const CATEGORY_OPTIONS = [
  { value: "achievement", label: "Conquista" },
  { value: "milestone", label: "Marco" },
  { value: "special", label: "Especial" },
];

const DEFAULT_COLORS = [
  "hsl(142, 76%, 55%)",
  "hsl(280, 100%, 70%)",
  "hsl(190, 95%, 60%)",
  "hsl(340, 82%, 60%)",
  "hsl(45, 100%, 60%)",
  "hsl(210, 100%, 60%)",
];

interface BadgeForm {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  sort_order: number;
}

const emptyForm: BadgeForm = {
  slug: "",
  name: "",
  description: "",
  icon: "award",
  color: DEFAULT_COLORS[0],
  category: "achievement",
  sort_order: 0,
};

export function AdminBadges() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BadgeForm>(emptyForm);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignBadgeId, setAssignBadgeId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");

  // Fetch badge definitions
  const { data: badges = [] } = useQuery({
    queryKey: ["admin-badge-definitions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("badge_definitions")
        .select("*")
        .order("sort_order", { ascending: true });
      return data ?? [];
    },
  });

  // Fetch all user badges with profile info
  const { data: userBadges = [] } = useQuery({
    queryKey: ["admin-user-badges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_badges")
        .select("id, user_id, badge_id, earned_at")
        .order("earned_at", { ascending: false });
      return data ?? [];
    },
  });

  // Fetch profiles for user badge display
  const ubUserIds = [...new Set(userBadges.map((ub: any) => ub.user_id))];
  const { data: ubProfiles = [] } = useQuery({
    queryKey: ["admin-ub-profiles", ubUserIds],
    queryFn: async () => {
      if (!ubUserIds.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, username, display_name").in("user_id", ubUserIds);
      return data ?? [];
    },
    enabled: ubUserIds.length > 0,
  });
  const profileMap = Object.fromEntries(ubProfiles.map((p: any) => [p.user_id, p]));

  // Search users for assignment
  const { data: searchResults = [] } = useQuery({
    queryKey: ["admin-user-search", userSearch],
    queryFn: async () => {
      if (!userSearch.trim()) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name")
        .or(`username.ilike.%${userSearch.trim()}%,display_name.ilike.%${userSearch.trim()}%`)
        .limit(10);
      return data ?? [];
    },
    enabled: userSearch.trim().length >= 2,
  });

  // Save badge definition
  const saveBadge = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error("Nome e slug são obrigatórios");
      return;
    }

    if (editingId) {
      const { error } = await supabase.from("badge_definitions").update(form).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Badge atualizado!");
    } else {
      const { error } = await supabase.from("badge_definitions").insert(form);
      if (error) { toast.error(error.message); return; }
      toast.success("Badge criado!");
    }

    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    queryClient.invalidateQueries({ queryKey: ["admin-badge-definitions"] });
  };

  const deleteBadge = async (id: string) => {
    const { error } = await supabase.from("badge_definitions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Badge removido!");
      queryClient.invalidateQueries({ queryKey: ["admin-badge-definitions"] });
    }
  };

  const openEdit = (badge: any) => {
    setForm({
      slug: badge.slug,
      name: badge.name,
      description: badge.description ?? "",
      icon: badge.icon,
      color: badge.color,
      category: badge.category,
      sort_order: badge.sort_order,
    });
    setEditingId(badge.id);
    setFormOpen(true);
  };

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(true);
  };

  // Assign badge to user
  const assignBadge = async (userId: string) => {
    if (!assignBadgeId) return;

    // Check if already assigned
    const existing = userBadges.find(
      (ub: any) => ub.user_id === userId && ub.badge_id === assignBadgeId
    );
    if (existing) {
      toast.error("Este usuário já possui este badge");
      return;
    }

    const { error } = await supabase.from("user_badges").insert({
      user_id: userId,
      badge_id: assignBadgeId,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Badge atribuído!");
      queryClient.invalidateQueries({ queryKey: ["admin-user-badges"] });
      queryClient.invalidateQueries({ queryKey: ["user-badges"] });
      setAssignOpen(false);
      setUserSearch("");
    }
  };

  const removeBadgeFromUser = async (userBadgeId: string) => {
    const { error } = await supabase.from("user_badges").delete().eq("id", userBadgeId);
    if (error) toast.error(error.message);
    else {
      toast.success("Badge removido do usuário!");
      queryClient.invalidateQueries({ queryKey: ["admin-user-badges"] });
      queryClient.invalidateQueries({ queryKey: ["user-badges"] });
    }
  };

  const getIconComponent = (iconName: string) => {
    const found = ICON_OPTIONS.find((i) => i.value === iconName);
    return found ? found.Icon : Award;
  };

  return (
    <Card className="neon-border bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" /> Gerenciar Badges
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="definitions">
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="definitions" className="text-xs gap-1">
              <Award className="h-3 w-3" /> Definições ({badges.length})
            </TabsTrigger>
            <TabsTrigger value="assignments" className="text-xs gap-1">
              <UserPlus className="h-3 w-3" /> Atribuições ({userBadges.length})
            </TabsTrigger>
          </TabsList>

          {/* Badge Definitions */}
          <TabsContent value="definitions" className="space-y-3">
            <Button size="sm" className="neon-glow-green gap-2" onClick={openNew}>
              <Plus className="h-4 w-4" /> Novo Badge
            </Button>

            {badges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum badge definido.</p>
            ) : (
              <div className="space-y-2">
                {badges.map((badge: any) => {
                  const Icon = getIconComponent(badge.icon);
                  return (
                    <div key={badge.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="flex items-center justify-center h-8 w-8 rounded-full shrink-0"
                          style={{ backgroundColor: `${badge.color}20`, color: badge.color }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{badge.name}</span>
                            <Badge variant="outline" className="text-[10px]">{badge.category}</Badge>
                            <span className="text-[10px] text-muted-foreground font-mono">{badge.slug}</span>
                          </div>
                          {badge.description && (
                            <p className="text-xs text-muted-foreground truncate">{badge.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(badge)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => { setAssignBadgeId(badge.id); setAssignOpen(true); setUserSearch(""); }}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteBadge(badge.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Badge Assignments */}
          <TabsContent value="assignments" className="space-y-2">
            {userBadges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum badge atribuído.</p>
            ) : (
              userBadges.map((ub: any) => {
                const profile = profileMap[ub.user_id];
                const badge = badges.find((b: any) => b.id === ub.badge_id);
                if (!badge) return null;
                const Icon = getIconComponent(badge.icon);
                return (
                  <div key={ub.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex items-center justify-center h-6 w-6 rounded-full shrink-0"
                        style={{ backgroundColor: `${badge.color}20`, color: badge.color }}
                      >
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{profile?.display_name ?? profile?.username ?? "Usuário"}</span>
                        <span className="text-xs text-muted-foreground ml-2">{badge.name}</span>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeBadgeFromUser(ub.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>

        {/* Create/Edit Badge Dialog */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-mono">{editingId ? "Editar Badge" : "Novo Badge"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
                  <Input
                    placeholder="Ex: Early Member"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Slug</label>
                  <Input
                    placeholder="Ex: early-member"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Descrição</label>
                <Textarea
                  placeholder="Descrição do badge..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="min-h-[60px]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Ícone</label>
                  <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <opt.Icon className="h-3.5 w-3.5" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Ordem</label>
                  <Input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {DEFAULT_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`h-8 w-8 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setForm({ ...form, color: c })}
                    />
                  ))}
                  <Input
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="flex-1 min-w-[140px] h-8 text-xs"
                    placeholder="hsl(142, 76%, 55%)"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30">
                <span className="text-xs text-muted-foreground">Preview:</span>
                {(() => {
                  const Icon = getIconComponent(form.icon);
                  return (
                    <div
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                      style={{ borderColor: form.color, color: form.color, backgroundColor: `${form.color}15` }}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{form.name || "Badge"}</span>
                    </div>
                  );
                })()}
              </div>

              <Button className="w-full neon-glow-green" onClick={saveBadge}>
                {editingId ? "Salvar Alterações" : "Criar Badge"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Assign Badge Dialog */}
        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-mono">Atribuir Badge</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <p className="text-xs text-muted-foreground">
                Badge: <strong>{badges.find((b: any) => b.id === assignBadgeId)?.name}</strong>
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuário..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {searchResults.map((u: any) => (
                    <button
                      key={u.user_id}
                      className="flex items-center justify-between w-full p-2 rounded-lg bg-secondary/30 hover:bg-secondary/60 transition-colors text-left"
                      onClick={() => assignBadge(u.user_id)}
                    >
                      <div>
                        <p className="text-sm font-medium">{u.display_name ?? u.username}</p>
                        <p className="text-[10px] text-muted-foreground">@{u.username}</p>
                      </div>
                      <UserPlus className="h-4 w-4 text-primary shrink-0" />
                    </button>
                  ))}
                </div>
              )}
              {userSearch.trim().length >= 2 && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum usuário encontrado.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
