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

/**
 * Double-layer XOR: first XOR the code bytes, then XOR the resulting array
 * values with a second key so they can't simply be read from the Lua table.
 */
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

  return `--[[ HM ]]
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
      "Volte a plataforma para APROVAR ou DISPUTAR.\\n\\n"..
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
  "MODO DE TESTE\\n\\n"..
  "Voce tem ${minutes} minuto(s).\\n"..
  "Apos o tempo o script para automaticamente.\\n\\n"..
  "Depois volte a plataforma para APROVAR ou DISPUTAR.\\n\\n"..
  "HiddenMod","HIDDENMOD - TESTE")

-- XOR helper
local function _xor(a,b)
  local r,p=0,1
  for j=0,7 do
    local ba=a%2 local bb=b%2
    if ba+bb==1 then r=r+p end
    a=math.floor(a/2) b=math.floor(b/2) p=p*2
  end
  return r
end

-- Descramble + Decode (double layer)
local _sk=${scrambleKey}
local _b=${bytesLiteral}
local _d={}
local _k=${xorKey}
for i=1,#_b do
  local ${v.decData}=_xor(_b[i],(_sk+(i-1)*3)%256)
  _d[i]=string.char(_xor(${v.decData},(_k+i-1)%256))
end
local _src=table.concat(_d)

-- Anti-dump: clear decode vars
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

    const { delivery_id, test_minutes } = await req.json();
    if (!delivery_id) {
      return new Response(JSON.stringify({ error: "delivery_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const minutes = Math.min(Math.max(test_minutes || 5, 1), 10);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: delivery, error: delError } = await adminClient
      .from("bounty_deliveries")
      .select("*, bounties!inner(requester_id, assigned_modder_id, status, reward_amount)")
      .eq("id", delivery_id)
      .single();

    if (delError || !delivery) {
      return new Response(JSON.stringify({ error: "Entrega não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bounty = delivery.bounties;

    if (user.id !== bounty.requester_id) {
      return new Response(JSON.stringify({ error: "Apenas o solicitante pode testar" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (delivery.test_approved) {
      return new Response(JSON.stringify({ error: "Script já aprovado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: fileData, error: fileError } = await adminClient.storage
      .from("bounty-deliveries")
      .download(delivery.file_url);

    if (fileError || !fileData) {
      return new Response(JSON.stringify({ error: "Erro ao acessar arquivo" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const originalCode = await fileData.text();
    const wrappedCode = buildTestWrapper(originalCode, minutes);

    return new Response(JSON.stringify({
      test_code: wrappedCode,
      file_name: `TESTE_${minutes}min_${delivery.file_name}`,
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
