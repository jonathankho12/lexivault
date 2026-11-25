"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { PLACEMENT_TEST_QUESTIONS } from "@/lib/ieltsMockData";
import { savePlacementCompletion } from "@/lib/ieltsStorage";
import {
  bandToCefr,
  gradePlacementParaphraseHeuristic,
  roundToHalfBand,
} from "@/lib/ieltsUtils";
import { IOS_EASE, IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { IeltsAttempt, IeltsProfile } from "@/types/ielts";

export function PlacementTestFlow({
  onFinished,
  onCancel,
  onResultCalculated,
  startImmediately = false,
  finishLabel,
  cancelLabel,
}: {
  onFinished: (profile: IeltsProfile, attempts: IeltsAttempt[]) => void;
  onCancel?: () => void;
  onResultCalculated?: (profile: IeltsProfile, attempts: IeltsAttempt[]) => void;
  startImmediately?: boolean;
  finishLabel?: string;
  cancelLabel?: string;
}) {
  const { user, todayStr, syncExternalStudyLog, applyPlacementLevel } =
    useLexiVault();
  const { lang } = useLanguage();
  const isEn = lang === "en";

  const [started, setStarted] = useState(startImmediately);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [paraphraseText, setParaphraseText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resultSummary, setResultSummary] = useState<{
    band: number;
    cefr: string;
    correctCount: number;
    subBands: { reading: number; listening: number; writing: number };
    paraphraseFeedback: string;
    profile: IeltsProfile;
    attempts: IeltsAttempt[];
  } | null>(null);

  const [audioLoading, setAudioLoading] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioUrlCache = useRef<Map<string, string>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const total = PLACEMENT_TEST_QUESTIONS.length;
  const current = PLACEMENT_TEST_QUESTIONS[index];

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setAudioPlaying(false);
    }
  }, [index]);

  const toggleListeningClip = async () => {
    if (!current?.audioSegments?.length) return;

    if (audioPlaying && audioRef.current) {
      audioRef.current.pause();
      setAudioPlaying(false);
      return;
    }

    let url = audioUrlCache.current.get(current.id);
    if (!url) {
      setAudioLoading(true);
      try {
        const res = await fetch("/api/ielts/audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segments: current.audioSegments }),
        });
        if (res.ok) {
          const blob = await res.blob();
          url = URL.createObjectURL(blob);
          audioUrlCache.current.set(current.id, url);
        }
      } finally {
        setAudioLoading(false);
      }
    }

    if (!url) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setAudioPlaying(false);
    audio.onerror = () => setAudioPlaying(false);
    setAudioPlaying(true);
    await audio.play().catch(() => setAudioPlaying(false));
  };

  const handleFinish = async () => {
    if (!user || submitting) return;
    setSubmitting(true);

    try {
      let vocabCorrect = 0;
      let readingCorrect = 0;
      let listeningCorrect = 0;
      let paraphraseScore = 0;
      let paraphraseFeedback = "";

      for (const q of PLACEMENT_TEST_QUESTIONS) {
        if (q.category === "writing_paraphrase") {
          const evalRes = gradePlacementParaphraseHeuristic(
            q.originalSentence || "",
            paraphraseText,
            q.keywords
          );
          paraphraseScore = evalRes.score;
          paraphraseFeedback = evalRes.feedback;
        } else {
          const picked = answers[q.id];
          const ok = picked === q.correctAnswer;
          if (ok) {
            if (q.category === "vocab_grammar") vocabCorrect += 1;
            if (q.category === "reading") readingCorrect += 1;
            if (q.category === "listening") listeningCorrect += 1;
          }
        }
      }

      const totalPoints =
        vocabCorrect + readingCorrect + listeningCorrect + paraphraseScore;
      const overallBand = roundToHalfBand(2.5 + (totalPoints / 10) * 6.5);

      const readingBand = roundToHalfBand(
        3.0 + ((readingCorrect + vocabCorrect * 0.5) / 5) * 6.0
      );
      const listeningBand = roundToHalfBand(3.0 + (listeningCorrect / 2) * 6.0);
      const writingBand = roundToHalfBand(
        3.0 + ((paraphraseScore * 2 + vocabCorrect * 0.5) / 4) * 6.0
      );

      const saved = await savePlacementCompletion(
        user.id,
        overallBand,
        {
          reading: readingBand,
          listening: listeningBand,
          writing: writingBand,
        },
        {
          totalPoints,
          vocabCorrect,
          readingCorrect,
          listeningCorrect,
          paraphraseScore,
        },
        todayStr
      );

      syncExternalStudyLog(saved.updatedLog, saved.newXp);
      void applyPlacementLevel(saved.profile.cefr_level);
      onResultCalculated?.(saved.profile, saved.attempts);

      setResultSummary({
        band: overallBand,
        cefr: bandToCefr(overallBand),
        correctCount: vocabCorrect + readingCorrect + listeningCorrect,
        subBands: {
          reading: readingBand,
          listening: listeningBand,
          writing: writingBand,
        },
        paraphraseFeedback,
        profile: saved.profile,
        attempts: saved.attempts,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (resultSummary) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: IOS_EASE }}
        className="liquid-glass-elevated rounded-3xl p-6 sm:p-8 text-center space-y-5 max-w-2xl mx-auto"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#30D158]/20 border border-[#30D158]/40">
          <Award className="h-8 w-8 text-[#30D158]" />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#30D158]">
            {isEn ? "Placement Complete" : "Placement Selesai"}
          </p>
          <h3 className="text-2xl sm:text-3xl font-bold text-white">
            {isEn ? "Your Level: " : "Level Kamu: "}
            {resultSummary.cefr} • Band {resultSummary.band.toFixed(1)}
          </h3>
          <p className="text-sm text-[#8E8E93]">
            {isEn
              ? `Objective score ${resultSummary.correctCount}/9 correct`
              : `Skor objektif ${resultSummary.correctCount}/9 benar`}
            {!isEn && resultSummary.paraphraseFeedback
              ? ` · ${resultSummary.paraphraseFeedback}`
              : ""}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
          <div className="rounded-2xl bg-white/[0.05] border border-white/[0.09] p-3">
            <p className="text-[11px] text-[#8E8E93]">Reading</p>
            <p className="text-lg font-bold text-[#70BCFF]">
              {resultSummary.subBands.reading.toFixed(1)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/[0.05] border border-white/[0.09] p-3">
            <p className="text-[11px] text-[#8E8E93]">Listening</p>
            <p className="text-lg font-bold text-[#A7A5FF]">
              {resultSummary.subBands.listening.toFixed(1)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/[0.05] border border-white/[0.09] p-3">
            <p className="text-[11px] text-[#8E8E93]">Writing</p>
            <p className="text-lg font-bold text-[#7CF099]">
              {resultSummary.subBands.writing.toFixed(1)}
            </p>
          </div>
        </div>

        <motion.button
          type="button"
          whileTap={TAP_SCALE}
          onClick={() =>
            onFinished(resultSummary.profile, resultSummary.attempts)
          }
          className="inline-flex items-center gap-2 rounded-full bg-[#0A84FF] px-6 py-3 text-sm font-semibold text-white cursor-pointer"
        >
          <span>
            {finishLabel ??
              (isEn
                ? "Open Full IELTS Dashboard"
                : "Buka Dashboard IELTS Lengkap")}
          </span>
          <ArrowRight className="h-4 w-4" />
        </motion.button>
      </motion.div>
    );
  }

  if (!started) {
    return (
      <div className="liquid-glass rounded-3xl p-6 sm:p-8 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF]/20 border border-[#0A84FF]/35 px-3 py-1 text-[11px] font-semibold text-[#70BCFF]">
              <Sparkles className="h-3.5 w-3.5" />
              {isEn
                ? "3–5 Minutes · 10 Adaptive Questions (A2–C2)"
                : "3–5 Menit · 10 Soal Lintas Level (A2–C2)"}
            </span>
            <h3 className="text-2xl font-bold text-white">
              Quick Placement Test
            </h3>
            <p className="text-sm text-[#8E8E93] leading-relaxed">
              {isEn
                ? "Estimate your starting IELTS Band and CEFR level (A1–C2) through 4 vocabulary/grammar nuance items, 3 short academic reading inferences, 2 British/Australian listening clips, and 1 formal paraphrase task."
                : "Ukur estimasi Band IELTS dan level CEFR awalmu (A1–C2) lewat 4 soal nuansa Vocab/Grammar, 3 soal Short Reading inference, 2 klip audio Listening aksen British/Australian, dan 1 parafrase Writing akademik."}
            </p>
          </div>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full bg-white/[0.07] p-2 text-[#8E8E93] hover:text-white cursor-pointer"
              aria-label={isEn ? "Close placement test" : "Tutup placement test"}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            onClick={() => setStarted(true)}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] px-6 py-3 text-sm font-semibold text-white cursor-pointer"
          >
            <span>
              {isEn
                ? "Start Placement Test Now"
                : "Mulai Placement Test Sekarang"}
            </span>
            <ArrowRight className="h-4 w-4" />
          </motion.button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full bg-white/[0.07] border border-white/[0.1] px-4 py-2.5 text-xs font-medium text-[#D1D1D6] hover:text-white cursor-pointer"
            >
              {isEn ? "Skip to Modules" : "Lewati & Masuk ke Modul"}
            </button>
          )}
        </div>
      </div>
    );
  }

  const isLast = index === total - 1;
  const canProceed =
    current.category === "writing_paraphrase"
      ? paraphraseText.trim().length > 0
      : Boolean(answers[current.id]);

  return (
    <div className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-5 max-w-2xl mx-auto">
      {/* Progress */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-white">
            {isEn
              ? `Question ${index + 1} of ${total}`
              : `Soal ${index + 1} dari ${total}`}
          </span>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#5E5CE6]/20 border border-[#5E5CE6]/35 px-2.5 py-0.5 text-[11px] font-semibold text-[#C4C2FF]">
              Target {current.cefrTarget}
            </span>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-[#8E8E93] hover:text-white cursor-pointer"
              >
                {cancelLabel ?? (isEn ? "Exit" : "Keluar")}
              </button>
            )}
          </div>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <motion.div
            animate={{ width: `${Math.round(((index + 1) / total) * 100)}%` }}
            transition={IOS_SPRING}
            className="h-full rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6]"
          />
        </div>
      </div>

      {/* Optional Mini Passage */}
      {current.passage && (
        <div className="rounded-2xl bg-white/[0.04] border border-white/[0.09] p-4 text-xs sm:text-sm leading-relaxed text-[#E5E5EA]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#70BCFF] mb-1.5">
            Short Academic Passage
          </p>
          {current.passage}
        </div>
      )}

      {/* Optional Listening Audio Clip */}
      {current.audioSegments && (
        <div className="rounded-2xl bg-[#0A84FF]/10 border border-[#0A84FF]/25 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Volume2 className="h-4.5 w-4.5 text-[#70BCFF]" />
            <div>
              <p className="text-xs font-semibold text-white">
                {isEn
                  ? `Placement Audio Clip (${current.audioSegments[0]?.speaker})`
                  : `Audio Klip Placement (${current.audioSegments[0]?.speaker})`}
              </p>
              <p className="text-[11px] text-[#8E8E93]">
                {isEn
                  ? "Click Play to hear the neural dialogue clip"
                  : "Klik play untuk mendengarkan percakapan neural"}
              </p>
            </div>
          </div>

          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            onClick={() => void toggleListeningClip()}
            disabled={audioLoading}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
          >
            {audioLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : audioPlaying ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            <span>
              {audioPlaying
                ? isEn
                  ? "Pause"
                  : "Jeda"
                : isEn
                  ? "Play Clip"
                  : "Putar Klip"}
            </span>
          </motion.button>
        </div>
      )}

      {/* Question Prompt */}
      <div className="space-y-3">
        <h4 className="text-base sm:text-lg font-semibold text-white leading-snug">
          {current.prompt}
        </h4>

        {current.category === "writing_paraphrase" ? (
          <div className="space-y-3">
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.09] p-3.5 text-sm italic text-[#D1D1D6]">
              &ldquo;{current.originalSentence}&rdquo;
            </div>
            <textarea
              rows={3}
              value={paraphraseText}
              onChange={(e) => setParaphraseText(e.target.value)}
              placeholder={
                isEn
                  ? "Rewrite in formal IELTS C1/C2 academic style..."
                  : "Tulis ulang dalam gaya formal IELTS C1/C2..."
              }
              className="w-full rounded-2xl bg-white/[0.05] border border-white/[0.12] p-3.5 text-base text-[#F5F5F7] placeholder:text-[#8E8E93] focus:outline-none focus:border-[#0A84FF]/60"
            />
          </div>
        ) : (
          <div className="space-y-2">
            {(current.options ?? []).map((opt) => {
              const selected = answers[current.id] === opt;
              return (
                <motion.button
                  key={opt}
                  type="button"
                  whileTap={TAP_SCALE}
                  onClick={() =>
                    setAnswers((prev) => ({ ...prev, [current.id]: opt }))
                  }
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors cursor-pointer",
                    selected
                      ? "bg-[#0A84FF]/22 border-[#0A84FF]/60 text-white"
                      : "bg-white/[0.04] border-white/[0.1] text-[#D1D1D6] hover:bg-white/[0.08]"
                  )}
                >
                  <span>{opt}</span>
                  {selected && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0A84FF]" />
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Nav */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="rounded-full bg-white/[0.07] px-4 py-2 text-xs font-medium text-[#D1D1D6] disabled:opacity-35 cursor-pointer"
        >
          {isEn ? "Previous" : "Sebelumnya"}
        </button>

        {isLast ? (
          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            disabled={!canProceed || submitting}
            onClick={() => void handleFinish()}
            className="inline-flex items-center gap-2 rounded-full bg-[#30D158] px-5 py-2.5 text-xs sm:text-sm font-semibold text-black cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {isEn ? "Calculating Level..." : "Menghitung Level..."}
                </span>
              </>
            ) : (
              <>
                <span>
                  {isEn ? "Finish & View Level" : "Selesai & Lihat Level"}
                </span>
                <CheckCircle2 className="h-4 w-4" />
              </>
            )}
          </motion.button>
        ) : (
          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            disabled={!canProceed}
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white cursor-pointer disabled:opacity-45"
          >
            <span>{isEn ? "Next" : "Lanjut"}</span>
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        )}
      </div>
    </div>
  );
}
