"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bone,
  Flame,
  Heart,
  MessageCircleHeart,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { LexiAvatar, type LexiReactionType } from "@/components/LexiAvatar";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import {
  computeLexiStatus,
  formatLexiTemplate,
  pickLexiSpeechBubble,
  type LexiMood,
} from "@/lib/lexi";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import {
  playGlassClick,
  playLexiPetSfx,
  playLexiTreatSfx,
} from "@/lib/soundEffects";
import { cn } from "@/lib/utils";

const SPEECH_BUBBLE_TIMEOUT_MS = 4500;
const REACTION_CLEAR_MS = 950;

const CARD_STYLE_BY_MOOD: Record<LexiMood, string> = {
  sleepy: "border-white/[0.1]",
  alert:
    "border-[#0A84FF]/35 bg-gradient-to-r from-[#0A84FF]/[0.08] via-white/[0.02] to-[#5E5CE6]/[0.07]",
  happy: "border-[#30D158]/35 bg-[#30D158]/[0.06]",
  restless:
    "border-[#FF9F0A]/35 bg-gradient-to-r from-[#FF9F0A]/[0.09] via-white/[0.02] to-transparent",
};

const BADGE_STYLE_BY_MOOD: Record<
  LexiMood,
  { pill: string; dot: string; bar: string }
> = {
  sleepy: {
    pill: "bg-white/[0.06] border-white/[0.12] text-[#D1D1D6]",
    dot: "bg-[#70BCFF]",
    bar: "from-[#70BCFF] to-[#0A84FF]",
  },
  alert: {
    pill: "bg-[#0A84FF]/15 border-[#0A84FF]/35 text-[#70BCFF]",
    dot: "bg-[#0A84FF]",
    bar: "from-[#0A84FF] to-[#5E5CE6]",
  },
  happy: {
    pill: "bg-[#30D158]/18 border-[#30D158]/40 text-[#7CF099]",
    dot: "bg-[#30D158]",
    bar: "from-[#30D158] to-[#0A84FF]",
  },
  restless: {
    pill: "bg-[#FF9F0A]/18 border-[#FF9F0A]/40 text-[#FFD18C]",
    dot: "bg-[#FF9F0A]",
    bar: "from-[#FF9F0A] to-[#0A84FF]",
  },
};

export function LexiStatusCard() {
  const {
    isHydrated,
    lexiEnabled,
    lexiCompanion,
    lexiBondInfo,
    isLexiHappyBoosted,
    petLexi,
    feedLexiTreat,
    studyLogs,
    todayStr,
    dailyRings,
    dailyPack,
    dailyQuota,
    streak,
    words,
    dueWordsCount,
    launchPractice,
    launchCommuteMode,
    setActiveTab,
    openDailyPackModal,
    openStreakCalendar,
    setSelectedWord,
  } = useLexiVault();
  const { lang, t } = useLanguage();

  const [tapCount, setTapCount] = useState(0);
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);
  const [reaction, setReaction] = useState<LexiReactionType | null>(null);
  const [reactionNonce, setReactionNonce] = useState(0);

  const lastBubbleRef = useRef<string | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
  const reactionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (bubbleTimerRef.current !== null) {
        window.clearTimeout(bubbleTimerRef.current);
      }
      if (reactionTimerRef.current !== null) {
        window.clearTimeout(reactionTimerRef.current);
      }
    };
  }, []);

  const status = useMemo(
    () =>
      computeLexiStatus({
        studyLogs,
        todayStr,
        dailyRings,
        dailyPack,
        dailyQuota,
        streak,
        words,
        lang,
        isHappyBoosted: isLexiHappyBoosted,
      }),
    [
      dailyPack,
      dailyQuota,
      dailyRings,
      isLexiHappyBoosted,
      lang,
      streak,
      studyLogs,
      todayStr,
      words,
    ]
  );

  if (!isHydrated || !lexiEnabled) {
    return null;
  }

  const badgeStyle = BADGE_STYLE_BY_MOOD[status.mood];
  const contextualNote = status.contextualNote;
  const bondTierName = t.lexi.bondTiers[lexiBondInfo.tierId];
  const bondTooltip = lexiBondInfo.nextTierId
    ? formatLexiTemplate(t.lexi.bondTooltipProgress, {
        tier: bondTierName,
        remaining: lexiBondInfo.treatsToNext,
        nextTier: t.lexi.bondTiers[lexiBondInfo.nextTierId],
      })
    : formatLexiTemplate(t.lexi.bondTooltipMax, {
        tier: bondTierName,
        total: lexiBondInfo.treatsFedTotal,
      });

  const showBubbleAndReaction = (
    nextReaction: LexiReactionType,
    nextBubble: string
  ) => {
    lastBubbleRef.current = nextBubble;
    setSpeechBubble(nextBubble);
    setReaction(nextReaction);
    setReactionNonce((n) => n + 1);

    if (bubbleTimerRef.current !== null) {
      window.clearTimeout(bubbleTimerRef.current);
    }
    bubbleTimerRef.current = window.setTimeout(() => {
      setSpeechBubble(null);
      bubbleTimerRef.current = null;
    }, SPEECH_BUBBLE_TIMEOUT_MS);

    if (reactionTimerRef.current !== null) {
      window.clearTimeout(reactionTimerRef.current);
    }
    reactionTimerRef.current = window.setTimeout(() => {
      setReaction(null);
      reactionTimerRef.current = null;
    }, REACTION_CLEAR_MS);
  };

  const handlePetLexi = () => {
    playLexiPetSfx();
    petLexi();
    const nextTap = tapCount + 1;
    setTapCount(nextTap);
    const nextBubble = pickLexiSpeechBubble({
      mood: status.mood,
      streak,
      words,
      lang,
      tapCount: nextTap,
      lastMessage: lastBubbleRef.current,
      reactionType: "pet",
    });
    showBubbleAndReaction("pet", nextBubble);
  };

  const handleGiveTreat = () => {
    if (lexiCompanion.treatsAvailable <= 0) return;
    const res = feedLexiTreat();
    if (!res.fed) return;
    playLexiTreatSfx();
    const nextTap = tapCount + 1;
    setTapCount(nextTap);
    const nextBubble = pickLexiSpeechBubble({
      mood: "happy",
      streak,
      words,
      lang,
      tapCount: nextTap,
      lastMessage: lastBubbleRef.current,
      reactionType: "treat",
      leveledUpTo: res.leveledUpTo,
    });
    showBubbleAndReaction("treat", nextBubble);
  };

  const handlePrimaryAction = () => {
    playGlassClick();
    if (words.length === 0) {
      openDailyPackModal();
      return;
    }

    if (status.mood === "restless") {
      if (dueWordsCount > 0) {
        setActiveTab("flashcards");
      } else {
        launchCommuteMode();
      }
      return;
    }

    launchPractice("smart_mix");
  };

  const actionLabel =
    status.mood === "restless"
      ? t.lexi.actionQuickReview
      : t.lexi.actionMakeHappy;

  return (
    <section
      aria-label={t.lexi.ariaCard}
      className={cn(
        "liquid-glass rounded-3xl p-4 sm:px-5 sm:py-4 border transition-colors",
        CARD_STYLE_BY_MOOD[status.mood]
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        {/* Left: Interactive Avatar + Mood Status + Progress */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <LexiAvatar
              mood={status.mood}
              size="md"
              interactive
              onInteract={handlePetLexi}
              label={t.lexi.petAriaLabel}
              reaction={reaction}
              reactionNonce={reactionNonce}
            />

            <AnimatePresence>
              {!lexiCompanion.hasPetted && !speechBubble && (
                <motion.span
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -2 }}
                  transition={IOS_SPRING}
                  className="inline-flex items-center rounded-full bg-[#0A84FF]/15 border border-[#0A84FF]/30 px-2 py-0.5 text-[9.5px] font-semibold text-[#70BCFF] whitespace-nowrap animate-pulse"
                >
                  {t.lexi.petHint}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Eyebrow, Mood Badge, Bond Level & Streak Pill */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                {t.lexi.eyebrow}
              </span>

              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  badgeStyle.pill
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("h-1.5 w-1.5 rounded-full", badgeStyle.dot)}
                />
                <span>{status.badgeLabel}</span>
              </span>

              {status.isHappyBoosted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FF9F0A]/16 border border-[#FF9F0A]/40 px-2 py-0.5 text-[10px] font-semibold text-[#FFD18C]">
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>{t.lexi.treatBoostBadge}</span>
                </span>
              )}

              <span
                title={bondTooltip}
                className="inline-flex items-center gap-1 rounded-full bg-[#FF375F]/14 border border-[#FF375F]/35 px-2 py-0.5 text-[10px] font-semibold text-[#FF8DA1]"
              >
                <Heart className="h-2.5 w-2.5 fill-current" />
                <span>
                  Lv.{lexiBondInfo.level} · {bondTierName}
                </span>
              </span>

              <button
                type="button"
                onClick={() => {
                  playGlassClick();
                  openStreakCalendar();
                }}
                title={t.lexi.streakTooltip}
                className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] border border-white/[0.09] px-2 py-0.5 text-[10px] font-semibold text-[#D1D1D6] hover:bg-white/[0.1] cursor-pointer tabular-nums"
              >
                <Flame
                  className={cn(
                    "h-3 w-3",
                    streak > 0 ? "text-[#30D158]" : "text-[#8E8E93]"
                  )}
                />
                <span>
                  {formatLexiTemplate(t.lexi.streakPill, { days: streak })}
                </span>
              </button>
            </div>

            {/* Interactive Contextual Speech Bubble */}
            <AnimatePresence mode="wait">
              {speechBubble && (
                <motion.div
                  key={speechBubble}
                  initial={{ opacity: 0, y: 4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -3, scale: 0.97 }}
                  transition={IOS_SPRING}
                  role="status"
                  aria-live="polite"
                  onClick={() => setSpeechBubble(null)}
                  className="inline-flex items-start gap-2 rounded-2xl rounded-tl-sm border border-[#0A84FF]/35 bg-[#0A84FF]/14 px-3 py-1.5 text-xs font-medium text-[#F5F5F7] cursor-pointer"
                >
                  <MessageCircleHeart className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#70BCFF]" />
                  <span className="leading-snug">{speechBubble}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 1-Line Mood Copy */}
            <p className="text-sm font-semibold text-white leading-snug">
              {status.statusCopy}
            </p>

            {/* Optional Subtle Word Note */}
            {contextualNote && (
              <p className="text-[11px] text-[#8E8E93] truncate">
                {contextualNote.prefix}{" "}
                <button
                  type="button"
                  onClick={() => {
                    playGlassClick();
                    setSelectedWord(contextualNote.word);
                  }}
                  className="font-semibold text-[#70BCFF] hover:underline cursor-pointer"
                >
                  &ldquo;{contextualNote.term}&rdquo;
                </button>
              </p>
            )}

            {/* Compact Daily Progress Bar */}
            <div className="flex items-center gap-2.5 pt-0.5">
              <div
                role="progressbar"
                aria-label={t.lexi.ariaProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={status.dailyProgressPct}
                className="h-1.5 flex-1 max-w-[220px] overflow-hidden rounded-full bg-white/[0.08]"
              >
                <motion.div
                  className={cn(
                    "h-full w-full rounded-full bg-gradient-to-r transform-gpu will-change-transform",
                    badgeStyle.bar
                  )}
                  style={{ transformOrigin: "left" }}
                  initial={false}
                  animate={{
                    scaleX:
                      status.dailyProgressPct === 0
                        ? 0.03
                        : Math.max(0.04, status.dailyProgressPct / 100),
                  }}
                  transition={IOS_SPRING}
                />
              </div>
              <span className="text-[11px] font-semibold text-[#8E8E93] tabular-nums shrink-0">
                {status.dailyProgressPct}% · {status.progressLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Give Treat + Direct Action / Secured State */}
        <div className="shrink-0 flex flex-wrap items-center gap-2 sm:justify-end">
          <motion.button
            type="button"
            whileTap={lexiCompanion.treatsAvailable > 0 ? TAP_SCALE : undefined}
            disabled={lexiCompanion.treatsAvailable <= 0}
            onClick={handleGiveTreat}
            title={
              lexiCompanion.treatsAvailable > 0
                ? t.lexi.giveTreatBtn
                : lang === "en"
                  ? "Complete Daily Pack, Practice, or close a Daily Ring to earn treats"
                  : "Selesaikan Target Harian, Practice, atau tutup Daily Ring untuk dapat camilan"
            }
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition-all",
              lexiCompanion.treatsAvailable > 0
                ? "bg-[#FF9F0A]/20 border-[#FF9F0A]/45 text-[#FFD18C] hover:bg-[#FF9F0A]/30 shadow-[0_4px_16px_rgba(255,159,10,0.2)] cursor-pointer"
                : "bg-white/[0.04] border-white/[0.1] text-[#8E8E93] opacity-60 cursor-not-allowed"
            )}
          >
            <Bone className="h-3.5 w-3.5" />
            <span>{t.lexi.giveTreatBtn}</span>
            <span
              className={cn(
                "inline-flex min-w-[1.15rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums",
                lexiCompanion.treatsAvailable > 0
                  ? "bg-[#FF9F0A]/30 text-white"
                  : "bg-white/[0.08] text-[#8E8E93]"
              )}
            >
              {lexiCompanion.treatsAvailable}
            </span>
          </motion.button>

          {status.mood === "happy" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#30D158]/16 border border-[#30D158]/40 px-4 py-2 text-xs font-bold text-[#7CF099]">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{t.lexi.vaultSecured}</span>
            </span>
          ) : (
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={handlePrimaryAction}
              className={cn(
                "flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white transition-all cursor-pointer",
                status.mood === "restless"
                  ? "bg-amber-600 hover:bg-amber-500 shadow-[0_6px_20px_rgba(217,119,6,0.28)]"
                  : "bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] shadow-[0_6px_20px_rgba(10,132,255,0.28)] hover:brightness-110"
              )}
            >
              {status.mood === "restless" ? (
                <Sparkles className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" />
              )}
              <span>{actionLabel}</span>
            </motion.button>
          )}
        </div>
      </div>
    </section>
  );
}
