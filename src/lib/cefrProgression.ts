import {
  getDailyPackTierMeta,
  mapCefrToDailyPackTier,
} from "@/lib/dailyPackTiers";
import { CEFR_ORDER, CEFR_RANGES } from "@/lib/ieltsUtils";
import { formatCefrBadgeClass, normalizeCefrLevel } from "@/lib/utils";
import type {
  CefrLevel,
  DailyPackTargetTier,
  StudyLog,
  WordEntry,
} from "@/types/lexivault";

export interface CefrLevelMeta {
  level: CefrLevel;
  titleEn: string;
  titleId: string;
  canDoEn: string;
  canDoId: string;
  dailyPackTier: DailyPackTargetTier;
  dailyPackPreviewLabel: string;
  ieltsBandRange: string;
  badgeClass: string;
}

export const CEFR_LEVEL_META: readonly CefrLevelMeta[] = [
  {
    level: "A1",
    titleEn: "Beginner",
    titleId: "Pemula",
    canDoEn:
      "Understand familiar everyday phrases, basic greetings, and simple personal questions.",
    canDoId:
      "Memahami frasa sehari-hari yang familier, sapaan dasar, dan kalimat perkenalan sederhana.",
    dailyPackTier: mapCefrToDailyPackTier("A1"),
    dailyPackPreviewLabel: getDailyPackTierMeta(mapCefrToDailyPackTier("A1"))
      .displayLabel,
    ieltsBandRange: CEFR_RANGES.A1,
    badgeClass: formatCefrBadgeClass("A1"),
  },
  {
    level: "A2",
    titleEn: "Elementary",
    titleId: "Dasar",
    canDoEn:
      "Handle routine daily conversations, short messages, and straightforward travel or work tasks.",
    canDoId:
      "Menangani percakapan rutin harian, pesan singkat, dan situasi kerja atau perjalanan sederhana.",
    dailyPackTier: mapCefrToDailyPackTier("A2"),
    dailyPackPreviewLabel: getDailyPackTierMeta(mapCefrToDailyPackTier("A2"))
      .displayLabel,
    ieltsBandRange: CEFR_RANGES.A2,
    badgeClass: formatCefrBadgeClass("A2"),
  },
  {
    level: "B1",
    titleEn: "Intermediate",
    titleId: "Menengah",
    canDoEn:
      "Express opinions clearly on work, study, and familiar topics and follow main points in articles.",
    canDoId:
      "Menyampaikan opini secara jelas tentang pekerjaan, studi, serta memahami inti artikel umum.",
    dailyPackTier: mapCefrToDailyPackTier("B1"),
    dailyPackPreviewLabel: getDailyPackTierMeta(mapCefrToDailyPackTier("B1"))
      .displayLabel,
    ieltsBandRange: CEFR_RANGES.B1,
    badgeClass: formatCefrBadgeClass("B1"),
  },
  {
    level: "B2",
    titleEn: "Upper-Intermediate",
    titleId: "Menengah Atas",
    canDoEn:
      "Interact fluently with native-level clarity, debate complex viewpoints, and write structured arguments.",
    canDoId:
      "Berkomunikasi lancar, berdiskusi tentang ide kompleks, dan menyusun argumen terstruktur.",
    dailyPackTier: mapCefrToDailyPackTier("B2"),
    dailyPackPreviewLabel: getDailyPackTierMeta(mapCefrToDailyPackTier("B2"))
      .displayLabel,
    ieltsBandRange: CEFR_RANGES.B2,
    badgeClass: formatCefrBadgeClass("B2"),
  },
  {
    level: "C1",
    titleEn: "Advanced",
    titleId: "Mahir",
    canDoEn:
      "Use idiomatic, nuanced academic and professional English naturally across demanding contexts.",
    canDoId:
      "Menggunakan bahasa Inggris akademik & profesional bernuansa idiomatik secara alami dan presisi.",
    dailyPackTier: mapCefrToDailyPackTier("C1"),
    dailyPackPreviewLabel: getDailyPackTierMeta(mapCefrToDailyPackTier("C1"))
      .displayLabel,
    ieltsBandRange: CEFR_RANGES.C1,
    badgeClass: formatCefrBadgeClass("C1"),
  },
  {
    level: "C2",
    titleEn: "Proficiency",
    titleId: "Profisiensi",
    canDoEn:
      "Command near-native precision, subtle rhetoric, rare idioms, and effortless high-register synthesis.",
    canDoId:
      "Menguasai presisi setara penutur asli, retorika halus, idiom langka, dan register tinggi.",
    dailyPackTier: mapCefrToDailyPackTier("C2"),
    dailyPackPreviewLabel: getDailyPackTierMeta(mapCefrToDailyPackTier("C2"))
      .displayLabel,
    ieltsBandRange: CEFR_RANGES.C2,
    badgeClass: formatCefrBadgeClass("C2"),
  },
];

export const STARTER_WORD_TERMS = new Set<string>([
  "bear the brunt",
  "play devil's advocate",
  "burn the midnight oil",
  "ubiquitous",
  "ambivalent",
]);

export function getCefrMeta(level: CefrLevel): CefrLevelMeta {
  return (
    CEFR_LEVEL_META.find((item) => item.level === level) ?? CEFR_LEVEL_META[2]
  );
}

export function getNextCefrLevel(current: CefrLevel): CefrLevel | null {
  const idx = CEFR_ORDER.indexOf(current);
  if (idx < 0 || idx >= CEFR_ORDER.length - 1) return null;
  return CEFR_ORDER[idx + 1];
}

interface PromotionThreshold {
  minMastered: number;
  minAccuracyPct: number;
  minReviews: number;
  minSessions: number;
}

const PROMOTION_THRESHOLDS: Record<
  Exclude<CefrLevel, "C2">,
  PromotionThreshold
> = {
  A1: { minMastered: 12, minAccuracyPct: 80, minReviews: 15, minSessions: 3 },
  A2: { minMastered: 20, minAccuracyPct: 80, minReviews: 25, minSessions: 4 },
  B1: { minMastered: 30, minAccuracyPct: 80, minReviews: 35, minSessions: 5 },
  B2: { minMastered: 40, minAccuracyPct: 80, minReviews: 50, minSessions: 7 },
  C1: { minMastered: 50, minAccuracyPct: 80, minReviews: 70, minSessions: 10 },
};

export interface CefrPromotionStatus {
  currentLevel: CefrLevel;
  nextLevel: CefrLevel | null;
  isMaxLevel: boolean;
  isReady: boolean;
  masteredAtOrAboveCount: number;
  reviewedAtOrAboveCount: number;
  requiredMasteredCount: number;
  accuracyPct: number;
  requiredAccuracyPct: number;
  totalReviews: number;
  requiredMinReviews: number;
  consistencyCount: number;
  requiredConsistencyCount: number;
  masteryMet: boolean;
  accuracyMet: boolean;
  consistencyMet: boolean;
  overallProgressPct: number;
}

/**
 * Evaluates readiness for promoting to the next CEFR tier using live Vault mastery,
 * recall quiz accuracy, and streak / active study-session milestones.
 */
export function computeCefrPromotionStatus(params: {
  currentLevel: CefrLevel;
  words: WordEntry[];
  studyLogs: StudyLog[];
  streak: number;
}): CefrPromotionStatus {
  const { currentLevel, words, studyLogs, streak } = params;
  const nextLevel = getNextCefrLevel(currentLevel);

  const currentIdx = CEFR_ORDER.indexOf(currentLevel);
  let masteredAtOrAboveCount = 0;
  let reviewedAtOrAboveCount = 0;

  for (const w of words) {
    const wordCefr = normalizeCefrLevel(w.cefr);
    if (!wordCefr) continue;
    const wordIdx = CEFR_ORDER.indexOf(wordCefr);
    if (wordIdx < currentIdx) continue;

    const correct = w.correct_count || 0;
    const wrong = w.wrong_count || 0;
    const totalAttempts = correct + wrong;
    const reviewCount = Math.max(totalAttempts, w.review_count ?? 0);

    if (reviewCount >= 1) {
      reviewedAtOrAboveCount += 1;
    }

    const isMastered =
      (totalAttempts >= 2 && correct / totalAttempts >= 0.7) ||
      ((w.repetitions ?? 0) >= 2 && correct >= wrong) ||
      (correct >= 1 && wrong === 0 && (w.interval_days ?? 0) >= 1);

    if (isMastered) {
      masteredAtOrAboveCount += 1;
    }
  }

  const wordCorrect = words.reduce((acc, w) => acc + (w.correct_count || 0), 0);
  const wordWrong = words.reduce((acc, w) => acc + (w.wrong_count || 0), 0);
  const logCorrect = studyLogs.reduce(
    (acc, l) => acc + (l.correct_count || 0),
    0
  );
  const logWrong = studyLogs.reduce((acc, l) => acc + (l.wrong_count || 0), 0);

  const totalCorrect = Math.max(wordCorrect, logCorrect);
  const totalWrong = Math.max(wordWrong, logWrong);
  const totalReviews = totalCorrect + totalWrong;
  const accuracyPct =
    totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0;

  const activeSessions = studyLogs.filter(
    (l) =>
      (l.reviews_count || 0) > 0 ||
      (l.words_added || 0) > 0 ||
      (l.ielts_today || 0) > 0
  ).length;
  const consistencyCount = Math.max(streak, activeSessions);

  if (!nextLevel) {
    return {
      currentLevel,
      nextLevel: null,
      isMaxLevel: true,
      isReady: false,
      masteredAtOrAboveCount,
      reviewedAtOrAboveCount,
      requiredMasteredCount: 50,
      accuracyPct,
      requiredAccuracyPct: 80,
      totalReviews,
      requiredMinReviews: 70,
      consistencyCount,
      requiredConsistencyCount: 10,
      masteryMet: true,
      accuracyMet: accuracyPct >= 80,
      consistencyMet: true,
      overallProgressPct: 100,
    };
  }

  const threshold =
    PROMOTION_THRESHOLDS[currentLevel as Exclude<CefrLevel, "C2">];
  const masteryMet = masteredAtOrAboveCount >= threshold.minMastered;
  const accuracyMet =
    totalReviews >= threshold.minReviews &&
    accuracyPct >= threshold.minAccuracyPct;
  const consistencyMet = consistencyCount >= threshold.minSessions;

  const masteryRatio = Math.min(
    1,
    masteredAtOrAboveCount / threshold.minMastered
  );
  const accuracyRatio =
    totalReviews === 0
      ? 0
      : Math.min(1, accuracyPct / threshold.minAccuracyPct) *
        Math.min(1, totalReviews / threshold.minReviews);
  const consistencyRatio = Math.min(
    1,
    consistencyCount / threshold.minSessions
  );

  const overallProgressPct = Math.round(
    (masteryRatio * 0.45 + accuracyRatio * 0.35 + consistencyRatio * 0.2) * 100
  );

  return {
    currentLevel,
    nextLevel,
    isMaxLevel: false,
    isReady: masteryMet && accuracyMet && consistencyMet,
    masteredAtOrAboveCount,
    reviewedAtOrAboveCount,
    requiredMasteredCount: threshold.minMastered,
    accuracyPct,
    requiredAccuracyPct: threshold.minAccuracyPct,
    totalReviews,
    requiredMinReviews: threshold.minReviews,
    consistencyCount,
    requiredConsistencyCount: threshold.minSessions,
    masteryMet,
    accuracyMet,
    consistencyMet,
    overallProgressPct,
  };
}
