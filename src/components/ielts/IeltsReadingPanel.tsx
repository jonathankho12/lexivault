"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  BookmarkPlus,
  BookOpen,
  CheckCircle2,
  Clock,
  Highlighter,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { IeltsVocabStrip } from "@/components/ielts/SaveToVaultButton";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { FALLBACK_READING_PACKS } from "@/lib/ieltsMockData";
import { saveSkillAttempt } from "@/lib/ieltsStorage";
import {
  accuracyToIeltsBand,
  normalizeShortAnswer,
} from "@/lib/ieltsUtils";
import { TAP_SCALE } from "@/lib/motion";
import { cn, formatCefrBadgeClass } from "@/lib/utils";
import type {
  CefrLevel,
  IeltsAttempt,
  IeltsProfile,
  ReadingPassagePack,
  ReadingQuestion,
} from "@/types/ielts";

const READING_LEVELS: CefrLevel[] = ["A2", "B1", "B2", "C1", "C2"];
const PARAGRAPH_LABELS = ["A", "B", "C", "D", "E", "F"];

function normalizeTolerant(raw: string): string {
  return normalizeShortAnswer(raw)
    .replace(/[-–—]/g, " ")
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isQuestionCorrect(q: ReadingQuestion, userAnswer: string): boolean {
  const normUser = normalizeTolerant(userAnswer);
  if (!normUser) return false;
  if (q.type === "fill_blank") {
    const candidates = [q.answer, ...(q.acceptedAnswers ?? [])].map(
      normalizeTolerant
    );
    return candidates.includes(normUser);
  }
  return normUser === normalizeTolerant(q.answer);
}

interface EvidenceSpan {
  start: number;
  end: number;
  qId: string;
  qNum: number;
}

function renderParagraphWithEvidence(
  paragraph: string,
  questions: ReadingQuestion[],
  focusedQuestionId: string | null
): ReactNode {
  const lowerPara = paragraph.toLowerCase();
  const spans: EvidenceSpan[] = [];

  questions.forEach((q, idx) => {
    const quote = q.evidence_quote?.trim();
    if (!quote || quote.length < 10) return;

    // Try exact case-insensitive substring first, then trimmed first 45 chars fallback
    let pos = lowerPara.indexOf(quote.toLowerCase());
    let len = quote.length;

    if (pos === -1) {
      const cleanQuote = quote.replace(/^[“"']+|[”"'.]+$/g, "").trim();
      if (cleanQuote.length >= 10) {
        pos = lowerPara.indexOf(cleanQuote.toLowerCase());
        len = cleanQuote.length;
      }
    }

    if (pos === -1 && quote.length > 36) {
      const snippet = quote.slice(0, 36).toLowerCase();
      pos = lowerPara.indexOf(snippet);
      if (pos !== -1) {
        const sentenceEnd = paragraph.indexOf(".", pos + snippet.length);
        len =
          sentenceEnd !== -1
            ? sentenceEnd - pos + 1
            : Math.min(paragraph.length - pos, quote.length);
      }
    }

    if (pos !== -1) {
      spans.push({
        start: pos,
        end: Math.min(paragraph.length, pos + len),
        qId: q.id,
        qNum: idx + 1,
      });
    }
  });

  if (spans.length === 0) return paragraph;

  // Sort spans and skip overlaps cleanly (prioritize focused question if overlapping)
  spans.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.qId === focusedQuestionId) return -1;
    if (b.qId === focusedQuestionId) return 1;
    return a.end - b.end;
  });

  const merged: EvidenceSpan[] = [];
  for (const sp of spans) {
    const prev = merged[merged.length - 1];
    if (!prev || sp.start >= prev.end) {
      merged.push(sp);
    } else if (sp.qId === focusedQuestionId) {
      merged[merged.length - 1] = sp;
    }
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;
  merged.forEach((sp, idx) => {
    if (sp.start > cursor) {
      nodes.push(<span key={`t-${idx}`}>{paragraph.slice(cursor, sp.start)}</span>);
    }
    const isFocused = focusedQuestionId === sp.qId;
    nodes.push(
      <mark
        key={`m-${sp.qId}-${idx}`}
        id={`evidence-${sp.qId}`}
        className={cn(
          "rounded-md px-1 py-0.5 transition-all",
          isFocused
            ? "bg-[#30D158]/35 text-white ring-1 ring-[#30D158]/70"
            : "bg-[#FF9F0A]/22 text-[#FFF3D6]"
        )}
      >
        <span className="mr-1 inline-flex items-center rounded bg-black/40 px-1 py-0.2 text-[10px] font-bold text-[#7CF099] align-middle">
          Q{sp.qNum}
        </span>
        {paragraph.slice(sp.start, sp.end)}
      </mark>
    );
    cursor = sp.end;
  });

  if (cursor < paragraph.length) {
    nodes.push(<span key="tail">{paragraph.slice(cursor)}</span>);
  }

  return nodes;
}

export function IeltsReadingPanel({
  cefrLevel = "B2",
  onProfileUpdated,
}: {
  cefrLevel?: CefrLevel;
  onProfileUpdated: (profile: IeltsProfile, attempts: IeltsAttempt[]) => void;
}) {
  const { user, todayStr, addWordViaAI, syncExternalStudyLog } = useLexiVault();
  const { lang } = useLanguage();
  const isEn = lang === "en";

  const [targetLevel, setTargetLevel] = useState<CefrLevel>(
    cefrLevel === "A1" ? "A2" : cefrLevel
  );
  const [pack, setPack] = useState<ReadingPassagePack>(FALLBACK_READING_PACKS[0]);
  const [seenIds, setSeenIds] = useState<string[]>([FALLBACK_READING_PACKS[0].id]);
  const [generating, setGenerating] = useState(false);

  const [mobilePane, setMobilePane] = useState<"passage" | "questions">("passage");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [resultBand, setResultBand] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [focusedEvidenceId, setFocusedEvidenceId] = useState<string | null>(null);

  // Countdown timer
  const [secondsLeft, setSecondsLeft] = useState(
    FALLBACK_READING_PACKS[0].recommendedMinutes * 60
  );
  const [timerActive, setTimerActive] = useState(false);

  // Select-to-Save to Vault
  const [selectedPhrase, setSelectedPhrase] = useState("");
  const [savingToVault, setSavingToVault] = useState(false);
  const [vaultSavedMsg, setVaultSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!timerActive || submitted) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [timerActive, submitted]);

  const formattedTimer = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(
    secondsLeft % 60
  ).padStart(2, "0")}`;

  const handlePassageSelection = () => {
    const raw = window.getSelection()?.toString() ?? "";
    const cleaned = raw.trim().replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "");
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (cleaned.length >= 3 && cleaned.length <= 40 && words.length <= 4) {
      setSelectedPhrase(cleaned);
      setVaultSavedMsg(null);
    }
  };

  const handleSaveSelectedToVault = async () => {
    if (!selectedPhrase || savingToVault) return;
    setSavingToVault(true);
    const res = await addWordViaAI(selectedPhrase, "ielts");
    setSavingToVault(false);
    if (res.ok || res.duplicate) {
      setVaultSavedMsg(
        isEn
          ? `"${selectedPhrase}" saved to Vault ✓`
          : `"${selectedPhrase}" disimpan ke Vault ✓`
      );
      setSelectedPhrase("");
    }
  };

  const handleGenerateNew = async (overrideLevel?: CefrLevel) => {
    if (generating) return;
    const levelToUse = overrideLevel ?? targetLevel;
    setGenerating(true);
    try {
      const res = await fetch("/api/ielts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill: "reading",
          cefrLevel: levelToUse,
          excludeIds: seenIds,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { pack: ReadingPassagePack };
        if (json.pack) {
          setPack(json.pack);
          setSeenIds((prev) => [...prev, json.pack.id]);
          setAnswers({});
          setSubmitted(false);
          setResultBand(null);
          setFocusedEvidenceId(null);
          setSecondsLeft((json.pack.recommendedMinutes || 12) * 60);
          setTimerActive(false);
        }
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleLocateEvidence = (questionId: string) => {
    setFocusedEvidenceId(questionId);
    setMobilePane("passage");
    setTimeout(() => {
      const el = document.getElementById(`evidence-${questionId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  const handleSubmit = async () => {
    if (submitted) return;
    let hits = 0;
    for (const q of pack.questions) {
      if (isQuestionCorrect(q, answers[q.id] ?? "")) {
        hits += 1;
      }
    }

    const band = accuracyToIeltsBand(hits, pack.questions.length);
    setCorrectCount(hits);
    setResultBand(band);
    setSubmitted(true);
    setTimerActive(false);

    if (user) {
      const saved = await saveSkillAttempt(
        user.id,
        "reading",
        band,
        {
          packId: pack.id,
          title: pack.title,
          cefrLevel: pack.cefrLevel ?? targetLevel,
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

  const effectivePackLevel = pack.cefrLevel ?? targetLevel;

  const questionTypeLabel = useMemo(
    () => (type: ReadingQuestion["type"]) => {
      switch (type) {
        case "tfng":
          return "True / False / Not Given";
        case "matching_headings":
          return "Matching Headings";
        case "fill_blank":
          return "Summary Completion";
        case "mcq":
        default:
          return "Inference MCQ";
      }
    },
    []
  );

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="liquid-glass rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                formatCefrBadgeClass(effectivePackLevel)
              )}
            >
              CEFR {effectivePackLevel}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#70BCFF]">
              {pack.topic}
            </span>
          </div>
          <h3 className="text-lg font-bold text-white">{pack.title}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Adaptive Level Selector (A2–C2) */}
          <div className="inline-flex items-center gap-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] p-0.5">
            {READING_LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setTargetLevel(lvl)}
                className={cn(
                  "rounded-full px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer",
                  targetLevel === lvl
                    ? "bg-[#0A84FF] text-white"
                    : "text-[#8E8E93] hover:text-white"
                )}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Countdown Timer */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] px-3 py-1.5 text-xs font-semibold text-[#F5F5F7]">
            <Clock className="h-3.5 w-3.5 text-[#0A84FF]" />
            <span className="tabular-nums">{formattedTimer}</span>
            <button
              type="button"
              onClick={() => setTimerActive((v) => !v)}
              aria-label={
                timerActive
                  ? isEn
                    ? "Pause timer"
                    : "Jeda timer"
                  : isEn
                    ? "Start timer"
                    : "Mulai timer"
              }
              className="ml-1 text-[#70BCFF] hover:text-white cursor-pointer"
            >
              {timerActive ? (
                <Pause className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setTimerActive(false);
                setSecondsLeft(pack.recommendedMinutes * 60);
              }}
              aria-label="Reset timer"
              className="text-[#8E8E93] hover:text-white cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
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
                  : "Membuat..."
                : isEn
                  ? `New ${targetLevel} Passage (AI)`
                  : `Soal ${targetLevel} Baru (AI)`}
            </span>
          </motion.button>
        </div>
      </div>

      {/* Mobile Passage / Questions Toggle */}
      <div className="lg:hidden grid grid-cols-2 rounded-full bg-white/[0.06] border border-white/[0.1] p-1">
        {(
          [
            { id: "passage", label: isEn ? "Passage" : "Teks Bacaan" },
            {
              id: "questions",
              label: isEn
                ? `Questions (${pack.questions.length})`
                : `Soal (${pack.questions.length})`,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobilePane(tab.id)}
            className={cn(
              "rounded-full py-2 text-xs font-semibold transition-colors cursor-pointer",
              mobilePane === tab.id
                ? "bg-white/[0.14] text-white"
                : "text-[#8E8E93]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Desktop Split View / Mobile Active Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Academic Passage + Evidence Highlighting + Select-to-Vault */}
        <div
          className={cn(
            "lg:col-span-6 liquid-glass rounded-3xl p-5 sm:p-6 space-y-4 lg:max-h-[72vh] lg:overflow-y-auto no-scrollbar",
            mobilePane === "questions" ? "hidden lg:block" : "block"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#8E8E93]">
              <BookOpen className="h-4 w-4 text-[#0A84FF]" />
              <span>
                {submitted
                  ? isEn
                    ? "Highlighted sentences show exact evidence for each question"
                    : "Kalimat yang disorot menunjukkan bukti jawaban tiap soal"
                  : isEn
                    ? "Highlight any unfamiliar phrase to save it to your Vault"
                    : "Blok kata sulit di teks untuk simpan ke Vault"}
              </span>
            </div>

            {selectedPhrase && (
              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                onClick={() => void handleSaveSelectedToVault()}
                disabled={savingToVault}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#30D158]/20 border border-[#30D158]/45 px-3 py-1 text-xs font-semibold text-[#7CF099] cursor-pointer"
              >
                {savingToVault ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <BookmarkPlus className="h-3 w-3" />
                )}
                <span>+ Save &ldquo;{selectedPhrase}&rdquo;</span>
              </motion.button>
            )}
          </div>

          {vaultSavedMsg && (
            <p className="rounded-full bg-[#30D158]/15 border border-[#30D158]/30 px-3 py-1 text-xs font-medium text-[#7CF099] inline-block">
              {vaultSavedMsg}
            </p>
          )}

          <div
            onMouseUp={handlePassageSelection}
            onTouchEnd={handlePassageSelection}
            onDoubleClick={handlePassageSelection}
            className="space-y-4 text-sm sm:text-[15px] leading-relaxed text-[#E5E5EA] select-text"
          >
            {pack.paragraphs.map((para, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.08] border border-white/[0.12] text-[10px] font-bold text-[#70BCFF]">
                  {PARAGRAPH_LABELS[idx] ?? idx + 1}
                </span>
                <p className="flex-1">
                  {submitted
                    ? renderParagraphWithEvidence(
                        para,
                        pack.questions,
                        focusedEvidenceId
                      )
                    : para}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: IELTS Questions & Explanations */}
        <div
          className={cn(
            "lg:col-span-6 space-y-3.5 lg:max-h-[72vh] lg:overflow-y-auto no-scrollbar",
            mobilePane === "passage" ? "hidden lg:block" : "block"
          )}
        >
          {submitted && resultBand !== null && (
            <div className="liquid-glass-elevated rounded-3xl p-5 flex items-center justify-between gap-3 border-[#30D158]/35">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#30D158]">
                  {isEn ? "IELTS Reading Result" : "Hasil Reading IELTS"}
                </p>
                <p className="text-xl font-bold text-white">
                  Est. Band {resultBand.toFixed(1)} ({correctCount}/
                  {pack.questions.length} {isEn ? "correct" : "benar"})
                </p>
              </div>
              <CheckCircle2 className="h-7 w-7 text-[#30D158] shrink-0" />
            </div>
          )}

          {pack.questions.map((q, qIdx) => {
            const userAns = answers[q.id] ?? "";
            const correct = submitted ? isQuestionCorrect(q, userAns) : false;
            const explanationText = isEn
              ? q.explanation_en || q.explanation_id
              : q.explanation_id || q.explanation_en;

            return (
              <div
                key={q.id}
                className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#70BCFF]">
                      Q{qIdx + 1} · {questionTypeLabel(q.type)}
                    </span>
                    {q.type === "fill_blank" && q.wordLimit && (
                      <span className="rounded-full bg-[#FF9F0A]/15 border border-[#FF9F0A]/30 px-2 py-0.5 text-[10px] font-bold uppercase text-[#FFD18C]">
                        {q.wordLimit}
                      </span>
                    )}
                    {q.paragraphRef && (
                      <span className="rounded-full bg-[#5E5CE6]/20 border border-[#5E5CE6]/35 px-2 py-0.5 text-[10px] font-semibold text-[#C4C2FF]">
                        {q.paragraphRef}
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

                {q.type === "fill_blank" ? (
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
                      q.wordLimit
                        ? isEn
                          ? `Write ${q.wordLimit.toLowerCase()} from the passage...`
                          : `Tulis ${q.wordLimit.toLowerCase()} dari teks...`
                        : isEn
                          ? "Type 1–2 words from the passage..."
                          : "Ketik 1–2 kata dari teks..."
                    }
                    className="w-full rounded-2xl bg-white/[0.05] border border-white/[0.12] px-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-[#8E8E93] focus:outline-none focus:border-[#0A84FF]/60"
                  />
                ) : (
                  <div
                    className={cn(
                      "grid gap-2",
                      q.type === "tfng" ? "grid-cols-3" : "grid-cols-1"
                    )}
                  >
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
                            "rounded-2xl border px-3 py-2 text-xs sm:text-sm font-medium text-left transition-colors cursor-pointer",
                            q.type === "tfng" && "text-center",
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
                  <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-[#7CF099]">
                        {isEn ? "Answer: " : "Jawaban: "}
                        {q.answer}
                      </p>
                      {q.evidence_quote && (
                        <button
                          type="button"
                          onClick={() => handleLocateEvidence(q.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-[#FF9F0A]/15 border border-[#FF9F0A]/35 px-2.5 py-0.5 text-[10px] font-semibold text-[#FFD18C] hover:bg-[#FF9F0A]/25 cursor-pointer"
                        >
                          <Highlighter className="h-3 w-3" />
                          <span>
                            {isEn ? "Highlight in Passage" : "Sorot di Teks"}
                          </span>
                        </button>
                      )}
                    </div>
                    {explanationText && (
                      <p className="text-[#D1D1D6] leading-relaxed">
                        {explanationText}
                      </p>
                    )}
                    {q.evidence_quote && (
                      <p className="text-[11px] italic text-[#70BCFF] pt-1 border-t border-white/[0.07]">
                        {isEn ? "Evidence: " : "Bukti teks: "}
                        &ldquo;{q.evidence_quote}&rdquo;
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {submitted && pack.keyVocabulary && pack.keyVocabulary.length > 0 && (
            <IeltsVocabStrip
              items={pack.keyVocabulary}
              title={
                isEn
                  ? "Key Reading Vocabulary (Save to Vault)"
                  : "Kosakata Penting Bacaan (Simpan ke Vault)"
              }
              sourceTag="ielts"
            />
          )}

          {!submitted && (
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => void handleSubmit()}
              className="w-full rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] py-3 text-sm font-semibold text-white cursor-pointer"
            >
              {isEn ? "Submit Reading Answers" : "Submit Jawaban Reading"}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
