"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Flame } from "lucide-react";
import { IOS_SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function ComboBadge({ combo }: { combo: number }) {
  const show = combo >= 3;
  const tierLabel =
    combo >= 10 ? "Unstoppable" : combo >= 5 ? "On Fire" : "Combo";

  return (
    <div className="h-7 shrink-0 inline-flex items-center justify-end">
      <AnimatePresence mode="wait">
        {show && (
          <motion.div
            key="combo-active"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={IOS_SPRING}
            className={cn(
              "transform-gpu will-change-transform inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-bold border transition-colors",
              combo >= 10
                ? "bg-[#BF5AF2]/25 border-[#BF5AF2]/55 text-[#F2CCFF]"
                : combo >= 5
                  ? "bg-[#FF9F0A]/25 border-[#FF9F0A]/55 text-[#FFE0A6]"
                  : "bg-[#30D158]/22 border-[#30D158]/50 text-[#8FF5A7]"
            )}
          >
            <Flame className="h-3.5 w-3.5 shrink-0 fill-current" />
            <span className="tabular-nums">
              {combo}x {tierLabel}!
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
