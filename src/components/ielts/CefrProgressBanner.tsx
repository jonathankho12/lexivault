"use client";

import { motion } from "framer-motion";
import { Award, RotateCcw, Sparkles } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import {
  bandToCefrPercent,
  CEFR_ORDER,
  CEFR_RANGES,
} from "@/lib/ieltsUtils";
import { cn } from "@/lib/utils";
import type { IeltsProfile } from "@/types/ielts";

export function CefrProgressBanner({
  profile,
  onRetakePlacement,
}: {
  profile: IeltsProfile;
  onRetakePlacement: () => void;
}) {
  const { lang, t } = useLanguage();
  const isEn = lang === "en";
  const hasScore = profile.placement_completed || profile.estimated_band > 0;
  const pct = hasScore ? bandToCefrPercent(profile.estimated_band) : 0;

  return (
    <div className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-5">
      {/* Top Headline & Retake Action */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.35)]">
            <Award className="h-5.5 w-5.5 text-white" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0A84FF]">
              {t.ielts.bannerEyebrow}
            </p>
            <h2 className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight text-white">
              {hasScore
                ? lang === "ru"
                  ? `Твой уровень: ${profile.cefr_level} • Est. Band ${profile.estimated_band.toFixed(1)}`
                  : lang === "id"
                    ? `Level kamu ${profile.cefr_level} • Est. Band ${profile.estimated_band.toFixed(1)}`
                    : `You're now at ${profile.cefr_level} level • Est. Band ${profile.estimated_band.toFixed(1)}`
                : t.ielts.bannerTitleFallback}
            </h2>
          </div>
        </div>

        <motion.button
          type="button"
          whileTap={TAP_SCALE}
          onClick={onRetakePlacement}
          className="liquid-glass-pill inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-[#F5F5F7] hover:bg-white/[0.12] cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5 text-[#0A84FF]" />
          <span>
            {profile.placement_completed
              ? t.ielts.retakePlacement
              : t.ielts.startPlacement}
          </span>
        </motion.button>
      </div>

      {/* Stepped A1 -> C2 Progress Bar (GPU scaleX) */}
      <div className="space-y-2.5">
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <motion.div
            initial={false}
            animate={{ scaleX: Math.max(0, Math.min(1, pct / 100)) }}
            style={{ transformOrigin: "left" }}
            transition={IOS_SPRING}
            className="transform-gpu will-change-transform h-full w-full rounded-full bg-gradient-to-r from-[#0A84FF] via-[#5E5CE6] to-[#30D158]"
          />
        </div>

        <div className="grid grid-cols-6 gap-1.5">
          {CEFR_ORDER.map((lvl) => {
            const active = hasScore && profile.cefr_level === lvl;
            const passed =
              hasScore &&
              CEFR_ORDER.indexOf(lvl) < CEFR_ORDER.indexOf(profile.cefr_level);

            return (
              <div
                key={lvl}
                className={cn(
                  "rounded-2xl border px-2 py-1.5 text-center transition-colors",
                  active
                    ? "bg-[#0A84FF]/22 border-[#0A84FF]/55 text-white"
                    : passed
                      ? "bg-[#30D158]/12 border-[#30D158]/30 text-[#7CF099]"
                      : "bg-white/[0.03] border-white/[0.07] text-[#8E8E93]"
                )}
              >
                <p className="text-xs font-bold">{lvl}</p>
                <p className="hidden sm:block text-[10px] opacity-80">
                  {CEFR_RANGES[lvl]}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-Skill Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-1">
        {(
          [
            { label: "Reading", score: profile.reading_band, color: "text-[#70BCFF]" },
            { label: "Listening", score: profile.listening_band, color: "text-[#A7A5FF]" },
            { label: "Writing", score: profile.writing_band, color: "text-[#7CF099]" },
            { label: "Speaking", score: profile.speaking_band, color: "text-[#E0AAFF]" },
          ] as const
        ).map((skill) => (
          <div
            key={skill.label}
            className="rounded-2xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 flex items-center justify-between gap-2"
          >
            <span className="text-xs font-medium text-[#8E8E93]">
              {skill.label}
            </span>
            <span className={cn("text-sm sm:text-base font-bold", skill.color)}>
              {skill.score !== null ? skill.score.toFixed(1) : "—"}
            </span>
          </div>
        ))}
      </div>

      {!hasScore && (
        <div className="flex items-center gap-2 text-xs text-[#8E8E93]">
          <Sparkles className="h-3.5 w-3.5 text-[#0A84FF] shrink-0" />
          <span>
            {isEn
              ? "Complete the Quick Placement Test (3–5 minutes) or any IELTS module to calculate your starting Band and CEFR level."
              : lang === "ru"
                ? "Пройди быстрый тест уровня (3–5 минут) или любой модуль IELTS, чтобы определить свой стартовый Band и CEFR."
                : "Selesaikan Quick Placement Test (3–5 menit) atau salah satu modul IELTS untuk menghitung Band & level CEFR awalmu."}
          </span>
        </div>
      )}
    </div>
  );
}
