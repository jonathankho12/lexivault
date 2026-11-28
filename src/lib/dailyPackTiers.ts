import type {
  CefrLevel,
  DailyPackLevelSetting,
  DailyPackTargetTier,
} from "@/types/lexivault";

export interface DailyPackTierMeta {
  id: DailyPackTargetTier;
  displayLabel: string;
  nameEn: string;
  nameId: string;
  nameRu: string;
  cefrPair: [CefrLevel, CefrLevel];
  badgeClass: string;
}

export const DAILY_PACK_TIER_LIST: DailyPackTierMeta[] = [
  {
    id: "A1-A2",
    displayLabel: "A1–A2",
    nameEn: "Foundation",
    nameId: "Dasar (Foundation)",
    nameRu: "Базовый",
    cefrPair: ["A1", "A2"],
    badgeClass: "bg-[#30D158]/15 border-[#30D158]/35 text-[#7CF099]",
  },
  {
    id: "A2-B1",
    displayLabel: "A2–B1",
    nameEn: "Elementary–Pre-Intermediate",
    nameId: "Dasar–Pra-Menengah",
    nameRu: "Начальный–Ниже среднего",
    cefrPair: ["A2", "B1"],
    badgeClass: "bg-[#32ADE6]/15 border-[#32ADE6]/35 text-[#7DD3FC]",
  },
  {
    id: "B1-B2",
    displayLabel: "B1–B2",
    nameEn: "Intermediate–Upper-Intermediate",
    nameId: "Menengah–Menengah Atas",
    nameRu: "Средний–Выше среднего",
    cefrPair: ["B1", "B2"],
    badgeClass: "bg-[#0A84FF]/15 border-[#0A84FF]/35 text-[#70BCFF]",
  },
  {
    id: "B2-C1",
    displayLabel: "B2–C1",
    nameEn: "Upper-Intermediate–Advanced",
    nameId: "Menengah Atas–Mahir",
    nameRu: "Выше среднего–Продвинутый",
    cefrPair: ["B2", "C1"],
    badgeClass: "bg-[#5E5CE6]/20 border-[#5E5CE6]/40 text-[#C4C2FF]",
  },
  {
    id: "C1-C2",
    displayLabel: "C1–C2",
    nameEn: "Advanced–Proficiency",
    nameId: "Mahir–Profisiensi",
    nameRu: "Продвинутый–Свободный",
    cefrPair: ["C1", "C2"],
    badgeClass: "bg-[#FF9F0A]/15 border-[#FF9F0A]/35 text-[#FFD18C]",
  },
];

const VALID_TIERS = new Set<DailyPackTargetTier>([
  "A1-A2",
  "A2-B1",
  "B1-B2",
  "B2-C1",
  "C1-C2",
]);

export function isValidDailyPackTargetTier(
  val: unknown
): val is DailyPackTargetTier {
  return typeof val === "string" && VALID_TIERS.has(val as DailyPackTargetTier);
}

export function isValidDailyPackLevelSetting(
  val: unknown
): val is DailyPackLevelSetting {
  return val === "auto" || isValidDailyPackTargetTier(val);
}

export function mapCefrToDailyPackTier(
  cefr?: CefrLevel | null
): DailyPackTargetTier {
  switch (cefr) {
    case "A1":
      return "A1-A2";
    case "A2":
      return "A2-B1";
    case "B1":
      return "B1-B2";
    case "B2":
      return "B2-C1";
    case "C1":
    case "C2":
      return "C1-C2";
    default:
      return "B1-B2";
  }
}

export function resolveDailyPackTier(
  setting: DailyPackLevelSetting | undefined | null,
  placementCefr?: CefrLevel | null
): DailyPackTargetTier {
  if (setting && setting !== "auto" && isValidDailyPackTargetTier(setting)) {
    return setting;
  }
  return mapCefrToDailyPackTier(placementCefr);
}

export function getDailyPackTierMeta(
  tier: DailyPackTargetTier
): DailyPackTierMeta {
  return (
    DAILY_PACK_TIER_LIST.find((t) => t.id === tier) ?? DAILY_PACK_TIER_LIST[2]
  );
}

export function formatDailyPackTierLabel(
  setting: DailyPackLevelSetting,
  resolvedTier: DailyPackTargetTier
): string {
  const display = getDailyPackTierMeta(resolvedTier).displayLabel;
  return setting === "auto" ? `Auto (${display})` : display;
}
