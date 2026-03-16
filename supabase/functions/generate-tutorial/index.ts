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

    const systemPrompt = `Você é um MESTRE absoluto em modding mobile, engenharia reversa Android e scripting Lua para Game Guardian. Você tem 10+ anos de experiência prática.

## Seu Conhecimento Técnico Profundo

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

### Técnicas Avançadas de Modding
- **Group Search**: Busca agrupada por offsets entre valores para encontrar estruturas na memória
- **Pointer Scanning**: Rastreamento de ponteiros para encontrar endereços base estáveis
- **Lib Dumping**: Extração de bibliotecas .so da memória do processo
- **Offset Calculation**: Cálculo de offsets relativos entre endereços de memória
- **XOR Encryption**: Valores cifrados com XOR que precisam de chave para decodificar
- **Fuzzy Search**: Busca incremental para valores desconhecidos (aumentou/diminuiu/não mudou)
- **Refined Search**: Refinamento progressivo de resultados
- **Memory Patching**: Alteração de instruções ARM/ARM64 na memória (NOP, branch, MOV)
- **Hook Functions**: Interceptação de funções nativas via modificação de GOT/PLT
- **Anti-detection bypass**: Técnicas para contornar verificações de integridade

### Ferramentas do Ecossistema
- Game Guardian (Android), GameGuardian (iOS via checkra1n/unc0ver)
- APK Editor / APKTool / MT Manager para edição de APK
- IDA Pro / Ghidra / Binary Ninja para análise de binários
- Frida para hooking dinâmico
- Logcat / ADB para debugging

## Regras para Geração de Tutoriais

1. TODO código Lua DEVE ser funcional, testado e usar a API correta do GG
2. Inclua exemplos REAIS com valores e offsets plausíveis
3. Explique o PORQUÊ de cada passo, não apenas o quê
4. Inclua tratamento de erros (verificação de resultados, fallbacks)
5. Use menus interativos (gg.choice/gg.multiChoice) quando aplicável
6. Escreva em Português do Brasil, claro e profissional
7. Gere conteúdo EXTENSO e DETALHADO com pelo menos 8-12 blocos
8. Inclua blocos de código com exemplos práticos sempre que possível
9. Se o título não for relacionado a modding, adapte criativamente para o contexto de Game Guardian
10. Inclua dicas de performance e boas práticas`

    const userPrompt = `Gere um tutorial técnico COMPLETO e DETALHADO sobre: "${title}"

O tutorial deve ser extenso, com múltiplos exemplos de código funcional, explicações detalhadas de cada conceito, e dicas práticas baseadas em experiência real.`

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
              description: 'Gera um tutorial técnico estruturado e completo sobre modding mobile e Game Guardian.',
              parameters: {
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
                          description: 'Tipo do bloco: text (explicação), step (passo numerado), code (código Lua funcional), tip (dica útil), warning (aviso importante), video (referência a vídeo)'
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
                      required: ['type', 'content'],
                      additionalProperties: false
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
                      required: ['problem', 'solution'],
                      additionalProperties: false
                    },
                    description: 'Pelo menos 3-5 problemas comuns com soluções detalhadas'
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
