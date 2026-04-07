import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generate a random variable name safe for all Lua versions
function randVar(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const first = chars[Math.floor(Math.random() * chars.length)];
  const rest = Math.random().toString(36).substring(2, 7);
  return first + rest;
}

// Memory-efficient Lua obfuscation compatible with LuaJ (Android/GG)
function obfuscateLua(code: string, buyerId: string): string {
  const encodedBuyerId = Array.from(new TextEncoder().encode(buyerId))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const codeBytes = Array.from(new TextEncoder().encode(code));
  const key = Math.floor(Math.random() * 200) + 50; // XOR key

  // Use much smaller chunks per line to avoid "failed read line" (line length limits)
  // 80 bytes = 320 characters per line after \ddd escaping
  const chunks: string[] = [];
  const bytesPerLine = 80;
  
  for (let i = 0; i < codeBytes.length; i += bytesPerLine) {
    let line = "";
    const slice = codeBytes.slice(i, i + bytesPerLine);
    for (const b of slice) {
      line += "\\" + (b ^ key).toString(10).padStart(3, "0");
    }
    chunks.push(`    "${line}"`);
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

  return [
    `-- Protected by GG Marketplace`,
    `-- ID: ${encodedBuyerId}`,
    `local function ${vInit}()`,
    `  local ${vP} = {`,
    byteListMultiline,
    `  }`,
    `  local ${vK} = ${key}`,
    `  local ${vS} = table.concat(${vP})`,
    `  local ${vRes} = {}`,
    `  local ${vChunk} = {}`,
    `  local ${vC} = 0`,
    `  local ${vBxor} = bit32 and bit32.bxor or function(a,b) local c,d=0,1; for e=0,7 do if a%2~=b%2 then c=c+d end; a=math.floor(a/2); b=math.floor(b/2); d=d*2 end return c end`,
    `  for ${vI} = 1, #${vS} do`,
    `    ${vC} = ${vC} + 1`,
    `    ${vChunk}[${vC}] = string.char(${vBxor}(string.byte(${vS}, ${vI}), ${vK}))`,
    `    if ${vC} >= 2000 then`,
    `      ${vRes}[#${vRes}+1] = table.concat(${vChunk})`,
    `      ${vChunk} = {}`,
    `      ${vC} = 0`,
    `    end`,
    `  end`,
    `  if ${vC} > 0 then`,
    `    ${vRes}[#${vRes}+1] = table.concat(${vChunk})`,
    `  end`,
    `  local ${vDec} = table.concat(${vRes})`,
    `  local ${vF} = loadstring or load`,
    `  local ${vS}, ${vRes} = ${vF}(${vDec})`,
    `  if not ${vS} then error(${vRes}) end`,
    `  return ${vS}()`,
    `end`,
    `return ${vInit}()`,
    ""
  ].join("\n");
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

    // Get the script metadata
    const { data: script } = await supabase
      .from("scripts")
      .select("file_url, title")
      .eq("id", license.script_id)
      .single();

    if (!script) {
      return new Response(JSON.stringify({ error: "Script not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get lua_code from script_code table
    const { data: codeData } = await supabase
      .from("script_code")
      .select("lua_code")
      .eq("script_id", license.script_id)
      .single();

    let code = codeData?.lua_code ?? null;
    if (!code && script.file_url) {
      try {
        let fileContent: string | null = null;
        // If file_url is a private path (not a full URL), use signed URL
        if (!script.file_url.startsWith("http")) {
          const { data: signedData } = await supabase.storage
            .from("scripts-private")
            .createSignedUrl(script.file_url, 60);
          if (signedData?.signedUrl) {
            const res = await fetch(signedData.signedUrl);
            fileContent = await res.text();
          }
        } else {
          // Legacy public URL
          const res = await fetch(script.file_url);
          fileContent = await res.text();
        }
        code = fileContent;
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
