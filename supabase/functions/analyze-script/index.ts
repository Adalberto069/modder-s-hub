import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();

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

    const prompt = `You are a Lua script security analyzer for a game modding platform. Analyze the following Lua script and return a JSON response with exactly this structure (no markdown, no code blocks, just raw JSON):

{
  "classification": "safe" | "suspicious" | "malicious",
  "securityScore": number (0-100, where 100 is completely safe),
  "threats": [
    {
      "type": "system_command" | "network_abuse" | "filesystem" | "obfuscation" | "encoded_payload" | "reverse_shell" | "persistence",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "Brief description in Portuguese",
      "line": "relevant code snippet"
    }
  ],
  "summary": "Short description in Portuguese of what the script does (max 3 sentences)",
  "functionality": "Brief explanation in Portuguese of the main functionality and possible use cases (max 3 sentences)"
}

Check for:
1. Dangerous system commands (os.execute, io.popen, os.remove, loadstring with external input)
2. Network abuse (hidden HTTP requests, socket connections, data exfiltration)
3. File system manipulation (reading/deleting files, writing to system paths)
4. Obfuscation (string.char chains, loadstring of concatenated strings, byte manipulation)
5. Embedded binaries or encoded payloads (base64 blobs, hex payloads, long encoded strings)
6. Reverse shells, remote command execution, persistence mechanisms
7. Excessive use of pcall/xpcall to hide errors from malicious operations

If no threats are found, return an empty threats array.

Script to analyze:
\`\`\`lua
${code.substring(0, 50000)}
\`\`\``;

    // Try AI analysis first, fallback to static
    let parsed;
    try {
      const session = new (globalThis as any).Supabase.ai.Session('google/gemini-2.5-flash');
      const aiOutput = await session.run(prompt, { stream: false });
      const content = typeof aiOutput === 'string' ? aiOutput : (aiOutput as any)?.content ?? JSON.stringify(aiOutput);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (aiError) {
      console.error("AI analysis failed, using static fallback:", aiError);
      parsed = performStaticAnalysis(code);
    }

    return new Response(JSON.stringify(parsed), {
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

function performStaticAnalysis(code: string) {
  const threats: Array<{ type: string; severity: string; description: string; line: string }> = [];

  const patterns = [
    { regex: /os\.execute\s*\(/g, type: "system_command", severity: "critical", desc: "Execução de comando do sistema detectada" },
    { regex: /io\.popen\s*\(/g, type: "system_command", severity: "critical", desc: "Abertura de processo do sistema detectada" },
    { regex: /os\.remove\s*\(/g, type: "filesystem", severity: "high", desc: "Remoção de arquivo do sistema detectada" },
    { regex: /os\.rename\s*\(/g, type: "filesystem", severity: "medium", desc: "Renomeação de arquivo do sistema detectada" },
    { regex: /io\.open\s*\([^)]*['"]\s*\/(?:etc|tmp|var|usr)/g, type: "filesystem", severity: "critical", desc: "Acesso a diretório sensível do sistema" },
    { regex: /loadstring\s*\(/g, type: "obfuscation", severity: "high", desc: "Execução dinâmica de código (loadstring)" },
    { regex: /load\s*\(/g, type: "obfuscation", severity: "medium", desc: "Carregamento dinâmico de código" },
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
