"use client";

import { motion } from "framer-motion";
import { useLexiVault } from "@/context/LexiVaultContext";
import { IOS_SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { AccentType } from "@/types/lexivault";

const OPTIONS: { id: AccentType; label: string; tag: string }[] = [
  { id: "US", label: "US", tag: "American" },
  { id: "UK", label: "UK", tag: "British" },
];

export function AccentToggle({
  instanceId = "global",
  compact = false,
}: {
  instanceId?: string;
  compact?: boolean;
}) {
  const { accent, setAccent } = useLexiVault();

  return (
    <div
      role="group"
      aria-label="Global pronunciation accent"
      className={cn(
        "relative inline-flex items-center rounded-full p-1",
        "bg-white/[0.06] border border-white/[0.11]",
        "shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.16)]"
      )}
    >
      {OPTIONS.map((opt) => {
        const active = accent === opt.id;
        return (
          <motion.button
            key={opt.id}
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => setAccent(opt.id)}
            className={cn(
              "relative z-10 flex items-center gap-1.5 rounded-full font-medium transition-colors select-none cursor-pointer",
              compact ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-xs",
              active ? "text-white" : "text-[#8E8E93] hover:text-[#F5F5F7]"
            )}
          >
            {active && (
              <motion.span
                layoutId={`accent-pill-${instanceId}`}
                transition={IOS_SPRING}
                className="transform-gpu will-change-transform absolute inset-0 -z-10 rounded-full bg-gradient-to-b from-[#0A84FF]/80 to-[#5E5CE6]/80 border border-white/25 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]"
              />
            )}
            <span className="font-semibold tracking-tight">{opt.label}</span>
            {!compact && (
              <span className="hidden sm:inline text-[10px] opacity-80">
                {opt.tag}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
