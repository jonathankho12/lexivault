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
    nextIntervalDays = 0; // Due again in < 1 day (12 hours)
  } else if (rating === "hard") {
    nextReps = Math.max(1, prevReps);
    nextIntervalDays = prevInterval <= 1 ? 1 : Math.max(2, Math.round(prevInterval * 1.2));
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

export function isWordDueToday(
  word: WordEntry,
  nowMs: number = Date.now()
): boolean {
  if (!word.next_review_at) return true;
  const dueMs = new Date(word.next_review_at).getTime();
  if (!Number.isFinite(dueMs)) return true;
  return dueMs <= nowMs;
}

export function getDueWords(
  words: WordEntry[],
  nowMs: number = Date.now()
): WordEntry[] {
  return words
    .filter((w) => isWordDueToday(w, nowMs))
    .sort((a, b) => {
      const aDue = a.next_review_at
        ? new Date(a.next_review_at).getTime()
        : 0;
      const bDue = b.next_review_at
        ? new Date(b.next_review_at).getTime()
        : 0;
      if (aDue !== bDue) return aDue - bDue;
      return b.wrong_count - a.wrong_count;
    });
}

export function previewSm2IntervalLabels(
  word: WordEntry
): Record<Sm2Rating, string> {
  const ratings: Sm2Rating[] = ["again", "hard", "good", "easy"];
  const labels = {} as Record<Sm2Rating, string>;
  for (const r of ratings) {
    const res = calculateSm2Next(word, r);
    labels[r] = res.interval_days === 0 ? "< 1 hari" : `${res.interval_days} hari`;
  }
  return labels;
}
