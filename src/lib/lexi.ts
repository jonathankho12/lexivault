import { shiftDateString } from "@/lib/utils";
import type {
  DailyPackRecord,
  DailyQuotaSettings,
  DailyRingsProgress,
  StudyLog,
  WordEntry,
} from "@/types/lexivault";

export type LexiMood = "sleepy" | "alert" | "happy" | "restless";

export const LEXI_HAS_MET_STORAGE_KEY_PREFIX = "lexivault_has_met_lexi_";

export function getLexiHasMetStorageKey(userId: string): string {
  return `${LEXI_HAS_MET_STORAGE_KEY_PREFIX}${userId}`;
}

export function hasUserMetLexi(userId: string): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    return (
      window.localStorage.getItem(getLexiHasMetStorageKey(userId)) === "true"
    );
  } catch {
    return false;
  }
}

export function markUserMetLexi(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(getLexiHasMetStorageKey(userId), "true");
  } catch {
    // Ignore storage access errors
  }
}

export interface LexiMoodMeta {
  mood: LexiMood;
  badgeLabel: string;
  statusCopy: string;
}

export interface LexiContextualWordNote {
  prefix: string;
  term: string;
  word: WordEntry;
}

export interface LexiStatus {
  mood: LexiMood;
  badgeLabel: string;
  statusCopy: string;
  dailyProgressPct: number;
  progressLabel: string;
  missedConsecutiveDays: number;
  streak: number;
  contextualNote: LexiContextualWordNote | null;
}

const MOOD_COPY: Record<LexiMood, Omit<LexiMoodMeta, "mood">> = {
  sleepy: {
    badgeLabel: "Resting",
    statusCopy: "Lexi's resting. Run a quick drill to wake him up.",
  },
  alert: {
    badgeLabel: "Alert",
    statusCopy: "Vault active. Finish today's drill to lock in your streak.",
  },
  happy: {
    badgeLabel: "Happy",
    statusCopy: "Vault secured for today. Lexi's proud of the consistency.",
  },
  restless: {
    badgeLabel: "Restless",
    statusCopy: "Your vocabulary vault is getting dusty. Time for a quick review.",
  },
};

function parseUtcDayMs(dateStr: string): number | null {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }
  const [year, month, day] = parts;
  return Date.UTC(year, (month || 1) - 1, day || 1);
}

function diffCalendarDays(earlierDateStr: string, laterDateStr: string): number {
  const startMs = parseUtcDayMs(earlierDateStr);
  const endMs = parseUtcDayMs(laterDateStr);
  if (startMs === null || endMs === null) return 0;
  return Math.max(0, Math.round((endMs - startMs) / 86_400_000));
}

function isLogActive(log: StudyLog): boolean {
  return (
    log.reviews_count > 0 ||
    log.words_added > 0 ||
    (log.vocab_today ?? 0) > 0 ||
    (log.recall_today ?? 0) > 0 ||
    (log.ielts_today ?? 0) > 0
  );
}

/**
 * Counts how many full consecutive past calendar days (before todayStr)
 * have been missed since the user's most recent active study day.
 * Returns 0 if the user has never logged study activity yet (e.g., brand-new user).
 */
export function countMissedConsecutiveDays(
  studyLogs: StudyLog[],
  todayStr: string
): number {
  let latestPriorActiveDate: string | null = null;
  for (const log of studyLogs) {
    if (!isLogActive(log)) continue;
    if (log.study_date >= todayStr) continue;
    if (!latestPriorActiveDate || log.study_date > latestPriorActiveDate) {
      latestPriorActiveDate = log.study_date;
    }
  }

  if (!latestPriorActiveDate) {
    return 0;
  }

  const gapDays = diffCalendarDays(latestPriorActiveDate, todayStr);
  // Gap of 1 means yesterday was active (0 full days missed).
  // Gap of 3 means yesterday and the day before were both missed (2 full days missed).
  return Math.max(0, gapDays - 1);
}

function pickContextualWordNote(
  mood: LexiMood,
  words: WordEntry[],
  todayStr: string
): LexiContextualWordNote | null {
  if (words.length === 0) return null;

  if (mood === "happy" || mood === "alert") {
    // Prefer the most recently practiced word, otherwise most recently saved word.
    const sorted = [...words].sort((a, b) => {
      const aTime = Date.parse(a.last_practiced_at || a.created_at) || 0;
      const bTime = Date.parse(b.last_practiced_at || b.created_at) || 0;
      return bTime - aTime;
    });
    const focusWord = sorted[0];
    if (!focusWord) return null;
    return {
      prefix: mood === "happy" ? "Sharpened today:" : "Keep momentum on:",
      term: focusWord.term,
      word: focusWord,
    };
  }

  const yesterdayStr = shiftDateString(todayStr, -1);
  // For sleepy/restless, surface an unreviewed or oldest-practiced word ready for review.
  const sortedForReview = [...words].sort((a, b) => {
    const aNever = !a.last_practiced_at ? 0 : 1;
    const bNever = !b.last_practiced_at ? 0 : 1;
    if (aNever !== bNever) return aNever - bNever;

    const aDate = a.last_reviewed_date ?? yesterdayStr;
    const bDate = b.last_reviewed_date ?? yesterdayStr;
    if (aDate !== bDate) return aDate.localeCompare(bDate);

    return (b.wrong_count ?? 0) - (a.wrong_count ?? 0);
  });

  const targetWord = sortedForReview[0];
  if (!targetWord) return null;

  return {
    prefix: mood === "restless" ? "Ready for review:" : "Up next in vault:",
    term: targetWord.term,
    word: targetWord,
  };
}

export interface ComputeLexiStatusInput {
  studyLogs: StudyLog[];
  todayStr: string;
  dailyRings: DailyRingsProgress;
  dailyPack: DailyPackRecord | null;
  dailyQuota: DailyQuotaSettings;
  streak: number;
  words: WordEntry[];
}

/**
 * Derives Lexi's current mood and daily vault maintenance progress from
 * existing study logs, daily rings, daily pack, and streak state.
 */
export function computeLexiStatus({
  studyLogs,
  todayStr,
  dailyRings,
  dailyPack,
  dailyQuota,
  streak,
  words,
}: ComputeLexiStatusInput): LexiStatus {
  const recallTarget = Math.max(1, dailyRings.recallTarget);
  const vocabTarget = Math.max(1, dailyRings.vocabTarget);
  const ieltsTarget = Math.max(1, dailyRings.ieltsTarget);

  const recallRatio = Math.min(1, Math.max(0, dailyRings.recall / recallTarget));
  const vocabRatio = Math.min(1, Math.max(0, dailyRings.vocab / vocabTarget));
  const ieltsRatio = Math.min(1, Math.max(0, dailyRings.ielts / ieltsTarget));

  const quotaTotal = dailyQuota.wordsPerDay + dailyQuota.idiomsPerDay;
  const todayPack =
    dailyPack && dailyPack.pack_date === todayStr ? dailyPack : null;
  const packTotal =
    todayPack && todayPack.items.length > 0 ? todayPack.items.length : quotaTotal;
  const packCompleted = todayPack ? todayPack.completed_terms.length : 0;
  const packRatio =
    packTotal > 0 ? Math.min(1, Math.max(0, packCompleted / packTotal)) : 0;

  // Vocab capture or IELTS alone starts today's momentum (1-80%), while completing
  // either the daily recall drill target or today's full Daily Pack secures 100%.
  const supportingPct = Math.min(
    80,
    Math.round((vocabRatio * 0.45 + ieltsRatio * 0.35) * 100)
  );
  const drillPct = Math.round(recallRatio * 100);
  const packPct = Math.round(packRatio * 100);

  let dailyProgressPct = Math.max(drillPct, packPct, supportingPct);
  const hasAnyTodayActivity =
    dailyRings.recall > 0 ||
    dailyRings.vocab > 0 ||
    dailyRings.ielts > 0 ||
    packCompleted > 0;

  if (hasAnyTodayActivity && dailyProgressPct === 0) {
    dailyProgressPct = 1;
  }
  dailyProgressPct = Math.min(100, Math.max(0, dailyProgressPct));

  const missedConsecutiveDays =
    dailyProgressPct === 0
      ? countMissedConsecutiveDays(studyLogs, todayStr)
      : 0;

  let mood: LexiMood;
  if (dailyProgressPct >= 100) {
    mood = "happy";
  } else if (dailyProgressPct > 0) {
    mood = "alert";
  } else if (missedConsecutiveDays >= 2) {
    mood = "restless";
  } else {
    mood = "sleepy";
  }

  const meta = MOOD_COPY[mood];
  const progressLabel =
    packPct > drillPct && packTotal > 0
      ? `${Math.min(packCompleted, packTotal)}/${packTotal} daily pack`
      : `${Math.min(dailyRings.recall, recallTarget)}/${recallTarget} drills`;

  return {
    mood,
    badgeLabel: meta.badgeLabel,
    statusCopy: meta.statusCopy,
    dailyProgressPct,
    progressLabel,
    missedConsecutiveDays,
    streak,
    contextualNote: pickContextualWordNote(mood, words, todayStr),
  };
}
