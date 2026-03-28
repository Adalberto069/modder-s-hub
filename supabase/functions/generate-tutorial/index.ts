import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um especialista em modding mobile, scripts Lua, Game Guardian e jogos Android. Gere tutoriais COMPLETOS, DETALHADOS e EXTENSOS. Responda sempre em português brasileiro.

## Regras OBRIGATÓRIAS
1. Código Lua DEVE ser funcional, comentado linha a linha, e usar a API correta do GG
2. Inclua exemplos REAIS com valores plausíveis
3. Explique o PORQUÊ de cada passo em detalhes
4. Inclua tratamento de erros nos códigos
5. Use menus interativos quando aplicável
6. Gere entre 8 e 14 blocos de conteúdo — NUNCA menos que 8
7. Cada bloco de texto deve ter pelo menos 3-4 parágrafos com explicações ricas
8. Cada bloco de código deve ter pelo menos 15 linhas com comentários explicativos
9. Inclua pelo menos 2 blocos de código com exemplos práticos diferentes
10. Inclua passos numerados detalhados (tipo "step") com instruções claras
11. Inclua blocos de "tip" e "warning" com informações relevantes
12. Se o título não for de modding, adapte para o contexto de Game Guardian
13. Gere apenas UM ÚNICO tutorial por chamada
14. O tutorial deve ter entre 1500 e 3000 palavras — seja DETALHADO e COMPLETO
15. Inclua uma introdução explicando o contexto e importância do tema
16. Inclua pré-requisitos necessários
17. Termine com uma conclusão e próximos passos
18. Gere pelo menos 4 dicas extras úteis
19. Gere pelo menos 3 problemas comuns com soluções detalhadas
20. NUNCA gere conteúdo genérico ou superficial — cada seção deve ter profundidade`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { title } = await req.json();
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Gere UM ÚNICO tutorial técnico COMPLETO e DETALHADO sobre: "${title}"

IMPORTANTE: O tutorial deve ser EXTENSO e RICO em conteúdo:
- Mínimo de 1500 palavras, idealmente 2000-3000 palavras
- Entre 8 e 14 blocos de conteúdo variados (text, step, code, tip, warning)
- Pelo menos 2 blocos de código Lua completos e funcionais (15+ linhas cada)
- Pelo menos 3 blocos de "step" com instruções detalhadas
- Pelo menos 2 blocos de "tip" com dicas práticas
- Pelo menos 1 bloco de "warning" com avisos importantes
- Explicações profundas e contextualizadas, não superficiais
- 4-5 dicas extras úteis e práticas
- 3-4 problemas comuns com soluções detalhadas

NÃO seja superficial. Cada parágrafo deve agregar valor real ao leitor. Gere apenas UM tutorial. Responda APENAS com o tool call solicitado.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        tools: [
          {
            name: "generate_tutorial",
            description: "Gera um tutorial técnico estruturado e completo sobre modding mobile e Game Guardian.",
            input_schema: {
              type: "object",
              properties: {
                description: {
                  type: "string",
                  description: "Descrição atraente do tutorial (2-3 frases)",
                },
                blocks: {
                  type: "array",
                  description: "Blocos de conteúdo do tutorial. Gere 4-6 blocos objetivos.",
                  items: {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        enum: ["text", "step", "code", "tip", "warning", "video"],
                        description: "Tipo do bloco",
                      },
                      content: {
                        type: "string",
                        description: "Conteúdo do bloco. Para code, deve ser código Lua funcional e comentado.",
                      },
                      language: {
                        type: "string",
                        description: 'Linguagem do código (apenas para type=code). Geralmente "lua".',
                      },
                    },
                    required: ["type", "content"],
                  },
                },
                tips: {
                  type: "array",
                  items: { type: "string" },
                  description: "2-3 dicas extras",
                },
                troubleshooting: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      problem: { type: "string" },
                      solution: { type: "string" },
                    },
                    required: ["problem", "solution"],
                  },
                  description: "2-3 problemas comuns com soluções",
                },
              },
              required: ["description", "blocks", "tips", "troubleshooting"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "generate_tutorial" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Erro na API Anthropic: ${response.status}`);
    }

    const data = await response.json();

    let tutorialData = null;

    // Try finding tool_use first
    const toolUse = data.content?.find((block: any) => block.type === "tool_use" && block.name === "generate_tutorial");

    if (toolUse?.input) {
      tutorialData = toolUse.input;
    } else {
      // Fallback: look for JSON in the text content (data.content[0].text)
      const textContent = data.content?.find((block: any) => block.type === "text")?.text || data.content?.[0]?.text;
      if (textContent) {
        try {
          // Attempt to extract JSON if wrapped in markdown
          const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          const jsonString = jsonMatch ? jsonMatch[1] : textContent;
          tutorialData = JSON.parse(jsonString.trim());
        } catch (e) {
          console.error("Failed to parse JSON from text:", textContent);
        }
      }
    }

    if (!tutorialData) {
      console.error("Full Claude Response:", JSON.stringify(data, null, 2));
      throw new Error("O Claude não retornou dados estruturados.");
    }

    if (!tutorialData.blocks || !Array.isArray(tutorialData.blocks)) {
      console.error("Invalid Structure:", JSON.stringify(tutorialData, null, 2));
      throw new Error("A estrutura do tutorial gerada é inválida.");
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
