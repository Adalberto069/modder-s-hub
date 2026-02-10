

# ModHub - Marketplace & Comunidade para Modders Mobile

## Visão Geral
Plataforma dark mode com estética gamer/hacker para modders mobile compartilharem e descobrirem Scripts Lua (Game Guardian) e APKs Mod. MVP focado nas funcionalidades essenciais.

---

## Design & Estética
- **Dark mode** com tons de roxo/verde neon, gradientes sutis e estética cyberpunk/hacker
- **Mobile-first** responsivo, cards com bordas brilhantes e animações suaves
- **Tipografia moderna** com fontes monospace para elementos técnicos
- **Lucide Icons** em todo o app

---

## Páginas e Funcionalidades do MVP

### 1. Página Inicial (Home)
- Hero banner com chamada para ação
- **Top Modders** — ranking dos 5 melhores modders por reputação
- Scripts em destaque (mais baixados/recentes)
- Navegação por categorias: Root, Virtualizado, Scripts Lua, APKs Mod

### 2. Autenticação (Supabase Auth)
- Login e cadastro por email/senha
- Dois tipos de conta: **Usuário** e **Modder**
- Modders precisam de **aprovação do Admin** antes de poder publicar

### 3. Marketplace de Scripts
- Listagem com filtros: Grátis/Pago, por categoria
- Cada card mostra: nome, modder, status (**Working** / **Detected** / **Updating**), downloads, avaliação
- Página de detalhe do script com descrição, screenshots, botão Download ou Comprar (visual)
- Suporte a **upload direto** (Supabase Storage) e **links externos**

### 4. Perfil do Modder (público)
- Avatar, bio, score de reputação
- Lista de scripts publicados
- Estatísticas: total downloads, avaliações positivas

### 5. Dashboard do Modder (privado)
- Upload de novos scripts/APKs (formulário com título, descrição, categoria, status, arquivo ou link)
- Lista dos seus scripts com métricas (downloads, avaliações)
- Ganhos simulados (visual, sem pagamento real)

### 6. Painel Admin
- Aprovar/rejeitar solicitações de modders
- Gerenciar scripts (remover conteúdo)
- Visão geral da plataforma

---

## Backend (Supabase - Lovable Cloud)
- **Auth**: login, registro, roles (user, modder, admin) em tabela separada
- **Tabelas**: profiles, scripts, categories, reviews, user_roles
- **Storage**: bucket para uploads de scripts/APKs
- **RLS**: usuários veem scripts públicos; apenas modder/admin deletam scripts
- **Score**: calculado com base em scripts postados, avaliações e downloads

---

## Fora do MVP (futuro)
- Bounty Board (sugestões e encomendas)
- Área de Tutoriais/Blog
- Integração real de pagamentos (Stripe/PIX)
- Notificações em tempo real
- Sistema de comentários nos scripts

