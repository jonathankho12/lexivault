"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Award,
  BookOpenCheck,
  CheckCircle2,
  Flame,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { ActivityRings } from "@/components/gamification/ActivityRings";
import { CefrRecommendationBanner } from "@/components/gamification/CefrRecommendationBanner";
import { StreakCalendar } from "@/components/stats/StreakCalendar";
import { AudioButton } from "@/components/ui/AudioButton";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import {
  IOS_SPRING,
  STAGGER_CONTAINER,
  STAGGER_ITEM,
  TAP_SCALE,
} from "@/lib/motion";
import {
  ALL_CEFR_LEVELS,
  cn,
  formatCefrBadgeClass,
  formatShortDayLabel,
  getLastNDays,
  getLocalizedMeaning,
  getWeakestWords,
  getWordAccuracy,
  normalizeCefrLevel,
} from "@/lib/utils";

export function StatsView() {
  const {
    words,
    studyLogs,
    streak,
    xp,
    masteryRankInfo,
    dailyRings,
    dueWordsCount,
    todayStr,
    accent,
    isHydrated,
    hasDemoWords,
    streakFocusNonce,
    resetDemoData,
    setSelectedWord,
    launchPractice,
  } = useLexiVault();
  const { lang, t } = useLanguage();
  const isEn = lang === "en";

  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (streakFocusNonce === 0) return;
    const el = document.getElementById("streak-calendar-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [streakFocusNonce]);

  const stats = useMemo(() => {
    const wordCorrect = words.reduce((acc, w) => acc + (w.correct_count || 0), 0);
    const wordWrong = words.reduce((acc, w) => acc + (w.wrong_count || 0), 0);
    const logCorrect = studyLogs.reduce((acc, l) => acc + (l.correct_count || 0), 0);
    const logWrong = studyLogs.reduce((acc, l) => acc + (l.wrong_count || 0), 0);

    const totalCorrect = Math.max(wordCorrect, logCorrect);
    const totalWrong = Math.max(wordWrong, logWrong);
    const totalReviews = totalCorrect + totalWrong;
    const accuracy =
      totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0;

    const masteredCount = words.filter((w) => {
      const total = w.correct_count + w.wrong_count;
      return total >= 2 && w.correct_count / total >= 0.7;
    }).length;

    const vocabCount = words.filter((w) => w.type === "vocab").length;
    const idiomCount = words.filter((w) => w.type === "idiom").length;
    const collocationCount = words.filter(
      (w) => w.type === "collocation"
    ).length;

    return {
      totalCorrect,
      totalWrong,
      totalReviews,
      accuracy,
      masteredCount,
      vocabCount,
      idiomCount,
      collocationCount,
    };
  }, [studyLogs, words]);

  const weeklyChart = useMemo(() => {
    const last7 = getLastNDays(7, todayStr);
    const logMap = new Map(studyLogs.map((l) => [l.study_date, l]));

    const points = last7.map((dateStr) => {
      const log = logMap.get(dateStr);
      const reviews = log?.reviews_count ?? 0;
      const correct = log?.correct_count ?? 0;
      return {
        dateStr,
        label: formatShortDayLabel(dateStr),
        reviews,
        correct,
        added: log?.words_added ?? 0,
      };
    });

    const maxReviews = Math.max(10, ...points.map((p) => p.reviews));
    return { points, maxReviews };
  }, [studyLogs, todayStr]);

  const weakestWords = useMemo(() => getWeakestWords(words, 8), [words]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0A84FF]">
            {t.stats.eyebrow}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F7]">
            {t.stats.title}
          </h2>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/[0.1] px-3.5 py-1.5 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-[#FF9F0A]" />
          <span className="font-semibold text-white">
            {isHydrated ? `${xp.toLocaleString()} XP` : "—"}
          </span>
          <span className="text-[#8E8E93]">
            · {dueWordsCount} {t.stats.dueSuffix}
          </span>
        </div>
      </div>

      {/* Daily Activity Rings + Mastery Rank Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ActivityRings rings={dailyRings} variant="full" />
        </div>

        <div className="liquid-glass rounded-3xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#FF9F0A]">
                {t.stats.masteryRank}
              </p>
              <h3 className="text-xl font-bold text-white mt-0.5">
                {isHydrated ? masteryRankInfo.rank : "Observer"}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FF9F0A]/20 border border-[#FF9F0A]/35">
              <Award className="h-5 w-5 text-[#FF9F0A]" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#F5F5F7] tabular-nums">
                {isHydrated ? `${masteryRankInfo.currentXp} XP` : "0 XP"}
              </span>
              <span className="text-[#8E8E93]">
                {masteryRankInfo.nextRank
                  ? `${t.stats.nextRankPrefix} ${masteryRankInfo.nextRank} (${masteryRankInfo.nextThreshold} XP)`
                  : t.stats.maxRankReached}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <motion.div
                className="h-full w-full rounded-full bg-gradient-to-r from-[#FF9F0A] via-[#30D158] to-[#0A84FF] transform-gpu will-change-transform"
                style={{ transformOrigin: "left" }}
                initial={false}
                animate={{
                  scaleX: isHydrated
                    ? Math.max(0.04, masteryRankInfo.progressPct / 100)
                    : 0.04,
                }}
                transition={IOS_SPRING}
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <motion.div
        variants={STAGGER_CONTAINER}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {/* Daily Streak */}
        <motion.div
          variants={STAGGER_ITEM}
          className="liquid-glass rounded-3xl p-5 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8E8E93]">
              {t.stats.dailyStreak}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#30D158]/20 border border-[#30D158]/35">
              <Flame className="h-4 w-4 text-[#30D158]" />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight text-white">
            {isHydrated ? `${streak} ${t.stats.daysUnit}` : "—"}
          </p>
          <p className="text-xs text-[#7CF099]">
            {streak > 0 ? t.stats.streakActiveHint : t.stats.streakIdleHint}
          </p>
        </motion.div>

        {/* Mastered & Vault Breakdown */}
        <motion.div
          variants={STAGGER_ITEM}
          className="liquid-glass rounded-3xl p-5 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8E8E93]">
              {t.stats.masteredTitle}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0A84FF]/20 border border-[#0A84FF]/35">
              <BookOpenCheck className="h-4 w-4 text-[#0A84FF]" />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight text-white">
            {isHydrated ? `${stats.masteredCount}` : "—"}
            <span className="text-base font-medium text-[#8E8E93]">
              {" "}
              / {words.length}
            </span>
          </p>
          <p className="text-xs text-[#8E8E93]">
            {stats.vocabCount} Vocab · {stats.idiomCount} Idiom ·{" "}
            {stats.collocationCount} Colloc
          </p>
        </motion.div>

        {/* Overall Accuracy */}
        <motion.div
          variants={STAGGER_ITEM}
          className="liquid-glass rounded-3xl p-5 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8E8E93]">
              {t.stats.accuracyTitle}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5E5CE6]/20 border border-[#5E5CE6]/35">
              <Target className="h-4 w-4 text-[#A7A5FF]" />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight text-white">
            {isHydrated ? `${stats.accuracy}%` : "—"}
          </p>
          <p className="text-xs text-[#8E8E93]">
            {stats.totalCorrect} {t.stats.correctLabel} {stats.totalReviews}{" "}
            {t.stats.attemptsLabel}
          </p>
        </motion.div>
      </motion.div>

      {/* Monthly Streak Calendar */}
      <StreakCalendar />

      {/* 7-Day Activity Bar Chart */}
      <div className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0A84FF]/20 border border-[#0A84FF]/35">
              <Activity className="h-4.5 w-4.5 text-[#0A84FF]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {t.stats.weeklyTitle}
              </h3>
              <p className="text-xs text-[#8E8E93]">
                {t.stats.attemptsLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[#8E8E93]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#0A84FF]" />
              Total Review
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#30D158]" />
              {isEn ? "Correct" : lang === "ru" ? "Верно" : "Benar"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-44 pt-4">
          {weeklyChart.points.map((point) => {
            const totalHeightPct =
              point.reviews > 0
                ? Math.max(12, Math.round((point.reviews / weeklyChart.maxReviews) * 100))
                : 6;
            const correctPctInside =
              point.reviews > 0
                ? Math.round((point.correct / point.reviews) * 100)
                : 0;
            const isToday = point.dateStr === todayStr;

            return (
              <div
                key={point.dateStr}
                className="flex flex-col items-center justify-end h-full gap-2"
              >
                <span className="text-[11px] font-semibold text-[#F5F5F7]">
                  {point.reviews}
                </span>

                <div className="relative w-full max-w-[36px] h-28 flex items-end rounded-2xl bg-white/[0.04] border border-white/[0.08] overflow-hidden p-1">
                  <motion.div
                    initial={{ height: "0%" }}
                    animate={{ height: `${totalHeightPct}%` }}
                    transition={IOS_SPRING}
                    className={cn(
                      "relative w-full rounded-xl overflow-hidden",
                      point.reviews > 0
                        ? "bg-[#0A84FF]/35 border border-[#0A84FF]/45"
                        : "bg-white/[0.06]"
                    )}
                  >
                    {point.reviews > 0 && (
                      <div
                        style={{ height: `${correctPctInside}%` }}
                        className="absolute bottom-0 inset-x-0 rounded-b-xl bg-gradient-to-t from-[#30D158] to-[#0A84FF]"
                      />
                    )}
                  </motion.div>
                </div>

                <span
                  className={cn(
                    "text-[11px] font-medium",
                    isToday ? "text-[#0A84FF] font-bold" : "text-[#8E8E93]"
                  )}
                >
                  {isToday
                    ? isEn
                      ? "Today"
                      : lang === "ru"
                        ? "Сегодня"
                        : "Hari Ini"
                    : point.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Automatic Next-Level CEFR Readiness & Promotion Card */}
      <CefrRecommendationBanner variant="stats" />

      {/* CEFR Vocabulary Distribution (A1–C2) */}
      <div className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              {isEn
                ? "Vault CEFR Level Breakdown"
                : lang === "ru"
                  ? "Распределение по уровням CEFR"
                  : "Distribusi Level CEFR di Vault"}
            </h3>
            <p className="text-xs text-[#8E8E93]">
              {isEn
                ? "Objective A1–C2 distribution across all expressions saved in your Vault."
                : lang === "ru"
                  ? "Распределение всех сохранённых выражений в словаре от A1 до C2."
                  : "Distribusi objektif A1–C2 dari seluruh kosakata & idiom yang tersimpan di Vault."}
            </p>
          </div>
          <span className="text-xs font-semibold text-[#8E8E93]">
            {words.length} {lang === "ru" ? "всего" : "total"}
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {ALL_CEFR_LEVELS.map((lvl) => {
            const count = words.filter(
              (w) => normalizeCefrLevel(w.cefr) === lvl
            ).length;
            const pct =
              words.length > 0 ? Math.round((count / words.length) * 100) : 0;

            return (
              <div
                key={lvl}
                className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3 flex flex-col items-start gap-1.5"
              >
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-bold border",
                    formatCefrBadgeClass(lvl)
                  )}
                >
                  {lvl}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-white tabular-nums">
                    {count}
                  </span>
                  <span className="text-[11px] text-[#8E8E93] tabular-nums">
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weakest Words Section */}
      <div className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FF453A]/15 border border-[#FF453A]/35">
              <AlertTriangle className="h-5 w-5 text-[#FF453A]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {t.stats.weakestSectionTitle}
              </h3>
              <p className="text-xs text-[#8E8E93]">
                {t.practice.weakestSubtitlePrefix}
              </p>
              <p className="mt-0.5 text-[11px] text-[#8E8E93] opacity-80">
                {t.stats.weakestClearHint}
              </p>
            </div>
          </div>

          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            disabled={words.length === 0}
            onClick={() => launchPractice("weakest_drill")}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FF9F0A] to-[#FF453A] px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(255,69,58,0.3)] cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t.stats.drillWeakestBtn}</span>
          </motion.button>
        </div>

        {weakestWords.length === 0 ? (
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-6 text-center text-sm text-[#8E8E93]">
            {words.some((w) => w.wrong_count > 0)
              ? isEn
                ? "All weak words cleared — keep up your momentum!"
                : lang === "ru"
                  ? "Все сложные слова отработаны — так держать!"
                  : "Semua kata terlemah sudah dibersihkan — pertahankan ritmemu!"
              : isEn
                ? "No missed words yet — keep up your accuracy!"
                : lang === "ru"
                  ? "Ошибок пока нет — отличная точность!"
                  : "Belum ada kata dengan catatan kesalahan — pertahankan akurasimu!"}
          </div>
        ) : (
          <div className="space-y-2.5">
            {weakestWords.map((word) => {
              const acc = getWordAccuracy(word) ?? 0;
              const streakCount = Math.max(0, word.repetitions ?? 0);
              const remoteUrl =
                accent === "UK" ? word.audio_uk_url : word.audio_us_url;

              return (
                <motion.div
                  key={word.id}
                  whileTap={TAP_SCALE}
                  onClick={() => setSelectedWord(word)}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] border border-white/[0.09] px-4 py-3 hover:bg-white/[0.08] cursor-pointer transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-white truncate">
                        {word.term}
                      </span>
                      {word.cefr && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold border",
                            formatCefrBadgeClass(word.cefr)
                          )}
                        >
                          {word.cefr}
                        </span>
                      )}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold border",
                          acc < 45
                            ? "bg-[#FF453A]/15 border-[#FF453A]/35 text-[#FF8982]"
                            : "bg-[#FF9F0A]/15 border-[#FF9F0A]/35 text-[#FFD18C]"
                        )}
                      >
                        {word.wrong_count}{" "}
                        {isEn ? "missed" : lang === "ru" ? "ошибок" : "salah"} ·{" "}
                        {acc}%
                      </span>
                      {streakCount === 1 && (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#30D158]/12 border border-[#30D158]/30 text-[#7CF099]">
                          1/2 ✓
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#8E8E93] truncate">
                      {getLocalizedMeaning(word, lang)}
                    </p>
                  </div>

                  <AudioButton
                    text={word.term}
                    remoteUrl={remoteUrl}
                    wordId={word.id}
                    size="sm"
                  />
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reset Demo Data Section */}
      <div className="liquid-glass rounded-3xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">
            {isEn
              ? "Start from Scratch (Personal Vocabulary Only)"
              : lang === "ru"
                ? "Начать с нуля (только свой словарь)"
                : "Mulai dari Nol (Data Kosakata Pribadi)"}
          </h3>
          <p className="text-xs text-[#8E8E93] max-w-xl">
            {hasDemoWords
              ? isEn
                ? "Remove the 5 starter C1–C2 expressions so your Vault contains 100% words you added yourself (your own saved words will remain untouched)."
                : lang === "ru"
                  ? "Удали 5 стартовых выражений C1–C2, чтобы в словаре остались только твои собственные слова."
                  : "Hapus 5 kata/idiom starter bawaan agar Vault berisi 100% kosakata yang kamu simpan sendiri (kata yang sudah kamu tambahkan tidak akan terhapus)."
              : isEn
                ? "Starter items cleared — your Vault now contains 100% your own vocabulary."
                : lang === "ru"
                  ? "Стартовые карточки удалены — теперь в словаре только твоя лексика."
                  : "Data starter sudah dibersihkan — Vault kamu sekarang berisi 100% kosakata milikmu sendiri."}
          </p>
        </div>

        {resetDone || !hasDemoWords ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#30D158]/15 border border-[#30D158]/35 px-4 py-2 text-xs font-semibold text-[#7CF099]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>
              {isEn
                ? "Personal Vault Active"
                : lang === "ru"
                  ? "Только личный словарь"
                  : "Kosakata Sendiri Aktif"}
            </span>
          </span>
        ) : !confirmReset ? (
          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[#FF453A]/15 border border-[#FF453A]/35 px-4 py-2 text-xs font-semibold text-[#FF8982] hover:bg-[#FF453A]/25 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>
              {isEn
                ? "Start from Scratch (Remove Starter)"
                : lang === "ru"
                  ? "Очистить стартовый набор"
                  : "Mulai dari Nol (Hapus Starter)"}
            </span>
          </motion.button>
        ) : (
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => setConfirmReset(false)}
              className="rounded-full bg-white/[0.08] px-3.5 py-2 text-xs font-medium text-[#8E8E93] hover:text-white cursor-pointer"
            >
              {isEn ? "Cancel" : lang === "ru" ? "Отмена" : "Batal"}
            </motion.button>
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={async () => {
                await resetDemoData();
                setConfirmReset(false);
                setResetDone(true);
              }}
              className="rounded-full bg-[#FF453A] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
            >
              {isEn
                ? "Confirm Remove Starter"
                : lang === "ru"
                  ? "Удалить стартовые"
                  : "Konfirmasi Hapus Starter"}
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
