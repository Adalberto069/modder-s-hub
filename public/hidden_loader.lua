--[[
    HIDDENMOD - ELITE LOADER PROTOTYPE
    Developed for HiddenMod Ecosystem
]]

local API_URL = "https://rdagqukqmphvlxbrefil.supabase.co/functions/v1"
local SAVE_PATH = gg.EXT_STORAGE .. "/hidden_license.txt"

-- Estética Elite (Cores e ASCII)
local RED = "§r"
local GOLD = "§y"
local WHITE = "§w"
local BOLD = "§b"

local function splash()
    gg.alert([[
    ]] .. GOLD .. [[
    █ █ █ █▀▀▄ █▀▀▄ █▀▀ █▄  █
    █▀█ █ █  █ █  █ █▀▀ █ █ █
    ▀ ▀ ▀ ▀▀▀  ▀▀▀  ▀▀▀ ▀  ▀▀
    
    ]] .. WHITE .. [[H I D D E N  M O D  |  E L I T E  L O A D E R
    --------------------------------------
    Conectando ao servidor seguro...]])
end

local function getLicense()
    local f = io.open(SAVE_PATH, "r")
    if f then
        local key = f:read("*all")
        f:close()
        return key
    end
    return nil
end

local function saveLicense(key)
    local f = io.open(SAVE_PATH, "w")
    if f then
        f:write(key)
        f:close()
    end
end

local function loadScripts(key)
    local res = gg.makeRequest(API_URL .. "/list-user-scripts?key=" .. key)
    if not res or res.code ~= 200 then
        return nil, "Licença inválida ou erro de conexão"
    end
    
    local data = gg.jsonDecode(res.content)
    return data.scripts
end

local function main()
    splash()
    
    local key = getLicense()
    if not key then
        local prompt = gg.prompt({"Digite sua Licença HiddenMod:"}, {""}, {"text"})
        if not prompt then return end
        key = prompt[1]
      end
      
      gg.toast("Autenticando...")
      local scripts, err = loadScripts(key)
      
      if err then
          gg.alert("Erro: " .. err)
          os.remove(SAVE_PATH) -- Limpa se estiver errado
          return
      end
      
      saveLicense(key) -- Salva se funcionar
      
      local titles = {}
      for i, s in ipairs(scripts) do
          titles[i] = "🚀 " .. s.title
      end
      titles[#titles + 1] = "❌ Sair"
      
      local menu = gg.choice(titles, nil, "HIDDENMOD - SELECIONE O SCRIPT")
      
      if not menu or menu == #titles then return end
      
      local selected = scripts[menu]
      gg.toast("Carregando " .. selected.title .. "...")
      
      -- Chama o endpoint de carregamento real
      local scriptRes = gg.makeRequest(API_URL .. "/get-script?key=" .. selected.key)
      
      if not scriptRes or scriptRes.code ~= 200 then
          gg.alert("Erro ao baixar script")
          return
      end
      
      -- EXECUÇÃO EM MEMÓRIA (LOADSTRING)
      local exec, execErr = load(scriptRes.content)
      if not exec then
          gg.alert("Erro de sintaxe no script remoto: " .. tostring(execErr))
      else
          exec() -- Roda o script
      end
  end
  
  main()
