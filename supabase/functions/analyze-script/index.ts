import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, script_id } = await req.json();

    if (!code || typeof code !== 'string') {
      return new Response(JSON.stringify({ error: 'Código não fornecido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (code.length > 100_000) {
      return new Response(JSON.stringify({ error: 'Código muito grande (máx 100KB)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    let result: any;

    // Always run heuristic behavioral analysis (fast, deterministic)
    const heuristic = performHeuristicAnalysis(code);

    if (!apiKey) {
      console.warn("LOVABLE_API_KEY não configurada, usando apenas análise heurística.");
      result = heuristic;
    } else {
      try {
        const ai = await performAIAnalysis(code, apiKey);
        // Merge: take the worst classification between AI and heuristic (priorize segurança)
        result = mergeAnalyses(ai, heuristic);
      } catch (e) {
        console.warn("AI falhou, usando heurística:", (e as Error).message);
        result = heuristic;
      }
    }

    // If script_id provided, update security status server-side
    if (script_id && typeof script_id === 'string') {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      if (result.classification === "malicious") {
        await supabase.from("scripts").update({
          publish_status: "draft",
          security_status: "flagged",
        }).eq("id", script_id);
        result._routed_status = "draft";
      } else if (result.classification === "suspicious") {
        await supabase.from("scripts").update({
          security_status: "under_review",
        }).eq("id", script_id);
        result._routed_status = "pending_review";
      } else {
        // Safe
        await supabase.from("scripts").update({
          security_status: "verified",
          is_verified: true,
        }).eq("id", script_id);
        result._routed_status = null; // no override
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Analysis error:", error);
    return new Response(JSON.stringify({ error: 'Erro interno na análise' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function performAIAnalysis(code: string, apiKey: string) {
  const systemPrompt = `Você é um analista de segurança especialista em scripts Lua para Game Guardian (Android modding).

Seu conhecimento profundo inclui:
- API Game Guardian: gg.searchNumber, gg.getResults, gg.editAll, gg.setRanges, gg.getRangesList, gg.clearResults, gg.toast, gg.alert, gg.prompt, gg.choice, gg.sleep, gg.getListItems, gg.addListItems, gg.removeListItems, gg.processResume, gg.processPause, gg.getTargetInfo, gg.setVisible, gg.getValues, gg.setValues
- Tipos de busca: gg.TYPE_DWORD, gg.TYPE_FLOAT, gg.TYPE_DOUBLE, gg.TYPE_WORD, gg.TYPE_BYTE, gg.TYPE_QWORD, gg.TYPE_XOR, gg.TYPE_AUTO
- Memory ranges: gg.REGION_CODE_APP, gg.REGION_C_ALLOC, gg.REGION_ANONYMOUS, gg.REGION_JAVA_HEAP, gg.REGION_C_DATA, gg.REGION_C_BSS, gg.REGION_STACK, gg.REGION_OTHER
- Técnicas comuns: Group Search (busca agrupada por offsets), pointer scanning, lib dumping, offset calculation, XOR encryption/decryption, fuzzy search, refined search
- Padrões legítimos: menus interativos com gg.choice, loops de main com gg.sleep, funções de hack organizadas, multi-game support

Você DEVE distinguir entre:
1. Uso legítimo da API do GG (busca em memória, edição de valores, menus) → SEGURO
2. Operações potencialmente perigosas mas comuns em modding (loadstring para atualização remota, HTTP requests para verificar versão) → SUSPEITO
3. Código genuinamente malicioso (roubo de dados, reverse shells, mineradores, ransomware, keyloggers) → MALICIOSO

IMPORTANTE: Scripts de Game Guardian normalmente acessam memória, editam valores e usam loops — isso é o comportamento ESPERADO e não deve ser classificado como ameaça.`;

  const userPrompt = `Analise este script Lua de Game Guardian quanto à segurança:\n\n\`\`\`lua\n${code.substring(0, 50000)}\n\`\`\``;

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
            name: 'analyze_script',
            description: 'Retorna a análise de segurança de um script Lua de Game Guardian.',
            parameters: {
              type: 'object',
              properties: {
                classification: {
                  type: 'string',
                  enum: ['safe', 'suspicious', 'malicious'],
                  description: 'Classificação geral de segurança do script'
                },
                securityScore: {
                  type: 'number',
                  description: 'Pontuação de 0 a 100 (100 = totalmente seguro)'
                },
                threats: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['system_command', 'network_abuse', 'filesystem', 'obfuscation', 'encoded_payload', 'reverse_shell', 'persistence', 'data_theft'],
                        description: 'Tipo da ameaça'
                      },
                      severity: {
                        type: 'string',
                        enum: ['low', 'medium', 'high', 'critical'],
                        description: 'Gravidade da ameaça'
                      },
                      description: {
                        type: 'string',
                        description: 'Descrição breve em português da ameaça encontrada'
                      },
                      line: {
                        type: 'string',
                        description: 'Trecho relevante do código'
                      }
                    },
                    required: ['type', 'severity', 'description', 'line'],
                    additionalProperties: false
                  }
                },
                summary: {
                  type: 'string',
                  description: 'Resumo em português do que o script faz (máx 3 frases)'
                },
                functionality: {
                  type: 'string',
                  description: 'Descrição da funcionalidade principal e casos de uso do script em português (máx 3 frases)'
                }
              },
              required: ['classification', 'securityScore', 'threats', 'summary', 'functionality'],
              additionalProperties: false
            }
          }
        }
      ],
      tool_choice: { type: 'function', function: { name: 'analyze_script' } },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('rate_limit');
    }
    if (response.status === 402) {
      throw new Error('credits');
    }
    console.error('AI gateway error:', response.status, await response.text());
    return performStaticAnalysis(code);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

  if (!toolCall?.function?.arguments) {
    console.error('AI não retornou tool call, usando fallback estático.');
    return performStaticAnalysis(code);
  }

  return JSON.parse(toolCall.function.arguments);
}

function performStaticAnalysis(code: string) {
  const threats: Array<{ type: string; severity: string; description: string; line: string }> = [];

  const patterns = [
    { regex: /os\.execute\s*\(/g, type: "system_command", severity: "critical", desc: "Execução de comando do sistema detectada" },
    { regex: /io\.popen\s*\(/g, type: "system_command", severity: "critical", desc: "Abertura de processo do sistema detectada" },
    { regex: /os\.remove\s*\(/g, type: "filesystem", severity: "high", desc: "Remoção de arquivo do sistema detectada" },
    { regex: /os\.rename\s*\(/g, type: "filesystem", severity: "medium", desc: "Renomeação de arquivo do sistema detectada" },
    { regex: /io\.open\s*\([^)]*['"]\s*\/(?:etc|tmp|var|usr)/g, type: "filesystem", severity: "critical", desc: "Acesso a diretório sensível do sistema" },
    { regex: /loadstring\s*\(/g, type: "obfuscation", severity: "high", desc: "Execução dinâmica de código (loadstring)" },
    { regex: /string\.char\s*\([^)]{50,}\)/g, type: "obfuscation", severity: "high", desc: "Ofuscação via string.char extensa" },
    { regex: /\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){20,}/g, type: "encoded_payload", severity: "high", desc: "Payload hexadecimal embutido" },
    { regex: /[A-Za-z0-9+\/=]{100,}/g, type: "encoded_payload", severity: "medium", desc: "Possível payload base64 detectado" },
    { regex: /socket\.connect|socket\.tcp|require\s*\(?\s*['"]socket['"]\s*\)?/g, type: "network_abuse", severity: "high", desc: "Conexão de rede/socket detectada" },
    { regex: /http\.request|https\.request|wget|curl/g, type: "network_abuse", severity: "medium", desc: "Requisição HTTP detectada" },
    { regex: /\/bin\/sh|\/bin\/bash|cmd\.exe/g, type: "reverse_shell", severity: "critical", desc: "Referência a shell do sistema detectada" },
    { regex: /while\s+true\s+do[\s\S]*?os\./g, type: "persistence", severity: "high", desc: "Loop persistente com operação de sistema" },
  ];

  for (const p of patterns) {
    let match;
    while ((match = p.regex.exec(code)) !== null) {
      const start = Math.max(0, match.index - 20);
      const end = Math.min(code.length, match.index + match[0].length + 20);
      threats.push({
        type: p.type,
        severity: p.severity,
        description: p.desc,
        line: code.substring(start, end).replace(/\n/g, " ").trim(),
      });
    }
  }

  let classification: "safe" | "suspicious" | "malicious" = "safe";
  let securityScore = 100;

  for (const t of threats) {
    if (t.severity === "critical") { classification = "malicious"; securityScore -= 30; }
    else if (t.severity === "high") { classification = classification === "malicious" ? "malicious" : "suspicious"; securityScore -= 20; }
    else if (t.severity === "medium") { classification = classification === "safe" ? "suspicious" : classification; securityScore -= 10; }
    else { securityScore -= 5; }
  }

  securityScore = Math.max(0, securityScore);

  return {
    classification,
    securityScore,
    threats,
    summary: threats.length === 0
      ? "O script não apresenta padrões de código malicioso conhecidos."
      : `Foram detectados ${threats.length} padrão(ões) suspeito(s) no código. Recomenda-se revisão manual.`,
    functionality: "Análise estática realizada. Para uma descrição detalhada da funcionalidade, é necessária a análise por IA.",
  };
}
