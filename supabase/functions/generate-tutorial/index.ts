import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { title } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY não configurada no Supabase' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const prompt = `Você é um especialista em modding mobile, engenharia reversa e Scripting para Game Guardian no Android.
Seu objetivo é gerar um tutorial técnico e profissional baseado no seguinte título: "${title}".

O tutorial deve ser retornado EXCLUSIVAMENTE em formato JSON com esta estrutura exata:
{
  "description": "Uma breve descrição atraente do que será aprendido",
  "blocks": [
    { "type": "text", "content": "Introdução teórica focada em conceitos de memória, offsets ou lógica de jogo." },
    { "type": "step", "content": "Primeiro passo prático detalhado." },
    { "type": "code", "content": "-- código lua completo e funcional para Game Guardian\\ngg.clearResults()\\ngg.searchNumber('1234', gg.TYPE_DWORD)\\n...", "language": "lua" },
    { "type": "tip", "content": "Uma dica avançada sobre busca de valores ou proteção contra bans." },
    { "type": "warning", "content": "Um aviso sobre riscos de detecção ou erros de script." }
  ],
  "tips": ["Dica extra curta 1", "Dica extra curta 2"],
  "troubleshooting": [
    { "problem": "Script não encontra valores", "solution": "Verifique se o jogo foi selecionado corretamente e o intervalo de memória está em Anonymous." }
  ]
}

Regras Cruciais:
1. Use termos técnicos precisos: libs, offsets, hex, memory ranges (CodeApp, Anonymous), XOR key.
2. O código Lua DEVE ser funcional e usar a API do Game Guardian (gg.*).
3. Escreva em Português do Brasil de forma clara e profissional.
4. Retorne APENAS o JSON puro, sem explicações fora do JSON.
5. Se o título for irrelevante ao tema de modding, tente criar algo relacionado ou retorne um tutorial básico de scripting.`

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          response_mime_type: "application/json",
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Erro na API Gemini: ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    if (!textResponse) {
      throw new Error('A IA retornou uma resposta vazia.')
    }

    // Tentar extrair o JSON mesmo que a IA coloque blocos de código markdown
    let jsonString = textResponse
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonString = jsonMatch[0]
    }

    const tutorialData = JSON.parse(jsonString)

    // Validação básica da estrutura
    if (!tutorialData.blocks || !Array.isArray(tutorialData.blocks)) {
      throw new Error('A estrutura do tutorial gerada é inválida.')
    }

    return new Response(
      JSON.stringify(tutorialData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
