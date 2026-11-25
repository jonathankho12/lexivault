"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Flame, Play, ShieldCheck, Sparkles } from "lucide-react";
import { LexiAvatar } from "@/components/LexiAvatar";
import { useLexiVault } from "@/context/LexiVaultContext";
import { computeLexiStatus, type LexiMood } from "@/lib/lexi";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { playGlassClick } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";

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
      }),
    [dailyPack, dailyQuota, dailyRings, streak, studyLogs, todayStr, words]
  );

  if (!isHydrated || !lexiEnabled) {
    return null;
  }

  const badgeStyle = BADGE_STYLE_BY_MOOD[status.mood];
  const contextualNote = status.contextualNote;

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
    status.mood === "restless" ? "Quick 3-Min Review" : "Make Lexi Happy";

  return (
    <section
      aria-label="Lexi Daily Vault Maintenance"
      className={cn(
        "liquid-glass rounded-3xl p-4 sm:px-5 sm:py-4 border transition-colors",
        CARD_STYLE_BY_MOOD[status.mood]
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        {/* Left: Avatar + Mood Status + Progress */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          <LexiAvatar mood={status.mood} size="md" />

          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Eyebrow, Mood Badge & Streak Pill */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                Daily Vault Maintenance
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

              <button
                type="button"
                onClick={() => {
                  playGlassClick();
                  openStreakCalendar();
                }}
                title="View streak calendar"
                className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] border border-white/[0.09] px-2 py-0.5 text-[10px] font-semibold text-[#D1D1D6] hover:bg-white/[0.1] cursor-pointer tabular-nums"
              >
                <Flame
                  className={cn(
                    "h-3 w-3",
                    streak > 0 ? "text-[#30D158]" : "text-[#8E8E93]"
                  )}
                />
                <span>{streak}d streak</span>
              </button>
            </div>

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
                aria-label="Daily vault maintenance progress"
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

        {/* Right: Direct Action / Secured State */}
        <div className="shrink-0 flex items-center sm:justify-end">
          {status.mood === "happy" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#30D158]/16 border border-[#30D158]/40 px-4 py-2 text-xs font-bold text-[#7CF099]">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Vault Secured ✓</span>
            </span>
          ) : (
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={handlePrimaryAction}
              className={cn(
                "w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white transition-all cursor-pointer",
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
