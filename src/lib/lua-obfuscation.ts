/**
 * Heuristic detector for obfuscated / packed Lua scripts.
 * HiddenMod handles obfuscation server-side on delivery — modders must
 * upload the original source so we can analyze, watermark and protect it.
 *
 * Returns { obfuscated: true, reason } when the code looks packed.
 */
export type ObfuscationCheck = { obfuscated: boolean; reason?: string };

export function detectLuaObfuscation(code: string): ObfuscationCheck {
  if (!code || code.trim().length < 20) return { obfuscated: false };

  const src = code;
  const len = src.length;

  // 1. Massive decimal byte-escape blobs ("\123\045\067…") — classic XOR packer payload
  const decEscapes = src.match(/\\\d{1,3}/g)?.length ?? 0;
  if (decEscapes > 80 || (decEscapes > 0 && decEscapes * 4 > len * 0.3)) {
    return { obfuscated: true, reason: "Sequência massiva de escapes decimais (\\ddd) — payload empacotado." };
  }

  // 2. Hex byte escape blobs ("\x4f\x2a…")
  const hexEscapes = src.match(/\\x[0-9a-fA-F]{2}/g)?.length ?? 0;
  if (hexEscapes > 80) {
    return { obfuscated: true, reason: "Sequência massiva de escapes hex (\\xNN) — payload empacotado." };
  }

  // 3. loadstring/load combinado com decodificador XOR/bit32 ou string.char em loop
  const hasLoader = /\b(loadstring|load)\s*\(/.test(src);
  const hasBitXor = /(bit32\.bxor|bit\.bxor|\bbxor\b)/.test(src);
  const hasStringChar = /string\.char\s*\(/.test(src);
  const hasTableConcat = /table\.concat\s*\(/.test(src);
  if (hasLoader && (hasBitXor || (hasStringChar && hasTableConcat))) {
    return { obfuscated: true, reason: "Padrão de runtime-loader detectado (load/loadstring + decodificador)." };
  }

  // 4. Linhas absurdamente longas (packers concatenam tudo em 1 linha)
  const longestLine = src.split("\n").reduce((m, l) => Math.max(m, l.length), 0);
  if (longestLine > 4000) {
    return { obfuscated: true, reason: "Linha muito longa (>4000 chars) — código minificado/empacotado." };
  }

  // 5. Marcadores comuns de obfuscadores conhecidos
  if (/Prometheus|Ironbrew|Luraph|psu\.dev|moonsec|XFuscator/i.test(src)) {
    return { obfuscated: true, reason: "Assinatura de obfuscador conhecido encontrada." };
  }

  // 6. Densidade alta de identificadores aleatórios curtos (_aZ9k, __xY1) — típico de renomeação automática
  const randIdents = src.match(/\b_[a-zA-Z0-9]{6,}\b/g) ?? [];
  const uniqueRand = new Set(randIdents).size;
  if (uniqueRand > 40 && hasLoader) {
    return { obfuscated: true, reason: "Muitos identificadores aleatórios + loader dinâmico." };
  }

  return { obfuscated: false };
}
