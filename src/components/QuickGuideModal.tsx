"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookMarked,
  Compass,
  GraduationCap,
  Layers,
  Sparkles,
  SpellCheck,
} from "lucide-react";
import { LexiAvatar } from "@/components/LexiAvatar";
import { useLanguage } from "@/context/LanguageContext";
import { useOverlayBackGuard } from "@/context/LexiVaultContext";
import { IOS_EASE, IOS_SHEET_SPRING, IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { playCorrectChime, playGlassClick } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/types/lexivault";

const TOTAL_STEPS = 4;

export function getQuickGuideStorageKey(user: AuthUser | null): string {
  const scope = !user || user.provider === "guest" ? "guest" : user.id;
  return `lexivault_seen_quick_guide_v1_${scope}`;
}

export function hasSeenQuickGuide(user: AuthUser | null): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(getQuickGuideStorageKey(user)) === "1";
  } catch {
    return true;
  }
}

export function markQuickGuideSeen(user: AuthUser | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getQuickGuideStorageKey(user), "1");
  } catch {
    // Ignore storage quota / privacy mode restrictions
  }
}

interface QuickGuideModalProps {
  open: boolean;
  onClose: () => void;
}

const SLIDE_VARIANTS = {
  enter: (direction: number) => ({
    x: direction >= 0 ? 32 : -32,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction >= 0 ? -32 : 32,
    opacity: 0,
  }),
};

const STEP_ACCENTS = [
  {
    glow: "radial-gradient(circle,rgba(10,132,255,0.28) 0%,rgba(94,92,230,0.14) 50%,transparent 75%)",
    iconBox:
      "bg-[#0A84FF]/18 border-[#0A84FF]/40 text-[#70BCFF] shadow-[0_12px_30px_rgba(10,132,255,0.22)]",
    secondaryBadge:
      "bg-[#5E5CE6]/20 border-[#5E5CE6]/40 text-[#E0AAFF]",
    chipClass:
      "bg-[#0A84FF]/12 border-[#0A84FF]/30 text-[#70BCFF]",
    topLine: "via-[#0A84FF]/65",
  },
  {
    glow: "radial-gradient(circle,rgba(255,159,10,0.24) 0%,rgba(94,92,230,0.16) 50%,transparent 75%)",
    iconBox:
      "bg-[#FF9F0A]/18 border-[#FF9F0A]/40 text-[#FFD18C] shadow-[0_12px_30px_rgba(255,159,10,0.2)]",
    secondaryBadge:
      "bg-[#0A84FF]/20 border-[#0A84FF]/40 text-[#70BCFF]",
    chipClass:
      "bg-[#FF9F0A]/12 border-[#FF9F0A]/30 text-[#FFD18C]",
    topLine: "via-[#FF9F0A]/65",
  },
  {
    glow: "radial-gradient(circle,rgba(191,90,242,0.26) 0%,rgba(10,132,255,0.14) 50%,transparent 75%)",
    iconBox:
      "bg-[#BF5AF2]/18 border-[#BF5AF2]/40 text-[#E0AAFF] shadow-[0_12px_30px_rgba(191,90,242,0.22)]",
    secondaryBadge:
      "bg-[#30D158]/20 border-[#30D158]/40 text-[#7CF099]",
    chipClass:
      "bg-[#BF5AF2]/12 border-[#BF5AF2]/30 text-[#E0AAFF]",
    topLine: "via-[#BF5AF2]/65",
  },
  {
    glow: "radial-gradient(circle,rgba(48,209,88,0.26) 0%,rgba(10,132,255,0.14) 50%,transparent 75%)",
    iconBox:
      "bg-[#30D158]/18 border-[#30D158]/40 text-[#7CF099] shadow-[0_12px_30px_rgba(48,209,88,0.22)]",
    secondaryBadge:
      "bg-[#FF9F0A]/20 border-[#FF9F0A]/40 text-[#FFD18C]",
    chipClass:
      "bg-[#30D158]/12 border-[#30D158]/30 text-[#7CF099]",
    topLine: "via-[#30D158]/65",
  },
] as const;

export function QuickGuideModal({ open, onClose }: QuickGuideModalProps) {
  const { t } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  // Reset to step 1 whenever the modal opens
  useEffect(() => {
    if (open) {
      setStepIndex(0);
      setDirection(1);
    }
  }, [open]);

  const handleDismiss = useCallback(() => {
    playGlassClick();
    onClose();
  }, [onClose]);

  const handleFinish = useCallback(() => {
    playCorrectChime(2);
    onClose();
  }, [onClose]);

  const handleNext = useCallback(() => {
    if (stepIndex >= TOTAL_STEPS - 1) {
      handleFinish();
      return;
    }
    playGlassClick();
    setDirection(1);
    setStepIndex((prev) => Math.min(TOTAL_STEPS - 1, prev + 1));
  }, [handleFinish, stepIndex]);

  const handleBack = useCallback(() => {
    if (stepIndex <= 0) return;
    playGlassClick();
    setDirection(-1);
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, [stepIndex]);

  const handleSelectStep = useCallback(
    (targetIdx: number) => {
      if (targetIdx === stepIndex) return;
      playGlassClick();
      setDirection(targetIdx > stepIndex ? 1 : -1);
      setStepIndex(targetIdx);
    },
    [stepIndex]
  );

  useOverlayBackGuard("quick_guide", open, handleDismiss);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleDismiss();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleBack();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleBack, handleDismiss, handleNext, open]);

  const currentStep = t.quickGuide.steps[stepIndex];
  const accent = STEP_ACCENTS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOTAL_STEPS - 1;
  const stepCounterText = t.quickGuide.stepOf
    .replace("{current}", String(stepIndex + 1))
    .replace("{total}", String(TOTAL_STEPS));

  return (
    <AnimatePresence>
      {open && (
        <div
          key="quick-guide-modal-portal"
          className="fixed inset-0 z-[64] flex items-end sm:items-center justify-center p-0 sm:p-6"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={handleDismiss}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Centered Glass Card (Desktop) / Bottom Sheet (Mobile) */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-guide-title"
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 22, scale: 0.96 }}
            transition={IOS_SHEET_SPRING}
            className="liquid-glass-elevated transform-gpu will-change-transform relative z-10 w-full sm:max-w-md max-h-[90dvh] overflow-y-auto no-scrollbar rounded-t-[32px] sm:rounded-[32px] p-5 sm:p-7 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          >
            {/* Subtle top accent line */}
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent to-transparent transition-colors duration-300",
                accent.topLine
              )}
            />

            {/* Mobile drag handle */}
            <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-white/25 sm:hidden" />

            {/* Top Bar: Eyebrow + Persistent Skip */}
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] px-3 py-1 text-[11px] font-semibold tracking-wide text-[#70BCFF]">
                <Compass className="h-3.5 w-3.5 shrink-0" />
                <span>{t.quickGuide.eyebrow}</span>
              </span>

              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-full px-3 py-1 text-xs font-semibold text-[#8E8E93] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                {t.quickGuide.skip}
              </button>
            </div>

            {/* Animated Step Content */}
            <div className="mt-5 min-h-[268px] sm:min-h-[280px] flex flex-col justify-center overflow-hidden">
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div
                  key={stepIndex}
                  custom={direction}
                  variants={SLIDE_VARIANTS}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: IOS_EASE }}
                  className="flex flex-col items-center text-center space-y-4 transform-gpu will-change-transform"
                >
                  {/* Step Hero Visual */}
                  <div className="relative flex items-center justify-center py-2">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-6 rounded-full blur-2xl"
                      style={{ background: accent.glow }}
                    />

                    {stepIndex === 0 && (
                      <div className="relative flex items-center justify-center">
                        <div
                          className={cn(
                            "flex h-18 w-18 items-center justify-center rounded-[24px] border",
                            accent.iconBox
                          )}
                        >
                          <BookMarked className="h-8 w-8" />
                        </div>
                        <div
                          className={cn(
                            "absolute -bottom-1.5 -right-2 flex h-8 w-8 items-center justify-center rounded-xl border backdrop-blur-md",
                            accent.secondaryBadge
                          )}
                        >
                          <Sparkles className="h-4 w-4" />
                        </div>
                      </div>
                    )}

                    {stepIndex === 1 && (
                      <div className="relative flex items-center justify-center">
                        <div
                          className={cn(
                            "flex h-18 w-18 items-center justify-center rounded-[24px] border",
                            accent.iconBox
                          )}
                        >
                          <Layers className="h-8 w-8" />
                        </div>
                        <div
                          className={cn(
                            "absolute -bottom-1.5 -right-2 flex h-8 w-8 items-center justify-center rounded-xl border backdrop-blur-md",
                            accent.secondaryBadge
                          )}
                        >
                          <GraduationCap className="h-4 w-4" />
                        </div>
                      </div>
                    )}

                    {stepIndex === 2 && (
                      <div className="relative flex items-center justify-center">
                        <div
                          className={cn(
                            "flex h-18 w-18 items-center justify-center rounded-[24px] border",
                            accent.iconBox
                          )}
                        >
                          <SpellCheck className="h-8 w-8" />
                        </div>
                        <div
                          className={cn(
                            "absolute -bottom-1.5 -right-2 flex h-8 w-8 items-center justify-center rounded-xl border backdrop-blur-md",
                            accent.secondaryBadge
                          )}
                        >
                          <Award className="h-4 w-4" />
                        </div>
                      </div>
                    )}

                    {stepIndex === 3 && (
                      <div className="relative flex items-center justify-center">
                        <LexiAvatar
                          mood="happy"
                          size="lg"
                          animated
                          className="relative z-10 rounded-3xl shadow-[0_12px_30px_rgba(48,209,88,0.22)]"
                        />
                        {/* Mini decorative 3-ring indicator badge */}
                        <div className="absolute -bottom-1.5 -right-2.5 z-20 flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0B0B0F] border border-white/[0.14] shadow-md">
                          <svg
                            viewBox="0 0 36 36"
                            className="h-6 w-6 -rotate-90"
                            aria-hidden="true"
                          >
                            <circle
                              cx="18"
                              cy="18"
                              r="14"
                              fill="none"
                              stroke="#0A84FF"
                              strokeWidth="3"
                              strokeDasharray="68 20"
                              strokeLinecap="round"
                            />
                            <circle
                              cx="18"
                              cy="18"
                              r="9.5"
                              fill="none"
                              stroke="#30D158"
                              strokeWidth="3"
                              strokeDasharray="48 14"
                              strokeLinecap="round"
                            />
                            <circle
                              cx="18"
                              cy="18"
                              r="5"
                              fill="none"
                              stroke="#BF5AF2"
                              strokeWidth="3"
                              strokeDasharray="24 8"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step Title & Body */}
                  <div className="space-y-2 px-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                      {stepCounterText}
                    </p>
                    <h2
                      id="quick-guide-title"
                      className="text-xl sm:text-2xl font-bold tracking-tight text-white"
                    >
                      {currentStep.title}
                    </h2>
                    <p className="text-sm text-[#D1D1D6] leading-relaxed max-w-sm mx-auto">
                      {currentStep.description}
                    </p>
                  </div>

                  {/* Feature Highlight Chips */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                    {currentStep.chips.map((chip) => (
                      <span
                        key={chip}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                          accent.chipClass
                        )}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Progress Dots */}
            <div
              role="tablist"
              aria-label={t.quickGuide.eyebrow}
              className="mt-4 flex items-center justify-center gap-2"
            >
              {Array.from({ length: TOTAL_STEPS }).map((_, idx) => {
                const active = idx === stepIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={t.quickGuide.stepOf
                      .replace("{current}", String(idx + 1))
                      .replace("{total}", String(TOTAL_STEPS))}
                    onClick={() => handleSelectStep(idx)}
                    className="p-1 cursor-pointer"
                  >
                    <motion.span
                      layout
                      transition={IOS_SPRING}
                      className={cn(
                        "block h-1.5 rounded-full transition-colors",
                        active
                          ? "w-6 bg-[#0A84FF]"
                          : "w-1.5 bg-white/25 hover:bg-white/40"
                      )}
                    />
                  </button>
                );
              })}
            </div>

            {/* Bottom Action Bar */}
            <div className="mt-5 flex items-center justify-between gap-3 pt-4 border-t border-white/[0.08]">
              {isFirst ? (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="inline-flex items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.1] px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#8E8E93] hover:text-white hover:bg-white/[0.1] transition-colors cursor-pointer"
                >
                  {t.quickGuide.skip}
                </button>
              ) : (
                <motion.button
                  type="button"
                  whileTap={TAP_SCALE}
                  onClick={handleBack}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#F5F5F7] hover:bg-white/[0.12] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>{t.quickGuide.back}</span>
                </motion.button>
              )}

              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                onClick={handleNext}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] px-6 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-[0_8px_24px_rgba(10,132,255,0.32)] hover:brightness-110 transition-all cursor-pointer"
              >
                <span>
                  {isLast ? t.quickGuide.startExploring : t.quickGuide.next}
                </span>
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
