import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generate a random variable name
function randVar(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const prefix = chars[Math.floor(Math.random() * chars.length)];
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${prefix}${suffix}`;
}

// Memory-efficient Lua obfuscation: encodes code as padded decimal sequences in a string literal
function obfuscateLua(code: string, buyerId: string): string {
  const encodedBuyerId = Array.from(new TextEncoder().encode(buyerId))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const codeBytes = Array.from(new TextEncoder().encode(code));
  const key = Math.floor(Math.random() * 200) + 50; // XOR key

  const chunks: string[] = [];
  const chunkSize = 16384; // 16KB strings to avoid line limits
  let currentChunk = "";
  
  for (let i = 0; i < codeBytes.length; i++) {
    const dec = codeBytes[i] ^ key;
    currentChunk += "\\" + dec.toString(10).padStart(3, "0");
    if ((i + 1) % chunkSize === 0 || i === codeBytes.length - 1) {
      chunks.push(`    "${currentChunk}"`);
      currentChunk = "";
    }
  }
  
  const byteListMultiline = chunks.join(",\n");

  const vP = randVar();
  const vK = randVar();
  const vS = randVar();
  const vRes = randVar();
  const vChunk = randVar();
  const vC = randVar();
  const vBxor = randVar();
  const vI = randVar();
  const vDec = randVar();
  const vF = randVar();
  const vInit = randVar();

  const obfuscated = [
    `-- Protected by GG Marketplace`,
    `-- Buyer ID: ${encodedBuyerId}`,
    `-- Redistribution is prohibited`,
    `local function ${vInit}()`,
    `  local ${vP} = {`,
    byteListMultiline,
    `  }`,
    `  local ${vK} = ${key}`,
    `  local ${vS} = table.concat(${vP})`,
    `  local ${vRes} = {}`,
    `  local ${vChunk} = {}`,
    `  local ${vC} = 1`,
    `  local ${vBxor} = bit32 and bit32.bxor or function(a,b) local c,d=0,1; for e=0,7 do if a%2~=b%2 then c=c+d end; a=math.floor(a/2); b=math.floor(b/2); d=d*2 end return c end`,
    `  for ${vI} = 1, #${vS} do`,
    `    ${vChunk}[${vC}] = string.char(${vBxor}(string.byte(${vS}, ${vI}), ${vK}))`,
    `    ${vC} = ${vC} + 1`,
    `    if ${vC} > 4096 then`,
    `      ${vRes}[#${vRes}+1] = table.concat(${vChunk})`,
    `      ${vChunk} = {}`,
    `      ${vC} = 1`,
    `    end`,
    `  end`,
    `  if ${vC} > 1 then`,
    `    ${vRes}[#${vRes}+1] = table.concat(${vChunk})`,
    `  end`,
    `  local ${vDec} = table.concat(${vRes})`,
    `  local ${vF} = load or loadstring`,
    `  return ${vF}(${vDec})()`,
    `end`,
    `return ${vInit}()`,
    ""
  ].join("\n");

  return obfuscated;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return new Response(JSON.stringify({ error: "License key required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate license
    const { data: license } = await supabase
      .from("licenses")
      .select("id, status, script_id, user_id")
      .eq("license_key", key)
      .single();

    if (!license || license.status !== "active") {
      return new Response(JSON.stringify({ error: "Invalid or banned license" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the script
    const { data: script } = await supabase
      .from("scripts")
      .select("lua_code, file_url, title")
      .eq("id", license.script_id)
      .single();

    if (!script) {
      return new Response(JSON.stringify({ error: "Script not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get raw code
    let code = script.lua_code;
    if (!code && script.file_url) {
      try {
        const res = await fetch(script.file_url);
        code = await res.text();
      } catch {
        return new Response(JSON.stringify({ error: "Failed to fetch script file" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!code) {
      return new Response(JSON.stringify({ error: "No script content available" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Obfuscate with embedded buyer ID
    const obfuscatedCode = obfuscateLua(code, license.user_id);

    return new Response(obfuscatedCode, {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
