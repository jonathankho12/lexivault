"use client";

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bone, X } from "lucide-react";
import { LexiAvatar } from "@/components/LexiAvatar";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { IOS_SPRING } from "@/lib/motion";

const CHEER_AUTO_DISMISS_MS = 3000;

/**
 * Compact, non-blocking 3s celebratory mini-cheer toast from Lexi.
 * Automatically respects the user's `lexiEnabled` toggle.
 */
export function LexiCheerToast() {
  const { lexiEnabled, lexiCheerToast, clearLexiCheerToast } = useLexiVault();
  const { t } = useLanguage();

  useEffect(() => {
    if (!lexiCheerToast || !lexiEnabled) return;
    const timer = window.setTimeout(() => {
      clearLexiCheerToast();
    }, CHEER_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [clearLexiCheerToast, lexiCheerToast, lexiEnabled]);

  if (!lexiEnabled) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-6 right-4 left-4 md:left-auto md:right-6 z-[75] flex justify-center md:justify-end">
      <AnimatePresence>
        {lexiCheerToast && (
          <motion.div
            key={lexiCheerToast.id}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={IOS_SPRING}
            className="pointer-events-auto liquid-glass-elevated transform-gpu will-change-transform w-full max-w-sm md:w-[348px] rounded-2xl border border-[#30D158]/40 bg-[#0C1412]/92 px-3.5 py-3 shadow-[0_14px_38px_rgba(0,0,0,0.52)]"
          >
            <div className="flex items-center gap-3">
              <LexiAvatar
                mood="happy"
                size="xs"
                animated
                reaction={lexiCheerToast.treatEarned ? "treat" : "pet"}
                reactionNonce={lexiCheerToast.id}
              />

              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-xs sm:text-[13px] font-bold text-white leading-tight truncate">
                    {lexiCheerToast.title}
                  </p>
                  {lexiCheerToast.treatEarned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FF9F0A]/20 border border-[#FF9F0A]/45 px-2 py-0.5 text-[10px] font-bold text-[#FFD18C] shrink-0">
                      <Bone className="h-2.5 w-2.5" />
                      <span>{t.lexi.cheer.treatEarnedTag}</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-[#D1D1D6] leading-snug">
                  {lexiCheerToast.body}
                </p>
              </div>

              <button
                type="button"
                onClick={clearLexiCheerToast}
                aria-label={t.lexi.cheer.dismissAria}
                className="shrink-0 rounded-full p-1 text-[#8E8E93] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
