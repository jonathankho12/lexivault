import { getCardMasteryStage, type MasteryStage } from "@/lib/sm2";
import { normalizeCefrLevel } from "@/lib/utils";
import type { CefrLevel, WordEntry, WordType } from "@/types/lexivault";

export type VaultSortOption =
  | "newest"
  | "oldest"
  | "cefr-asc"
  | "cefr-desc"
  | "mastery-weak"
  | "mastery-strong"
  | "alpha-asc"
  | "alpha-desc"
  | "type";

export interface VaultSortOptionMeta {
  id: VaultSortOption;
  label: string;
}

export const VAULT_SORT_STORAGE_KEY = "lexivault_vault_sort";

export const VAULT_SORT_OPTIONS: readonly VaultSortOptionMeta[] = [
  { id: "newest", label: "Newest First" },
  { id: "oldest", label: "Oldest First" },
  { id: "cefr-asc", label: "CEFR: A1 → C2" },
  { id: "cefr-desc", label: "CEFR: C2 → A1" },
  { id: "mastery-weak", label: "Needs Review First" },
  { id: "mastery-strong", label: "Mastered First" },
  { id: "alpha-asc", label: "Alphabetical: A → Z" },
  { id: "alpha-desc", label: "Alphabetical: Z → A" },
  { id: "type", label: "By Type (Vocab → Idiom → Collocation)" },
] as const;

const VALID_SORT_OPTIONS = new Set<string>(
  VAULT_SORT_OPTIONS.map((opt) => opt.id)
);

export function isValidVaultSortOption(
  value: unknown
): value is VaultSortOption {
  return typeof value === "string" && VALID_SORT_OPTIONS.has(value);
}

const CEFR_RANK: Record<CefrLevel, number> = {
  A1: 0,
  A2: 1,
  B1: 2,
  B2: 3,
  C1: 4,
  C2: 5,
};

const TYPE_RANK: Record<WordType, number> = {
  vocab: 0,
  idiom: 1,
  collocation: 2,
};

const WEAK_STAGE_RANK: Record<MasteryStage, number> = {
  new: 0,
  learning: 1,
  solid: 2,
  mastered: 3,
};

const STRONG_STAGE_RANK: Record<MasteryStage, number> = {
  mastered: 0,
  solid: 1,
  learning: 2,
  new: 3,
};

function parseTimestampMs(value?: string | null): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function getWordActivityMs(word: WordEntry): number {
  return Math.max(
    parseTimestampMs(word.created_at),
    parseTimestampMs(word.last_practiced_at)
  );
}

function compareTermsAsc(a: WordEntry, b: WordEntry): number {
  return a.term.trim().localeCompare(b.term.trim(), "en", {
    sensitivity: "base",
  });
}

function compareNewestDesc(a: WordEntry, b: WordEntry): number {
  const activityDiff = getWordActivityMs(b) - getWordActivityMs(a);
  if (activityDiff !== 0) return activityDiff;
  return parseTimestampMs(b.created_at) - parseTimestampMs(a.created_at);
}

function getReviewAccuracyRatio(word: WordEntry): number | null {
  const correct = word.correct_count || 0;
  const wrong = word.wrong_count || 0;
  const total = correct + wrong;
  if (total <= 0) return null;
  return correct / total;
}

function compareCefr(
  a: WordEntry,
  b: WordEntry,
  direction: "asc" | "desc"
): number {
  const lvlA = normalizeCefrLevel(a.cefr);
  const lvlB = normalizeCefrLevel(b.cefr);
  const rankA = lvlA ? CEFR_RANK[lvlA] : null;
  const rankB = lvlB ? CEFR_RANK[lvlB] : null;

  // Always keep words without a recognized CEFR level at the bottom.
  if (rankA === null && rankB === null) {
    return compareNewestDesc(a, b) || compareTermsAsc(a, b);
  }
  if (rankA === null) return 1;
  if (rankB === null) return -1;
  if (rankA !== rankB) {
    return direction === "asc" ? rankA - rankB : rankB - rankA;
  }
  return compareTermsAsc(a, b) || compareNewestDesc(a, b);
}

function compareMasteryWeak(a: WordEntry, b: WordEntry): number {
  const stageDiff =
    WEAK_STAGE_RANK[getCardMasteryStage(a)] -
    WEAK_STAGE_RANK[getCardMasteryStage(b)];
  if (stageDiff !== 0) return stageDiff;

  const accA = getReviewAccuracyRatio(a);
  const accB = getReviewAccuracyRatio(b);
  if (accA === null && accB !== null) return -1;
  if (accA !== null && accB === null) return 1;
  if (accA !== null && accB !== null && Math.abs(accA - accB) > 1e-6) {
    return accA - accB;
  }

  const wrongDiff = (b.wrong_count || 0) - (a.wrong_count || 0);
  if (wrongDiff !== 0) return wrongDiff;

  const repsDiff = (a.repetitions || 0) - (b.repetitions || 0);
  if (repsDiff !== 0) return repsDiff;

  return compareNewestDesc(a, b) || compareTermsAsc(a, b);
}

function compareMasteryStrong(a: WordEntry, b: WordEntry): number {
  const stageDiff =
    STRONG_STAGE_RANK[getCardMasteryStage(a)] -
    STRONG_STAGE_RANK[getCardMasteryStage(b)];
  if (stageDiff !== 0) return stageDiff;

  const accA = getReviewAccuracyRatio(a);
  const accB = getReviewAccuracyRatio(b);
  if (accA !== null && accB === null) return -1;
  if (accA === null && accB !== null) return 1;
  if (accA !== null && accB !== null && Math.abs(accA - accB) > 1e-6) {
    return accB - accA;
  }

  const repsDiff = (b.repetitions || 0) - (a.repetitions || 0);
  if (repsDiff !== 0) return repsDiff;

  const correctDiff = (b.correct_count || 0) - (a.correct_count || 0);
  if (correctDiff !== 0) return correctDiff;

  return compareNewestDesc(a, b) || compareTermsAsc(a, b);
}

/**
 * Returns a sorted copy of `words` according to the active Vault sort option.
 */
export function sortVaultWords(
  words: WordEntry[],
  sortBy: VaultSortOption
): WordEntry[] {
  if (words.length <= 1) return words;
  const copy = [...words];

  copy.sort((a, b) => {
    switch (sortBy) {
      case "oldest": {
        const createdDiff =
          parseTimestampMs(a.created_at) - parseTimestampMs(b.created_at);
        if (createdDiff !== 0) return createdDiff;
        return getWordActivityMs(a) - getWordActivityMs(b);
      }
      case "cefr-asc":
        return compareCefr(a, b, "asc");
      case "cefr-desc":
        return compareCefr(a, b, "desc");
      case "mastery-weak":
        return compareMasteryWeak(a, b);
      case "mastery-strong":
        return compareMasteryStrong(a, b);
      case "alpha-asc":
        return compareTermsAsc(a, b) || compareNewestDesc(a, b);
      case "alpha-desc":
        return compareTermsAsc(b, a) || compareNewestDesc(a, b);
      case "type": {
        const typeDiff = (TYPE_RANK[a.type] ?? 99) - (TYPE_RANK[b.type] ?? 99);
        if (typeDiff !== 0) return typeDiff;
        return compareTermsAsc(a, b) || compareNewestDesc(a, b);
      }
      case "newest":
      default:
        return compareNewestDesc(a, b);
    }
  });

  return copy;
}
