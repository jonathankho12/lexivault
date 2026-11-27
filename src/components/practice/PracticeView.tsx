"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { ComboBadge } from "@/components/gamification/ComboBadge";
import { CommuteModeFlow } from "@/components/practice/CommuteModeFlow";
import { FillBlankCard } from "@/components/practice/FillBlankCard";
import { FlashcardRecallCard } from "@/components/practice/FlashcardRecallCard";
import { SentenceMakerCard } from "@/components/practice/SentenceMakerCard";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault, useOverlayBackGuard } from "@/context/LexiVaultContext";
import {
  fetchAiMeaningDistractorsBatch,
  getCachedAiMeaningDistractors,
} from "@/lib/distractorEngine";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import {
  applyAiDistractorsToPracticeQuestions,
  buildDailyMiniQuizSession,
  buildFullMarathonSession,
  buildSmartMixSession,
  buildWeakestDrillSession,
} from "@/lib/practiceEngine";
import {
  playCorrectChime,
  playGlassClick,
  playWrongThud,
} from "@/lib/soundEffects";
import { cn, getLocalizedMeaning, getWeakestWords } from "@/lib/utils";
import type {
  DiscoveryItem,
  PracticeMode,
  PracticeQuestion,
} from "@/types/lexivault";

interface SessionResultItem {
  term: string;
  isCorrect: boolean;
}

export function PracticeView() {
  const {
    words,
    dueWordsCount,
    recordAnswer,
    practiceLaunch,
    clearPracticeLaunch,
    commuteLaunchNonce,
    clearCommuteLaunch,
    isHydrated,
  } = useLexiVault();
  const { lang, t } = useLanguage();

  const [phase, setPhase] = useState<"launcher" | "active" | "summary" | "commute">(
    "launcher"
  );
  const [activeMode, setActiveMode] = useState<PracticeMode>("smart_mix");
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<SessionResultItem[]>([]);
  const [combo, setCombo] = useState(0);
  const [isPreparingQuiz, setIsPreparingQuiz] = useState(false);

  const transitionLockRef = useRef(false);
  const scoredQuestionIdsRef = useRef<Set<string>>(new Set());
  const sessionAbortRef = useRef<AbortController | null>(null);

  const weakestWords = useMemo(() => getWeakestWords(words), [words]);

  useEffect(() => {
    return () => {
      sessionAbortRef.current?.abort();
    };
  }, []);

  // Browser / Mobile Back exits active quiz, summary, or commute back to Practice launcher
  useOverlayBackGuard(
    "practice_session",
    phase === "active" || phase === "summary",
    useCallback(() => setPhase("launcher"), [])
  );
  useOverlayBackGuard(
    "commute_session",
    phase === "commute",
    useCallback(() => setPhase("launcher"), [])
  );

  // Release synchronous transition lock only after active question index or phase actually changes
  useEffect(() => {
    transitionLockRef.current = false;
  }, [currentIndex, phase]);

  const startSession = useCallback(
    async (mode: PracticeMode, customItems?: DiscoveryItem[]) => {
      let generated: PracticeQuestion[] = [];
      if (mode === "smart_mix") {
        generated = buildSmartMixSession(words, 20, lang);
      } else if (mode === "full_marathon") {
        generated = buildFullMarathonSession(words, lang);
      } else if (mode === "weakest_drill") {
        generated = buildWeakestDrillSession(words, lang);
      } else if (mode === "daily_mini" && customItems) {
        generated = buildDailyMiniQuizSession(customItems, words, lang);
      }

      if (generated.length === 0) return;

      playGlassClick();
      sessionAbortRef.current?.abort();
      const abortController = new AbortController();
      sessionAbortRef.current = abortController;

      const meaningTargets = generated
        .filter((q) => q.kind === "flashcard")
        .slice(0, 12)
        .map((q) => ({
          id: q.id,
          term: q.word.term,
          type: q.word.type,
          register: q.word.register,
          cefr: q.word.cefr,
          meaning: getLocalizedMeaning(q.word, lang),
        }));

      const hasUncached = meaningTargets.some(
        (t) => !getCachedAiMeaningDistractors(t.term, t.meaning, lang)
      );

      let finalQuestions = generated;
      if (hasUncached && meaningTargets.length > 0) {
        setIsPreparingQuiz(true);
        try {
          const aiMap = await fetchAiMeaningDistractorsBatch(
            meaningTargets,
            lang,
            { signal: abortController.signal, timeoutMs: 4200 }
          );
          if (abortController.signal.aborted) return;
          if (Object.keys(aiMap).length > 0) {
            const poolForMerge =
              mode === "daily_mini"
                ? [...generated.map((g) => g.word), ...words]
                : words;
            finalQuestions = applyAiDistractorsToPracticeQuestions(
              generated,
              poolForMerge,
              lang,
              aiMap
            );
          }
        } finally {
          if (!abortController.signal.aborted) {
            setIsPreparingQuiz(false);
          }
        }
      }

      if (abortController.signal.aborted) return;

      transitionLockRef.current = false;
      scoredQuestionIdsRef.current = new Set();
      setActiveMode(mode);
      setQuestions(finalQuestions);
      setCurrentIndex(0);
      setResults([]);
      setCombo(0);
      setPhase("active");
    },
    [lang, words]
  );

  // React to external launches (e.g. "Drill Weakest Words" from Stats or "Mini-Quiz" from Discover)
  useEffect(() => {
    if (!practiceLaunch) return;
    startSession(practiceLaunch.mode, practiceLaunch.customItems);
    clearPracticeLaunch();
  }, [practiceLaunch, startSession, clearPracticeLaunch]);

  // React to external "5-Min Commute" launches (e.g. from Vault quick action)
  useEffect(() => {
    if (commuteLaunchNonce <= 0) return;
    setPhase("commute");
    clearCommuteLaunch();
  }, [commuteLaunchNonce, clearCommuteLaunch]);

  const handleQuestionComplete = useCallback(
    (isCorrect: boolean) => {
      if (transitionLockRef.current) return;
      const currentQuestion = questions[currentIndex];
      if (!currentQuestion) return;

      // Synchronous lock prevents spam-click double scoring before index advances
      transitionLockRef.current = true;

      // Per-question deduplication: each question can score / increment combo / grant XP at most once
      if (!scoredQuestionIdsRef.current.has(currentQuestion.id)) {
        scoredQuestionIdsRef.current.add(currentQuestion.id);

        if (isCorrect) {
          setCombo((prev) => {
            const next = prev + 1;
            playCorrectChime(next);
            return next;
          });
        } else {
          playWrongThud();
          setCombo(0);
        }

        setResults((prev) => [
          ...prev,
          { term: currentQuestion.word.term, isCorrect },
        ]);

        // Optimistic navigation: fire-and-forget cloud sync, never block UI transition
        void recordAnswer(currentQuestion.word.id, isCorrect).catch((err) => {
          console.error("[LexiVault] Background recordAnswer failed:", err);
        });
      }

      if (currentIndex + 1 >= questions.length) {
        setPhase("summary");
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    },
    [currentIndex, questions, recordAnswer]
  );

  const correctTotal = results.filter((r) => r.isCorrect).length;
  const sessionAccuracy =
    results.length > 0 ? Math.round((correctTotal / results.length) * 100) : 0;

  if (phase === "commute") {
    return <CommuteModeFlow onExit={() => setPhase("launcher")} />;
  }

  if (isPreparingQuiz) {
    return (
      <div className="max-w-xl mx-auto py-16">
        <div className="liquid-glass rounded-3xl p-8 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0A84FF]/20 border border-[#0A84FF]/35 text-[#70BCFF]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <p className="text-base font-bold text-white">
            {lang === "en"
              ? "Crafting plausible quiz distractors..."
              : "Menyiapkan opsi kuis pengecoh..."}
          </p>
          <p className="text-xs text-[#8E8E93]">
            {lang === "en"
              ? "Matching register, part of speech, and semantic nuance."
              : "Menyelaraskan register, jenis kata, dan nuansa makna."}
          </p>
        </div>
      </div>
    );
  }

  if (phase === "active" && questions[currentIndex]) {
    const current = questions[currentIndex];
    const progressPct = Math.round(
      ((currentIndex + 1) / questions.length) * 100
    );

    return (
      <div className="space-y-5 max-w-2xl mx-auto">
        {/* Session Header & Progress */}
        <div className="liquid-glass rounded-3xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 min-h-[32px]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="whitespace-nowrap shrink-0 rounded-full bg-[#0A84FF]/20 border border-[#0A84FF]/35 px-3 py-1 text-xs font-semibold text-[#70BCFF]">
                {activeMode === "smart_mix"
                  ? t.practice.modeSmartMix
                  : activeMode === "full_marathon"
                    ? t.practice.modeFullMarathon
                    : activeMode === "weakest_drill"
                      ? t.practice.modeWeakestDrill
                      : t.practice.modeDailyMini}
              </span>
              <span className="whitespace-nowrap text-xs font-semibold text-[#8E8E93] tabular-nums">
                {currentIndex + 1} / {questions.length}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <ComboBadge combo={combo} />
              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                onClick={() => setPhase("launcher")}
                aria-label={t.practice.exitSession}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[#8E8E93] hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <motion.div
              className="h-full w-full rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] transform-gpu will-change-transform"
              style={{ transformOrigin: "left" }}
              initial={false}
              animate={{ scaleX: Math.max(0, Math.min(1, progressPct / 100)) }}
              transition={IOS_SPRING}
            />
          </div>
        </div>

        {/* Active Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 18, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -18, scale: 0.985 }}
            transition={IOS_SPRING}
          >
            {current.kind === "flashcard" && (
              <FlashcardRecallCard
                question={current}
                onComplete={handleQuestionComplete}
              />
            )}
            {current.kind === "fill_blank" && (
              <FillBlankCard
                question={current}
                onComplete={handleQuestionComplete}
              />
            )}
            {current.kind === "make_sentence" && (
              <SentenceMakerCard
                question={current}
                onComplete={handleQuestionComplete}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  if (phase === "summary") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={IOS_SPRING}
        className="max-w-xl mx-auto space-y-5"
      >
        <div className="liquid-glass-elevated rounded-3xl p-6 sm:p-8 text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#30D158]/20 border border-[#30D158]/40 shadow-[0_0_32px_rgba(48,209,88,0.25)]">
            <Award className="h-8 w-8 text-[#30D158]" />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#30D158]">
              {t.practice.summaryTitle}
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-white">
              {t.practice.summaryAccuracy}: {sessionAccuracy}%
            </h2>
            <p className="mt-1 text-sm text-[#8E8E93]">
              {correctTotal} / {results.length}
            </p>
          </div>

          <div className="max-h-60 overflow-y-auto no-scrollbar space-y-2 text-left">
            {results.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-2xl bg-white/[0.05] border border-white/[0.08] px-4 py-2.5 text-sm"
              >
                <span className="font-medium text-[#F5F5F7]">{item.term}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-semibold",
                    item.isCorrect ? "text-[#30D158]" : "text-[#FF453A]"
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {item.isCorrect ? "✓" : "Review"}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => startSession(activeMode)}
              className="inline-flex items-center gap-2 rounded-full bg-[#0A84FF] px-5 py-2.5 text-sm font-semibold text-white cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>{t.practice.summaryAgainBtn}</span>
            </motion.button>
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => setPhase("launcher")}
              className="rounded-full bg-white/[0.08] border border-white/[0.14] px-5 py-2.5 text-sm font-semibold text-[#F5F5F7] cursor-pointer"
            >
              {t.practice.summaryBackBtn}
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#0A84FF]">
          {t.practice.eyebrow}
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F7]">
          {t.practice.title}
        </h2>
        <p className="mt-1 text-sm text-[#8E8E93]">{t.practice.subtitle}</p>
      </div>

      {/* Pool Overview Pill Banner */}
      <div className="liquid-glass rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0A84FF]/20 border border-[#0A84FF]/35">
            <Layers className="h-6 w-6 text-[#0A84FF]" />
          </div>
          <div>
            <p className="text-xs font-medium text-[#8E8E93]">
              {t.practice.poolBannerTitle}
            </p>
            <p className="text-xl font-bold text-white">
              {isHydrated
                ? `${words.length} ${t.practice.poolExpressions}`
                : t.nav.loading}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-[#8E8E93]">
          <span className="rounded-full bg-white/[0.06] border border-white/[0.1] px-3 py-1">
            3D Flashcard
          </span>
          <span className="rounded-full bg-white/[0.06] border border-white/[0.1] px-3 py-1">
            Fill-in-the-Blank
          </span>
          <span className="rounded-full bg-white/[0.06] border border-white/[0.1] px-3 py-1">
            AI Sentence Maker
          </span>
        </div>
      </div>

      {/* 5-Min Commute Mode Card */}
      <motion.div
        whileTap={TAP_SCALE}
        onClick={() => {
          playGlassClick();
          setPhase("commute");
        }}
        className="liquid-glass transform-gpu rounded-3xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 border-[#30D158]/30 hover:border-[#30D158]/55 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#30D158] to-[#0A84FF] shadow-[0_8px_22px_rgba(48,209,88,0.28)]">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg sm:text-xl font-bold text-white">
                {t.practice.commuteTitle}
              </h3>
              <span className="rounded-full bg-[#30D158]/20 border border-[#30D158]/40 px-2.5 py-0.5 text-[11px] font-semibold text-[#7CF099]">
                {t.practice.commuteBadge}
              </span>
            </div>
            <p className="mt-0.5 text-xs sm:text-sm text-[#8E8E93]">
              {t.practice.commuteDescPrefix}
              {isHydrated ? dueWordsCount : 0} {t.practice.commuteDescMid}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#30D158] to-[#0A84FF] px-4 py-2 text-xs font-bold text-white shrink-0">
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>{t.practice.commuteStart}</span>
        </span>
      </motion.div>

      {/* Mode Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Daily Smart Mix */}
        <motion.div
          whileTap={TAP_SCALE}
          onClick={() => words.length > 0 && startSession("smart_mix")}
          className={cn(
            "liquid-glass rounded-3xl p-6 flex flex-col justify-between gap-5 cursor-pointer transition-colors hover:border-[#0A84FF]/45",
            words.length === 0 && "opacity-60 pointer-events-none"
          )}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] shadow-[0_8px_20px_rgba(10,132,255,0.35)]">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="rounded-full bg-[#0A84FF]/20 border border-[#0A84FF]/35 px-3 py-1 text-[11px] font-semibold text-[#70BCFF]">
                {t.practice.smartMixBadge}
              </span>
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">
                {t.practice.smartMixTitle}
              </h3>
              <p className="mt-1 text-sm text-[#8E8E93] leading-relaxed">
                {t.practice.smartMixDesc}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
            <span className="text-xs font-medium text-[#8E8E93]">
              {Math.min(20, words.length)} {t.practice.smartMixCountSuffix}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF] px-4 py-2 text-xs font-semibold text-white">
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{t.practice.startBtn}</span>
            </span>
          </div>
        </motion.div>

        {/* Full Marathon */}
        <motion.div
          whileTap={TAP_SCALE}
          onClick={() => words.length > 0 && startSession("full_marathon")}
          className={cn(
            "liquid-glass rounded-3xl p-6 flex flex-col justify-between gap-5 cursor-pointer transition-colors hover:border-[#5E5CE6]/45",
            words.length === 0 && "opacity-60 pointer-events-none"
          )}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5E5CE6]/25 border border-[#5E5CE6]/45">
                <Flame className="h-5 w-5 text-[#A7A5FF]" />
              </div>
              <span className="rounded-full bg-[#5E5CE6]/20 border border-[#5E5CE6]/35 px-3 py-1 text-[11px] font-semibold text-[#C4C2FF]">
                {t.practice.fullMarathonBadge}
              </span>
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">
                {t.practice.fullMarathonTitle}
              </h3>
              <p className="mt-1 text-sm text-[#8E8E93] leading-relaxed">
                {t.practice.fullMarathonDesc}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
            <span className="text-xs font-medium text-[#8E8E93]">
              {words.length} {t.practice.fullMarathonCountSuffix}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.12] border border-white/[0.16] px-4 py-2 text-xs font-semibold text-white">
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{t.practice.startMarathonBtn}</span>
            </span>
          </div>
        </motion.div>
      </div>

      {/* Weakest Words Quick Drill Banner */}
      {weakestWords.length > 0 && (
        <motion.div
          whileTap={TAP_SCALE}
          onClick={() => startSession("weakest_drill")}
          className="liquid-glass rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4 border-[#FF9F0A]/25 hover:border-[#FF9F0A]/50 cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FF9F0A]/20 border border-[#FF9F0A]/35">
              <AlertTriangle className="h-5 w-5 text-[#FF9F0A]" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">
                {t.practice.weakestTitle} ({weakestWords.length})
              </h4>
              <p className="text-xs text-[#8E8E93]">
                {t.practice.weakestSubtitlePrefix}{" "}
                {weakestWords
                  .slice(0, 3)
                  .map((w) => w.term)
                  .join(", ")}
              </p>
              <p className="mt-0.5 text-[11px] text-[#8E8E93] opacity-80">
                {t.stats.weakestClearHint}
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF9F0A]/20 border border-[#FF9F0A]/40 px-4 py-2 text-xs font-semibold text-[#FFD18C]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t.practice.weakestCta}</span>
          </span>
        </motion.div>
      )}
    </div>
  );
}
