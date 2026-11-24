"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import { ComboBadge } from "@/components/gamification/ComboBadge";
import { AudioButton } from "@/components/ui/AudioButton";
import { HighlightedText } from "@/components/ui/HighlightedText";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault, useOverlayBackGuard } from "@/context/LexiVaultContext";
import type { AppLanguage } from "@/lib/i18n";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import {
  playCorrectChime,
  playGlassClick,
  playRingCompleteChord,
  playWrongThud,
} from "@/lib/soundEffects";
import { cn, getLocalizedMeaning, normalizeTermKey } from "@/lib/utils";
import type { WordEntry } from "@/types/lexivault";

export type RoundConfidence = "forgot" | "shaky" | "solid";

interface QuickLockInTestProps {
  roundCards: WordEntry[];
  roundRatings: Record<string, RoundConfidence>;
  allWords: WordEntry[];
  roundNumber: number;
  hasNextRound: boolean;
  onNextRound: () => void;
  onBackToDeck: () => void;
  onExit: () => void;
}

type LockInQuestionMode = "fill_blank" | "meaning_mc";

interface LockInQuestion {
  id: string;
  word: WordEntry;
  mode: LockInQuestionMode;
  blankSentence?: string;
  blankTarget?: string;
  choices: string[];
  correctChoice: string;
}

interface LockInResult {
  wordId: string;
  term: string;
  isCorrect: boolean;
}

const FALLBACK_MEANING_DISTRACTORS_EN = [
  "Acting hastily without considering long-term consequences.",
  "A situation where two sides refuse to compromise under pressure.",
  "Sticking rigidly to outdated routines despite major changes.",
  "Deliberately hiding key details to avoid public scrutiny.",
];

const FALLBACK_MEANING_DISTRACTORS_ID = [
  "Bertindak tergesa-gesa tanpa mempertimbangkan dampak jangka panjang.",
  "Keadaan saat dua pihak menolak berkompromi di bawah tekanan.",
  "Mempertahankan kebiasaan lama meski situasi sudah berubah drastis.",
  "Sengaja menyembunyikan informasi penting agar terhindar dari kritik.",
];

const FALLBACK_TERM_DISTRACTORS = [
  "pragmatic",
  "mitigate",
  "resilient",
  "cut corners",
  "strike a balance",
  "ubiquitous",
];

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildBlankContext(
  word: WordEntry
): { blankSentence: string; blankTarget: string } | null {
  const sample = word.examples_json?.[0]?.sentence?.trim();
  if (!sample) return null;

  const boldMatch = sample.match(/\*\*(.+?)\*\*/);
  if (boldMatch?.[1]) {
    const target = boldMatch[1].trim();
    const blankSentence = sample
      .replace(/\*\*(.+?)\*\*/, "_____")
      .replace(/\*\*/g, "");
    return { blankSentence, blankTarget: target };
  }

  const regex = new RegExp(`\\b(${escapeRegExp(word.term)})\\b`, "i");
  if (regex.test(sample)) {
    const matched = sample.match(regex)?.[1] ?? word.term;
    return {
      blankSentence: sample.replace(regex, "_____"),
      blankTarget: matched,
    };
  }

  return null;
}

function buildLockInQuestions(
  roundCards: WordEntry[],
  roundRatings: Record<string, RoundConfidence>,
  allWords: WordEntry[],
  lang: AppLanguage
): LockInQuestion[] {
  const priorityOrder: Record<RoundConfidence, number> = {
    forgot: 0,
    shaky: 1,
    solid: 2,
  };

  // Deduplicate round cards and prioritize Forgot -> Shaky -> Solid
  const uniqueMap = new Map<string, WordEntry>();
  for (const card of roundCards) {
    if (!uniqueMap.has(card.id)) uniqueMap.set(card.id, card);
  }

  const prioritized = Array.from(uniqueMap.values()).sort((a, b) => {
    const pA = priorityOrder[roundRatings[a.id] ?? "solid"];
    const pB = priorityOrder[roundRatings[b.id] ?? "solid"];
    return pA - pB;
  });

  // 4 to 6 rapid questions (or fewer if round had < 4 cards)
  const targetCount = Math.min(6, prioritized.length);
  const selected = prioritized.slice(0, targetCount);
  const pool = allWords.length >= 4 ? allWords : [...allWords, ...roundCards];

  return selected.map((word, idx) => {
    const preferFillBlank = idx % 2 === 0;
    const blankInfo = preferFillBlank ? buildBlankContext(word) : null;

    if (blankInfo) {
      const targetNorm = normalizeTermKey(blankInfo.blankTarget);
      const otherTerms = shuffleArray(
        pool
          .filter(
            (w) =>
              w.id !== word.id && normalizeTermKey(w.term) !== targetNorm
          )
          .map((w) => w.term)
      );
      const seen = new Set<string>([targetNorm]);
      const distractors: string[] = [];
      for (const cand of [...otherTerms, ...FALLBACK_TERM_DISTRACTORS]) {
        const key = normalizeTermKey(cand);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        distractors.push(cand);
        if (distractors.length >= 3) break;
      }

      return {
        id: `lockin-${idx}-${word.id}-fb`,
        word,
        mode: "fill_blank",
        blankSentence: blankInfo.blankSentence,
        blankTarget: blankInfo.blankTarget,
        choices: shuffleArray([blankInfo.blankTarget, ...distractors]),
        correctChoice: blankInfo.blankTarget,
      };
    }

    const correctMeaning = getLocalizedMeaning(word, lang);
    const seenMeanings = new Set<string>([correctMeaning.toLowerCase()]);
    const otherMeanings = shuffleArray(
      pool
        .filter((w) => w.id !== word.id)
        .map((w) => getLocalizedMeaning(w, lang))
        .filter(Boolean)
    );
    const fallbacks =
      lang === "en"
        ? FALLBACK_MEANING_DISTRACTORS_EN
        : FALLBACK_MEANING_DISTRACTORS_ID;
    const distractors: string[] = [];
    for (const cand of [...otherMeanings, ...fallbacks]) {
      const key = cand.toLowerCase();
      if (!cand || seenMeanings.has(key)) continue;
      seenMeanings.add(key);
      distractors.push(cand);
      if (distractors.length >= 3) break;
    }

    return {
      id: `lockin-${idx}-${word.id}-mc`,
      word,
      mode: "meaning_mc",
      choices: shuffleArray([correctMeaning, ...distractors]),
      correctChoice: correctMeaning,
    };
  });
}

export function QuickLockInTest({
  roundCards,
  roundRatings,
  allWords,
  roundNumber,
  hasNextRound,
  onNextRound,
  onBackToDeck,
  onExit,
}: QuickLockInTestProps) {
  const { accent, recordSm2Review } = useLexiVault();
  const { lang } = useLanguage();
  const isEn = lang === "en";

  // Browser / Mobile Back exits Lock-In Test back to Flashcards
  useOverlayBackGuard("lock_in_test", true, onExit);

  const questions = useMemo(
    () => buildLockInQuestions(roundCards, roundRatings, allWords, lang),
    // Freeze question set for the duration of this Lock-In Test instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [combo, setCombo] = useState(0);
  const [results, setResults] = useState<LockInResult[]>([]);
  const [done, setDone] = useState(false);

  const optionLockRef = useRef(false);
  const nextLockRef = useRef(false);
  const scoredIdsRef = useRef<Set<string>>(new Set());

  // Release synchronous click locks only after the active question index actually advances
  useEffect(() => {
    optionLockRef.current = false;
    nextLockRef.current = false;
    setSelectedChoice(null);
    setIsAdvancing(false);
  }, [currentIndex]);

  const currentQuestion = questions[currentIndex] ?? null;

  const handlePickChoice = useCallback(
    (choice: string) => {
      if (!currentQuestion || selectedChoice !== null || optionLockRef.current) {
        return;
      }
      optionLockRef.current = true;
      setSelectedChoice(choice);

      const isCorrect = choice === currentQuestion.correctChoice;

      // Per-question deduplication: score, combo, XP, and SM-2 mastery update at most once
      if (!scoredIdsRef.current.has(currentQuestion.id)) {
        scoredIdsRef.current.add(currentQuestion.id);

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
          {
            wordId: currentQuestion.word.id,
            term: currentQuestion.word.term,
            isCorrect,
          },
        ]);

        // Direct Mastery Impact (optimistic, non-blocking):
        // Correct -> SM-2 boost ("good", +15 XP); Incorrect -> lower ease/interval ("again", 0 XP)
        void recordSm2Review(
          currentQuestion.word.id,
          isCorrect ? "good" : "again"
        ).catch((err) => {
          console.error("[LexiVault] Lock-In Test SM-2 update failed:", err);
        });
      }
    },
    [currentQuestion, recordSm2Review, selectedChoice]
  );

  const handleNext = useCallback(() => {
    if (selectedChoice === null || nextLockRef.current) return;
    nextLockRef.current = true;
    setIsAdvancing(true);

    if (currentIndex + 1 >= questions.length) {
      playRingCompleteChord();
      setDone(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, questions.length, selectedChoice]);

  if (questions.length === 0) {
    return null;
  }

  if (done) {
    const correctCount = results.filter((r) => r.isCorrect).length;
    const accuracy =
      results.length > 0
        ? Math.round((correctCount / results.length) * 100)
        : 0;
    const xpEarned = correctCount * 15;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={IOS_SPRING}
        className="liquid-glass-elevated transform-gpu will-change-transform rounded-3xl p-6 sm:p-8 text-center space-y-5"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#30D158]/20 border border-[#30D158]/40 shadow-[0_0_32px_rgba(48,209,88,0.22)]">
          <Award className="h-8 w-8 text-[#30D158]" />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#30D158]">
            {isEn
              ? `Lock-In Test Complete · Round ${roundNumber}`
              : `Tes Lock-In Selesai · Ronde ${roundNumber}`}
          </p>
          <h3 className="text-2xl sm:text-3xl font-bold text-white">
            {accuracy}% {isEn ? "Locked In" : "Terkunci"}
          </h3>
          <p className="text-sm text-[#8E8E93]">
            {correctCount} / {results.length}{" "}
            {isEn ? "correct" : "benar"}
            {xpEarned > 0 ? ` · +${xpEarned} XP` : ""}
          </p>
        </div>

        <div className="max-h-56 overflow-y-auto no-scrollbar space-y-2 text-left">
          {results.map((item, idx) => (
            <div
              key={`${item.wordId}-${idx}`}
              className="flex items-center justify-between gap-2 rounded-2xl bg-white/[0.05] border border-white/[0.08] px-4 py-2.5 text-sm"
            >
              <span className="font-semibold text-[#F5F5F7] truncate">
                {item.term}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 shrink-0 text-xs font-semibold",
                  item.isCorrect ? "text-[#7CF099]" : "text-[#FFB4AE]"
                )}
              >
                {item.isCorrect ? (
                  <>
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>{isEn ? "Mastery +1" : "Mastery +1"}</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-3.5 w-3.5" />
                    <span>{isEn ? "Review sooner" : "Ulang lebih cepat"}</span>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          {hasNextRound && (
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => {
                playGlassClick();
                onNextRound();
              }}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(10,132,255,0.3)] cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>{isEn ? "Start Next Round" : "Mulai Ronde Berikutnya"}</span>
            </motion.button>
          )}

          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            onClick={() => {
              playGlassClick();
              onBackToDeck();
            }}
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] border border-white/[0.15] px-5 py-2.5 text-sm font-semibold text-[#F5F5F7] hover:bg-white/[0.14] cursor-pointer"
          >
            <Layers className="h-4 w-4 text-[#70BCFF]" />
            <span>{isEn ? "Back to Deck" : "Kembali ke Deck"}</span>
          </motion.button>
        </div>
      </motion.div>
    );
  }

  if (!currentQuestion) return null;

  const answered = selectedChoice !== null;
  const isCorrect = selectedChoice === currentQuestion.correctChoice;
  const progressPct = Math.round(
    ((currentIndex + 1) / questions.length) * 100
  );
  const remoteUrl =
    accent === "UK"
      ? currentQuestion.word.audio_uk_url
      : currentQuestion.word.audio_us_url;
  const sentenceParts = currentQuestion.blankSentence?.split("_____") ?? [];

  return (
    <div className="space-y-4">
      {/* Fixed-slot Header */}
      <div className="liquid-glass rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 min-h-[32px]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#BF5AF2]/20 border border-[#BF5AF2]/40 px-3 py-1 text-xs font-semibold text-[#E5B8FF]">
              <Sparkles className="h-3 w-3" />
              <span>{isEn ? "Quick Lock-In Test" : "Tes Cepat Lock-In"}</span>
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
              onClick={() => {
                playGlassClick();
                onExit();
              }}
              aria-label={isEn ? "Exit Lock-In Test" : "Keluar Tes Lock-In"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[#8E8E93] hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </motion.button>
          </div>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <motion.div
            className="h-full w-full rounded-full bg-gradient-to-r from-[#BF5AF2] via-[#5E5CE6] to-[#0A84FF] transform-gpu will-change-transform"
            style={{ transformOrigin: "left" }}
            initial={false}
            animate={{ scaleX: Math.max(0.05, Math.min(1, progressPct / 100)) }}
            transition={IOS_SPRING}
          />
        </div>
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={IOS_SPRING}
          className="space-y-4"
        >
          <div className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-white/[0.07] border border-white/[0.12] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#D1D1D6]">
                {currentQuestion.mode === "fill_blank"
                  ? isEn
                    ? "Context Fill-in-the-Blank"
                    : "Lengkapi Kalimat Konteks"
                  : isEn
                    ? "Meaning Recall"
                    : "Tebak Arti"}
              </span>
              <AudioButton
                text={currentQuestion.word.term}
                remoteUrl={remoteUrl}
                wordId={currentQuestion.word.id}
                size="sm"
              />
            </div>

            {currentQuestion.mode === "fill_blank" ? (
              <div className="space-y-3">
                <p className="text-lg sm:text-xl font-medium leading-relaxed text-[#F5F5F7]">
                  {sentenceParts.length > 1 ? (
                    <>
                      {sentenceParts[0]}
                      <span
                        className={cn(
                          "inline-flex items-center rounded-xl px-2.5 py-0.5 mx-1 border font-semibold",
                          !answered
                            ? "bg-[#0A84FF]/15 border-[#0A84FF]/40 text-[#70BCFF]"
                            : isCorrect
                              ? "bg-[#30D158]/20 border-[#30D158]/50 text-[#7CF099]"
                              : "bg-[#FF453A]/20 border-[#FF453A]/50 text-[#FFB4AE]"
                        )}
                      >
                        {answered ? currentQuestion.correctChoice : "_____"}
                      </span>
                      {sentenceParts.slice(1).join("_____")}
                    </>
                  ) : (
                    currentQuestion.blankSentence
                  )}
                </p>
                <p className="text-xs text-[#8E8E93] leading-relaxed">
                  {isEn ? "Hint: " : "Petunjuk: "}
                  {getLocalizedMeaning(currentQuestion.word, lang)}
                </p>
              </div>
            ) : (
              <div className="py-2 text-center space-y-1.5">
                <p className="text-xs uppercase tracking-wider text-[#8E8E93]">
                  {isEn
                    ? "Choose the accurate meaning for:"
                    : "Pilih arti yang tepat untuk:"}
                </p>
                <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-white break-words">
                  {currentQuestion.word.term}
                </h3>
              </div>
            )}
          </div>

          {/* Choices */}
          <div
            className={cn(
              "grid gap-2.5",
              currentQuestion.mode === "fill_blank"
                ? "grid-cols-2"
                : "grid-cols-1"
            )}
          >
            {currentQuestion.choices.map((choice, idx) => {
              const isTarget = choice === currentQuestion.correctChoice;
              const isPicked = choice === selectedChoice;
              let btnStyle =
                "bg-white/[0.06] border-white/[0.12] text-[#F5F5F7] hover:bg-white/[0.11]";
              if (answered) {
                if (isTarget) {
                  btnStyle =
                    "bg-[#30D158]/20 border-[#30D158]/55 text-white shadow-[0_0_20px_rgba(48,209,88,0.16)]";
                } else if (isPicked) {
                  btnStyle =
                    "bg-[#FF453A]/20 border-[#FF453A]/55 text-[#FFB4AE]";
                } else {
                  btnStyle =
                    "bg-white/[0.03] border-white/[0.07] text-[#8E8E93] opacity-60";
                }
              }

              return (
                <motion.button
                  key={idx}
                  type="button"
                  whileTap={answered ? undefined : TAP_SCALE}
                  disabled={answered}
                  onClick={() => handlePickChoice(choice)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-2xl border px-4 py-3.5 text-sm font-medium transition-all cursor-pointer disabled:cursor-default",
                    currentQuestion.mode === "fill_blank"
                      ? "justify-center text-center"
                      : "text-left",
                    btnStyle
                  )}
                >
                  <span className="leading-snug">{choice}</span>
                  {answered && isTarget && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#30D158]" />
                  )}
                  {answered && isPicked && !isTarget && (
                    <XCircle className="h-4 w-4 shrink-0 text-[#FF453A]" />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Instant Feedback + Next */}
          {answered && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={IOS_SPRING}
              className="liquid-glass rounded-3xl p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isCorrect ? (
                    <CheckCircle2 className="h-5 w-5 text-[#30D158]" />
                  ) : (
                    <XCircle className="h-5 w-5 text-[#FF453A]" />
                  )}
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isCorrect ? "text-[#7CF099]" : "text-[#FFB4AE]"
                    )}
                  >
                    {isCorrect
                      ? isEn
                        ? "Locked in! Mastery boosted (+15 XP)"
                        : "Terkunci! Mastery meningkat (+15 XP)"
                      : isEn
                        ? "Scheduled to return sooner in future rounds"
                        : "Dijadwalkan muncul lebih cepat di ronde berikutnya"}
                  </span>
                </div>

                <motion.button
                  type="button"
                  whileTap={isAdvancing ? undefined : TAP_SCALE}
                  disabled={isAdvancing}
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0A84FF] px-5 py-2 text-sm font-semibold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>
                    {currentIndex + 1 >= questions.length
                      ? isEn
                        ? "See Results"
                        : "Lihat Hasil"
                      : isEn
                        ? "Next"
                        : "Lanjut"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
              </div>

              {currentQuestion.word.examples_json?.[0] && (
                <p className="text-xs text-[#A1A1AA] leading-relaxed">
                  <HighlightedText
                    text={currentQuestion.word.examples_json[0].sentence}
                  />
                </p>
              )}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
