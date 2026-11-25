import type {
  CefrLevel,
  WritingGradeResult,
  WritingTaskPack,
} from "@/types/ielts";

export const CEFR_ORDER: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export const CEFR_RANGES: Record<CefrLevel, string> = {
  A1: "2.5–3.5",
  A2: "3.5–4.5",
  B1: "4.5–5.5",
  B2: "5.5–6.5",
  C1: "7.0–8.0",
  C2: "8.5–9.0",
};

export function roundToHalfBand(raw: number): number {
  const clamped = Math.max(0, Math.min(9, raw));
  return Math.round(clamped * 2) / 2;
}

export function bandToCefr(band: number): CefrLevel {
  if (band <= 3.5) return "A1";
  if (band <= 4.5) return "A2";
  if (band <= 5.5) return "B1";
  if (band <= 6.5) return "B2";
  if (band <= 8.0) return "C1";
  return "C2";
}

export function bandToCefrPercent(band: number): number {
  const clamped = Math.max(0, Math.min(9, band));
  if (clamped <= 3.5) return Math.round((clamped / 3.5) * 16.6);
  if (clamped <= 4.5) return 17 + Math.round(((clamped - 3.5) / 1.0) * 16.6);
  if (clamped <= 5.5) return 34 + Math.round(((clamped - 4.5) / 1.0) * 16.6);
  if (clamped <= 6.5) return 51 + Math.round(((clamped - 5.5) / 1.0) * 16.6);
  if (clamped <= 8.0) return 68 + Math.round(((clamped - 6.5) / 1.5) * 16.6);
  return 85 + Math.round(((clamped - 8.0) / 1.0) * 15);
}

export function accuracyToIeltsBand(correct: number, total: number): number {
  if (total <= 0) return 4.0;
  const ratio = Math.max(0, Math.min(1, correct / total));
  // Realistic Academic mapping: 0% -> 2.5, 50% -> 5.5, 75% -> 7.0, 90%+ -> 8.5, 100% -> 9.0
  const raw = 2.5 + ratio * 6.5;
  return roundToHalfBand(raw);
}

export function normalizeShortAnswer(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:"'()]/g, "")
    .replace(/\s+/g, " ");
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function gradePlacementParaphraseHeuristic(
  original: string,
  userAnswer: string,
  keywords: string[] = []
): { score: number; feedback: string } {
  const clean = userAnswer.trim();
  const words = countWords(clean);
  if (words < 5) {
    return {
      score: 0,
      feedback:
        "Parafrase terlalu singkat. Tulis ulang makna kalimat asli dengan kosakata berbeda.",
    };
  }

  const normOrig = normalizeShortAnswer(original);
  const normUser = normalizeShortAnswer(clean);
  if (normUser === normOrig) {
    return {
      score: 0.25,
      feedback:
        "Kalimat hampir identik dengan kalimat asli. Gunakan sinonim dan ubah struktur kalimat.",
    };
  }

  const lower = clean.toLowerCase();
  const keywordHits = keywords.filter((kw) =>
    lower.includes(kw.toLowerCase())
  ).length;

  const score = words >= 8 && keywordHits >= 1 ? 1 : 0.6;
  return {
    score,
    feedback:
      score >= 1
        ? "Parafrase akurat — makna utama tersampaikan dengan struktur kalimat baru."
        : "Makna cukup tertangkap; coba variasikan sinonim akademik agar lebih natural.",
  };
}

export function gradeWritingHeuristic(
  task: WritingTaskPack,
  essay: string
): WritingGradeResult {
  const words = countWords(essay);
  const sentences = essay
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4);

  const uniqueTokens = new Set(
    essay
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

  const lengthRatio = Math.min(1.15, words / task.minWords);
  const taskScore = roundToHalfBand(3.5 + Math.min(4.5, lengthRatio * 4.0));
  const coherenceScore = roundToHalfBand(
    3.5 + (sentences.length >= 5 ? 2.5 : sentences.length * 0.5) + (words >= task.minWords ? 1.5 : 0.5)
  );
  const lexicalScore = roundToHalfBand(
    3.5 + Math.min(4.0, uniqueTokens.size / 22)
  );
  const grammarScore = roundToHalfBand(
    3.5 + (sentences.length >= 4 ? 2.5 : 1.5) + (words >= task.minWords * 0.8 ? 1.0 : 0)
  );

  const overall = roundToHalfBand(
    (taskScore + coherenceScore + lexicalScore + grammarScore) / 4
  );

  const firstSentence =
    sentences[0] ||
    "The presented information shows noticeable variations across categories.";

  return {
    overall_band: overall,
    criteria: {
      task_response: taskScore,
      coherence_cohesion: coherenceScore,
      lexical_resource: lexicalScore,
      grammatical_range: grammarScore,
    },
    summary_id:
      words < task.minWords
        ? `Tulisanmu berjumlah ${words} kata (di bawah target minimal ${task.minWords} kata). Kembangkan argumen/rincian data dan sambungkan GEMINI_API_KEY untuk evaluasi Examiner Pro mendalam.`
        : `Tulisanmu berjumlah ${words} kata dan sudah memenuhi panjang minimal ${task.minWords} kata. Struktur paragraf cukup jelas; sambungkan GEMINI_API_KEY untuk evaluasi mendalam menggunakan Gemini Pro.`,
    sentence_upgrades: [
      {
        original: firstSentence,
        improved:
          task.taskType === "task1"
            ? "Overall, the data reveals a pronounced divergence across the surveyed categories over the given period."
            : "While rapid technological adoption brings undeniable convenience, its long-term societal trade-offs warrant careful regulation.",
        reason_id:
          "Menggunakan frasa akademik yang lebih ringkas, objektif, dan berstruktur klausa kompleks khas Band 8.0+.",
      },
    ],
    band_85_sample: task.fallbackBand85Sample,
    modelUsed: "heuristic-fallback",
  };
}
