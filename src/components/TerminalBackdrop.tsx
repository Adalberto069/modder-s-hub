import { cn } from "@/lib/utils";

// Static, original Lua sample: decorative only, unrelated to uploaded scripts.
const terminalSample = `-- hiddenmod / runtime.lua
local runtime = { modules = {}, ready = false }

function runtime.register(name, callback)
  assert(type(callback) == "function")
  runtime.modules[name] = callback
end

local function checksum(bytes)
  local sum = 0
  for i = 1, #bytes do
    sum = (sum + bytes:byte(i)) % 65536
  end
  return string.format("%04X", sum)
end

runtime.register("init", function()
  runtime.ready = true
  return checksum("HiddenMod")
end)

for name, execute in pairs(runtime.modules) do
  local ok, result = pcall(execute)
  if ok then print(name, result) end
end`;

export function TerminalBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("terminal-backdrop", className)}>
      <div className="mb-5 flex items-center gap-3 text-neon-cyan">
        <span>~/hiddenmod</span><span>lua runtime.lua</span>
      </div>
      <pre>{terminalSample}</pre>
      <span className="terminal-cursor">_</span>
    </div>
  );
}