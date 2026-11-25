import { CEFR_ORDER, roundToHalfBand } from "@/lib/ieltsUtils";
import type {
  CefrLevel,
  PlacementDiagnosticSummary,
  PlacementWritingGradeResult,
} from "@/types/ielts";

export interface ObjectiveResponseRecord {
  id: string;
  stage: "grammar" | "vocab" | "reading";
  cefr: CefrLevel;
  correct: boolean;
  skipped: boolean;
  skillTagEn: string;
  skillTagId: string;
}

const CEFR_BASE_BAND: Record<CefrLevel, number> = {
  A1: 3.0,
  A2: 4.0,
  B1: 5.0,
  B2: 6.0,
  C1: 7.5,
  C2: 8.5,
};

const CEFR_MAX_BAND: Record<CefrLevel, number> = {
  A1: 3.5,
  A2: 4.5,
  B1: 5.5,
  B2: 6.5,
  C1: 8.0,
  C2: 9.0,
};

export function stepCefrLevel(current: CefrLevel, delta: 1 | -1): CefrLevel {
  const idx = CEFR_ORDER.indexOf(current);
  const nextIdx = Math.max(0, Math.min(CEFR_ORDER.length - 1, idx + delta));
  return CEFR_ORDER[nextIdx];
}

function cefrIndex(level: CefrLevel): number {
  return CEFR_ORDER.indexOf(level);
}

function minCefr(a: CefrLevel, b: CefrLevel): CefrLevel {
  return cefrIndex(a) <= cefrIndex(b) ? a : b;
}

function computeAdaptiveStageBand(records: ObjectiveResponseRecord[]): number {
  if (records.length === 0) return 3.0;

  let weightedScore = 0;
  let maxPossible = 0;
  let highestPassedIdx = -1;
  let correctCount = 0;

  for (const r of records) {
    const idx = cefrIndex(r.cefr);
    const weight = 1 + idx * 0.45;
    maxPossible += weight;
    if (r.correct) {
      correctCount += 1;
      weightedScore += weight;
      if (idx > highestPassedIdx) highestPassedIdx = idx;
    }
  }

  if (correctCount === 0) return 2.5;

  const accuracyRatio = weightedScore / Math.max(1, maxPossible);
  const ceilingBand =
    highestPassedIdx >= 0
      ? CEFR_MAX_BAND[CEFR_ORDER[highestPassedIdx]]
      : 3.5;

  // Blend highest passed CEFR anchor with weighted accuracy so lucky single hits don't inflate
  const anchorBand =
    highestPassedIdx >= 0
      ? CEFR_BASE_BAND[CEFR_ORDER[highestPassedIdx]]
      : 3.0;
  const rawBand = anchorBand - 0.75 + accuracyRatio * 1.4;
  return roundToHalfBand(Math.max(2.5, Math.min(ceilingBand, rawBand)));
}

export function computeStrictPlacementResult(params: {
  responses: ObjectiveResponseRecord[];
  writingGrade: PlacementWritingGradeResult;
}): PlacementDiagnosticSummary {
  const { responses, writingGrade } = params;

  const grammarRecords = responses.filter((r) => r.stage === "grammar");
  const vocabRecords = responses.filter((r) => r.stage === "vocab");
  const readingRecords = responses.filter((r) => r.stage === "reading");

  const grammarBand = computeAdaptiveStageBand(grammarRecords);
  const vocabBand = computeAdaptiveStageBand(vocabRecords);
  const readingBand = computeAdaptiveStageBand(readingRecords);
  const writingBand = roundToHalfBand(
    Math.max(2.5, Math.min(9.0, writingGrade.band))
  );

  // Weighted composite: Writing (35%) + Grammar (30%) + Vocab (20%) + Reading (15%)
  let overallBand = roundToHalfBand(
    writingBand * 0.35 +
      grammarBand * 0.3 +
      vocabBand * 0.2 +
      readingBand * 0.15
  );

  // Strict band-to-CEFR mapping
  let finalCefr: CefrLevel =
    overallBand <= 3.5
      ? "A1"
      : overallBand <= 4.5
        ? "A2"
        : overallBand <= 5.5
          ? "B1"
          : overallBand <= 6.5
            ? "B2"
            : overallBand <= 8.0
              ? "C1"
              : "C2";

  let capReasonEn: string | null = null;
  let capReasonId: string | null = null;

  // HARD-CEILING RULE 1: Foundational Grammar Failure
  const missedA1Grammar = grammarRecords.filter(
    (r) => !r.correct && r.cefr === "A1"
  ).length;
  const missedA2Grammar = grammarRecords.filter(
    (r) => !r.correct && r.cefr === "A2"
  ).length;
  const missedB1OrLowerGrammar = grammarRecords.filter(
    (r) => !r.correct && cefrIndex(r.cefr) <= cefrIndex("B1")
  ).length;

  if (missedA1Grammar >= 1) {
    finalCefr = minCefr(finalCefr, "A1");
    overallBand = Math.min(overallBand, 3.5);
    capReasonEn =
      "Score capped at A1 due to missed foundational A1 grammar items.";
    capReasonId =
      "Skor dibatasi di A1 karena kesalahan pada struktur grammar dasar A1.";
  } else if (missedA2Grammar >= 1) {
    finalCefr = minCefr(finalCefr, "A2");
    overallBand = Math.min(overallBand, 4.5);
    capReasonEn =
      "Score capped at A2 due to missed foundational A2 grammar items.";
    capReasonId =
      "Skor dibatasi di A2 karena kesalahan pada struktur grammar dasar A2.";
  } else if (missedB1OrLowerGrammar >= 2) {
    finalCefr = minCefr(finalCefr, "B1");
    overallBand = Math.min(overallBand, 5.5);
    capReasonEn =
      "Score capped at B1 because core B1 grammar control is not yet consistent.";
    capReasonId =
      "Skor dibatasi di B1 karena penguasaan grammar inti B1 belum konsisten.";
  }

  // HARD-CEILING RULE 2: Micro-Writing Basic A1-A2 Errors or Low Writing Band
  if (writingGrade.has_basic_a1_a2_errors || writingBand <= 4.5) {
    const writingCap: CefrLevel = writingBand <= 3.5 ? "A1" : "A2";
    finalCefr = minCefr(finalCefr, writingCap);
    overallBand = Math.min(overallBand, CEFR_MAX_BAND[writingCap]);
    capReasonEn =
      capReasonEn ??
      `Score capped at ${writingCap} because Micro-Writing showed foundational sentence/grammar errors.`;
    capReasonId =
      capReasonId ??
      `Skor dibatasi di ${writingCap} karena Micro-Writing masih menunjukkan kesalahan struktur kalimat/grammar dasar.`;
  } else if (writingBand <= 5.5 && cefrIndex(finalCefr) > cefrIndex("B1")) {
    finalCefr = "B1";
    overallBand = Math.min(overallBand, 5.5);
    capReasonEn =
      capReasonEn ??
      "Score capped at B1 to match active written sentence control.";
    capReasonId =
      capReasonId ??
      "Skor dibatasi di B1 agar selaras dengan kontrol penulisan aktifmu.";
  }

  // Ensure overallBand strictly matches finalCefr's realistic range
  overallBand = roundToHalfBand(
    Math.max(2.5, Math.min(CEFR_MAX_BAND[finalCefr], overallBand))
  );

  // Build Top 3 Specific Weaknesses from missed objective skill tags + AI writing weaknesses
  const weaknessPairs: Array<{ en: string; id: string }> = [];
  const seenEn = new Set<string>();

  const pushWeakness = (en: string, id: string) => {
    const norm = en.trim().toLowerCase();
    if (!norm || seenEn.has(norm) || weaknessPairs.length >= 3) return;
    seenEn.add(norm);
    weaknessPairs.push({ en: en.trim(), id: id.trim() || en.trim() });
  };

  for (let i = 0; i < writingGrade.weaknesses_en.length; i += 1) {
    pushWeakness(
      writingGrade.weaknesses_en[i],
      writingGrade.weaknesses_id[i] ?? writingGrade.weaknesses_en[i]
    );
  }

  const missedObjective = responses
    .filter((r) => !r.correct)
    .sort((a, b) => cefrIndex(a.cefr) - cefrIndex(b.cefr));
  for (const m of missedObjective) {
    pushWeakness(m.skillTagEn, m.skillTagId);
  }

  if (weaknessPairs.length < 3) {
    const fallbacks: Array<{ en: string; id: string }> = [
      {
        en: "Complex clause linking & syntactic variety in writing",
        id: "Penggunaan klausa kompleks & variasi struktur kalimat dalam menulis",
      },
      {
        en: "Precision with high-register verb-noun collocations",
        id: "Ketepatan kolokasi kata kerja–kata benda bernuansa akademik",
      },
      {
        en: "Nuanced reading inference beyond literal details",
        id: "Inferensi bacaan bernuansa di luar informasi literal",
      },
    ];
    for (const fb of fallbacks) {
      pushWeakness(fb.en, fb.id);
    }
  }

  return {
    cefr: finalCefr,
    estimatedBand: overallBand,
    subScores: {
      grammar: grammarBand,
      vocabulary: vocabBand,
      reading: readingBand,
      writing: writingBand,
    },
    weaknessesEn: weaknessPairs.map((w) => w.en),
    weaknessesId: weaknessPairs.map((w) => w.id),
    capReasonEn,
    capReasonId,
    writingSummaryEn: writingGrade.summary_en,
    writingSummaryId: writingGrade.summary_id,
  };
}
