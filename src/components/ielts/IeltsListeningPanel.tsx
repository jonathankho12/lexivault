"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  IeltsVocabStrip,
  SaveToVaultButton,
} from "@/components/ielts/SaveToVaultButton";
import { AudioButton } from "@/components/ui/AudioButton";
import { useLanguage } from "@/context/LanguageContext";
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
  CefrLevel,
  IeltsAttempt,
  IeltsProfile,
  IeltsVoiceAccent,
  ListeningQuestion,
  ListeningSectionPack,
} from "@/types/ielts";

type ListeningFormatMode = "section1" | "section4";
type TtsAccentMode = "pack" | "US" | "UK";

function isA1ToB1(level?: CefrLevel): boolean {
  return level === "A1" || level === "A2" || level === "B1";
}

function inferFormatMode(pack: ListeningSectionPack): ListeningFormatMode {
  if (pack.sectionType === "section4") return "section4";
  if (pack.sectionType === "section1") return "section1";
  if (pack.cefrLevel && !isA1ToB1(pack.cefrLevel)) return "section4";
  return "section1";
}

function mapSegmentsForAccent(
  segments: ListeningSectionPack["segments"],
  accentMode: TtsAccentMode
): ListeningSectionPack["segments"] {
  if (accentMode === "pack") return segments;
  const speakerMap = new Map<string, IeltsVoiceAccent>();
  return segments.map((seg) => {
    let accent = speakerMap.get(seg.speaker);
    if (!accent) {
      if (accentMode === "US") {
        accent = "US_M";
      } else {
        accent = speakerMap.size % 2 === 0 ? "GB_F" : "GB_M";
      }
      speakerMap.set(seg.speaker, accent);
    }
    return { ...seg, accent };
  });
}

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
  cefrLevel,
}: {
  onProfileUpdated: (profile: IeltsProfile, attempts: IeltsAttempt[]) => void;
  cefrLevel?: CefrLevel;
}) {
  const { user, todayStr, syncExternalStudyLog } = useLexiVault();
  const { lang } = useLanguage();
  const isEn = lang === "en";

  const initialFormat: ListeningFormatMode =
    cefrLevel && !isA1ToB1(cefrLevel) ? "section4" : "section1";

  const initialPack = useMemo(() => {
    return (
      FALLBACK_LISTENING_PACKS.find(
        (p) => inferFormatMode(p) === initialFormat
      ) ?? FALLBACK_LISTENING_PACKS[0]
    );
  }, [initialFormat]);

  const [formatMode, setFormatMode] =
    useState<ListeningFormatMode>(initialFormat);
  const [accentMode, setAccentMode] = useState<TtsAccentMode>("pack");

  const [pack, setPack] = useState<ListeningSectionPack>(initialPack);
  const [seenIds, setSeenIds] = useState<string[]>([initialPack.id]);
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

    const cacheKey = `${pack.id}:${accentMode}`;
    let blobUrl = urlCacheRef.current.get(cacheKey);
    if (!blobUrl) {
      setAudioLoading(true);
      setAudioError(null);
      try {
        const segments = mapSegmentsForAccent(pack.segments, accentMode);
        const res = await fetch("/api/ielts/audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segments }),
        });
        if (!res.ok) throw new Error("Audio synthesis failed");
        const blob = await res.blob();
        blobUrl = URL.createObjectURL(blob);
        urlCacheRef.current.set(cacheKey, blobUrl);
      } catch {
        setAudioError(
          isEn
            ? "Failed to load conversation audio. Tap Play to try again."
            : lang === "ru"
              ? "Не удалось загрузить аудиозапись. Нажми Play ещё раз."
              : "Gagal memuat audio percakapan. Coba klik Play lagi."
        );
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
      setAudioError(
        isEn
          ? "Failed to play audio file."
          : lang === "ru"
            ? "Не удалось воспроизвести аудиофайл."
            : "Gagal memutar berkas audio."
      );
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

  const handleAccentChange = (nextAccent: TtsAccentMode) => {
    if (nextAccent === accentMode) return;
    teardownAudio();
    setAudioError(null);
    setAccentMode(nextAccent);
  };

  const applyPack = useCallback(
    (nextPack: ListeningSectionPack) => {
      teardownAudio();
      setPack(nextPack);
      setSeenIds((prev) =>
        prev.includes(nextPack.id) ? prev : [...prev, nextPack.id]
      );
      setAnswers({});
      setSubmitted(false);
      setResultBand(null);
      setShowTranscript(false);
      setAudioError(null);
    },
    [teardownAudio]
  );

  const handleGenerateNew = async (targetFormat: ListeningFormatMode = formatMode) => {
    if (generating) return;
    setGenerating(true);
    teardownAudio();
    const targetCefr: CefrLevel =
      targetFormat === "section1"
        ? cefrLevel && isA1ToB1(cefrLevel)
          ? cefrLevel
          : "B1"
        : cefrLevel && !isA1ToB1(cefrLevel)
          ? cefrLevel
          : "C1";
    try {
      const res = await fetch("/api/ielts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill: "listening",
          excludeIds: seenIds,
          cefrLevel: targetCefr,
          sectionType: targetFormat,
          lang,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { pack: ListeningSectionPack };
        if (json.pack) {
          applyPack(json.pack);
        }
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleFormatChange = (nextFormat: ListeningFormatMode) => {
    if (nextFormat === formatMode) return;
    setFormatMode(nextFormat);
    if (inferFormatMode(pack) === nextFormat) return;
    const matchingFallback = FALLBACK_LISTENING_PACKS.find(
      (p) => inferFormatMode(p) === nextFormat && p.id !== pack.id
    );
    if (matchingFallback) {
      applyPack(matchingFallback);
    } else {
      void handleGenerateNew(nextFormat);
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
      <div className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#5E5CE6]/20 border border-[#5E5CE6]/35 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#C4C2FF]">
                {pack.sectionLabel}
              </span>
              <span className="rounded-full bg-[#0A84FF]/15 border border-[#0A84FF]/30 px-2.5 py-0.5 text-[10px] font-semibold text-[#70BCFF]">
                {pack.cefrLevel
                  ? `${pack.cefrLevel} · ${
                      inferFormatMode(pack) === "section4"
                        ? isEn
                          ? "Section 4 (Academic)"
                          : lang === "ru"
                            ? "Часть 4 (Академ.)"
                            : "Section 4 (Akademik)"
                        : isEn
                          ? "Section 1 (Everyday)"
                          : lang === "ru"
                            ? "Часть 1 (Повседн.)"
                            : "Section 1 (Sehari-hari)"
                    }`
                  : formatMode === "section4"
                    ? "B2–C2 · Section 4"
                    : "A1–B1 · Section 1"}
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
            <span>
              {generating
                ? isEn
                  ? "Generating..."
                  : lang === "ru"
                    ? "Генерирую..."
                    : "Membuat..."
                : isEn
                  ? "Generate New Section (AI)"
                  : lang === "ru"
                    ? "Новая запись (ИИ)"
                    : "Generate Soal Baru (AI)"}
            </span>
          </motion.button>
        </div>

        {/* Exam Format Selector: A1-B1 Section 1 / B2-C2 Section 4 */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.08]">
          <span className="text-[11px] font-medium text-[#8E8E93]">
            {isEn
              ? "Exam Format:"
              : lang === "ru"
                ? "Формат:"
                : "Format Ujian:"}
          </span>
          {(
            [
              {
                id: "section1" as const,
                label: isEn
                  ? "A1–B1 · Section 1 (Dialogue)"
                  : lang === "ru"
                    ? "A1–B1 · Часть 1 (Диалог)"
                    : "A1–B1 · Section 1 (Dialog)",
              },
              {
                id: "section4" as const,
                label: isEn
                  ? "B2–C2 · Section 4 (Academic Lecture)"
                  : lang === "ru"
                    ? "B2–C2 · Часть 4 (Лекция)"
                    : "B2–C2 · Section 4 (Kuliah Akademik)",
              },
            ] as const
          ).map((fmt) => (
            <button
              key={fmt.id}
              type="button"
              disabled={generating}
              onClick={() => handleFormatChange(fmt.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50",
                formatMode === fmt.id
                  ? "bg-[#5E5CE6]/25 border-[#5E5CE6]/55 text-[#E5E5FF]"
                  : "bg-white/[0.04] border-white/[0.09] text-[#8E8E93] hover:text-white"
              )}
            >
              {fmt.label}
            </button>
          ))}
        </div>
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
              aria-label={
                isPlaying
                  ? isEn
                    ? "Pause audio"
                    : lang === "ru"
                      ? "Пауза"
                      : "Jeda audio"
                  : isEn
                    ? "Play audio"
                    : lang === "ru"
                      ? "Воспроизвести"
                      : "Putar audio"
              }
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
                    ? isEn
                      ? "Preparing Multi-Accent Audio..."
                      : lang === "ru"
                        ? "Готовлю аудио с акцентами..."
                        : "Menyiapkan Audio Multi-Aksen..."
                    : isPlaying
                      ? isEn
                        ? "Playing (Neural Voice)"
                        : lang === "ru"
                          ? "Воспроизведение (Нейроголос)"
                          : "Sedang Diputar (Neural Voice)"
                      : isEn
                        ? "Play Conversation Audio"
                        : lang === "ru"
                          ? "Слушать аудиозапись"
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

          {/* Accent & Playback Speed */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/[0.1] p-1">
              {(
                [
                  { id: "pack" as const, label: isEn ? "Multi" : "Multi" },
                  { id: "US" as const, label: "US" },
                  { id: "UK" as const, label: "UK" },
                ] as const
              ).map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  disabled={audioLoading}
                  onClick={() => handleAccentChange(acc.id)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50",
                    accentMode === acc.id
                      ? "bg-[#5E5CE6] text-white"
                      : "text-[#8E8E93] hover:text-white"
                  )}
                >
                  {acc.label}
                </button>
              ))}
            </div>

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
              ? isEn
                ? "Transcript unlocked for review."
                : lang === "ru"
                  ? "Расшифровка открыта для проверки."
                  : "Transkrip tersedia untuk evaluasi."
              : isEn
                ? "Transcript unlocks automatically after you submit your answers."
                : lang === "ru"
                  ? "Текст откроется автоматически после отправки ответов."
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
            <span>
              {showTranscript
                ? lang === "ru"
                  ? "Скрыть текст"
                  : "Hide Transcript"
                : lang === "ru"
                  ? "Показать текст"
                  : "Show Transcript"}
            </span>
          </button>
        </div>

        {submitted && showTranscript && (
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4 space-y-2.5 max-h-60 overflow-y-auto no-scrollbar">
            {pack.segments.map((seg, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-2 text-xs sm:text-sm leading-relaxed"
              >
                <div>
                  <span className="font-semibold text-[#70BCFF]">
                    {seg.speaker}:{" "}
                  </span>
                  <span className="text-[#E5E5EA]">{seg.text}</span>
                </div>
                <AudioButton text={seg.text} size="sm" />
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
              {isEn
                ? "IELTS Listening Result"
                : lang === "ru"
                  ? "Результат IELTS Listening"
                  : "Hasil Listening IELTS"}
            </p>
            <p className="text-xl font-bold text-white">
              Est. Band {resultBand.toFixed(1)} ({correctCount}/
              {pack.questions.length}{" "}
              {isEn ? "correct" : lang === "ru" ? "верно" : "benar"})
            </p>
          </div>
          <CheckCircle2 className="h-7 w-7 text-[#30D158] shrink-0" />
        </div>
      )}

      {/* Key Vocabulary 1-Click Save to Vault */}
      {submitted && pack.keyVocabulary && pack.keyVocabulary.length > 0 && (
        <IeltsVocabStrip
          items={pack.keyVocabulary}
          sourceTag="ielts-listening"
        />
      )}

      {/* Questions */}
      <div className="space-y-3.5">
        {pack.questions.map((q, qIdx) => {
          const userAns = answers[q.id] ?? "";
          const correct = submitted ? isListeningCorrect(q, userAns) : false;

          return (
            <div key={q.id} className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#A7A5FF]">
                    Q{qIdx + 1} ·{" "}
                    {q.type === "mcq"
                      ? "Multiple Choice"
                      : "Form / Note Completion"}
                  </span>
                  {q.wordLimit && (
                    <span className="rounded-full bg-[#FF9F0A]/15 border border-[#FF9F0A]/30 px-2 py-0.5 text-[10px] font-semibold text-[#FFD60A]">
                      {q.wordLimit}
                    </span>
                  )}
                </div>

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
                  placeholder={
                    isEn
                      ? "Type a short answer from the recording..."
                      : lang === "ru"
                        ? "Введи краткий ответ из записи..."
                        : "Ketik jawaban singkat sesuai rekaman..."
                  }
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
                <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3 space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-[#7CF099]">
                      {isEn ? "Answer: " : lang === "ru" ? "Ответ: " : "Jawaban: "}
                      {q.answer}
                    </p>
                    {!/^\d+([.,:/-]\d+)*$/.test(q.answer.trim()) &&
                      q.answer.trim().split(/\s+/).length <= 4 && (
                        <SaveToVaultButton
                          term={q.answer}
                          sourceTag="ielts-listening"
                          compact
                        />
                      )}
                  </div>
                  {(() => {
                    const exp =
                      lang === "en"
                        ? q.explanation_en || q.explanation_id
                        : lang === "ru"
                          ? q.explanation_ru || q.explanation_id || q.explanation_en
                          : q.explanation_id || q.explanation_en;
                    return exp ? (
                      <p className="text-[#D1D1D6] leading-relaxed">{exp}</p>
                    ) : null;
                  })()}
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
          {isEn
            ? "Submit Listening Answers"
            : lang === "ru"
              ? "Проверить Listening"
              : "Submit Jawaban Listening"}
        </motion.button>
      )}
    </div>
  );
}
