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
   - Tema INICIANTE (ex: "meu primeiro script", "como começar"): 4-6 blocos, 400-800 palavras. Seja CONCISO e acolhedor. Um iniciante quer resultados rápidos, não um livro.
   - Tema INTERMEDIÁRIO (ex: "busca por grupo", "menus interativos"): 6-8 blocos, 800-1200 palavras. 
   - Tema AVANÇADO (ex: "anti-ban", "criptografia", "bypass"): 8-12 blocos, 1200-2000 palavras. Aqui sim, detalhe mais.
5. NUNCA gere mais conteúdo do que o necessário — qualidade > quantidade
6. Cada parágrafo deve ser curto (2-3 frases) e ir direto ao ponto
7. Blocos de código: entre 8-25 linhas dependendo da complexidade. Comentários breves.
8. Se o título não for de modding, adapte para o contexto de Game Guardian
9. Gere apenas UM ÚNICO tutorial por chamada
10. Use linguagem simples e amigável — o leitor pode ser um iniciante total
11. Prefira mostrar um exemplo prático logo no início ao invés de teoria extensa`;

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

    const userPrompt = `Gere UM ÚNICO tutorial sobre: "${title}"

IMPORTANTE — ADAPTE o tamanho à complexidade:
- Se for tema SIMPLES/INICIANTE: seja CURTO e direto. 4-6 blocos. O leitor quer aprender rápido, não ler um livro.
- Se for tema INTERMEDIÁRIO: 6-8 blocos com bom equilíbrio.
- Se for tema AVANÇADO: 8-12 blocos mais detalhados.

Regras:
- Pelo menos 1 bloco de código Lua funcional (8-25 linhas conforme complexidade)
- Pelo menos 1 step com instrução prática
- 2-3 dicas extras úteis
- 2-3 problemas comuns com soluções curtas
- Mostre um exemplo prático o mais cedo possível no tutorial
- Parágrafos CURTOS (2-3 frases). Vá direto ao ponto.

NÃO enrole. Gere apenas UM tutorial. Responda APENAS com o tool call.`;

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
                  description: "Blocos de conteúdo do tutorial. Gere entre 8 e 14 blocos variados e detalhados. Cada bloco de texto deve ter 3-4 parágrafos. Blocos de código devem ter 15+ linhas.",
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
                  description: "4-5 dicas extras úteis e práticas",
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
                  description: "3-4 problemas comuns com soluções detalhadas",
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
