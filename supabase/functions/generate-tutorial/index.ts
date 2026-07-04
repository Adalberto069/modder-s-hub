import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um especialista em modding mobile, scripts Lua, Game Guardian e jogos Android. Gere tutoriais claros e diretos. Responda sempre em português brasileiro.

## Regras OBRIGATÓRIAS
1. Código Lua DEVE ser funcional, comentado, e usar a API correta do GG
2. Inclua exemplos REAIS com valores plausíveis
3. Explique de forma CLARA e OBJETIVA — sem enrolação
4. ADAPTE o tamanho ao nível do tema:
   - INICIANTE: 4-6 blocos, 400-800 palavras
   - INTERMEDIÁRIO: 6-8 blocos, 800-1200 palavras
   - AVANÇADO: 8-12 blocos, 1200-2000 palavras
5. NUNCA gere mais conteúdo do que o necessário
6. Parágrafos curtos (2-3 frases)
7. Blocos de código: 8-25 linhas
8. Se o título não for de modding, adapte para Game Guardian
9. Gere apenas UM ÚNICO tutorial
10. Linguagem simples e amigável
11. NUNCA use blocos do tipo "image" (você não tem imagens reais para referenciar — URLs inventadas quebram o tutorial).
12. Para vídeos, use blocos "video" APENAS com URLs REAIS e conhecidas do YouTube (ex: canais oficiais do Game Guardian). Se não tiver certeza, NÃO inclua vídeo.
13. Use blocos "link" para recursos externos reais e verificáveis (fórum oficial GG, docs Lua). Se não tiver certeza da URL, NÃO inclua link.
14. Prefira blocos "tip", "warning", "bullet_list", "step" e "code" para deixar o tutorial interativo — nunca invente mídia.`;

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
- Pelo menos 1 bloco de código Lua funcional quando fizer sentido
- Pelo menos 1 step prático
- 2-3 dicas curtas
- 2-3 problemas comuns com soluções
- Parágrafos CURTOS. Vá direto ao ponto.

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
                          enum: ["text", "step", "code", "tip", "warning", "video", "image", "link", "bullet_list", "divider"],
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
