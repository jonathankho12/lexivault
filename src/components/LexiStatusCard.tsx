"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bone,
  CheckCircle2,
  Eye,
  Flame,
  Heart,
  MessageCircleHeart,
  Play,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { LexiAvatar, type LexiReactionType } from "@/components/LexiAvatar";
import { AudioButton } from "@/components/ui/AudioButton";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import {
  buildQuickCheckQuiz,
  computeLexiStatus,
  formatLexiTemplate,
  pickFetchQuickCheckWord,
  pickLexiSpeechBubble,
  type LexiMood,
} from "@/lib/lexi";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import {
  playCorrectChime,
  playGlassClick,
  playLexiPetSfx,
  playLexiTreatSfx,
  playWrongThud,
} from "@/lib/soundEffects";
import {
  cn,
  formatCefrBadgeClass,
  getLocalizedMeaning,
} from "@/lib/utils";
import type { WordEntry } from "@/types/lexivault";

const SPEECH_BUBBLE_TIMEOUT_MS = 4500;
const REACTION_CLEAR_MS = 950;
const RAPID_TAP_WINDOW_MS = 1400;

function triggerHaptic(pattern: number | number[]) {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function"
  ) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore restricted vibration calls
    }
  }
}

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
    recordAnswer,
    accent,
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

  const [localHour, setLocalHour] = useState(() => new Date().getHours());
  const [tapCount, setTapCount] = useState(0);
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);
  const [reaction, setReaction] = useState<LexiReactionType | null>(null);
  const [reactionNonce, setReactionNonce] = useState(0);
  const [streakFlameBurst, setStreakFlameBurst] = useState(false);

  const [quickCheckWord, setQuickCheckWord] = useState<WordEntry | null>(null);
  const [quickCheckQuiz, setQuickCheckQuiz] = useState<{
    choices: string[];
    correctChoice: string;
  } | null>(null);
  const [quickCheckPicked, setQuickCheckPicked] = useState<string | null>(null);
  const [quickCheckRevealed, setQuickCheckRevealed] = useState(false);

  const lastBubbleRef = useRef<string | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
  const reactionTimerRef = useRef<number | null>(null);
  const streakFlameTimerRef = useRef<number | null>(null);
  const quickCheckTimerRef = useRef<number | null>(null);
  const tapTimestampsRef = useRef<number[]>([]);

  useEffect(() => {
    const refreshHour = () => {
      setLocalHour(new Date().getHours());
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshHour();
      }
    };
    window.addEventListener("focus", refreshHour);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", refreshHour);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (bubbleTimerRef.current !== null) {
        window.clearTimeout(bubbleTimerRef.current);
      }
      if (reactionTimerRef.current !== null) {
        window.clearTimeout(reactionTimerRef.current);
      }
      if (streakFlameTimerRef.current !== null) {
        window.clearTimeout(streakFlameTimerRef.current);
      }
      if (quickCheckTimerRef.current !== null) {
        window.clearTimeout(quickCheckTimerRef.current);
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
        localHour,
      }),
    [
      dailyPack,
      dailyQuota,
      dailyRings,
      isLexiHappyBoosted,
      lang,
      localHour,
      streak,
      studyLogs,
      todayStr,
      words,
    ]
  );

  if (!isHydrated || !lexiEnabled) {
    return null;
  }

  const badgeStyle = status.isStreakGuard
    ? BADGE_STYLE_BY_MOOD.restless
    : BADGE_STYLE_BY_MOOD[status.mood];
  const cardSurfaceClass = status.isStreakGuard
    ? CARD_STYLE_BY_MOOD.restless
    : CARD_STYLE_BY_MOOD[status.mood];
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
    const now = Date.now();
    const recent = tapTimestampsRef.current.filter(
      (ts) => now - ts <= RAPID_TAP_WINDOW_MS
    );
    recent.push(now);

    const isRapidTriple = recent.length >= 3;
    tapTimestampsRef.current = isRapidTriple ? [] : recent;

    petLexi();
    const nextTap = tapCount + 1;
    setTapCount(nextTap);

    if (isRapidTriple) {
      triggerHaptic([15, 25, 20]);
      playLexiTreatSfx();
      const nextBubble = pickLexiSpeechBubble({
        mood: "happy",
        streak,
        words,
        lang,
        tapCount: nextTap,
        lastMessage: lastBubbleRef.current,
        reactionType: "rapid_tap",
        isStreakGuard: status.isStreakGuard,
      });
      showBubbleAndReaction("super", nextBubble);
      return;
    }

    triggerHaptic(15);
    playLexiPetSfx();
    const nextBubble = pickLexiSpeechBubble({
      mood: status.mood,
      streak,
      words,
      lang,
      tapCount: nextTap,
      lastMessage: lastBubbleRef.current,
      reactionType: "pet",
      isStreakGuard: status.isStreakGuard,
    });
    showBubbleAndReaction("pet", nextBubble);
  };

  const handleHoldPet = () => {
    triggerHaptic(15);
    playLexiPetSfx();
    petLexi();
    const nextTap = tapCount + 1;
    setTapCount(nextTap);
    const nextBubble = pickLexiSpeechBubble({
      mood: "happy",
      streak,
      words,
      lang,
      tapCount: nextTap,
      lastMessage: lastBubbleRef.current,
      reactionType: "hold_pet",
    });
    showBubbleAndReaction("pet", nextBubble);
  };

  const handleGiveTreat = () => {
    if (lexiCompanion.treatsAvailable <= 0) return;
    const res = feedLexiTreat();
    if (!res.fed) return;
    triggerHaptic([15, 30, 15]);
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

  const closeQuickCheck = () => {
    if (quickCheckTimerRef.current !== null) {
      window.clearTimeout(quickCheckTimerRef.current);
      quickCheckTimerRef.current = null;
    }
    setQuickCheckWord(null);
    setQuickCheckQuiz(null);
    setQuickCheckPicked(null);
    setQuickCheckRevealed(false);
  };

  const openQuickCheck = (targetWord: WordEntry) => {
    if (quickCheckTimerRef.current !== null) {
      window.clearTimeout(quickCheckTimerRef.current);
      quickCheckTimerRef.current = null;
    }
    playGlassClick();
    triggerHaptic(10);
    setQuickCheckWord(targetWord);
    setQuickCheckQuiz(buildQuickCheckQuiz(targetWord, words, lang));
    setQuickCheckPicked(null);
    setQuickCheckRevealed(false);
  };

  const handleFetchWord = () => {
    if (words.length === 0) {
      playGlassClick();
      openDailyPackModal();
      return;
    }
    const fetched = pickFetchQuickCheckWord(
      words,
      todayStr,
      quickCheckWord?.id
    );
    if (fetched) {
      openQuickCheck(fetched);
    }
  };

  const handleQuickCheckChoice = (choice: string) => {
    if (!quickCheckWord || !quickCheckQuiz || quickCheckPicked !== null) return;
    setQuickCheckPicked(choice);
    const isCorrect = choice === quickCheckQuiz.correctChoice;

    if (isCorrect) {
      triggerHaptic(15);
      playCorrectChime(2);
      showBubbleAndReaction("pet", t.lexi.quickCheck.correctMsg);
      void recordAnswer(quickCheckWord.id, true).catch(() => {});
    } else {
      playWrongThud();
      void recordAnswer(quickCheckWord.id, false).catch(() => {});
    }

    if (quickCheckTimerRef.current !== null) {
      window.clearTimeout(quickCheckTimerRef.current);
    }
    quickCheckTimerRef.current = window.setTimeout(() => {
      closeQuickCheck();
    }, isCorrect ? 1200 : 1850);
  };

  const handleQuickCheckReveal = () => {
    if (!quickCheckWord || quickCheckRevealed) return;
    setQuickCheckRevealed(true);
    triggerHaptic(15);
    playCorrectChime(1);
    showBubbleAndReaction("pet", t.lexi.quickCheck.correctMsg);
    void recordAnswer(quickCheckWord.id, true).catch(() => {});

    if (quickCheckTimerRef.current !== null) {
      window.clearTimeout(quickCheckTimerRef.current);
    }
    quickCheckTimerRef.current = window.setTimeout(() => {
      closeQuickCheck();
    }, 1500);
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
        cardSurfaceClass
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
              onHoldPet={handleHoldPet}
              label={t.lexi.petAriaLabel}
              reaction={reaction}
              reactionNonce={reactionNonce}
              bondLevel={lexiBondInfo.level}
              streakGuard={status.isStreakGuard}
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
            {/* Eyebrow, Mood/Streak-Guard Badge, Bond Level & Interactive Streak Flame Pill */}
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
                {status.isStreakGuard ? (
                  <ShieldAlert className="h-2.5 w-2.5 shrink-0" />
                ) : (
                  <span
                    aria-hidden="true"
                    className={cn("h-1.5 w-1.5 rounded-full", badgeStyle.dot)}
                  />
                )}
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
                  setStreakFlameBurst(true);
                  if (streakFlameTimerRef.current !== null) {
                    window.clearTimeout(streakFlameTimerRef.current);
                  }
                  streakFlameTimerRef.current = window.setTimeout(() => {
                    setStreakFlameBurst(false);
                    streakFlameTimerRef.current = null;
                  }, 700);
                  openStreakCalendar();
                }}
                title={t.lexi.streakTooltip}
                className={cn(
                  "lexi-flame-trigger relative overflow-visible inline-flex items-center gap-1 rounded-full bg-white/[0.05] border border-white/[0.09] px-2 py-0.5 text-[10px] font-semibold text-[#D1D1D6] hover:bg-white/[0.1] active:scale-95 transition-[transform,background-color] cursor-pointer tabular-nums",
                  streakFlameBurst && "is-flaming"
                )}
              >
                <span className="relative inline-flex items-center justify-center">
                  <Flame
                    className={cn(
                      "h-3 w-3 lexi-flame-icon",
                      streak > 0 ? "text-[#FF9F0A]" : "text-[#8E8E93]"
                    )}
                  />
                  <span
                    aria-hidden="true"
                    className="lexi-flame-spark lexi-flame-spark-1 absolute top-0 left-0 h-1 w-1 rounded-full bg-[#FFD18C]"
                  />
                  <span
                    aria-hidden="true"
                    className="lexi-flame-spark lexi-flame-spark-2 absolute top-0 right-0 h-1 w-1 rounded-full bg-[#FF9F0A]"
                  />
                  <span
                    aria-hidden="true"
                    className="lexi-flame-spark lexi-flame-spark-3 absolute -top-0.5 left-1 h-1 w-1 rounded-full bg-[#FFE4B5]"
                  />
                </span>
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

            {/* Tappable Nudge Word + Compact "Fetch!" Micro-Button */}
            {(contextualNote || words.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#8E8E93]">
                {contextualNote && (
                  <p className="min-w-0 truncate">
                    {contextualNote.prefix}{" "}
                    <button
                      type="button"
                      onClick={() => openQuickCheck(contextualNote.word)}
                      className="font-semibold text-[#70BCFF] hover:underline cursor-pointer"
                    >
                      &ldquo;{contextualNote.term}&rdquo;
                    </button>
                  </p>
                )}

                {words.length > 0 && (
                  <button
                    type="button"
                    onClick={handleFetchWord}
                    title={t.lexi.quickCheck.fetchTooltip}
                    className="inline-flex items-center gap-1 rounded-full bg-[#0A84FF]/14 border border-[#0A84FF]/35 px-2 py-0.5 text-[10px] font-bold text-[#70BCFF] hover:bg-[#0A84FF]/24 active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    <Sparkles className="h-2.5 w-2.5" />
                    <span>{t.lexi.quickCheck.fetchBtn}</span>
                  </button>
                )}
              </div>
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
                  : lang === "ru"
                    ? "Пройди Пак дня, Практику или закрой кольцо дня, чтобы заработать вкусняшку"
                    : "Selesaikan Target Harian, Practice, atau tutup Daily Ring untuk dapat snack"
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
                status.mood === "restless" || status.isStreakGuard
                  ? "bg-amber-600 hover:bg-amber-500 shadow-[0_6px_20px_rgba(217,119,6,0.28)]"
                  : "bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] shadow-[0_6px_20px_rgba(10,132,255,0.28)] hover:brightness-110"
              )}
            >
              {status.mood === "restless" || status.isStreakGuard ? (
                <Sparkles className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" />
              )}
              <span>{actionLabel}</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Inline 5-Second Nudge Mini-Quiz / Fetch Quick Check (Zero AI Calls) */}
      <AnimatePresence>
        {quickCheckWord && (
          <motion.div
            key={`quick-check-${quickCheckWord.id}`}
            initial={{ opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.985 }}
            transition={IOS_SPRING}
            className="mt-3.5 rounded-2xl border border-[#0A84FF]/30 bg-white/[0.04] p-3.5 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#70BCFF]">
                  {t.lexi.quickCheck.title}
                </span>
                {quickCheckWord.cefr && (
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[9.5px] font-bold",
                      formatCefrBadgeClass(quickCheckWord.cefr)
                    )}
                  >
                    {quickCheckWord.cefr}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    playGlassClick();
                    setSelectedWord(quickCheckWord);
                  }}
                  title={t.lexi.quickCheck.viewCardTooltip}
                  className="rounded-full p-1 text-[#8E8E93] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playGlassClick();
                    closeQuickCheck();
                  }}
                  aria-label={t.lexi.quickCheck.closeAria}
                  className="rounded-full p-1 text-[#8E8E93] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-base font-bold text-white truncate">
                  {quickCheckWord.term}
                </p>
                <p className="text-[11px] text-[#8E8E93]">
                  {quickCheckQuiz
                    ? t.lexi.quickCheck.meaningPrompt
                    : t.lexi.quickCheck.tapToReveal}
                </p>
              </div>
              <AudioButton
                text={quickCheckWord.term}
                remoteUrl={
                  accent === "UK"
                    ? quickCheckWord.audio_uk_url
                    : quickCheckWord.audio_us_url
                }
                wordId={quickCheckWord.id}
                size="sm"
              />
            </div>

            {quickCheckQuiz ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {quickCheckQuiz.choices.map((choice) => {
                  const picked = quickCheckPicked === choice;
                  const isCorrect = choice === quickCheckQuiz.correctChoice;
                  const revealed = quickCheckPicked !== null;
                  return (
                    <button
                      key={choice}
                      type="button"
                      disabled={revealed}
                      onClick={() => handleQuickCheckChoice(choice)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-all",
                        !revealed &&
                          "bg-white/[0.04] border-white/[0.1] text-[#F5F5F7] hover:bg-white/[0.1] hover:border-[#0A84FF]/40 active:scale-[0.98] cursor-pointer",
                        revealed &&
                          isCorrect &&
                          "bg-[#30D158]/18 border-[#30D158]/50 text-[#A6F8BA]",
                        revealed &&
                          picked &&
                          !isCorrect &&
                          "bg-red-500/15 border-red-500/45 text-red-300",
                        revealed &&
                          !picked &&
                          !isCorrect &&
                          "bg-white/[0.02] border-white/[0.06] text-[#8E8E93] opacity-55"
                      )}
                    >
                      <span className="line-clamp-2 leading-snug">{choice}</span>
                      {revealed && isCorrect && (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#30D158]" />
                      )}
                      {revealed && picked && !isCorrect && (
                        <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : quickCheckRevealed ? (
              <div className="rounded-xl border border-[#30D158]/40 bg-[#30D158]/14 px-3 py-2 text-xs font-medium text-[#A6F8BA]">
                {getLocalizedMeaning(quickCheckWord, lang)}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleQuickCheckReveal}
                className="w-full rounded-xl border border-white/[0.12] bg-white/[0.05] px-3 py-2 text-xs font-semibold text-[#70BCFF] hover:bg-white/[0.09] active:scale-[0.99] transition-all cursor-pointer"
              >
                {t.lexi.quickCheck.tapToReveal}
              </button>
            )}

            {quickCheckPicked !== null && quickCheckQuiz && (
              <p
                className={cn(
                  "text-[11px] font-semibold",
                  quickCheckPicked === quickCheckQuiz.correctChoice
                    ? "text-[#7CF099]"
                    : "text-red-300"
                )}
              >
                {quickCheckPicked === quickCheckQuiz.correctChoice
                  ? t.lexi.quickCheck.correctMsg
                  : `${t.lexi.quickCheck.wrongMsg} ${quickCheckQuiz.correctChoice}`}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
