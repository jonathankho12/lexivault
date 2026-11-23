"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Headphones,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCw,
  Sparkles,
  Volume2,
  XCircle,
} from "lucide-react";
import { ComboBadge } from "@/components/gamification/ComboBadge";
import { AudioButton } from "@/components/ui/AudioButton";
import { HighlightedText } from "@/components/ui/HighlightedText";
import { PronunciationText } from "@/components/ui/PronunciationText";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { COMMUTE_MINI_CLIPS } from "@/lib/ieltsMockData";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { getDueWords, previewSm2IntervalLabels } from "@/lib/sm2";
import {
  playCorrectChime,
  playGlassClick,
  playWrongThud,
} from "@/lib/soundEffects";
import { recordIeltsStudyLog } from "@/lib/storage";
import {
  cn,
  formatRegisterBadgeClass,
  formatSourceTagLabel,
  formatTypeLabel,
  getLocalizedMeaning,
} from "@/lib/utils";
import type { Sm2Rating, WordEntry } from "@/types/lexivault";

interface CommuteModeFlowProps {
  onExit: () => void;
}

type CommuteStage = "flashcards" | "listening" | "done";

function buildCommuteCards(words: WordEntry[], todayStr: string): WordEntry[] {
  if (words.length === 0) return [];
  const due = getDueWords(words, Date.now(), todayStr);
  const dueIds = new Set(due.map((w) => w.id));
  const rest = words.filter((w) => !dueIds.has(w.id));
  return [...due, ...rest].slice(0, 5);
}

export function CommuteModeFlow({ onExit }: CommuteModeFlowProps) {
  const {
    user,
    todayStr,
    words,
    accent,
    isHydrated,
    recordSm2Review,
    grantXpAndSyncLog,
  } = useLexiVault();
  const { lang, t } = useLanguage();

  const [stage, setStage] = useState<CommuteStage>("flashcards");
  const [cards, setCards] = useState<WordEntry[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [cardRecalled, setCardRecalled] = useState(0);
  const [combo, setCombo] = useState(0);
  const [sessionSeed, setSessionSeed] = useState(0);

  // Listening phase state
  const [clipIndex, setClipIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [audioLoading, setAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioStatusNote, setAudioStatusNote] = useState<string | null>(null);
  const [submittingFinish, setSubmittingFinish] = useState(false);
  const [listeningScore, setListeningScore] = useState(0);

  const initializedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlsRef = useRef<Map<string, string>>(new Map());
  const speechActiveRef = useRef(false);

  const activeClip = COMMUTE_MINI_CLIPS[clipIndex % COMMUTE_MINI_CLIPS.length];

  // Freeze up to 5 due flashcards on mount/hydration
  useEffect(() => {
    if (!isHydrated || initializedRef.current) return;
    initializedRef.current = true;
    const picked = buildCommuteCards(words, todayStr);
    setCards(picked);
    if (picked.length === 0) {
      setStage("listening");
    }
  }, [isHydrated, todayStr, words]);

  const stopAllAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    speechActiveRef.current = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore cleanup errors
      }
    }
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    const cacheMap = blobUrlsRef.current;
    return () => {
      stopAllAudio();
      cacheMap.forEach((url) => URL.revokeObjectURL(url));
      cacheMap.clear();
    };
  }, [stopAllAudio]);

  const currentCard = cards[cardIndex] ?? null;

  const intervalLabels = useMemo(
    () => (currentCard ? previewSm2IntervalLabels(currentCard, lang) : null),
    [currentCard, lang]
  );

  const handleGradeCard = useCallback(
    (rating: Sm2Rating) => {
      if (!currentCard) return;

      if (rating === "again") {
        playWrongThud();
        setCombo(0);
      } else {
        setCardRecalled((c) => c + 1);
        setCombo((prev) => {
          const next = prev + 1;
          playCorrectChime(next);
          return next;
        });
      }

      void recordSm2Review(currentCard.id, rating);
      setFlipped(false);

      if (cardIndex + 1 >= cards.length) {
        setStage("listening");
      } else {
        setCardIndex((prev) => prev + 1);
      }
    },
    [currentCard, cardIndex, cards.length, recordSm2Review]
  );

  const playSpeechFallback = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setAudioStatusNote(
        lang === "en"
          ? "Browser speech audio is unavailable."
          : "Audio browser tidak tersedia."
      );
      setIsPlaying(false);
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }

    speechActiveRef.current = true;
    setIsPlaying(true);
    setAudioStatusNote(t.commute.deviceSpeechActive);

    const speakSegment = (idx: number) => {
      if (!speechActiveRef.current || idx >= activeClip.segments.length) {
        speechActiveRef.current = false;
        setIsPlaying(false);
        return;
      }

      const seg = activeClip.segments[idx];
      const utter = new SpeechSynthesisUtterance(seg.text);
      utter.lang = seg.accent.startsWith("GB")
        ? "en-GB"
        : seg.accent.startsWith("AU")
          ? "en-AU"
          : "en-US";
      utter.rate = 0.98;
      utter.onend = () => {
        speakSegment(idx + 1);
      };
      utter.onerror = () => {
        speechActiveRef.current = false;
        setIsPlaying(false);
      };
      window.speechSynthesis.speak(utter);
    };

    speakSegment(0);
  }, [activeClip, lang, t.commute.deviceSpeechActive]);

  const togglePlayClip = async () => {
    playGlassClick();
    if (audioLoading) return;

    if (isPlaying) {
      stopAllAudio();
      return;
    }

    setAudioStatusNote(null);
    let blobUrl = blobUrlsRef.current.get(activeClip.id);

    if (!blobUrl) {
      setAudioLoading(true);
      try {
        const res = await fetch("/api/ielts/audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segments: activeClip.segments }),
        });
        if (!res.ok) throw new Error("Audio API unavailable");
        const blob = await res.blob();
        blobUrl = URL.createObjectURL(blob);
        blobUrlsRef.current.set(activeClip.id, blobUrl);
      } catch {
        setAudioLoading(false);
        playSpeechFallback();
        return;
      }
      setAudioLoading(false);
    }

    const audio = new Audio(blobUrl);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => {
      audioRef.current = null;
      playSpeechFallback();
    };
    audioRef.current = audio;

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      audioRef.current = null;
      playSpeechFallback();
    }
  };

  const handleSelectMcq = (questionId: string, option: string) => {
    playGlassClick();
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const allMcqAnswered = activeClip.questions.every(
    (q) => Boolean(selectedAnswers[q.id])
  );

  const handleCompleteCommute = async () => {
    if (!allMcqAnswered || submittingFinish) return;
    setSubmittingFinish(true);
    stopAllAudio();

    const correctTotal = activeClip.questions.filter(
      (q) => selectedAnswers[q.id] === q.answer
    ).length;

    setListeningScore(correctTotal);
    if (correctTotal === activeClip.questions.length) {
      playCorrectChime(Math.max(2, combo + 1));
    } else if (correctTotal > 0) {
      playCorrectChime(1);
    } else {
      playWrongThud();
    }

    if (user) {
      try {
        const updatedLog = await recordIeltsStudyLog(
          todayStr,
          user.id,
          activeClip.questions.length,
          correctTotal,
          1,
          45
        );
        await grantXpAndSyncLog(45, updatedLog);
      } catch {
        // Allow screen completion smoothly even on transient network errors
      }
    }

    setSubmittingFinish(false);
    setStage("done");
  };

  const handleRestartCommute = () => {
    playGlassClick();
    stopAllAudio();
    const freshCards = buildCommuteCards(words, todayStr);
    setCards(freshCards);
    setCardIndex(0);
    setFlipped(false);
    setCardRecalled(0);
    setCombo(0);
    setSelectedAnswers({});
    setListeningScore(0);
    setAudioStatusNote(null);
    setClipIndex((prev) => (prev + 1) % COMMUTE_MINI_CLIPS.length);
    setSessionSeed((s) => s + 1);
    setStage(freshCards.length > 0 ? "flashcards" : "listening");
  };

  const sm2Buttons: Array<{
    rating: Sm2Rating;
    label: string;
    toneClass: string;
    intervalClass: string;
  }> = [
    {
      rating: "again",
      label: "Again",
      toneClass: "border-[#FF453A]/35 text-[#FFB4AE] hover:bg-[#FF453A]/15",
      intervalClass: "text-[#FF8982]",
    },
    {
      rating: "hard",
      label: "Hard",
      toneClass: "border-[#FF9F0A]/35 text-[#FFE0A6] hover:bg-[#FF9F0A]/15",
      intervalClass: "text-[#FFBE5C]",
    },
    {
      rating: "good",
      label: "Good",
      toneClass: "border-[#30D158]/35 text-[#8FF5A7] hover:bg-[#30D158]/15",
      intervalClass: "text-[#7CF099]",
    },
    {
      rating: "easy",
      label: "Easy",
      toneClass: "border-[#0A84FF]/40 text-[#9FD0FF] hover:bg-[#0A84FF]/15",
      intervalClass: "text-[#70BCFF]",
    },
  ];

  const totalProgressPct =
    stage === "flashcards" && cards.length > 0
      ? Math.round((cardIndex / (cards.length + 1)) * 100)
      : stage === "listening"
        ? 85
        : 100;

  return (
    <div className="space-y-4 max-w-xl mx-auto pb-[env(safe-area-inset-bottom)]">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            playGlassClick();
            stopAllAudio();
            onExit();
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] px-3.5 py-1.5 text-xs font-medium text-[#F5F5F7] hover:bg-white/[0.12] cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t.commute.exit}</span>
        </button>

        <div className="flex items-center gap-2">
          <ComboBadge combo={combo} />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#30D158]/18 border border-[#30D158]/35 px-3 py-1 text-xs font-semibold text-[#7CF099]">
            <Clock className="h-3.5 w-3.5" />
            <span>{t.commute.badge}</span>
          </span>
        </div>
      </div>

      {/* Slim Stage Progress */}
      <div className="liquid-glass rounded-2xl px-4 py-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#F5F5F7]">
            {stage === "flashcards" && cards.length > 0
              ? `${t.commute.stageFlashcardsPrefix} ${cardIndex + 1} / ${cards.length}`
              : stage === "listening"
                ? t.commute.stageListening
                : t.commute.stageDone}
          </span>
          <span className="font-bold text-[#70BCFF] tabular-nums">
            {totalProgressPct}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <motion.div
            className="h-full w-full rounded-full bg-gradient-to-r from-[#30D158] to-[#0A84FF] transform-gpu will-change-transform"
            style={{ transformOrigin: "left" }}
            initial={false}
            animate={{
              scaleX: Math.max(0, Math.min(1, totalProgressPct / 100)),
            }}
            transition={IOS_SPRING}
          />
        </div>
      </div>

      {/* STAGE 1: 5 Due Flashcards (One-handed thumb zone) */}
      {stage === "flashcards" && currentCard && (
        <div className="space-y-3.5">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${sessionSeed}-commute-${currentCard.id}-${cardIndex}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, transition: { duration: 0.14 } }}
              transition={IOS_SPRING}
              className="perspective-1200 transform-gpu will-change-transform"
            >
              <motion.div
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={IOS_SPRING}
                onClick={() => {
                  playGlassClick();
                  setFlipped((prev) => !prev);
                }}
                className="preserve-3d transform-gpu will-change-transform relative h-[320px] sm:h-[340px] w-full cursor-pointer"
              >
                {/* FRONT */}
                <div className="liquid-glass backface-hidden absolute inset-0 flex flex-col justify-between rounded-[28px] p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase bg-white/[0.08] border border-white/[0.12] text-[#F5F5F7]">
                        {formatTypeLabel(currentCard.type)}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
                          formatRegisterBadgeClass(currentCard.register)
                        )}
                      >
                        {currentCard.register}
                      </span>
                    </div>
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <AudioButton
                        text={currentCard.term}
                        remoteUrl={
                          accent === "UK"
                            ? currentCard.audio_uk_url
                            : currentCard.audio_us_url
                        }
                        wordId={currentCard.id}
                        size="sm"
                      />
                    </div>
                  </div>

                  <div className="text-center space-y-2 px-2">
                    <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-white break-words">
                      {currentCard.term}
                    </h3>
                    <PronunciationText
                      term={currentCard.term}
                      pronunciation={currentCard.pronunciation}
                      ipa={currentCard.ipa}
                      showIpa
                      align="center"
                      size="sm"
                    />
                    <p className="text-xs text-[#8E8E93]">
                      {t.commute.sourceLabel}{" "}
                      {formatSourceTagLabel(currentCard.source_tag, lang)} ·{" "}
                      {t.commute.accentLabel} {accent}
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 text-xs text-[#8E8E93]">
                    <RotateCw className="h-3.5 w-3.5 text-[#0A84FF]" />
                    <span>{t.commute.tapToFlip}</span>
                  </div>
                </div>

                {/* BACK */}
                <div className="liquid-glass backface-hidden rotate-y-180 absolute inset-0 flex flex-col justify-between rounded-[28px] p-5 overflow-y-auto no-scrollbar">
                  <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
                    <h4 className="text-lg font-bold text-white truncate">
                      {currentCard.term}
                    </h4>
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <AudioButton
                        text={currentCard.term}
                        remoteUrl={
                          accent === "UK"
                            ? currentCard.audio_uk_url
                            : currentCard.audio_us_url
                        }
                        wordId={currentCard.id}
                        size="sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 my-auto py-2">
                    <div className="rounded-2xl bg-white/[0.05] border border-white/[0.09] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93] mb-0.5">
                        {t.flashcards.meaningTitle}
                      </p>
                      <p className="text-sm font-medium text-[#F5F5F7] leading-relaxed">
                        {getLocalizedMeaning(currentCard, lang)}
                      </p>
                    </div>

                    {currentCard.examples_json?.[0] && (
                      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#70BCFF] mb-1">
                          {t.flashcards.exampleTitle}
                        </p>
                        <p className="text-xs leading-relaxed text-[#F5F5F7]">
                          <HighlightedText
                            text={currentCard.examples_json[0].sentence}
                          />
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="text-center text-[11px] text-[#8E8E93]">
                    {t.commute.pickSm2Below}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* Thumb-zone Action Controls */}
          <div className="space-y-2.5 pt-1">
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => {
                playGlassClick();
                setFlipped((prev) => !prev);
              }}
              className="liquid-glass-pill w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-semibold text-[#F5F5F7] hover:bg-white/[0.1] cursor-pointer"
            >
              <RotateCw className="h-3.5 w-3.5 text-[#0A84FF]" />
              <span>{flipped ? t.commute.flipBack : t.commute.flipCard}</span>
            </motion.button>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {sm2Buttons.map((btn) => (
                <motion.button
                  key={btn.rating}
                  type="button"
                  whileTap={TAP_SCALE}
                  onClick={() => handleGradeCard(btn.rating)}
                  className={cn(
                    "liquid-glass transform-gpu flex flex-col items-center justify-center min-h-[54px] rounded-2xl px-3 py-2.5 cursor-pointer transition-colors",
                    btn.toneClass
                  )}
                >
                  <span className="text-sm font-bold">{btn.label}</span>
                  <span
                    className={cn(
                      "text-[11px] font-medium tabular-nums",
                      btn.intervalClass
                    )}
                  >
                    {intervalLabels ? intervalLabels[btn.rating] : "—"}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STAGE 2: 1 Mini Listening Clip + 2 Tap-only MCQs */}
      {stage === "listening" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={IOS_SPRING}
          className="space-y-4 transform-gpu will-change-transform"
        >
          {/* Audio Player Card */}
          <div className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#BF5AF2]">
                  {t.commute.clipLabel} · {activeClip.accentsLabel}
                </p>
                <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                  {activeClip.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  playGlassClick();
                  stopAllAudio();
                  setSelectedAnswers({});
                  setAudioStatusNote(null);
                  setClipIndex((prev) => (prev + 1) % COMMUTE_MINI_CLIPS.length);
                }}
                className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/[0.1] px-2.5 py-1 text-[11px] text-[#D1D1D6] hover:bg-white/[0.12] cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                <span>{t.commute.switchClip}</span>
              </button>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-white/[0.05] border border-white/[0.09] p-3">
              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                disabled={audioLoading}
                onClick={() => void togglePlayClip()}
                aria-label={isPlaying ? "Pause clip" : "Play clip"}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] text-white shadow-[0_6px_18px_rgba(10,132,255,0.35)] cursor-pointer disabled:opacity-60"
              >
                {audioLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-5 w-5 fill-current" />
                ) : (
                  <Play className="h-5 w-5 fill-current ml-0.5" />
                )}
              </motion.button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Headphones className="h-3.5 w-3.5 text-[#70BCFF]" />
                  <span>
                    {audioLoading
                      ? t.commute.audioLoading
                      : isPlaying
                        ? t.commute.audioPlaying
                        : t.commute.audioTapPlay}
                  </span>
                </div>
                <p className="text-[11px] text-[#8E8E93] mt-0.5 truncate">
                  {audioStatusNote ??
                    `${activeClip.segments.length} ${t.commute.segmentsHint}`}
                </p>
              </div>
            </div>
          </div>

          {/* 2 Tap-Only MCQ Questions */}
          <div className="space-y-3">
            {activeClip.questions.map((q, qIdx) => {
              const picked = selectedAnswers[q.id];
              return (
                <div
                  key={q.id}
                  className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-3"
                >
                  <p className="text-xs sm:text-sm font-semibold text-white leading-snug">
                    <span className="text-[#70BCFF] mr-1.5">Q{qIdx + 1}.</span>
                    {q.prompt}
                  </p>

                  <div className="grid grid-cols-1 gap-2">
                    {q.options.map((option) => {
                      const active = picked === option;
                      return (
                        <motion.button
                          key={option}
                          type="button"
                          whileTap={TAP_SCALE}
                          onClick={() => handleSelectMcq(q.id, option)}
                          className={cn(
                            "w-full min-h-[46px] rounded-2xl border px-3.5 py-2.5 text-left text-xs sm:text-sm font-medium transition-colors cursor-pointer",
                            active
                              ? "bg-[#0A84FF]/22 border-[#0A84FF]/60 text-white"
                              : "bg-white/[0.04] border-white/[0.09] text-[#D1D1D6] hover:bg-white/[0.08]"
                          )}
                        >
                          {option}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Thumb-zone CTA */}
          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            disabled={!allMcqAnswered || submittingFinish}
            onClick={() => void handleCompleteCommute()}
            className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#30D158] to-[#0A84FF] px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_28px_rgba(10,132,255,0.3)] cursor-pointer disabled:opacity-45"
          >
            {submittingFinish ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span>{t.commute.finishClaimBtn}</span>
          </motion.button>
        </motion.div>
      )}

      {/* STAGE 3: Summary */}
      {stage === "done" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={IOS_SPRING}
          className="liquid-glass-elevated transform-gpu will-change-transform rounded-3xl p-6 space-y-5 text-center"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#30D158]/20 border border-[#30D158]/40">
            <CheckCircle2 className="h-8 w-8 text-[#30D158]" />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#30D158]">
              {t.commute.completedEyebrow}
            </p>
            <h3 className="mt-1 text-2xl font-bold text-white">
              {t.commute.completedTitle}
            </h3>
            <p className="mt-1 text-sm text-[#8E8E93]">
              {cards.length > 0
                ? `${cardRecalled}/${cards.length} ${t.commute.flashcardLabel} · `
                : ""}
              {listeningScore}/{activeClip.questions.length}{" "}
              {t.commute.listeningCorrectLabel}
            </p>
          </div>

          {/* Quick Answer Check */}
          <div className="space-y-2 text-left">
            {activeClip.questions.map((q, idx) => {
              const userAns = selectedAnswers[q.id];
              const isOk = userAns === q.answer;
              return (
                <div
                  key={q.id}
                  className={cn(
                    "rounded-2xl border p-3 text-xs space-y-1",
                    isOk
                      ? "bg-[#30D158]/10 border-[#30D158]/30"
                      : "bg-[#FF453A]/10 border-[#FF453A]/30"
                  )}
                >
                  <div className="flex items-start gap-2 font-semibold text-white">
                    {isOk ? (
                      <CheckCircle2 className="h-4 w-4 text-[#30D158] shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-[#FF453A] shrink-0 mt-0.5" />
                    )}
                    <span>
                      Q{idx + 1}: {q.prompt}
                    </span>
                  </div>
                  <p className="pl-6 text-[#D1D1D6]">
                    {t.commute.correctAnswerLabel}{" "}
                    <span className="font-semibold text-[#7CF099]">
                      {q.answer}
                    </span>
                    {!isOk && userAns
                      ? ` (${t.commute.yourChoiceLabel} ${userAns})`
                      : ""}
                  </p>
                </div>
              );
            })}

            {/* Dialogue transcript snippet */}
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3 space-y-1.5">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#70BCFF]">
                <Volume2 className="h-3.5 w-3.5" />
                <span>{t.commute.transcriptTitle}</span>
              </p>
              {activeClip.segments.map((seg, idx) => (
                <p key={idx} className="text-xs text-[#D1D1D6] leading-relaxed">
                  <span className="font-semibold text-white">
                    {seg.speaker}:{" "}
                  </span>
                  {seg.text}
                </p>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={handleRestartCommute}
              className="inline-flex items-center gap-2 rounded-full bg-white/[0.1] border border-white/[0.15] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              <span>{t.commute.nextClipBtn}</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={onExit}
              className="inline-flex items-center gap-2 rounded-full bg-[#0A84FF] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white cursor-pointer"
            >
              <span>{t.commute.backPracticeBtn}</span>
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
