import type { StudyLog, WordEntry } from "@/types/lexivault";

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
