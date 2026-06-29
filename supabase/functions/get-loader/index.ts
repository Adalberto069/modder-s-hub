import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOADER_SOURCE = `--[[
    HIDDENMOD - ELITE LOADER
]]
local API_URL = "https://rdagqukqmphvlxbrefil.supabase.co/functions/v1"
local SAVE_PATH = gg.EXT_STORAGE .. "/hidden_license.txt"

local function splash()
    gg.alert("HIDDENMOD - ELITE LOADER\\nConectando ao servidor seguro...")
end

local function getLicense()
    local f = io.open(SAVE_PATH, "r")
    if f then local key = f:read("*all") f:close() return key end
    return nil
end

local function saveLicense(key)
    local f = io.open(SAVE_PATH, "w")
    if f then f:write(key) f:close() end
end

local function loadScripts(key)
    local res = gg.makeRequest(API_URL .. "/list-user-scripts?key=" .. key)
    if not res or res.code ~= 200 then
        return nil, "Licenca invalida ou erro de conexao"
    end
    local data = gg.jsonDecode(res.content)
    return data.scripts
end

local function main()
    splash()
    local key = getLicense()
    if not key then
        local prompt = gg.prompt({"Digite sua Licenca HiddenMod:"}, {""}, {"text"})
        if not prompt then return end
        key = prompt[1]
    end
    gg.toast("Autenticando...")
    local scripts, err = loadScripts(key)
    if err then
        gg.alert("Erro: " .. err)
        os.remove(SAVE_PATH)
        return
    end
    saveLicense(key)
    local titles = {}
    for i, s in ipairs(scripts) do titles[i] = ">> " .. s.title end
    titles[#titles + 1] = "Sair"
    local menu = gg.choice(titles, nil, "HIDDENMOD - SELECIONE")
    if not menu or menu == #titles then return end
    local selected = scripts[menu]
    gg.toast("Carregando " .. selected.title .. "...")
    local sr = gg.makeRequest(API_URL .. "/get-script?key=" .. selected.key)
    if not sr or sr.code ~= 200 then gg.alert("Erro ao baixar script") return end
    local exec, e2 = load(sr.content)
    if not exec then exec, e2 = loadstring(sr.content) end
    if not exec then gg.alert("Erro de sintaxe: " .. tostring(e2)) else exec() end
end

main()
`;

function randVar() {
  const c = "abcdefghijklmnopqrstuvwxyz";
  return c[Math.floor(Math.random() * 26)] + Math.random().toString(36).slice(2, 7);
}

function obfuscate(code: string): string {
  const bytes = Array.from(new TextEncoder().encode(code));
  const key = Math.floor(Math.random() * 200) + 50;
  const per = 80;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += per) {
    let line = "";
    for (const b of bytes.slice(i, i + per)) line += "\\" + ((b ^ key).toString(10).padStart(3, "0"));
    chunks.push(`    "${line}"`);
  }
  const v: Record<string, string> = {};
  ["p","k","s","res","ch","c","bx","i","dec","f","init"].forEach(n => v[n] = randVar());
  return [
    `-- HiddenMod Elite Loader (protected build ${Date.now()})`,
    `local function ${v.init}()`,
    `  local ${v.p} = {`,
    chunks.join(",\n"),
    `  }`,
    `  local ${v.k} = ${key}`,
    `  local ${v.s} = table.concat(${v.p})`,
    `  local ${v.res} = {}`,
    `  local ${v.ch} = {}`,
    `  local ${v.c} = 0`,
    `  local ${v.bx} = bit32 and bit32.bxor or function(a,b) local c,d=0,1; for e=0,7 do if a%2~=b%2 then c=c+d end; a=math.floor(a/2); b=math.floor(b/2); d=d*2 end return c end`,
    `  for ${v.i} = 1, #${v.s} do`,
    `    ${v.c} = ${v.c} + 1`,
    `    ${v.ch}[${v.c}] = string.char(${v.bx}(string.byte(${v.s}, ${v.i}), ${v.k}))`,
    `    if ${v.c} >= 2000 then ${v.res}[#${v.res}+1] = table.concat(${v.ch}); ${v.ch} = {}; ${v.c} = 0 end`,
    `  end`,
    `  if ${v.c} > 0 then ${v.res}[#${v.res}+1] = table.concat(${v.ch}) end`,
    `  local ${v.dec} = table.concat(${v.res})`,
    `  local ${v.f} = loadstring or load`,
    `  local fn, err = ${v.f}(${v.dec})`,
    `  if not fn then error(err) end`,
    `  return fn()`,
    `end`,
    `return ${v.init}()`,
    "",
  ].join("\n");
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const obf = obfuscate(LOADER_SOURCE);
  return new Response(obf, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="hidden_loader.lua"',
      "Cache-Control": "no-store",
    },
  });
});
