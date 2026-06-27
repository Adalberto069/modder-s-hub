
# Reorganização Estrutural do Banco — HiddenMod

## ⚠️ Aviso importante antes de começar

A API do Supabase (PostgREST) usada pelo frontend só expõe o schema `public` por padrão. Mover tabelas para outros schemas (ex: `forum`, `bounty`) quebraria **todo** o app e exigiria reconfiguração da Data API. Por isso, em vez de criar schemas Postgres separados, vou organizar por **prefixo de domínio** nos nomes das tabelas + agrupamento lógico documentado. É o padrão usado em projetos Supabase em produção e mantém zero downtime.

## Diagnóstico atual

Temos 35 tabelas misturadas. Agrupando por domínio:

```text
AUTH/USERS    profiles, user_roles, user_badges, badge_definitions
SCRIPTS       scripts, script_access, script_analyses, script_images,
              script_passwords, script_test_logs, categories, favorites, reviews
LICENSES      licenses, purchases
BOUNTY        bounties, bounty_applications, bounty_deliveries,
              bounty_messages, bounty_purchases, bounty_test_logs
FORUM         forum_posts, forum_replies, forum_reply_likes
TUTORIALS     tutorials, tutorial_comments, tutorial_ratings
PAYMENTS      modder_mp_accounts
MODERATION    moderation_logs, moderation_messages, reports, audit_runs
PLATFORM      notifications, tools
```

Problemas observados:
- Nomes inconsistentes (`bounty_*` ok, mas `script_*` vs `scripts`, `forum_*` vs `tutorials`).
- `purchases` e `bounty_purchases` quase duplicadas — poderiam compartilhar estrutura.
- `script_access` (4 colunas) parece redundante com `licenses` + `purchases`.
- Faltam índices em FKs muito consultadas (a confirmar via `pg_stat_statements`).
- Algumas tabelas sem trigger `updated_at` apesar de terem a coluna.

## Plano de execução (3 fases, incrementais e reversíveis)

### Fase 1 — Auditoria + ganhos imediatos (sem renomear nada)
1. Rodar `supabase--read_query` listando: FKs sem índice, colunas órfãs, policies duplicadas, triggers faltantes.
2. Rodar `supabase--slow_queries` para identificar top 10 queries lentas.
3. Migração única adicionando:
   - Índices faltantes em FKs (`user_id`, `script_id`, `bounty_id`, etc).
   - Trigger `update_updated_at_column` nas tabelas que têm `updated_at` mas não o trigger.
   - Comentários SQL (`COMMENT ON TABLE`) documentando o domínio de cada tabela — aparece no dashboard.

### Fase 2 — Consolidação semântica
1. Avaliar fundir `script_access` em `licenses` (verificar se há código dependente).
2. Padronizar colunas de status com enums Postgres em vez de `text` livre (`bounty_status`, `purchase_status`).
3. Adicionar constraints `CHECK` / `NOT NULL` faltantes em colunas críticas (preços, IDs).
4. Normalizar timestamps: garantir `timestamptz` em todas, com default `now()`.

### Fase 3 — Renomes opcionais (só se você topar refator de código)
Renomear para prefixo consistente por domínio:
- `reviews` → `script_reviews`
- `favorites` → `script_favorites`
- `purchases` → `script_purchases`
- `licenses` → `script_licenses`
- `categories` → `script_categories`

Cada rename é feito com `ALTER TABLE … RENAME` + atualização de todas as referências no frontend e edge functions. Faço um arquivo por vez para minimizar risco.

## O que vou entregar nesta rodada

Se você aprovar, começo pela **Fase 1 completa** (auditoria + migração de índices + triggers + comentários). É 100% seguro, não quebra nada e já deixa o banco visivelmente mais organizado no dashboard. Depois confirmo com você antes de seguir para Fase 2 e 3.

## Detalhes técnicos

- Migrações via tool `supabase--migration` (cada fase = 1 migração revisável).
- Validação após cada fase: `supabase--linter` + smoke test das principais queries.
- Renomes na Fase 3 usam `ALTER TABLE … RENAME TO …`; o tipo `Database` em `src/integrations/supabase/types.ts` é regenerado automaticamente.
- Nenhuma mudança em `auth`, `storage`, `realtime` ou buckets.

Posso iniciar pela Fase 1?
