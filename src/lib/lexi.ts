import { TRANSLATIONS, type AppLanguage } from "@/lib/i18n";
import { getDueWords } from "@/lib/sm2";
import {
  getLocalizedMeaning,
  shiftDateString,
  WEAKEST_CLEAR_STREAK,
} from "@/lib/utils";
import type {
  DailyPackRecord,
  DailyQuotaSettings,
  DailyRingsProgress,
  StudyLog,
  WordEntry,
} from "@/types/lexivault";

export type LexiMood = "sleepy" | "alert" | "happy" | "restless";

export type LexiBondTierId =
  | "acquaintance"
  | "study_buddy"
  | "loyal_guardian"
  | "best_friend";

export type LexiMilestoneKey =
  | "daily_pack"
  | "practice_session"
  | "ring_vocab"
  | "ring_recall"
  | "ring_ielts";

export type LexiCheerReason =
  | "daily_pack_complete"
  | "combo_5x"
  | "weakest_word_cleared";

export interface LexiCheerState {
  id: number;
  reason: LexiCheerReason;
  title: string;
  body: string;
  treatEarned?: boolean;
}

export interface LexiCompanionState {
  treatsAvailable: number;
  treatsFedTotal: number;
  petsTotal: number;
  hasPetted: boolean;
  happyBoostUntil: number;
  earnedMilestonesByDate: Record<string, LexiMilestoneKey[]>;
}

export interface LexiBondInfo {
  tierId: LexiBondTierId;
  nextTierId: LexiBondTierId | null;
  level: number;
  treatsFedTotal: number;
  treatsToNext: number;
  progressPct: number;
}

export const LEXI_HAS_MET_STORAGE_KEY_PREFIX = "lexivault_has_met_lexi_";
export const LEXI_COMPANION_STATE_KEY_PREFIX = "lexivault_lexi_state_v1_";
export const LEXI_TREAT_HAPPY_BOOST_MS = 30 * 60 * 1000; // 30 minutes
const MAX_STORED_TREATS = 99;
const MAX_MILESTONE_HISTORY_DAYS = 7;

export const DEFAULT_LEXI_COMPANION_STATE: LexiCompanionState = {
  treatsAvailable: 0,
  treatsFedTotal: 0,
  petsTotal: 0,
  hasPetted: false,
  happyBoostUntil: 0,
  earnedMilestonesByDate: {},
};

const BOND_THRESHOLDS: ReadonlyArray<{
  tierId: LexiBondTierId;
  minTreats: number;
  level: number;
}> = [
  { tierId: "acquaintance", minTreats: 0, level: 1 },
  { tierId: "study_buddy", minTreats: 3, level: 2 },
  { tierId: "loyal_guardian", minTreats: 8, level: 3 },
  { tierId: "best_friend", minTreats: 20, level: 4 },
];

export function getLexiHasMetStorageKey(userId: string): string {
  return `${LEXI_HAS_MET_STORAGE_KEY_PREFIX}${userId}`;
}

export function getLexiCompanionStorageKey(userId: string): string {
  return `${LEXI_COMPANION_STATE_KEY_PREFIX}${userId}`;
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

function sanitizeMilestonesMap(
  raw: unknown
): Record<string, LexiMilestoneKey[]> {
  if (!raw || typeof raw !== "object") return {};
  const validKeys = new Set<string>([
    "daily_pack",
    "practice_session",
    "ring_vocab",
    "ring_recall",
    "ring_ielts",
  ]);
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([dateKey]) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey))
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, MAX_MILESTONE_HISTORY_DAYS);

  const out: Record<string, LexiMilestoneKey[]> = {};
  for (const [dateKey, list] of entries) {
    if (!Array.isArray(list)) continue;
    const filtered = Array.from(
      new Set(
        list.filter(
          (item): item is LexiMilestoneKey =>
            typeof item === "string" && validKeys.has(item)
        )
      )
    );
    if (filtered.length > 0) {
      out[dateKey] = filtered;
    }
  }
  return out;
}

export function readLexiCompanionState(userId: string): LexiCompanionState {
  if (typeof window === "undefined" || !userId) {
    return { ...DEFAULT_LEXI_COMPANION_STATE, earnedMilestonesByDate: {} };
  }
  try {
    const raw = window.localStorage.getItem(getLexiCompanionStorageKey(userId));
    if (!raw) {
      return { ...DEFAULT_LEXI_COMPANION_STATE, earnedMilestonesByDate: {} };
    }
    const parsed = JSON.parse(raw) as Partial<LexiCompanionState>;
    return {
      treatsAvailable:
        typeof parsed.treatsAvailable === "number" &&
        Number.isFinite(parsed.treatsAvailable)
          ? Math.min(MAX_STORED_TREATS, Math.max(0, Math.floor(parsed.treatsAvailable)))
          : 0,
      treatsFedTotal:
        typeof parsed.treatsFedTotal === "number" &&
        Number.isFinite(parsed.treatsFedTotal)
          ? Math.max(0, Math.floor(parsed.treatsFedTotal))
          : 0,
      petsTotal:
        typeof parsed.petsTotal === "number" && Number.isFinite(parsed.petsTotal)
          ? Math.max(0, Math.floor(parsed.petsTotal))
          : 0,
      hasPetted: Boolean(parsed.hasPetted),
      happyBoostUntil:
        typeof parsed.happyBoostUntil === "number" &&
        Number.isFinite(parsed.happyBoostUntil)
          ? Math.max(0, Math.floor(parsed.happyBoostUntil))
          : 0,
      earnedMilestonesByDate: sanitizeMilestonesMap(
        parsed.earnedMilestonesByDate
      ),
    };
  } catch {
    return { ...DEFAULT_LEXI_COMPANION_STATE, earnedMilestonesByDate: {} };
  }
}

export function writeLexiCompanionState(
  userId: string,
  state: LexiCompanionState
): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    const pruned: LexiCompanionState = {
      ...state,
      earnedMilestonesByDate: sanitizeMilestonesMap(
        state.earnedMilestonesByDate
      ),
    };
    window.localStorage.setItem(
      getLexiCompanionStorageKey(userId),
      JSON.stringify(pruned)
    );
  } catch {
    // Ignore storage access errors
  }
}

export function getLexiBondInfo(treatsFedTotal: number): LexiBondInfo {
  const safeTotal = Math.max(0, Math.floor(treatsFedTotal));
  let currentIdx = 0;
  for (let i = 0; i < BOND_THRESHOLDS.length; i += 1) {
    if (safeTotal >= BOND_THRESHOLDS[i].minTreats) {
      currentIdx = i;
    }
  }
  const current = BOND_THRESHOLDS[currentIdx];
  const next = BOND_THRESHOLDS[currentIdx + 1] ?? null;

  if (!next) {
    return {
      tierId: current.tierId,
      nextTierId: null,
      level: current.level,
      treatsFedTotal: safeTotal,
      treatsToNext: 0,
      progressPct: 100,
    };
  }

  const span = Math.max(1, next.minTreats - current.minTreats);
  const gained = Math.max(0, safeTotal - current.minTreats);
  return {
    tierId: current.tierId,
    nextTierId: next.tierId,
    level: current.level,
    treatsFedTotal: safeTotal,
    treatsToNext: Math.max(0, next.minTreats - safeTotal),
    progressPct: Math.min(100, Math.round((gained / span) * 100)),
  };
}

export function isLexiHappyBoostActive(
  state: LexiCompanionState,
  nowMs: number = Date.now()
): boolean {
  return state.happyBoostUntil > nowMs;
}

export function applyLexiPetToState(
  state: LexiCompanionState
): LexiCompanionState {
  return {
    ...state,
    hasPetted: true,
    petsTotal: state.petsTotal + 1,
  };
}

export function applyLexiMilestoneTreatToState(
  state: LexiCompanionState,
  dateStr: string,
  milestone: LexiMilestoneKey
): { nextState: LexiCompanionState; awarded: boolean } {
  const todayList = state.earnedMilestonesByDate[dateStr] ?? [];
  if (todayList.includes(milestone)) {
    return { nextState: state, awarded: false };
  }

  const nextMap = sanitizeMilestonesMap({
    ...state.earnedMilestonesByDate,
    [dateStr]: [...todayList, milestone],
  });

  return {
    awarded: true,
    nextState: {
      ...state,
      treatsAvailable: Math.min(MAX_STORED_TREATS, state.treatsAvailable + 1),
      earnedMilestonesByDate: nextMap,
    },
  };
}

export function applyLexiFeedTreatToState(
  state: LexiCompanionState,
  nowMs: number = Date.now()
): {
  nextState: LexiCompanionState;
  fed: boolean;
  leveledUpTo: LexiBondTierId | null;
} {
  if (state.treatsAvailable <= 0) {
    return { nextState: state, fed: false, leveledUpTo: null };
  }

  const prevBond = getLexiBondInfo(state.treatsFedTotal);
  const nextTreatsFed = state.treatsFedTotal + 1;
  const nextBond = getLexiBondInfo(nextTreatsFed);
  const leveledUpTo =
    nextBond.tierId !== prevBond.tierId ? nextBond.tierId : null;

  return {
    fed: true,
    leveledUpTo,
    nextState: {
      ...state,
      treatsAvailable: Math.max(0, state.treatsAvailable - 1),
      treatsFedTotal: nextTreatsFed,
      happyBoostUntil: Math.max(
        state.happyBoostUntil,
        nowMs + LEXI_TREAT_HAPPY_BOOST_MS
      ),
    },
  };
}

export function formatLexiTemplate(
  template: string,
  params: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`
  );
}

export interface PickLexiSpeechBubbleInput {
  mood: LexiMood;
  streak: number;
  words: WordEntry[];
  lang: AppLanguage;
  tapCount: number;
  lastMessage?: string | null;
  reactionType?: "pet" | "treat" | "rapid_tap" | "hold_pet";
  leveledUpTo?: LexiBondTierId | null;
  isStreakGuard?: boolean;
}

function pickDistinctFromPool(
  pool: readonly string[],
  tapCount: number,
  lastMessage?: string | null
): string | null {
  if (pool.length === 0) return null;
  const candidate = pool[tapCount % pool.length];
  if (candidate !== lastMessage || pool.length <= 1) {
    return candidate;
  }
  return pool[(tapCount + 1) % pool.length] ?? candidate;
}

/**
 * Picks a short, witty contextual speech bubble based on Lexi's mood, streak,
 * random vault vocabulary/chunks, Streak Guard, or pet/treat/rapid-tap/hold reactions.
 */
export function pickLexiSpeechBubble({
  mood,
  streak,
  words,
  lang,
  tapCount,
  lastMessage,
  reactionType = "pet",
  leveledUpTo = null,
  isStreakGuard = false,
}: PickLexiSpeechBubbleInput): string {
  const dict = TRANSLATIONS[lang].lexi;

  if (leveledUpTo) {
    return formatLexiTemplate(dict.bubbles.bondUp, {
      tier: dict.bondTiers[leveledUpTo],
    });
  }

  if (reactionType === "treat") {
    return (
      pickDistinctFromPool(dict.bubbles.treat, tapCount, lastMessage) ??
      dict.moodCopy.happyBoosted
    );
  }

  if (reactionType === "rapid_tap") {
    return (
      pickDistinctFromPool(dict.bubbles.rapidTap, tapCount, lastMessage) ??
      dict.bubbles.happy[0]
    );
  }

  if (reactionType === "hold_pet") {
    return (
      pickDistinctFromPool(dict.bubbles.holdPet, tapCount, lastMessage) ??
      dict.bubbles.happy[0]
    );
  }

  const candidates: string[] = [...dict.bubbles[mood]];

  if (isStreakGuard && streak > 0) {
    const guardLine = formatLexiTemplate(dict.streakGuard.bubble, {
      days: streak,
    });
    if (tapCount % 3 === 1 && guardLine !== lastMessage) {
      return guardLine;
    }
    candidates.push(guardLine);
  }

  if (streak >= 2) {
    for (const tpl of dict.bubbles.streak) {
      candidates.push(formatLexiTemplate(tpl, { days: streak }));
    }
  }

  const wordsWithChunks = words.filter(
    (w) => Array.isArray(w.chunks) && w.chunks.length > 0
  );
  let chunkQuip: string | null = null;
  if (wordsWithChunks.length > 0) {
    const chunkWord =
      wordsWithChunks[Math.floor(Math.random() * wordsWithChunks.length)];
    const chunkList = chunkWord?.chunks ?? [];
    const chosenChunk =
      chunkList[Math.floor(Math.random() * chunkList.length)]?.trim();
    if (chunkWord?.term && chosenChunk) {
      const chunkTpl =
        dict.bubbles.chunk[tapCount % dict.bubbles.chunk.length] ??
        dict.bubbles.chunk[0];
      if (chunkTpl) {
        chunkQuip = formatLexiTemplate(chunkTpl, {
          chunk: chosenChunk,
          term: chunkWord.term,
        });
        candidates.push(chunkQuip);
      }
    }
  }

  let wordQuip: string | null = null;
  if (words.length > 0) {
    const randomWord = words[Math.floor(Math.random() * words.length)];
    if (randomWord?.term) {
      const wordTpl =
        dict.bubbles.word[tapCount % dict.bubbles.word.length] ??
        dict.bubbles.word[0];
      if (wordTpl) {
        wordQuip = formatLexiTemplate(wordTpl, { term: randomWord.term });
        candidates.push(wordQuip);
      }
    }
  }

  if (chunkQuip && tapCount % 4 === 1 && chunkQuip !== lastMessage) {
    return chunkQuip;
  }

  if (wordQuip && tapCount % 3 === 2 && wordQuip !== lastMessage) {
    return wordQuip;
  }

  // Filter out the exact previous bubble so consecutive taps always feel fresh
  const filtered = candidates.filter((msg) => msg !== lastMessage);
  const pool = filtered.length > 0 ? filtered : candidates;

  return pool[tapCount % pool.length] ?? dict.moodCopy[mood];
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
  baseMood: LexiMood;
  isHappyBoosted: boolean;
  isStreakGuard: boolean;
  badgeLabel: string;
  statusCopy: string;
  dailyProgressPct: number;
  progressLabel: string;
  missedConsecutiveDays: number;
  streak: number;
  contextualNote: LexiContextualWordNote | null;
}

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
  todayStr: string,
  lang: AppLanguage
): LexiContextualWordNote | null {
  if (words.length === 0) return null;
  const prefixes = TRANSLATIONS[lang].lexi.notePrefixes;

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
      prefix: mood === "happy" ? prefixes.happy : prefixes.alert,
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
    prefix: mood === "restless" ? prefixes.restless : prefixes.sleepy,
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
  lang?: AppLanguage;
  isHappyBoosted?: boolean;
  localHour?: number;
}

/**
 * Derives Lexi's current mood and daily vault maintenance progress from
 * existing study logs, daily rings, daily pack, streak, and treat boost state.
 */
export function computeLexiStatus({
  studyLogs,
  todayStr,
  dailyRings,
  dailyPack,
  dailyQuota,
  streak,
  words,
  lang = "en",
  isHappyBoosted = false,
  localHour,
}: ComputeLexiStatusInput): LexiStatus {
  const dict = TRANSLATIONS[lang].lexi;
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

  let baseMood: LexiMood;
  if (dailyProgressPct >= 100) {
    baseMood = "happy";
  } else if (dailyProgressPct > 0) {
    baseMood = "alert";
  } else if (missedConsecutiveDays >= 2) {
    baseMood = "restless";
  } else {
    baseMood = "sleepy";
  }

  const effectiveHappyBoost = isHappyBoosted && baseMood !== "happy";
  const mood: LexiMood = effectiveHappyBoost ? "happy" : baseMood;

  const isStreakGuard =
    streak > 0 &&
    dailyProgressPct === 0 &&
    !effectiveHappyBoost &&
    typeof localHour === "number" &&
    localHour >= 20;

  const badgeLabel = isStreakGuard
    ? dict.streakGuard.badge
    : dict.moodBadges[mood];
  const statusCopy = effectiveHappyBoost
    ? dict.moodCopy.happyBoosted
    : isStreakGuard
      ? formatLexiTemplate(dict.streakGuard.copy, { days: streak })
      : dict.moodCopy[mood];

  const progressLabel =
    packPct > drillPct && packTotal > 0
      ? `${Math.min(packCompleted, packTotal)}/${packTotal} ${dict.progressDailyPackSuffix}`
      : `${Math.min(dailyRings.recall, recallTarget)}/${recallTarget} ${dict.progressDrillsSuffix}`;

  return {
    mood,
    baseMood,
    isHappyBoosted: effectiveHappyBoost,
    isStreakGuard,
    badgeLabel,
    statusCopy,
    dailyProgressPct,
    progressLabel,
    missedConsecutiveDays,
    streak,
    contextualNote: pickContextualWordNote(baseMood, words, todayStr, lang),
  };
}

/**
 * Picks an overdue or weak Vault word (falling back to any Vault word) for
 * the zero-AI 5-Second Quick Check triggered by "Fetch!".
 */
export function pickFetchQuickCheckWord(
  words: WordEntry[],
  todayStr: string,
  excludeWordId?: string | null
): WordEntry | null {
  if (words.length === 0) return null;

  const due = getDueWords(words, Date.now(), todayStr);
  const weak = words.filter(
    (w) => w.wrong_count > 0 && (w.repetitions ?? 0) < WEAKEST_CLEAR_STREAK
  );

  const prioritizedMap = new Map<string, WordEntry>();
  for (const w of [...weak, ...due]) {
    if (!prioritizedMap.has(w.id)) {
      prioritizedMap.set(w.id, w);
    }
  }
  const prioritized = Array.from(prioritizedMap.values());
  const pool = prioritized.length > 0 ? prioritized : words;
  const withoutCurrent =
    pool.length > 1 && excludeWordId
      ? pool.filter((w) => w.id !== excludeWordId)
      : pool;

  const finalPool = withoutCurrent.length > 0 ? withoutCurrent : pool;
  return finalPool[Math.floor(Math.random() * finalPool.length)] ?? null;
}

/**
 * Builds a 3-option meaning quiz strictly from existing Vault words (zero AI calls).
 * Returns null if fewer than 3 words or fewer than 2 distinct distractors exist,
 * signaling the UI to fall back to tap-to-reveal definition.
 */
export function buildQuickCheckQuiz(
  target: WordEntry,
  words: WordEntry[],
  lang: AppLanguage
): { choices: string[]; correctChoice: string } | null {
  if (words.length < 3) return null;
  const correctChoice = getLocalizedMeaning(target, lang).trim();
  if (!correctChoice) return null;

  const seen = new Set<string>([correctChoice.toLowerCase()]);
  const distractorPool: string[] = [];

  for (const w of words) {
    if (w.id === target.id) continue;
    const m = getLocalizedMeaning(w, lang).trim();
    if (!m) continue;
    const key = m.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    distractorPool.push(m);
  }

  if (distractorPool.length < 2) return null;

  // Fisher-Yates shuffle on distractorPool and final 3 choices
  for (let i = distractorPool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [distractorPool[i], distractorPool[j]] = [distractorPool[j], distractorPool[i]];
  }

  const choices = [correctChoice, distractorPool[0], distractorPool[1]];
  for (let i = choices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return { choices, correctChoice };
}
