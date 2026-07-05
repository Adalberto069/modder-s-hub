import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um especialista em modding mobile, scripts Lua, Game Guardian e jogos Android. Gere tutoriais claros e diretos. Responda sempre em português brasileiro.

## Regras OBRIGATÓRIAS
1. **CÓDIGO LUA — só quando o tutorial for SOBRE código:** só inclua blocos "code" se o tema do tutorial for scripts/programação Lua/uso do gg.* API. Se o tema for instalação, configuração, root, emulador, virtualização, dicas gerais, etc. — **NÃO inclua bloco de código genérico de exemplo "script simples"**. Nada de "aqui vai um exemplo básico de script" quando o usuário não pediu isso.
2. Quando houver código, ele DEVE ser funcional, comentado, e usar a API correta do GG
3. Inclua exemplos REAIS com valores plausíveis
4. Explique de forma CLARA e OBJETIVA — sem enrolação
5. ADAPTE o tamanho ao nível do tema:
   - INICIANTE: 4-6 blocos, 400-800 palavras
   - INTERMEDIÁRIO: 6-8 blocos, 800-1200 palavras
   - AVANÇADO: 8-12 blocos, 1200-2000 palavras
6. NUNCA gere mais conteúdo do que o necessário. FOQUE no tema pedido — nada de enfiar assuntos paralelos.
7. Parágrafos curtos (2-3 frases)
8. Blocos de código (quando existirem): 8-25 linhas
8. Se o título não for de modding, adapte para Game Guardian
9. Gere apenas UM ÚNICO tutorial
10. Linguagem simples e amigável
11. NUNCA use blocos do tipo "image" (você não tem imagens reais para referenciar — URLs inventadas quebram o tutorial).
12. Para vídeos, use blocos "video" APENAS com URLs REAIS e conhecidas do YouTube (ex: canais oficiais do Game Guardian). Se não tiver certeza, NÃO inclua vídeo.
13. Use blocos "link" apenas para CTAs grandes (botão de download destacado). Se não tiver certeza da URL, NÃO inclua.
14. **HYPERLINKS — USE COM PARCIMÔNIA (NÃO ESPALHE):**
    - Cada ferramenta/site pode ser linkado NO MÁXIMO UMA VEZ no tutorial inteiro, na PRIMEIRA menção. Depois, escreva o nome como texto puro.
    - Concentre os links em UM único bloco "bullet_list" chamado "Links úteis" (ou dentro do step de instalação). Não pulverize links em toda seção/tip/warning.
    - NUNCA linke termos genéricos ("emulador", "root", "script", "jogo").
    - Máximo TOTAL de hyperlinks no tutorial inteiro: 4.
15. **URLs OFICIAIS APROVADAS — use APENAS estas (não invente, não varie o domínio):**
    - NoxPlayer: https://www.bignox.com
    - LDPlayer: https://www.ldplayer.net
    - MEmu: https://www.memuplay.com
    - BlueStacks: https://www.bluestacks.com
    - Game Guardian (download oficial): https://gameguardian.net/download
    - Fórum Game Guardian: https://gameguardian.net/forum
    - VirtualXposed: https://github.com/android-hacker/VirtualXposed (repo oficial — NUNCA use vxposed.com, o domínio foi sequestrado)
    - Parallel Space: https://play.google.com/store/apps/details?id=com.lbe.parallel.intl
    - Docs Lua 5.1: https://www.lua.org/manual/5.1/
    Se a ferramenta NÃO está nessa lista, escreva o nome SEM link. Nunca invente URL.
16. Prefira blocos "tip", "warning", "bullet_list", "step" e "code". Concentre downloads numa única seção — não repita links.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt, title } = await req.json();
    const userInput = (prompt && String(prompt).trim()) || (title && String(title).trim());
    if (!userInput) {
      return new Response(JSON.stringify({ error: "Prompt é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Crie UM ÚNICO tutorial com base neste briefing do usuário:

"""
${userInput}
"""

Gere um TÍTULO curto e atraente (máx 70 caracteres), uma descrição, categoria adequada e os blocos de conteúdo.
Categorias válidas: geral, scripts-lua, root, virtualizado, iniciante.

Adapte o tamanho à complexidade (iniciante=curto, avançado=detalhado).
- Inclua bloco "code" APENAS se o tema for realmente sobre scripting/Lua/API do GG. Se o tema for instalação/configuração/root/emulador/dicas, NÃO inclua bloco de código de exemplo.
- Pelo menos 1 step prático
- 2-3 dicas curtas
- 2-3 problemas comuns com soluções
- Parágrafos CURTOS. FOQUE no tema pedido — não desvie para "aqui vai um script de exemplo" se o usuário não pediu.
- LINKS: máximo 4 no tutorial inteiro. Escreva SEMPRE como Markdown \`[Nome](https://url)\` — NUNCA cole a URL crua no texto (ex: NÃO faça "Baixe em https://ldplayer.net"; faça "Baixe o [LDPlayer](https://www.ldplayer.net)"). Concentre-os num bloco "bullet_list" chamado "Links úteis" OU no step de instalação. Nunca linke o mesmo nome duas vezes. Use APENAS as URLs oficiais aprovadas nas regras.

Responda APENAS chamando a tool generate_tutorial.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_tutorial",
              description: "Gera um tutorial técnico estruturado sobre modding mobile e Game Guardian.",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Título curto e atraente (máx 70 chars)" },
                  category: { type: "string", enum: ["geral", "scripts-lua", "root", "virtualizado", "iniciante"] },
                  description: { type: "string", description: "Descrição atraente (2-3 frases)" },
                  blocks: {
                    type: "array",
                    description: "Blocos de conteúdo. 4-12 blocos conforme complexidade.",
                    items: {
                      type: "object",
                      properties: {
                        type: {
                          type: "string",
                          enum: ["text", "step", "code", "tip", "warning", "video", "link", "bullet_list", "divider"],
                        },
                        content: { type: "string" },
                        url: { type: "string" },
                        label: { type: "string" },
                        items: { type: "array", items: { type: "string" } },
                        language: { type: "string" },
                      },
                      required: ["type", "content"],
                      additionalProperties: false,
                    },
                  },
                  tips: { type: "array", items: { type: "string" } },
                  troubleshooting: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        problem: { type: "string" },
                        solution: { type: "string" },
                      },
                      required: ["problem", "solution"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["title", "description", "blocks", "tips", "troubleshooting"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_tutorial" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Erro na API de IA: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let tutorialData: any = null;

    if (toolCall?.function?.arguments) {
      try {
        tutorialData = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Failed to parse tool arguments:", toolCall.function.arguments);
      }
    }

    if (!tutorialData) {
      const textContent = data.choices?.[0]?.message?.content;
      if (textContent) {
        try {
          const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          tutorialData = JSON.parse((jsonMatch ? jsonMatch[1] : textContent).trim());
        } catch (e) {
          console.error("Failed to parse text content:", textContent);
        }
      }
    }

    if (!tutorialData || !Array.isArray(tutorialData.blocks)) {
      console.error("Invalid response:", JSON.stringify(data, null, 2));
      throw new Error("A IA não retornou uma estrutura válida de tutorial.");
    }

    return new Response(JSON.stringify(tutorialData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-tutorial error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
