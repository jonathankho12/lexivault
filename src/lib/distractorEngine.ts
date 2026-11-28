import type { AppLanguage } from "@/lib/i18n";
import { getLocalizedMeaning, normalizeTermKey } from "@/lib/utils";
import type { RegisterType, WordType } from "@/types/lexivault";

export interface DistractorCandidateItem {
  id: string;
  term: string;
  type: WordType;
  register: RegisterType;
  cefr?: string;
  meaning_id?: string | null;
  meaning_en?: string | null;
  meaning_ru?: string | null;
}

export interface AiDistractorRequestTarget {
  id: string;
  term: string;
  type: WordType;
  register: RegisterType;
  cefr?: string;
  meaning: string;
}

const STORAGE_CACHE_KEY = "lexivault_ai_distractors_v1";
const MAX_CACHE_ENTRIES = 320;
const CLIENT_FETCH_TIMEOUT_MS = 6000;

interface CachedDistractorEntry {
  distractors: string[];
  cachedAt: number;
}

const memoryCache = new Map<string, CachedDistractorEntry>();
let localCacheLoaded = false;

function hashMeaningShort(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function buildCacheKey(lang: AppLanguage, term: string, meaning: string): string {
  return `${lang}:${normalizeTermKey(term)}:${hashMeaningShort(
    meaning.trim().toLowerCase()
  )}`;
}

function ensureLocalCacheLoaded(): void {
  if (localCacheLoaded || typeof window === "undefined") return;
  localCacheLoaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CachedDistractorEntry>;
    if (!parsed || typeof parsed !== "object") return;
    for (const [k, entry] of Object.entries(parsed)) {
      if (
        entry &&
        Array.isArray(entry.distractors) &&
        entry.distractors.length > 0
      ) {
        memoryCache.set(k, {
          distractors: entry.distractors.filter((d) => typeof d === "string"),
          cachedAt: Number(entry.cachedAt) || Date.now(),
        });
      }
    }
  } catch {
    // Ignore corrupted cache
  }
}

function persistLocalCache(): void {
  if (typeof window === "undefined") return;
  try {
    // Keep most recently cached entries within cap
    const entries = Array.from(memoryCache.entries())
      .sort((a, b) => b[1].cachedAt - a[1].cachedAt)
      .slice(0, MAX_CACHE_ENTRIES);
    memoryCache.clear();
    const obj: Record<string, CachedDistractorEntry> = {};
    for (const [k, v] of entries) {
      memoryCache.set(k, v);
      obj[k] = v;
    }
    window.localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(obj));
  } catch {
    // Ignore storage quota errors
  }
}

export function shuffleOptions<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Normalizes a definition/meaning MCQ option so all 4 options look visually uniform:
 * - trims stray whitespace and collapses internal runs
 * - capitalizes the first alphabetical character
 * - standardizes trailing punctuation to a period (unless ending in ! or ?)
 */
export function normalizeMeaningOption(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) return "";

  const strippedEdge = collapsed.replace(/[,;:\s]+$/, "").trim();
  if (!strippedEdge) return "";

  const capitalized = strippedEdge.replace(
    /^([^a-zA-ZÀ-ÿА-Яа-яЁё]*)([a-zA-ZÀ-ÿА-Яа-яЁё])/,
    (_, prefix: string, first: string) => `${prefix}${first.toUpperCase()}`
  );

  if (/[.!?]$/.test(capitalized)) {
    return capitalized;
  }
  return `${capitalized}.`;
}

/**
 * Normalizes a term/word-bank MCQ option so stray spaces or edge punctuation
 * never give away the right answer.
 */
export function normalizeTermOption(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.,;:\s]+|[.,;:\s]+$/g, "")
    .trim();
}

/**
 * Normalizes 4 general MCQ options (e.g. Commute listening choices) so capitalization,
 * whitespace, and trailing punctuation are visually consistent across all options.
 */
export function normalizeUniformMcqOptions(
  options: string[],
  correctAnswer: string
): { options: string[]; correctAnswer: string } {
  const cleaned = options.map((opt) => opt.replace(/\s+/g, " ").trim());
  const hasSentenceStyle = cleaned.some(
    (opt) => opt.split(/\s+/).length >= 5 || /[.!?]$/.test(opt)
  );

  const transform = (raw: string): string => {
    const trimmed = raw.replace(/\s+/g, " ").trim();
    if (!trimmed) return "";
    const capitalized = trimmed.replace(
      /^([^a-zA-ZÀ-ÿА-Яа-яЁё]*)([a-zA-ZÀ-ÿА-Яа-яЁё])/,
      (_, prefix: string, first: string) => `${prefix}${first.toUpperCase()}`
    );
    if (!hasSentenceStyle) {
      return capitalized.replace(/[.]+$/, "");
    }
    return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
  };

  return {
    options: cleaned.map(transform),
    correctAnswer: transform(correctAnswer),
  };
}

// Type- and register-aware static fallbacks used ONLY when a user's Vault has < 4 items
const STATIC_MEANING_FALLBACKS: Record<
  AppLanguage,
  Record<WordType, string[]>
> = {
  en: {
    vocab: [
      "Characterized by steady restraint when responding to sudden external pressure.",
      "To gradually weaken an established standard through repeated minor exceptions.",
      "An underlying assumption that shapes decisions without being stated openly.",
      "Capable of adapting swiftly to shifting conditions while preserving core structure.",
    ],
    idiom: [
      "To postpone a difficult conversation until external events force an outcome.",
      "To commit fully to an uncertain plan without keeping a backup option ready.",
      "To misread subtle social cues and respond in an unexpectedly blunt way.",
      "To accept a minor short-term setback in order to protect a larger advantage.",
    ],
    collocation: [
      "To gradually narrow the range of viable options during prolonged negotiations.",
      "To establish clear boundaries before committing resources to a joint venture.",
      "To reinforce an earlier claim with newly verified contextual evidence.",
      "To balance competing priorities without alienating key stakeholders.",
    ],
  },
  id: {
    vocab: [
      "Bersikap tenang dan terkendali saat menghadapi tekanan mendadak dari luar.",
      "Secara bertahap melemahkan standar yang sudah mapan lewat pengecualian kecil.",
      "Asumsi mendasar yang memengaruhi keputusan meski tidak diucapkan secara terbuka.",
      "Mampu menyesuaikan diri dengan cepat sambil tetap menjaga struktur utamanya.",
    ],
    idiom: [
      "Menunda pembicaraan sulit sampai keadaan memaksa hasil tertentu terjadi.",
      "Menjalankan rencana penuh risiko sepenuhnya tanpa menyiapkan cadangan apa pun.",
      "Salah menangkap sinyal tersirat sehingga bereaksi terlalu blak-blakan.",
      "Menerima kerugian kecil jangka pendek demi menjaga keuntungan yang lebih besar.",
    ],
    collocation: [
      "Mempersempit pilihan yang masih masuk akal selama perundingan berlangsung.",
      "Menetapkan batasan yang jelas sebelum menginvestasikan sumber daya bersama.",
      "Memperkuat pernyataan awal dengan bukti kontekstual yang baru diverifikasi.",
      "Menyeimbangkan prioritas yang saling bertentangan tanpa memicu penolakan.",
    ],
  },
  ru: {
    vocab: [
      "Сохранять спокойствие и сдержанность при внезапном внешнем давлении.",
      "Постепенно размывать устоявшийся стандарт чередой мелких исключений.",
      "Скрытое допущение, влияющее на решения, даже если его не озвучивают вслух.",
      "Способный быстро подстраиваться под перемены, сохраняя основную структуру.",
    ],
    idiom: [
      "Откладывать сложный разговор, пока обстоятельства не вынудят принять решение.",
      "Полностью рискнуть и пойти ва-банк без запасного плана на случай провала.",
      "Неверно истолковать тонкий намёк и ответить неожиданно резко.",
      "Пойти на небольшую уступку сейчас ради сохранения более крупной выгоды.",
    ],
    collocation: [
      "Постепенно сузить круг реальных вариантов в ходе долгих переговоров.",
      "Установить чёткие границы до вложения ресурсов в совместный проект.",
      "Подкрепить прежнее утверждение новыми проверенными фактами.",
      "Найти баланс между конкурирующими приоритетами без ущерба для ключевых сторон.",
    ],
  },
};

const STATIC_TERM_FALLBACKS: Record<WordType, string[]> = {
  vocab: [
    "pragmatic",
    "mitigate",
    "resilient",
    "ubiquitous",
    "ambivalent",
    "tenacious",
  ],
  idiom: [
    "cut corners",
    "bite the bullet",
    "play it by ear",
    "read between the lines",
    "weather the storm",
    "call it a day",
  ],
  collocation: [
    "strike a balance",
    "pose a threat",
    "yield results",
    "spark a debate",
    "set a precedent",
    "bridge the gap",
  ],
};

/**
 * Layer 2 — Smart Local Meaning Distractors:
 * 1. Filter Vault pool by SAME type AND SAME register
 * 2. Fallback to SAME type (any register)
 * 3. Fallback to general pool only if Vault has too few matching items
 * 4. Normalize formatting across ALL 4 options (correct + 3 distractors)
 */
export function buildNormalizedMeaningChoices(params: {
  target: DistractorCandidateItem;
  pool: DistractorCandidateItem[];
  lang: AppLanguage;
  aiDistractors?: string[];
}): { choices: string[]; correctChoice: string; usedAi: boolean } {
  const { target, pool, lang, aiDistractors } = params;
  const correctChoice = normalizeMeaningOption(
    getLocalizedMeaning(target, lang)
  );
  const targetTermKey = normalizeTermKey(target.term);
  const seen = new Set<string>([correctChoice.toLowerCase()]);
  const picked: string[] = [];

  const tryPush = (raw: string): boolean => {
    const norm = normalizeMeaningOption(raw);
    if (!norm) return false;
    const key = norm.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    picked.push(norm);
    return true;
  };

  // Layer 1: AI plausible distractors (if already provided or cached)
  const cachedAi =
    aiDistractors && aiDistractors.length > 0
      ? aiDistractors
      : getCachedAiMeaningDistractors(
          target.term,
          getLocalizedMeaning(target, lang),
          lang
        );

  let aiUsedCount = 0;
  if (cachedAi && cachedAi.length > 0) {
    for (const cand of cachedAi) {
      if (picked.length >= 3) break;
      if (tryPush(cand)) aiUsedCount += 1;
    }
  }

  // Layer 2: Smart Local Fallback (same type + same register -> same type -> general pool -> static)
  if (picked.length < 3) {
    const others = pool.filter(
      (item) =>
        item.id !== target.id &&
        normalizeTermKey(item.term) !== targetTermKey
    );

    const tier1SameTypeAndRegister = shuffleOptions(
      others.filter(
        (item) =>
          item.type === target.type && item.register === target.register
      )
    );
    const tier2SameType = shuffleOptions(
      others.filter(
        (item) =>
          item.type === target.type && item.register !== target.register
      )
    );
    const tier3General = shuffleOptions(
      others.filter((item) => item.type !== target.type)
    );

    for (const candidate of [
      ...tier1SameTypeAndRegister,
      ...tier2SameType,
      ...tier3General,
    ]) {
      if (picked.length >= 3) break;
      tryPush(getLocalizedMeaning(candidate, lang));
    }
  }

  if (picked.length < 3) {
    const staticPool = [
      ...STATIC_MEANING_FALLBACKS[lang][target.type],
      ...STATIC_MEANING_FALLBACKS[lang].vocab,
    ];
    for (const fallback of shuffleOptions(staticPool)) {
      if (picked.length >= 3) break;
      tryPush(fallback);
    }
  }

  return {
    choices: shuffleOptions([correctChoice, ...picked.slice(0, 3)]),
    correctChoice,
    usedAi: aiUsedCount >= 3,
  };
}

/**
 * Layer 2 — Smart Local Term Distractors for Fill-in-the-Blank Word Bank:
 * Filters by SAME type + SAME register -> SAME type -> general pool -> static type-matched fallback.
 */
export function buildNormalizedTermChoices(params: {
  target: DistractorCandidateItem;
  blankTarget: string;
  pool: DistractorCandidateItem[];
}): { choices: string[]; correctChoice: string } {
  const { target, blankTarget, pool } = params;
  const correctChoice = normalizeTermOption(blankTarget) || target.term.trim();
  const targetNorm = normalizeTermKey(correctChoice);
  const rawTermNorm = normalizeTermKey(target.term);
  const seen = new Set<string>([targetNorm, rawTermNorm]);
  const picked: string[] = [];

  const tryPush = (raw: string) => {
    const clean = normalizeTermOption(raw);
    const key = normalizeTermKey(clean);
    if (!clean || !key || seen.has(key)) return;
    seen.add(key);
    picked.push(clean);
  };

  const others = pool.filter(
    (item) =>
      item.id !== target.id &&
      normalizeTermKey(item.term) !== targetNorm &&
      normalizeTermKey(item.term) !== rawTermNorm
  );

  const tier1 = shuffleOptions(
    others.filter(
      (item) => item.type === target.type && item.register === target.register
    )
  );
  const tier2 = shuffleOptions(
    others.filter(
      (item) => item.type === target.type && item.register !== target.register
    )
  );
  const tier3 = shuffleOptions(
    others.filter((item) => item.type !== target.type)
  );

  for (const cand of [...tier1, ...tier2, ...tier3]) {
    if (picked.length >= 3) break;
    tryPush(cand.term);
  }

  if (picked.length < 3) {
    const staticPool = [
      ...STATIC_TERM_FALLBACKS[target.type],
      ...STATIC_TERM_FALLBACKS.vocab,
    ];
    for (const fb of shuffleOptions(staticPool)) {
      if (picked.length >= 3) break;
      tryPush(fb);
    }
  }

  return {
    choices: shuffleOptions([correctChoice, ...picked.slice(0, 3)]),
    correctChoice,
  };
}

export function getCachedAiMeaningDistractors(
  term: string,
  meaning: string,
  lang: AppLanguage
): string[] | null {
  ensureLocalCacheLoaded();
  const key = buildCacheKey(lang, term, meaning);
  const hit = memoryCache.get(key);
  if (!hit || hit.distractors.length === 0) return null;
  return hit.distractors;
}

/**
 * Layer 1 — Fetches hard, plausible AI distractors in a single fast batched API call
 * for any uncached quiz items, caching results in memory + localStorage for instant reuse.
 * Silently degrades to cached / empty results if offline, rate-limited, or timed out.
 */
export async function fetchAiMeaningDistractorsBatch(
  targets: AiDistractorRequestTarget[],
  lang: AppLanguage,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<Record<string, string[]>> {
  ensureLocalCacheLoaded();
  const result: Record<string, string[]> = {};
  const uncached: AiDistractorRequestTarget[] = [];

  for (const target of targets) {
    const cleanMeaning = target.meaning.trim();
    if (!cleanMeaning) continue;
    const cached = getCachedAiMeaningDistractors(
      target.term,
      cleanMeaning,
      lang
    );
    if (cached && cached.length >= 3) {
      result[target.id] = cached;
    } else {
      uncached.push(target);
    }
  }

  if (uncached.length === 0) {
    return result;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return result;
  }

  const batch = uncached.slice(0, 12);
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? CLIENT_FETCH_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (options?.signal) {
    if (options.signal.aborted) {
      clearTimeout(timer);
      return result;
    }
    options.signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    const res = await fetch("/api/quiz-distractors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        lang,
        items: batch.map((it) => ({
          id: it.id,
          term: it.term,
          type: it.type,
          register: it.register,
          cefr: it.cefr,
          meaning: it.meaning,
        })),
      }),
    });

    if (!res.ok) {
      return result;
    }

    const json = (await res.json()) as {
      distractorsById?: Record<string, string[]>;
    };
    const byId = json.distractorsById ?? {};
    let wroteAny = false;

    for (const item of batch) {
      const list = byId[item.id];
      if (!Array.isArray(list) || list.length === 0) continue;
      const normalized = list
        .map((d) => normalizeMeaningOption(String(d || "")))
        .filter(Boolean)
        .slice(0, 3);
      if (normalized.length > 0) {
        result[item.id] = normalized;
        memoryCache.set(buildCacheKey(lang, item.term, item.meaning), {
          distractors: normalized,
          cachedAt: Date.now(),
        });
        wroteAny = true;
      }
    }

    if (wroteAny) {
      persistLocalCache();
    }
  } catch {
    // Silent failover to Layer 2 smart local distractors
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onExternalAbort);
  }

  return result;
}
