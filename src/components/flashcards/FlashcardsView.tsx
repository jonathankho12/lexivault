"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import {
  BookMarked,
  CheckCircle2,
  Flame,
  Layers,
  RotateCcw,
  RotateCw,
  Shuffle,
  Sparkles,
  Tag,
  Target,
  Trophy,
  XCircle,
} from "lucide-react";
import { ComboBadge } from "@/components/gamification/ComboBadge";
import { AudioButton } from "@/components/ui/AudioButton";
import { HighlightedText } from "@/components/ui/HighlightedText";
import { PronunciationText } from "@/components/ui/PronunciationText";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import {
  buildSmartFlashcardQueue,
  getEffectiveReviewCount,
  isReviewedToday,
  previewSm2IntervalLabels,
} from "@/lib/sm2";
import {
  playCorrectChime,
  playGlassClick,
  playRingCompleteChord,
  playWrongThud,
} from "@/lib/soundEffects";
import {
  cn,
  formatCefrBadgeClass,
  formatRegisterBadgeClass,
  formatSourceTagLabel,
  formatTypeLabel,
  getLocalizedMeaning,
  WEAKEST_CLEAR_STREAK,
} from "@/lib/utils";
import type { Sm2Rating, WordEntry } from "@/types/lexivault";

type DeckFilter = "due" | "unreviewed" | "weakest";
type MasteryStage = "new" | "learning" | "solid" | "mastered";

function getMasteryStage(word: WordEntry): MasteryStage {
  const totalReviews = getEffectiveReviewCount(word);
  if (totalReviews === 0) return "new";

  const raw = word as unknown as Record<string, unknown>;
  const sm2Reps =
    typeof raw.sm2_repetitions === "number"
      ? raw.sm2_repetitions
      : typeof raw.repetitions === "number"
        ? raw.repetitions
        : null;
  const sm2Interval =
    typeof raw.sm2_interval === "number"
      ? raw.sm2_interval
      : typeof raw.interval_days === "number"
        ? raw.interval_days
        : typeof raw.interval === "number"
          ? raw.interval
          : 0;

  const effectiveReps =
    sm2Reps !== null && sm2Reps > 0
      ? sm2Reps
      : word.wrong_count === 0
        ? word.correct_count
        : 0;

  if (effectiveReps >= 4 || sm2Interval >= 14) return "mastered";
  if (effectiveReps >= 2 || sm2Interval >= 3) return "solid";
  return "learning";
}

function getMasteryBadgeMeta(
  stage: MasteryStage,
  lang: "en" | "id" | "ru"
): { label: string; className: string } {
  const pick = (en: string, id: string, ru: string) =>
    lang === "en" ? en : lang === "ru" ? ru : id;
  switch (stage) {
    case "new":
      return {
        label: pick("New", "Baru", "Новое"),
        className: "bg-[#0A84FF]/20 border-[#0A84FF]/40 text-[#70BCFF]",
      };
    case "learning":
      return {
        label: pick("Learning", "Belajar", "Учу"),
        className: "bg-[#FF9F0A]/20 border-[#FF9F0A]/40 text-[#FFD18C]",
      };
    case "solid":
      return {
        label: pick("Solid", "Mantap", "Уверенно"),
        className: "bg-[#30D158]/20 border-[#30D158]/40 text-[#7CF099]",
      };
    case "mastered":
      return {
        label: pick("Mastered", "Mahir", "Освоено"),
        className: "bg-[#5E5CE6]/22 border-[#5E5CE6]/45 text-[#D7D6FF]",
      };
  }
}

function buildDeckByFilter(
  words: WordEntry[],
  todayStr: string,
  filter: DeckFilter,
  shuffle = false
): WordEntry[] {
  let base: WordEntry[] = [];

  if (filter === "due") {
    base = buildSmartFlashcardQueue(words, todayStr, {
      includeStudyAhead: false,
    });
  } else if (filter === "unreviewed") {
    base = buildSmartFlashcardQueue(words, todayStr, {
      includeStudyAhead: true,
    });
  } else {
    // Weakest among cards not yet completed today
    const unreviewed = words.filter((w) => !isReviewedToday(w, todayStr));
    const candidates = unreviewed.filter(
      (w) =>
        (w.wrong_count > 0 && (w.repetitions ?? 0) < WEAKEST_CLEAR_STREAK) ||
        w.correct_count < 2
    );
    base = [...candidates].sort((a, b) => {
      const rateA = a.wrong_count / Math.max(1, a.correct_count + a.wrong_count);
      const rateB = b.wrong_count / Math.max(1, b.correct_count + b.wrong_count);
      if (Math.abs(rateB - rateA) > 0.01) return rateB - rateA;
      if (b.wrong_count !== a.wrong_count) return b.wrong_count - a.wrong_count;
      return a.correct_count - b.correct_count;
    });
  }

  if (shuffle && base.length > 1) {
    for (let i = base.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }
  }

  return base;
}

interface SwipeFlashcardProps {
  word: WordEntry;
  flipped: boolean;
  onToggleFlip: () => void;
  onSwipeAction: (direction: "left" | "right") => void;
}

function SwipeableFlashcard({
  word,
  flipped,
  onToggleFlip,
  onSwipeAction,
}: SwipeFlashcardProps) {
  const { accent } = useLexiVault();
  const { lang, t } = useLanguage();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-9, 0, 9]);
  const rightBadgeOpacity = useTransform(x, [25, 110], [0, 1]);
  const leftBadgeOpacity = useTransform(x, [-110, -25], [1, 0]);
  const isDraggingRef = useRef(false);

  const remoteUrl = accent === "UK" ? word.audio_uk_url : word.audio_us_url;
  const masteryBadge = getMasteryBadgeMeta(getMasteryStage(word), lang);

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 60);

    if (!flipped) return;

    if (info.offset.x > 95 || info.velocity.x > 460) {
      onSwipeAction("right");
    } else if (info.offset.x < -95 || info.velocity.x < -460) {
      onSwipeAction("left");
    }
  };

  const handleCardTap = () => {
    if (isDraggingRef.current) return;
    playGlassClick();
    onToggleFlip();
  };

  return (
    <motion.div
      style={{ x, rotate }}
      drag={flipped ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.75}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      initial={{ opacity: 0, scale: 0.94, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -12, transition: { duration: 0.16 } }}
      transition={IOS_SPRING}
      className={cn(
        "transform-gpu will-change-transform relative w-full touch-pan-y select-none",
        flipped ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      )}
    >
      {/* Swipe Right Indicator ("Solid") — only when flipped */}
      {flipped && (
        <motion.div
          style={{ opacity: rightBadgeOpacity }}
          className="pointer-events-none absolute top-5 left-5 z-30 inline-flex items-center gap-1.5 rounded-full bg-[#30D158]/30 border border-[#30D158]/70 px-3.5 py-1.5 text-xs font-bold text-[#7CF099]"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>{lang === "en" ? "Solid" : "Mantap"}</span>
        </motion.div>
      )}

      {/* Swipe Left Indicator ("Forgot") — only when flipped */}
      {flipped && (
        <motion.div
          style={{ opacity: leftBadgeOpacity }}
          className="pointer-events-none absolute top-5 right-5 z-30 inline-flex items-center gap-1.5 rounded-full bg-[#FF453A]/30 border border-[#FF453A]/70 px-3.5 py-1.5 text-xs font-bold text-[#FFB4AE]"
        >
          <XCircle className="h-4 w-4" />
          <span>{lang === "en" ? "Forgot" : "Lupa"}</span>
        </motion.div>
      )}

      {/* 3D Flip Container */}
      <div className="perspective-1200">
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={IOS_SPRING}
          onClick={handleCardTap}
          className="preserve-3d transform-gpu will-change-transform relative h-[410px] sm:h-[440px] w-full cursor-pointer"
        >
          {/* FRONT FACE */}
          <div className="liquid-glass backface-hidden absolute inset-0 flex flex-col justify-between rounded-[32px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border",
                    masteryBadge.className
                  )}
                >
                  {masteryBadge.label}
                </span>
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-white/[0.08] border border-white/[0.12] text-[#F5F5F7]">
                  {formatTypeLabel(word.type)}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
                    formatRegisterBadgeClass(word.register)
                  )}
                >
                  {word.register}
                </span>
                {word.cefr && (
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-bold border",
                      formatCefrBadgeClass(word.cefr)
                    )}
                  >
                    {word.cefr}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] text-[#8E8E93] bg-white/[0.05]">
                  <Tag className="h-3 w-3" />
                  {formatSourceTagLabel(word.source_tag, lang)}
                </span>
              </div>

              <div
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 shrink-0"
              >
                <AudioButton
                  text={word.term}
                  remoteUrl={remoteUrl}
                  wordId={word.id}
                  size="md"
                />
              </div>
            </div>

            <div className="my-auto py-4 text-center space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#8E8E93]">
                {lang === "en"
                  ? "Recall the meaning & usage?"
                  : "Ingat arti & penggunaannya?"}
              </p>
              <h3 className="text-3xl sm:text-5xl font-bold tracking-tight text-white break-words px-2">
                {word.term}
              </h3>

              <PronunciationText
                term={word.term}
                pronunciation={word.pronunciation}
                ipa={word.ipa}
                showIpa
                align="center"
                size="sm"
                className="px-2"
              />

              {/* Quick US / UK audio pills */}
              <div
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center gap-2 pt-2"
              >
                <AudioButton
                  text={word.term}
                  accentOverride="US"
                  remoteUrl={word.audio_us_url}
                  wordId={word.id}
                  label="US"
                  size="sm"
                />
                <AudioButton
                  text={word.term}
                  accentOverride="UK"
                  remoteUrl={word.audio_uk_url}
                  wordId={word.id}
                  label="UK"
                  size="sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-center text-[11px] text-[#8E8E93] pt-2 border-t border-white/[0.08]">
              <span className="inline-flex items-center gap-1.5 text-[#70BCFF] font-medium">
                <RotateCw className="h-3 w-3" />
                {t.flashcards.tapFlipHint}
              </span>
            </div>
          </div>

          {/* BACK FACE */}
          <div className="liquid-glass-elevated backface-hidden rotate-y-180 absolute inset-0 flex flex-col rounded-[32px] p-5 sm:p-6 overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/[0.09] shrink-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border",
                      masteryBadge.className
                    )}
                  >
                    {masteryBadge.label}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#0A84FF]">
                    {formatTypeLabel(word.type)} · {word.register}
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
                </div>
                <h4 className="text-lg sm:text-xl font-bold text-white truncate">
                  {word.term}
                </h4>
                <PronunciationText
                  term={word.term}
                  pronunciation={word.pronunciation}
                  ipa={word.ipa}
                  size="xs"
                  className="mt-0.5"
                />
              </div>
              <div
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <AudioButton
                  text={word.term}
                  remoteUrl={remoteUrl}
                  wordId={word.id}
                  size="sm"
                />
              </div>
            </div>

            <div className="mt-3.5 space-y-3.5 flex-1">
              {/* Meaning */}
              <div className="rounded-2xl bg-white/[0.05] border border-white/[0.09] p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93] mb-1">
                  {t.flashcards.meaningTitle}
                </p>
                <p className="text-sm sm:text-[15px] leading-relaxed font-medium text-[#F5F5F7]">
                  {getLocalizedMeaning(word, lang)}
                </p>
              </div>

              {/* Example */}
              {word.examples_json?.[0] && (
                <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#70BCFF]">
                      {t.flashcards.exampleTitle}
                    </span>
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <AudioButton
                        text={word.examples_json[0].sentence.replace(/\*\*/g, "")}
                        size="sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm leading-relaxed text-[#F5F5F7]">
                    <HighlightedText text={word.examples_json[0].sentence} />
                  </p>
                  {lang === "id" && word.examples_json[0].translation_id && (
                    <p className="text-[11px] leading-relaxed text-[#8E8E93]">
                      <HighlightedText
                        text={word.examples_json[0].translation_id}
                      />
                    </p>
                  )}
                </div>
              )}

              {/* Common Chunks */}
              {word.chunks && word.chunks.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#70BCFF] opacity-80 mr-0.5">
                    {t.flashcards.chunksLabel}
                  </span>
                  {word.chunks.slice(0, 3).map((chunk, idx) => (
                    <span
                      key={`chunk-${idx}`}
                      className="rounded-full bg-[#0A84FF]/12 border border-[#0A84FF]/28 px-2.5 py-0.5 text-[11px] text-[#70BCFF]"
                    >
                      {chunk}
                    </span>
                  ))}
                </div>
              )}

              {/* Synonyms & Antonyms */}
              {(word.synonyms.length > 0 || word.antonyms.length > 0) && (
                <div className="space-y-2">
                  {word.synonyms.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7CF099] opacity-80 mr-0.5">
                        {t.flashcards.synonymsLabel}
                      </span>
                      {word.synonyms.slice(0, 3).map((syn, idx) => (
                        <span
                          key={`syn-${idx}`}
                          className="rounded-full bg-[#30D158]/12 border border-[#30D158]/30 px-2.5 py-0.5 text-[11px] text-[#A5F2B8]"
                        >
                          ≈ {syn}
                        </span>
                      ))}
                    </div>
                  )}
                  {word.antonyms.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#FFD18C] opacity-80 mr-0.5">
                        {t.flashcards.antonymsLabel}
                      </span>
                      {word.antonyms.slice(0, 2).map((ant, idx) => (
                        <span
                          key={`ant-${idx}`}
                          className="rounded-full bg-[#FF9F0A]/12 border border-[#FF9F0A]/30 px-2.5 py-0.5 text-[11px] text-[#FFD18C]"
                        >
                          ≠ {ant}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Word Family */}
              {word.type !== "idiom" && word.word_families_json.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {word.word_families_json.slice(0, 4).map((wf, idx) => (
                    <span
                      key={`wf-${idx}`}
                      className="rounded-full bg-[#5E5CE6]/18 border border-[#5E5CE6]/30 px-2.5 py-0.5 text-[11px] text-[#D7D6FF]"
                    >
                      {wf.word}{" "}
                      <span className="text-[#A7A5FF]">({wf.pos})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function FlashcardsView() {
  const {
    words,
    studyLogs,
    todayStr,
    isHydrated,
    selectedWord,
    recordSm2Review,
    setActiveTab,
  } = useLexiVault();
  const { lang, t } = useLanguage();

  const [filter, setFilter] = useState<DeckFilter>("due");
  const [extraPracticeMode, setExtraPracticeMode] = useState(false);
  const [deck, setDeck] = useState<WordEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [requeueNotice, setRequeueNotice] = useState(false);
  const [sessionSeed, setSessionSeed] = useState(0);

  const wordsRef = useRef(words);
  wordsRef.current = words;
  const knownWordIdsRef = useRef<Set<string>>(new Set());
  const requeueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const smartDueQueue = useMemo(
    () =>
      isHydrated
        ? buildSmartFlashcardQueue(words, todayStr, { includeStudyAhead: false })
        : [],
    [isHydrated, todayStr, words]
  );

  const allUnreviewedQueue = useMemo(
    () =>
      isHydrated
        ? buildSmartFlashcardQueue(words, todayStr, { includeStudyAhead: true })
        : [],
    [isHydrated, todayStr, words]
  );

  const reviewedTodayWords = useMemo(
    () => words.filter((w) => isReviewedToday(w, todayStr)),
    [todayStr, words]
  );

  const todaySummary = useMemo(() => {
    const todayLog = studyLogs.find((l) => l.study_date === todayStr);
    const reviewedCards = Math.max(
      reviewedTodayWords.length,
      todayLog?.reviews_count ?? 0
    );
    const correct = todayLog?.correct_count ?? 0;
    const wrong = todayLog?.wrong_count ?? 0;
    const total = correct + wrong;
    const accuracy =
      total > 0
        ? Math.round((correct / total) * 100)
        : reviewedTodayWords.length > 0
          ? 100
          : 0;
    const xpToday = todayLog?.xp_earned ?? 0;
    return { reviewedCards, accuracy, xpToday };
  }, [reviewedTodayWords.length, studyLogs, todayStr]);

  const startDeck = useCallback(
    (
      nextFilter: DeckFilter,
      shuffle = false,
      options?: { extraPractice?: boolean; customCards?: WordEntry[] }
    ) => {
      const isExtra = Boolean(options?.extraPractice);
      setExtraPracticeMode(isExtra);

      let built: WordEntry[];
      if (options?.customCards) {
        built = options.customCards;
      } else if (isExtra) {
        const completedToday = wordsRef.current.filter((w) =>
          isReviewedToday(w, todayStr)
        );
        built =
          completedToday.length > 0 ? [...completedToday] : [...wordsRef.current];
        if (shuffle && built.length > 1) {
          for (let i = built.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [built[i], built[j]] = [built[j], built[i]];
          }
        }
      } else {
        built = buildDeckByFilter(wordsRef.current, todayStr, nextFilter, shuffle);
      }

      setDeck(built);
      setCurrentIndex(0);
      setFlipped(false);
      setKnownCount(0);
      setCombo(0);
      setAgainCount(0);
      setRequeueNotice(false);
      setSessionSeed((s) => s + 1);
    },
    [todayStr]
  );

  // Initialize deck on hydration, filter switch, or calendar day rollover
  useEffect(() => {
    if (!isHydrated) return;
    knownWordIdsRef.current = new Set(wordsRef.current.map((w) => w.id));
    startDeck(filter, false, { extraPractice: false });
  }, [isHydrated, filter, todayStr, startDeck]);

  // Live Vault <-> Flashcards sync: dynamically fold in newly added Vault/Daily Pack words
  // and refresh metadata without breaking an in-progress session!
  useEffect(() => {
    if (!isHydrated) return;

    const currentIds = new Set(words.map((w) => w.id));
    const newlyAdded = words.filter(
      (w) =>
        !knownWordIdsRef.current.has(w.id) && !isReviewedToday(w, todayStr)
    );
    knownWordIdsRef.current = currentIds;

    const wordMap = new Map(words.map((w) => [w.id, w]));

    setDeck((prevDeck) => {
      // Remove deleted Vault words and refresh metadata on existing items
      const cleaned = prevDeck
        .filter((card) => wordMap.has(card.id))
        .map((card) => wordMap.get(card.id)!);

      if (extraPracticeMode || newlyAdded.length === 0) {
        return cleaned;
      }

      const existingRemainingIds = new Set(
        cleaned.slice(currentIndex).map((c) => c.id)
      );
      const toInsert = newlyAdded.filter((w) => !existingRemainingIds.has(w.id));
      if (toInsert.length === 0) return cleaned;

      // If user was caught up / deck finished, start immediately with newly added cards!
      if (cleaned.length === 0 || currentIndex >= cleaned.length) {
        setCurrentIndex(0);
        setFlipped(false);
        return [...toInsert];
      }

      // Insert brand-new Vault / Daily Pack cards right after the active card
      const beforeAndCurrent = cleaned.slice(0, currentIndex + 1);
      const afterCurrent = cleaned.slice(currentIndex + 1);
      return [...beforeAndCurrent, ...toInsert, ...afterCurrent];
    });
  }, [words, isHydrated, todayStr, extraPracticeMode, currentIndex]);

  useEffect(() => {
    return () => {
      if (requeueTimerRef.current) clearTimeout(requeueTimerRef.current);
    };
  }, []);

  const currentCard = deck[currentIndex] ?? null;
  const sessionDone = deck.length > 0 && currentIndex >= deck.length;
  const isCaughtUpToday =
    !extraPracticeMode && words.length > 0 && (deck.length === 0 || sessionDone);

  const intervalLabels = useMemo(
    () => (currentCard ? previewSm2IntervalLabels(currentCard, lang) : null),
    [currentCard, lang]
  );

  const handleGradeSm2 = useCallback(
    (rating: Sm2Rating) => {
      if (!currentCard) return;

      const isFail = rating === "again";
      if (isFail) {
        playWrongThud();
        setCombo(0);
        setAgainCount((c) => c + 1);
        setRequeueNotice(true);
        if (requeueTimerRef.current) clearTimeout(requeueTimerRef.current);
        requeueTimerRef.current = setTimeout(() => {
          setRequeueNotice(false);
        }, 2200);

        // Re-queue "Again" card later in this exact session (3 slots ahead or back of deck)
        setDeck((prev) => {
          const next = [...prev];
          const insertAt = Math.min(next.length, currentIndex + 4);
          next.splice(insertAt, 0, currentCard);
          return next;
        });
      } else {
        setCombo((prev) => {
          const next = prev + 1;
          playCorrectChime(next);
          return next;
        });
        setKnownCount((c) => c + 1);
        if (currentIndex + 1 >= deck.length) {
          playRingCompleteChord();
        }
      }

      setFlipped(false);
      setCurrentIndex((idx) => idx + 1);
      void recordSm2Review(currentCard.id, rating);
    },
    [currentCard, currentIndex, deck.length, recordSm2Review]
  );

  const handleSwipeAction = useCallback(
    (direction: "left" | "right") => {
      handleGradeSm2(direction === "right" ? "good" : "again");
    },
    [handleGradeSm2]
  );

  // Desktop keyboard shortcuts: Space = Flip, 1-4 = SM-2 Ratings, Left/Right = Again/Good
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (selectedWord || !currentCard || sessionDone) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        playGlassClick();
        setFlipped((prev) => !prev);
      } else if (e.key === "1") {
        e.preventDefault();
        handleGradeSm2("again");
      } else if (e.key === "2") {
        e.preventDefault();
        handleGradeSm2("hard");
      } else if (e.key === "3") {
        e.preventDefault();
        handleGradeSm2("good");
      } else if (e.key === "4") {
        e.preventDefault();
        handleGradeSm2("easy");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleGradeSm2("again");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleGradeSm2("good");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedWord, currentCard, sessionDone, handleGradeSm2]);

  const progressPct = useMemo(() => {
    if (deck.length === 0) return 0;
    const completed = Math.min(currentIndex, deck.length);
    return Math.round((completed / deck.length) * 100);
  }, [currentIndex, deck.length]);

  const sm2Buttons: Array<{
    rating: Sm2Rating;
    label: string;
    shortcut: string;
    toneClass: string;
    intervalClass: string;
  }> = [
    {
      rating: "again",
      label: t.flashcards.rateAgain,
      shortcut: "1",
      toneClass: "border-[#FF453A]/35 text-[#FFB4AE] hover:bg-[#FF453A]/15",
      intervalClass: "text-[#FF8982]",
    },
    {
      rating: "hard",
      label: t.flashcards.rateHard,
      shortcut: "2",
      toneClass: "border-[#FF9F0A]/35 text-[#FFE0A6] hover:bg-[#FF9F0A]/15",
      intervalClass: "text-[#FFBE5C]",
    },
    {
      rating: "good",
      label: t.flashcards.rateGood,
      shortcut: "3",
      toneClass: "border-[#30D158]/35 text-[#8FF5A7] hover:bg-[#30D158]/15",
      intervalClass: "text-[#7CF099]",
    },
    {
      rating: "easy",
      label: t.flashcards.rateEasy,
      shortcut: "4",
      toneClass: "border-[#0A84FF]/40 text-[#9FD0FF] hover:bg-[#0A84FF]/15",
      intervalClass: "text-[#70BCFF]",
    },
  ];

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Header & Deck Controls */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0A84FF]">
            {t.flashcards.eyebrow}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F7]">
            {t.flashcards.title}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <ComboBadge combo={combo} />
          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            disabled={deck.length < 2 || sessionDone}
            onClick={() => {
              playGlassClick();
              startDeck(filter, true, { extraPractice: extraPracticeMode });
            }}
            title={t.flashcards.shuffleDeck}
            className="liquid-glass-pill inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-[#F5F5F7] hover:bg-white/[0.12] cursor-pointer disabled:opacity-40"
          >
            <Shuffle className="h-3.5 w-3.5 text-[#0A84FF]" />
            <span>{t.flashcards.shuffleDeck}</span>
          </motion.button>
        </div>
      </div>

      {/* Extra Practice Banner when manually reviewing completed cards */}
      {extraPracticeMode && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#5E5CE6]/15 border border-[#5E5CE6]/35 px-4 py-2.5 text-xs">
          <span className="font-semibold text-[#D7D6FF]">
            {t.flashcards.extraPracticeBanner}
          </span>
          <button
            type="button"
            onClick={() => {
              playGlassClick();
              startDeck(filter, false, { extraPractice: false });
            }}
            className="rounded-full bg-white/[0.1] px-3 py-1 text-[11px] font-semibold text-white hover:bg-white/[0.18] cursor-pointer"
          >
            {t.flashcards.exitExtraPractice}
          </button>
        </div>
      )}

      {/* Smart Non-Repeating Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {(
          [
            {
              id: "due",
              label: t.flashcards.filterDue,
              badge: isHydrated ? smartDueQueue.length : null,
            },
            {
              id: "unreviewed",
              label: t.flashcards.filterUnreviewed,
              badge: isHydrated ? allUnreviewedQueue.length : null,
            },
            { id: "weakest", label: t.flashcards.filterWeakest, badge: null },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              playGlassClick();
              setExtraPracticeMode(false);
              setFilter(opt.id);
            }}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors cursor-pointer",
              !extraPracticeMode && filter === opt.id
                ? "bg-[#0A84FF]/25 border-[#0A84FF]/50 text-white"
                : "bg-white/[0.05] border-white/[0.09] text-[#8E8E93] hover:text-[#F5F5F7]"
            )}
          >
            <span>{opt.label}</span>
            {opt.badge !== null && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  opt.badge > 0
                    ? "bg-[#FF9F0A]/25 text-[#FFD18C]"
                    : "bg-[#30D158]/20 text-[#7CF099]"
                )}
              >
                {opt.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Re-queue Notification Pill when user taps "Again" */}
      <AnimatePresence>
        {requeueNotice && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#FF9F0A]/15 border border-[#FF9F0A]/35 px-4 py-2 text-xs font-semibold text-[#FFD18C]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t.flashcards.requeuedToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session Progress Bar (active deck only) */}
      {deck.length > 0 && !sessionDone && (
        <div className="liquid-glass rounded-3xl p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-[#F5F5F7]">
              {`${t.flashcards.cardWordPrefix} ${currentIndex + 1} ${t.flashcards.ofWord} ${deck.length}`}
            </span>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#30D158]/15 border border-[#30D158]/30 px-2.5 py-0.5 font-semibold text-[#7CF099]">
                {knownCount} {t.flashcards.recallCount}
              </span>
              {againCount > 0 && (
                <span className="rounded-full bg-[#FF9F0A]/15 border border-[#FF9F0A]/30 px-2.5 py-0.5 font-semibold text-[#FFD18C]">
                  {againCount} {t.flashcards.repeatCount}
                </span>
              )}
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <motion.div
              className="h-full w-full rounded-full bg-gradient-to-r from-[#0A84FF] via-[#5E5CE6] to-[#30D158] transform-gpu will-change-transform"
              style={{ transformOrigin: "left" }}
              initial={false}
              animate={{
                scaleX: Math.max(0.03, Math.min(1, progressPct / 100)),
              }}
              transition={IOS_SPRING}
            />
          </div>
        </div>
      )}

      {/* Main Card Area / Daily Completion State / Empty Vault */}
      {!isHydrated ? (
        <div className="liquid-glass shimmer-glass h-[410px] rounded-[32px]" />
      ) : words.length === 0 ? (
        <div className="liquid-glass rounded-3xl p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0A84FF]/20 border border-[#0A84FF]/35">
            <BookMarked className="h-7 w-7 text-[#0A84FF]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              {t.flashcards.emptyVaultTitle}
            </h3>
            <p className="mt-1 text-sm text-[#8E8E93]">
              {t.flashcards.emptyVaultBody}
            </p>
          </div>
          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            onClick={() => setActiveTab("vault")}
            className="inline-flex items-center gap-2 rounded-full bg-[#0A84FF] px-5 py-2.5 text-sm font-semibold text-white cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            <span>{t.flashcards.emptyVaultCta}</span>
          </motion.button>
        </div>
      ) : isCaughtUpToday || (extraPracticeMode && sessionDone) ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={IOS_SPRING}
          className="liquid-glass-elevated transform-gpu will-change-transform rounded-3xl p-6 sm:p-8 text-center space-y-5"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#30D158]/20 border border-[#30D158]/40 shadow-[0_0_32px_rgba(48,209,88,0.25)]">
            <Trophy className="h-8 w-8 text-[#30D158]" />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#30D158]">
              {t.flashcards.sessionDoneEyebrow}
            </p>
            <h3 className="text-2xl sm:text-3xl font-bold text-white">
              {t.flashcards.allCaughtUpTitle}
            </h3>
            <p className="text-xs sm:text-sm text-[#8E8E93] max-w-md mx-auto">
              {t.flashcards.allCaughtUpSubtitle}
            </p>
          </div>

          {/* Today's Summary Mini-Bento */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3 space-y-1">
              <Layers className="mx-auto h-4 w-4 text-[#70BCFF]" />
              <p className="text-lg sm:text-xl font-bold text-white tabular-nums">
                {todaySummary.reviewedCards}
              </p>
              <p className="text-[10px] font-medium text-[#8E8E93]">
                {t.flashcards.reviewedTodayStat}
              </p>
            </div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3 space-y-1">
              <Target className="mx-auto h-4 w-4 text-[#7CF099]" />
              <p className="text-lg sm:text-xl font-bold text-white tabular-nums">
                {todaySummary.accuracy}%
              </p>
              <p className="text-[10px] font-medium text-[#8E8E93]">
                {t.flashcards.accuracyTodayStat}
              </p>
            </div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3 space-y-1">
              <Flame className="mx-auto h-4 w-4 text-[#FF9F0A]" />
              <p className="text-lg sm:text-xl font-bold text-white tabular-nums">
                +{todaySummary.xpToday}
              </p>
              <p className="text-[10px] font-medium text-[#8E8E93]">
                {t.flashcards.xpTodayStat}
              </p>
            </div>
          </div>

          {/* Optional Study-Ahead & Explicit Extra Practice CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            {filter === "due" && allUnreviewedQueue.length > 0 && (
              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                onClick={() => {
                  playGlassClick();
                  setExtraPracticeMode(false);
                  setFilter("unreviewed");
                }}
                className="inline-flex items-center gap-2 rounded-full bg-[#0A84FF] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#1A8EFF] cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {t.flashcards.filterUnreviewed} ({allUnreviewedQueue.length})
                </span>
              </motion.button>
            )}

            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => {
                playGlassClick();
                startDeck(filter, true, { extraPractice: true });
              }}
              className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] border border-white/[0.15] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/[0.14] cursor-pointer"
            >
              <RotateCcw className="h-4 w-4 text-[#70BCFF]" />
              <span>{t.flashcards.extraPracticeBtn}</span>
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-3.5">
          <AnimatePresence mode="wait">
            {currentCard && (
              <SwipeableFlashcard
                key={`${sessionSeed}-${currentCard.id}-${currentIndex}`}
                word={currentCard}
                flipped={flipped}
                onToggleFlip={() => setFlipped((prev) => !prev)}
                onSwipeAction={handleSwipeAction}
              />
            )}
          </AnimatePresence>

          {/* Compact Flip Pill */}
          <div className="flex justify-center">
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => {
                playGlassClick();
                setFlipped((prev) => !prev);
              }}
              className="liquid-glass-pill inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold text-[#F5F5F7] hover:bg-white/[0.12] cursor-pointer"
            >
              <RotateCw className="h-3.5 w-3.5 text-[#0A84FF]" />
              <span>
                {flipped ? t.flashcards.closeMeaning : t.flashcards.flipCard}
              </span>
            </motion.button>
          </div>

          {/* 4 SM-2 Spaced Repetition Rating Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
            {sm2Buttons.map((btn) => (
              <motion.button
                key={btn.rating}
                type="button"
                whileTap={TAP_SCALE}
                onClick={() => handleGradeSm2(btn.rating)}
                className={cn(
                  "liquid-glass transform-gpu flex flex-col items-center justify-center rounded-2xl py-3 px-3 transition-colors cursor-pointer",
                  btn.toneClass
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold">{btn.label}</span>
                  <span className="hidden md:inline-flex h-4 min-w-4 items-center justify-center rounded bg-white/[0.08] px-1 text-[10px] font-semibold text-[#8E8E93]">
                    {btn.shortcut}
                  </span>
                </div>
                <span
                  className={cn(
                    "mt-0.5 text-[11px] font-medium tabular-nums",
                    btn.intervalClass
                  )}
                >
                  {intervalLabels ? intervalLabels[btn.rating] : "—"}
                </span>
              </motion.button>
            ))}
          </div>

          <p className="hidden md:block text-center text-[11px] text-[#8E8E93]">
            {t.flashcards.shortcutHint}
          </p>
        </div>
      )}
    </div>
  );
}
