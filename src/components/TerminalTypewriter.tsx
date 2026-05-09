import { useEffect, useState } from "react";

const lines = [
  { p: "operator@hidden", c: "auth --token ********" },
  { p: "operator@hidden", c: "vault.scan --target marketplace" },
  { p: "vault", c: "found 1284 payloads · 312 modders" },
  { p: "operator@hidden", c: "deploy script.lua --watermark $buyer" },
  { p: "vault", c: "ok · obfuscated · signed · delivered" },
];

export function TerminalTypewriter() {
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);

  useEffect(() => {
    const current = lines[lineIdx].c;
    if (charIdx < current.length) {
      const t = setTimeout(() => setCharIdx(charIdx + 1), 35);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setCharIdx(0);
      setLineIdx((lineIdx + 1) % lines.length);
    }, 1400);
    return () => clearTimeout(t);
  }, [charIdx, lineIdx]);

  const visible = lines.slice(0, lineIdx + 1);

  return (
    <div className="ascii-frame w-full max-w-2xl bg-[#040406]/90 backdrop-blur border border-white/10 font-mono text-[11px] sm:text-xs leading-relaxed">
      {/* Window chrome */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-destructive/70" />
          <span className="h-2 w-2 rounded-full bg-yellow-500/70" />
          <span className="h-2 w-2 rounded-full bg-neon-green/70" />
          <span className="ml-3 opacity-70">~ /hidden/console</span>
        </span>
        <span className="opacity-50">tty0</span>
      </div>

      <div className="p-4 sm:p-5 space-y-1.5 min-h-[140px]">
        {visible.map((l, i) => {
          const isLast = i === visible.length - 1;
          const txt = isLast ? l.c.slice(0, charIdx) : l.c;
          const isVault = l.p === "vault";
          return (
            <div key={i} className="flex flex-wrap gap-2">
              <span className={isVault ? "text-neon-purple" : "text-neon-green"}>
                {l.p}
                <span className="text-muted-foreground">:~$</span>
              </span>
              <span className={`text-foreground/90 ${isLast ? "blink-caret" : ""}`}>
                {txt}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
