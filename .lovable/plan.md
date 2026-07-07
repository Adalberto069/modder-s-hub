# Plano: APK Mod dedicado + Dashboards unificados

## Parte 1 — Sistema de APK Mod (separar de Script)

### 1.1 Schema (migração)
Adicionar colunas em `scripts` (o tipo `apk` já existe):
- `apk_version` text — versão do mod (ex: "2.14.0-MOD")
- `apk_min_android` text — versão mínima (ex: "8.0")
- `apk_package_name` text — com.exemplo.app
- `apk_size_mb` numeric — tamanho
- `apk_changelog` text — o que mudou
- `apk_original_app` text — nome do app base

### 1.2 Editor (`ScriptEditor.tsx`)
Quando `scriptType === "apk"`:
- Título da página: "Novo APK Mod" / "Editar APK Mod"
- Substituir seção "Código Lua" por card "Detalhes do APK Mod" com os campos novos
- Renomear labels: "Nome do script" → "Nome do APK Mod", "Descrição do script" → "Descrição do mod"
- Botão: "Publicar APK Mod"
- Esconder campos irrelevantes (licenciamento por dias, senha de script, análise de código Lua)

### 1.3 Página de detalhes dedicada
Novo arquivo `src/pages/ApkDetail.tsx` + rota `/apk/:id`:
- Header com ícone Android, badge "APK MOD", versão
- Grid de screenshots (usa `script_images`)
- Sidebar com: versão, tamanho, min Android, package, downloads, autor
- Aba Descrição / Changelog / Reviews
- Botão "Baixar APK" (usa mesmo `download-script` edge function)
- Roteador: em `ScriptCard` e listas, se `script_type === "apk"` → link `/apk/:id`

### 1.4 Marketplace
- `ScriptCard` detecta `apk` → ícone Smartphone, badge verde "APK", mostra versão em vez de "Lua"
- Filtro/aba "APK Mods" no Marketplace

## Parte 2 — Dashboards unificados (mesma estrutura)

Padrão visual compartilhado: **KPI strip no topo (4 cards) + Tabs abaixo**.

### 2.1 Componente compartilhado
Criar `src/components/dashboard/KpiCard.tsx` e `DashboardShell.tsx`:
- KpiCard: ícone + label + valor grande + delta opcional
- DashboardShell: header (título+subtítulo+ação), grid de KPIs, TabsList sticky, TabsContent

### 2.2 Dashboard do Modder (`src/pages/Dashboard.tsx`)
KPIs: Vendas totais (R$) · Downloads · Scripts ativos · Avaliação média
Abas: **Visão Geral** · **Meus Scripts** · **Meus APKs** · **Vendas** · **Financeiro** · **Encomendas**
- Separar tab "Meus APKs" dos scripts Lua
- Visão Geral: gráfico de vendas + últimas atividades

### 2.3 Dashboard do Admin (`src/pages/Admin.tsx`)
KPIs: Usuários · Modders ativos · Vendas 30d · Pendências (moderação+saques+disputas)
Abas mantidas mas com o mesmo shell/estilo do modder para consistência.

## Detalhes técnicos

- Rota nova: adicionar `<Route path="/apk/:id" element={<ApkDetail />} />` em `App.tsx`
- Migration: `ALTER TABLE public.scripts ADD COLUMN apk_version text, ...` (nullable, sem default)
- Types regenerados automaticamente após migration
- Reutilizar `download-script` edge function (já entrega arquivo do bucket)
- `ScriptCard`: prop já tem `script_type`; adicionar branch de UI e link condicional
- `Marketplace.tsx`: adicionar tab "APK Mods" filtrando `script_type='apk'`

## Arquivos afetados
- migração SQL (novas colunas)
- `src/pages/ScriptEditor.tsx` (branch APK completo)
- `src/pages/ApkDetail.tsx` (novo)
- `src/App.tsx` (rota)
- `src/components/ScriptCard.tsx` (UI condicional)
- `src/pages/Marketplace.tsx` (aba APK)
- `src/components/dashboard/KpiCard.tsx` + `DashboardShell.tsx` (novos)
- `src/pages/Dashboard.tsx` (reestrutura + aba APKs)
- `src/pages/Admin.tsx` (aplica shell + KPIs)

## Fora do escopo
- Novos métodos de pagamento
- Assinatura/verificação APK server-side além da já existente
- Refatorar edge functions