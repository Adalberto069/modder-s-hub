# Modder's Hub

Contexto do Projeto: > Crie uma plataforma completa de marketplace e comunidade para Modders Mobile (focada em Scripts Lua para Game Guardian e APKs). O design deve ser "Dark Mode" tecnológico, com estética gamer/hacker, focado em performance mobile.

Funcionalidades Principais:

Sistema de Autenticação: Login para Usuários e Modders via Supabase.

Marketplace de Scripts:

Filtro por "Grátis" e "Pago".

Categorias: Root, Virtualizado, Scripts Lua, APKs Mod.

Botão de "Download" para grátis e "Comprar" para pagos (integração visual de checkout).

Status do script: "Working", "Detected" ou "Updating".

Sistema de Ranking e Score:

Cada modder tem um perfil com "Reputação".

Ganha pontos por: Scripts postados, avaliações positivas e número de downloads.

Ranking global na página inicial mostrando os "Top Modders".

Aba de Sugestões e Encomendas (Bounty Board):

Usuários postam pedidos: "Quero script para o jogo [X]".

Possibilidade de sugerir um valor em dinheiro pelo script.

Modders podem aceitar o desafio.

Área de Tutoriais: Uma seção de blog ou cards com pequenos tutoriais sobre como usar scripts e virtualizadores.

Dashboard do Modder: Onde ele pode subir arquivos, ver quanto ganhou e o engajamento dos seus scripts.

Regras de Negócio:

Somente o Modder e o Admin podem deletar scripts.

O Score do modder deve ser atualizado em tempo real no banco de dados.

O layout deve ser responsivo (Mobile-First).

Tecnologias: Use React, Tailwind CSS, Lucide Icons para os ícones e Supabase para o Banco de Dados e Auth.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://hiddenmod.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/db95f84e-891f-4a4e-9646-56f2826ac434).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
