import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const SYSTEM_PROMPT = `Você é um especialista em modding mobile, scripts Lua, Game Guardian e jogos Android. Gere tutoriais claros, práticos e acessíveis para iniciantes e intermediários. Evite termos excessivamente técnicos sem explicação. Estruture sempre com: introdução, pré-requisitos, passo a passo numerado e conclusão. Responda sempre em português brasileiro.

## Seu Conhecimento Técnico

### Game Guardian API
- Busca: gg.searchNumber, gg.searchAddress, gg.searchFuzzy, gg.refineNumber, gg.refineAddress
- Resultados: gg.getResults, gg.getResultsCount, gg.clearResults, gg.getListItems, gg.addListItems, gg.removeListItems
- Edição: gg.editAll, gg.setValues, gg.getValues
- Tipos: gg.TYPE_DWORD, gg.TYPE_FLOAT, gg.TYPE_DOUBLE, gg.TYPE_WORD, gg.TYPE_BYTE, gg.TYPE_QWORD, gg.TYPE_XOR, gg.TYPE_AUTO
- Regiões: gg.REGION_CODE_APP, gg.REGION_C_ALLOC, gg.REGION_ANONYMOUS, gg.REGION_JAVA_HEAP, gg.REGION_C_DATA, gg.REGION_C_BSS, gg.REGION_STACK, gg.REGION_OTHER
- Interface: gg.alert, gg.toast, gg.prompt, gg.choice, gg.multiChoice, gg.setVisible
- Processo: gg.getTargetInfo, gg.processResume, gg.processPause, gg.getTargetPackage, gg.isVisible
- Memória: gg.getRangesList, gg.allocatePage, gg.bytes, gg.dump
- Utilidades: gg.sleep, gg.getFile, gg.makeRequest, gg.copyText, gg.getLocale

### Técnicas de Modding
- Group Search, Pointer Scanning, Lib Dumping, Offset Calculation
- XOR Encryption, Fuzzy Search, Refined Search, Memory Patching
- Hook Functions, Anti-detection bypass

### Ferramentas
- Game Guardian, APK Editor, APKTool, MT Manager, IDA Pro, Ghidra, Frida, ADB

## Regras
1. Código Lua DEVE ser funcional e usar a API correta do GG
2. Inclua exemplos REAIS com valores plausíveis
3. Explique o PORQUÊ de cada passo
4. Inclua tratamento de erros
5. Use menus interativos quando aplicável
6. Gere conteúdo com 4-6 blocos objetivos
7. Inclua blocos de código com exemplos práticos
8. Se o título não for de modding, adapte para o contexto de Game Guardian
9. Inclua dicas de performance e boas práticas
10. Gere apenas UM ÚNICO tutorial por chamada. NUNCA gere múltiplos tutoriais na mesma resposta.
11. O tutorial deve ter no máximo 500 palavras. Seja direto e objetivo, sem repetições.`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { title } = await req.json()
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userPrompt = `Gere UM ÚNICO tutorial técnico sobre: "${title}"

O tutorial deve ser conciso (máximo 500 palavras), direto e sem repetições. Inclua exemplos de código funcional e explicações claras.

Gere apenas UM tutorial. NÃO gere múltiplos tutoriais. Responda APENAS com o tool call solicitado.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userPrompt },
        ],
        tools: [
          {
            name: 'generate_tutorial',
            description: 'Gera um tutorial técnico estruturado e completo sobre modding mobile e Game Guardian.',
            input_schema: {
              type: 'object',
              properties: {
                description: {
                  type: 'string',
                  description: 'Descrição atraente do tutorial (2-3 frases)'
                },
                blocks: {
                  type: 'array',
                  description: 'Blocos de conteúdo do tutorial. Gere pelo menos 8-12 blocos variados.',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['text', 'step', 'code', 'tip', 'warning', 'video'],
                        description: 'Tipo do bloco'
                      },
                      content: {
                        type: 'string',
                        description: 'Conteúdo do bloco. Para code, deve ser código Lua funcional e comentado.'
                      },
                      language: {
                        type: 'string',
                        description: 'Linguagem do código (apenas para type=code). Geralmente "lua".'
                      }
                    },
                    required: ['type', 'content']
                  }
                },
                tips: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Pelo menos 3-5 dicas extras baseadas em experiência real'
                },
                troubleshooting: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      problem: { type: 'string' },
                      solution: { type: 'string' }
                    },
                    required: ['problem', 'solution']
                  },
                  description: 'Pelo menos 3-5 problemas comuns com soluções detalhadas'
                }
              },
              required: ['description', 'blocks', 'tips', 'troubleshooting']
            }
          }
        ],
        tool_choice: { type: 'tool', name: 'generate_tutorial' },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Anthropic API error:', response.status, errorText)
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      throw new Error(`Erro na API Anthropic: ${response.status}`)
    }

    const data = await response.json()
    
    let tutorialData = null;

    // Try finding tool_use first
    const toolUse = data.content?.find((block: any) => block.type === 'tool_use' && block.name === 'generate_tutorial')
    
    if (toolUse?.input) {
      tutorialData = toolUse.input;
    } else {
      // Fallback: look for JSON in the text content (data.content[0].text)
      const textContent = data.content?.find((block: any) => block.type === 'text')?.text || data.content?.[0]?.text;
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
      throw new Error('O Claude não retornou dados estruturados.')
    }

    if (!tutorialData.blocks || !Array.isArray(tutorialData.blocks)) {
      console.error("Invalid Structure:", JSON.stringify(tutorialData, null, 2));
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
