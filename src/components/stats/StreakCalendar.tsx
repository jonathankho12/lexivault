"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { StudyLog } from "@/types/lexivault";

const WEEKDAYS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildMonthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function StreakCalendar() {
  const { studyLogs, streak, todayStr, isHydrated } = useLexiVault();
  const { lang } = useLanguage();
  const isEn = lang === "en";
  const locale = isEn ? "en-US" : "id-ID";
  const weekdays = isEn ? WEEKDAYS_EN : WEEKDAYS_ID;

  const [todayYear, todayMonth] = useMemo(() => {
    const parts = todayStr.split("-").map(Number);
    return [parts[0] || 2026, (parts[1] || 1) - 1];
  }, [todayStr]);

  const [viewCursor, setViewCursor] = useState<{
    year: number;
    month: number;
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const activeYear = viewCursor?.year ?? todayYear;
  const activeMonth = viewCursor?.month ?? todayMonth;

  const logMap = useMemo(() => {
    const map = new Map<string, StudyLog>();
    for (const log of studyLogs) {
      map.set(log.study_date, log);
    }
    return map;
  }, [studyLogs]);

  const calendarData = useMemo(() => {
    const firstDay = new Date(activeYear, activeMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(activeYear, activeMonth + 1, 0).getDate();
    const monthPrefix = buildMonthKey(activeYear, activeMonth);

    const cells: Array<{
      day: number;
      dateStr: string;
      isActive: boolean;
      isToday: boolean;
      isFuture: boolean;
      log?: StudyLog;
    } | null> = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push(null);
    }

    let activeDaysCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthPrefix}-${String(d).padStart(2, "0")}`;
      const log = logMap.get(dateStr);
      const isActive = Boolean(
        log && (log.reviews_count > 0 || log.words_added > 0)
      );
      if (isActive) activeDaysCount += 1;

      cells.push({
        day: d,
        dateStr,
        isActive,
        isToday: dateStr === todayStr,
        isFuture: dateStr > todayStr,
        log,
      });
    }

    const monthTitle = firstDay.toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });

    return { cells, activeDaysCount, monthTitle };
  }, [activeYear, activeMonth, locale, logMap, todayStr]);

  const isViewingCurrentMonth =
    activeYear === todayYear && activeMonth === todayMonth;

  const handleShiftMonth = (delta: number) => {
    const dt = new Date(activeYear, activeMonth + delta, 1);
    const nextYear = dt.getFullYear();
    const nextMonth = dt.getMonth();
    if (
      nextYear > todayYear ||
      (nextYear === todayYear && nextMonth > todayMonth)
    ) {
      return;
    }
    setViewCursor({ year: nextYear, month: nextMonth });
    setSelectedDate(null);
  };

  const inspectedDate = selectedDate ?? todayStr;
  const inspectedLog = logMap.get(inspectedDate);
  const inspectedActive = Boolean(
    inspectedLog &&
      (inspectedLog.reviews_count > 0 || inspectedLog.words_added > 0)
  );

  const formattedInspectedDate = useMemo(() => {
    const [y, m, d] = inspectedDate.split("-").map(Number);
    if (!y || !m || !d) return inspectedDate;
    return new Date(y, m - 1, d).toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [inspectedDate, locale]);

  return (
    <section
      id="streak-calendar-section"
      className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4 scroll-mt-20"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#30D158]/20 border border-[#30D158]/35">
            <CalendarDays className="h-5 w-5 text-[#30D158]" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Monthly Streak Calendar
            </h3>
            <p className="text-xs text-[#8E8E93]">
              {isHydrated
                ? isEn
                  ? `${calendarData.activeDaysCount} active days this month`
                  : `${calendarData.activeDaysCount} hari aktif di bulan ini`
                : isEn
                  ? "Loading calendar..."
                  : "Memuat kalender..."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#30D158]/15 border border-[#30D158]/35 px-3 py-1 text-xs font-bold text-[#7CF099]">
            <Flame className="h-3.5 w-3.5 text-[#30D158]" />
            {isHydrated
              ? `${streak} ${isEn ? (streak === 1 ? "day" : "days") : "hari"}`
              : "—"}
          </span>

          <div className="flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/[0.1] p-1">
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => handleShiftMonth(-1)}
              aria-label={isEn ? "Previous month" : "Bulan sebelumnya"}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#8E8E93] hover:text-white hover:bg-white/[0.08] cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </motion.button>
            <span className="px-2 text-xs font-semibold text-[#F5F5F7] min-w-[112px] text-center">
              {calendarData.monthTitle}
            </span>
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              disabled={isViewingCurrentMonth}
              onClick={() => handleShiftMonth(1)}
              aria-label={isEn ? "Next month" : "Bulan berikutnya"}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#8E8E93] hover:text-white hover:bg-white/[0.08] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center">
        {weekdays.map((day) => (
          <div
            key={day}
            className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93] py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Cells */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {calendarData.cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="h-10 sm:h-11" />;
          }

          const isSelected = inspectedDate === cell.dateStr;

          return (
            <motion.button
              key={cell.dateStr}
              type="button"
              whileTap={cell.isFuture ? undefined : TAP_SCALE}
              disabled={cell.isFuture}
              onClick={() => setSelectedDate(cell.dateStr)}
              transition={IOS_SPRING}
              className={cn(
                "relative flex h-10 sm:h-11 flex-col items-center justify-center rounded-2xl text-xs sm:text-sm font-semibold transition-all cursor-pointer",
                cell.isFuture && "opacity-30 cursor-default",
                cell.isActive
                  ? "bg-[#30D158]/22 border border-[#30D158]/55 text-white shadow-[0_0_18px_rgba(48,209,88,0.24)]"
                  : "bg-white/[0.03] border border-white/[0.07] text-[#D1D1D6] hover:bg-white/[0.07]",
                cell.isToday &&
                  "ring-2 ring-[#0A84FF] ring-offset-1 ring-offset-black",
                isSelected && !cell.isToday && "border-white/45 bg-white/[0.12]"
              )}
            >
              <span>{cell.day}</span>
              {cell.isActive && (
                <span className="mt-0.5 inline-flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-[#30D158]" />
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Selected Day Detail Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-xs">
        <span className="font-medium text-[#F5F5F7]">
          {formattedInspectedDate}
          {inspectedDate === todayStr
            ? isEn
              ? " (Today)"
              : " (Hari Ini)"
            : ""}
        </span>

        {inspectedActive && inspectedLog ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#30D158]/15 border border-[#30D158]/30 px-2.5 py-0.5 font-semibold text-[#7CF099]">
              {inspectedLog.reviews_count}{" "}
              {isEn ? "reviews" : "review"} ({inspectedLog.correct_count}{" "}
              {isEn ? "correct" : "benar"})
            </span>
            {inspectedLog.words_added > 0 && (
              <span className="rounded-full bg-[#0A84FF]/15 border border-[#0A84FF]/30 px-2.5 py-0.5 font-semibold text-[#70BCFF]">
                +{inspectedLog.words_added} {isEn ? "new words" : "kata baru"}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[#8E8E93]">
            {isEn ? "No study activity yet" : "Belum ada aktivitas belajar"}
          </span>
        )}
      </div>
    </section>
  );
}
