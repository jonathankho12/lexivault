"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Award,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useLexiVault } from "@/context/LexiVaultContext";
import { FALLBACK_WRITING_PACKS } from "@/lib/ieltsMockData";
import { saveSkillAttempt } from "@/lib/ieltsStorage";
import { countWords } from "@/lib/ieltsUtils";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type {
  IeltsAttempt,
  IeltsProfile,
  WritingChartData,
  WritingGradeResult,
  WritingTaskPack,
} from "@/types/ielts";

function Task1ChartBlock({ data }: { data: WritingChartData }) {
  const maxVal = useMemo(() => {
    const all = data.rows.flatMap((r) => r.values);
    return Math.max(10, ...all);
  }, [data]);

  const rowColors = ["#0A84FF", "#30D158", "#5E5CE6", "#FF9F0A"];

  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.09] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-[#70BCFF]" />
          <h4 className="text-xs sm:text-sm font-semibold text-white">
            {data.title}
          </h4>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          {data.rows.map((r, rIdx) => (
            <span key={r.label} className="inline-flex items-center gap-1.5 text-[#D1D1D6]">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: rowColors[rIdx % rowColors.length] }}
              />
              {r.label}
            </span>
          ))}
        </div>
      </div>

      {/* Responsive Bar Visual */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        {data.columns.map((col, cIdx) => (
          <div
            key={col}
            className="rounded-2xl bg-black/30 border border-white/[0.06] p-3 space-y-2"
          >
            <p className="text-[11px] font-semibold text-[#D1D1D6] truncate">
              {col}
            </p>
            <div className="space-y-1.5">
              {data.rows.map((row, rIdx) => {
                const val = row.values[cIdx] ?? 0;
                const pct = Math.max(8, Math.round((val / maxVal) * 100));
                return (
                  <div key={row.label} className="space-y-0.5">
                    <div className="flex justify-between text-[10px] text-[#8E8E93]">
                      <span>{row.label}</span>
                      <span className="font-semibold text-white">
                        {val}
                        {data.unit}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: rowColors[rIdx % rowColors.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Clean Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/[0.1] text-[#8E8E93]">
              <th className="py-2 pr-3 font-medium">Periode</th>
              {data.columns.map((col) => (
                <th key={col} className="py-2 px-2 font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr
                key={row.label}
                className="border-b border-white/[0.06] last:border-b-0 text-[#F5F5F7]"
              >
                <td className="py-2 pr-3 font-semibold">{row.label}</td>
                {row.values.map((val, idx) => (
                  <td key={idx} className="py-2 px-2 tabular-nums">
                    {val}
                    {data.unit}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function IeltsWritingPanel({
  onProfileUpdated,
}: {
  onProfileUpdated: (profile: IeltsProfile, attempts: IeltsAttempt[]) => void;
}) {
  const { user, todayStr, syncExternalStudyLog } = useLexiVault();

  const [taskType, setTaskType] = useState<"task1" | "task2">("task2");
  const [pack, setPack] = useState<WritingTaskPack>(
    () =>
      FALLBACK_WRITING_PACKS.find((p) => p.taskType === "task2") ??
      FALLBACK_WRITING_PACKS[0]
  );
  const [seenIds, setSeenIds] = useState<string[]>([pack.id]);
  const [generating, setGenerating] = useState(false);

  const [essay, setEssay] = useState("");
  const [showTips, setShowTips] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<WritingGradeResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [secondsLeft, setSecondsLeft] = useState(pack.recommendedMinutes * 60);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    if (!timerActive || grade) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [timerActive, grade]);

  const wordCount = useMemo(() => countWords(essay), [essay]);
  const targetMet = wordCount >= pack.minWords;

  const switchTaskType = (nextType: "task1" | "task2") => {
    setTaskType(nextType);
    const defaultPack =
      FALLBACK_WRITING_PACKS.find((p) => p.taskType === nextType) ??
      FALLBACK_WRITING_PACKS[0];
    setPack(defaultPack);
    setEssay("");
    setGrade(null);
    setErrorMsg(null);
    setShowSample(false);
    setTimerActive(false);
    setSecondsLeft(defaultPack.recommendedMinutes * 60);
  };

  const handleGenerateNew = async () => {
    if (generating) return;
    setGenerating(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ielts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill: "writing",
          taskType,
          excludeIds: seenIds,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { pack: WritingTaskPack };
        if (json.pack) {
          setPack(json.pack);
          setSeenIds((prev) => [...prev, json.pack.id]);
          setEssay("");
          setGrade(null);
          setShowSample(false);
          setTimerActive(false);
          setSecondsLeft((json.pack.recommendedMinutes || 30) * 60);
        }
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitEssay = async () => {
    if (grading || wordCount < 15) return;
    setGrading(true);
    setErrorMsg(null);
    setTimerActive(false);

    try {
      const res = await fetch("/api/ielts/grade-writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: pack,
          essay: essay.trim(),
        }),
      });
      if (!res.ok) throw new Error("Grading failed");
      const json = (await res.json()) as { result: WritingGradeResult };
      setGrade(json.result);

      if (user) {
        const saved = await saveSkillAttempt(
          user.id,
          "writing",
          json.result.overall_band,
          {
            packId: pack.id,
            taskType: pack.taskType,
            title: pack.title,
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
      setErrorMsg("Gagal menilai esai. Coba kirim ulang.");
    } finally {
      setGrading(false);
    }
  };

  const formattedTimer = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(
    secondsLeft % 60
  ).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      {/* Task Type & Timer Toolbar */}
      <div className="liquid-glass rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/[0.1] p-1">
          {(
            [
              { id: "task1", label: "Task 1 · Data Report" },
              { id: "task2", label: "Task 2 · Essay" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => switchTaskType(opt.id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                taskType === opt.id
                  ? "bg-[#0A84FF] text-white"
                  : "text-[#8E8E93] hover:text-white"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] px-3 py-1.5 text-xs font-semibold text-[#F5F5F7]">
            <Clock className="h-3.5 w-3.5 text-[#0A84FF]" />
            <span className="tabular-nums">{formattedTimer}</span>
            <button
              type="button"
              onClick={() => setTimerActive((v) => !v)}
              aria-label={timerActive ? "Jeda timer" : "Mulai timer"}
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
            <span>{generating ? "Membuat..." : "Generate Soal Baru (AI)"}</span>
          </motion.button>
        </div>
      </div>

      {/* Prompt Card */}
      <div className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#70BCFF]">
            {pack.title}
          </span>
          <p className="text-sm sm:text-[15px] leading-relaxed text-[#F5F5F7]">
            {pack.prompt}
          </p>
        </div>

        {pack.chartData && <Task1ChartBlock data={pack.chartData} />}

        {/* Outline Tips Accordion */}
        <div>
          <button
            type="button"
            onClick={() => setShowTips((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#70BCFF] hover:text-white cursor-pointer"
          >
            <span>{showTips ? "Sembunyikan" : "Lihat"} Outline Tips</span>
            {showTips ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {showTips && (
            <ul className="mt-2.5 space-y-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3.5 text-xs text-[#D1D1D6]">
              {pack.outlineTips.map((tip, idx) => (
                <li key={idx}>• {tip}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Writing Editor */}
      <div className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#8E8E93]">
            Tulis jawaban akademikmu di bawah:
          </span>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border",
              targetMet
                ? "bg-[#30D158]/20 border-[#30D158]/40 text-[#7CF099]"
                : "bg-white/[0.06] border-white/[0.1] text-[#F5F5F7]"
            )}
          >
            {targetMet && <CheckCircle2 className="h-3.5 w-3.5" />}
            {wordCount} / {pack.minWords} kata minimal
          </span>
        </div>

        <textarea
          rows={10}
          value={essay}
          onChange={(e) => setEssay(e.target.value)}
          disabled={grading}
          placeholder={`Mulai menulis ${
            pack.taskType === "task1" ? "laporan data Task 1" : "esai Task 2"
          } (minimal ${pack.minWords} kata untuk hasil penilaian optimal)...`}
          className="w-full resize-y rounded-2xl bg-black/35 border border-white/[0.1] p-4 text-base leading-relaxed text-[#F5F5F7] placeholder:text-[#8E8E93]/70 focus:outline-none focus:border-[#0A84FF]/60"
        />

        {errorMsg && <p className="text-xs text-[#FF8982]">{errorMsg}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-[#8E8E93]">
            Dinilai berdasarkan 4 rubrik resmi IELTS menggunakan Gemini Pro
            Examiner (auto-fallback Flash).
          </span>

          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            disabled={grading || wordCount < 15}
            onClick={() => void handleSubmitEssay()}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] px-5 py-2.5 text-sm font-semibold text-white cursor-pointer disabled:opacity-50"
          >
            {grading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>AI Examiner Menilai...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Nilai dengan AI Examiner</span>
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* AI Examiner Result */}
      {grade && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={IOS_SPRING}
          className="liquid-glass-elevated rounded-3xl p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#30D158]/20 border border-[#30D158]/40">
                <Award className="h-6 w-6 text-[#30D158]" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#30D158]">
                  IELTS Writing Band Score
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

          {/* 4 Official Criteria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              [
                {
                  label:
                    pack.taskType === "task1"
                      ? "Task Achievement"
                      : "Task Response",
                  score: grade.criteria.task_response,
                },
                {
                  label: "Coherence & Cohesion",
                  score: grade.criteria.coherence_cohesion,
                },
                {
                  label: "Lexical Resource",
                  score: grade.criteria.lexical_resource,
                },
                {
                  label: "Grammatical Range & Accuracy",
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

          {/* Examiner Summary */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
              Evaluasi Examiner
            </p>
            <p className="text-sm leading-relaxed text-[#F5F5F7]">
              {grade.summary_id}
            </p>
          </div>

          {/* Specific Sentence Upgrades */}
          {grade.sentence_upgrades.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">
                Koreksi &amp; Upgrade Kalimat ke C1/C2
              </p>
              {grade.sentence_upgrades.map((up, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4 space-y-2 text-xs sm:text-sm"
                >
                  <p className="text-[#FF8982] line-through opacity-85">
                    {up.original}
                  </p>
                  <p className="flex items-start gap-1.5 font-medium text-[#7CF099]">
                    <ArrowRight className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{up.improved}</span>
                  </p>
                  <p className="text-xs text-[#8E8E93]">{up.reason_id}</p>
                </div>
              ))}
            </div>
          )}

          {/* Band 8.5+ Model Essay */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowSample((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF]/15 border border-[#0A84FF]/35 px-4 py-2 text-xs font-semibold text-[#70BCFF] cursor-pointer"
            >
              <span>
                {showSample
                  ? "Sembunyikan Referensi Band 8.5+"
                  : "Lihat Contoh Revisi Band 8.5+"}
              </span>
              {showSample ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {showSample && (
              <div className="mt-3 rounded-2xl bg-[#0A84FF]/10 border border-[#0A84FF]/25 p-4 text-xs sm:text-sm leading-relaxed text-[#F5F5F7] whitespace-pre-line">
                {grade.band_85_sample}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
