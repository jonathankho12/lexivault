"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Award,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Mic,
  MicOff,
  Sparkles,
  Square,
} from "lucide-react";
import { AudioButton } from "@/components/ui/AudioButton";
import { useLexiVault } from "@/context/LexiVaultContext";
import { FALLBACK_SPEAKING_PACKS } from "@/lib/ieltsMockData";
import { saveSkillAttempt } from "@/lib/ieltsStorage";
import { countWords } from "@/lib/ieltsUtils";
import { playGlassClick } from "@/lib/soundEffects";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type {
  IeltsAttempt,
  IeltsProfile,
  SpeakingGradeResult,
  SpeakingPart,
  SpeakingPromptPack,
} from "@/types/ielts";

interface BrowserSpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: BrowserSpeechResultEvent) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function IeltsSpeakingPanel({
  onProfileUpdated,
}: {
  onProfileUpdated: (profile: IeltsProfile, attempts: IeltsAttempt[]) => void;
}) {
  const { user, todayStr, syncExternalStudyLog } = useLexiVault();

  const [part, setPart] = useState<SpeakingPart>("part2");
  const [pack, setPack] = useState<SpeakingPromptPack>(
    () =>
      FALLBACK_SPEAKING_PACKS.find((p) => p.part === "part2") ??
      FALLBACK_SPEAKING_PACKS[0]
  );
  const [seenIds, setSeenIds] = useState<string[]>([pack.id]);
  const [generating, setGenerating] = useState(false);

  // Prep (Part 2) & Speaking timers
  const [prepLeft, setPrepLeft] = useState(pack.prepSeconds);
  const [prepActive, setPrepActive] = useState(false);
  const [notes, setNotes] = useState("");
  const [speakElapsed, setSpeakElapsed] = useState(0);

  // Voice Recognition & Transcript
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [micError, setMicError] = useState<string | null>(null);

  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<SpeakingGradeResult | null>(null);
  const [showSample, setShowSample] = useState(false);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognitionCtor()));
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, []);

  // Part 2 preparation countdown
  useEffect(() => {
    if (!prepActive || prepLeft <= 0) {
      if (prepActive && prepLeft <= 0) setPrepActive(false);
      return;
    }
    const id = setInterval(() => {
      setPrepLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [prepActive, prepLeft]);

  // Speaking timer while recording
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => {
      setSpeakElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  const wordCount = useMemo(
    () => countWords(`${transcript} ${interimText}`),
    [transcript, interimText]
  );

  const stopRecording = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore stop error
    }
    recognitionRef.current = null;
    setIsRecording(false);
    setInterimText("");
  };

  const startRecording = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setMicError(
        "Browser ini belum mendukung Web Speech API. Kamu bisa langsung mengetik atau mendikte jawaban di kolom teks."
      );
      return;
    }

    setMicError(null);
    setPrepActive(false);
    playGlassClick();

    try {
      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (event: BrowserSpeechResultEvent) => {
        let finalAdd = "";
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const chunk = event.results[i][0]?.transcript ?? "";
          if (event.results[i].isFinal) {
            finalAdd += `${chunk} `;
          } else {
            interim += chunk;
          }
        }
        if (finalAdd) {
          setTranscript((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${finalAdd}`);
        }
        setInterimText(interim);
      };

      rec.onerror = (ev) => {
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          setMicError(
            "Izin mikrofon ditolak. Aktifkan izin mic di browser atau ketik jawaban di bawah."
          );
        } else {
          setMicError("Perekaman suara berhenti sementara. Silakan lanjutkan atau edit teks.");
        }
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
        setInterimText("");
      };

      recognitionRef.current = rec;
      rec.start();
      setIsRecording(true);
    } catch {
      setMicError("Tidak dapat memulai mikrofon pada perangkat ini.");
      setIsRecording(false);
    }
  };

  const switchPart = (nextPart: SpeakingPart) => {
    stopRecording();
    setPart(nextPart);
    const nextPack =
      FALLBACK_SPEAKING_PACKS.find((p) => p.part === nextPart) ??
      FALLBACK_SPEAKING_PACKS[0];
    setPack(nextPack);
    setPrepLeft(nextPack.prepSeconds);
    setPrepActive(false);
    setNotes("");
    setSpeakElapsed(0);
    setTranscript("");
    setGrade(null);
    setShowSample(false);
    setMicError(null);
  };

  const handleGenerateNew = async () => {
    if (generating) return;
    stopRecording();
    setGenerating(true);
    try {
      const res = await fetch("/api/ielts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill: "speaking",
          speakingPart: part,
          excludeIds: seenIds,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { pack: SpeakingPromptPack };
        if (json.pack) {
          setPack(json.pack);
          setSeenIds((prev) => [...prev, json.pack.id]);
          setPrepLeft(json.pack.prepSeconds);
          setPrepActive(false);
          setNotes("");
          setSpeakElapsed(0);
          setTranscript("");
          setGrade(null);
          setShowSample(false);
        }
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async () => {
    stopRecording();
    const combined = `${transcript} ${interimText}`.trim();
    if (!combined || grading) return;

    setGrading(true);
    setMicError(null);
    try {
      const res = await fetch("/api/ielts/grade-speaking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: pack,
          transcript: combined,
          durationSec: speakElapsed,
        }),
      });
      if (!res.ok) throw new Error("Speaking grade failed");
      const json = (await res.json()) as { result: SpeakingGradeResult };
      setGrade(json.result);

      if (user) {
        const saved = await saveSkillAttempt(
          user.id,
          "speaking",
          json.result.overall_band,
          {
            packId: pack.id,
            part: pack.part,
            topic: pack.topic,
            wordCount,
            criteria: json.result.criteria,
            modelUsed: json.result.modelUsed,
          },
          todayStr,
          1,
          json.result.overall_band >= 6.0 ? 1 : 0
        );
        onProfileUpdated(saved.profile, saved.attempts);
        syncExternalStudyLog(saved.updatedLog, saved.newXp);
      }
    } catch {
      setMicError("Gagal menilai jawaban Speaking. Silakan coba lagi.");
    } finally {
      setGrading(false);
    }
  };

  const formatSec = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      {/* Top Part Selector & Generate */}
      <div className="liquid-glass rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-grid grid-cols-3 rounded-full bg-white/[0.06] border border-white/[0.1] p-1">
          {(
            [
              { id: "part1", label: "Part 1" },
              { id: "part2", label: "Part 2 · Cue Card" },
              { id: "part3", label: "Part 3" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => switchPart(opt.id)}
              className={cn(
                "rounded-full px-3 sm:px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                part === opt.id
                  ? "bg-[#0A84FF] text-white"
                  : "text-[#8E8E93] hover:text-white"
              )}
            >
              {opt.label}
            </button>
          ))}
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
          <span>{generating ? "Membuat..." : "Generate Topik Baru (AI)"}</span>
        </motion.button>
      </div>

      {/* Desktop Split-View: Prompt/Cue Card (Left) + Recorder/Transcript (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Prompt Card */}
        <div className="lg:col-span-5 liquid-glass rounded-3xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#BF5AF2]">
                {pack.part.toUpperCase()} · {pack.topic}
              </span>
              <h3 className="mt-1 text-base sm:text-lg font-bold text-white leading-snug">
                {pack.question}
              </h3>
            </div>
            <AudioButton text={pack.question} size="sm" />
          </div>

          {pack.cueBullets && pack.cueBullets.length > 0 && (
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3.5 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                You should say:
              </p>
              <ul className="space-y-1 text-xs sm:text-sm text-[#E5E5EA]">
                {pack.cueBullets.map((b, idx) => (
                  <li key={idx}>• {b}</li>
                ))}
              </ul>
            </div>
          )}

          {pack.followUpQuestions && pack.followUpQuestions.length > 0 && (
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3.5 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                Pertanyaan Lanjutan Examiner:
              </p>
              <ul className="space-y-1 text-xs text-[#D1D1D6]">
                {pack.followUpQuestions.map((fq, idx) => (
                  <li key={idx}>• {fq}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Part 2 1-Minute Prep Timer & Notes */}
          {pack.part === "part2" && (
            <div className="rounded-2xl bg-[#FF9F0A]/10 border border-[#FF9F0A]/25 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#FFD18C]">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Prep 1 Menit: {formatSec(prepLeft)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (prepLeft === 0) setPrepLeft(60);
                    setPrepActive((v) => !v);
                  }}
                  className="rounded-full bg-[#FF9F0A]/20 px-3 py-1 text-[11px] font-semibold text-[#FFD18C] cursor-pointer"
                >
                  {prepActive ? "Jeda Prep" : "Mulai Prep 1m"}
                </button>
              </div>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan poin cepat selama 1 menit persiapan..."
                className="w-full rounded-xl bg-black/30 border border-white/[0.08] p-2.5 text-xs text-[#F5F5F7] placeholder:text-[#8E8E93] focus:outline-none"
              />
            </div>
          )}

          {/* Target C1/C2 Phrases */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93]">
              Target Frasa Bonus:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {pack.targetPhrases.map((phr) => (
                <span
                  key={phr}
                  className="rounded-full bg-[#0A84FF]/15 border border-[#0A84FF]/30 px-2.5 py-0.5 text-[11px] font-medium text-[#70BCFF]"
                >
                  {phr}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Voice Recorder & Transcript Editor */}
        <div className="lg:col-span-7 liquid-glass rounded-3xl p-5 space-y-4">
          {/* Mic Controls + Lightweight GPU Wave Visualizer */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4">
            <div className="flex items-center gap-3">
              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                onClick={isRecording ? stopRecording : startRecording}
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white cursor-pointer transition-colors",
                  isRecording
                    ? "bg-[#FF453A] shadow-[0_0_24px_rgba(255,69,58,0.45)]"
                    : "bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6]"
                )}
                aria-label={isRecording ? "Stop merekam" : "Mulai rekam suara"}
              >
                {isRecording ? (
                  <Square className="h-4.5 w-4.5 fill-current" />
                ) : speechSupported ? (
                  <Mic className="h-5 w-5" />
                ) : (
                  <MicOff className="h-5 w-5" />
                )}
              </motion.button>

              <div>
                <p className="text-sm font-semibold text-white">
                  {isRecording
                    ? "Merekam & Mentranskrip..."
                    : speechSupported
                      ? "Tekan Mic untuk Berbicara"
                      : "Mode Teks (Speech API tidak tersedia)"}
                </p>
                <p className="text-xs text-[#8E8E93] tabular-nums">
                  Durasi: {formatSec(speakElapsed)} / target{" "}
                  {formatSec(pack.speakSeconds)} · {wordCount} kata
                </p>
              </div>
            </div>

            {/* 60 FPS GPU Transform-Only Wave Visualizer */}
            <div
              className="flex items-center gap-1 h-7 px-2"
              aria-hidden="true"
            >
              {[0.35, 0.7, 1, 0.65, 0.85, 0.45].map((amp, idx) => (
                <motion.span
                  key={idx}
                  className={cn(
                    "w-1 h-6 rounded-full origin-center transform-gpu will-change-transform",
                    isRecording ? "bg-[#0A84FF]" : "bg-white/20"
                  )}
                  animate={
                    isRecording
                      ? { scaleY: [0.25, amp, 0.35, amp * 0.85, 0.25] }
                      : { scaleY: 0.22 }
                  }
                  transition={
                    isRecording
                      ? {
                          duration: 0.7,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: idx * 0.08,
                        }
                      : { duration: 0.2 }
                  }
                />
              ))}
            </div>
          </div>

          {micError && (
            <p className="text-xs text-[#FFB340] bg-[#FF9F0A]/10 border border-[#FF9F0A]/25 rounded-2xl px-3.5 py-2">
              {micError}
            </p>
          )}

          {/* Transcript Box (editable fallback + live voice text) */}
          <div className="space-y-1.5">
            <label
              htmlFor="ielts-speaking-transcript"
              className="block text-xs font-medium text-[#8E8E93]"
            >
              Transkrip Jawaban (otomatis terisi dari suara, atau ketik/edit
              langsung):
            </label>
            <textarea
              id="ielts-speaking-transcript"
              rows={7}
              value={
                interimText
                  ? `${transcript}${transcript && !transcript.endsWith(" ") ? " " : ""}${interimText}`
                  : transcript
              }
              onChange={(e) => {
                setInterimText("");
                setTranscript(e.target.value);
              }}
              placeholder="Mulai berbicara dengan tombol mic di atas, atau ketik jawaban Speaking kamu di sini..."
              className="w-full resize-y rounded-2xl bg-black/35 border border-white/[0.1] p-4 text-base leading-relaxed text-[#F5F5F7] placeholder:text-[#8E8E93]/70 focus:outline-none focus:border-[#0A84FF]/60"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                stopRecording();
                setTranscript("");
                setSpeakElapsed(0);
                setGrade(null);
              }}
              className="text-xs font-medium text-[#8E8E93] hover:text-white cursor-pointer"
            >
              Reset Transkrip
            </button>

            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              disabled={grading || wordCount < 8}
              onClick={() => void handleSubmit()}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] px-5 py-2.5 text-sm font-semibold text-white cursor-pointer disabled:opacity-50"
            >
              {grading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Examiner Menilai...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Nilai Speaking (AI Examiner)</span>
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Examiner Grade Output */}
      {grade && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={IOS_SPRING}
          className="liquid-glass-elevated transform-gpu will-change-transform rounded-3xl p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#30D158]/20 border border-[#30D158]/40">
                <Award className="h-6 w-6 text-[#30D158]" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#30D158]">
                  IELTS Speaking Band Score
                </p>
                <h4 className="text-2xl font-bold text-white">
                  Band {grade.overall_band.toFixed(1)}
                </h4>
              </div>
            </div>

            <span className="rounded-full bg-white/[0.08] border border-white/[0.12] px-3 py-1 text-[11px] font-medium text-[#D1D1D6]">
              Model: {grade.modelUsed}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                {
                  label: "Fluency & Coherence",
                  score: grade.criteria.fluency_coherence,
                },
                {
                  label: "Lexical Resource",
                  score: grade.criteria.lexical_resource,
                },
                {
                  label: "Grammatical Range",
                  score: grade.criteria.grammatical_range,
                },
              ] as const
            ).map((item) => (
              <div
                key={item.label}
                className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#D1D1D6]">{item.label}</span>
                  <span className="font-bold text-[#70BCFF]">
                    {item.score.toFixed(1)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0A84FF] to-[#30D158]"
                    style={{ width: `${Math.round((item.score / 9) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
              Feedback Examiner
            </p>
            <p className="text-sm leading-relaxed text-[#F5F5F7]">
              {grade.summary_id}
            </p>
          </div>

          {grade.phrase_upgrades.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">
                Koreksi Frasa Kaku → Natural
              </p>
              {grade.phrase_upgrades.map((up, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3.5 space-y-1.5 text-xs sm:text-sm"
                >
                  <p className="text-[#FF8982] line-through opacity-85">
                    {up.awkward}
                  </p>
                  <p className="flex items-start gap-1.5 font-medium text-[#7CF099]">
                    <ArrowRight className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{up.natural}</span>
                  </p>
                  <p className="text-xs text-[#8E8E93]">{up.reason_id}</p>
                </div>
              ))}
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowSample((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF]/15 border border-[#0A84FF]/35 px-4 py-2 text-xs font-semibold text-[#70BCFF] cursor-pointer"
            >
              <span>
                {showSample
                  ? "Sembunyikan Contoh Band 8.5+"
                  : "Lihat Contoh Jawaban Band 8.5+"}
              </span>
              {showSample ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {showSample && (
              <div className="mt-3 rounded-2xl bg-[#0A84FF]/10 border border-[#0A84FF]/25 p-4 space-y-2">
                <div className="flex justify-end">
                  <AudioButton text={grade.band_85_sample} size="sm" label="Dengar" />
                </div>
                <p className="text-xs sm:text-sm leading-relaxed text-[#F5F5F7]">
                  {grade.band_85_sample}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
