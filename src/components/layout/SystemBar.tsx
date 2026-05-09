import { useEffect, useState } from "react";

/**
 * Slim system status bar shown above the navbar — gives the site
 * a "live console" feel: secure-link badge, uptime clock, build hash.
 */
export function SystemBar() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const utc = time.toISOString().slice(11, 19);
  const build = "h1dd3n.04a7"; // visual flavor — not a real hash

  return (
    <div className="hidden md:block w-full border-b border-white/5 bg-[#030305] text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
      <div className="container flex h-7 items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <span className="live-dot" />
            <span className="text-neon-green">link/secure</span>
          </span>
          <span className="opacity-60">node//br-sa-1</span>
          <span className="opacity-60 hidden lg:inline">tls/1.3 · aead</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="opacity-60 hidden lg:inline">build {build}</span>
          <span>utc {utc}</span>
        </div>
      </div>
    </div>
  );
}
