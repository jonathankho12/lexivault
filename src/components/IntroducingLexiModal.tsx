"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { LexiAvatar } from "@/components/LexiAvatar";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault, useOverlayBackGuard } from "@/context/LexiVaultContext";
import { IOS_SHEET_SPRING, IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { playCorrectChime, playGlassClick } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";

export function IntroducingLexiModal() {
  const { isLexiIntroOpen, completeLexiIntro, lexiEnabled, setLexiEnabled } =
    useLexiVault();
  const { t } = useLanguage();
  const intro = t.lexi.intro;
  const [submitting, setSubmitting] = useState<"check-level" | "skip" | null>(
    null
  );

  useOverlayBackGuard("lexi_intro", isLexiIntroOpen, () => {
    void completeLexiIntro("skip");
  });

  const handleAction = async (action: "check-level" | "skip") => {
    if (submitting) return;
    setSubmitting(action);
    if (action === "check-level") {
      playCorrectChime(2);
    } else {
      playGlassClick();
    }
    try {
      await completeLexiIntro(action);
    } finally {
      setSubmitting(null);
    }
  };

  const handleToggleLexi = () => {
    playGlassClick();
    setLexiEnabled(!lexiEnabled);
  };

  return (
    <AnimatePresence>
      {isLexiIntroOpen && (
        <div
          key="introducing-lexi-portal"
          className="fixed inset-0 z-[65] flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Centered Onboarding Card */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lexi-intro-headline"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={IOS_SHEET_SPRING}
            className="liquid-glass-elevated transform-gpu will-change-transform relative z-10 w-full max-w-md rounded-[32px] p-6 sm:p-8 text-center"
          >
            {/* Subtle top accent glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#0A84FF]/60 to-transparent"
            />

            <div className="flex flex-col items-center space-y-5">
              {/* Guardian Badge */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF]/15 border border-[#0A84FF]/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#70BCFF]">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Vocabulary Guardian</span>
              </span>

              {/* Minimalist Rottweiler Avatar with smooth entrance & live ON/OFF reaction */}
              <motion.div
                initial={{ opacity: 0, scale: 0.84, y: 10 }}
                animate={{
                  opacity: lexiEnabled ? 1 : 0.88,
                  scale: lexiEnabled ? 1 : 0.95,
                  y: 0,
                }}
                transition={IOS_SPRING}
                className="relative flex items-center justify-center py-1 transform-gpu will-change-transform"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-4 rounded-full blur-xl transform-gpu transition-opacity duration-300"
                  style={{
                    background: lexiEnabled
                      ? "radial-gradient(circle,rgba(48,209,88,0.24) 0%,rgba(10,132,255,0.14) 48%,transparent 74%)"
                      : "radial-gradient(circle,rgba(10,132,255,0.14) 0%,transparent 72%)",
                  }}
                />
                <LexiAvatar
                  mood={lexiEnabled ? "happy" : "sleepy"}
                  size="xl"
                  animated
                  className="relative z-10 rounded-3xl shadow-[0_14px_34px_rgba(0,0,0,0.38)]"
                />
              </motion.div>

              {/* Headline & Subcopy */}
              <div className="space-y-2.5">
                <h2
                  id="lexi-intro-headline"
                  className="text-2xl font-bold tracking-tight text-white"
                >
                  Meet Lexi, your vocabulary guardian.
                </h2>
                <p className="text-sm text-[#D1D1D6] leading-relaxed">
                  Every daily drill keeps your English sharp—and keeps Lexi
                  happy. Skip too many days, and your vault gets dusty.
                </p>
              </div>

              {/* Interactive Companion Toggle */}
              <div className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-left space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-white">
                      Lexi Companion
                    </p>
                    <p className="text-[11px] font-medium text-[#70BCFF]">
                      {lexiEnabled
                        ? "Active on your Dashboard"
                        : "Paused — hidden on Dashboard"}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-label="Enable Lexi Companion"
                    aria-checked={lexiEnabled}
                    onClick={handleToggleLexi}
                    className={cn(
                      "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors cursor-pointer p-0.5",
                      lexiEnabled
                        ? "bg-[#30D158] border-[#30D158]"
                        : "bg-white/[0.1] border-white/[0.15]"
                    )}
                  >
                    <span
                      className={cn(
                        "h-5.5 w-5.5 rounded-full bg-white shadow transition-transform transform-gpu",
                        lexiEnabled ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                <p className="text-[11px] text-[#8E8E93] leading-snug">
                  You can turn Lexi on or off anytime in Settings.
                </p>
              </div>

              {/* Actions */}
              <div className="w-full space-y-2.5 pt-0.5">
                <motion.button
                  type="button"
                  whileTap={TAP_SCALE}
                  disabled={submitting !== null}
                  onClick={() => void handleAction("check-level")}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(10,132,255,0.34)] hover:brightness-110 transition-all cursor-pointer disabled:opacity-60"
                >
                  {submitting === "check-level" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Opening Level Check...</span>
                    </>
                  ) : (
                    <>
                      <span>Say Hi & Check My Level</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </motion.button>

                <button
                  type="button"
                  disabled={submitting !== null}
                  onClick={() => void handleAction("skip")}
                  className="w-full rounded-full py-2.5 px-4 text-xs font-medium text-[#8E8E93] hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting === "skip" ? "Opening Dashboard..." : "Skip to Dashboard"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
