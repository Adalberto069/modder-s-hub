import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { title } = await req.json()
    const apiKey = Deno.env.get('LOVABLE_API_KEY')

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const systemPrompt = `Você é um especialista em modding mobile, engenharia reversa e Scripting para Game Guardian no Android.
Seu objetivo é gerar um tutorial técnico e profissional.

Regras Cruciais:
1. Use termos técnicos precisos: libs, offsets, hex, memory ranges (CodeApp, Anonymous), XOR key.
2. O código Lua DEVE ser funcional e usar a API do Game Guardian (gg.*).
3. Escreva em Português do Brasil de forma clara e profissional.
4. Se o título for irrelevante ao tema de modding, tente criar algo relacionado ou retorne um tutorial básico de scripting.`

    const userPrompt = `Gere um tutorial técnico completo baseado no título: "${title}"`

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_tutorial',
              description: 'Gera um tutorial técnico estruturado sobre modding mobile e Game Guardian.',
              parameters: {
                type: 'object',
                properties: {
                  description: {
                    type: 'string',
                    description: 'Uma breve descrição atraente do que será aprendido'
                  },
                  blocks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: {
                          type: 'string',
                          enum: ['text', 'step', 'code', 'tip', 'warning'],
                          description: 'Tipo do bloco de conteúdo'
                        },
                        content: {
                          type: 'string',
                          description: 'Conteúdo do bloco'
                        },
                        language: {
                          type: 'string',
                          description: 'Linguagem do código (apenas para blocos do tipo code)'
                        }
                      },
                      required: ['type', 'content'],
                      additionalProperties: false
                    }
                  },
                  tips: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Dicas extras curtas'
                  },
                  troubleshooting: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        problem: { type: 'string' },
                        solution: { type: 'string' }
                      },
                      required: ['problem', 'solution'],
                      additionalProperties: false
                    },
                    description: 'Problemas comuns e soluções'
                  }
                },
                required: ['description', 'blocks', 'tips', 'troubleshooting'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'generate_tutorial' } },
      }),
    })

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const errorText = await response.text()
      console.error('AI gateway error:', response.status, errorText)
      throw new Error(`Erro na IA: ${response.status}`)
    }

    const data = await response.json()
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
    if (!toolCall?.function?.arguments) {
      throw new Error('A IA não retornou dados estruturados.')
    }

    const tutorialData = JSON.parse(toolCall.function.arguments)

    if (!tutorialData.blocks || !Array.isArray(tutorialData.blocks)) {
      throw new Error('A estrutura do tutorial gerada é inválida.')
    }

    return new Response(
      JSON.stringify(tutorialData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('generate-tutorial error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
