export type FeatureToggleKey = "lexiEnabled";

export interface FeatureReleaseLocaleCopy {
  badge: string;
  title: string;
  description: string;
  highlights: string[];
}

export interface FeatureRelease {
  id: string;
  version: string;
  date: string;
  badge: string;
  title: string;
  description: string;
  highlights: string[];
  translations?: Partial<Record<"en" | "id" | "ru", FeatureReleaseLocaleCopy>>;
  featureToggleKey?: FeatureToggleKey;
}

export const COMMUNITY_POLISH_RELEASE_ID = "2026-11-28-community-polish";
export const LEXI_COMPANION_RELEASE_ID = "2026-11-lexi-companion";
export const GUEST_SEEN_RELEASES_STORAGE_KEY = "lexivault_seen_releases_guest";

/**
 * Versioned registry of major user-facing feature announcements.
 * Ordered newest-first: add upcoming releases to the top of this array.
 */
export const FEATURE_RELEASES: FeatureRelease[] = [
  {
    id: COMMUNITY_POLISH_RELEASE_ID,
    version: "v2026.11.2",
    date: "2026-11-28",
    badge: "WHAT'S NEW",
    title: "Community Upgrade: Chunks, Interactive Lexi & Smarter Grading",
    description:
      "Four major improvements inspired by your feedback—making every practice session sharper, fairer, and more rewarding.",
    highlights: [
      "Learning by Chunks: Common native phrases & collocations with one-tap audio across Vault, Flashcards, and Discover.",
      "Interactive Lexi Companion: Pet Lexi for reactions, earn daily Treats from study milestones, level up your Bond, and get study cheers.",
      "Fairer AI Practice Grader & Smart Weakest Words: Accepts natural tense/UK-US variations, addresses you directly (\"You\"), and auto-clears Weakest Words after 2× correct in a row.",
      "Quick App Guide & Clearer Flashcards: 4-step interactive tour for new users plus clearly labeled Synonym & Antonym rows.",
    ],
    translations: {
      ru: {
        badge: "ЧТО НОВОГО",
        title: "Большое обновление: Живые связки, Лекси и умная проверка",
        description:
          "Четыре важных улучшения по вашим отзывам — каждая тренировка теперь точнее, живее и приятнее.",
        highlights: [
          "Обучение связками (Chunks): Естественные фразы и коллокации носителей с озвучкой в один клик в Словаре, Карточках и Подборке.",
          "Интерактивная Лекси: Гладь Лекси, зарабатывай вкусняшки за цели дня, прокачивай уровень дружбы и получай поддержку.",
          "Более справедливая проверка фраз AI и умные «Сложные слова»: Принимает естественные времена и варианты UK/US, обращается на «ты» и сама убирает слово из сложных после 2 верных ответов подряд.",
          "Быстрый гид и понятные карточки: Интерактивный тур для старта и чёткие блоки синонимов и антонимов.",
        ],
      },
    },
    featureToggleKey: "lexiEnabled",
  },
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
    translations: {
      ru: {
        badge: "НОВАЯ ФУНКЦИЯ",
        title: "Знакомься: Лекси, хранитель твоего словаря",
        description:
          "Ежедневная практика теперь держит слова в тонусе, а Лекси — в хорошем настроении (4 живые анимации настроения).",
        highlights: [
          "Живой компаньон на главном экране, реагирующий на твою серию и занятия",
          "Четыре эмоции в реальном времени: дремлет, начеку, счастлива и скучает",
          "По желанию — Лекси легко включается и отключается ниже или в Настройках",
        ],
      },
    },
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
