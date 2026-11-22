"use client";

import { motion } from "framer-motion";
import { Award, BookPlus, CheckCircle2, Flame } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { IOS_EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { DailyRingsProgress } from "@/types/lexivault";

interface RingSpec {
  label: string;
  current: number;
  target: number;
  color: string;
  trackColor: string;
  radius: number;
}

export function ActivityRings({
  rings,
  variant = "full",
  className,
}: {
  rings: DailyRingsProgress;
  variant?: "mini" | "full";
  className?: string;
}) {
  const { t } = useLanguage();
  const specs: RingSpec[] = [
    {
      label: t.rings.vocab,
      current: rings.vocab,
      target: rings.vocabTarget,
      color: "#0A84FF",
      trackColor: "rgba(10, 132, 255, 0.2)",
      radius: variant === "mini" ? 13 : 48,
    },
    {
      label: t.rings.recall,
      current: rings.recall,
      target: rings.recallTarget,
      color: "#30D158",
      trackColor: "rgba(48, 209, 88, 0.2)",
      radius: variant === "mini" ? 9.5 : 36,
    },
    {
      label: t.rings.ielts,
      current: rings.ielts,
      target: rings.ieltsTarget,
      color: "#BF5AF2",
      trackColor: "rgba(191, 90, 242, 0.2)",
      radius: variant === "mini" ? 6 : 24,
    },
  ];

  const allClosed = specs.every((s) => s.current >= s.target);
  const svgSize = variant === "mini" ? 34 : 120;
  const center = svgSize / 2;
  const strokeWidth = variant === "mini" ? 2.6 : 9;

  const renderSvg = (
    <div
      className={cn(
        "relative inline-flex items-center justify-center shrink-0 transform-gpu",
        className
      )}
      style={{ width: svgSize, height: svgSize }}
    >
      {allClosed && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full bg-[#30D158]/20 animate-pulse"
        />
      )}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        className="-rotate-90 transform-gpu"
      >
        {specs.map((ring) => {
          const circumference = 2 * Math.PI * ring.radius;
          const pct = Math.min(1, Math.max(0, ring.current / ring.target));
          const dashOffset = circumference * (1 - pct);
          return (
            <g key={ring.label}>
              <circle
                cx={center}
                cy={center}
                r={ring.radius}
                fill="none"
                stroke={ring.trackColor}
                strokeWidth={strokeWidth}
              />
              <motion.circle
                cx={center}
                cy={center}
                r={ring.radius}
                fill="none"
                stroke={ring.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={false}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ duration: 0.55, ease: IOS_EASE }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );

  if (variant === "mini") {
    return renderSvg;
  }

  return (
    <div className="liquid-glass rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-5 sm:gap-7">
      {renderSvg}

      <div className="flex-1 w-full space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0A84FF]">
              {t.rings.eyebrow}
            </p>
            <h3 className="text-lg font-bold text-white">
              {allClosed ? t.rings.titleAllClosed : t.rings.titleOpen}
            </h3>
          </div>
          {allClosed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#30D158]/20 border border-[#30D158]/40 px-3 py-1 text-xs font-semibold text-[#7CF099]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{t.rings.allClosedBadge}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookPlus className="h-4 w-4 text-[#0A84FF]" />
              <span className="text-xs font-medium text-[#D1D1D6]">
                {t.rings.vocab}
              </span>
            </div>
            <span className="text-sm font-bold text-[#70BCFF] tabular-nums">
              {rings.vocab}/{rings.vocabTarget}
            </span>
          </div>

          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-[#30D158]" />
              <span className="text-xs font-medium text-[#D1D1D6]">
                {t.rings.recall}
              </span>
            </div>
            <span className="text-sm font-bold text-[#7CF099] tabular-nums">
              {rings.recall}/{rings.recallTarget}
            </span>
          </div>

          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-[#BF5AF2]" />
              <span className="text-xs font-medium text-[#D1D1D6]">
                {t.rings.ielts}
              </span>
            </div>
            <span className="text-sm font-bold text-[#E0AAFF] tabular-nums">
              {rings.ielts}/{rings.ieltsTarget}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
