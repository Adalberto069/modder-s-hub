import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function obfNames() {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const rand = () => {
    let s = "_";
    for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * 26)];
    return s;
  };
  return {
    start: rand(), limit: rand(), expired: rand(), origAlert: rand(),
    origToast: rand(), origSleep: rand(), check: rand(), fn: rand(),
    err: rand(), ok: rand(), errMsg: rand(), elapsed: rand(),
    remaining: rand(), hash: rand(), selfCheck: rand(),
    decKey: rand(), decData: rand(), decFunc: rand(),
  };
}

function xorEncode(code: string, key: number): number[] {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(code);
  const result: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    result.push(bytes[i] ^ ((key + i) % 256));
  }
  return result;
}

function scrambleArray(arr: number[], scrambleKey: number): number[] {
  return arr.map((v, i) => v ^ ((scrambleKey + i * 3) % 256));
}

function buildTestWrapper(originalCode: string, minutes: number): string {
  const v = obfNames();
  const expirationSeconds = minutes * 60;
  const xorKey = Math.floor(Math.random() * 200) + 10;
  const scrambleKey = Math.floor(Math.random() * 200) + 10;
  const encoded = xorEncode(originalCode, xorKey);
  const scrambled = scrambleArray(encoded, scrambleKey);

  const chunkSize = 80;
  const chunks: string[] = [];
  for (let i = 0; i < scrambled.length; i += chunkSize) {
    chunks.push(scrambled.slice(i, i + chunkSize).join(","));
  }
  const bytesLiteral = `{${chunks.join(",\n")}}`;

  const integrityVal = Object.values(v).reduce((s, n) => s + n.length, 0);

  return `--[[ HM-TEST ]]
do
local ${v.start}=os.time()
local ${v.limit}=${expirationSeconds}
local ${v.expired}=false
local ${v.origAlert}=gg.alert
local ${v.origToast}=gg.toast
local ${v.origSleep}=gg.sleep
local _origChoice=gg.choice
local _origPrompt=gg.prompt
local ${v.hash}=${integrityVal}

local function ${v.selfCheck}()
  local _t=0
  ${Object.values(v).map(n => `_t=_t+${n.length}`).join("\n  ")}
  if _t~=${v.hash} then
    ${v.origAlert}("Arquivo corrompido.","ERRO")
    os.exit()
  end
end
${v.selfCheck}()

local function ${v.check}()
  if ${v.expired} then return true end
  local ${v.elapsed}=os.time()-${v.start}
  if ${v.elapsed}>=${v.limit} then
    ${v.expired}=true
    pcall(function() gg.clearResults() gg.clearList() end)
    ${v.origAlert}(
      "TEMPO DE TESTE ESGOTADO\\n\\n"..
      "Gostou? Compre o script completo no marketplace!\\n\\n"..
      "HiddenMod","HIDDENMOD")
    os.exit()
    return true
  end
  local ${v.remaining}=${v.limit}-${v.elapsed}
  if ${v.remaining}<=60 and ${v.remaining}%15<2 then
    ${v.origToast}(">> "..${v.remaining}.."s restantes")
  end
  return false
end

gg.sleep=function(ms)
  if ${v.check}() then os.exit() return end
  ${v.origSleep}(ms)
  if ${v.check}() then os.exit() return end
end

gg.alert=function(...)
  if ${v.check}() then os.exit() return end
  return ${v.origAlert}(...)
end

gg.toast=function(...)
  if ${v.check}() then os.exit() return end
  return ${v.origToast}(...)
end

gg.choice=function(...)
  if ${v.check}() then os.exit() return nil end
  return _origChoice(...)
end

gg.prompt=function(...)
  if ${v.check}() then os.exit() return nil end
  return _origPrompt(...)
end

${v.origToast}("TESTE: ${minutes}min | HiddenMod")
${v.origAlert}(
  "MODO DE TESTE - MARKETPLACE\\n\\n"..
  "Voce tem ${minutes} minuto(s) para testar.\\n"..
  "Apos o tempo o script para automaticamente.\\n\\n"..
  "Se gostar, compre no marketplace!\\n\\n"..
  "HiddenMod","HIDDENMOD - TESTE")

local function _xor(a,b)
  local r,p=0,1
  for j=0,7 do
    local ba=a%2 local bb=b%2
    if ba+bb==1 then r=r+p end
    a=math.floor(a/2) b=math.floor(b/2) p=p*2
  end
  return r
end

local _sk=${scrambleKey}
local _b=${bytesLiteral}
local _d={}
local _k=${xorKey}
for i=1,#_b do
  local ${v.decData}=_xor(_b[i],(_sk+(i-1)*3)%256)
  _d[i]=string.char(_xor(${v.decData},(_k+i-1)%256))
end
local _src=table.concat(_d)

_b=nil _d=nil _sk=nil _k=nil

local ${v.fn},${v.err}=load(_src)
if not ${v.fn} then
  ${v.fn},${v.err}=loadstring(_src)
end
_src=nil

if ${v.fn} then
  local ${v.ok},${v.errMsg}=pcall(${v.fn})
  if not ${v.ok} and not ${v.expired} then
    ${v.origToast}("Erro: "..tostring(${v.errMsg}))
  end
else
  ${v.origAlert}("Erro ao carregar: "..tostring(${v.err}),"ERRO")
end
end
`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { script_id } = await req.json();
    if (!script_id) {
      return new Response(JSON.stringify({ error: "script_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check script exists and is paid
    const { data: script, error: scriptError } = await adminClient
      .from("scripts")
      .select("id, title, file_url, is_paid, modder_id, publish_status, is_active")
      .eq("id", script_id)
      .single();

    if (scriptError || !script) {
      return new Response(JSON.stringify({ error: "Script não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!script.is_paid) {
      return new Response(JSON.stringify({ error: "Scripts gratuitos podem ser baixados diretamente" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (script.publish_status !== "published" || !script.is_active) {
      return new Response(JSON.stringify({ error: "Script não disponível" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Owner doesn't need test
    if (user.id === script.modder_id) {
      return new Response(JSON.stringify({ error: "Você é o dono deste script" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already purchased
    const { data: existingPurchase } = await adminClient
      .from("purchases")
      .select("id")
      .eq("script_id", script_id)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .maybeSingle();

    if (existingPurchase) {
      return new Response(JSON.stringify({ error: "Você já comprou este script" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: max 1 test per script per account
    const { data: existingTest } = await adminClient
      .from("script_test_logs")
      .select("id")
      .eq("user_id", user.id)
      .eq("script_id", script_id)
      .maybeSingle();

    if (existingTest) {
      return new Response(JSON.stringify({ error: "Você já utilizou seu teste gratuito para este script. Cada conta tem direito a apenas 1 teste por script." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the code from script_code table
    const { data: codeData } = await adminClient
      .from("script_code")
      .select("lua_code")
      .eq("script_id", script_id)
      .single();

    let originalCode: string | null = null;

    if (codeData?.lua_code) {
      originalCode = codeData.lua_code;
    } else if (script.file_url) {
      // Try downloading from storage
      const filePath = script.file_url.startsWith("http")
        ? null
        : script.file_url;

      if (filePath) {
        const { data: fileData, error: fileError } = await adminClient.storage
          .from("scripts-private")
          .download(filePath);

        if (!fileError && fileData) {
          originalCode = await fileData.text();
        }
      }
    }

    if (!originalCode) {
      return new Response(JSON.stringify({ error: "Código do script não disponível para teste" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const minutes = 3;
    const wrappedCode = buildTestWrapper(originalCode, minutes);

    return new Response(JSON.stringify({
      test_code: wrappedCode,
      file_name: `TESTE_${minutes}min_${script.title.replace(/[^a-zA-Z0-9\-_]/g, "_")}.lua`,
      expires_minutes: minutes,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
