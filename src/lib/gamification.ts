import type {
  DailyRingsProgress,
  MasteryRank,
  StudyLog,
} from "@/types/lexivault";

export interface DailyRingTargets {
  vocab: number;
  recall: number;
  ielts: number;
}

export const DAILY_RING_TARGETS: DailyRingTargets = {
  vocab: 3,
  recall: 15,
  ielts: 1,
};

const CUSTOM_TARGETS_KEY = "lexivault_ring_targets_v1";

function clampTarget(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === "number" ? Math.round(value) : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

export function normalizeRingTargets(
  partial: Partial<DailyRingTargets> | null | undefined
): DailyRingTargets {
  return {
    vocab: clampTarget(partial?.vocab, 1, 20, DAILY_RING_TARGETS.vocab),
    recall: clampTarget(partial?.recall, 5, 50, DAILY_RING_TARGETS.recall),
    ielts: clampTarget(partial?.ielts, 1, 5, DAILY_RING_TARGETS.ielts),
  };
}

export function readCustomRingTargets(): DailyRingTargets {
  if (typeof window === "undefined") return { ...DAILY_RING_TARGETS };
  try {
    const raw = window.localStorage.getItem(CUSTOM_TARGETS_KEY);
    if (!raw) return { ...DAILY_RING_TARGETS };
    const parsed = JSON.parse(raw) as Partial<DailyRingTargets>;
    return normalizeRingTargets(parsed);
  } catch {
    return { ...DAILY_RING_TARGETS };
  }
}

export function writeCustomRingTargets(targets: DailyRingTargets): DailyRingTargets {
  const normalized = normalizeRingTargets(targets);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CUSTOM_TARGETS_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export const RANK_TIERS: Array<{ rank: MasteryRank; minXp: number }> = [
  { rank: "Observer", minXp: 0 },
  { rank: "Articulate", minXp: 200 },
  { rank: "Eloquent", minXp: 600 },
  { rank: "Rhetorician", minXp: 1400 },
  { rank: "Lexicon Master", minXp: 2800 },
];

export interface MasteryRankInfo {
  rank: MasteryRank;
  nextRank: MasteryRank | null;
  currentXp: number;
  currentTierMin: number;
  nextThreshold: number;
  progressPct: number;
}

export function getMasteryRankInfo(xp: number): MasteryRankInfo {
  const safeXp = Math.max(0, Math.round(xp));
  let idx = 0;
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (safeXp >= RANK_TIERS[i].minXp) {
      idx = i;
      break;
    }
  }

  const currentTier = RANK_TIERS[idx];
  const nextTier = RANK_TIERS[idx + 1] ?? null;

  if (!nextTier) {
    return {
      rank: currentTier.rank,
      nextRank: null,
      currentXp: safeXp,
      currentTierMin: currentTier.minXp,
      nextThreshold: currentTier.minXp,
      progressPct: 100,
    };
  }

  const span = Math.max(1, nextTier.minXp - currentTier.minXp);
  const progressPct = Math.min(
    100,
    Math.max(4, Math.round(((safeXp - currentTier.minXp) / span) * 100))
  );

  return {
    rank: currentTier.rank,
    nextRank: nextTier.rank,
    currentXp: safeXp,
    currentTierMin: currentTier.minXp,
    nextThreshold: nextTier.minXp,
    progressPct,
  };
}

export function computeDailyRings(
  logs: StudyLog[],
  todayStr: string,
  targets: DailyRingTargets = DAILY_RING_TARGETS
): DailyRingsProgress {
  const safeTargets = normalizeRingTargets(targets);
  const todayLog = logs.find((l) => l.study_date === todayStr);
  const vocab = todayLog
    ? Math.max(todayLog.vocab_today ?? 0, todayLog.words_added ?? 0)
    : 0;
  const recall = todayLog
    ? Math.max(todayLog.recall_today ?? 0, todayLog.reviews_count ?? 0)
    : 0;
  const ielts = todayLog ? todayLog.ielts_today ?? 0 : 0;

  return {
    vocab,
    recall,
    ielts,
    vocabTarget: safeTargets.vocab,
    recallTarget: safeTargets.recall,
    ieltsTarget: safeTargets.ielts,
  };
}
