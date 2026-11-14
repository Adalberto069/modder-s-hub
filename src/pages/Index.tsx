import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScriptCard } from "@/components/ScriptCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useModderProfiles } from "@/hooks/use-modder-profiles";
import { useAuth } from "@/lib/auth";
import { ArrowUpRight, Search, Code, BookOpen, MessageSquare, Layers, Users, Smartphone, X } from "lucide-react";

const formatDate = (value: string) => new Date(value).toLocaleDateString("pt-BR");

export default function Index() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const { data: scripts = [], isPending, isError } = useQuery({
    queryKey: ["home-publications", search],
    queryFn: async () => {
      let query = supabase.from("scripts").select("id, title, modder_id, status, download_count, average_rating, is_paid, price, thumbnail_url, script_type, apk_version, apk_min_android, game_name, updated_at, version, categories(slug)").eq("publish_status", "published").order("download_count", { ascending: false }).limit(6);
      if (search) query = query.ilike("title", `%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
  const modderIds = [...new Set(scripts.map(script => script.modder_id))];
  const { data: profiles = {} } = useModderProfiles(modderIds);
  const { data: tutorials = [], isPending: tutorialsPending, isError: tutorialsError } = useQuery({
    queryKey: ["home-tutorials", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("tutorials").select("id, title, description, thumbnail_url, updated_at, category").order("created_at", { ascending: false }).limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: posts = [], isPending: postsPending, isError: postsError } = useQuery({
    queryKey: ["home-community"],
    queryFn: async () => {
      const { data, error } = await supabase.from("forum_posts").select("id, title, category, created_at").order("created_at", { ascending: false }).limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });
  const featured = scripts.find(script => script.thumbnail_url) ?? scripts[0];
  const creators = modderIds.filter(id => profiles[id]);
  const creatorName = (id: string) => profiles[id]?.display_name || profiles[id]?.username || "Autor";

  return (
    <div className="home-refined">
      <Layout>
        <section className="border-b border-border bg-surface">
          <div className="container py-4">
            <form role="search" className="flex gap-2 max-w-2xl" onSubmit={event => { event.preventDefault(); setSearch(searchInput.trim()); document.getElementById("publicacoes")?.scrollIntoView({ block: "start" }); }}>
              <div className="relative flex-1 min-w-0">
                <Search aria-hidden="true" className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input type="search" aria-label="Buscar publicações pelo nome" placeholder="Buscar scripts e APKs pelo nome…" value={searchInput} onChange={event => setSearchInput(event.target.value)} className="pl-10 bg-card" />
              </div>
              <Button type="submit"><Search className="h-4 w-4" /> Buscar</Button>
            </form>
          </div>
        </section>

        <section className="container py-7 sm:py-9">
          <div className={`grid gap-7 items-center ${featured && !search ? "lg:grid-cols-2" : "max-w-2xl"}`}>
            <div>
              <p className="hacker-label text-xs text-primary mb-3">~/comunidade / modding brasileiro</p>
              <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-3">Hidden<span className="text-primary">Mod.</span></h1>
              <p className="text-xl font-semibold text-foreground mb-3">Feito por modders. Descoberto por você.</p>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-lg">Scripts para Game Guardian e APKs de jogos modificados. Encontre seu próximo mod e conheça quem está por trás dele.</p>
              <div className="flex flex-wrap gap-2 mt-5">
                <Button asChild><Link to="/marketplace">Explorar marketplace <ArrowUpRight /></Link></Button>
                <Button asChild variant="outline"><Link to="/marketplace?type=apk"><Smartphone /> APKs de jogos</Link></Button>
              </div>
            </div>
            {featured && !search && (
              <div className="min-w-0">
                <p className="hacker-label text-xs text-muted-foreground mb-2">EM DESTAQUE / COMUNIDADE</p>
                <Link to={`/script/${featured.id}`} className={`block ${featured.thumbnail_url ? "home-feature-media" : "h-20"} bg-card overflow-hidden rounded-md border border-border`} aria-label={`Conhecer ${featured.title}`}>
                  {featured.thumbnail_url ? <img src={featured.thumbnail_url} alt={featured.title} width="640" height="320" fetchPriority="high" className="h-full w-full object-cover" /> : <div className="h-full flex items-center justify-center text-primary"><Code className="h-12 w-12" /></div>}
                </Link>
                <div className="flex items-start justify-between gap-4 mt-3">
                  <div className="min-w-0"><Link to={`/script/${featured.id}`} className="font-bold text-foreground hover:text-primary break-words">{featured.title}</Link><p className="text-sm text-muted-foreground mt-1">{featured.game_name || (featured.script_type === "apk" ? "APK de jogo" : "Game Guardian")} · <Link className="hover:text-primary" to={`/modder/${featured.modder_id}`}>{creatorName(featured.modder_id)}</Link></p></div>
                  <span className="text-primary font-bold whitespace-nowrap">{featured.is_paid ? Number(featured.price ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Grátis"}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section id="publicacoes" className="border-t border-border scroll-mt-20 py-7 sm:py-10">
          <div className="container">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div><p className="hacker-label text-xs text-primary mb-2">/ marketplace</p><h2 className="text-2xl font-bold">{search ? "Resultado da busca" : "Publicações em destaque"}</h2><p className="text-sm text-muted-foreground mt-2">{search ? `Publicações com “${search}” no nome.` : "Compare jogos, versões e criações da comunidade."}</p></div>
              {search ? <Button variant="outline" onClick={() => { setSearch(""); setSearchInput(""); }}><X /> Limpar busca</Button> : <Button asChild variant="ghost"><Link to="/marketplace">Ver todas <ArrowUpRight /></Link></Button>}
            </div>
            {isPending ? <div role="status" className="py-8 text-muted-foreground">Carregando publicações…</div> : isError ? <p role="alert" className="py-6 text-muted-foreground">Não foi possível carregar as publicações agora. Tente novamente em instantes.</p> : scripts.length === 0 ? <div className="border-y border-border py-8"><h3 className="font-semibold">{search ? "Nenhuma publicação encontrada" : "O catálogo está começando"}</h3><p className="text-sm text-muted-foreground mt-2">{search ? "Tente outro nome ou explore o marketplace." : "As criações publicadas pela comunidade aparecerão aqui."}</p></div> : (
              <div className={`catalog-bento home-catalog ${scripts.length === 1 ? "home-single-product" : ""}`}>
                {scripts.map(script => <div key={script.id} className="min-w-0 flex flex-col">
                  <ScriptCard id={script.id} title={script.title} modderName={creatorName(script.modder_id)} modderId={script.modder_id} status={script.status} downloadCount={script.download_count} averageRating={Number(script.average_rating)} isPaid={script.is_paid} price={Number(script.price)} thumbnailUrl={script.thumbnail_url} categorySlug={script.categories?.slug} scriptType={script.script_type} apkVersion={script.apk_version} />
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs mt-3 px-1">
                    <div><dt className="text-muted-foreground">Jogo</dt><dd className="text-foreground break-words mt-1">{script.game_name || "Não informado"}</dd></div>
                    <div><dt className="text-muted-foreground">Compatibilidade</dt><dd className="text-foreground mt-1">{script.script_type === "apk" ? (script.apk_min_android ? `Android ${script.apk_min_android}+` : "Android não informado") : "Game Guardian"}</dd></div>
                    <div><dt className="text-muted-foreground">Versão</dt><dd className="text-foreground mt-1">{(script.script_type === "apk" ? script.apk_version : script.version) || "Não informada"}</dd></div>
                    <div><dt className="text-muted-foreground">Atualização</dt><dd className="text-foreground mt-1"><time dateTime={script.updated_at}>{formatDate(script.updated_at)}</time></dd></div>
                  </dl>
                </div>)}
              </div>
            )}
          </div>
        </section>

        {creators.length > 0 && <section className="border-t border-border py-7 bg-surface"><div className="container"><div className="flex justify-between items-center gap-3 mb-4"><h2 className="text-xl font-bold">Por trás dos mods</h2><Users aria-hidden="true" className="h-5 w-5 text-primary" /></div><div className="flex flex-wrap gap-5">{creators.map(id => <Link key={id} to={`/modder/${id}`} className="flex gap-3 items-center hover:text-primary min-w-0"><Avatar className="h-9 w-9 rounded-md"><AvatarImage src={profiles[id].avatar_url} alt="" /><AvatarFallback>{creatorName(id).charAt(0).toUpperCase()}</AvatarFallback></Avatar><span className="text-sm font-semibold break-words">{creatorName(id)}</span></Link>)}</div></div></section>}

        <section className="border-t border-border py-8 sm:py-10"><div className="container"><h2 className="text-xl font-bold mb-5">Seu ponto de encontro para modding</h2><div className="grid sm:grid-cols-3 gap-6">
          {[{ icon: Layers, title: "Descubra", text: "Explore scripts e APKs. Confira os detalhes e requisitos de cada publicação.", url: "/marketplace" }, { icon: BookOpen, title: "Aprenda", text: "Encontre tutoriais de Game Guardian, Lua e jogos Android.", url: "/tutorials" }, { icon: MessageSquare, title: "Troque ideias", text: "Compartilhe dúvidas e converse com outros jogadores no fórum.", url: "/forum" }].map(item => <div key={item.title} className="border-l-2 border-border pl-4"><item.icon aria-hidden="true" className="h-5 w-5 text-primary mb-3" /><Link to={item.url} className="font-semibold hover:text-primary inline-flex items-center gap-2">{item.title}<ArrowUpRight className="h-4 w-4" /></Link><p className="text-sm text-muted-foreground leading-relaxed mt-2">{item.text}</p></div>)}
        </div></div></section>

        <section className="bg-surface border-t border-border py-8 sm:py-10"><div className="container grid lg:grid-cols-2 gap-10">
          <div><div className="flex items-center justify-between gap-3 mb-5"><h2 className="text-xl font-bold">Tutoriais recentes</h2><Button asChild variant="ghost" size="sm"><Link to="/tutorials">Ver todos <ArrowUpRight /></Link></Button></div>
            {!user ? <div className="border-y border-border py-5"><p className="font-semibold">Aprenda com a comunidade</p><p className="text-sm text-muted-foreground mt-2 mb-4">Entre na sua conta para acessar os tutoriais.</p><Button asChild variant="outline" size="sm"><Link to="/tutorials">Acessar tutoriais <BookOpen /></Link></Button></div> : tutorialsPending ? <p role="status" className="text-muted-foreground text-sm">Carregando tutoriais…</p> : tutorialsError ? <p className="text-muted-foreground text-sm">Não foi possível carregar os tutoriais agora.</p> : tutorials.length === 0 ? <p className="text-muted-foreground text-sm">Ainda não há tutoriais publicados. Novos guias aparecerão aqui.</p> : <div className="divide-y divide-border">{tutorials.map(tutorial => <Link key={tutorial.id} to={`/tutorial/${tutorial.id}`} className="flex items-center gap-4 py-4 first:pt-0 group">{tutorial.thumbnail_url ? <img src={tutorial.thumbnail_url} alt="" width="96" height="64" loading="lazy" className="w-24 h-16 object-cover rounded-md shrink-0" /> : <BookOpen aria-hidden="true" className="h-8 w-8 text-primary shrink-0" />}<div className="min-w-0"><h3 className="font-semibold text-sm group-hover:text-primary break-words">{tutorial.title}</h3><p className="text-xs text-muted-foreground mt-2">Atualizado em <time dateTime={tutorial.updated_at}>{formatDate(tutorial.updated_at)}</time></p></div></Link>)}</div>}
          </div>
          <div><div className="flex items-center justify-between gap-3 mb-5"><h2 className="text-xl font-bold">Na comunidade</h2><Button asChild variant="ghost" size="sm"><Link to="/forum">Abrir fórum <ArrowUpRight /></Link></Button></div>
            {postsPending ? <p role="status" className="text-muted-foreground text-sm">Carregando conversas…</p> : postsError ? <p className="text-muted-foreground text-sm">Não foi possível carregar as conversas agora.</p> : posts.length === 0 ? <div className="border-y border-border py-5"><p className="font-semibold">A próxima conversa pode ser sua</p><p className="text-sm text-muted-foreground mt-2">Ainda não há publicações no fórum. Compartilhe uma dúvida ou ideia.</p></div> : <div className="divide-y divide-border">{posts.map(post => <Link key={post.id} to="/forum" className="block py-4 first:pt-0 group"><p className="hacker-label text-xs text-primary mb-2">{post.category}</p><h3 className="font-semibold text-sm group-hover:text-primary break-words">{post.title}</h3><time dateTime={post.created_at} className="block text-xs text-muted-foreground mt-2">{formatDate(post.created_at)}</time></Link>)}</div>}
          </div>
        </div></section>
      </Layout>
    </div>
  );
}
