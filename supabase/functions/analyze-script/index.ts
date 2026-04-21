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

/**
 * Heuristic behavioral analyzer for Lua / Game Guardian scripts.
 * Detecta INTENÇÃO suspeita (não apenas execução real):
 *  - keywords sensíveis (token, auth, payload, api...)
 *  - padrões de encode/decode (string.byte, gsub, base64-like)
 *  - concatenação de strings (..)
 *  - delays antes de ações (gg.sleep)
 *  - ofuscação (tabelas de strings, _G[...], nomes aleatórios)
 *
 * Pontuação:
 *  - palavra suspeita: +15
 *  - encode/decode: +20
 *  - concatenação: +10 (só se houver outros sinais)
 *  - delay: +10
 *  - ofuscação: +25
 *
 * Classificação:
 *  0–20  → safe       (🟢)
 *  21–49 → suspicious (🟡)
 *  50+   → malicious  (🔴 alto risco)
 */
function performHeuristicAnalysis(code: string) {
  const threats: Array<{ type: string; severity: string; description: string; line: string }> = [];
  let score = 0;

  const sample = (idx: number, len: number) => {
    const start = Math.max(0, idx - 20);
    const end = Math.min(code.length, idx + len + 20);
    return code.substring(start, end).replace(/\n/g, " ").trim().substring(0, 120);
  };

  const addThreat = (
    points: number,
    type: string,
    severity: string,
    description: string,
    line: string,
  ) => {
    score += points;
    threats.push({ type, severity, description, line });
  };

  // ---- 1. Palavras-chave sensíveis (intenção) ----
  const suspiciousKeywords = [
    "token", "auth", "password", "passwd", "secret", "apikey", "api_key",
    "payload", "session", "cookie", "credential",
    "request", "post", "api", "send", "upload", "exfil",
  ];
  const seenKeywords = new Set<string>();
  for (const kw of suspiciousKeywords) {
    const re = new RegExp(`\\b${kw}\\b`, "gi");
    const m = re.exec(code);
    if (m && !seenKeywords.has(kw.toLowerCase())) {
      seenKeywords.add(kw.toLowerCase());
      addThreat(15, "data_theft", "medium",
        `Palavra-chave sensível detectada: "${kw}"`, sample(m.index, m[0].length));
    }
  }

  // ---- 2. Encode / Decode patterns ----
  const encodePatterns: Array<{ re: RegExp; desc: string }> = [
    { re: /string\.byte\s*\(/g, desc: "Uso de string.byte (possível encode/decode manual)" },
    { re: /string\.char\s*\(/g, desc: "Uso de string.char (possível decode de payload)" },
    { re: /:\s*gsub\s*\(/g, desc: "Uso de gsub (possível transformação/encode de strings)" },
    { re: /\bbase64\b/gi, desc: "Referência a base64 (encode/decode)" },
    { re: /\b(encode|decode)\b/gi, desc: "Função de encode/decode declarada/usada" },
    { re: /\bxor\b/gi, desc: "Operação XOR (cifra/ofuscação)" },
  ];
  const seenEncode = new Set<string>();
  for (const p of encodePatterns) {
    const m = p.re.exec(code);
    if (m && !seenEncode.has(p.desc)) {
      seenEncode.add(p.desc);
      addThreat(20, "encoded_payload", "high", p.desc, sample(m.index, m[0].length));
    }
  }

  // ---- 3. Network / "POST" / "api" literais ----
  const networkLiterals = [
    { re: /["']POST["']/g, desc: "Literal \"POST\" (simulação de requisição HTTP)" },
    { re: /["']GET["']/g, desc: "Literal \"GET\" (simulação de requisição HTTP)" },
    { re: /https?:\/\/[^\s"']+/g, desc: "URL embutida no script" },
    { re: /\b(http\.request|https\.request|socket\.|wget|curl)\b/g, desc: "Chamada real de rede" },
  ];
  for (const p of networkLiterals) {
    const m = p.re.exec(code);
    if (m) {
      addThreat(20, "network_abuse", "high", p.desc, sample(m.index, m[0].length));
    }
  }

  // ---- 4. Concatenação de strings (..) — só conta se já houver outros sinais ----
  const concatMatches = code.match(/\.\.\s*['"]/g) || [];
  if (concatMatches.length >= 3 && score > 0) {
    addThreat(10, "obfuscation", "low",
      `Múltiplas concatenações de string (${concatMatches.length}) — possível montagem de payload`,
      "..");
  }

  // ---- 5. Delays antes de ações (gg.sleep) ----
  const sleepRegex = /gg\.sleep\s*\(\s*\d+\s*\)/g;
  const sleepMatch = sleepRegex.exec(code);
  if (sleepMatch) {
    // Verifica se há ação suspeita após o sleep
    const after = code.substring(sleepMatch.index, sleepMatch.index + 400);
    if (/\b(send|post|request|encode|decode|loadstring|load)\b/i.test(after)) {
      addThreat(10, "persistence", "medium",
        "gg.sleep seguido de ação suspeita (atraso intencional)",
        sample(sleepMatch.index, sleepMatch[0].length));
    }
  }

  // ---- 6. Ofuscação ----
  // 6a. Tabela de strings escondendo identificadores (ex: local a = {"gg","toast"})
  const tableHide = /local\s+\w+\s*=\s*\{\s*(?:["'][^"']+["']\s*,\s*){2,}["'][^"']+["']\s*\}/g;
  const tMatch = tableHide.exec(code);
  if (tMatch) {
    addThreat(25, "obfuscation", "high",
      "Tabela de strings usada para esconder identificadores",
      sample(tMatch.index, tMatch[0].length));
  }
  // 6b. Acesso indireto via _G[...]
  const gAccess = /_G\s*\[/g;
  const gMatch = gAccess.exec(code);
  if (gMatch) {
    addThreat(25, "obfuscation", "high",
      "Acesso indireto via _G[...] (ofuscação de chamadas globais)",
      sample(gMatch.index, gMatch[0].length));
  }
  // 6c. loadstring / load(string)
  const loadRe = /\b(loadstring|load)\s*\(/g;
  const loadMatch = loadRe.exec(code);
  if (loadMatch) {
    addThreat(25, "obfuscation", "high",
      "Execução dinâmica de código (loadstring/load)",
      sample(loadMatch.index, loadMatch[0].length));
  }
  // 6d. Nomes de variáveis aleatórios (>=3 com aspecto random: ≥8 chars sem vogal/consoante alternada)
  const idents = code.match(/\blocal\s+([a-zA-Z_]\w{7,})\b/g) || [];
  const random = idents.filter((s) => {
    const name = s.replace(/^local\s+/, "");
    // sem vogais OU mistura caótica de letras+dígitos sem padrão
    return !/[aeiouAEIOU]/.test(name) || /^[a-zA-Z]{2,}\d{3,}[a-zA-Z]{2,}/.test(name);
  });
  if (random.length >= 3) {
    addThreat(25, "obfuscation", "high",
      `Nomes de variáveis com aparência aleatória (${random.length} encontrados)`,
      random.slice(0, 3).join(", "));
  }

  // ---- 7. Padrões críticos diretos (sempre flag) ----
  const criticalPatterns = [
    { re: /os\.execute\s*\(/g, desc: "os.execute — execução de comando do sistema", points: 50 },
    { re: /io\.popen\s*\(/g, desc: "io.popen — abertura de processo do sistema", points: 50 },
    { re: /\/bin\/sh|\/bin\/bash|cmd\.exe/g, desc: "Referência direta a shell do sistema", points: 50 },
  ];
  for (const p of criticalPatterns) {
    const m = p.re.exec(code);
    if (m) {
      addThreat(p.points, "system_command", "critical", p.desc, sample(m.index, m[0].length));
    }
  }

  // ---- Classificação ----
  let classification: "safe" | "suspicious" | "malicious";
  if (score >= 50) classification = "malicious";
  else if (score >= 21) classification = "suspicious";
  else classification = "safe";

  // securityScore: 100 = totalmente seguro, 0 = pior
  const securityScore = Math.max(0, Math.min(100, 100 - score));

  const summary = threats.length === 0
    ? "Nenhum padrão suspeito detectado pela análise heurística."
    : `Análise heurística: ${threats.length} sinal(is) suspeito(s) detectado(s). Pontuação de risco: ${score}.`;

  return {
    classification,
    securityScore,
    threats,
    summary,
    functionality: "Análise comportamental heurística realizada. Para descrição detalhada da funcionalidade, use análise por IA.",
    _heuristicScore: score,
  };
}

/**
 * Combina resultado da IA + heurística, sempre priorizando o pior caso (segurança > falsos positivos).
 */
function mergeAnalyses(ai: any, heuristic: any) {
  const order = { safe: 0, suspicious: 1, malicious: 2 } as const;
  const aiCls = (ai.classification ?? "safe") as keyof typeof order;
  const heuCls = (heuristic.classification ?? "safe") as keyof typeof order;
  const worst = order[aiCls] >= order[heuCls] ? aiCls : heuCls;

  // Mescla ameaças (deduplicadas por descrição)
  const seen = new Set<string>();
  const threats: any[] = [];
  for (const t of [...(ai.threats ?? []), ...(heuristic.threats ?? [])]) {
    const k = `${t.type}|${t.description}`;
    if (!seen.has(k)) { seen.add(k); threats.push(t); }
  }

  return {
    classification: worst,
    securityScore: Math.min(ai.securityScore ?? 100, heuristic.securityScore ?? 100),
    threats,
    summary: ai.summary ?? heuristic.summary,
    functionality: ai.functionality ?? heuristic.functionality,
    _heuristicScore: heuristic._heuristicScore,
  };
}

