import type { AppLanguage } from "@/lib/i18n";
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
  keywords: string[] = [],
  lang: AppLanguage = "id"
): { score: number; feedback: string } {
  const pick = (en: string, id: string, ru: string) =>
    lang === "en" ? en : lang === "ru" ? ru : id;
  const clean = userAnswer.trim();
  const words = countWords(clean);
  if (words < 5) {
    return {
      score: 0,
      feedback: pick(
        "Paraphrase is too short. Rewrite the original sentence using different vocabulary.",
        "Parafrase terlalu singkat. Tulis ulang makna kalimat asli dengan kosakata berbeda.",
        "Перефраз слишком короткий. Передай смысл исходного предложения другими словами."
      ),
    };
  }

  const normOrig = normalizeShortAnswer(original);
  const normUser = normalizeShortAnswer(clean);
  if (normUser === normOrig) {
    return {
      score: 0.25,
      feedback: pick(
        "Your sentence is almost identical to the original. Use synonyms and vary sentence structure.",
        "Kalimat hampir identik dengan kalimat asli. Gunakan sinonim dan ubah struktur kalimat.",
        "Предложение почти совпадает с оригиналом. Используй синонимы и измени структуру фразы."
      ),
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
        ? pick(
            "Accurate paraphrase — core meaning preserved with a fresh sentence structure.",
            "Parafrase akurat — makna utama tersampaikan dengan struktur kalimat baru.",
            "Точный перефраз — главный смысл передан новой структурой предложения."
          )
        : pick(
            "Core meaning comes through; vary academic synonyms further for a more natural tone.",
            "Makna cukup tertangkap; coba variasikan sinonim akademik agar lebih natural.",
            "Основная мысль передана; попробуй подобрать более точные академические синонимы."
          ),
  };
}

export function gradeWritingHeuristic(
  task: WritingTaskPack,
  essay: string,
  lang: AppLanguage = "id"
): WritingGradeResult {
  const pick = (en: string, id: string, ru: string) =>
    lang === "en" ? en : lang === "ru" ? ru : id;
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

  const lengthRatio = Math.min(1.05, words / Math.max(1, task.minWords));
  const rawTask =
    words < task.minWords * 0.45
      ? 3.5
      : words < task.minWords * 0.75
        ? 4.5
        : 4.0 + Math.min(2.5, lengthRatio * 2.5);
  const taskScore = roundToHalfBand(Math.max(3.0, Math.min(7.5, rawTask)));

  const coherenceScore = roundToHalfBand(
    Math.max(
      3.0,
      Math.min(
        7.5,
        3.5 +
          (sentences.length >= 6 ? 2.0 : sentences.length * 0.35) +
          (words >= task.minWords ? 1.0 : 0)
      )
    )
  );
  const lexicalScore = roundToHalfBand(
    Math.max(3.0, Math.min(7.5, 3.5 + Math.min(3.0, uniqueTokens.size / 26)))
  );
  const grammarScore = roundToHalfBand(
    Math.max(
      3.0,
      Math.min(
        7.5,
        3.5 +
          (sentences.length >= 5 ? 1.8 : 0.8) +
          (words >= task.minWords * 0.85 ? 0.8 : 0)
      )
    )
  );

  const overall = roundToHalfBand(
    (taskScore + coherenceScore + lexicalScore + grammarScore) / 4
  );
  const targetUpgradeBand = roundToHalfBand(Math.min(9.0, overall + 1.0));

  const firstSentence =
    sentences[0] ||
    "The presented information shows noticeable variations across categories.";

  const upgradedVocab =
    task.taskType === "task1"
      ? [
          {
            term: "pronounced divergence",
            note: "Clear, sharp difference between trends",
            cefr: "C1" as const,
            category: "collocation" as const,
          },
          {
            term: "accounted for",
            note: "Represented a specific share/percentage",
            cefr: "B2" as const,
            category: "collocation" as const,
          },
          {
            term: "contracted markedly",
            note: "Decreased significantly over time",
            cefr: "C1" as const,
            category: "collocation" as const,
          },
        ]
      : [
          {
            term: "long-term societal trade-offs",
            note: "Lasting compromises affecting society",
            cefr: "C1" as const,
            category: "collocation" as const,
          },
          {
            term: "warrant careful regulation",
            note: "Justify thoughtful government oversight",
            cefr: "C1" as const,
            category: "collocation" as const,
          },
          {
            term: "compelling argument",
            note: "Strong, persuasive line of reasoning",
            cefr: "B2" as const,
            category: "collocation" as const,
          },
        ];

  return {
    overall_band: overall,
    criteria: {
      task_response: taskScore,
      coherence_cohesion: coherenceScore,
      lexical_resource: lexicalScore,
      grammatical_range: grammarScore,
    },
    criteria_feedback: {
      task_response:
        words < task.minWords
          ? `Under the ${task.minWords}-word minimum (${words} words), which caps Task ${task.taskType === "task1" ? "Achievement" : "Response"}. Develop all parts of the prompt with specific support.`
          : `Meets the ${task.minWords}-word minimum (${words} words) and addresses the core prompt; deepen analytical precision to reach higher bands.`,
      coherence_cohesion:
        sentences.length < 5
          ? "Limited paragraph progression and linking devices. Organize ideas into distinct introduction, body, and overview/conclusion paragraphs."
          : "Basic progression is visible; strengthen topic sentences and varied cohesive devices beyond repetitive connectors.",
      lexical_resource:
        uniqueTokens.size < 45
          ? "Relies heavily on common, repetitive vocabulary. Introduce more precise academic collocations and synonyms."
          : "Adequate range of topic vocabulary; refine collocation accuracy and avoid informal phrasing.",
      grammatical_range:
        "Mix complex structures (subordinate clauses, conditionals, passive voice) while maintaining accurate verb tense and subject-verb agreement.",
    },
    summary_id:
      words < task.minWords
        ? pick(
            `Your response has ${words} words (below the ${task.minWords}-word minimum), which strictly caps your IELTS score under the rubric. Expand your supporting details and re-evaluate once AI connection is active.`,
            `Tulisanmu berjumlah ${words} kata (di bawah target minimal ${task.minWords} kata), sehingga skor dibatasi secara ketat sesuai rubrik IELTS. Kembangkan argumen/rincian data dan coba evaluasi ulang saat koneksi AI aktif.`,
            `В твоём ответе ${words} слов (ниже минимума в ${task.minWords} слов), что строго ограничивает балл по критериям IELTS. Разверни аргументы и детали, а затем проверь снова при активном ИИ.`
          )
        : pick(
            `Your response has ${words} words and meets the ${task.minWords}-word minimum. Sharpen academic collocation precision and complex sentence variety to push toward Band ${targetUpgradeBand.toFixed(1)}.`,
            `Tulisanmu berjumlah ${words} kata dan sudah memenuhi panjang minimal ${task.minWords} kata. Perkuat presisi kolokasi akademik dan variasi struktur kalimat kompleks untuk naik ke Band ${targetUpgradeBand.toFixed(1)}.`,
            `В твоём ответе ${words} слов — минимальный объём в ${task.minWords} слов выполнен. Усиль точность академических сочетаний и разнообразие сложных конструкций, чтобы выйти на Band ${targetUpgradeBand.toFixed(1)}.`
          ),
    inline_errors: [
      {
        original: firstSentence,
        corrected:
          task.taskType === "task1"
            ? "Overall, the data reveals a pronounced divergence across the surveyed categories over the given period."
            : "While rapid change brings undeniable convenience, its long-term societal trade-offs warrant careful regulation.",
        reason:
          "Elevates vague phrasing into concise, objective IELTS Academic register with precise collocations.",
      },
    ],
    sentence_upgrades: [
      {
        original: firstSentence,
        improved:
          task.taskType === "task1"
            ? "Overall, the data reveals a pronounced divergence across the surveyed categories over the given period."
            : "While rapid technological adoption brings undeniable convenience, its long-term societal trade-offs warrant careful regulation.",
        reason_id: pick(
          "Uses tighter, more objective Band 8.0+ academic phrasing with complex clause structure.",
          "Menggunakan frasa akademik yang lebih ringkas, objektif, dan berstruktur klausa kompleks khas Band 8.0+.",
          "Более точная и объективная академическая формулировка уровня Band 8.0+ со сложной структурой предложения."
        ),
      },
    ],
    plus_one_band_rewrite:
      task.taskType === "task1"
        ? `Overall, the chart highlights a **pronounced divergence** across the categories over the surveyed period. Whereas the leading category **accounted for** the largest share initially, traditional options **contracted markedly** as newer alternatives gained momentum.`
        : `Although modern developments offer clear advantages, their **long-term societal trade-offs** **warrant careful regulation**. A **compelling argument** can be made for balanced policies that protect both innovation and public wellbeing.`,
    target_upgrade_band: targetUpgradeBand,
    upgraded_vocabulary: upgradedVocab,
    band_85_sample: task.fallbackBand85Sample,
    modelUsed: "heuristic-fallback",
  };
}
