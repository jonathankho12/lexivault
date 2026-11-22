"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Headphones,
  Loader2,
  Lock,
  Pause,
  Play,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useLexiVault } from "@/context/LexiVaultContext";
import { FALLBACK_LISTENING_PACKS } from "@/lib/ieltsMockData";
import { saveSkillAttempt } from "@/lib/ieltsStorage";
import {
  accuracyToIeltsBand,
  normalizeShortAnswer,
} from "@/lib/ieltsUtils";
import { TAP_SCALE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type {
  IeltsAttempt,
  IeltsProfile,
  ListeningQuestion,
  ListeningSectionPack,
} from "@/types/ielts";

function formatAudioTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function isListeningCorrect(q: ListeningQuestion, userAns: string): boolean {
  const norm = normalizeShortAnswer(userAns);
  if (!norm) return false;
  if (q.type === "form_completion") {
    const accepted = [q.answer, ...(q.acceptedAnswers ?? [])].map(
      normalizeShortAnswer
    );
    return accepted.includes(norm);
  }
  return norm === normalizeShortAnswer(q.answer);
}

export function IeltsListeningPanel({
  onProfileUpdated,
}: {
  onProfileUpdated: (profile: IeltsProfile, attempts: IeltsAttempt[]) => void;
}) {
  const { user, todayStr, syncExternalStudyLog } = useLexiVault();

  const [pack, setPack] = useState<ListeningSectionPack>(
    FALLBACK_LISTENING_PACKS[0]
  );
  const [seenIds, setSeenIds] = useState<string[]>([
    FALLBACK_LISTENING_PACKS[0].id,
  ]);
  const [generating, setGenerating] = useState(false);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [resultBand, setResultBand] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);

  // Audio player state
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<0.85 | 1 | 1.15>(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlCacheRef = useRef<Map<string, string>>(new Map());

  const teardownAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.ontimeupdate = null;
      audioRef.current.onloadedmetadata = null;
      audioRef.current.onended = null;
      audioRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  useEffect(() => {
    return () => {
      teardownAudio();
    };
  }, [teardownAudio]);

  const ensureAudioLoaded = async (): Promise<HTMLAudioElement | null> => {
    if (audioRef.current) {
      return audioRef.current;
    }

    let blobUrl = urlCacheRef.current.get(pack.id);
    if (!blobUrl) {
      setAudioLoading(true);
      setAudioError(null);
      try {
        const res = await fetch("/api/ielts/audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segments: pack.segments }),
        });
        if (!res.ok) throw new Error("Audio synthesis failed");
        const blob = await res.blob();
        blobUrl = URL.createObjectURL(blob);
        urlCacheRef.current.set(pack.id, blobUrl);
      } catch {
        setAudioError("Gagal memuat audio percakapan. Coba klik Play lagi.");
        return null;
      } finally {
        setAudioLoading(false);
      }
    }

    const audio = new Audio(blobUrl);
    audio.playbackRate = speed;
    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 0);
    };
    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };
    audio.onended = () => {
      setIsPlaying(false);
    };
    audio.onerror = () => {
      setIsPlaying(false);
      setAudioError("Gagal memutar berkas audio.");
    };
    audioRef.current = audio;
    return audio;
  };

  const togglePlay = async () => {
    if (audioLoading) return;
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    const audio = await ensureAudioLoaded();
    if (!audio) return;
    audio.playbackRate = speed;
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const handleSpeedChange = (nextSpeed: 0.85 | 1 | 1.15) => {
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleScrub = (nextSec: number) => {
    setCurrentTime(nextSec);
    if (audioRef.current) {
      audioRef.current.currentTime = nextSec;
    }
  };

  const handleGenerateNew = async () => {
    if (generating) return;
    setGenerating(true);
    teardownAudio();
    try {
      const res = await fetch("/api/ielts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill: "listening",
          excludeIds: seenIds,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { pack: ListeningSectionPack };
        if (json.pack) {
          setPack(json.pack);
          setSeenIds((prev) => [...prev, json.pack.id]);
          setAnswers({});
          setSubmitted(false);
          setResultBand(null);
          setShowTranscript(false);
          setAudioError(null);
        }
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (submitted) return;
    let hits = 0;
    for (const q of pack.questions) {
      if (isListeningCorrect(q, answers[q.id] ?? "")) {
        hits += 1;
      }
    }

    const band = accuracyToIeltsBand(hits, pack.questions.length);
    setCorrectCount(hits);
    setResultBand(band);
    setSubmitted(true);

    if (user) {
      const saved = await saveSkillAttempt(
        user.id,
        "listening",
        band,
        {
          packId: pack.id,
          title: pack.title,
          correct: hits,
          total: pack.questions.length,
        },
        todayStr,
        pack.questions.length,
        hits
      );
      onProfileUpdated(saved.profile, saved.attempts);
      syncExternalStudyLog(saved.updatedLog, saved.newXp);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="liquid-glass rounded-3xl p-4 sm:p-5 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#5E5CE6]/20 border border-[#5E5CE6]/35 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#C4C2FF]">
              {pack.sectionLabel}
            </span>
            <span className="rounded-full bg-white/[0.06] border border-white/[0.1] px-2.5 py-0.5 text-[10px] text-[#8E8E93]">
              {pack.accentsLabel}
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white">
            {pack.title}
          </h3>
          <p className="text-xs text-[#8E8E93]">{pack.context}</p>
        </div>

        <motion.button
          type="button"
          whileTap={TAP_SCALE}
          disabled={generating}
          onClick={() => void handleGenerateNew()}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF]/20 border border-[#0A84FF]/40 px-3.5 py-1.5 text-xs font-semibold text-[#70BCFF] hover:bg-[#0A84FF]/30 cursor-pointer disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          <span>{generating ? "Membuat..." : "Generate Soal Baru (AI)"}</span>
        </motion.button>
      </div>

      {/* iOS Liquid Glass Multi-Speaker Audio Player */}
      <div className="liquid-glass-elevated rounded-3xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              disabled={audioLoading}
              onClick={() => void togglePlay()}
              aria-label={isPlaying ? "Jeda audio" : "Putar audio"}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] text-white shadow-[0_6px_20px_rgba(10,132,255,0.35)] cursor-pointer disabled:opacity-60"
            >
              {audioLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 fill-current ml-0.5" />
              )}
            </motion.button>

            <div>
              <div className="flex items-center gap-2">
                <Headphones className="h-4 w-4 text-[#70BCFF]" />
                <span className="text-sm font-semibold text-white">
                  {audioLoading
                    ? "Menyiapkan Audio Multi-Aksen..."
                    : isPlaying
                      ? "Sedang Diputar (Neural Voice)"
                      : "Putar Audio Percakapan"}
                </span>
                {isPlaying && (
                  <span
                    className="inline-flex items-end gap-[2.5px] h-3.5"
                    aria-hidden="true"
                  >
                    {[0, 1, 2, 3, 4].map((bar) => (
                      <motion.span
                        key={bar}
                        className="w-[2.5px] rounded-full bg-[#0A84FF]"
                        animate={{
                          height: ["4px", "14px", "6px", "12px", "4px"],
                        }}
                        transition={{
                          duration: 0.72,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: bar * 0.1,
                        }}
                      />
                    ))}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8E8E93] tabular-nums mt-0.5">
                {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
              </p>
            </div>
          </div>

          {/* Playback Speed */}
          <div className="flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/[0.1] p-1">
            {([0.85, 1, 1.15] as const).map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => handleSpeedChange(sp)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer",
                  speed === sp
                    ? "bg-[#0A84FF] text-white"
                    : "text-[#8E8E93] hover:text-white"
                )}
              >
                {sp}x
              </button>
            ))}
          </div>
        </div>

        {/* Scrubber */}
        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.25}
            value={Math.min(currentTime, duration || 100)}
            disabled={!duration}
            onChange={(e) => handleScrub(Number(e.target.value))}
            aria-label="Progress audio listening"
            className="w-full accent-[#0A84FF] cursor-pointer"
          />
          {audioError && <p className="text-xs text-[#FF8982]">{audioError}</p>}
        </div>

        {/* Transcript Lock / Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
          <span className="text-[11px] text-[#8E8E93]">
            {submitted
              ? "Transkrip tersedia untuk evaluasi."
              : "Transkrip terbuka otomatis setelah kamu submit jawaban."}
          </span>

          <button
            type="button"
            disabled={!submitted}
            onClick={() => setShowTranscript((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors",
              submitted
                ? "bg-white/[0.08] border-white/[0.15] text-white hover:bg-white/[0.14] cursor-pointer"
                : "bg-white/[0.03] border-white/[0.07] text-[#8E8E93] opacity-60 cursor-not-allowed"
            )}
          >
            {!submitted ? (
              <Lock className="h-3.5 w-3.5" />
            ) : showTranscript ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            <span>{showTranscript ? "Hide Transcript" : "Show Transcript"}</span>
          </button>
        </div>

        {submitted && showTranscript && (
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4 space-y-2.5 max-h-60 overflow-y-auto no-scrollbar">
            {pack.segments.map((seg, idx) => (
              <div key={idx} className="text-xs sm:text-sm leading-relaxed">
                <span className="font-semibold text-[#70BCFF]">
                  {seg.speaker}:{" "}
                </span>
                <span className="text-[#E5E5EA]">{seg.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Band Result Banner */}
      {submitted && resultBand !== null && (
        <div className="liquid-glass-elevated rounded-3xl p-5 flex items-center justify-between gap-3 border-[#30D158]/35">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#30D158]">
              Hasil Listening IELTS
            </p>
            <p className="text-xl font-bold text-white">
              Est. Band {resultBand.toFixed(1)} ({correctCount}/
              {pack.questions.length} benar)
            </p>
          </div>
          <CheckCircle2 className="h-7 w-7 text-[#30D158] shrink-0" />
        </div>
      )}

      {/* Questions */}
      <div className="space-y-3.5">
        {pack.questions.map((q, qIdx) => {
          const userAns = answers[q.id] ?? "";
          const correct = submitted ? isListeningCorrect(q, userAns) : false;

          return (
            <div key={q.id} className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#A7A5FF]">
                  Q{qIdx + 1} ·{" "}
                  {q.type === "mcq" ? "Multiple Choice" : "Form / Note Completion"}
                </span>

                {submitted &&
                  (correct ? (
                    <CheckCircle2 className="h-4.5 w-4.5 text-[#30D158]" />
                  ) : (
                    <XCircle className="h-4.5 w-4.5 text-[#FF453A]" />
                  ))}
              </div>

              <p className="text-sm font-medium text-[#F5F5F7] leading-snug">
                {q.prompt}
              </p>

              {q.type === "form_completion" ? (
                <input
                  type="text"
                  value={userAns}
                  disabled={submitted}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [q.id]: e.target.value,
                    }))
                  }
                  placeholder="Ketik jawaban singkat sesuai rekaman..."
                  className="w-full rounded-2xl bg-white/[0.05] border border-white/[0.12] px-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-[#8E8E93] focus:outline-none focus:border-[#0A84FF]/60"
                />
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {(q.options ?? []).map((opt) => {
                    const picked = userAns === opt;
                    const isRightOpt = submitted && opt === q.answer;
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={submitted}
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [q.id]: opt }))
                        }
                        className={cn(
                          "rounded-2xl border px-3.5 py-2.5 text-xs sm:text-sm font-medium text-left transition-colors cursor-pointer",
                          submitted
                            ? isRightOpt
                              ? "bg-[#30D158]/20 border-[#30D158]/55 text-white"
                              : picked
                                ? "bg-[#FF453A]/20 border-[#FF453A]/55 text-[#FFB4AE]"
                                : "bg-white/[0.03] border-white/[0.07] text-[#8E8E93]"
                            : picked
                              ? "bg-[#0A84FF]/22 border-[#0A84FF]/60 text-white"
                              : "bg-white/[0.04] border-white/[0.09] text-[#D1D1D6] hover:bg-white/[0.08]"
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {submitted && (
                <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3 space-y-1 text-xs">
                  <p className="font-semibold text-[#7CF099]">
                    Jawaban: {q.answer}
                  </p>
                  <p className="text-[#D1D1D6] leading-relaxed">
                    {q.explanation_id}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!submitted && (
        <motion.button
          type="button"
          whileTap={TAP_SCALE}
          onClick={() => void handleSubmit()}
          className="w-full rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] py-3 text-sm font-semibold text-white cursor-pointer"
        >
          Submit Jawaban Listening
        </motion.button>
      )}
    </div>
  );
}
