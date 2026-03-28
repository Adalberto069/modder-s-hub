import { useState } from "react";
import { Terminal, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface CodeTerminalProps {
  code: string;
  title?: string;
}

export function CodeTerminal({ code, title = "hidden_forge_output.lua" }: CodeTerminalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Código copiado para o clipboard! ⚡");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!code) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative my-6 group"
    >
      <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-purple/20 to-neon-cyan/20 blur opacity-75 group-hover:opacity-100 transition duration-500 rounded-xl" />
      <div className="relative rounded-xl border border-white/10 bg-[#0a0a0c] overflow-hidden shadow-2xl">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/40" />
            </div>
            <div className="flex items-center gap-2">
              <Terminal className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">{title}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-white/5 text-muted-foreground hover:text-white transition-all"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-neon-green" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* Code Content */}
        <div className="p-4 overflow-x-auto">
          <pre className="font-mono text-xs sm:text-sm leading-relaxed text-indigo-300/90 selection:bg-neon-purple/30">
            <code>{code}</code>
          </pre>
        </div>

        {/* Status Bar */}
        <div className="px-4 py-1.5 bg-black/40 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-wider text-muted-foreground/30">
            <span>Encoding: UTF-8</span>
            <span>Language: Lua</span>
          </div>
          <div className="text-[9px] font-black uppercase tracking-wider text-neon-purple/40 italic">
            HiddenForge System Verified
          </div>
        </div>
      </div>
    </motion.div>
  );
}
