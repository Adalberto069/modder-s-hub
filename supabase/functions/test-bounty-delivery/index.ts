import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const minutes = Math.min(Math.max(test_minutes || 5, 1), 10); // 1-10 min

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get delivery + bounty info
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

    // Only requester can test
    if (user.id !== bounty.requester_id) {
      return new Response(JSON.stringify({ error: "Apenas o solicitante pode testar" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already approved or disputed
    if (delivery.test_approved) {
      return new Response(JSON.stringify({ error: "Script já aprovado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download the original file from storage
    const { data: fileData, error: fileError } = await adminClient.storage
      .from("bounty-deliveries")
      .download(delivery.file_url);

    if (fileError || !fileData) {
      return new Response(JSON.stringify({ error: "Erro ao acessar arquivo" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const originalCode = await fileData.text();

    // Wrap with time-limited Lua loader
    const expirationSeconds = minutes * 60;
    const wrappedCode = `--[[ HIDDENMOD - TESTE TEMPORÁRIO ]]
-- Este script expira em ${minutes} minutos.
-- Após o teste, aprove ou dispute na plataforma.

local _HM_TEST_START = os.time()
local _HM_TEST_LIMIT = ${expirationSeconds}
local _HM_EXPIRED = false

local _HM_ORIGINAL_ALERT = gg.alert
local _HM_ORIGINAL_TOAST = gg.toast

-- Timer check wrapper
local function _HM_CHECK_TIME()
  if _HM_EXPIRED then return true end
  local elapsed = os.time() - _HM_TEST_START
  if elapsed >= _HM_TEST_LIMIT then
    _HM_EXPIRED = true
    pcall(function()
      gg.clearResults()
      gg.clearList()
    end)
    _HM_ORIGINAL_ALERT(
      "⏰ TEMPO DE TESTE ESGOTADO\\n\\n" ..
      "O período de teste de ${minutes} minuto(s) terminou.\\n\\n" ..
      "Se o script funcionou corretamente:\\n" ..
      "→ Volte à plataforma e clique em APROVAR\\n" ..
      "→ Depois finalize o pagamento\\n\\n" ..
      "Se houve problemas:\\n" ..
      "→ Clique em DISPUTAR na plataforma\\n\\n" ..
      "HiddenMod - Entrega Segura 🔐",
      "HIDDENMOD"
    )
    return true
  end
  -- Show remaining time periodically
  local remaining = _HM_TEST_LIMIT - elapsed
  if remaining <= 60 and remaining % 15 == 0 then
    _HM_ORIGINAL_TOAST("⏰ Teste: " .. remaining .. "s restantes")
  end
  return false
end

-- Override gg.sleep to add time checks
local _HM_ORIGINAL_SLEEP = gg.sleep
gg.sleep = function(ms)
  if _HM_CHECK_TIME() then return end
  _HM_ORIGINAL_SLEEP(ms)
  _HM_CHECK_TIME()
end

_HM_ORIGINAL_TOAST("🔬 MODO TESTE: ${minutes} min | HiddenMod")
_HM_ORIGINAL_ALERT(
  "🔬 MODO DE TESTE ATIVO\\n\\n" ..
  "Você tem ${minutes} minuto(s) para testar este script.\\n" ..
  "Após o tempo, o script será interrompido automaticamente.\\n\\n" ..
  "Teste à vontade e depois volte à plataforma\\n" ..
  "para APROVAR ou DISPUTAR.\\n\\n" ..
  "HiddenMod - Entrega Segura 🔐",
  "HIDDENMOD - TESTE"
)

-- Run original code in protected environment
local _HM_FN, _HM_ERR = load([==[
${originalCode.replace(/\]=*\]/g, (match) => "]" + "=" + match)}
]==])

if _HM_FN then
  -- Periodic time checks during execution
  local _HM_TIMER = coroutine.create(function()
    while not _HM_EXPIRED do
      _HM_ORIGINAL_SLEEP(5000)
      if _HM_CHECK_TIME() then
        break
      end
    end
  end)
  
  -- Start the script
  local ok, err = pcall(_HM_FN)
  if not ok and not _HM_EXPIRED then
    _HM_ORIGINAL_TOAST("Erro no script: " .. tostring(err))
  end
else
  _HM_ORIGINAL_ALERT("Erro ao carregar script de teste: " .. tostring(_HM_ERR), "ERRO")
end
`;

    // Return the wrapped test script as downloadable content
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
