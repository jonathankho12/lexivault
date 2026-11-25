export type FeatureToggleKey = "lexiEnabled";

export interface FeatureRelease {
  id: string;
  version: string;
  date: string;
  badge: string;
  title: string;
  description: string;
  highlights: string[];
  featureToggleKey?: FeatureToggleKey;
}

export const LEXI_COMPANION_RELEASE_ID = "2026-11-lexi-companion";
export const GUEST_SEEN_RELEASES_STORAGE_KEY = "lexivault_seen_releases_guest";

/**
 * Versioned registry of major user-facing feature announcements.
 * Ordered newest-first: add upcoming releases to the top of this array.
 */
export const FEATURE_RELEASES: FeatureRelease[] = [
  {
    id: LEXI_COMPANION_RELEASE_ID,
    version: "v2026.11",
    date: "2026-11-26",
    badge: "NEW FEATURE",
    title: "Meet Lexi, Your Vocabulary Guardian",
    description:
      "Daily practice now keeps Lexi happy and your vault sharp—with live mood animations (sleepy, alert, happy, restless).",
    highlights: [
      "Live Dashboard companion reacting to your daily streak & practice",
      "Four real-time mood animations: sleepy, alert, happy, and restless",
      "Optional experience — toggle Lexi on or off anytime right below or in Settings",
    ],
    featureToggleKey: "lexiEnabled",
  },
];

export function seenReleasesStorageKey(userId?: string | null): string {
  return userId
    ? `lexivault_seen_releases_${userId}`
    : GUEST_SEEN_RELEASES_STORAGE_KEY;
}

export function getLatestRelease(): FeatureRelease | null {
  if (FEATURE_RELEASES.length === 0) return null;
  let latest = FEATURE_RELEASES[0];
  let latestTime = Date.parse(latest.date);

  for (let i = 1; i < FEATURE_RELEASES.length; i += 1) {
    const candidate = FEATURE_RELEASES[i];
    const candidateTime = Date.parse(candidate.date);
    if (
      Number.isFinite(candidateTime) &&
      (!Number.isFinite(latestTime) || candidateTime > latestTime)
    ) {
      latest = candidate;
      latestTime = candidateTime;
    }
  }

  return latest;
}

export function getSeenReleaseIds(userId?: string | null): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(seenReleasesStorageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function hasUserSeenRelease(
  userId: string | null | undefined,
  releaseId: string
): boolean {
  return getSeenReleaseIds(userId).includes(releaseId);
}

export function markReleaseSeen(
  userId: string | null | undefined,
  releaseId: string
): string[] {
  const existing = getSeenReleaseIds(userId);
  const next = existing.includes(releaseId)
    ? existing
    : [...existing, releaseId];
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        seenReleasesStorageKey(userId),
        JSON.stringify(next)
      );
    } catch {
      // Ignore storage access restrictions
    }
  }
  return next;
}

export function getUnseenLatestRelease(
  userId?: string | null
): FeatureRelease | null {
  const latest = getLatestRelease();
  if (!latest) return null;
  return hasUserSeenRelease(userId, latest.id) ? null : latest;
}
