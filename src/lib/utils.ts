import type { AppLanguage } from "@/lib/i18n";
import type { SourceTag, StudyLog, WordEntry } from "@/types/lexivault";

export const CANONICAL_SOURCE_TAGS: SourceTag[] = [
  "film",
  "book",
  "lecture",
  "article",
  "general",
];

/**
 * Normalizes legacy Indonesian, English, or custom source tags into canonical keys
 * so filters & badges stay consistent across EN/ID without breaking existing rows.
 */
export function normalizeSourceTag(raw?: string | null): string {
  const cleaned = (raw ?? "").trim();
  if (!cleaned) return "general";
  const lower = cleaned.toLowerCase();
  switch (lower) {
    case "film":
    case "movie":
      return "film";
    case "buku":
    case "book":
      return "book";
    case "kuliah":
    case "lecture":
      return "lecture";
    case "artikel":
    case "article":
      return "article";
    case "umum":
    case "general":
      return "general";
    case "discover":
      return "discover";
    case "ai suggest":
    case "ai_suggest":
    case "saran ai":
      return "ai_suggest";
    case "daily_pack":
    case "daily pack":
    case "target harian":
      return "daily_pack";
    default:
      return cleaned;
  }
}

export function formatSourceTagLabel(
  raw: string | null | undefined,
  lang: AppLanguage
): string {
  const key = normalizeSourceTag(raw);
  const labels: Record<string, { en: string; id: string }> = {
    film: { en: "Film", id: "Film" },
    book: { en: "Book", id: "Buku" },
    lecture: { en: "Lecture", id: "Kuliah" },
    article: { en: "Article", id: "Artikel" },
    general: { en: "General", id: "Umum" },
    discover: { en: "Discover", id: "Discover" },
    ai_suggest: { en: "AI Suggest", id: "Saran AI" },
    daily_pack: { en: "Daily Pack", id: "Target Harian" },
  };
  const match = labels[key];
  if (match) return match[lang];
  return raw?.trim() || (lang === "en" ? "General" : "Umum");
}

export function getLocalizedMeaning(
  item: {
    meaning_id?: string | null;
    meaning_en?: string | null;
  },
  lang: AppLanguage
): string {
  const en = item.meaning_en?.trim();
  const id = item.meaning_id?.trim();
  if (lang === "en") {
    return en || id || "";
  }
  return id || en || "";
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftDateString(baseDateStr: string, deltaDays: number): string {
  const [y, m, d] = baseDateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + deltaDays);
  return getLocalDateString(dt);
}

export function getLastNDays(n: number, todayStr: string): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(shiftDateString(todayStr, -i));
  }
  return days;
}

export function formatShortDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString("en-US", { weekday: "short" });
}

export function calculateStreak(logs: StudyLog[], todayStr: string): number {
  const activeDates = new Set(
    logs
      .filter((log) => log.reviews_count > 0 || log.words_added > 0)
      .map((log) => log.study_date)
  );

  let cursor = todayStr;
  if (!activeDates.has(cursor)) {
    const yesterday = shiftDateString(todayStr, -1);
    if (!activeDates.has(yesterday)) {
      return 0;
    }
    cursor = yesterday;
  }

  let streak = 0;
  while (activeDates.has(cursor)) {
    streak += 1;
    cursor = shiftDateString(cursor, -1);
  }
  return streak;
}

export function getWordAccuracy(word: WordEntry): number | null {
  const total = word.correct_count + word.wrong_count;
  if (total === 0) return null;
  return Math.round((word.correct_count / total) * 100);
}

export function getWeakestWords(words: WordEntry[], limit?: number): WordEntry[] {
  const weak = words
    .filter((w) => w.wrong_count > 0)
    .sort((a, b) => {
      const rateA = a.wrong_count / Math.max(1, a.correct_count + a.wrong_count);
      const rateB = b.wrong_count / Math.max(1, b.correct_count + b.wrong_count);
      if (Math.abs(rateB - rateA) > 0.01) {
        return rateB - rateA;
      }
      if (b.wrong_count !== a.wrong_count) {
        return b.wrong_count - a.wrong_count;
      }
      return a.correct_count - b.correct_count;
    });

  return typeof limit === "number" ? weak.slice(0, limit) : weak;
}

export function normalizeTermKey(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Strict yet practical normalization for instant 0ms local duplicate detection:
 * lowercases, trims, strips edge punctuation, collapses whitespace, and strips
 * optional leading articles/infinitive marker ("to ", "a ", "an ", "the ").
 */
export function normalizeDuplicateKey(term: string): string {
  const cleaned = term
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "")
    .replace(/\s+/g, " ");
  const stripped = cleaned.replace(/^(to|a|an|the)\s+/i, "").trim();
  return stripped.length >= 2 ? stripped : cleaned;
}

export function findLocalDuplicateWord(
  rawTerm: string,
  words: WordEntry[]
): WordEntry | null {
  const targetExact = normalizeTermKey(rawTerm);
  const targetNorm = normalizeDuplicateKey(rawTerm);
  if (!targetNorm) return null;

  for (const word of words) {
    if (
      normalizeTermKey(word.term) === targetExact ||
      normalizeDuplicateKey(word.term) === targetNorm
    ) {
      return word;
    }
  }
  return null;
}

export function formatRegisterBadgeClass(register: WordEntry["register"]): string {
  switch (register) {
    case "Academic":
      return "text-[#A7A5FF] bg-[#5E5CE6]/20 border-[#5E5CE6]/35";
    case "Formal":
      return "text-[#64B5FF] bg-[#0A84FF]/20 border-[#0A84FF]/35";
    case "Slang":
      return "text-[#FFB340] bg-[#FF9F0A]/20 border-[#FF9F0A]/35";
    case "Casual":
    default:
      return "text-[#5CE67E] bg-[#30D158]/15 border-[#30D158]/30";
  }
}

export function formatTypeLabel(type: WordEntry["type"]): string {
  switch (type) {
    case "idiom":
      return "Idiom";
    case "collocation":
      return "Collocation";
    case "vocab":
    default:
      return "Vocab";
  }
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

/**
 * Formats API error codes returned by Gemini routes into friendly, localized EN/ID copy.
 * Strictly distinguishes temporary 503 overload & 429 rate-limit spikes from 404 model errors.
 */
export function formatGeminiClientError(
  code: string | undefined,
  httpStatus: number,
  fallbackMessage: string,
  lang: AppLanguage
): string {
  const isEn = lang === "en";
  switch (code) {
    case "overload":
      return isEn
        ? "Gemini AI is experiencing high demand right now. Please try again in a moment."
        : "Server Gemini AI sedang sibuk. Silakan coba lagi sebentar.";
    case "rate_limit":
    case "quota":
      return isEn
        ? "Gemini AI rate limit reached right now. Please try again in a moment."
        : "Batas permintaan Gemini AI sedang penuh. Silakan coba lagi sebentar.";
    case "network":
      return isEn
        ? "Unable to reach Gemini AI right now (network timeout). Please try again."
        : "Koneksi ke server Gemini AI timeout. Silakan coba lagi.";
    case "missing_key":
      return isEn
        ? "GEMINI_API_KEY is not configured on the server."
        : "GEMINI_API_KEY belum terkonfigurasi di server.";
    case "auth":
      return isEn
        ? "Gemini API key authentication failed."
        : "Autentikasi Gemini API key gagal.";
    case "model":
      return isEn
        ? "Configured Gemini model is unavailable or rejected the request."
        : "Model Gemini yang dikonfigurasi tidak tersedia atau menolak permintaan.";
    case "empty_response":
      return isEn
        ? "Gemini AI returned an empty response. Please try again."
        : "Server Gemini AI mengembalikan respons kosong. Silakan coba lagi.";
    case "parse_error":
      return isEn
        ? "Gemini AI response was cut off before finishing. Please try again."
        : "Respons Gemini AI terpotong sebelum selesai. Silakan coba lagi.";
    case "incomplete_response":
      return isEn
        ? "Gemini AI returned incomplete word details. Please try again."
        : "Detail kata dari Gemini AI tidak lengkap. Silakan coba lagi.";
    default:
      if (httpStatus === 503) {
        return isEn
          ? "Gemini AI is experiencing high demand right now. Please try again in a moment."
          : "Server Gemini AI sedang sibuk. Silakan coba lagi sebentar.";
      }
      if (httpStatus === 429) {
        return isEn
          ? "Gemini AI rate limit reached right now. Please try again in a moment."
          : "Batas permintaan Gemini AI sedang penuh. Silakan coba lagi sebentar.";
      }
      return fallbackMessage;
  }
}
