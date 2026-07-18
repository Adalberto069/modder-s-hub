# Sistema de Custódia (Escrow) para Compras

Segurar o pagamento do modder por **12 horas** após o download. Se o cliente não reclamar nesse prazo, libera automaticamente. Aplica-se a **scripts Lua e APK Mods**.

## Fluxo

```text
Compra aprovada (MP)
        │
        ▼
  escrow_status = 'held'
        │
        ▼
Cliente baixa ─────► inicia contador 12h
        │
        ├──► Cliente clica "Confirmar recebimento" ──► released
        ├──► 12h expiram sem ação ──► released (cron)
        └──► Cliente clica "Abrir disputa" ──► disputed (admin arbitra)
```

## Mudanças no banco

Adicionar em `script_purchases` e `bounty_purchases`:
- `escrow_status` (`held` | `released` | `disputed` | `refunded`) — default `held`
- `escrow_release_at` (timestamptz) — preenchido no primeiro download (+12h)
- `escrow_released_at` (timestamptz)
- `escrow_dispute_reason` (text)
- `escrow_disputed_at` (timestamptz)

Nova tabela `purchase_disputes`:
- purchase_id, purchase_type (`script` | `bounty`), opener_id, reason, status (`open`|`resolved_buyer`|`resolved_seller`), admin_notes, resolved_by, resolved_at

## Backend

**Trigger no download** (`download-script` / `download-bounty-delivery`):
- Se `escrow_release_at` for null → seta `now() + 12h`.

**Edge Function `confirm-purchase`** — cliente confirma manualmente (libera na hora).

**Edge Function `open-dispute`** — cliente abre disputa dentro da janela de 12h. Bloqueia liberação automática.

**Edge Function `release-escrow-cron`** — roda de hora em hora via pg_cron:
- Marca como `released` todas as compras com `escrow_status='held'` E `escrow_release_at < now()` E sem disputa aberta.
- Envia notificação ao modder ("💰 Pagamento liberado").

**Financeiro do modder** (`ModderFinanceTab`):
- Saldo dividido em **"Pendente (custódia)"** e **"Disponível"**.
- Só o disponível conta pra saque.

## Frontend

**Dashboard do cliente** — nova coluna "Status" nas compras:
- `Em custódia · libera em 8h 42m` + botões [Confirmar recebimento] [Abrir disputa]
- `✓ Liberado` (verde)
- `⚠ Em disputa` (amarelo)

**Dashboard do modder** — badge de "custódia" em cada venda + card "Pendente de liberação: R$ X,XX".

**Admin** — nova aba `Disputas de Compra` (reaproveita padrão do `AdminDisputesTab`): lista disputas abertas, botões [Liberar pro modder] [Reembolsar cliente].

## Reembolso em disputa

Quando admin decide a favor do cliente:
- Chama API do MP `POST /v1/payments/{id}/refunds` (via token OAuth do modder).
- Marca `escrow_status='refunded'`, revoga `script_access` / `script_licenses`.

## Cron

```sql
select cron.schedule(
  'release-escrow-hourly',
  '0 * * * *',
  $$ select net.http_post(url:='.../release-escrow-cron', ...) $$
);
```

## Arquivos afetados

- Migração: colunas novas + tabela `purchase_disputes` + grants + RLS.
- `supabase/functions/confirm-purchase/index.ts` (novo)
- `supabase/functions/open-dispute/index.ts` (novo)
- `supabase/functions/release-escrow-cron/index.ts` (novo)
- `supabase/functions/download-script/index.ts` (setar `escrow_release_at`)
- `supabase/functions/download-bounty-delivery/index.ts` (idem)
- `supabase/functions/mercadopago-webhook/index.ts` (setar `escrow_status='held'` ao aprovar)
- `src/pages/Dashboard.tsx` (aba "Compras" com status escrow + ações)
- `src/components/modder/ModderFinanceTab.tsx` (split pendente/disponível)
- `src/components/admin/AdminPurchaseDisputesTab.tsx` (novo)
- `src/pages/Admin.tsx` (adicionar aba)

## Fora do escopo

- Alterar taxas ou split do MP.
- Sistema de reputação por disputas (fica pra depois).
- Notificação por email (usa só notificações in-app existentes).
