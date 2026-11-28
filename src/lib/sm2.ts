import type { AppLanguage } from "@/lib/i18n";
import { getLocalDateString } from "@/lib/utils";
import type { Sm2Rating, WordEntry } from "@/types/lexivault";

export interface Sm2ScheduleResult {
  next_review_at: string;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
}

const RATING_QUALITY: Record<Sm2Rating, number> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
};

export function calculateSm2Next(
  word: WordEntry,
  rating: Sm2Rating,
  now: Date = new Date()
): Sm2ScheduleResult {
  const prevEase =
    typeof word.ease_factor === "number" && Number.isFinite(word.ease_factor)
      ? word.ease_factor
      : 2.5;
  const prevInterval =
    typeof word.interval_days === "number" && Number.isFinite(word.interval_days)
      ? word.interval_days
      : 0;
  const prevReps =
    typeof word.repetitions === "number" && Number.isFinite(word.repetitions)
      ? word.repetitions
      : 0;

  const q = RATING_QUALITY[rating];
  let nextEase = prevEase + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  nextEase = Math.max(1.3, Math.round(nextEase * 100) / 100);

  let nextReps = prevReps;
  let nextIntervalDays = 1;

  if (rating === "again") {
    nextReps = 0;
    nextIntervalDays = 0; // Due again in < 1 day (re-queued in active session)
  } else if (rating === "hard") {
    nextReps = Math.max(1, prevReps);
    nextIntervalDays =
      prevInterval <= 1 ? 1 : Math.max(2, Math.round(prevInterval * 1.2));
  } else if (rating === "good") {
    nextReps = prevReps + 1;
    if (prevReps === 0) {
      nextIntervalDays = 3;
    } else if (prevReps === 1) {
      nextIntervalDays = 4;
    } else {
      nextIntervalDays = Math.max(4, Math.round(prevInterval * nextEase));
    }
  } else {
    // easy
    nextReps = prevReps + 1;
    if (prevReps === 0) {
      nextIntervalDays = 7;
    } else if (prevReps === 1) {
      nextIntervalDays = 10;
    } else {
      nextIntervalDays = Math.max(7, Math.round(prevInterval * nextEase * 1.3));
    }
  }

  const nextDate = new Date(now.getTime());
  if (nextIntervalDays === 0) {
    nextDate.setHours(nextDate.getHours() + 12);
  } else {
    nextDate.setDate(nextDate.getDate() + nextIntervalDays);
  }

  return {
    next_review_at: nextDate.toISOString(),
    interval_days: nextIntervalDays,
    ease_factor: nextEase,
    repetitions: nextReps,
  };
}

export function getEffectiveReviewCount(word: WordEntry): number {
  const fromField =
    typeof word.review_count === "number" && Number.isFinite(word.review_count)
      ? Math.max(0, Math.round(word.review_count))
      : 0;
  const fromCounts = Math.max(0, (word.correct_count || 0) + (word.wrong_count || 0));
  return Math.max(fromField, fromCounts);
}

/**
 * Returns true if the card has already been reviewed and passed today (Hard/Good/Easy).
 * Enforces strict same-day non-repetition across reloads and devices.
 */
export function isReviewedToday(word: WordEntry, todayStr: string): boolean {
  return Boolean(word.last_reviewed_date && word.last_reviewed_date === todayStr);
}

export function isWordDueToday(
  word: WordEntry,
  nowMs: number = Date.now(),
  todayStr: string = getLocalDateString(new Date(nowMs))
): boolean {
  if (isReviewedToday(word, todayStr)) return false;
  if (getEffectiveReviewCount(word) === 0) return true;
  if (!word.next_review_at) return true;
  const dueMs = new Date(word.next_review_at).getTime();
  if (!Number.isFinite(dueMs)) return true;
  return dueMs <= nowMs;
}

function getMasteryScore(word: WordEntry): number {
  const total = word.correct_count + word.wrong_count;
  if (total === 0) return -1;
  return word.correct_count / total;
}

/**
 * Smart non-repeating daily Flashcards queue:
 * 1. Never-reviewed / brand-new cards FIRST (newest added first so Daily Pack & Vault items surface immediately).
 * 2. SM-2 due cards NOT reviewed today (lowest mastery / most overdue first).
 * 3. Optional Tier 3 (includeStudyAhead=true): remaining unreviewed-today cards ordered by oldest review / lowest mastery.
 * Strictly excludes any card where last_reviewed_date === todayStr.
 */
export function buildSmartFlashcardQueue(
  words: WordEntry[],
  todayStr: string,
  options?: {
    includeStudyAhead?: boolean;
    nowMs?: number;
  }
): WordEntry[] {
  const nowMs = options?.nowMs ?? Date.now();
  const includeStudyAhead = options?.includeStudyAhead ?? false;

  const eligible = words.filter((w) => !isReviewedToday(w, todayStr));

  const tier1BrandNew: WordEntry[] = [];
  const tier2Due: WordEntry[] = [];
  const tier3StudyAhead: WordEntry[] = [];

  for (const w of eligible) {
    if (getEffectiveReviewCount(w) === 0) {
      tier1BrandNew.push(w);
    } else if (isWordDueToday(w, nowMs, todayStr)) {
      tier2Due.push(w);
    } else if (includeStudyAhead) {
      tier3StudyAhead.push(w);
    }
  }

  // Tier 1: newest added brand-new items first
  tier1BrandNew.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Tier 2: lowest mastery first, then most overdue
  tier2Due.sort((a, b) => {
    const mA = getMasteryScore(a);
    const mB = getMasteryScore(b);
    if (Math.abs(mA - mB) > 0.05) return mA - mB;
    const dueA = a.next_review_at ? new Date(a.next_review_at).getTime() : 0;
    const dueB = b.next_review_at ? new Date(b.next_review_at).getTime() : 0;
    if (dueA !== dueB) return dueA - dueB;
    return b.wrong_count - a.wrong_count;
  });

  // Tier 3: oldest reviewed date first, then lowest mastery
  tier3StudyAhead.sort((a, b) => {
    const dA = a.last_reviewed_date ?? "0000-00-00";
    const dB = b.last_reviewed_date ?? "0000-00-00";
    if (dA !== dB) return dA.localeCompare(dB);
    return getMasteryScore(a) - getMasteryScore(b);
  });

  return [...tier1BrandNew, ...tier2Due, ...tier3StudyAhead];
}

export function getDueWords(
  words: WordEntry[],
  nowMs: number = Date.now(),
  todayStr: string = getLocalDateString(new Date(nowMs))
): WordEntry[] {
  return buildSmartFlashcardQueue(words, todayStr, {
    includeStudyAhead: false,
    nowMs,
  });
}

export type MasteryStage = "new" | "learning" | "solid" | "mastered";

export function getCardMasteryStage(word: WordEntry): MasteryStage {
  const reviews = getEffectiveReviewCount(word);
  const reps =
    typeof word.repetitions === "number" && Number.isFinite(word.repetitions)
      ? word.repetitions
      : 0;
  const interval =
    typeof word.interval_days === "number" && Number.isFinite(word.interval_days)
      ? word.interval_days
      : 0;
  const ease =
    typeof word.ease_factor === "number" && Number.isFinite(word.ease_factor)
      ? word.ease_factor
      : 2.5;

  if (reviews === 0 && reps === 0) return "new";
  if (reps >= 4 && interval >= 14 && ease >= 2.1) return "mastered";
  if (reps >= 2 && interval >= 4 && ease >= 1.8) return "solid";
  return "learning";
}

export function getMasteryStageMeta(
  stage: MasteryStage,
  lang: AppLanguage = "id"
): { label: string; badgeClass: string } {
  if (stage === "mastered") {
    return {
      label: lang === "en" ? "Mastered" : lang === "ru" ? "Освоено" : "Dikuasai",
      badgeClass:
        "bg-[#BF5AF2]/18 border-[#BF5AF2]/40 text-[#E5B8FF]",
    };
  }
  if (stage === "solid") {
    return {
      label: lang === "en" ? "Solid" : lang === "ru" ? "Уверенно" : "Kuat",
      badgeClass:
        "bg-[#30D158]/16 border-[#30D158]/40 text-[#7CF099]",
    };
  }
  if (stage === "learning") {
    return {
      label: lang === "en" ? "Learning" : lang === "ru" ? "Изучается" : "Belajar",
      badgeClass:
        "bg-[#FF9F0A]/16 border-[#FF9F0A]/40 text-[#FFD18C]",
    };
  }
  return {
    label: lang === "en" ? "New" : lang === "ru" ? "Новое" : "Baru",
    badgeClass:
      "bg-[#0A84FF]/16 border-[#0A84FF]/35 text-[#70BCFF]",
  };
}

export function previewSm2IntervalLabels(
  word: WordEntry,
  lang: AppLanguage = "id"
): Record<Sm2Rating, string> {
  const ratings: Sm2Rating[] = ["again", "hard", "good", "easy"];
  const labels = {} as Record<Sm2Rating, string>;
  for (const r of ratings) {
    const res = calculateSm2Next(word, r);
    if (lang === "en") {
      labels[r] =
        res.interval_days === 0
          ? "This session"
          : res.interval_days === 1
            ? "1 day"
            : `${res.interval_days} days`;
    } else if (lang === "ru") {
      labels[r] =
        res.interval_days === 0 ? "Эта сессия" : `${res.interval_days} дн.`;
    } else {
      labels[r] =
        res.interval_days === 0 ? "Sesi ini" : `${res.interval_days} hari`;
    }
  }
  return labels;
}
