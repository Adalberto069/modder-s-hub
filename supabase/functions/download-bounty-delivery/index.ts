import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---- Obfuscation (same as get-script) ----
function randVar(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const first = chars[Math.floor(Math.random() * chars.length)];
  const rest = Math.random().toString(36).substring(2, 7);
  return first + rest;
}

function obfuscateLua(code: string, buyerId: string): string {
  const encodedBuyerId = Array.from(new TextEncoder().encode(buyerId))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const codeBytes = Array.from(new TextEncoder().encode(code));
  const key = Math.floor(Math.random() * 200) + 50;

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

  const vP = randVar(), vK = randVar(), vS = randVar(), vRes = randVar();
  const vChunk = randVar(), vC = randVar(), vBxor = randVar(), vI = randVar();
  const vDec = randVar(), vF = randVar(), vInit = randVar();

  return [
    `-- Protected by HiddenMod`,
    `local _wm="${encodedBuyerId}"`,
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
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { delivery_id } = await req.json();
    if (!delivery_id) {
      return new Response(JSON.stringify({ error: "delivery_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: delivery, error: delError } = await adminClient
      .from("bounty_deliveries")
      .select("*, bounties!inner(requester_id, assigned_modder_id, status, reward_amount)")
      .eq("id", delivery_id)
      .single();

    if (delError || !delivery) {
      return new Response(JSON.stringify({ error: "Entrega não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bounty = delivery.bounties;
    const isRequester = user.id === bounty.requester_id;
    const isModder = user.id === bounty.assigned_modder_id;

    const { data: adminCheck } = await adminClient.rpc("is_admin", { _user_id: user.id });
    const userIsAdmin = !!adminCheck;

    // Helper: download file and return obfuscated code as JSON
    const downloadAndObfuscate = async (watermarkUserId: string) => {
      const { data: fileData, error: fileError } = await adminClient.storage
        .from("bounty-deliveries")
        .download(delivery.file_url);

      if (fileError || !fileData) {
        return new Response(JSON.stringify({ error: "Erro ao gerar download" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const originalCode = await fileData.text();
      const obfuscatedCode = obfuscateLua(originalCode, watermarkUserId);

      return new Response(JSON.stringify({
        code: obfuscatedCode,
        file_name: delivery.file_name,
        obfuscated: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    };

    // Modder gets their own raw file (they wrote it)
    if (isModder || userIsAdmin) {
      const { data: signedUrl, error: signError } = await adminClient.storage
        .from("bounty-deliveries")
        .createSignedUrl(delivery.file_url, 300);

      if (signError) {
        return new Response(JSON.stringify({ error: "Erro ao gerar download" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ url: signedUrl.signedUrl, file_name: delivery.file_name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Requester: only if released (payment confirmed) OR bounty is free
    if (isRequester) {
      const isPaid = Number(bounty.reward_amount) > 0;

      if (isPaid && !delivery.released) {
        return new Response(JSON.stringify({ error: "Pagamento pendente. Pague a recompensa para liberar o download." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Return obfuscated code with requester watermark
      return downloadAndObfuscate(user.id);
    }

    return new Response(JSON.stringify({ error: "Sem permissão" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
