"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Flame,
  Layers,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
  XCircle,
} from "lucide-react";
import { AudioButton } from "@/components/ui/AudioButton";
import { HighlightedText } from "@/components/ui/HighlightedText";
import { PronunciationText } from "@/components/ui/PronunciationText";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import {
  FALLBACK_DAILY_IDIOMS,
  FALLBACK_DAILY_WORDS,
} from "@/lib/dailyPackFallback";
import type { AppLanguage } from "@/lib/i18n";
import { IOS_SHEET_SPRING, IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import {
  playCorrectChime,
  playGlassClick,
  playRingCompleteChord,
  playWrongThud,
} from "@/lib/soundEffects";
import { cn, getLocalizedMeaning, normalizeTermKey } from "@/lib/utils";
import type { DailyPackItem } from "@/types/lexivault";

const CHUNK_SIZE = 5;

type ModalStage = "memorize" | "quiz" | "round_done" | "completed";
type QuizQuestionMode = "meaning_mc" | "fill_blank";

interface QuizCard {
  uid: string;
  item: DailyPackItem;
  mode: QuizQuestionMode;
  promptSentence?: string;
  choices: string[];
  correctChoice: string;
  requeued?: boolean;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildBlankSentence(item: DailyPackItem): string | null {
  const rawSentence = item.examples[0]?.sentence?.trim();
  if (!rawSentence) return null;

  // Prefer replacing **bold** segment first (Gemini & fallback always bold the target)
  const boldMatch = /\*\*([^*]+)\*\*/.exec(rawSentence);
  if (boldMatch) {
    return rawSentence.replace(/\*\*[^*]+\*\*/, "________");
  }

  // Fallback to case-insensitive term replacement
  const regex = new RegExp(`\\b${escapeRegExp(item.term)}\\b`, "i");
  if (regex.test(rawSentence)) {
    return rawSentence.replace(regex, "________");
  }
  return null;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function buildQuizCard(
  item: DailyPackItem,
  preferredMode: QuizQuestionMode,
  pool: DailyPackItem[],
  lang: AppLanguage,
  requeued = false,
  nonce = 0
): QuizCard {
  const blanked = buildBlankSentence(item);
  const mode: QuizQuestionMode =
    preferredMode === "fill_blank" && blanked ? "fill_blank" : "meaning_mc";

  const distractorPool = [
    ...pool,
    ...(item.type === "idiom" ? FALLBACK_DAILY_IDIOMS : FALLBACK_DAILY_WORDS),
    ...FALLBACK_DAILY_WORDS,
    ...FALLBACK_DAILY_IDIOMS,
  ].filter((cand) => normalizeTermKey(cand.term) !== normalizeTermKey(item.term));

  if (mode === "fill_blank" && blanked) {
    const seen = new Set<string>([normalizeTermKey(item.term)]);
    const distractors: string[] = [];
    const preferredTypeFirst = [
      ...distractorPool.filter((d) => d.type === item.type),
      ...distractorPool.filter((d) => d.type !== item.type),
    ];
    for (const cand of shuffleArray(preferredTypeFirst)) {
      const k = normalizeTermKey(cand.term);
      if (seen.has(k)) continue;
      seen.add(k);
      distractors.push(cand.term);
      if (distractors.length >= 3) break;
    }

    return {
      uid: `${item.id}-fb-${nonce}`,
      item,
      mode: "fill_blank",
      promptSentence: blanked,
      choices: shuffleArray([item.term, ...distractors]),
      correctChoice: item.term,
      requeued,
    };
  }

  const correctMeaning = getLocalizedMeaning(item, lang);
  const seenMeanings = new Set<string>([correctMeaning.toLowerCase()]);
  const distractorMeanings: string[] = [];

  for (const cand of shuffleArray(distractorPool)) {
    const m = getLocalizedMeaning(cand, lang);
    const key = m.toLowerCase();
    if (!m || seenMeanings.has(key)) continue;
    seenMeanings.add(key);
    distractorMeanings.push(m);
    if (distractorMeanings.length >= 3) break;
  }

  return {
    uid: `${item.id}-mc-${nonce}`,
    item,
    mode: "meaning_mc",
    choices: shuffleArray([correctMeaning, ...distractorMeanings]),
    correctChoice: correctMeaning,
    requeued,
  };
}

function HighlightedSentence({ sentence }: { sentence: string }) {
  return <HighlightedText text={sentence} />;
}

export function DailyPackModal() {
  const {
    dailyPack,
    dailyQuota,
    isDailyPackLoading,
    dailyPackError,
    dailyPackModalOpen,
    dismissDailyPackForSession,
    ensureDailyPackLoaded,
    completeDailyPackItem,
    recordDailyPackWrongAttempt,
    setActiveTab,
  } = useLexiVault();
  const { lang, t } = useLanguage();
  const isEn = lang === "en";

  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<ModalStage>("memorize");

  useEffect(() => {
    setMounted(true);
  }, []);
  const [activeChunk, setActiveChunk] = useState<DailyPackItem[]>([]);
  const [roundNumber, setRoundNumber] = useState(1);
  const [memIndex, setMemIndex] = useState(0);

  const [quizQueue, setQuizQueue] = useState<QuizCard[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);

  const requeueCounterRef = useRef(0);
  const initializedPackKeyRef = useRef<string | null>(null);

  const totalItems = dailyPack?.items.length ?? 0;
  const completedSet = useMemo(
    () => new Set(dailyPack?.completed_terms ?? []),
    [dailyPack?.completed_terms]
  );
  const completedCount = useMemo(() => {
    if (!dailyPack) return 0;
    return dailyPack.items.filter((it) =>
      completedSet.has(normalizeTermKey(it.term))
    ).length;
  }, [completedSet, dailyPack]);

  const totalRounds = Math.max(1, Math.ceil(totalItems / CHUNK_SIZE));
  const progressPct =
    totalItems > 0 ? Math.min(100, Math.round((completedCount / totalItems) * 100)) : 0;

  const startNextChunk = useCallback(
    (packItems: DailyPackItem[], completedKeys: Set<string>) => {
      const remaining = packItems.filter(
        (it) => !completedKeys.has(normalizeTermKey(it.term))
      );

      if (remaining.length === 0 && packItems.length > 0) {
        setActiveChunk([]);
        setQuizQueue([]);
        setStage("completed");
        return;
      }

      const alreadyDone = packItems.length - remaining.length;
      const nextChunk = remaining.slice(0, CHUNK_SIZE);
      setRoundNumber(
        Math.min(
          Math.max(1, Math.ceil(packItems.length / CHUNK_SIZE)),
          Math.floor(alreadyDone / CHUNK_SIZE) + 1
        )
      );
      setActiveChunk(nextChunk);
      setMemIndex(0);
      setQuizQueue([]);
      setQuizIndex(0);
      setSelectedChoice(null);
      setStage("memorize");
    },
    []
  );

  // Initialize chunk cleanly whenever the modal opens or a fresh pack finishes loading
  useEffect(() => {
    if (!dailyPackModalOpen) {
      initializedPackKeyRef.current = null;
      return;
    }
    if (!dailyPack || dailyPack.items.length === 0) return;

    const initKey = `${dailyPack.pack_date}-${dailyPack.items.length}-${dailyPack.items[0]?.id ?? ""}`;
    if (initializedPackKeyRef.current === initKey) return;
    initializedPackKeyRef.current = initKey;

    startNextChunk(dailyPack.items, new Set(dailyPack.completed_terms));
  }, [dailyPack, dailyPackModalOpen, startNextChunk]);

  // Escape key closes/dismisses cleanly
  useEffect(() => {
    if (!dailyPackModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismissDailyPackForSession();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dailyPackModalOpen, dismissDailyPackForSession]);

  const handleStartQuizStage = () => {
    if (!dailyPack || activeChunk.length === 0) return;
    playGlassClick();
    const cards = shuffleArray(activeChunk).map((item, idx) =>
      buildQuizCard(
        item,
        idx % 2 === 0 ? "meaning_mc" : "fill_blank",
        dailyPack.items,
        lang,
        false,
        idx
      )
    );
    setQuizQueue(cards);
    setQuizIndex(0);
    setSelectedChoice(null);
    setStage("quiz");
  };

  const currentQuizCard = quizQueue[quizIndex] ?? null;

  const handleSelectAnswer = async (choice: string) => {
    if (!currentQuizCard || selectedChoice !== null || isSavingAnswer) return;
    setSelectedChoice(choice);

    const isCorrect = choice === currentQuizCard.correctChoice;
    if (isCorrect) {
      playCorrectChime(2);
      setIsSavingAnswer(true);
      try {
        await completeDailyPackItem(currentQuizCard.item);
      } finally {
        setIsSavingAnswer(false);
      }
    } else {
      playWrongThud();
      void recordDailyPackWrongAttempt();
      // Mandatory active recall: re-queue missed item at the end of the current round
      requeueCounterRef.current += 1;
      const nextMode: QuizQuestionMode =
        currentQuizCard.mode === "meaning_mc" ? "fill_blank" : "meaning_mc";
      const requeuedCard = buildQuizCard(
        currentQuizCard.item,
        nextMode,
        dailyPack?.items ?? activeChunk,
        lang,
        true,
        requeueCounterRef.current
      );
      setQuizQueue((prev) => [...prev, requeuedCard]);
    }
  };

  const handleAdvanceQuiz = () => {
    if (!currentQuizCard || selectedChoice === null) return;
    playGlassClick();
    const nextIdx = quizIndex + 1;
    if (nextIdx < quizQueue.length) {
      setQuizIndex(nextIdx);
      setSelectedChoice(null);
      return;
    }

    // Current round's quiz queue finished! Check if more rounds remain today
    const packItems = dailyPack?.items ?? [];
    const freshCompleted = new Set(dailyPack?.completed_terms ?? []);
    // Ensure the just-passed item is counted even before state flush
    if (selectedChoice === currentQuizCard.correctChoice) {
      freshCompleted.add(normalizeTermKey(currentQuizCard.item.term));
    }

    const stillRemaining = packItems.filter(
      (it) => !freshCompleted.has(normalizeTermKey(it.term))
    );

    if (stillRemaining.length === 0) {
      playRingCompleteChord();
      setStage("completed");
    } else {
      playCorrectChime(4);
      setStage("round_done");
    }
  };

  const handleProceedToNextRound = () => {
    if (!dailyPack) return;
    playGlassClick();
    startNextChunk(dailyPack.items, new Set(dailyPack.completed_terms));
  };

  const currentMemItem = activeChunk[memIndex] ?? null;
  const isPaused = dailyQuota.wordsPerDay + dailyQuota.idiomsPerDay === 0;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {dailyPackModalOpen && (
        <div
          key="daily-pack-modal-portal"
          className="fixed inset-0 z-[90] flex items-end md:items-center justify-center p-0 md:p-6"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={dismissDailyPackForSession}
            className="fixed inset-0 bg-black/78"
          />

          {/* Modal Sheet */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t.dailyPack.modalTitle}
            initial={{ opacity: 0, y: 44 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 34 }}
            transition={IOS_SHEET_SPRING}
            className="liquid-glass-elevated transform-gpu will-change-transform relative z-10 w-full md:max-w-2xl max-h-[92dvh] overflow-y-auto no-scrollbar rounded-t-[32px] md:rounded-3xl p-5 sm:p-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] space-y-5"
          >
            {/* Mobile Drag Handle */}
            <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-white/25 md:hidden" />

            {/* Top Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF9F0A]/25 to-[#0A84FF]/25 border border-white/[0.14] text-[#FFD18C]">
                  <Flame className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#FF9F0A]">
                    {t.dailyPack.eyebrow}
                  </p>
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                    {t.dailyPack.modalTitle}
                    {totalItems > 0 && (
                      <span className="ml-2 text-sm font-semibold text-[#70BCFF] tabular-nums">
                        {completedCount}/{totalItems}
                      </span>
                    )}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {stage !== "completed" && (
                  <button
                    type="button"
                    onClick={() => {
                      playGlassClick();
                      dismissDailyPackForSession();
                    }}
                    className="rounded-full bg-white/[0.06] border border-white/[0.1] px-3 py-1.5 text-xs font-medium text-[#D1D1D6] hover:bg-white/[0.12] hover:text-white cursor-pointer transition-colors"
                  >
                    {t.dailyPack.doLaterBtn}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    playGlassClick();
                    dismissDailyPackForSession();
                  }}
                  aria-label={t.dailyPack.close}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-[#8E8E93] hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Overall Daily Pack Progress Bar */}
            {totalItems > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-[#D1D1D6]">
                    {stage === "completed"
                      ? t.dailyPack.completedTitle
                      : `${t.dailyPack.roundLabel} ${roundNumber} ${t.dailyPack.ofLabel} ${totalRounds} · ${
                          stage === "memorize"
                            ? t.dailyPack.stageMemorize
                            : stage === "quiz"
                              ? t.dailyPack.stageQuiz
                              : t.dailyPack.roundCompleteTitle
                        }`}
                  </span>
                  <span className="font-semibold text-[#7CF099] tabular-nums">
                    {completedCount} / {totalItems} ({progressPct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <motion.div
                    className="h-full w-full rounded-full bg-gradient-to-r from-[#FF9F0A] via-[#30D158] to-[#0A84FF] transform-gpu will-change-transform"
                    style={{ transformOrigin: "left" }}
                    initial={false}
                    animate={{ scaleX: Math.max(0.03, progressPct / 100) }}
                    transition={IOS_SPRING}
                  />
                </div>
              </div>
            )}

            {/* Loading State */}
            {isDailyPackLoading && (
              <div className="rounded-3xl bg-white/[0.04] border border-white/[0.09] p-10 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0A84FF]/15 border border-[#0A84FF]/35 text-[#70BCFF]">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
                <p className="text-base font-bold text-white">
                  {t.dailyPack.loadingTitle}
                </p>
                <p className="text-xs text-[#8E8E93] max-w-sm mx-auto">
                  {t.dailyPack.loadingSubtitle}
                </p>
              </div>
            )}

            {/* Error State */}
            {!isDailyPackLoading && dailyPackError && (
              <div className="rounded-3xl bg-red-500/10 border border-red-500/30 p-6 text-center space-y-3">
                <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
                <p className="text-sm font-semibold text-red-300">
                  {dailyPackError || t.dailyPack.errorFallback}
                </p>
                <motion.button
                  type="button"
                  whileTap={TAP_SCALE}
                  onClick={() => void ensureDailyPackLoaded(false)}
                  className="inline-flex items-center gap-2 rounded-full bg-white/[0.1] border border-white/[0.15] px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.16] cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{t.dailyPack.retryBtn}</span>
                </motion.button>
              </div>
            )}

            {/* Paused State */}
            {!isDailyPackLoading && !dailyPackError && isPaused && (
              <div className="rounded-3xl bg-white/[0.04] border border-white/[0.09] p-8 text-center space-y-2">
                <p className="text-base font-bold text-white">
                  {t.dailyPack.pausedTitle}
                </p>
                <p className="text-xs text-[#8E8E93]">
                  {t.dailyPack.pausedSubtitle}
                </p>
              </div>
            )}

            {/* STAGE 1: QUICK MEMORIZE */}
            {!isDailyPackLoading &&
              !dailyPackError &&
              !isPaused &&
              stage === "memorize" &&
              currentMemItem && (
                <div className="space-y-4">
                  {/* Card Indicator Dots */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-[#8E8E93]">
                      {t.dailyPack.memorizeHint}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {activeChunk.map((it, idx) => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => {
                            playGlassClick();
                            setMemIndex(idx);
                          }}
                          aria-label={`Card ${idx + 1}`}
                          className={cn(
                            "h-2 rounded-full transition-all cursor-pointer",
                            idx === memIndex
                              ? "w-6 bg-[#0A84FF]"
                              : idx < memIndex
                                ? "w-2 bg-[#30D158]/80"
                                : "w-2 bg-white/20"
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Memorize Glass Card */}
                  <motion.div
                    key={currentMemItem.id}
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={IOS_SPRING}
                    className="rounded-3xl bg-white/[0.05] border border-white/[0.12] p-5 sm:p-6 space-y-4"
                  >
                    {/* Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-[#5E5CE6]/20 border border-[#5E5CE6]/40 px-2.5 py-0.5 text-[11px] font-bold text-[#C7C6FF]">
                          {currentMemItem.cefr}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                            currentMemItem.type === "idiom"
                              ? "bg-[#FF9F0A]/15 border-[#FF9F0A]/35 text-[#FFD18C]"
                              : "bg-[#0A84FF]/15 border-[#0A84FF]/35 text-[#70BCFF]"
                          )}
                        >
                          {currentMemItem.type === "idiom" ? "Idiom" : "Vocab"}
                        </span>
                        <span className="rounded-full bg-white/[0.06] border border-white/[0.1] px-2.5 py-0.5 text-[11px] font-medium text-[#D1D1D6]">
                          {currentMemItem.register}
                        </span>
                      </div>

                      <span className="text-xs font-semibold text-[#8E8E93] tabular-nums">
                        {memIndex + 1} / {activeChunk.length}
                      </span>
                    </div>

                    {/* Term + Audio + Phonetic */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white break-words">
                          {currentMemItem.term}
                        </h3>
                        <PronunciationText
                          term={currentMemItem.term}
                          pronunciation={currentMemItem.pronunciation}
                          ipa={currentMemItem.ipa}
                          size="md"
                        />
                      </div>

                      <AudioButton
                        text={currentMemItem.term}
                        size="md"
                      />
                    </div>

                    {/* Active-Language Meaning */}
                    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#0A84FF]">
                        {t.wordDetail.meaningTitle}
                      </p>
                      <p className="text-sm sm:text-base font-medium text-[#F5F5F7] leading-relaxed">
                        {getLocalizedMeaning(currentMemItem, lang)}
                      </p>
                    </div>

                    {/* Contextual Example */}
                    {currentMemItem.examples[0] && (
                      <div className="rounded-2xl bg-[#0A84FF]/[0.07] border border-[#0A84FF]/20 p-4 space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#70BCFF]">
                          {t.flashcards.exampleTitle}
                        </p>
                        <p className="text-sm text-[#F5F5F7] leading-relaxed">
                          <HighlightedSentence
                            sentence={currentMemItem.examples[0].sentence}
                          />
                        </p>
                        {!isEn && currentMemItem.examples[0].translation_id && (
                          <p className="text-xs text-[#8E8E93] leading-relaxed">
                            <HighlightedSentence
                              sentence={currentMemItem.examples[0].translation_id}
                            />
                          </p>
                        )}
                      </div>
                    )}

                    {/* Synonyms */}
                    {currentMemItem.synonyms.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-medium text-[#8E8E93] mr-1">
                          {t.wordDetail.synonymsTitle}:
                        </span>
                        {currentMemItem.synonyms.map((syn) => (
                          <span
                            key={syn}
                            className="rounded-full bg-white/[0.06] border border-white/[0.1] px-2.5 py-0.5 text-[11px] text-[#D1D1D6]"
                          >
                            {syn}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>

                  {/* Memorize Navigation Controls */}
                  <div className="flex items-center justify-between gap-3">
                    <motion.button
                      type="button"
                      whileTap={TAP_SCALE}
                      disabled={memIndex === 0}
                      onClick={() => {
                        playGlassClick();
                        setMemIndex((prev) => Math.max(0, prev - 1));
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] px-4 py-2.5 text-xs font-semibold text-[#F5F5F7] hover:bg-white/[0.12] disabled:opacity-40 cursor-pointer"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>{t.dailyPack.prevCard}</span>
                    </motion.button>

                    {memIndex < activeChunk.length - 1 ? (
                      <motion.button
                        type="button"
                        whileTap={TAP_SCALE}
                        onClick={() => {
                          playGlassClick();
                          setMemIndex((prev) =>
                            Math.min(activeChunk.length - 1, prev + 1)
                          );
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1A8EFF] shadow-[0_6px_20px_rgba(10,132,255,0.35)] cursor-pointer"
                      >
                        <span>
                          {t.dailyPack.nextCard} ({memIndex + 2}/{activeChunk.length})
                        </span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </motion.button>
                    ) : (
                      <motion.button
                        type="button"
                        whileTap={TAP_SCALE}
                        onClick={handleStartQuizStage}
                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#30D158] to-[#0A84FF] px-5 py-2.5 text-xs font-bold text-white shadow-[0_8px_24px_rgba(48,209,88,0.32)] hover:brightness-110 cursor-pointer"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>{t.dailyPack.startRecallQuiz}</span>
                      </motion.button>
                    )}
                  </div>
                </div>
              )}

            {/* STAGE 2: MANDATORY ACTIVE-RECALL QUIZ */}
            {!isDailyPackLoading &&
              !dailyPackError &&
              !isPaused &&
              stage === "quiz" &&
              currentQuizCard && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-[#8E8E93]">
                      {t.dailyPack.quizSubtitle}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {currentQuizCard.requeued && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FF9F0A]/15 border border-[#FF9F0A]/35 px-2.5 py-0.5 text-[10px] font-bold text-[#FFD18C]">
                          <RotateCcw className="h-3 w-3" />
                          {t.dailyPack.requeuedBadge}
                        </span>
                      )}
                      <span className="font-semibold text-[#F5F5F7] tabular-nums">
                        {quizIndex + 1} / {quizQueue.length}
                      </span>
                    </div>
                  </div>

                  <motion.div
                    key={currentQuizCard.uid}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={IOS_SPRING}
                    className="rounded-3xl bg-white/[0.05] border border-white/[0.12] p-5 sm:p-6 space-y-5"
                  >
                    {/* Prompt Area */}
                    {currentQuizCard.mode === "meaning_mc" ? (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#0A84FF]">
                          {t.dailyPack.promptMeaning}
                        </p>
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-2xl sm:text-3xl font-bold text-white">
                                {currentQuizCard.item.term}
                              </h3>
                              <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#D1D1D6]">
                                {currentQuizCard.item.type}
                              </span>
                            </div>
                            <PronunciationText
                              term={currentQuizCard.item.term}
                              pronunciation={currentQuizCard.item.pronunciation}
                              ipa={currentQuizCard.item.ipa}
                              size="sm"
                            />
                          </div>
                          <AudioButton
                            text={currentQuizCard.item.term}
                            size="sm"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#5E5CE6]">
                          {t.dailyPack.promptFillBlank}
                        </p>
                        <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4 space-y-1.5">
                          <p className="text-base sm:text-lg font-medium text-white leading-relaxed">
                            {currentQuizCard.promptSentence}
                          </p>
                          {!isEn &&
                            currentQuizCard.item.examples[0]?.translation_id && (
                              <p className="text-xs text-[#8E8E93]">
                                <HighlightedSentence
                                  sentence={
                                    currentQuizCard.item.examples[0]
                                      .translation_id
                                  }
                                />
                              </p>
                            )}
                        </div>
                      </div>
                    )}

                    {/* 4 Interactive Options */}
                    <div className="grid grid-cols-1 gap-2.5">
                      {currentQuizCard.choices.map((choice, idx) => {
                        const isPicked = selectedChoice === choice;
                        const isRightChoice =
                          choice === currentQuizCard.correctChoice;
                        const revealed = selectedChoice !== null;

                        return (
                          <motion.button
                            key={`${currentQuizCard.uid}-opt-${idx}`}
                            type="button"
                            whileTap={revealed ? undefined : TAP_SCALE}
                            disabled={revealed || isSavingAnswer}
                            onClick={() => void handleSelectAnswer(choice)}
                            className={cn(
                              "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition-all",
                              !revealed &&
                                "bg-white/[0.04] border-white/[0.1] text-[#F5F5F7] hover:bg-white/[0.1] hover:border-white/[0.2] cursor-pointer",
                              revealed &&
                                isRightChoice &&
                                "bg-[#30D158]/18 border-[#30D158]/50 text-[#A6F8BA]",
                              revealed &&
                                isPicked &&
                                !isRightChoice &&
                                "bg-red-500/15 border-red-500/45 text-red-300",
                              revealed &&
                                !isPicked &&
                                !isRightChoice &&
                                "bg-white/[0.02] border-white/[0.06] text-[#8E8E93] opacity-60"
                            )}
                          >
                            <span className="leading-snug">{choice}</span>
                            {revealed && isRightChoice && (
                              <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-[#30D158]" />
                            )}
                            {revealed && isPicked && !isRightChoice && (
                              <XCircle className="h-4.5 w-4.5 shrink-0 text-red-400" />
                            )}
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Feedback Banner + Continue Button */}
                    {selectedChoice !== null && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 pt-1"
                      >
                        <div
                          className={cn(
                            "rounded-2xl border px-4 py-3 text-xs font-semibold flex items-start gap-2.5",
                            selectedChoice === currentQuizCard.correctChoice
                              ? "bg-[#30D158]/15 border-[#30D158]/35 text-[#7CF099]"
                              : "bg-red-500/12 border-red-500/35 text-red-300"
                          )}
                        >
                          {selectedChoice === currentQuizCard.correctChoice ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#30D158]" />
                          ) : (
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                          )}
                          <div className="space-y-1">
                            <p>
                              {selectedChoice === currentQuizCard.correctChoice
                                ? t.dailyPack.correctFeedback
                                : t.dailyPack.wrongFeedback}
                            </p>
                            {selectedChoice !== currentQuizCard.correctChoice && (
                              <p className="text-[11px] text-[#D1D1D6] font-normal">
                                <span className="font-semibold text-white">
                                  {currentQuizCard.item.term}:
                                </span>{" "}
                                {getLocalizedMeaning(currentQuizCard.item, lang)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <motion.button
                            type="button"
                            whileTap={TAP_SCALE}
                            disabled={isSavingAnswer}
                            onClick={handleAdvanceQuiz}
                            className="inline-flex items-center gap-2 rounded-full bg-[#0A84FF] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#1A8EFF] cursor-pointer disabled:opacity-60"
                          >
                            {isSavingAnswer ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            <span>{t.dailyPack.continueBtn}</span>
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                </div>
              )}

            {/* ROUND COMPLETE INTERSTITIAL */}
            {!isDailyPackLoading &&
              !dailyPackError &&
              !isPaused &&
              stage === "round_done" && (
                <div className="rounded-3xl bg-white/[0.05] border border-white/[0.12] p-7 text-center space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#30D158]/20 border border-[#30D158]/40 text-[#7CF099]">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-white">
                      {t.dailyPack.roundCompleteTitle}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#8E8E93] max-w-md mx-auto">
                      {t.dailyPack.roundCompleteBody}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                    <motion.button
                      type="button"
                      whileTap={TAP_SCALE}
                      onClick={dismissDailyPackForSession}
                      className="rounded-full bg-white/[0.07] border border-white/[0.12] px-4 py-2.5 text-xs font-semibold text-[#D1D1D6] hover:bg-white/[0.12] cursor-pointer"
                    >
                      {t.dailyPack.doLaterBtn}
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={TAP_SCALE}
                      onClick={handleProceedToNextRound}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FF9F0A] to-[#0A84FF] px-5 py-2.5 text-xs font-bold text-white shadow-[0_8px_24px_rgba(10,132,255,0.3)] cursor-pointer"
                    >
                      <span>{t.dailyPack.nextRoundBtn}</span>
                    </motion.button>
                  </div>
                </div>
              )}

            {/* COMPLETED / REVIEW VIEW */}
            {!isDailyPackLoading &&
              !dailyPackError &&
              !isPaused &&
              stage === "completed" &&
              dailyPack && (
                <div className="space-y-4">
                  <div className="rounded-3xl bg-gradient-to-br from-[#30D158]/16 via-white/[0.04] to-[#0A84FF]/14 border border-[#30D158]/35 p-6 text-center space-y-2.5">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#30D158]/20 border border-[#30D158]/40 text-[#7CF099]">
                      <Trophy className="h-6 w-6" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#7CF099]">
                      {t.dailyPack.allDoneEyebrow}
                    </p>
                    <h3 className="text-xl sm:text-2xl font-bold text-white">
                      {t.dailyPack.allDoneTitle}
                    </h3>
                    <p className="text-xs text-[#D1D1D6] max-w-md mx-auto">
                      {t.dailyPack.allDoneSubtitle}
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                      <motion.button
                        type="button"
                        whileTap={TAP_SCALE}
                        onClick={() => {
                          playGlassClick();
                          dismissDailyPackForSession();
                          setActiveTab("flashcards");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF] px-4 py-2 text-xs font-bold text-white hover:bg-[#1A8EFF] cursor-pointer"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        <span>{t.dailyPack.openFlashcardsBtn}</span>
                      </motion.button>
                      <motion.button
                        type="button"
                        whileTap={TAP_SCALE}
                        onClick={() => {
                          playGlassClick();
                          dismissDailyPackForSession();
                        }}
                        className="rounded-full bg-white/[0.08] border border-white/[0.12] px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.14] cursor-pointer"
                      >
                        {t.dailyPack.doneBtn}
                      </motion.button>
                    </div>
                  </div>

                  {/* Review List of Today's Learned Items */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <BookOpen className="h-3.5 w-3.5 text-[#70BCFF]" />
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">
                        {t.dailyPack.learnedListTitle} ({dailyPack.items.length})
                      </h4>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar pr-0.5">
                      {dailyPack.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-bold text-white">
                                {item.term}
                              </span>
                              <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#D1D1D6]">
                                {item.cefr} · {item.type}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-[#8E8E93] line-clamp-2">
                              {getLocalizedMeaning(item, lang)}
                            </p>
                          </div>
                          <AudioButton text={item.term} size="sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
