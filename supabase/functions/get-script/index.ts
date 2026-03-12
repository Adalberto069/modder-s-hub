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
  const suffix = Math.random().toString(36).substring(2, 8);
  return `_${prefix}${suffix}`;
}

// Simple Lua obfuscation: wraps code in a loadstring with string encoding + watermark
function obfuscateLua(code: string, buyerId: string): string {
  const watermarkVar = randVar();
  const loaderVar = randVar();
  const decoderVar = randVar();
  const tblVar = randVar();
  const iterVar = randVar();
  const resultVar = randVar();
  const keyArgVar = randVar();
  const arrArgVar = randVar();

  // Encode the buyer ID as a hidden fingerprint
  const encodedBuyerId = Array.from(new TextEncoder().encode(buyerId))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Encode the original code as a byte array string
  const codeBytes = Array.from(new TextEncoder().encode(code));
  const key = Math.floor(Math.random() * 200) + 50; // XOR key

  // Split byte list into chunks of 80 per line to avoid LuaJ line length limit
  const encrypted = codeBytes.map((b) => b ^ key);
  const chunkSize = 80;
  const chunks: string[] = [];
  for (let i = 0; i < encrypted.length; i += chunkSize) {
    chunks.push(encrypted.slice(i, i + chunkSize).join(","));
  }
  const byteListMultiline = chunks.join(",\n");

  // Build the obfuscated Lua script
  // All variable names are pre-generated and reused consistently
  // Use \n (not \r\n) to avoid LuaJ line parsing issues on Android
  const obfuscated = [
    "-- Protected by GG Marketplace",
    "-- Redistribution is prohibited",
    `local ${watermarkVar}="${encodedBuyerId}"`,
    `local ${decoderVar}=function(${arrArgVar},${keyArgVar})`,
    `local ${resultVar}=""`,
    `for ${iterVar}=1,#${arrArgVar} do`,
    `${resultVar}=${resultVar}..string.char(bit32 and bit32.bxor(${arrArgVar}[${iterVar}],${keyArgVar}) or (function(a,b)local c=0;local d=1;for e=0,7 do local f=a%2;local g=b%2;if f~=g then c=c+d end;a=math.floor(a/2);b=math.floor(b/2);d=d*2 end;return c end)(${arrArgVar}[${iterVar}],${keyArgVar}))`,
    "end",
    `return ${resultVar}`,
    "end",
    `local ${tblVar}={`,
    byteListMultiline,
    `}`,
    `local ${loaderVar}=load or loadstring`,
    `${loaderVar}(${decoderVar}(${tblVar},${key}))()`,
  ].join("\n") + "\n";


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
