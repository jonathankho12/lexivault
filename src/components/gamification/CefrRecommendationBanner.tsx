"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Compass,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { CEFR_LEVEL_META, getCefrMeta } from "@/lib/cefrProgression";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { playGlassClick } from "@/lib/soundEffects";
import { cn, formatCefrBadgeClass } from "@/lib/utils";
import type { CefrLevel } from "@/types/lexivault";

export function CefrRecommendationBanner({
  variant,
  onCloseModal,
}: {
  variant: "vault" | "stats" | "settings";
  onCloseModal?: () => void;
}) {
  const {
    isHydrated,
    userCefr,
    cefrPromotion,
    levelUpCefr,
    launchPlacementTest,
  } = useLexiVault();
  const { lang } = useLanguage();
  const isEn = lang === "en";
  const isRu = lang === "ru";
  const pick = (en: string, id: string, ru: string) =>
    isEn ? en : isRu ? ru : id;
  const [upgrading, setUpgrading] = useState(false);

  if (!isHydrated) return null;

  const {
    currentLevel,
    nextLevel,
    isMaxLevel,
    isReady,
    masteredAtOrAboveCount,
    requiredMasteredCount,
    accuracyPct,
    requiredAccuracyPct,
    totalReviews,
    requiredMinReviews,
    consistencyCount,
    requiredConsistencyCount,
    masteryMet,
    accuracyMet,
    consistencyMet,
    overallProgressPct,
  } = cefrPromotion;

  // Vault stays uncluttered until the user actually qualifies for a level-up
  if (variant === "vault" && (!isReady || !nextLevel)) {
    return null;
  }

  const handleLevelUp = async () => {
    if (!nextLevel || upgrading) return;
    setUpgrading(true);
    try {
      await levelUpCefr(nextLevel, { celebrate: true, forceAutoTier: true });
    } finally {
      setUpgrading(false);
    }
  };

  const handleVerifyPlacement = () => {
    playGlassClick();
    onCloseModal?.();
    launchPlacementTest();
  };

  const handleManualCefrPick = async (lvl: CefrLevel) => {
    if (lvl === currentLevel || upgrading) return;
    playGlassClick();
    setUpgrading(true);
    try {
      await levelUpCefr(lvl, {
        celebrate: false,
        silent: false,
        forceAutoTier: false,
      });
    } finally {
      setUpgrading(false);
    }
  };

  const nextMeta = nextLevel ? getCefrMeta(nextLevel) : null;
  const currentMeta = getCefrMeta(currentLevel);

  // Highlighted "Ready for Next CEFR Level" banner (Vault, Stats, or Settings)
  if (isReady && nextLevel && nextMeta) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={IOS_SPRING}
        className={cn(
          "rounded-3xl border border-[#30D158]/40 bg-gradient-to-r from-[#30D158]/[0.12] via-[#0A84FF]/[0.09] to-[#5E5CE6]/[0.12] space-y-4",
          variant === "settings" ? "p-4" : "liquid-glass p-5 sm:p-6"
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#30D158]/20 border border-[#30D158]/40 text-[#7CF099]">
              <TrendingUp className="h-5.5 w-5.5" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7CF099]">
                {pick(
                  "Ready for Next CEFR Level",
                  "Siap Naik ke Level CEFR Berikutnya",
                  "Готов переход на новый CEFR"
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold",
                    formatCefrBadgeClass(currentLevel)
                  )}
                >
                  {currentLevel}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-[#7CF099]" />
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold",
                    formatCefrBadgeClass(nextLevel)
                  )}
                >
                  {nextLevel} ·{" "}
                  {pick(nextMeta.titleEn, nextMeta.titleId, nextMeta.titleRu)}
                </span>
              </div>
              <p className="text-xs text-[#D1D1D6]">
                {pick(
                  `You've met all readiness milestones to advance from ${currentLevel} to ${nextLevel}.`,
                  `Semua target kesiapan untuk naik dari ${currentLevel} ke ${nextLevel} sudah terpenuhi.`,
                  `Все цели для перехода с ${currentLevel} на ${nextLevel} выполнены.`
                )}
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 rounded-full bg-[#30D158]/20 border border-[#30D158]/40 px-2.5 py-1 text-[11px] font-bold text-[#7CF099] shrink-0">
            <Sparkles className="h-3 w-3" />
            <span>100%</span>
          </span>
        </div>

        {/* Criteria Met Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="flex items-center gap-2 rounded-2xl bg-white/[0.05] border border-[#30D158]/30 px-3 py-2 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#30D158]" />
            <span className="text-[#E5E5EA] truncate tabular-nums">
              {pick(
                `${masteredAtOrAboveCount}/${requiredMasteredCount} ${currentLevel}+ mastered`,
                `${masteredAtOrAboveCount}/${requiredMasteredCount} kata ${currentLevel}+ dikuasai`,
                `${masteredAtOrAboveCount}/${requiredMasteredCount} (${currentLevel}+) освоено`
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-white/[0.05] border border-[#30D158]/30 px-3 py-2 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#30D158]" />
            <span className="text-[#E5E5EA] truncate tabular-nums">
              {pick(
                `${accuracyPct}% recall accuracy (≥${requiredAccuracyPct}%)`,
                `Akurasi recall ${accuracyPct}% (≥${requiredAccuracyPct}%)`,
                `Точность ${accuracyPct}% (≥${requiredAccuracyPct}%)`
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-white/[0.05] border border-[#30D158]/30 px-3 py-2 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#30D158]" />
            <span className="text-[#E5E5EA] truncate tabular-nums">
              {pick(
                `${consistencyCount}/${requiredConsistencyCount} streak/sessions`,
                `${consistencyCount}/${requiredConsistencyCount} streak/sesi`,
                `${consistencyCount}/${requiredConsistencyCount} серия/сессии`
              )}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            disabled={upgrading}
            onClick={() => void handleLevelUp()}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#30D158] to-[#0A84FF] px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-[0_6px_20px_rgba(48,209,88,0.28)] hover:brightness-110 cursor-pointer disabled:opacity-60"
          >
            {upgrading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>
              {pick(
                `Level Up to ${nextLevel}`,
                `Naik ke Level ${nextLevel}`,
                `Повысить до ${nextLevel}`
              )}
            </span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            onClick={handleVerifyPlacement}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] border border-white/[0.14] px-4 py-2 text-xs font-semibold text-[#F5F5F7] hover:bg-white/[0.12] cursor-pointer"
          >
            <Compass className="h-3.5 w-3.5 text-[#70BCFF]" />
            <span>
              {pick(
                "Verify with Placement Test",
                "Verifikasi lewat Placement Test",
                "Проверить тестом уровня"
              )}
            </span>
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // Settings / Stats Readiness Tracker (Not Yet Ready or C2 Max)
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.09] bg-white/[0.04] space-y-3.5",
        variant === "settings" ? "p-3.5" : "liquid-glass rounded-3xl p-5 sm:p-6"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0A84FF]/18 border border-[#0A84FF]/35 text-[#70BCFF]">
            <Award className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#70BCFF]">
              {isMaxLevel
                ? pick(
                    "Top CEFR Tier Reached",
                    "Level CEFR Tertinggi Tercapai",
                    "Достигнут максимальный уровень"
                  )
                : pick(
                    "Next CEFR Level Readiness",
                    "Kesiapan Level CEFR Berikutnya",
                    "Готовность к следующему CEFR"
                  )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold",
                  formatCefrBadgeClass(currentLevel)
                )}
              >
                {currentLevel} ·{" "}
                {pick(
                  currentMeta.titleEn,
                  currentMeta.titleId,
                  currentMeta.titleRu
                )}
              </span>
              {nextLevel && (
                <>
                  <ArrowRight className="h-3.5 w-3.5 text-[#8E8E93]" />
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold opacity-85",
                      formatCefrBadgeClass(nextLevel)
                    )}
                  >
                    {nextLevel}
                  </span>
                </>
              )}
              {!userCefr && variant === "settings" && (
                <span className="text-[10px] text-[#8E8E93]">
                  (
                  {pick(
                    "Estimated baseline",
                    "Estimasi awal",
                    "Базовая оценка"
                  )}
                  )
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isMaxLevel && (
            <span className="rounded-full bg-[#0A84FF]/15 border border-[#0A84FF]/35 px-2.5 py-1 text-[11px] font-bold text-[#70BCFF] tabular-nums">
              {overallProgressPct}%
            </span>
          )}
          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            onClick={handleVerifyPlacement}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] border border-white/[0.12] px-3 py-1.5 text-[11px] font-semibold text-[#F5F5F7] hover:bg-white/[0.12] cursor-pointer"
          >
            <Compass className="h-3 w-3 text-[#70BCFF]" />
            <span>
              {pick(
                "Verify with Placement Test",
                "Verifikasi lewat Placement Test",
                "Пройти тест уровня"
              )}
            </span>
          </motion.button>
        </div>
      </div>

      {!isMaxLevel && nextLevel && (
        <>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <motion.div
              className="h-full w-full rounded-full bg-gradient-to-r from-[#0A84FF] via-[#5E5CE6] to-[#30D158] transform-gpu will-change-transform"
              style={{ transformOrigin: "left" }}
              initial={false}
              animate={{
                scaleX: Math.max(0.04, overallProgressPct / 100),
              }}
              transition={IOS_SPRING}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <div
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
                masteryMet
                  ? "bg-[#30D158]/12 border-[#30D158]/35 text-[#7CF099]"
                  : "bg-white/[0.03] border-white/[0.08] text-[#D1D1D6]"
              )}
            >
              <span>
                {pick(
                  `${currentLevel}+ Mastered`,
                  `Dikuasai ${currentLevel}+`,
                  `Освоено ${currentLevel}+`
                )}
              </span>
              <span className="font-bold tabular-nums">
                {masteredAtOrAboveCount}/{requiredMasteredCount}
              </span>
            </div>

            <div
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
                accuracyMet
                  ? "bg-[#30D158]/12 border-[#30D158]/35 text-[#7CF099]"
                  : "bg-white/[0.03] border-white/[0.08] text-[#D1D1D6]"
              )}
            >
              <span>
                {pick(
                  `Accuracy (≥${requiredAccuracyPct}%)`,
                  `Akurasi (≥${requiredAccuracyPct}%)`,
                  `Точность (≥${requiredAccuracyPct}%)`
                )}
              </span>
              <span className="font-bold tabular-nums">
                {totalReviews > 0 ? `${accuracyPct}%` : "—"} (
                {Math.min(totalReviews, requiredMinReviews)}/
                {requiredMinReviews})
              </span>
            </div>

            <div
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
                consistencyMet
                  ? "bg-[#30D158]/12 border-[#30D158]/35 text-[#7CF099]"
                  : "bg-white/[0.03] border-white/[0.08] text-[#D1D1D6]"
              )}
            >
              <span>
                {pick("Streak / Sessions", "Streak / Sesi", "Серия / Сессии")}
              </span>
              <span className="font-bold tabular-nums">
                {consistencyCount}/{requiredConsistencyCount}
              </span>
            </div>
          </div>
        </>
      )}

      {variant === "settings" && (
        <div className="pt-2 border-t border-white/[0.07] space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#8E8E93]">
              {pick(
                "Personal CEFR Profile",
                "Profil CEFR Pribadi",
                "Личный профиль CEFR"
              )}
            </span>
            <span className="text-[#70BCFF] font-semibold">
              {currentLevel} · {currentMeta.dailyPackPreviewLabel}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {CEFR_LEVEL_META.map((item) => {
              const active = currentLevel === item.level;
              return (
                <button
                  key={item.level}
                  type="button"
                  disabled={upgrading}
                  onClick={() => void handleManualCefrPick(item.level)}
                  className={cn(
                    "rounded-xl border py-1.5 text-xs font-bold transition-colors cursor-pointer",
                    active
                      ? "bg-[#0A84FF]/22 border-[#0A84FF]/60 text-white"
                      : "bg-white/[0.04] border-white/[0.08] text-[#8E8E93] hover:text-white hover:bg-white/[0.08]"
                  )}
                >
                  {item.level}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
