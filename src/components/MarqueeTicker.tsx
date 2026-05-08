import { Fingerprint, ShieldCheck, Terminal, Zap, KeyRound, Cpu } from "lucide-react";

const items = [
  { icon: Terminal, text: "lua · gameguardian · obfuscated" },
  { icon: ShieldCheck, text: "watermark anti-leak per buyer" },
  { icon: KeyRound, text: "license keys · revocable" },
  { icon: Zap, text: "split 80 / 20 · mercado pago" },
  { icon: Cpu, text: "ai security scan on upload" },
  { icon: Fingerprint, text: "hidden protocol · v2" },
];

export function MarqueeTicker() {
  // duplicate the list so the loop appears seamless
  const loop = [...items, ...items];
  return (
    <div className="marquee border-y border-white/10 bg-[#030305] py-3">
      <div className="marquee-track">
        {loop.map((it, i) => {
          const Icon = it.icon;
          return (
            <span
              key={i}
              className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground whitespace-nowrap"
            >
              <Icon className="h-3.5 w-3.5 text-neon-green/70" />
              {it.text}
              <span className="text-white/15">//</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
