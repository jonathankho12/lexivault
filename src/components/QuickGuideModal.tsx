"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Flame,
  GraduationCap,
  Layers,
  Sparkles,
  Volume2,
} from "lucide-react";
import { LexiAvatar, type LexiReactionType } from "@/components/LexiAvatar";
import { AudioButton } from "@/components/ui/AudioButton";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault, useOverlayBackGuard } from "@/context/LexiVaultContext";
import { resolveDailyPackTier } from "@/lib/dailyPackTiers";
import { IOS_EASE, IOS_SHEET_SPRING, IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import {
  playCorrectChime,
  playGlassClick,
  playWrongThud,
} from "@/lib/soundEffects";
import { cn } from "@/lib/utils";
import type { AuthUser, DailyPackTargetTier } from "@/types/lexivault";

const TOTAL_STEPS = 3;

type StarterLevelId = Extract<
  DailyPackTargetTier,
  "A1-A2" | "B1-B2" | "C1-C2"
>;

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
  onStartDailyPack?: () => void;
}

const SLIDE_VARIANTS = {
  enter: (direction: number) => ({
    x: direction >= 0 ? 28 : -28,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction >= 0 ? -28 : 28,
    opacity: 0,
  }),
};

function mapResolvedTierToStarterLevel(
  tier: DailyPackTargetTier
): StarterLevelId {
  if (tier === "A1-A2" || tier === "A2-B1") return "A1-A2";
  if (tier === "C1-C2") return "C1-C2";
  return "B1-B2";
}

export function QuickGuideModal({
  open,
  onClose,
  onStartDailyPack,
}: QuickGuideModalProps) {
  const { t } = useLanguage();
  const {
    dailyQuota,
    updateDailyQuota,
    userCefr,
    placementCefr,
    setActiveTab,
    openDailyPackModal,
  } = useLexiVault();

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedLevel, setSelectedLevel] = useState<StarterLevelId>("B1-B2");
  const [levelChanged, setLevelChanged] = useState(false);

  const [pickedChoiceIdx, setPickedChoiceIdx] = useState<number | null>(null);
  const [quizSolved, setQuizSolved] = useState(false);
  const [lexiReaction, setLexiReaction] = useState<LexiReactionType | null>(
    null
  );
  const [lexiNonce, setLexiNonce] = useState(0);

  // Reset interactive state whenever the modal opens
  useEffect(() => {
    if (!open) return;
    const resolved = resolveDailyPackTier(
      dailyQuota.targetLevel,
      userCefr ?? placementCefr
    );
    setStepIndex(0);
    setDirection(1);
    setSelectedLevel(mapResolvedTierToStarterLevel(resolved));
    setLevelChanged(false);
    setPickedChoiceIdx(null);
    setQuizSolved(false);
    setLexiReaction(null);
  }, [dailyQuota.targetLevel, open, placementCefr, userCefr]);

  const triggerLexiReaction = useCallback((next: LexiReactionType) => {
    setLexiReaction(next);
    setLexiNonce((n) => n + 1);
  }, []);

  const handleDismiss = useCallback(() => {
    playGlassClick();
    onClose();
  }, [onClose]);

  const handleExploreVault = useCallback(() => {
    playCorrectChime(2);
    onClose();
    setActiveTab("vault");
  }, [onClose, setActiveTab]);

  const handleStartFirstPack = useCallback(() => {
    playCorrectChime(2);
    if (onStartDailyPack) {
      onStartDailyPack();
      return;
    }
    onClose();
    setActiveTab("vault");
    openDailyPackModal();
  }, [onClose, onStartDailyPack, openDailyPackModal, setActiveTab]);

  const handleNext = useCallback(() => {
    if (stepIndex >= TOTAL_STEPS - 1) {
      handleStartFirstPack();
      return;
    }
    playGlassClick();
    setDirection(1);
    const next = Math.min(TOTAL_STEPS - 1, stepIndex + 1);
    setStepIndex(next);
    if (next === 2) {
      triggerLexiReaction("treat");
    }
  }, [handleStartFirstPack, stepIndex, triggerLexiReaction]);

  const handleBack = useCallback(() => {
    if (stepIndex <= 0) return;
    playGlassClick();
    setDirection(-1);
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, [stepIndex]);

  useOverlayBackGuard("quick_guide", open, handleDismiss);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleDismiss, open]);

  const handlePickLevel = (tierId: StarterLevelId) => {
    playGlassClick();
    setSelectedLevel(tierId);
    setLevelChanged(true);
    updateDailyQuota({ targetLevel: tierId });
    triggerLexiReaction("pet");
  };

  const handlePickMiniQuizChoice = (idx: number) => {
    if (quizSolved) return;
    setPickedChoiceIdx(idx);
    if (idx === t.quickGuide.step2.correctIndex) {
      setQuizSolved(true);
      playCorrectChime(2);
      triggerLexiReaction("super");
    } else {
      playWrongThud();
    }
  };

  const levelOptions: ReadonlyArray<{
    id: StarterLevelId;
    title: string;
    badge: string;
    desc: string;
    badgeClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: "A1-A2",
      title: t.quickGuide.step1.options.starterTitle,
      badge: t.quickGuide.step1.options.starterBadge,
      desc: t.quickGuide.step1.options.starterDesc,
      badgeClass: "bg-[#30D158]/16 border-[#30D158]/35 text-[#7CF099]",
      icon: Sparkles,
    },
    {
      id: "B1-B2",
      title: t.quickGuide.step1.options.intermediateTitle,
      badge: t.quickGuide.step1.options.intermediateBadge,
      desc: t.quickGuide.step1.options.intermediateDesc,
      badgeClass: "bg-[#0A84FF]/16 border-[#0A84FF]/35 text-[#70BCFF]",
      icon: Layers,
    },
    {
      id: "C1-C2",
      title: t.quickGuide.step1.options.advancedTitle,
      badge: t.quickGuide.step1.options.advancedBadge,
      desc: t.quickGuide.step1.options.advancedDesc,
      badgeClass: "bg-[#FF9F0A]/16 border-[#FF9F0A]/35 text-[#FFD18C]",
      icon: GraduationCap,
    },
  ];

  const activeLevelMeta =
    levelOptions.find((opt) => opt.id === selectedLevel) ?? levelOptions[1];
  const progressRatio = (stepIndex + 1) / TOTAL_STEPS;
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
            transition={{ duration: 0.16 }}
            onClick={handleDismiss}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Duolingo-Style Guided Sheet */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-guide-title"
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 22, scale: 0.96 }}
            transition={IOS_SHEET_SPRING}
            className="liquid-glass-elevated transform-gpu will-change-transform relative z-10 w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto no-scrollbar rounded-t-[32px] sm:rounded-[32px] p-5 sm:p-7 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          >
            {/* Mobile drag handle */}
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25 sm:hidden" />

            {/* Top Progress Header */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[#70BCFF]">
                  <Compass className="h-3.5 w-3.5 shrink-0" />
                  <span>{t.quickGuide.eyebrow}</span>
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#8E8E93] tabular-nums">
                    {stepCounterText}
                  </span>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="rounded-full px-2.5 py-1 text-xs font-semibold text-[#8E8E93] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                  >
                    {t.quickGuide.skip}
                  </button>
                </div>
              </div>

              {/* Duolingo-Style Segmented Top Progress Bar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                  className="h-full w-full rounded-full bg-gradient-to-r from-[#30D158] via-[#0A84FF] to-[#5E5CE6] transform-gpu will-change-transform"
                  style={{ transformOrigin: "left" }}
                  initial={false}
                  animate={{ scaleX: progressRatio }}
                  transition={IOS_SPRING}
                />
              </div>
            </div>

            {/* Step Content */}
            <div className="mt-5 min-h-[320px] flex flex-col justify-between overflow-hidden">
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                {stepIndex === 0 && (
                  <motion.div
                    key="step-1"
                    custom={direction}
                    variants={SLIDE_VARIANTS}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.2, ease: IOS_EASE }}
                    className="space-y-4 transform-gpu will-change-transform"
                  >
                    {/* Lexi Cheer Prompt */}
                    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3">
                      <LexiAvatar
                        mood={levelChanged ? "happy" : "alert"}
                        size="sm"
                        animated
                        reaction={lexiReaction}
                        reactionNonce={lexiNonce}
                      />
                      <p className="text-xs sm:text-[13px] font-medium text-[#E5E5EA] leading-snug">
                        {levelChanged
                          ? t.quickGuide.step1.selectedHint.replace(
                              "{tier}",
                              activeLevelMeta.badge
                            )
                          : t.quickGuide.step1.lexiLine}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <h2
                        id="quick-guide-title"
                        className="text-xl font-bold tracking-tight text-white"
                      >
                        {t.quickGuide.step1.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-[#8E8E93]">
                        {t.quickGuide.step1.subtitle}
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      {levelOptions.map((opt) => {
                        const Icon = opt.icon;
                        const active = selectedLevel === opt.id;
                        return (
                          <motion.button
                            key={opt.id}
                            type="button"
                            whileTap={TAP_SCALE}
                            onClick={() => handlePickLevel(opt.id)}
                            className={cn(
                              "w-full flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all cursor-pointer",
                              active
                                ? "bg-[#0A84FF]/16 border-[#0A84FF]/55 shadow-[0_6px_22px_rgba(10,132,255,0.2)]"
                                : "bg-white/[0.04] border-white/[0.09] hover:bg-white/[0.08]"
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                                opt.badgeClass
                              )}
                            >
                              <Icon className="h-4.5 w-4.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">
                                  {opt.title}
                                </span>
                                <span
                                  className={cn(
                                    "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                                    opt.badgeClass
                                  )}
                                >
                                  {opt.badge}
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-[#8E8E93] leading-snug">
                                {opt.desc}
                              </p>
                            </div>
                            <span
                              aria-hidden="true"
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                                active
                                  ? "border-[#0A84FF] bg-[#0A84FF] text-white"
                                  : "border-white/25 bg-transparent"
                              )}
                            >
                              {active && <CheckCircle2 className="h-3.5 w-3.5" />}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {stepIndex === 1 && (
                  <motion.div
                    key="step-2"
                    custom={direction}
                    variants={SLIDE_VARIANTS}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.2, ease: IOS_EASE }}
                    className="space-y-4 transform-gpu will-change-transform"
                  >
                    {/* Lexi Prompt / Win Reaction */}
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
                        quizSolved
                          ? "bg-[#30D158]/14 border-[#30D158]/40"
                          : "bg-white/[0.04] border-white/[0.08]"
                      )}
                    >
                      <LexiAvatar
                        mood={quizSolved ? "happy" : "alert"}
                        size="sm"
                        animated
                        reaction={lexiReaction}
                        reactionNonce={lexiNonce}
                      />
                      <p className="text-xs sm:text-[13px] font-medium text-[#E5E5EA] leading-snug">
                        {quizSolved
                          ? t.quickGuide.step2.lexiWin
                          : t.quickGuide.step2.lexiPrompt}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <h2
                        id="quick-guide-title"
                        className="text-xl font-bold tracking-tight text-white"
                      >
                        {t.quickGuide.step2.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-[#8E8E93]">
                        {t.quickGuide.step2.subtitle}
                      </p>
                    </div>

                    {/* Interactive Mini-Exercise Card */}
                    <div className="rounded-2xl bg-white/[0.045] border border-white/[0.11] p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg sm:text-xl font-bold text-white tracking-tight">
                              {t.quickGuide.step2.term}
                            </span>
                            <span className="text-xs font-mono text-[#8E8E93]">
                              {t.quickGuide.step2.phonetic}
                            </span>
                          </div>
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF]/14 border border-[#0A84FF]/30 px-2.5 py-0.5 text-[11px] font-medium text-[#70BCFF]">
                            <Volume2 className="h-3 w-3 shrink-0" />
                            <span>
                              {t.quickGuide.step2.chunkLabel}: &ldquo;
                              {t.quickGuide.step2.chunk}&rdquo;
                            </span>
                          </div>
                        </div>

                        <AudioButton text={t.quickGuide.step2.term} size="sm" />
                      </div>

                      <div className="pt-1 space-y-2">
                        <p className="text-xs font-semibold text-[#D1D1D6]">
                          {t.quickGuide.step2.prompt}
                        </p>
                        <div className="space-y-2">
                          {t.quickGuide.step2.choices.map((choice, idx) => {
                            const isCorrectChoice =
                              idx === t.quickGuide.step2.correctIndex;
                            const isPicked = pickedChoiceIdx === idx;
                            return (
                              <motion.button
                                key={choice}
                                type="button"
                                whileTap={quizSolved ? undefined : TAP_SCALE}
                                disabled={quizSolved}
                                onClick={() => handlePickMiniQuizChoice(idx)}
                                className={cn(
                                  "w-full flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left text-xs sm:text-[13px] font-medium transition-all",
                                  quizSolved && isCorrectChoice
                                    ? "bg-[#30D158]/20 border-[#30D158]/55 text-[#A6F8BA]"
                                    : isPicked && !isCorrectChoice
                                      ? "bg-[#FF9F0A]/16 border-[#FF9F0A]/45 text-[#FFD18C]"
                                      : "bg-white/[0.04] border-white/[0.1] text-[#F5F5F7] hover:bg-white/[0.09] hover:border-[#0A84FF]/40 cursor-pointer"
                                )}
                              >
                                <span>{choice}</span>
                                {quizSolved && isCorrectChoice && (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#30D158]" />
                                )}
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>

                      {pickedChoiceIdx !== null && !quizSolved && (
                        <p className="text-[11px] font-medium text-[#FFD18C]">
                          {t.quickGuide.step2.tryAgainHint}
                        </p>
                      )}

                      {quizSolved && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={IOS_SPRING}
                          className="rounded-xl bg-[#30D158]/16 border border-[#30D158]/40 px-3 py-2 text-xs font-semibold text-[#A6F8BA]"
                        >
                          <p className="font-bold text-white">
                            {t.quickGuide.step2.winBannerTitle}
                          </p>
                          <p className="text-[11px] text-[#A6F8BA] mt-0.5">
                            {t.quickGuide.step2.winBannerBody}
                          </p>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}

                {stepIndex === 2 && (
                  <motion.div
                    key="step-3"
                    custom={direction}
                    variants={SLIDE_VARIANTS}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.2, ease: IOS_EASE }}
                    className="flex flex-col items-center text-center space-y-4 py-2 transform-gpu will-change-transform"
                  >
                    <div className="relative flex items-center justify-center py-1">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-5 rounded-full blur-2xl"
                        style={{
                          background:
                            "radial-gradient(circle,rgba(48,209,88,0.28) 0%,rgba(10,132,255,0.14) 55%,transparent 75%)",
                        }}
                      />
                      <LexiAvatar
                        mood="happy"
                        size="lg"
                        animated
                        reaction={lexiReaction}
                        reactionNonce={lexiNonce}
                        className="relative z-10 rounded-3xl shadow-[0_12px_30px_rgba(48,209,88,0.22)]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <h2
                        id="quick-guide-title"
                        className="text-xl sm:text-2xl font-bold tracking-tight text-white"
                      >
                        {t.quickGuide.step3.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-[#D1D1D6] leading-relaxed max-w-sm mx-auto">
                        {t.quickGuide.step3.description}
                      </p>
                    </div>

                    <div className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.09] p-3.5 space-y-2 text-left">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-[#8E8E93]">
                          {t.quickGuide.step3.chosenLevelLabel}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
                            activeLevelMeta.badgeClass
                          )}
                        >
                          {activeLevelMeta.title} ({activeLevelMeta.badge})
                        </span>
                      </div>
                      <p className="text-[11px] text-[#70BCFF] flex items-center gap-1.5">
                        <Flame className="h-3.5 w-3.5 text-[#FF9F0A] shrink-0" />
                        <span>{t.quickGuide.step3.starterMissionPreview}</span>
                      </p>
                    </div>

                    <p className="text-xs italic text-[#8E8E93]">
                      &ldquo;{t.quickGuide.step3.lexiLine}&rdquo;
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom Action Bar */}
            {stepIndex < TOTAL_STEPS - 1 ? (
              <div className="mt-5 flex items-center justify-between gap-3 pt-4 border-t border-white/[0.08]">
                {stepIndex === 0 ? (
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
                  className={cn(
                    "flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-xs sm:text-sm font-semibold text-white transition-all cursor-pointer",
                    stepIndex === 1 && quizSolved
                      ? "bg-gradient-to-r from-[#30D158] to-[#0A84FF] shadow-[0_8px_24px_rgba(48,209,88,0.32)] hover:brightness-110"
                      : "bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] shadow-[0_8px_24px_rgba(10,132,255,0.32)] hover:brightness-110"
                  )}
                >
                  <span>{t.quickGuide.next}</span>
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
              </div>
            ) : (
              <div className="mt-5 space-y-2.5 pt-4 border-t border-white/[0.08]">
                <motion.button
                  type="button"
                  whileTap={TAP_SCALE}
                  onClick={handleStartFirstPack}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#30D158] to-[#0A84FF] px-6 py-3 text-sm font-bold text-white shadow-[0_10px_28px_rgba(48,209,88,0.3)] hover:brightness-110 transition-all cursor-pointer"
                >
                  <span>{t.quickGuide.step3.primaryCta}</span>
                </motion.button>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-[#8E8E93] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>{t.quickGuide.back}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExploreVault}
                    className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/[0.1] px-4 py-1.5 text-xs font-semibold text-[#F5F5F7] hover:bg-white/[0.12] transition-colors cursor-pointer"
                  >
                    <span>{t.quickGuide.step3.secondaryCta}</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
