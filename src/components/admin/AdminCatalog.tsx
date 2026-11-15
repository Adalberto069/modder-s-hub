import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { parseCatalogPrice, categorySlug } from "@/lib/admin-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, Pencil, Plus, Save, ArrowUpRight, Loader2, Folder, Code, Smartphone } from "lucide-react";
import { toast } from "sonner";

interface ScriptDraft { id: string; title: string; description: string; game_name: string; category_id: string; is_paid: boolean; price: string; }
interface CategoryDraft { id?: string; name: string; slug: string; description: string; }
const statuses: Record<string, string> = { draft: "Rascunho", pending_review: "Em análise", published: "Publicado", archived: "Arquivado" };

export function AdminCatalog({ mode }: { mode: "scripts" | "categories" }) {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [scriptDraft, setScriptDraft] = useState<ScriptDraft | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const { data: scripts = [], isPending, isError, refetch } = useQuery({
    queryKey: ["admin-catalog-scripts"], enabled: isAdmin && mode === "scripts",
    queryFn: async () => {
      const { data, error } = await supabase.from("scripts").select("id, title, description, game_name, category_id, is_paid, price, publish_status, script_type, updated_at").order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: categories = [], isPending: categoriesPending, isError: categoriesError } = useQuery({
    queryKey: ["admin-catalog-categories"], enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name, slug, description").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const invalidateCatalog = async () => {
    await Promise.all(["admin-catalog-scripts", "admin-catalog-categories", "admin-scripts", "categories", "scripts", "home-publications", "featured-scripts", "script"].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
  };
  const saveScript = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAdmin || !scriptDraft || saving) return;
    const price = scriptDraft.is_paid ? parseCatalogPrice(scriptDraft.price) : 0;
    if (!scriptDraft.title.trim() || price === null) { setFormError("Informe o nome e um preço válido, com até duas casas decimais."); return; }
    setSaving(true); setFormError("");
    try {
      const { data, error } = await supabase.from("scripts").update({ title: scriptDraft.title.trim(), description: scriptDraft.description.trim() || null, game_name: scriptDraft.game_name.trim() || null, category_id: scriptDraft.category_id === "none" ? null : scriptDraft.category_id, is_paid: scriptDraft.is_paid, price }).eq("id", scriptDraft.id).select("id").single();
      if (error || !data) throw error ?? new Error("Não foi possível salvar.");
      await invalidateCatalog(); setScriptDraft(null); toast.success("Publicação atualizada.");
    } catch (error) { setFormError(error instanceof Error ? error.message : "Não foi possível salvar a publicação."); }
    finally { setSaving(false); }
  };
  const saveCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAdmin || !categoryDraft || saving) return;
    const slug = categorySlug(categoryDraft.slug);
    if (!categoryDraft.name.trim() || !slug) { setFormError("Informe o nome e um identificador válido."); return; }
    setSaving(true); setFormError("");
    try {
      const values = { name: categoryDraft.name.trim(), slug, description: categoryDraft.description.trim() || null };
      const query = categoryDraft.id ? supabase.from("categories").update(values).eq("id", categoryDraft.id) : supabase.from("categories").insert(values);
      const { data, error } = await query.select("id").single();
      if (error || !data) throw error ?? new Error("Não foi possível salvar.");
      await invalidateCatalog(); setCategoryDraft(null); toast.success("Categoria salva.");
    } catch (error) { setFormError(error && typeof error === "object" && "message" in error ? String(error.message) : "Não foi possível salvar a categoria."); }
    finally { setSaving(false); }
  };
  if (!isAdmin) return null;
  const visibleScripts = scripts.filter(script => script.title.toLowerCase().includes(search.toLowerCase()) && (type === "all" || script.script_type === type) && (status === "all" || script.publish_status === status));
  const visibleCategories = categories.filter(category => category.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap"><div><h2 className="text-xl font-bold">{mode === "scripts" ? "Publicações e preços" : "Categorias"}</h2><p className="text-sm text-muted-foreground mt-1">{mode === "scripts" ? `${scripts.length} publicações cadastradas` : `${categories.length} categorias cadastradas`}</p></div>{mode === "categories" && <Button size="sm" onClick={() => { setFormError(""); setCategoryDraft({ name: "", slug: "", description: "" }); }}><Plus /> Nova categoria</Button>}</div>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input aria-label={mode === "scripts" ? "Buscar publicações" : "Buscar categorias"} placeholder={mode === "scripts" ? "Buscar publicação…" : "Buscar categoria…"} value={search} onChange={event => setSearch(event.target.value)} className="pl-9" /></div>
        {mode === "scripts" && <><Select value={type} onValueChange={setType}><SelectTrigger aria-label="Tipo de publicação" className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os tipos</SelectItem><SelectItem value="script">Scripts Lua</SelectItem><SelectItem value="apk">APKs</SelectItem></SelectContent></Select><Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Status de publicação" className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(statuses).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></>}
      </div>
      {(mode === "scripts" ? isPending : categoriesPending) ? <p role="status" className="py-8 text-sm text-muted-foreground">Carregando…</p> : (mode === "scripts" ? isError : categoriesError) ? <div role="alert" className="py-6"><p>Não foi possível carregar os dados.</p><Button variant="outline" size="sm" onClick={() => { void refetch(); void queryClient.invalidateQueries({ queryKey: ["admin-catalog-categories"] }); }}>Tentar novamente</Button></div> : mode === "scripts" ? (
        <div className="border-y border-border divide-y divide-border">
          {visibleScripts.length === 0 && <p className="py-8 text-sm text-muted-foreground">Nenhuma publicação encontrada.</p>}
          {visibleScripts.map(script => <div key={script.id} className="grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_7rem_auto] gap-3 items-center py-3">
            <div className="min-w-0"><div className="flex items-center gap-2"><span className="text-primary shrink-0">{script.script_type === "apk" ? <Smartphone className="h-4 w-4" /> : <Code className="h-4 w-4" />}</span><p className="text-sm font-semibold truncate">{script.title}</p><Badge variant="outline" className="text-xs shrink-0">{script.script_type === "apk" ? "APK" : "Lua"}</Badge></div><p className="text-xs text-muted-foreground mt-1">{statuses[script.publish_status] ?? script.publish_status} · {script.game_name || "Jogo não informado"}</p></div>
            <span className="hidden lg:block text-sm text-muted-foreground truncate">{categories.find(category => category.id === script.category_id)?.name || "Sem categoria"}</span>
            <span className="text-sm font-semibold col-start-1 row-start-2 lg:col-auto lg:row-auto">{script.is_paid ? Number(script.price ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Grátis"}</span>
            <div className="flex gap-1 col-start-2 row-span-2 row-start-1 lg:col-auto lg:row-auto lg:row-span-1"><Button size="sm" variant="outline" aria-label={`Editar ${script.title}`} onClick={() => { setFormError(""); setScriptDraft({ id: script.id, title: script.title, description: script.description ?? "", game_name: script.game_name ?? "", category_id: script.category_id ?? "none", is_paid: script.is_paid, price: String(script.price ?? 0) }); }}><Pencil /> Editar</Button><Button asChild variant="ghost" size="icon" title="Editor completo"><Link to={`/script/${script.id}/edit`} aria-label={`Abrir editor completo de ${script.title}`}><ArrowUpRight className="h-4 w-4" /></Link></Button></div>
          </div>)}
        </div>
      ) : <div className="border-y border-border divide-y divide-border">{visibleCategories.length === 0 && <p className="py-8 text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>}{visibleCategories.map(category => <div key={category.id} className="flex gap-3 items-center py-3"><Folder className="h-4 w-4 text-primary shrink-0" /><div className="flex-1 min-w-0"><p className="text-sm font-semibold break-words">{category.name}</p><p className="text-xs text-muted-foreground break-words mt-1">{category.slug}{category.description ? ` · ${category.description}` : ""}</p></div><Button variant="outline" size="icon" aria-label={`Editar categoria ${category.name}`} title="Editar categoria" onClick={() => { setFormError(""); setCategoryDraft({ ...category, description: category.description ?? "" }); }}><Pencil className="h-4 w-4" /></Button></div>)}</div>}
      <Dialog open={!!scriptDraft} onOpenChange={open => { if (!open && !saving) setScriptDraft(null); }}><DialogContent><DialogHeader><DialogTitle>Editar publicação</DialogTitle><DialogDescription>As alterações salvas atualizam os dados desta publicação no catálogo.</DialogDescription></DialogHeader>{scriptDraft && <form onSubmit={saveScript} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="admin-title">Nome</Label><Input id="admin-title" required maxLength={200} value={scriptDraft.title} onChange={e => setScriptDraft({ ...scriptDraft, title: e.target.value })} /></div>
        <div className="grid sm:grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="admin-game">Jogo</Label><Input id="admin-game" value={scriptDraft.game_name} onChange={e => setScriptDraft({ ...scriptDraft, game_name: e.target.value })} /></div><div className="space-y-2"><Label>Categoria</Label><Select value={scriptDraft.category_id} onValueChange={value => setScriptDraft({ ...scriptDraft, category_id: value })}><SelectTrigger aria-label="Categoria da publicação" disabled={categoriesPending || categoriesError}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem categoria</SelectItem>{categories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div></div>
        <div className="space-y-2"><Label htmlFor="admin-description">Descrição</Label><Textarea id="admin-description" rows={4} value={scriptDraft.description} onChange={e => setScriptDraft({ ...scriptDraft, description: e.target.value })} /></div>
        <div className="flex items-center justify-between border-t border-border pt-4"><Label htmlFor="admin-paid">Publicação paga</Label><Switch id="admin-paid" checked={scriptDraft.is_paid} onCheckedChange={checked => setScriptDraft({ ...scriptDraft, is_paid: checked })} /></div>
        {scriptDraft.is_paid && <div className="space-y-2"><Label htmlFor="admin-price">Preço (R$)</Label><Input id="admin-price" inputMode="decimal" required value={scriptDraft.price} onChange={e => setScriptDraft({ ...scriptDraft, price: e.target.value })} /></div>}
        {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => setScriptDraft(null)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Salvar alterações</Button></div>
      </form>}</DialogContent></Dialog>
      <Dialog open={!!categoryDraft} onOpenChange={open => { if (!open && !saving) setCategoryDraft(null); }}><DialogContent><DialogHeader><DialogTitle>{categoryDraft?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle><DialogDescription>Organize as categorias usadas pelas publicações.</DialogDescription></DialogHeader>{categoryDraft && <form onSubmit={saveCategory} className="space-y-4"><div className="space-y-2"><Label htmlFor="category-name">Nome</Label><Input id="category-name" required value={categoryDraft.name} onChange={e => setCategoryDraft({ ...categoryDraft, name: e.target.value, slug: categoryDraft.id ? categoryDraft.slug : categorySlug(e.target.value) })} /></div><div className="space-y-2"><Label htmlFor="category-slug">Identificador</Label><Input id="category-slug" required value={categoryDraft.slug} onChange={e => setCategoryDraft({ ...categoryDraft, slug: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="category-description">Descrição</Label><Textarea id="category-description" value={categoryDraft.description} onChange={e => setCategoryDraft({ ...categoryDraft, description: e.target.value })} /></div>{formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}<div className="flex justify-end gap-2"><Button variant="outline" type="button" disabled={saving} onClick={() => setCategoryDraft(null)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Salvar categoria</Button></div></form>}</DialogContent></Dialog>
    </section>
  );
}