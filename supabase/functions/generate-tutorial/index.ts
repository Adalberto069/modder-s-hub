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
6. Gere conteúdo EXTENSO com pelo menos 8-12 blocos
7. Inclua blocos de código com exemplos práticos
8. Se o título não for de modding, adapte para o contexto de Game Guardian
9. Inclua dicas de performance e boas práticas

## FORMATO DE RESPOSTA OBRIGATÓRIO
Você DEVE responder APENAS com um JSON válido (sem markdown, sem \`\`\`, sem texto antes ou depois) com esta estrutura exata:
{
  "description": "Descrição atraente do tutorial (2-3 frases)",
  "blocks": [
    { "type": "text|step|code|tip|warning", "content": "...", "language": "lua" }
  ],
  "tips": ["dica1", "dica2", "dica3"],
  "troubleshooting": [
    { "problem": "...", "solution": "..." }
  ]
}

Tipos de blocos permitidos: text, step, code, tip, warning.
Para blocos de código, inclua "language": "lua".
Gere pelo menos 8-12 blocos variados, 3-5 dicas e 3-5 troubleshooting.`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { title } = await req.json()
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userPrompt = `Gere um tutorial técnico COMPLETO e DETALHADO sobre: "${title}"

O tutorial deve ser extenso, com múltiplos exemplos de código funcional, explicações detalhadas de cada conceito, e dicas práticas baseadas em experiência real.

Responda APENAS com JSON válido, sem markdown e sem texto adicional.`

    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 8192,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Lovable AI error:', response.status, errorText)
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      throw new Error(`Erro na API: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('A IA não retornou conteúdo.')
    }

    // Clean markdown fences if present
    let jsonStr = content.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    const tutorialData = JSON.parse(jsonStr)

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
