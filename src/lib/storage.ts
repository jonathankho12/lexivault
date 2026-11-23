import type {
  DailyDiscoveryPack,
  DailyPackRecord,
  DailyQuotaSettings,
  DiscoveryItem,
  Sm2Rating,
  StudyLog,
  SyncMode,
  WordEntry,
} from "@/types/lexivault";
import { isLocalOnlyUserId } from "@/lib/auth";
import { cacheWordMeanings, resolveWordMeanings } from "@/lib/bilingualCache";
import {
  DAILY_RING_TARGETS,
  getMasteryRankInfo,
  normalizeRingTargets,
  readCustomRingTargets,
  writeCustomRingTargets,
  type DailyRingTargets,
} from "@/lib/gamification";
import { buildInitialMockWords } from "@/lib/mockData";
import {
  cacheWordPronunciation,
  resolveWordPronunciation,
} from "@/lib/pronunciation";
import { calculateSm2Next, getEffectiveReviewCount } from "@/lib/sm2";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { isValidUuid, normalizeSourceTag, normalizeTermKey } from "@/lib/utils";

function getScopedSupabase(userId: string) {
  if (isLocalOnlyUserId(userId) || !isSupabaseConfigured()) return null;
  return getSupabaseClient();
}

const wordsKey = (userId: string) => `lexivault_words_v2_${userId}`;
const logsKey = (userId: string) => `lexivault_study_logs_v2_${userId}`;
const discoverKey = (userId: string) => `lexivault_discoveries_v2_${userId}`;
const demoClearedKey = (userId: string) => `lexivault_demo_cleared_v2_${userId}`;
const xpKey = (userId: string) => `lexivault_xp_v1_${userId}`;
const reviewMetaKey = (userId: string) => `lexivault_review_meta_v1_${userId}`;
const dailyQuotaKey = (userId: string) => `lexivault_daily_quota_v1_${userId}`;
const dailyPackKey = (userId: string, dateStr: string) =>
  `lexivault_daily_pack_v1_${userId}_${dateStr}`;

export const DEFAULT_DAILY_QUOTA: DailyQuotaSettings = {
  wordsPerDay: 10,
  idiomsPerDay: 5,
  autoShowPopup: true,
};

function clampInt(
  val: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const num = typeof val === "number" ? Math.round(val) : Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

export function normalizeDailyQuota(
  partial: Partial<DailyQuotaSettings> | null | undefined
): DailyQuotaSettings {
  return {
    wordsPerDay: clampInt(
      partial?.wordsPerDay,
      0,
      30,
      DEFAULT_DAILY_QUOTA.wordsPerDay
    ),
    idiomsPerDay: clampInt(
      partial?.idiomsPerDay,
      0,
      20,
      DEFAULT_DAILY_QUOTA.idiomsPerDay
    ),
    autoShowPopup:
      typeof partial?.autoShowPopup === "boolean"
        ? partial.autoShowPopup
        : DEFAULT_DAILY_QUOTA.autoShowPopup,
  };
}

export function readLocalDailyQuota(userId: string): DailyQuotaSettings {
  if (typeof window === "undefined") return { ...DEFAULT_DAILY_QUOTA };
  const parsed = safeParseJson<Partial<DailyQuotaSettings>>(
    window.localStorage.getItem(dailyQuotaKey(userId))
  );
  return normalizeDailyQuota(parsed);
}

export function writeLocalDailyQuota(
  userId: string,
  quota: DailyQuotaSettings
): DailyQuotaSettings {
  const normalized = normalizeDailyQuota(quota);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      dailyQuotaKey(userId),
      JSON.stringify(normalized)
    );
  }
  return normalized;
}

interface ReviewMetaRecord {
  last_reviewed_date?: string | null;
  review_count?: number;
  next_review_at?: string | null;
  interval_days?: number;
  ease_factor?: number;
  repetitions?: number;
}

function readReviewMetaMap(userId: string): Record<string, ReviewMetaRecord> {
  if (typeof window === "undefined") return {};
  return (
    safeParseJson<Record<string, ReviewMetaRecord>>(
      window.localStorage.getItem(reviewMetaKey(userId))
    ) ?? {}
  );
}

function writeReviewMeta(userId: string, word: WordEntry): void {
  if (typeof window === "undefined") return;
  try {
    const map = readReviewMetaMap(userId);
    const meta: ReviewMetaRecord = {
      last_reviewed_date: word.last_reviewed_date ?? null,
      review_count: getEffectiveReviewCount(word),
      next_review_at: word.next_review_at ?? null,
      interval_days: word.interval_days,
      ease_factor: word.ease_factor,
      repetitions: word.repetitions,
    };
    map[word.id] = meta;
    map[`term:${normalizeTermKey(word.term)}`] = meta;
    window.localStorage.setItem(reviewMetaKey(userId), JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function hydrateWordMetadata(word: WordEntry, userId?: string): WordEntry {
  const resolvedPron = resolveWordPronunciation(
    word.term,
    word.pronunciation,
    word.ipa
  );
  const resolvedMeanings = resolveWordMeanings(
    word.term,
    word.meaning_id,
    word.meaning_en,
    word.cefr
  );

  let reviewMeta: ReviewMetaRecord | undefined;
  if (userId && typeof window !== "undefined") {
    const map = readReviewMetaMap(userId);
    reviewMeta = map[word.id] ?? map[`term:${normalizeTermKey(word.term)}`];
  }

  const lastReviewedDate =
    word.last_reviewed_date ?? reviewMeta?.last_reviewed_date ?? null;
  const reviewCount = Math.max(
    word.review_count ?? 0,
    reviewMeta?.review_count ?? 0,
    (word.correct_count || 0) + (word.wrong_count || 0)
  );

  return {
    ...word,
    pronunciation: resolvedPron.pronunciation ?? undefined,
    ipa: resolvedPron.ipa ?? undefined,
    meaning_id: resolvedMeanings.meaning_id,
    meaning_en: resolvedMeanings.meaning_en,
    cefr: resolvedMeanings.cefr,
    source_tag: normalizeSourceTag(word.source_tag),
    last_reviewed_date: lastReviewedDate,
    review_count: reviewCount,
    next_review_at: word.next_review_at ?? reviewMeta?.next_review_at ?? null,
    interval_days: word.interval_days ?? reviewMeta?.interval_days ?? 0,
    ease_factor: word.ease_factor ?? reviewMeta?.ease_factor ?? 2.5,
    repetitions: word.repetitions ?? reviewMeta?.repetitions ?? 0,
  };
}

function hydrateDiscoveryMetadata(item: DiscoveryItem): DiscoveryItem {
  const resolvedPron = resolveWordPronunciation(
    item.term,
    item.pronunciation,
    item.ipa
  );
  const resolvedMeanings = resolveWordMeanings(
    item.term,
    item.meaning_id,
    item.meaning_en,
    item.cefr
  );
  return {
    ...item,
    pronunciation: resolvedPron.pronunciation ?? undefined,
    ipa: resolvedPron.ipa ?? undefined,
    meaning_id: resolvedMeanings.meaning_id,
    meaning_en: resolvedMeanings.meaning_en,
    cefr: resolvedMeanings.cefr,
  };
}

function readLocalWords(
  todayStr: string,
  userId: string,
  allowSeed = true
): WordEntry[] {
  if (typeof window === "undefined") return [];
  const key = wordsKey(userId);
  const raw = window.localStorage.getItem(key);
  const demoCleared =
    window.localStorage.getItem(demoClearedKey(userId)) === "true";

  if (raw === null) {
    if (!allowSeed || demoCleared) return [];
    const seeded = buildInitialMockWords(todayStr).map((w) => ({
      ...w,
      user_id: userId,
    }));
    window.localStorage.setItem(key, JSON.stringify(seeded));
    return seeded;
  }

  const parsed = safeParseJson<WordEntry[]>(raw);
  return Array.isArray(parsed)
    ? parsed.map((w) => hydrateWordMetadata(w, userId))
    : [];
}

function writeLocalWords(words: WordEntry[], userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(wordsKey(userId), JSON.stringify(words));
  } catch {
    // Ignore quota errors
  }
}

function readLocalLogs(userId: string): StudyLog[] {
  if (typeof window === "undefined") return [];
  const key = logsKey(userId);
  const raw = window.localStorage.getItem(key);
  if (raw === null) return [];

  const parsed = safeParseJson<StudyLog[]>(raw);
  if (!Array.isArray(parsed)) return [];

  const realLogs = parsed.filter((log) => !log.id?.startsWith("mock-log-"));
  if (realLogs.length !== parsed.length) {
    window.localStorage.setItem(key, JSON.stringify(realLogs));
  }
  return realLogs;
}

function writeLocalLogs(logs: StudyLog[], userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(logsKey(userId), JSON.stringify(logs));
  } catch {
    // Ignore quota errors
  }
}

function readLocalXp(userId: string): number {
  if (typeof window === "undefined") return 0;
  const raw = Number(window.localStorage.getItem(xpKey(userId)) ?? "0");
  return Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
}

function writeLocalXp(userId: string, value: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(xpKey(userId), String(Math.max(0, Math.round(value))));
}

function deriveXpFromLogs(logs: StudyLog[]): number {
  return logs.reduce((acc, log) => {
    const explicit = Number(log.xp_earned ?? 0);
    if (explicit > 0) return acc + explicit;
    return acc + (log.reviews_count || 0) * 12 + (log.words_added || 0) * 15;
  }, 0);
}

interface CloudMetadataEnvelope {
  xp?: number;
  dailyQuota?: Partial<DailyQuotaSettings>;
  ringTargets?: Partial<DailyRingTargets>;
}

async function mirrorCloudMetadataToAuth(
  userId: string,
  patch: {
    xp?: number;
    dailyQuota?: DailyQuotaSettings;
    ringTargets?: DailyRingTargets;
    dailyPack?: DailyPackRecord | null;
  }
): Promise<void> {
  const supabase = getScopedSupabase(userId);
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getUser();
    const existingMeta = (data.user?.user_metadata ?? {}) as Record<
      string,
      unknown
    >;
    const existingCloud =
      (existingMeta.lexivault_cloud as CloudMetadataEnvelope | undefined) ?? {};

    const nextCloud: CloudMetadataEnvelope = {
      ...existingCloud,
      ...(typeof patch.xp === "number"
        ? { xp: Math.max(existingCloud.xp ?? 0, Math.round(patch.xp)) }
        : {}),
      ...(patch.dailyQuota ? { dailyQuota: patch.dailyQuota } : {}),
      ...(patch.ringTargets ? { ringTargets: patch.ringTargets } : {}),
    };

    const nextUserMeta: Record<string, unknown> = {
      ...existingMeta,
      lexivault_cloud: nextCloud,
    };

    if (patch.dailyPack !== undefined) {
      nextUserMeta.lexivault_daily_pack = patch.dailyPack;
    }

    await supabase.auth.updateUser({ data: nextUserMeta });
  } catch {
    // Non-fatal secondary mirror
  }
}

async function upsertStudyLogCloud(
  userId: string,
  payload: {
    user_id: string;
    study_date: string;
    reviews_count: number;
    correct_count: number;
    wrong_count: number;
    words_added: number;
    vocab_today: number;
    recall_today: number;
    ielts_today: number;
    xp_earned: number;
    updated_at: string;
  }
): Promise<StudyLog | null> {
  const supabase = getScopedSupabase(userId);
  if (!supabase) return null;

  try {
    let { data, error } = await supabase
      .from("study_logs")
      .upsert(payload, { onConflict: "user_id,study_date" })
      .select("*")
      .single();

    // Retry with core columns if optional rings/xp columns aren't migrated yet
    if (error) {
      const basePayload = {
        user_id: payload.user_id,
        study_date: payload.study_date,
        reviews_count: payload.reviews_count,
        correct_count: payload.correct_count,
        wrong_count: payload.wrong_count,
        words_added: payload.words_added,
        updated_at: payload.updated_at,
      };
      const retry = await supabase
        .from("study_logs")
        .upsert(basePayload, { onConflict: "user_id,study_date" })
        .select("*")
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data) {
      const merged: StudyLog = {
        ...(data as StudyLog),
        vocab_today: (data as StudyLog).vocab_today ?? payload.vocab_today,
        recall_today: (data as StudyLog).recall_today ?? payload.recall_today,
        ielts_today: (data as StudyLog).ielts_today ?? payload.ielts_today,
        xp_earned: (data as StudyLog).xp_earned ?? payload.xp_earned,
      };
      return merged;
    }

    if (error) {
      console.error("[LexiVault] Supabase study_logs upsert failed:", error.message);
    }
  } catch (err) {
    console.error("[LexiVault] Supabase study_logs exception:", err);
  }
  return null;
}

export async function clearDemoData(
  todayStr: string,
  userId: string
): Promise<{
  words: WordEntry[];
  studyLogs: StudyLog[];
}> {
  const supabase = getScopedSupabase(userId);
  if (supabase) {
    const fresh = await loadInitialData(todayStr, userId);
    return {
      words: fresh.words,
      studyLogs: fresh.studyLogs,
    };
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(demoClearedKey(userId), "true");
    const customWords = readLocalWords(todayStr, userId).filter(
      (w) => !w.id.startsWith("mock-word-")
    );
    writeLocalWords(customWords, userId);

    const realLogs = readLocalLogs(userId);
    writeLocalLogs(realLogs, userId);

    return {
      words: customWords,
      studyLogs: realLogs,
    };
  }

  return { words: [], studyLogs: [] };
}

export interface HydratedCloudState {
  words: WordEntry[];
  studyLogs: StudyLog[];
  xp: number;
  dailyQuota: DailyQuotaSettings;
  ringTargets: DailyRingTargets;
  dailyPack: DailyPackRecord | null;
  syncMode: SyncMode;
  cloudReachable: boolean;
}

export async function loadInitialData(
  todayStr: string,
  userId: string
): Promise<HydratedCloudState> {
  const supabase = getScopedSupabase(userId);
  const localQuota = readLocalDailyQuota(userId);
  const localRings = readCustomRingTargets();
  const localXp = readLocalXp(userId);
  const localPack = readLocalDailyPack(todayStr, userId);

  if (supabase) {
    const [
      wordsSettled,
      logsSettled,
      profileSettled,
      ieltsSettled,
      packSettled,
      authUserSettled,
    ] = await Promise.allSettled([
      supabase
        .from("words")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("study_logs")
        .select("*")
        .eq("user_id", userId)
        .order("study_date", { ascending: false }),
      supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("ielts_profiles")
        .select("xp, mastery_rank")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("daily_packs")
        .select("*")
        .eq("user_id", userId)
        .eq("pack_date", todayStr)
        .maybeSingle(),
      supabase.auth.getUser(),
    ]);

    const wordsOk =
      wordsSettled.status === "fulfilled" && !wordsSettled.value.error;
    const logsOk =
      logsSettled.status === "fulfilled" && !logsSettled.value.error;

    if (wordsSettled.status === "fulfilled" && wordsSettled.value.error) {
      console.error(
        "[LexiVault] Supabase words load error:",
        wordsSettled.value.error.message
      );
    }
    if (logsSettled.status === "fulfilled" && logsSettled.value.error) {
      console.error(
        "[LexiVault] Supabase study_logs load error:",
        logsSettled.value.error.message
      );
    }

    const authMeta =
      authUserSettled.status === "fulfilled" &&
      authUserSettled.value.data.user?.user_metadata
        ? (authUserSettled.value.data.user.user_metadata as Record<
            string,
            unknown
          >)
        : {};
    const cloudMeta =
      (authMeta.lexivault_cloud as CloudMetadataEnvelope | undefined) ?? {};
    const metaDailyPack = authMeta.lexivault_daily_pack as
      | DailyPackRecord
      | undefined;

    const cloudReachable =
      wordsOk ||
      logsOk ||
      (authUserSettled.status === "fulfilled" &&
        Boolean(authUserSettled.value.data.user));

    // Cloud words are strictly source of truth when words query succeeded (never overwrite with mock defaults!)
    const cloudWords = wordsOk
      ? ((wordsSettled.value.data as WordEntry[]) ?? []).map((w) =>
          hydrateWordMetadata(w, userId)
        )
      : readLocalWords(todayStr, userId, false);

    if (wordsOk) {
      writeLocalWords(cloudWords, userId);
    }

    const cloudLogs = logsOk
      ? ((logsSettled.value.data as StudyLog[]) ?? []).map((l) => ({
          ...l,
          vocab_today: l.vocab_today ?? l.words_added ?? 0,
          recall_today: l.recall_today ?? l.reviews_count ?? 0,
          ielts_today: l.ielts_today ?? 0,
          xp_earned: l.xp_earned ?? 0,
        }))
      : readLocalLogs(userId);

    if (logsOk) {
      writeLocalLogs(cloudLogs, userId);
    }

    // Profile + XP resolution across user_profiles, ielts_profiles, auth metadata, and study_logs
    const profileRow =
      profileSettled.status === "fulfilled" && !profileSettled.value.error
        ? (profileSettled.value.data as {
            xp?: number;
            daily_words_quota?: number;
            daily_idioms_quota?: number;
            auto_show_daily_pack?: boolean;
            ring_targets_json?: Partial<DailyRingTargets>;
          } | null)
        : null;

    const ieltsRow =
      ieltsSettled.status === "fulfilled" && !ieltsSettled.value.error
        ? (ieltsSettled.value.data as { xp?: number } | null)
        : null;

    const derivedFromLogs = deriveXpFromLogs(cloudLogs);
    const resolvedXp = Math.max(
      Number(profileRow?.xp ?? 0) || 0,
      Number(ieltsRow?.xp ?? 0) || 0,
      Number(cloudMeta.xp ?? 0) || 0,
      derivedFromLogs,
      localXp
    );
    writeLocalXp(userId, resolvedXp);

    const resolvedQuota = profileRow
      ? normalizeDailyQuota({
          wordsPerDay: profileRow.daily_words_quota,
          idiomsPerDay: profileRow.daily_idioms_quota,
          autoShowPopup: profileRow.auto_show_daily_pack,
        })
      : cloudMeta.dailyQuota
        ? normalizeDailyQuota(cloudMeta.dailyQuota)
        : localQuota;
    writeLocalDailyQuota(userId, resolvedQuota);

    const resolvedRings = profileRow?.ring_targets_json
      ? normalizeRingTargets(profileRow.ring_targets_json)
      : cloudMeta.ringTargets
        ? normalizeRingTargets(cloudMeta.ringTargets)
        : localRings;
    writeCustomRingTargets(resolvedRings);

    // Daily Pack resolution for todayStr (cloud daily_packs -> auth metadata -> localStorage)
    let resolvedPack: DailyPackRecord | null = null;
    if (
      packSettled.status === "fulfilled" &&
      !packSettled.value.error &&
      packSettled.value.data
    ) {
      const row = packSettled.value.data as {
        pack_date: string;
        words_quota: number;
        idioms_quota: number;
        items_json: DailyPackRecord["items"];
        completed_terms: string[];
        completed_at?: string | null;
      };
      if (Array.isArray(row.items_json) && row.items_json.length > 0) {
        resolvedPack = {
          pack_date: row.pack_date,
          words_quota: row.words_quota,
          idioms_quota: row.idioms_quota,
          items: row.items_json,
          completed_terms: Array.isArray(row.completed_terms)
            ? row.completed_terms
            : [],
          completed_at: row.completed_at ?? null,
          source: "supabase",
        };
      }
    }

    if (
      !resolvedPack &&
      metaDailyPack &&
      metaDailyPack.pack_date === todayStr &&
      Array.isArray(metaDailyPack.items) &&
      metaDailyPack.items.length > 0
    ) {
      resolvedPack = { ...metaDailyPack, source: "supabase" };
    }

    if (!resolvedPack && localPack && localPack.pack_date === todayStr) {
      resolvedPack = localPack;
    }

    if (resolvedPack) {
      writeLocalDailyPack(resolvedPack, userId);
    }

    return {
      words: cloudWords,
      studyLogs: cloudLogs,
      xp: resolvedXp,
      dailyQuota: resolvedQuota,
      ringTargets: resolvedRings,
      dailyPack: resolvedPack,
      syncMode: cloudReachable ? "supabase" : "local",
      cloudReachable,
    };
  }

  return {
    words: readLocalWords(todayStr, userId, true),
    studyLogs: readLocalLogs(userId),
    xp: localXp,
    dailyQuota: localQuota,
    ringTargets: localRings,
    dailyPack: localPack,
    syncMode: "local",
    cloudReachable: false,
  };
}

export async function saveCloudUserSettings(
  userId: string,
  settings: {
    dailyQuota?: DailyQuotaSettings;
    ringTargets?: DailyRingTargets;
    xp?: number;
  }
): Promise<boolean> {
  const nextQuota = settings.dailyQuota
    ? writeLocalDailyQuota(userId, settings.dailyQuota)
    : readLocalDailyQuota(userId);
  const nextRings = settings.ringTargets
    ? writeCustomRingTargets(settings.ringTargets)
    : readCustomRingTargets();
  const nextXp =
    typeof settings.xp === "number"
      ? Math.max(0, Math.round(settings.xp))
      : readLocalXp(userId);
  if (typeof settings.xp === "number") {
    writeLocalXp(userId, nextXp);
  }

  const supabase = getScopedSupabase(userId);
  if (!supabase) return false;

  const nowIso = new Date().toISOString();
  const rankInfo = getMasteryRankInfo(nextXp);
  let synced = false;

  try {
    const { error } = await supabase.from("user_profiles").upsert(
      {
        user_id: userId,
        xp: nextXp,
        mastery_rank: rankInfo.rank,
        daily_words_quota: nextQuota.wordsPerDay,
        daily_idioms_quota: nextQuota.idiomsPerDay,
        auto_show_daily_pack: nextQuota.autoShowPopup,
        ring_targets_json: nextRings,
        updated_at: nowIso,
      },
      { onConflict: "user_id" }
    );
    if (!error) {
      synced = true;
    }
  } catch {
    // Fallback to auth metadata below
  }

  // Always mirror compact cloud settings & XP to Supabase Auth user_metadata so
  // settings & XP sync across devices even before SQL migration is applied.
  await mirrorCloudMetadataToAuth(userId, {
    xp: nextXp,
    dailyQuota: nextQuota,
    ringTargets: nextRings,
  });

  return synced || true;
}

export function readLocalDailyPack(
  dateStr: string,
  userId: string
): DailyPackRecord | null {
  if (typeof window === "undefined") return null;
  const parsed = safeParseJson<DailyPackRecord>(
    window.localStorage.getItem(dailyPackKey(userId, dateStr))
  );
  if (!parsed || parsed.pack_date !== dateStr || !Array.isArray(parsed.items)) {
    return null;
  }
  return parsed;
}

export function writeLocalDailyPack(
  pack: DailyPackRecord,
  userId: string
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      dailyPackKey(userId, pack.pack_date),
      JSON.stringify(pack)
    );
  } catch {
    // Ignore storage quota errors
  }
}

export async function saveDailyPack(
  pack: DailyPackRecord,
  userId: string
): Promise<DailyPackRecord> {
  writeLocalDailyPack(pack, userId);

  const supabase = getScopedSupabase(userId);
  if (!supabase) return pack;

  const nowIso = new Date().toISOString();
  let tableSaved = false;
  try {
    const { error } = await supabase.from("daily_packs").upsert(
      {
        user_id: userId,
        pack_date: pack.pack_date,
        words_quota: pack.words_quota,
        idioms_quota: pack.idioms_quota,
        items_json: pack.items,
        completed_terms: pack.completed_terms,
        completed_at: pack.completed_at ?? null,
        updated_at: nowIso,
      },
      { onConflict: "user_id,pack_date" }
    );
    if (!error) {
      tableSaved = true;
    }
  } catch {
    // Fall back to auth user_metadata mirror below
  }

  if (!tableSaved) {
    await mirrorCloudMetadataToAuth(userId, { dailyPack: pack });
  }

  return pack;
}

export async function seedStarterWordsForSupabaseUser(
  todayStr: string,
  userId: string
): Promise<void> {
  const supabase = getScopedSupabase(userId);
  if (!supabase) return;
  try {
    const { count, error } = await supabase
      .from("words")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error || (count ?? 0) > 0) return;

    const starters = buildInitialMockWords(todayStr);
    for (const starter of starters) {
      await saveWordEntry(starter, userId);
    }
  } catch (err) {
    console.error("[LexiVault] Starter seed skipped:", err);
  }
}

export async function saveWordEntry(
  word: WordEntry,
  userId: string
): Promise<WordEntry> {
  cacheWordPronunciation(word.term, word.pronunciation, word.ipa);
  cacheWordMeanings(word.term, word.meaning_en, word.meaning_id, word.cefr);

  const canonicalSource = normalizeSourceTag(word.source_tag);
  const supabase = getScopedSupabase(userId);
  if (supabase) {
    try {
      const basePayload = {
        user_id: userId,
        term: word.term,
        type: word.type,
        meaning_id: word.meaning_id,
        examples_json: word.examples_json,
        synonyms: word.synonyms,
        antonyms: word.antonyms,
        word_families_json: word.word_families_json,
        register: word.register,
        source_tag: canonicalSource,
        audio_us_url: word.audio_us_url ?? null,
        audio_uk_url: word.audio_uk_url ?? null,
        correct_count: word.correct_count,
        wrong_count: word.wrong_count,
        next_review_at: word.next_review_at ?? word.created_at,
        interval_days: word.interval_days ?? 0,
        ease_factor: word.ease_factor ?? 2.5,
        repetitions: word.repetitions ?? 0,
        created_at: word.created_at,
      };

      const fullPayload = {
        ...basePayload,
        pronunciation: word.pronunciation ?? null,
        ipa: word.ipa ?? null,
        meaning_en: word.meaning_en ?? null,
        cefr: word.cefr ?? null,
        last_reviewed_date: word.last_reviewed_date ?? null,
        review_count: word.review_count ?? 0,
      };

      let { data, error } = await supabase
        .from("words")
        .insert(fullPayload)
        .select("*")
        .single();

      // Retry without newly migrated columns (cefr / last_reviewed_date / review_count)
      if (error) {
        const midRetry = await supabase
          .from("words")
          .insert({
            ...basePayload,
            pronunciation: word.pronunciation ?? null,
            ipa: word.ipa ?? null,
            meaning_en: word.meaning_en ?? null,
          })
          .select("*")
          .single();
        data = midRetry.data;
        error = midRetry.error;
      }

      // Retry without meaning_en/pronunciation/ipa
      if (error) {
        const retry = await supabase
          .from("words")
          .insert(basePayload)
          .select("*")
          .single();
        data = retry.data;
        error = retry.error;
      }

      // Minimal v1 schema retry (without SM-2 columns)
      if (error) {
        const minimalPayload = {
          user_id: userId,
          term: word.term,
          type: word.type,
          meaning_id: word.meaning_id,
          examples_json: word.examples_json,
          synonyms: word.synonyms,
          antonyms: word.antonyms,
          word_families_json: word.word_families_json,
          register: word.register,
          source_tag: canonicalSource,
          correct_count: word.correct_count,
          wrong_count: word.wrong_count,
          created_at: word.created_at,
        };
        const minRetry = await supabase
          .from("words")
          .insert(minimalPayload)
          .select("*")
          .single();
        data = minRetry.data;
        error = minRetry.error;
      }

      if (!error && data) {
        const hydrated = hydrateWordMetadata(
          {
            ...(data as WordEntry),
            pronunciation: (data as WordEntry).pronunciation || word.pronunciation,
            ipa: (data as WordEntry).ipa || word.ipa,
            meaning_en: (data as WordEntry).meaning_en || word.meaning_en,
            cefr: (data as WordEntry).cefr || word.cefr,
            last_reviewed_date:
              (data as WordEntry).last_reviewed_date ??
              word.last_reviewed_date ??
              null,
            review_count:
              (data as WordEntry).review_count ?? word.review_count ?? 0,
          },
          userId
        );
        writeReviewMeta(userId, hydrated);
        const cached = readLocalWords(
          hydrated.created_at.slice(0, 10),
          userId,
          false
        );
        writeLocalWords(
          [hydrated, ...cached.filter((item) => item.id !== hydrated.id)],
          userId
        );
        return hydrated;
      }

      if (error) {
        console.error("[LexiVault] Supabase saveWordEntry error:", error.message);
      }
    } catch (err) {
      console.error("[LexiVault] Supabase saveWordEntry exception:", err);
    }
  }

  const scopedWord: WordEntry = hydrateWordMetadata(
    {
      ...word,
      source_tag: canonicalSource,
      user_id: userId,
    },
    userId
  );
  writeReviewMeta(userId, scopedWord);
  const current = readLocalWords(
    scopedWord.created_at.slice(0, 10),
    userId,
    isLocalOnlyUserId(userId)
  );
  const updated = [
    scopedWord,
    ...current.filter((item) => item.id !== scopedWord.id),
  ];
  writeLocalWords(updated, userId);
  return scopedWord;
}

export async function updateWordEntry(
  word: WordEntry,
  userId: string
): Promise<WordEntry> {
  cacheWordPronunciation(word.term, word.pronunciation, word.ipa);
  cacheWordMeanings(word.term, word.meaning_en, word.meaning_id, word.cefr);

  const supabase = getScopedSupabase(userId);
  if (supabase && isValidUuid(word.id)) {
    try {
      const basePatch = {
        term: word.term,
        type: word.type,
        meaning_id: word.meaning_id,
        examples_json: word.examples_json,
        synonyms: word.synonyms,
        antonyms: word.antonyms,
        word_families_json: word.word_families_json,
        register: word.register,
      };
      let { data, error } = await supabase
        .from("words")
        .update({
          ...basePatch,
          pronunciation: word.pronunciation ?? null,
          ipa: word.ipa ?? null,
          meaning_en: word.meaning_en ?? null,
          cefr: word.cefr ?? null,
        })
        .eq("id", word.id)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) {
        const midRetry = await supabase
          .from("words")
          .update({
            ...basePatch,
            pronunciation: word.pronunciation ?? null,
            ipa: word.ipa ?? null,
          })
          .eq("id", word.id)
          .eq("user_id", userId)
          .select("*")
          .single();
        data = midRetry.data;
        error = midRetry.error;
      }

      if (error) {
        const retry = await supabase
          .from("words")
          .update(basePatch)
          .eq("id", word.id)
          .eq("user_id", userId)
          .select("*")
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (!error && data) {
        const hydrated = hydrateWordMetadata(
          {
            ...(data as WordEntry),
            pronunciation: (data as WordEntry).pronunciation || word.pronunciation,
            ipa: (data as WordEntry).ipa || word.ipa,
            meaning_en: (data as WordEntry).meaning_en || word.meaning_en,
            cefr: (data as WordEntry).cefr || word.cefr,
          },
          userId
        );
        const current = readLocalWords(
          hydrated.created_at.slice(0, 10),
          userId,
          false
        );
        writeLocalWords(
          current.map((w) => (w.id === hydrated.id ? hydrated : w)),
          userId
        );
        return hydrated;
      }
    } catch (err) {
      console.error("[LexiVault] Supabase updateWordEntry exception:", err);
    }
  }

  const scoped: WordEntry = hydrateWordMetadata(
    {
      ...word,
      user_id: userId,
    },
    userId
  );
  const current = readLocalWords(
    scoped.created_at.slice(0, 10),
    userId,
    isLocalOnlyUserId(userId)
  );
  const updated = current.map((w) => (w.id === scoped.id ? scoped : w));
  writeLocalWords(updated, userId);
  return scoped;
}

export async function deleteWordEntry(
  id: string,
  userId: string
): Promise<void> {
  const supabase = getScopedSupabase(userId);
  if (supabase && isValidUuid(id)) {
    try {
      await supabase.from("words").delete().eq("id", id).eq("user_id", userId);
    } catch (err) {
      console.error("[LexiVault] Supabase deleteWordEntry error:", err);
    }
  }

  if (typeof window !== "undefined") {
    const parsed =
      safeParseJson<WordEntry[]>(window.localStorage.getItem(wordsKey(userId))) ??
      [];
    writeLocalWords(
      parsed.filter((w) => w.id !== id),
      userId
    );
  }
}

export async function updateWordAudioUrls(
  id: string,
  patch: { audio_us_url?: string | null; audio_uk_url?: string | null },
  userId: string
): Promise<void> {
  const supabase = getScopedSupabase(userId);
  if (supabase && isValidUuid(id)) {
    try {
      await supabase
        .from("words")
        .update(patch)
        .eq("id", id)
        .eq("user_id", userId);
    } catch {
      // Fallback below
    }
  }

  if (typeof window !== "undefined") {
    const parsed =
      safeParseJson<WordEntry[]>(window.localStorage.getItem(wordsKey(userId))) ??
      [];
    const updated = parsed.map((w) => (w.id === id ? { ...w, ...patch } : w));
    writeLocalWords(updated, userId);
  }
}

export async function loadUserXp(userId: string): Promise<number> {
  const localVal = readLocalXp(userId);
  const supabase = getScopedSupabase(userId);
  if (!supabase) return localVal;

  try {
    const [profileRes, ieltsRes, authRes] = await Promise.allSettled([
      supabase
        .from("user_profiles")
        .select("xp")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("ielts_profiles")
        .select("xp")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.auth.getUser(),
    ]);

    const pXp =
      profileRes.status === "fulfilled" && !profileRes.value.error
        ? Number((profileRes.value.data as { xp?: number } | null)?.xp ?? 0) || 0
        : 0;
    const iXp =
      ieltsRes.status === "fulfilled" && !ieltsRes.value.error
        ? Number((ieltsRes.value.data as { xp?: number } | null)?.xp ?? 0) || 0
        : 0;
    const authCloud =
      authRes.status === "fulfilled"
        ? ((authRes.value.data.user?.user_metadata?.lexivault_cloud ??
            {}) as CloudMetadataEnvelope)
        : {};
    const mXp = Number(authCloud.xp ?? 0) || 0;

    const merged = Math.max(localVal, pXp, iXp, mXp);
    writeLocalXp(userId, merged);
    return merged;
  } catch {
    return localVal;
  }
}

export async function addUserXp(
  userId: string,
  xpDelta: number
): Promise<number> {
  const current = readLocalXp(userId);
  const nextXp = Math.max(0, current + Math.round(xpDelta));
  writeLocalXp(userId, nextXp);

  const supabase = getScopedSupabase(userId);
  if (supabase) {
    const nowIso = new Date().toISOString();
    const rankInfo = getMasteryRankInfo(nextXp);
    const quota = readLocalDailyQuota(userId);
    const rings = readCustomRingTargets();

    await Promise.allSettled([
      supabase.from("user_profiles").upsert(
        {
          user_id: userId,
          xp: nextXp,
          mastery_rank: rankInfo.rank,
          daily_words_quota: quota.wordsPerDay,
          daily_idioms_quota: quota.idiomsPerDay,
          auto_show_daily_pack: quota.autoShowPopup,
          ring_targets_json: rings,
          updated_at: nowIso,
        },
        { onConflict: "user_id" }
      ),
      supabase.from("ielts_profiles").upsert(
        {
          user_id: userId,
          xp: nextXp,
          mastery_rank: rankInfo.rank,
          updated_at: nowIso,
        },
        { onConflict: "user_id" }
      ),
      mirrorCloudMetadataToAuth(userId, { xp: nextXp }),
    ]);
  }

  return nextXp;
}

export async function recordPracticeAttempt(
  word: WordEntry,
  isCorrect: boolean,
  todayStr: string,
  userId: string
): Promise<{
  updatedWord: WordEntry;
  updatedLog: StudyLog;
  newXp: number;
}> {
  const nowIso = new Date().toISOString();
  const xpDelta = isCorrect ? 15 : 5;
  const nextReviewCount = getEffectiveReviewCount(word) + 1;
  const updatedWord: WordEntry = {
    ...word,
    user_id: userId,
    correct_count: word.correct_count + (isCorrect ? 1 : 0),
    wrong_count: word.wrong_count + (isCorrect ? 0 : 1),
    last_practiced_at: nowIso,
    review_count: nextReviewCount,
    last_reviewed_date: isCorrect ? todayStr : word.last_reviewed_date ?? null,
  };
  writeReviewMeta(userId, updatedWord);

  const localWords = readLocalWords(
    todayStr,
    userId,
    isLocalOnlyUserId(userId)
  ).map((w) => (w.id === word.id ? updatedWord : w));
  writeLocalWords(localWords, userId);

  const supabase = getScopedSupabase(userId);
  if (supabase) {
    try {
      if (isValidUuid(word.id)) {
        const { error: wErr } = await supabase
          .from("words")
          .update({
            correct_count: updatedWord.correct_count,
            wrong_count: updatedWord.wrong_count,
            last_practiced_at: nowIso,
            review_count: nextReviewCount,
            last_reviewed_date: updatedWord.last_reviewed_date,
          })
          .eq("id", word.id)
          .eq("user_id", userId);

        if (wErr) {
          await supabase
            .from("words")
            .update({
              correct_count: updatedWord.correct_count,
              wrong_count: updatedWord.wrong_count,
              last_practiced_at: nowIso,
            })
            .eq("id", word.id)
            .eq("user_id", userId);
        }
      }

      const { data: existingLog } = await supabase
        .from("study_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("study_date", todayStr)
        .maybeSingle();

      const localExisting = readLocalLogs(userId).find(
        (l) => l.study_date === todayStr
      );
      const baseLog = existingLog ?? localExisting;

      const nextLogPayload = {
        user_id: userId,
        study_date: todayStr,
        reviews_count: (baseLog?.reviews_count ?? 0) + 1,
        correct_count: (baseLog?.correct_count ?? 0) + (isCorrect ? 1 : 0),
        wrong_count: (baseLog?.wrong_count ?? 0) + (isCorrect ? 0 : 1),
        words_added: baseLog?.words_added ?? 0,
        vocab_today: baseLog?.vocab_today ?? baseLog?.words_added ?? 0,
        recall_today: (baseLog?.recall_today ?? baseLog?.reviews_count ?? 0) + 1,
        ielts_today: baseLog?.ielts_today ?? 0,
        xp_earned: (baseLog?.xp_earned ?? 0) + xpDelta,
        updated_at: nowIso,
      };

      const savedLog = await upsertStudyLogCloud(userId, nextLogPayload);
      const newXp = await addUserXp(userId, xpDelta);

      if (savedLog) {
        const logs = readLocalLogs(userId);
        writeLocalLogs(
          [savedLog, ...logs.filter((l) => l.study_date !== todayStr)],
          userId
        );
        return { updatedWord, updatedLog: savedLog, newXp };
      }
    } catch (err) {
      console.error("[LexiVault] recordPracticeAttempt cloud error:", err);
    }
  }

  const logs = readLocalLogs(userId);
  const existing = logs.find((l) => l.study_date === todayStr);
  const updatedLog: StudyLog = existing
    ? {
        ...existing,
        user_id: userId,
        reviews_count: existing.reviews_count + 1,
        correct_count: existing.correct_count + (isCorrect ? 1 : 0),
        wrong_count: existing.wrong_count + (isCorrect ? 0 : 1),
        vocab_today: existing.vocab_today ?? existing.words_added ?? 0,
        recall_today:
          (existing.recall_today ?? existing.reviews_count ?? 0) + 1,
        ielts_today: existing.ielts_today ?? 0,
        xp_earned: (existing.xp_earned ?? 0) + xpDelta,
        updated_at: nowIso,
      }
    : {
        id: `local-log-${userId}-${todayStr}`,
        user_id: userId,
        study_date: todayStr,
        reviews_count: 1,
        correct_count: isCorrect ? 1 : 0,
        wrong_count: isCorrect ? 0 : 1,
        words_added: 0,
        vocab_today: 0,
        recall_today: 1,
        ielts_today: 0,
        xp_earned: xpDelta,
        updated_at: nowIso,
      };

  writeLocalLogs(
    [updatedLog, ...logs.filter((l) => l.study_date !== todayStr)],
    userId
  );
  const newXp = await addUserXp(userId, xpDelta);

  return { updatedWord, updatedLog, newXp };
}

export async function recordSm2ReviewAttempt(
  word: WordEntry,
  rating: Sm2Rating,
  todayStr: string,
  userId: string
): Promise<{
  updatedWord: WordEntry;
  updatedLog: StudyLog;
  newXp: number;
}> {
  const now = new Date();
  const nowIso = now.toISOString();
  const isCorrect = rating !== "again";
  const sm2 = calculateSm2Next(word, rating, now);
  const xpDelta =
    rating === "easy" ? 20 : rating === "good" ? 15 : rating === "hard" ? 10 : 5;
  const nextReviewCount = getEffectiveReviewCount(word) + 1;

  // Strict same-day non-repetition rule:
  // Mark last_reviewed_date = todayStr ONLY when passed (Hard/Good/Easy).
  // Clicking "Again" keeps it eligible inside the current session until recalled.
  const nextLastReviewedDate = isCorrect
    ? todayStr
    : word.last_reviewed_date === todayStr
      ? null
      : (word.last_reviewed_date ?? null);

  const updatedWord: WordEntry = {
    ...word,
    user_id: userId,
    correct_count: word.correct_count + (isCorrect ? 1 : 0),
    wrong_count: word.wrong_count + (isCorrect ? 0 : 1),
    last_practiced_at: nowIso,
    last_reviewed_date: nextLastReviewedDate,
    review_count: nextReviewCount,
    next_review_at: sm2.next_review_at,
    interval_days: sm2.interval_days,
    ease_factor: sm2.ease_factor,
    repetitions: sm2.repetitions,
  };
  writeReviewMeta(userId, updatedWord);

  const localWords = readLocalWords(
    todayStr,
    userId,
    isLocalOnlyUserId(userId)
  ).map((w) => (w.id === word.id ? updatedWord : w));
  writeLocalWords(localWords, userId);

  const supabase = getScopedSupabase(userId);
  if (supabase) {
    try {
      if (isValidUuid(word.id)) {
        const { error: fullErr } = await supabase
          .from("words")
          .update({
            correct_count: updatedWord.correct_count,
            wrong_count: updatedWord.wrong_count,
            last_practiced_at: nowIso,
            last_reviewed_date: nextLastReviewedDate,
            review_count: nextReviewCount,
            next_review_at: sm2.next_review_at,
            interval_days: sm2.interval_days,
            ease_factor: sm2.ease_factor,
            repetitions: sm2.repetitions,
          })
          .eq("id", word.id)
          .eq("user_id", userId);

        if (fullErr) {
          const { error: sm2Err } = await supabase
            .from("words")
            .update({
              correct_count: updatedWord.correct_count,
              wrong_count: updatedWord.wrong_count,
              last_practiced_at: nowIso,
              next_review_at: sm2.next_review_at,
              interval_days: sm2.interval_days,
              ease_factor: sm2.ease_factor,
              repetitions: sm2.repetitions,
            })
            .eq("id", word.id)
            .eq("user_id", userId);

          if (sm2Err) {
            await supabase
              .from("words")
              .update({
                correct_count: updatedWord.correct_count,
                wrong_count: updatedWord.wrong_count,
                last_practiced_at: nowIso,
              })
              .eq("id", word.id)
              .eq("user_id", userId);
          }
        }
      }

      const { data: existingLog } = await supabase
        .from("study_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("study_date", todayStr)
        .maybeSingle();

      const localExisting = readLocalLogs(userId).find(
        (l) => l.study_date === todayStr
      );
      const baseLog = existingLog ?? localExisting;

      const nextLogPayload = {
        user_id: userId,
        study_date: todayStr,
        reviews_count: (baseLog?.reviews_count ?? 0) + 1,
        correct_count: (baseLog?.correct_count ?? 0) + (isCorrect ? 1 : 0),
        wrong_count: (baseLog?.wrong_count ?? 0) + (isCorrect ? 0 : 1),
        words_added: baseLog?.words_added ?? 0,
        vocab_today: baseLog?.vocab_today ?? baseLog?.words_added ?? 0,
        recall_today: (baseLog?.recall_today ?? baseLog?.reviews_count ?? 0) + 1,
        ielts_today: baseLog?.ielts_today ?? 0,
        xp_earned: (baseLog?.xp_earned ?? 0) + xpDelta,
        updated_at: nowIso,
      };

      const savedLog = await upsertStudyLogCloud(userId, nextLogPayload);
      const newXp = await addUserXp(userId, xpDelta);

      if (savedLog) {
        const logs = readLocalLogs(userId);
        writeLocalLogs(
          [savedLog, ...logs.filter((l) => l.study_date !== todayStr)],
          userId
        );
        return { updatedWord, updatedLog: savedLog, newXp };
      }
    } catch (err) {
      console.error("[LexiVault] recordSm2ReviewAttempt cloud error:", err);
    }
  }

  const logs = readLocalLogs(userId);
  const existing = logs.find((l) => l.study_date === todayStr);
  const updatedLog: StudyLog = existing
    ? {
        ...existing,
        user_id: userId,
        reviews_count: existing.reviews_count + 1,
        correct_count: existing.correct_count + (isCorrect ? 1 : 0),
        wrong_count: existing.wrong_count + (isCorrect ? 0 : 1),
        vocab_today: existing.vocab_today ?? existing.words_added ?? 0,
        recall_today:
          (existing.recall_today ?? existing.reviews_count ?? 0) + 1,
        ielts_today: existing.ielts_today ?? 0,
        xp_earned: (existing.xp_earned ?? 0) + xpDelta,
        updated_at: nowIso,
      }
    : {
        id: `local-log-${userId}-${todayStr}`,
        user_id: userId,
        study_date: todayStr,
        reviews_count: 1,
        correct_count: isCorrect ? 1 : 0,
        wrong_count: isCorrect ? 0 : 1,
        words_added: 0,
        vocab_today: 0,
        recall_today: 1,
        ielts_today: 0,
        xp_earned: xpDelta,
        updated_at: nowIso,
      };

  writeLocalLogs(
    [updatedLog, ...logs.filter((l) => l.study_date !== todayStr)],
    userId
  );
  const newXp = await addUserXp(userId, xpDelta);

  return { updatedWord, updatedLog, newXp };
}

export async function incrementWordsAddedLog(
  todayStr: string,
  userId: string,
  count = 1,
  alsoRecordRecall = false
): Promise<{ updatedLog: StudyLog; newXp: number }> {
  const nowIso = new Date().toISOString();
  const safeCount = Math.max(1, count);
  const xpDelta = (alsoRecordRecall ? 20 : 15) * safeCount;
  const supabase = getScopedSupabase(userId);

  if (supabase) {
    try {
      const { data: existing } = await supabase
        .from("study_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("study_date", todayStr)
        .maybeSingle();

      const localExisting = readLocalLogs(userId).find(
        (l) => l.study_date === todayStr
      );
      const base = existing ?? localExisting;

      const payload = {
        user_id: userId,
        study_date: todayStr,
        reviews_count:
          (base?.reviews_count ?? 0) + (alsoRecordRecall ? safeCount : 0),
        correct_count:
          (base?.correct_count ?? 0) + (alsoRecordRecall ? safeCount : 0),
        wrong_count: base?.wrong_count ?? 0,
        words_added: (base?.words_added ?? 0) + safeCount,
        vocab_today: (base?.vocab_today ?? base?.words_added ?? 0) + safeCount,
        recall_today:
          (base?.recall_today ?? base?.reviews_count ?? 0) +
          (alsoRecordRecall ? safeCount : 0),
        ielts_today: base?.ielts_today ?? 0,
        xp_earned: (base?.xp_earned ?? 0) + xpDelta,
        updated_at: nowIso,
      };

      const saved = await upsertStudyLogCloud(userId, payload);
      const newXp = await addUserXp(userId, xpDelta);
      if (saved) {
        const logs = readLocalLogs(userId);
        writeLocalLogs(
          [saved, ...logs.filter((l) => l.study_date !== todayStr)],
          userId
        );
        return { updatedLog: saved, newXp };
      }
    } catch (err) {
      console.error("[LexiVault] incrementWordsAddedLog cloud error:", err);
    }
  }

  const logs = readLocalLogs(userId);
  const existing = logs.find((l) => l.study_date === todayStr);
  const updatedLog: StudyLog = existing
    ? {
        ...existing,
        user_id: userId,
        reviews_count:
          existing.reviews_count + (alsoRecordRecall ? safeCount : 0),
        correct_count:
          existing.correct_count + (alsoRecordRecall ? safeCount : 0),
        words_added: existing.words_added + safeCount,
        vocab_today:
          (existing.vocab_today ?? existing.words_added ?? 0) + safeCount,
        recall_today:
          (existing.recall_today ?? existing.reviews_count ?? 0) +
          (alsoRecordRecall ? safeCount : 0),
        ielts_today: existing.ielts_today ?? 0,
        xp_earned: (existing.xp_earned ?? 0) + xpDelta,
        updated_at: nowIso,
      }
    : {
        id: `local-log-${userId}-${todayStr}`,
        user_id: userId,
        study_date: todayStr,
        reviews_count: alsoRecordRecall ? safeCount : 0,
        correct_count: alsoRecordRecall ? safeCount : 0,
        wrong_count: 0,
        words_added: safeCount,
        vocab_today: safeCount,
        recall_today: alsoRecordRecall ? safeCount : 0,
        ielts_today: 0,
        xp_earned: xpDelta,
        updated_at: nowIso,
      };

  writeLocalLogs(
    [updatedLog, ...logs.filter((l) => l.study_date !== todayStr)],
    userId
  );
  const newXp = await addUserXp(userId, xpDelta);
  return { updatedLog, newXp };
}

export async function recordWrongQuizLogOnly(
  todayStr: string,
  userId: string
): Promise<StudyLog> {
  const nowIso = new Date().toISOString();
  const supabase = getScopedSupabase(userId);

  if (supabase) {
    try {
      const { data: existing } = await supabase
        .from("study_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("study_date", todayStr)
        .maybeSingle();

      const localExisting = readLocalLogs(userId).find(
        (l) => l.study_date === todayStr
      );
      const base = existing ?? localExisting;

      const payload = {
        user_id: userId,
        study_date: todayStr,
        reviews_count: (base?.reviews_count ?? 0) + 1,
        correct_count: base?.correct_count ?? 0,
        wrong_count: (base?.wrong_count ?? 0) + 1,
        words_added: base?.words_added ?? 0,
        vocab_today: base?.vocab_today ?? base?.words_added ?? 0,
        recall_today: (base?.recall_today ?? base?.reviews_count ?? 0) + 1,
        ielts_today: base?.ielts_today ?? 0,
        xp_earned: base?.xp_earned ?? 0,
        updated_at: nowIso,
      };

      const saved = await upsertStudyLogCloud(userId, payload);
      if (saved) {
        const logs = readLocalLogs(userId);
        writeLocalLogs(
          [saved, ...logs.filter((l) => l.study_date !== todayStr)],
          userId
        );
        return saved;
      }
    } catch {
      // Fallback below
    }
  }

  const logs = readLocalLogs(userId);
  const existing = logs.find((l) => l.study_date === todayStr);
  const updatedLog: StudyLog = existing
    ? {
        ...existing,
        user_id: userId,
        reviews_count: existing.reviews_count + 1,
        wrong_count: existing.wrong_count + 1,
        recall_today: (existing.recall_today ?? existing.reviews_count ?? 0) + 1,
        updated_at: nowIso,
      }
    : {
        id: `local-log-${userId}-${todayStr}`,
        user_id: userId,
        study_date: todayStr,
        reviews_count: 1,
        correct_count: 0,
        wrong_count: 1,
        words_added: 0,
        vocab_today: 0,
        recall_today: 1,
        ielts_today: 0,
        xp_earned: 0,
        updated_at: nowIso,
      };

  writeLocalLogs(
    [updatedLog, ...logs.filter((l) => l.study_date !== todayStr)],
    userId
  );
  return updatedLog;
}

export async function recordIeltsStudyLog(
  todayStr: string,
  userId: string,
  reviewUnits: number,
  correctUnits: number,
  ieltsSessions = 1,
  xpDelta = 60
): Promise<StudyLog> {
  const nowIso = new Date().toISOString();
  const safeReviews = Math.max(1, reviewUnits);
  const safeCorrect = Math.max(0, Math.min(safeReviews, correctUnits));
  const safeWrong = Math.max(0, safeReviews - safeCorrect);

  const supabase = getScopedSupabase(userId);
  if (supabase) {
    try {
      const { data: existing } = await supabase
        .from("study_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("study_date", todayStr)
        .maybeSingle();

      const localExisting = readLocalLogs(userId).find(
        (l) => l.study_date === todayStr
      );
      const base = existing ?? localExisting;

      const payload = {
        user_id: userId,
        study_date: todayStr,
        reviews_count: (base?.reviews_count ?? 0) + safeReviews,
        correct_count: (base?.correct_count ?? 0) + safeCorrect,
        wrong_count: (base?.wrong_count ?? 0) + safeWrong,
        words_added: base?.words_added ?? 0,
        vocab_today: base?.vocab_today ?? base?.words_added ?? 0,
        recall_today: base?.recall_today ?? base?.reviews_count ?? 0,
        ielts_today: (base?.ielts_today ?? 0) + ieltsSessions,
        xp_earned: (base?.xp_earned ?? 0) + xpDelta,
        updated_at: nowIso,
      };

      const saved = await upsertStudyLogCloud(userId, payload);
      if (saved) {
        const logs = readLocalLogs(userId);
        writeLocalLogs(
          [saved, ...logs.filter((l) => l.study_date !== todayStr)],
          userId
        );
        return saved;
      }
    } catch {
      // Fallback below
    }
  }

  const logs = readLocalLogs(userId);
  const existing = logs.find((l) => l.study_date === todayStr);
  const updatedLog: StudyLog = existing
    ? {
        ...existing,
        user_id: userId,
        reviews_count: existing.reviews_count + safeReviews,
        correct_count: existing.correct_count + safeCorrect,
        wrong_count: existing.wrong_count + safeWrong,
        vocab_today: existing.vocab_today ?? existing.words_added ?? 0,
        recall_today: existing.recall_today ?? existing.reviews_count ?? 0,
        ielts_today: (existing.ielts_today ?? 0) + ieltsSessions,
        xp_earned: (existing.xp_earned ?? 0) + xpDelta,
        updated_at: nowIso,
      }
    : {
        id: `local-log-${userId}-${todayStr}`,
        user_id: userId,
        study_date: todayStr,
        reviews_count: safeReviews,
        correct_count: safeCorrect,
        wrong_count: safeWrong,
        words_added: 0,
        vocab_today: 0,
        recall_today: 0,
        ielts_today: ieltsSessions,
        xp_earned: xpDelta,
        updated_at: nowIso,
      };

  writeLocalLogs(
    [updatedLog, ...logs.filter((l) => l.study_date !== todayStr)],
    userId
  );
  return updatedLog;
}

export function readLocalDiscoveryCache(
  dateStr: string,
  userId: string
): DailyDiscoveryPack | null {
  if (typeof window === "undefined") return null;
  const map = safeParseJson<Record<string, DailyDiscoveryPack>>(
    window.localStorage.getItem(discoverKey(userId))
  );
  return map?.[dateStr] ?? null;
}

export function writeLocalDiscoveryCache(
  pack: DailyDiscoveryPack,
  userId: string
): void {
  if (typeof window === "undefined") return;
  const map =
    safeParseJson<Record<string, DailyDiscoveryPack>>(
      window.localStorage.getItem(discoverKey(userId))
    ) ?? {};
  map[pack.discovery_date] = pack;
  window.localStorage.setItem(discoverKey(userId), JSON.stringify(map));
}

export async function loadDailyDiscovery(
  dateStr: string,
  userId: string
): Promise<DailyDiscoveryPack | null> {
  const supabase = getScopedSupabase(userId);
  if (supabase) {
    try {
      const { data } = await supabase
        .from("daily_discoveries")
        .select("*")
        .eq("user_id", userId)
        .eq("discovery_date", dateStr)
        .maybeSingle();

      if (data && Array.isArray(data.items_json) && data.items_json.length > 0) {
        return {
          discovery_date: dateStr,
          items: (data.items_json as DiscoveryItem[]).map(
            hydrateDiscoveryMetadata
          ),
          source: "supabase",
        };
      }
    } catch {
      // Fallback below
    }
  }

  const cached = readLocalDiscoveryCache(dateStr, userId);
  if (!cached) return null;
  return {
    ...cached,
    items: cached.items.map(hydrateDiscoveryMetadata),
  };
}

export async function saveDailyDiscovery(
  pack: DailyDiscoveryPack,
  userId: string
): Promise<void> {
  writeLocalDiscoveryCache(pack, userId);
  const supabase = getScopedSupabase(userId);
  if (supabase) {
    try {
      await supabase.from("daily_discoveries").upsert(
        {
          user_id: userId,
          discovery_date: pack.discovery_date,
          items_json: pack.items,
        },
        { onConflict: "user_id,discovery_date" }
      );
    } catch {
      // Local cache already written
    }
  }
}

export function subscribeRealtimeSync(
  todayStr: string,
  userId: string,
  callbacks: {
    onWordsRefresh: (words: WordEntry[]) => void;
    onLogsRefresh: (logs: StudyLog[]) => void;
    onProfileRefresh?: (profile: {
      xp?: number;
      dailyQuota?: DailyQuotaSettings;
      ringTargets?: DailyRingTargets;
    }) => void;
    onDailyPackRefresh?: (pack: DailyPackRecord) => void;
  }
): () => void {
  const supabase = getScopedSupabase(userId);
  if (supabase) {
    const channel = supabase
      .channel(`lexivault-realtime-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "words",
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          const { data } = await supabase
            .from("words")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
          if (data) {
            const hydrated = (data as WordEntry[]).map((w) =>
              hydrateWordMetadata(w, userId)
            );
            writeLocalWords(hydrated, userId);
            callbacks.onWordsRefresh(hydrated);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "study_logs",
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          const { data } = await supabase
            .from("study_logs")
            .select("*")
            .eq("user_id", userId)
            .order("study_date", { ascending: false });
          if (data) {
            const normalized = (data as StudyLog[]).map((l) => ({
              ...l,
              vocab_today: l.vocab_today ?? l.words_added ?? 0,
              recall_today: l.recall_today ?? l.reviews_count ?? 0,
              ielts_today: l.ielts_today ?? 0,
              xp_earned: l.xp_earned ?? 0,
            }));
            writeLocalLogs(normalized, userId);
            callbacks.onLogsRefresh(normalized);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_profiles",
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          const { data } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
          if (data && callbacks.onProfileRefresh) {
            const row = data as {
              xp?: number;
              daily_words_quota?: number;
              daily_idioms_quota?: number;
              auto_show_daily_pack?: boolean;
              ring_targets_json?: Partial<DailyRingTargets>;
            };
            callbacks.onProfileRefresh({
              xp: typeof row.xp === "number" ? row.xp : undefined,
              dailyQuota: normalizeDailyQuota({
                wordsPerDay: row.daily_words_quota,
                idiomsPerDay: row.daily_idioms_quota,
                autoShowPopup: row.auto_show_daily_pack,
              }),
              ringTargets: row.ring_targets_json
                ? normalizeRingTargets(row.ring_targets_json)
                : DAILY_RING_TARGETS,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_packs",
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          const { data } = await supabase
            .from("daily_packs")
            .select("*")
            .eq("user_id", userId)
            .eq("pack_date", todayStr)
            .maybeSingle();
          if (data && callbacks.onDailyPackRefresh) {
            const row = data as {
              pack_date: string;
              words_quota: number;
              idioms_quota: number;
              items_json: DailyPackRecord["items"];
              completed_terms: string[];
              completed_at?: string | null;
            };
            if (Array.isArray(row.items_json) && row.items_json.length > 0) {
              const pack: DailyPackRecord = {
                pack_date: row.pack_date,
                words_quota: row.words_quota,
                idioms_quota: row.idioms_quota,
                items: row.items_json,
                completed_terms: row.completed_terms ?? [],
                completed_at: row.completed_at ?? null,
                source: "supabase",
              };
              writeLocalDailyPack(pack, userId);
              callbacks.onDailyPackRefresh(pack);
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }

  if (typeof window === "undefined") return () => {};
  const handleStorage = (event: StorageEvent) => {
    if (event.key === wordsKey(userId)) {
      callbacks.onWordsRefresh(readLocalWords(todayStr, userId, true));
    } else if (event.key === logsKey(userId)) {
      callbacks.onLogsRefresh(readLocalLogs(userId));
    }
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener("storage", handleStorage);
  };
}
