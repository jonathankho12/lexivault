import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CefrLevel,
  DailyDiscoveryPack,
  DailyPackRecord,
  DailyQuotaSettings,
  DiscoveryItem,
  Sm2Rating,
  StudyLog,
  SyncMode,
  WordEntry,
  WordType,
} from "@/types/lexivault";
import { isLocalOnlyUserId, normalizeUsername } from "@/lib/auth";
import { cacheWordMeanings, resolveWordMeanings } from "@/lib/bilingualCache";
import { STARTER_WORD_TERMS } from "@/lib/cefrProgression";
import { isValidDailyPackLevelSetting } from "@/lib/dailyPackTiers";
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
import {
  isValidUuid,
  normalizeCefrLevel,
  normalizeDuplicateKey,
  normalizeRegister,
  normalizeSourceTag,
  normalizeTermKey,
} from "@/lib/utils";

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
const cefrOnboardingKey = (userId: string) =>
  `lexivault_cefr_onboarding_v1_${userId}`;
const ieltsProfileLocalKey = (userId: string) =>
  `lexivault_ielts_profile_v1_${userId}`;
const syncedWordIdsKey = (userId: string) =>
  `lexivault_synced_word_ids_v1_${userId}`;
const legacyUserMigratedKey = (userId: string) =>
  `lexivault_legacy_local_migrated_v1_${userId}`;
export const PENDING_GUEST_UPGRADE_KEY = "lexivault_pending_guest_upgrade_v1";

const VALID_WORD_TYPES = new Set<WordType>(["vocab", "idiom", "collocation"]);

export interface SupabaseSyncErrorInfo {
  operation: string;
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  formatted: string;
  timestamp: string;
}

let lastSupabaseSyncError: SupabaseSyncErrorInfo | null = null;
const syncErrorListeners = new Set<
  (err: SupabaseSyncErrorInfo | null) => void
>();

export function getLastSupabaseSyncError(): SupabaseSyncErrorInfo | null {
  return lastSupabaseSyncError;
}

export function clearLastSupabaseSyncError(): void {
  if (lastSupabaseSyncError === null) return;
  lastSupabaseSyncError = null;
  syncErrorListeners.forEach((cb) => cb(null));
}

export function subscribeSupabaseSyncErrors(
  cb: (err: SupabaseSyncErrorInfo | null) => void
): () => void {
  syncErrorListeners.add(cb);
  return () => {
    syncErrorListeners.delete(cb);
  };
}

function extractPostgrestFields(raw: unknown): {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
} {
  if (raw && typeof raw === "object") {
    const obj = raw as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    const message =
      typeof obj.message === "string" && obj.message.trim()
        ? obj.message.trim()
        : raw instanceof Error
          ? raw.message
          : String(raw);
    const code =
      typeof obj.code === "string" && obj.code.trim()
        ? obj.code.trim()
        : undefined;
    const details =
      typeof obj.details === "string" && obj.details.trim()
        ? obj.details.trim()
        : null;
    const hint =
      typeof obj.hint === "string" && obj.hint.trim() ? obj.hint.trim() : null;
    return { message, code, details, hint };
  }
  return { message: String(raw ?? "Unknown Supabase error") };
}

export function recordSupabaseSyncError(
  operation: string,
  rawErr: unknown
): SupabaseSyncErrorInfo {
  const { message, code, details, hint } = extractPostgrestFields(rawErr);

  console.error(`[LexiVault][SupabaseSync] ${operation} failed:`, {
    message,
    code: code ?? null,
    details: details ?? null,
    hint: hint ?? null,
  });

  const parts: string[] = [];
  if (code) parts.push(`[${code}]`);
  parts.push(message);
  if (details) parts.push(`— ${details}`);
  if (hint) parts.push(`(${hint})`);

  const needsSqlMigration =
    code === "PGRST205" ||
    code === "PGRST204" ||
    code === "42P01" ||
    code === "42703" ||
    /does not exist|schema cache/i.test(message);

  if (needsSqlMigration) {
    parts.push(
      "— Run supabase/migrations/20261124_fix_words_cloud_sync.sql in Supabase SQL Editor."
    );
  }

  const info: SupabaseSyncErrorInfo = {
    operation,
    message,
    code,
    details,
    hint,
    formatted: parts.join(" "),
    timestamp: new Date().toISOString(),
  };

  lastSupabaseSyncError = info;
  syncErrorListeners.forEach((cb) => cb(info));
  return info;
}

function isMissingColumnError(rawErr: unknown): boolean {
  const { message, code, details } = extractPostgrestFields(rawErr);
  if (code === "PGRST204" || code === "42703") return true;
  const combined = `${message} ${details ?? ""}`;
  return /column .* does not exist|could not find the '.*' column/i.test(
    combined
  );
}

function generateWordUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function readSyncedWordIds(userId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(syncedWordIdsKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return new Set(
        parsed.filter((item): item is string => typeof item === "string")
      );
    }
  } catch {
    // Ignore parse error
  }
  return new Set();
}

function writeSyncedWordIds(userId: string, ids: Iterable<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      syncedWordIdsKey(userId),
      JSON.stringify(Array.from(new Set(ids)))
    );
  } catch {
    // Ignore quota errors
  }
}

function addSyncedWordIds(userId: string, newIds: Iterable<string>): void {
  const current = readSyncedWordIds(userId);
  for (const id of newIds) {
    if (id) current.add(id);
  }
  writeSyncedWordIds(userId, current);
}

function removeSyncedWordId(userId: string, id: string): void {
  const current = readSyncedWordIds(userId);
  if (current.delete(id)) {
    writeSyncedWordIds(userId, current);
  }
}

async function resolveActiveSupabaseUserId(
  supabase: SupabaseClient,
  fallbackUserId: string,
  operation: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (!error && data.session?.user?.id) {
      return data.session.user.id;
    }

    const { data: refreshed, error: refreshErr } =
      await supabase.auth.refreshSession();
    if (!refreshErr && refreshed.session?.user?.id) {
      return refreshed.session.user.id;
    }

    recordSupabaseSyncError(operation, {
      code: "AUTH_SESSION_EXPIRED",
      message:
        refreshErr?.message ||
        error?.message ||
        "Supabase Auth session is missing or expired. Please sign out and sign back in.",
      details: `Expected user_id=${fallbackUserId}, but no active JWT session was found.`,
    });
    return null;
  } catch (err) {
    recordSupabaseSyncError(operation, err);
    return null;
  }
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string | null
): string | null {
  if (!value || typeof value !== "string") return fallback;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return fallback;
  return new Date(parsed).toISOString();
}

function normalizeWordChunks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const clean = item.replace(/\*\*/g, "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= 4) break;
  }
  return out;
}

function extractWordChunks(word: WordEntry): string[] {
  const fromField = normalizeWordChunks(word.chunks);
  if (fromField.length > 0) return fromField;
  const rawRecord = word as unknown as { chunks_json?: unknown };
  return normalizeWordChunks(rawRecord.chunks_json);
}

function sanitizeWordForCloud(
  word: WordEntry,
  activeUserId: string
): WordEntry {
  const nowIso = new Date().toISOString();
  const id = isValidUuid(word.id) ? word.id : generateWordUuid();
  const term = (word.term ?? "").trim() || "untitled";
  const type: WordType = VALID_WORD_TYPES.has(word.type) ? word.type : "vocab";
  const register = normalizeRegister(word.register, "Casual");
  const cefr = normalizeCefrLevel(word.cefr);
  const source_tag = normalizeSourceTag(word.source_tag);
  const meaning_id =
    word.meaning_id?.trim() || word.meaning_en?.trim() || term;
  const meaning_en = word.meaning_en?.trim() || undefined;
  const pronunciation = word.pronunciation?.trim() || undefined;
  const ipa = word.ipa?.trim() || undefined;
  const examples_json = Array.isArray(word.examples_json)
    ? word.examples_json
    : [];
  const synonyms = Array.isArray(word.synonyms)
    ? word.synonyms.filter((s): s is string => typeof s === "string")
    : [];
  const antonyms = Array.isArray(word.antonyms)
    ? word.antonyms.filter((s): s is string => typeof s === "string")
    : [];
  const word_families_json =
    type === "idiom"
      ? []
      : Array.isArray(word.word_families_json)
        ? word.word_families_json
        : [];
  const chunks = extractWordChunks(word);
  const correct_count = Math.max(
    0,
    Math.round(Number(word.correct_count ?? 0) || 0)
  );
  const wrong_count = Math.max(
    0,
    Math.round(Number(word.wrong_count ?? 0) || 0)
  );
  const review_count = Math.max(
    correct_count + wrong_count,
    Math.round(Number(word.review_count ?? 0) || 0)
  );
  const interval_days = Math.max(
    0,
    Math.round(Number(word.interval_days ?? 0) || 0)
  );
  const repetitions = Math.max(
    0,
    Math.round(Number(word.repetitions ?? 0) || 0)
  );
  const rawEase = Number(word.ease_factor ?? 2.5);
  const ease_factor = Number.isFinite(rawEase)
    ? Math.min(9.99, Math.max(1.3, Number(rawEase.toFixed(2))))
    : 2.5;
  const created_at = normalizeIsoTimestamp(word.created_at, nowIso) ?? nowIso;
  const next_review_at = normalizeIsoTimestamp(
    word.next_review_at,
    created_at
  );
  const last_practiced_at = normalizeIsoTimestamp(word.last_practiced_at, null);
  const last_reviewed_date =
    typeof word.last_reviewed_date === "string" &&
    word.last_reviewed_date.trim()
      ? word.last_reviewed_date.trim()
      : null;
  const audio_us_url =
    typeof word.audio_us_url === "string" && word.audio_us_url.trim()
      ? word.audio_us_url.trim()
      : null;
  const audio_uk_url =
    typeof word.audio_uk_url === "string" && word.audio_uk_url.trim()
      ? word.audio_uk_url.trim()
      : null;

  return {
    id,
    user_id: activeUserId,
    term,
    pronunciation,
    ipa,
    cefr,
    type,
    meaning_id,
    meaning_en,
    examples_json,
    synonyms,
    antonyms,
    word_families_json,
    chunks,
    register,
    source_tag,
    audio_us_url,
    audio_uk_url,
    correct_count,
    wrong_count,
    last_practiced_at,
    last_reviewed_date,
    review_count,
    next_review_at,
    interval_days,
    ease_factor,
    repetitions,
    created_at,
  };
}

function buildWordPayloadTiers(
  sanitized: WordEntry,
  activeUserId: string
): [
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
] {
  const minimalPayload: Record<string, unknown> = {
    id: sanitized.id,
    user_id: activeUserId,
    term: sanitized.term,
    type: sanitized.type,
    meaning_id: sanitized.meaning_id,
    examples_json: sanitized.examples_json,
    synonyms: sanitized.synonyms,
    antonyms: sanitized.antonyms,
    word_families_json: sanitized.word_families_json,
    register: sanitized.register,
    source_tag: sanitized.source_tag,
    correct_count: sanitized.correct_count,
    wrong_count: sanitized.wrong_count,
    created_at: sanitized.created_at,
  };

  const sm2Payload: Record<string, unknown> = {
    ...minimalPayload,
    audio_us_url: sanitized.audio_us_url ?? null,
    audio_uk_url: sanitized.audio_uk_url ?? null,
    last_practiced_at: sanitized.last_practiced_at ?? null,
    next_review_at: sanitized.next_review_at ?? sanitized.created_at,
    interval_days: sanitized.interval_days ?? 0,
    ease_factor: sanitized.ease_factor ?? 2.5,
    repetitions: sanitized.repetitions ?? 0,
  };

  const midPayload: Record<string, unknown> = {
    ...sm2Payload,
    pronunciation: sanitized.pronunciation ?? null,
    ipa: sanitized.ipa ?? null,
    meaning_en: sanitized.meaning_en ?? null,
  };

  const fullPayload: Record<string, unknown> = {
    ...midPayload,
    cefr: sanitized.cefr ?? null,
    last_reviewed_date: sanitized.last_reviewed_date ?? null,
    review_count: sanitized.review_count ?? 0,
  };

  const extendedPayload: Record<string, unknown> = {
    ...fullPayload,
    chunks_json: sanitized.chunks ?? [],
  };

  return [extendedPayload, fullPayload, midPayload, sm2Payload, minimalPayload];
}

function mergeTwoWordEntries(
  cloudWord: WordEntry,
  localWord: WordEntry,
  activeUserId: string
): { merged: WordEntry; needsCloudUpsert: boolean } {
  const id = isValidUuid(cloudWord.id)
    ? cloudWord.id
    : isValidUuid(localWord.id)
      ? localWord.id
      : generateWordUuid();

  const localPracticedMs = Date.parse(localWord.last_practiced_at ?? "") || 0;
  const cloudPracticedMs = Date.parse(cloudWord.last_practiced_at ?? "") || 0;
  const newerSm2 = localPracticedMs > cloudPracticedMs ? localWord : cloudWord;
  const olderSm2 = localPracticedMs > cloudPracticedMs ? cloudWord : localWord;

  const correct_count = Math.max(
    cloudWord.correct_count ?? 0,
    localWord.correct_count ?? 0
  );
  const wrong_count = Math.max(
    cloudWord.wrong_count ?? 0,
    localWord.wrong_count ?? 0
  );
  const review_count = Math.max(
    cloudWord.review_count ?? 0,
    localWord.review_count ?? 0,
    correct_count + wrong_count
  );

  const cloudExamples = Array.isArray(cloudWord.examples_json)
    ? cloudWord.examples_json
    : [];
  const localExamples = Array.isArray(localWord.examples_json)
    ? localWord.examples_json
    : [];
  const examples_json =
    localExamples.length > cloudExamples.length ? localExamples : cloudExamples;

  const cloudSyns = Array.isArray(cloudWord.synonyms) ? cloudWord.synonyms : [];
  const localSyns = Array.isArray(localWord.synonyms) ? localWord.synonyms : [];
  const synonyms = localSyns.length > cloudSyns.length ? localSyns : cloudSyns;

  const cloudAnts = Array.isArray(cloudWord.antonyms) ? cloudWord.antonyms : [];
  const localAnts = Array.isArray(localWord.antonyms) ? localWord.antonyms : [];
  const antonyms = localAnts.length > cloudAnts.length ? localAnts : cloudAnts;

  const resolvedType = cloudWord.type || localWord.type;
  const cloudFamilies = Array.isArray(cloudWord.word_families_json)
    ? cloudWord.word_families_json
    : [];
  const localFamilies = Array.isArray(localWord.word_families_json)
    ? localWord.word_families_json
    : [];
  const word_families_json =
    resolvedType === "idiom"
      ? []
      : localFamilies.length > cloudFamilies.length
        ? localFamilies
        : cloudFamilies;

  const cloudChunks = extractWordChunks(cloudWord);
  const localChunks = extractWordChunks(localWord);
  const chunks =
    localChunks.length > cloudChunks.length ? localChunks : cloudChunks;

  const localHasNewerData =
    localPracticedMs > cloudPracticedMs ||
    (localWord.correct_count ?? 0) > (cloudWord.correct_count ?? 0) ||
    (localWord.wrong_count ?? 0) > (cloudWord.wrong_count ?? 0) ||
    (localWord.review_count ?? 0) > (cloudWord.review_count ?? 0) ||
    (!cloudWord.cefr && Boolean(localWord.cefr)) ||
    (!cloudWord.meaning_en && Boolean(localWord.meaning_en)) ||
    (!cloudWord.pronunciation && Boolean(localWord.pronunciation)) ||
    localExamples.length > cloudExamples.length ||
    localChunks.length > cloudChunks.length;

  const rawMerged: WordEntry = {
    ...cloudWord,
    id,
    user_id: activeUserId,
    term: cloudWord.term?.trim() || localWord.term,
    pronunciation: cloudWord.pronunciation || localWord.pronunciation,
    ipa: cloudWord.ipa || localWord.ipa,
    cefr: cloudWord.cefr || localWord.cefr,
    type: cloudWord.type || localWord.type,
    meaning_id: cloudWord.meaning_id || localWord.meaning_id,
    meaning_en: cloudWord.meaning_en || localWord.meaning_en,
    examples_json,
    synonyms,
    antonyms,
    word_families_json,
    chunks,
    register: cloudWord.register || localWord.register,
    source_tag: cloudWord.source_tag || localWord.source_tag,
    audio_us_url: cloudWord.audio_us_url ?? localWord.audio_us_url ?? null,
    audio_uk_url: cloudWord.audio_uk_url ?? localWord.audio_uk_url ?? null,
    correct_count,
    wrong_count,
    review_count,
    last_practiced_at:
      newerSm2.last_practiced_at ?? olderSm2.last_practiced_at ?? null,
    last_reviewed_date:
      newerSm2.last_reviewed_date ?? olderSm2.last_reviewed_date ?? null,
    next_review_at: newerSm2.next_review_at ?? olderSm2.next_review_at ?? null,
    interval_days: newerSm2.interval_days ?? olderSm2.interval_days ?? 0,
    ease_factor: newerSm2.ease_factor ?? olderSm2.ease_factor ?? 2.5,
    repetitions: newerSm2.repetitions ?? olderSm2.repetitions ?? 0,
    created_at: cloudWord.created_at || localWord.created_at,
  };

  return {
    merged: hydrateWordMetadata(
      sanitizeWordForCloud(rawMerged, activeUserId),
      activeUserId
    ),
    needsCloudUpsert: localHasNewerData,
  };
}

function mergeCloudAndLocalWords(
  cloudWords: WordEntry[],
  localWords: WordEntry[],
  activeUserId: string,
  cacheUserId: string,
  forceAllLocal: boolean
): {
  mergedWords: WordEntry[];
  wordsToUpsert: WordEntry[];
  uploadedNewCount: number;
} {
  const previouslySyncedIds = readSyncedWordIds(cacheUserId);
  const cloudById = new Map<string, WordEntry>();
  const cloudByTermKey = new Map<string, WordEntry>();

  for (const rawCloud of cloudWords) {
    const clean = hydrateWordMetadata(
      sanitizeWordForCloud(rawCloud, activeUserId),
      cacheUserId
    );
    cloudById.set(clean.id, clean);
    const dupKey =
      normalizeDuplicateKey(clean.term) || normalizeTermKey(clean.term);
    if (dupKey && !cloudByTermKey.has(dupKey)) {
      cloudByTermKey.set(dupKey, clean);
    }
  }

  const mergedById = new Map<string, WordEntry>(cloudById);
  const upsertById = new Map<string, WordEntry>();
  const seenLocalKeys = new Set<string>();
  let uploadedNewCount = 0;

  for (const localRaw of localWords) {
    const dupKey =
      normalizeDuplicateKey(localRaw.term) || normalizeTermKey(localRaw.term);
    if (!dupKey || seenLocalKeys.has(dupKey)) continue;
    seenLocalKeys.add(dupKey);

    const matchedCloud =
      mergedById.get(localRaw.id) ?? cloudByTermKey.get(dupKey);

    if (matchedCloud) {
      const { merged, needsCloudUpsert } = mergeTwoWordEntries(
        matchedCloud,
        localRaw,
        activeUserId
      );
      mergedById.set(merged.id, merged);
      cloudByTermKey.set(dupKey, merged);
      if (needsCloudUpsert || forceAllLocal) {
        upsertById.set(merged.id, merged);
      }
      continue;
    }

    if (!forceAllLocal) {
      // If previously confirmed synced on Supabase and now absent in cloud, respect remote deletion
      if (previouslySyncedIds.has(localRaw.id)) {
        continue;
      }
      // Do not auto-upload leftover starter demo cards if cloud already has real words
      if (localRaw.id.startsWith("mock-word-") && cloudWords.length > 0) {
        continue;
      }
    }

    const sanitizedLocal = hydrateWordMetadata(
      sanitizeWordForCloud(localRaw, activeUserId),
      cacheUserId
    );
    mergedById.set(sanitizedLocal.id, sanitizedLocal);
    cloudByTermKey.set(dupKey, sanitizedLocal);
    upsertById.set(sanitizedLocal.id, sanitizedLocal);
    uploadedNewCount += 1;
  }

  if (forceAllLocal) {
    for (const entry of mergedById.values()) {
      upsertById.set(entry.id, entry);
    }
  }

  const mergedWords = Array.from(mergedById.values()).sort(
    (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0)
  );

  return {
    mergedWords,
    wordsToUpsert: Array.from(upsertById.values()),
    uploadedNewCount,
  };
}

async function upsertWordToSupabase(
  supabase: SupabaseClient,
  word: WordEntry,
  activeUserId: string,
  cacheUserId: string,
  operation: string,
  options?: { clearErrorOnSuccess?: boolean }
): Promise<{ saved: WordEntry | null; error: SupabaseSyncErrorInfo | null }> {
  let sanitized = sanitizeWordForCloud(word, activeUserId);
  let tiers = buildWordPayloadTiers(sanitized, activeUserId);
  let primaryError: unknown = null;
  let retriedUniqueConflict = false;

  for (let tierIdx = 0; tierIdx < tiers.length; tierIdx += 1) {
    const payload = tiers[tierIdx];
    let data: unknown = null;
    let error: unknown = null;

    try {
      const res = await supabase
        .from("words")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();
      data = res.data;
      error = res.error;
    } catch (networkErr) {
      error = networkErr;
    }

    if (!error && data) {
      const row = data as WordEntry;
      const rowChunks = extractWordChunks(row);
      const hydrated = hydrateWordMetadata(
        {
          ...row,
          pronunciation: row.pronunciation || sanitized.pronunciation,
          ipa: row.ipa || sanitized.ipa,
          meaning_en: row.meaning_en || sanitized.meaning_en,
          cefr: row.cefr || sanitized.cefr,
          chunks: rowChunks.length > 0 ? rowChunks : sanitized.chunks,
          last_reviewed_date:
            row.last_reviewed_date ?? sanitized.last_reviewed_date ?? null,
          review_count: row.review_count ?? sanitized.review_count ?? 0,
        },
        cacheUserId
      );
      addSyncedWordIds(cacheUserId, [hydrated.id]);
      if (options?.clearErrorOnSuccess !== false) {
        clearLastSupabaseSyncError();
      }
      return { saved: hydrated, error: null };
    }

    if (primaryError === null) {
      primaryError = error;
    }

    // Handle optional unique constraint on (user_id, term) if present in user's DB
    if (
      !retriedUniqueConflict &&
      error &&
      (error as { code?: string }).code === "23505"
    ) {
      retriedUniqueConflict = true;
      try {
        const { data: existingRow } = await supabase
          .from("words")
          .select("*")
          .eq("user_id", activeUserId)
          .ilike("term", sanitized.term)
          .limit(1)
          .maybeSingle();
        if (
          existingRow &&
          isValidUuid((existingRow as WordEntry).id) &&
          (existingRow as WordEntry).id !== sanitized.id
        ) {
          sanitized = sanitizeWordForCloud(
            { ...sanitized, id: (existingRow as WordEntry).id },
            activeUserId
          );
          tiers = buildWordPayloadTiers(sanitized, activeUserId);
          primaryError = null;
          tierIdx = -1;
          continue;
        }
      } catch {
        // Proceed to record primaryError below
      }
    }

    if (error && isMissingColumnError(error) && tierIdx < tiers.length - 1) {
      console.error(
        `[LexiVault][SupabaseSync] ${operation} missing column on tier ${tierIdx}, retrying compatible schema tier:`,
        extractPostgrestFields(error)
      );
      continue;
    }

    break;
  }

  const errInfo = recordSupabaseSyncError(operation, primaryError);
  return { saved: null, error: errInfo };
}

async function upsertWordsBatchToSupabase(
  supabase: SupabaseClient,
  wordsToSync: WordEntry[],
  activeUserId: string,
  cacheUserId: string,
  operation: string
): Promise<{
  savedMap: Map<string, WordEntry>;
  savedByInputId: Map<string, WordEntry>;
  failedCount: number;
  firstError: SupabaseSyncErrorInfo | null;
}> {
  const savedMap = new Map<string, WordEntry>();
  const savedByInputId = new Map<string, WordEntry>();
  if (wordsToSync.length === 0) {
    return { savedMap, savedByInputId, failedCount: 0, firstError: null };
  }

  const CHUNK_SIZE = 50;
  let failedCount = 0;
  let firstError: SupabaseSyncErrorInfo | null = null;

  for (let offset = 0; offset < wordsToSync.length; offset += CHUNK_SIZE) {
    const rawSlice = wordsToSync.slice(offset, offset + CHUNK_SIZE);
    const pairedChunk = rawSlice.map((raw) => ({
      inputId: raw.id,
      sanitized: sanitizeWordForCloud(raw, activeUserId),
    }));
    const chunk = pairedChunk.map((p) => p.sanitized);
    const pairBySanitizedId = new Map(
      pairedChunk.map((p) => [p.sanitized.id, p])
    );

    let chunkSaved = false;
    let chunkPrimaryError: unknown = null;

    const totalTiers = 5;
    for (let tierIdx = 0; tierIdx < totalTiers; tierIdx += 1) {
      const payloads = chunk.map(
        (w) => buildWordPayloadTiers(w, activeUserId)[tierIdx]
      );
      let data: unknown = null;
      let error: unknown = null;

      try {
        const res = await supabase
          .from("words")
          .upsert(payloads, { onConflict: "id" })
          .select("*");
        data = res.data;
        error = res.error;
      } catch (networkErr) {
        error = networkErr;
      }

      if (!error && Array.isArray(data)) {
        for (const row of data as WordEntry[]) {
          const pair = pairBySanitizedId.get(row.id);
          const orig = pair?.sanitized;
          const rowChunks = extractWordChunks(row);
          const hydrated = hydrateWordMetadata(
            {
              ...row,
              pronunciation: row.pronunciation || orig?.pronunciation,
              ipa: row.ipa || orig?.ipa,
              meaning_en: row.meaning_en || orig?.meaning_en,
              cefr: row.cefr || orig?.cefr,
              chunks: rowChunks.length > 0 ? rowChunks : orig?.chunks,
              last_reviewed_date:
                row.last_reviewed_date ?? orig?.last_reviewed_date ?? null,
              review_count: row.review_count ?? orig?.review_count ?? 0,
            },
            cacheUserId
          );
          savedMap.set(hydrated.id, hydrated);
          savedByInputId.set(pair?.inputId ?? hydrated.id, hydrated);
          writeReviewMeta(cacheUserId, hydrated);
        }
        addSyncedWordIds(
          cacheUserId,
          (data as WordEntry[]).map((r) => r.id)
        );
        chunkSaved = true;
        break;
      }

      if (chunkPrimaryError === null) {
        chunkPrimaryError = error;
      }

      if (error && isMissingColumnError(error) && tierIdx < totalTiers - 1) {
        console.error(
          `[LexiVault][SupabaseSync] ${operation} batch missing column on tier ${tierIdx}, retrying compatible schema tier:`,
          extractPostgrestFields(error)
        );
        continue;
      }

      break;
    }

    if (!chunkSaved) {
      const extracted = extractPostgrestFields(chunkPrimaryError);
      const isFatalTableOrAuthErr =
        extracted.code === "PGRST205" ||
        extracted.code === "42P01" ||
        extracted.code === "42501" ||
        extracted.code === "PGRST301";

      if (isFatalTableOrAuthErr) {
        const info = recordSupabaseSyncError(operation, chunkPrimaryError);
        if (!firstError) firstError = info;
        failedCount += pairedChunk.length;
      } else {
        // Fallback to per-item upsert so a single conflicting row never blocks the rest
        for (const pair of pairedChunk) {
          const singleRes = await upsertWordToSupabase(
            supabase,
            pair.sanitized,
            activeUserId,
            cacheUserId,
            operation,
            { clearErrorOnSuccess: false }
          );
          if (singleRes.saved) {
            savedMap.set(singleRes.saved.id, singleRes.saved);
            savedByInputId.set(pair.inputId, singleRes.saved);
            writeReviewMeta(cacheUserId, singleRes.saved);
          } else {
            failedCount += 1;
            if (!firstError && singleRes.error) {
              firstError = singleRes.error;
            }
          }
        }
      }
    }
  }

  if (failedCount === 0) {
    clearLastSupabaseSyncError();
  } else if (firstError) {
    lastSupabaseSyncError = firstError;
    syncErrorListeners.forEach((cb) => cb(firstError));
  }

  return { savedMap, savedByInputId, failedCount, firstError };
}

function reconcileWordsWithSavedMap(
  words: WordEntry[],
  savedByInputId: Map<string, WordEntry>
): WordEntry[] {
  if (savedByInputId.size === 0) return words;
  const dedupedById = new Map<string, WordEntry>();
  for (const word of words) {
    const resolved = savedByInputId.get(word.id) ?? word;
    dedupedById.set(resolved.id, resolved);
  }
  return Array.from(dedupedById.values()).sort(
    (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0)
  );
}

function readPendingGuestUpgradeUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const val = window.localStorage.getItem(PENDING_GUEST_UPGRADE_KEY)?.trim();
    return val && val.startsWith("guest-local-") ? val : null;
  } catch {
    return null;
  }
}

function clearPendingGuestUpgradeUserId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_GUEST_UPGRADE_KEY);
  } catch {
    // Ignore storage error
  }
}

function collectLocalMergeSources(
  todayStr: string,
  cacheUserId: string,
  activeUserId: string,
  username?: string,
  inMemoryWords?: WordEntry[]
): {
  localWords: WordEntry[];
  localLogs: StudyLog[];
  localXp: number;
  pendingGuestId: string | null;
  legacyLocalUserId: string | null;
} {
  const combinedWords: WordEntry[] = [];
  const seenKeys = new Set<string>();

  const pushWords = (list: WordEntry[]) => {
    for (const item of list) {
      const key =
        normalizeDuplicateKey(item.term) ||
        normalizeTermKey(item.term) ||
        item.id;
      if (!key || seenKeys.has(key)) continue;
      seenKeys.add(key);
      combinedWords.push(item);
    }
  };

  if (Array.isArray(inMemoryWords) && inMemoryWords.length > 0) {
    pushWords(inMemoryWords);
  }
  pushWords(readLocalWords(todayStr, cacheUserId, false));
  if (activeUserId !== cacheUserId) {
    pushWords(readLocalWords(todayStr, activeUserId, false));
  }

  let localXp = Math.max(readLocalXp(cacheUserId), readLocalXp(activeUserId));
  const combinedLogs: StudyLog[] = [
    ...readLocalLogs(cacheUserId),
    ...(activeUserId !== cacheUserId ? readLocalLogs(activeUserId) : []),
  ];

  const pendingGuestId = readPendingGuestUpgradeUserId();
  if (pendingGuestId) {
    pushWords(readLocalWords(todayStr, pendingGuestId, false));
    combinedLogs.push(...readLocalLogs(pendingGuestId));
    localXp = Math.max(localXp, readLocalXp(pendingGuestId));
  }

  let legacyLocalUserId: string | null = null;
  const cleanUsername = username ? normalizeUsername(username) : "";
  if (
    cleanUsername &&
    typeof window !== "undefined" &&
    window.localStorage.getItem(legacyUserMigratedKey(cacheUserId)) !== "true"
  ) {
    const candidateLegacyId = `local-user-${cleanUsername}`;
    const legacyWords = readLocalWords(todayStr, candidateLegacyId, false);
    const legacyLogs = readLocalLogs(candidateLegacyId);
    const legacyXp = readLocalXp(candidateLegacyId);
    if (legacyWords.length > 0 || legacyLogs.length > 0 || legacyXp > 0) {
      legacyLocalUserId = candidateLegacyId;
      pushWords(legacyWords);
      combinedLogs.push(...legacyLogs);
      localXp = Math.max(localXp, legacyXp);
    }
  }

  return {
    localWords: combinedWords,
    localLogs: combinedLogs,
    localXp,
    pendingGuestId,
    legacyLocalUserId,
  };
}

function mergeCloudAndLocalStudyLogs(
  cloudLogs: StudyLog[],
  localLogs: StudyLog[],
  activeUserId: string
): {
  mergedLogs: StudyLog[];
  logsToUpsert: Array<{
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
  }>;
} {
  const byDate = new Map<string, StudyLog>();
  const cloudByDate = new Map<string, StudyLog>();

  for (const raw of cloudLogs) {
    if (!raw.study_date) continue;
    const normalized: StudyLog = {
      ...raw,
      user_id: activeUserId,
      vocab_today: raw.vocab_today ?? raw.words_added ?? 0,
      recall_today: raw.recall_today ?? raw.reviews_count ?? 0,
      ielts_today: raw.ielts_today ?? 0,
      xp_earned: raw.xp_earned ?? 0,
    };
    cloudByDate.set(normalized.study_date, normalized);
    byDate.set(normalized.study_date, normalized);
  }

  const dirtyDates = new Set<string>();
  const nowIso = new Date().toISOString();

  for (const local of localLogs) {
    if (!local.study_date || local.id?.startsWith("mock-log-")) continue;
    const existing = byDate.get(local.study_date);
    if (!existing) {
      const normalizedLocal: StudyLog = {
        ...local,
        user_id: activeUserId,
        vocab_today: local.vocab_today ?? local.words_added ?? 0,
        recall_today: local.recall_today ?? local.reviews_count ?? 0,
        ielts_today: local.ielts_today ?? 0,
        xp_earned: local.xp_earned ?? 0,
        updated_at: local.updated_at ?? nowIso,
      };
      byDate.set(local.study_date, normalizedLocal);
      dirtyDates.add(local.study_date);
      continue;
    }

    const merged: StudyLog = {
      ...existing,
      user_id: activeUserId,
      reviews_count: Math.max(
        existing.reviews_count ?? 0,
        local.reviews_count ?? 0
      ),
      correct_count: Math.max(
        existing.correct_count ?? 0,
        local.correct_count ?? 0
      ),
      wrong_count: Math.max(existing.wrong_count ?? 0, local.wrong_count ?? 0),
      words_added: Math.max(existing.words_added ?? 0, local.words_added ?? 0),
      vocab_today: Math.max(
        existing.vocab_today ?? existing.words_added ?? 0,
        local.vocab_today ?? local.words_added ?? 0
      ),
      recall_today: Math.max(
        existing.recall_today ?? existing.reviews_count ?? 0,
        local.recall_today ?? local.reviews_count ?? 0
      ),
      ielts_today: Math.max(existing.ielts_today ?? 0, local.ielts_today ?? 0),
      xp_earned: Math.max(existing.xp_earned ?? 0, local.xp_earned ?? 0),
      updated_at: nowIso,
    };

    const cloud = cloudByDate.get(local.study_date);
    const localAdvanced =
      !cloud ||
      merged.reviews_count > (cloud.reviews_count ?? 0) ||
      merged.correct_count > (cloud.correct_count ?? 0) ||
      merged.wrong_count > (cloud.wrong_count ?? 0) ||
      merged.words_added > (cloud.words_added ?? 0) ||
      (merged.vocab_today ?? 0) > (cloud.vocab_today ?? 0) ||
      (merged.recall_today ?? 0) > (cloud.recall_today ?? 0) ||
      (merged.ielts_today ?? 0) > (cloud.ielts_today ?? 0) ||
      (merged.xp_earned ?? 0) > (cloud.xp_earned ?? 0);

    byDate.set(local.study_date, merged);
    if (localAdvanced) {
      dirtyDates.add(local.study_date);
    }
  }

  const mergedLogs = Array.from(byDate.values()).sort((a, b) =>
    b.study_date.localeCompare(a.study_date)
  );

  const logsToUpsert = Array.from(dirtyDates)
    .map((date) => byDate.get(date))
    .filter((l): l is StudyLog => Boolean(l))
    .map((l) => ({
      user_id: activeUserId,
      study_date: l.study_date,
      reviews_count: l.reviews_count ?? 0,
      correct_count: l.correct_count ?? 0,
      wrong_count: l.wrong_count ?? 0,
      words_added: l.words_added ?? 0,
      vocab_today: l.vocab_today ?? l.words_added ?? 0,
      recall_today: l.recall_today ?? l.reviews_count ?? 0,
      ielts_today: l.ielts_today ?? 0,
      xp_earned: l.xp_earned ?? 0,
      updated_at: l.updated_at ?? nowIso,
    }));

  return { mergedLogs, logsToUpsert };
}

export const DEFAULT_DAILY_QUOTA: DailyQuotaSettings = {
  wordsPerDay: 10,
  idiomsPerDay: 5,
  autoShowPopup: true,
  targetLevel: "auto",
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
    targetLevel: isValidDailyPackLevelSetting(partial?.targetLevel)
      ? partial.targetLevel
      : DEFAULT_DAILY_QUOTA.targetLevel,
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
  chunks?: string[];
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
    const existing = map[word.id] ?? map[`term:${normalizeTermKey(word.term)}`];
    const resolvedChunks = extractWordChunks(word);
    const meta: ReviewMetaRecord = {
      last_reviewed_date: word.last_reviewed_date ?? null,
      review_count: getEffectiveReviewCount(word),
      next_review_at: word.next_review_at ?? null,
      interval_days: word.interval_days,
      ease_factor: word.ease_factor,
      repetitions: word.repetitions,
      chunks:
        resolvedChunks.length > 0
          ? resolvedChunks
          : existing?.chunks,
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

  const directChunks = extractWordChunks(word);
  const resolvedChunks =
    directChunks.length > 0
      ? directChunks
      : normalizeWordChunks(reviewMeta?.chunks);

  return {
    ...word,
    pronunciation: resolvedPron.pronunciation ?? undefined,
    ipa: resolvedPron.ipa ?? undefined,
    meaning_id: resolvedMeanings.meaning_id,
    meaning_en: resolvedMeanings.meaning_en,
    cefr: resolvedMeanings.cefr,
    chunks: resolvedChunks,
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

export interface CefrOnboardingRecord {
  completed: boolean;
  cefrLevel?: CefrLevel;
  updatedAt: string;
}

export function readLocalCefrOnboarding(
  userId: string
): CefrOnboardingRecord | null {
  if (typeof window === "undefined") return null;
  const parsed = safeParseJson<Partial<CefrOnboardingRecord>>(
    window.localStorage.getItem(cefrOnboardingKey(userId))
  );
  if (!parsed || typeof parsed.completed !== "boolean") return null;
  const cefrLevel = normalizeCefrLevel(parsed.cefrLevel);
  return {
    completed: parsed.completed,
    ...(cefrLevel ? { cefrLevel } : {}),
    updatedAt:
      typeof parsed.updatedAt === "string"
        ? parsed.updatedAt
        : new Date(0).toISOString(),
  };
}

export function writeLocalCefrOnboarding(
  userId: string,
  record: { completed: boolean; cefrLevel?: CefrLevel }
): CefrOnboardingRecord {
  const existing = readLocalCefrOnboarding(userId);
  const cefrLevel = normalizeCefrLevel(
    record.cefrLevel ?? existing?.cefrLevel
  );
  const next: CefrOnboardingRecord = {
    completed: record.completed,
    ...(cefrLevel ? { cefrLevel } : {}),
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(cefrOnboardingKey(userId), JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}

function readLocalIeltsCefrSummary(userId: string): {
  cefr_level?: CefrLevel;
  placement_completed?: boolean;
  estimated_band?: number;
  updated_at?: string;
} | null {
  if (typeof window === "undefined") return null;
  const parsed = safeParseJson<{
    user_id?: string;
    cefr_level?: unknown;
    placement_completed?: unknown;
    estimated_band?: unknown;
    updated_at?: unknown;
  }>(window.localStorage.getItem(ieltsProfileLocalKey(userId)));
  if (!parsed || (parsed.user_id && parsed.user_id !== userId)) return null;
  const cefr_level = normalizeCefrLevel(parsed.cefr_level);
  return {
    ...(cefr_level ? { cefr_level } : {}),
    placement_completed: parsed.placement_completed === true,
    estimated_band:
      typeof parsed.estimated_band === "number" ? parsed.estimated_band : 0,
    updated_at:
      typeof parsed.updated_at === "string" ? parsed.updated_at : undefined,
  };
}

function writeLocalIeltsCefrLevel(userId: string, cefrLevel: CefrLevel): void {
  if (typeof window === "undefined") return;
  try {
    const raw = safeParseJson<Record<string, unknown>>(
      window.localStorage.getItem(ieltsProfileLocalKey(userId))
    );
    const nowIso = new Date().toISOString();
    const next = {
      user_id: userId,
      estimated_band: 0,
      reading_band: null,
      listening_band: null,
      writing_band: null,
      speaking_band: null,
      placement_completed: false,
      ...(raw ?? {}),
      cefr_level: cefrLevel,
      updated_at: nowIso,
    };
    window.localStorage.setItem(
      ieltsProfileLocalKey(userId),
      JSON.stringify(next)
    );
  } catch {
    // Ignore storage quota errors
  }
}

function hasExistingVaultHistory(
  words: WordEntry[],
  logs: StudyLog[],
  xp: number,
  quota: DailyQuotaSettings,
  userId: string
): boolean {
  if (logs.length > 0 || xp > 0 || quota.targetLevel !== "auto") {
    return true;
  }
  if (
    typeof window !== "undefined" &&
    window.localStorage.getItem(demoClearedKey(userId)) === "true"
  ) {
    return true;
  }
  for (const w of words) {
    const key = normalizeTermKey(w.term);
    if (!STARTER_WORD_TERMS.has(key)) {
      return true;
    }
    if (
      (w.correct_count || 0) > 0 ||
      (w.wrong_count || 0) > 0 ||
      (w.review_count ?? 0) > 0 ||
      Boolean(w.last_practiced_at) ||
      Boolean(w.last_reviewed_date)
    ) {
      return true;
    }
  }
  return false;
}

interface CloudMetadataEnvelope {
  xp?: number;
  dailyQuota?: Partial<DailyQuotaSettings>;
  ringTargets?: Partial<DailyRingTargets>;
  cefrLevel?: CefrLevel;
  cefrOnboardingCompleted?: boolean;
}

async function mirrorCloudMetadataToAuth(
  userId: string,
  patch: {
    xp?: number;
    dailyQuota?: DailyQuotaSettings;
    ringTargets?: DailyRingTargets;
    dailyPack?: DailyPackRecord | null;
    cefrLevel?: CefrLevel;
    cefrOnboardingCompleted?: boolean;
  }
): Promise<boolean> {
  const supabase = getScopedSupabase(userId);
  if (!supabase) return false;
  try {
    const { data, error: getUserErr } = await supabase.auth.getUser();
    if (getUserErr || !data.user) {
      if (getUserErr) {
        console.error(
          "[LexiVault][SupabaseSync] mirrorCloudMetadataToAuth getUser failed:",
          extractPostgrestFields(getUserErr)
        );
      }
      return false;
    }
    const existingMeta = (data.user.user_metadata ?? {}) as Record<
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
      ...(patch.cefrLevel ? { cefrLevel: patch.cefrLevel } : {}),
      ...(typeof patch.cefrOnboardingCompleted === "boolean"
        ? { cefrOnboardingCompleted: patch.cefrOnboardingCompleted }
        : {}),
    };

    const nextUserMeta: Record<string, unknown> = {
      ...existingMeta,
      lexivault_cloud: nextCloud,
    };

    if (patch.dailyPack !== undefined) {
      nextUserMeta.lexivault_daily_pack = patch.dailyPack;
    }

    const { error: updateErr } = await supabase.auth.updateUser({
      data: nextUserMeta,
    });
    if (updateErr) {
      console.error(
        "[LexiVault][SupabaseSync] mirrorCloudMetadataToAuth updateUser failed:",
        extractPostgrestFields(updateErr)
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      "[LexiVault][SupabaseSync] mirrorCloudMetadataToAuth exception:",
      extractPostgrestFields(err)
    );
    return false;
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

  const activeUserId = await resolveActiveSupabaseUserId(
    supabase,
    userId,
    "upsertStudyLog"
  );
  if (!activeUserId) return null;

  const scopedPayload = {
    ...payload,
    user_id: activeUserId,
  };

  try {
    let { data, error } = await supabase
      .from("study_logs")
      .upsert(scopedPayload, { onConflict: "user_id,study_date" })
      .select("*")
      .single();

    // Retry with core columns if optional rings/xp columns aren't migrated yet
    if (error && isMissingColumnError(error)) {
      const basePayload = {
        user_id: activeUserId,
        study_date: scopedPayload.study_date,
        reviews_count: scopedPayload.reviews_count,
        correct_count: scopedPayload.correct_count,
        wrong_count: scopedPayload.wrong_count,
        words_added: scopedPayload.words_added,
        updated_at: scopedPayload.updated_at,
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
        vocab_today: (data as StudyLog).vocab_today ?? scopedPayload.vocab_today,
        recall_today:
          (data as StudyLog).recall_today ?? scopedPayload.recall_today,
        ielts_today: (data as StudyLog).ielts_today ?? scopedPayload.ielts_today,
        xp_earned: (data as StudyLog).xp_earned ?? scopedPayload.xp_earned,
      };
      return merged;
    }

    if (error) {
      recordSupabaseSyncError("upsertStudyLog", error);
    }
  } catch (err) {
    recordSupabaseSyncError("upsertStudyLog", err);
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
  cefrLevel: CefrLevel | null;
  cefrOnboardingCompleted: boolean;
  placementCompleted: boolean;
  syncMode: SyncMode;
  cloudReachable: boolean;
  syncError: SupabaseSyncErrorInfo | null;
  uploadedLocalCount: number;
}

export interface LoadInitialDataOptions {
  username?: string;
  inMemoryWords?: WordEntry[];
  forceUploadAll?: boolean;
}

export async function loadInitialData(
  todayStr: string,
  userId: string,
  options?: LoadInitialDataOptions
): Promise<HydratedCloudState> {
  const supabase = getScopedSupabase(userId);
  const localQuota = readLocalDailyQuota(userId);
  const localRings = readCustomRingTargets();
  const localXp = readLocalXp(userId);
  const localPack = readLocalDailyPack(todayStr, userId);
  const localOnboarding = readLocalCefrOnboarding(userId);
  const localIelts = readLocalIeltsCefrSummary(userId);

  if (supabase) {
    const activeUserId = await resolveActiveSupabaseUserId(
      supabase,
      userId,
      options?.forceUploadAll ? "forceSyncVaultToCloud" : "loadInitialData"
    );

    if (!activeUserId) {
      const fallbackWords =
        options?.inMemoryWords && options.inMemoryWords.length > 0
          ? options.inMemoryWords
          : readLocalWords(todayStr, userId, false);
      const fallbackPlacementDone = Boolean(localIelts?.placement_completed);
      const fallbackCefr =
        localOnboarding?.cefrLevel ??
        (fallbackPlacementDone || (localIelts?.estimated_band ?? 0) > 0
          ? localIelts?.cefr_level ?? null
          : null);
      const fallbackOnboardingDone =
        Boolean(localOnboarding?.completed) ||
        fallbackPlacementDone ||
        Boolean(fallbackCefr) ||
        hasExistingVaultHistory(
          fallbackWords,
          readLocalLogs(userId),
          localXp,
          localQuota,
          userId
        );
      return {
        words: fallbackWords,
        studyLogs: readLocalLogs(userId),
        xp: localXp,
        dailyQuota: localQuota,
        ringTargets: localRings,
        dailyPack: localPack,
        cefrLevel: fallbackCefr,
        cefrOnboardingCompleted: fallbackOnboardingDone,
        placementCompleted: fallbackPlacementDone,
        syncMode: "local",
        cloudReachable: false,
        syncError: getLastSupabaseSyncError(),
        uploadedLocalCount: 0,
      };
    }

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
        .eq("user_id", activeUserId)
        .order("created_at", { ascending: false }),
      supabase
        .from("study_logs")
        .select("*")
        .eq("user_id", activeUserId)
        .order("study_date", { ascending: false }),
      supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", activeUserId)
        .maybeSingle(),
      supabase
        .from("ielts_profiles")
        .select("*")
        .eq("user_id", activeUserId)
        .maybeSingle(),
      supabase
        .from("daily_packs")
        .select("*")
        .eq("user_id", activeUserId)
        .eq("pack_date", todayStr)
        .maybeSingle(),
      supabase.auth.getUser(),
    ]);

    const wordsOk =
      wordsSettled.status === "fulfilled" && !wordsSettled.value.error;
    const logsOk =
      logsSettled.status === "fulfilled" && !logsSettled.value.error;

    let syncError: SupabaseSyncErrorInfo | null = null;

    if (wordsSettled.status === "rejected") {
      syncError = recordSupabaseSyncError("loadWords", wordsSettled.reason);
    } else if (wordsSettled.value.error) {
      syncError = recordSupabaseSyncError(
        "loadWords",
        wordsSettled.value.error
      );
    }

    if (logsSettled.status === "rejected") {
      const logErr = recordSupabaseSyncError(
        "loadStudyLogs",
        logsSettled.reason
      );
      if (!syncError) syncError = logErr;
    } else if (logsSettled.value.error) {
      const logErr = recordSupabaseSyncError(
        "loadStudyLogs",
        logsSettled.value.error
      );
      if (!syncError) syncError = logErr;
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

    const localSources = collectLocalMergeSources(
      todayStr,
      userId,
      activeUserId,
      options?.username,
      options?.inMemoryWords
    );

    let resolvedWords: WordEntry[] = localSources.localWords;
    let uploadedLocalCount = 0;
    let wordsUpsertFailedCount = 0;

    if (wordsOk) {
      const cloudWordsRaw = ((wordsSettled.value.data as WordEntry[]) ?? []).map(
        (w) => hydrateWordMetadata(w, userId)
      );
      const { mergedWords, wordsToUpsert, uploadedNewCount } =
        mergeCloudAndLocalWords(
          cloudWordsRaw,
          localSources.localWords,
          activeUserId,
          userId,
          Boolean(options?.forceUploadAll)
        );

      if (wordsToUpsert.length > 0) {
        const batchRes = await upsertWordsBatchToSupabase(
          supabase,
          wordsToUpsert,
          activeUserId,
          userId,
          options?.forceUploadAll ? "forceSyncWords" : "mergeLocalWords"
        );
        resolvedWords = reconcileWordsWithSavedMap(
          mergedWords,
          batchRes.savedByInputId
        );
        wordsUpsertFailedCount = batchRes.failedCount;
        uploadedLocalCount = options?.forceUploadAll
          ? batchRes.savedMap.size
          : Math.min(uploadedNewCount, batchRes.savedMap.size);

        if (batchRes.firstError && !syncError) {
          syncError = batchRes.firstError;
        }

        const confirmedIds = new Set<string>([
          ...cloudWordsRaw.map((w) => w.id),
          ...batchRes.savedMap.keys(),
        ]);
        writeSyncedWordIds(userId, confirmedIds);
      } else {
        resolvedWords = mergedWords;
        writeSyncedWordIds(
          userId,
          cloudWordsRaw.map((w) => w.id)
        );
      }

      writeLocalWords(resolvedWords, userId);

      if (wordsUpsertFailedCount === 0) {
        if (localSources.pendingGuestId) {
          clearPendingGuestUpgradeUserId();
        }
        if (localSources.legacyLocalUserId && typeof window !== "undefined") {
          window.localStorage.setItem(legacyUserMigratedKey(userId), "true");
        }
      }
    }

    let resolvedLogs: StudyLog[] = localSources.localLogs;
    if (logsOk) {
      const cloudLogsRaw = ((logsSettled.value.data as StudyLog[]) ?? []).map(
        (l) => ({
          ...l,
          vocab_today: l.vocab_today ?? l.words_added ?? 0,
          recall_today: l.recall_today ?? l.reviews_count ?? 0,
          ielts_today: l.ielts_today ?? 0,
          xp_earned: l.xp_earned ?? 0,
        })
      );

      const { mergedLogs, logsToUpsert } = mergeCloudAndLocalStudyLogs(
        cloudLogsRaw,
        localSources.localLogs,
        activeUserId
      );
      resolvedLogs = mergedLogs;

      for (const logPayload of logsToUpsert) {
        await upsertStudyLogCloud(activeUserId, logPayload);
      }

      writeLocalLogs(resolvedLogs, userId);
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
            cefr_level?: string | null;
            cefr_onboarding_completed?: boolean | null;
            updated_at?: string | null;
          } | null)
        : null;

    const ieltsRow =
      ieltsSettled.status === "fulfilled" && !ieltsSettled.value.error
        ? (ieltsSettled.value.data as {
            xp?: number;
            cefr_level?: string | null;
            placement_completed?: boolean | null;
            estimated_band?: number | null;
            updated_at?: string | null;
          } | null)
        : null;

    const cloudXp = Math.max(
      Number(profileRow?.xp ?? 0) || 0,
      Number(ieltsRow?.xp ?? 0) || 0,
      Number(cloudMeta.xp ?? 0) || 0
    );
    const derivedFromLogs = deriveXpFromLogs(resolvedLogs);
    const resolvedXp = Math.max(
      cloudXp,
      derivedFromLogs,
      localXp,
      localSources.localXp
    );
    writeLocalXp(userId, resolvedXp);

    const resolvedQuota = profileRow
      ? normalizeDailyQuota({
          wordsPerDay: profileRow.daily_words_quota,
          idiomsPerDay: profileRow.daily_idioms_quota,
          autoShowPopup: profileRow.auto_show_daily_pack,
          targetLevel:
            cloudMeta.dailyQuota?.targetLevel ?? localQuota.targetLevel,
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

    const guestUpgradeOnboarding = localSources.pendingGuestId
      ? readLocalCefrOnboarding(localSources.pendingGuestId)
      : null;
    const guestUpgradeIelts = localSources.pendingGuestId
      ? readLocalIeltsCefrSummary(localSources.pendingGuestId)
      : null;

    const placementCompleted = Boolean(
      ieltsRow?.placement_completed ||
        localIelts?.placement_completed ||
        guestUpgradeIelts?.placement_completed
    );

    const profileCefr = normalizeCefrLevel(profileRow?.cefr_level);
    const cloudMetaCefr = normalizeCefrLevel(cloudMeta.cefrLevel);
    const ieltsRowCefr = normalizeCefrLevel(ieltsRow?.cefr_level);
    const ieltsHasExplicitScore =
      Boolean(ieltsRow?.placement_completed) ||
      Number(ieltsRow?.estimated_band ?? 0) > 0;
    const ieltsUpdatedMs = Date.parse(ieltsRow?.updated_at ?? "") || 0;
    const profileUpdatedMs = Date.parse(profileRow?.updated_at ?? "") || 0;

    let resolvedCefrLevel: CefrLevel | null =
      profileCefr ??
      cloudMetaCefr ??
      (ieltsHasExplicitScore ? ieltsRowCefr ?? null : null) ??
      localOnboarding?.cefrLevel ??
      guestUpgradeOnboarding?.cefrLevel ??
      (localIelts?.placement_completed ||
      (localIelts?.estimated_band ?? 0) > 0
        ? localIelts?.cefr_level ?? null
        : null) ??
      (guestUpgradeIelts?.placement_completed ||
      (guestUpgradeIelts?.estimated_band ?? 0) > 0
        ? guestUpgradeIelts?.cefr_level ?? null
        : null);

    if (
      ieltsRowCefr &&
      (ieltsHasExplicitScore || Boolean(profileRow?.cefr_onboarding_completed)) &&
      ieltsUpdatedMs > profileUpdatedMs
    ) {
      resolvedCefrLevel = ieltsRowCefr;
    }

    const existingHistory = hasExistingVaultHistory(
      resolvedWords,
      resolvedLogs,
      resolvedXp,
      resolvedQuota,
      userId
    );
    const resolvedOnboardingCompleted = Boolean(
      localOnboarding?.completed ||
        guestUpgradeOnboarding?.completed ||
        profileRow?.cefr_onboarding_completed ||
        cloudMeta.cefrOnboardingCompleted ||
        placementCompleted ||
        resolvedCefrLevel ||
        existingHistory
    );

    if (resolvedOnboardingCompleted && !localOnboarding?.completed) {
      writeLocalCefrOnboarding(userId, {
        completed: true,
        cefrLevel: resolvedCefrLevel ?? undefined,
      });
    }
    if (resolvedCefrLevel) {
      writeLocalIeltsCefrLevel(userId, resolvedCefrLevel);
    }

    if (options?.forceUploadAll || resolvedXp > cloudXp) {
      await saveCloudUserSettings(activeUserId, {
        dailyQuota: resolvedQuota,
        ringTargets: resolvedRings,
        xp: resolvedXp,
        cefrLevel: resolvedCefrLevel ?? undefined,
        cefrOnboardingCompleted: resolvedOnboardingCompleted,
      });
    }

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
      if (options?.forceUploadAll) {
        await saveDailyPack(resolvedPack, activeUserId);
      }
    }

    if (resolvedPack) {
      writeLocalDailyPack(resolvedPack, userId);
    }

    const cloudReachable = wordsOk && wordsUpsertFailedCount === 0;
    if (cloudReachable && !syncError) {
      clearLastSupabaseSyncError();
    }

    return {
      words: resolvedWords,
      studyLogs: resolvedLogs,
      xp: resolvedXp,
      dailyQuota: resolvedQuota,
      ringTargets: resolvedRings,
      dailyPack: resolvedPack,
      cefrLevel: resolvedCefrLevel,
      cefrOnboardingCompleted: resolvedOnboardingCompleted,
      placementCompleted,
      syncMode: cloudReachable ? "supabase" : "local",
      cloudReachable,
      syncError,
      uploadedLocalCount,
    };
  }

  const localWords = readLocalWords(todayStr, userId, true);
  const localLogs = readLocalLogs(userId);
  const localPlacementDone = Boolean(localIelts?.placement_completed);
  const localCefrLevel =
    localOnboarding?.cefrLevel ??
    (localPlacementDone || (localIelts?.estimated_band ?? 0) > 0
      ? localIelts?.cefr_level ?? null
      : null);
  const localHistoryExists = hasExistingVaultHistory(
    localWords,
    localLogs,
    localXp,
    localQuota,
    userId
  );
  const localOnboardingDone = Boolean(
    localOnboarding?.completed ||
      localPlacementDone ||
      localCefrLevel ||
      localHistoryExists
  );
  if (localOnboardingDone && !localOnboarding?.completed) {
    writeLocalCefrOnboarding(userId, {
      completed: true,
      cefrLevel: localCefrLevel ?? undefined,
    });
  }

  return {
    words: localWords,
    studyLogs: localLogs,
    xp: localXp,
    dailyQuota: localQuota,
    ringTargets: localRings,
    dailyPack: localPack,
    cefrLevel: localCefrLevel,
    cefrOnboardingCompleted: localOnboardingDone,
    placementCompleted: localPlacementDone,
    syncMode: "local",
    cloudReachable: false,
    syncError: null,
    uploadedLocalCount: 0,
  };
}

export interface ForceSyncResult {
  ok: boolean;
  state: HydratedCloudState;
  uploadedCount: number;
  totalWords: number;
  error: SupabaseSyncErrorInfo | null;
}

export async function forceSyncVaultToCloud(
  todayStr: string,
  userId: string,
  options?: { username?: string; inMemoryWords?: WordEntry[] }
): Promise<ForceSyncResult> {
  const state = await loadInitialData(todayStr, userId, {
    username: options?.username,
    inMemoryWords: options?.inMemoryWords,
    forceUploadAll: true,
  });

  const ok = state.cloudReachable && !state.syncError;
  return {
    ok,
    state,
    uploadedCount: state.uploadedLocalCount,
    totalWords: state.words.length,
    error: state.syncError,
  };
}

export async function saveCloudUserSettings(
  userId: string,
  settings: {
    dailyQuota?: DailyQuotaSettings;
    ringTargets?: DailyRingTargets;
    xp?: number;
    cefrLevel?: CefrLevel;
    cefrOnboardingCompleted?: boolean;
    syncIeltsProfile?: boolean;
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

  const existingOnboarding = readLocalCefrOnboarding(userId);
  const nextCefr = normalizeCefrLevel(
    settings.cefrLevel ?? existingOnboarding?.cefrLevel
  );
  const nextOnboardingDone =
    typeof settings.cefrOnboardingCompleted === "boolean"
      ? settings.cefrOnboardingCompleted
      : existingOnboarding?.completed;

  if (settings.cefrLevel || typeof settings.cefrOnboardingCompleted === "boolean") {
    writeLocalCefrOnboarding(userId, {
      completed: Boolean(nextOnboardingDone),
      cefrLevel: nextCefr,
    });
  }
  if (settings.syncIeltsProfile && settings.cefrLevel) {
    writeLocalIeltsCefrLevel(userId, settings.cefrLevel);
  }

  const supabase = getScopedSupabase(userId);
  if (!supabase) return false;

  const nowIso = new Date().toISOString();
  const rankInfo = getMasteryRankInfo(nextXp);
  let synced = false;

  const baseProfilePayload = {
    user_id: userId,
    xp: nextXp,
    mastery_rank: rankInfo.rank,
    daily_words_quota: nextQuota.wordsPerDay,
    daily_idioms_quota: nextQuota.idiomsPerDay,
    auto_show_daily_pack: nextQuota.autoShowPopup,
    ring_targets_json: nextRings,
    updated_at: nowIso,
  };

  const extendedProfilePayload = {
    ...baseProfilePayload,
    ...(nextCefr ? { cefr_level: nextCefr } : {}),
    ...(typeof nextOnboardingDone === "boolean"
      ? { cefr_onboarding_completed: nextOnboardingDone }
      : {}),
  };

  try {
    let { error } = await supabase
      .from("user_profiles")
      .upsert(extendedProfilePayload, { onConflict: "user_id" });
    if (error && isMissingColumnError(error)) {
      const retry = await supabase
        .from("user_profiles")
        .upsert(baseProfilePayload, { onConflict: "user_id" });
      error = retry.error;
    }
    if (!error) {
      synced = true;
    } else {
      console.error(
        "[LexiVault][SupabaseSync] user_profiles upsert failed:",
        extractPostgrestFields(error)
      );
    }
  } catch (err) {
    console.error(
      "[LexiVault][SupabaseSync] user_profiles exception:",
      extractPostgrestFields(err)
    );
  }

  if (settings.syncIeltsProfile && settings.cefrLevel) {
    try {
      await supabase.from("ielts_profiles").upsert(
        {
          user_id: userId,
          cefr_level: settings.cefrLevel,
          updated_at: nowIso,
        },
        { onConflict: "user_id" }
      );
    } catch {
      // Non-fatal: user_profiles & auth user_metadata also carry cefrLevel
    }
  }

  // Always mirror compact cloud settings & XP to Supabase Auth user_metadata so
  // settings & XP sync across devices even before SQL migration is applied.
  const mirrored = await mirrorCloudMetadataToAuth(userId, {
    xp: nextXp,
    dailyQuota: nextQuota,
    ringTargets: nextRings,
    cefrLevel: nextCefr,
    cefrOnboardingCompleted: nextOnboardingDone,
  });

  return synced || mirrored;
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
    const activeUserId = await resolveActiveSupabaseUserId(
      supabase,
      userId,
      "seedStarterWords"
    );
    if (!activeUserId) return;

    const { count, error } = await supabase
      .from("words")
      .select("id", { count: "exact", head: true })
      .eq("user_id", activeUserId);
    if (error) {
      recordSupabaseSyncError("seedStarterWords", error);
      return;
    }
    if ((count ?? 0) > 0) return;

    const starters = buildInitialMockWords(todayStr);
    await upsertWordsBatchToSupabase(
      supabase,
      starters,
      activeUserId,
      userId,
      "seedStarterWords"
    );
  } catch (err) {
    recordSupabaseSyncError("seedStarterWords", err);
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
    const activeUserId = await resolveActiveSupabaseUserId(
      supabase,
      userId,
      "saveWordEntry"
    );
    if (activeUserId) {
      const { saved } = await upsertWordToSupabase(
        supabase,
        { ...word, source_tag: canonicalSource },
        activeUserId,
        userId,
        "saveWordEntry"
      );

      if (saved) {
        writeReviewMeta(userId, saved);
        const cached = readLocalWords(
          saved.created_at.slice(0, 10),
          userId,
          false
        );
        writeLocalWords(
          [
            saved,
            ...cached.filter(
              (item) => item.id !== saved.id && item.id !== word.id
            ),
          ],
          userId
        );
        return saved;
      }
    }
  }

  const scopedWord: WordEntry = hydrateWordMetadata(
    sanitizeWordForCloud({ ...word, source_tag: canonicalSource }, userId),
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
    ...current.filter(
      (item) => item.id !== scopedWord.id && item.id !== word.id
    ),
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
  if (supabase) {
    const activeUserId = await resolveActiveSupabaseUserId(
      supabase,
      userId,
      "updateWordEntry"
    );
    if (activeUserId) {
      const { saved } = await upsertWordToSupabase(
        supabase,
        word,
        activeUserId,
        userId,
        "updateWordEntry"
      );

      if (saved) {
        writeReviewMeta(userId, saved);
        const current = readLocalWords(
          saved.created_at.slice(0, 10),
          userId,
          false
        );
        const exists = current.some(
          (w) => w.id === saved.id || w.id === word.id
        );
        writeLocalWords(
          exists
            ? current.map((w) =>
                w.id === saved.id || w.id === word.id ? saved : w
              )
            : [saved, ...current],
          userId
        );
        return saved;
      }
    }
  }

  const scoped: WordEntry = hydrateWordMetadata(
    sanitizeWordForCloud(word, userId),
    userId
  );
  writeReviewMeta(userId, scoped);
  const current = readLocalWords(
    scoped.created_at.slice(0, 10),
    userId,
    isLocalOnlyUserId(userId)
  );
  const updated = current.map((w) =>
    w.id === scoped.id || w.id === word.id ? scoped : w
  );
  writeLocalWords(updated, userId);
  return scoped;
}

export async function deleteWordEntry(
  id: string,
  userId: string
): Promise<void> {
  const supabase = getScopedSupabase(userId);
  if (supabase && isValidUuid(id)) {
    const activeUserId = await resolveActiveSupabaseUserId(
      supabase,
      userId,
      "deleteWordEntry"
    );
    if (activeUserId) {
      try {
        const { error } = await supabase
          .from("words")
          .delete()
          .eq("id", id)
          .eq("user_id", activeUserId);
        if (error) {
          recordSupabaseSyncError("deleteWordEntry", error);
        } else {
          removeSyncedWordId(userId, id);
          clearLastSupabaseSyncError();
        }
      } catch (err) {
        recordSupabaseSyncError("deleteWordEntry", err);
      }
    }
  } else {
    removeSyncedWordId(userId, id);
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
    const activeUserId = await resolveActiveSupabaseUserId(
      supabase,
      userId,
      "updateWordAudioUrls"
    );
    if (activeUserId) {
      try {
        const { error } = await supabase
          .from("words")
          .update(patch)
          .eq("id", id)
          .eq("user_id", activeUserId);
        if (error && !isMissingColumnError(error)) {
          recordSupabaseSyncError("updateWordAudioUrls", error);
        }
      } catch (err) {
        recordSupabaseSyncError("updateWordAudioUrls", err);
      }
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
  const xpDelta = isCorrect ? 15 : 0;
  const nextReviewCount = getEffectiveReviewCount(word) + 1;
  const prevRepetitions =
    typeof word.repetitions === "number" && Number.isFinite(word.repetitions)
      ? Math.max(0, Math.floor(word.repetitions))
      : 0;
  const nextRepetitions = isCorrect ? prevRepetitions + 1 : 0;
  const updatedWord: WordEntry = {
    ...word,
    user_id: userId,
    correct_count: word.correct_count + (isCorrect ? 1 : 0),
    wrong_count: word.wrong_count + (isCorrect ? 0 : 1),
    last_practiced_at: nowIso,
    review_count: nextReviewCount,
    last_reviewed_date: isCorrect ? todayStr : word.last_reviewed_date ?? null,
    repetitions: nextRepetitions,
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
      const activeUserId = await resolveActiveSupabaseUserId(
        supabase,
        userId,
        "recordPracticeAttempt"
      );
      if (activeUserId) {
        if (word.meaning_id?.trim()) {
          await upsertWordToSupabase(
            supabase,
            updatedWord,
            activeUserId,
            userId,
            "recordPracticeAttempt"
          );
        }

        const { data: existingLog, error: logReadErr } = await supabase
          .from("study_logs")
          .select("*")
          .eq("user_id", activeUserId)
          .eq("study_date", todayStr)
          .maybeSingle();

        if (logReadErr) {
          recordSupabaseSyncError("recordPracticeAttempt:readLog", logReadErr);
        }

        const localExisting = readLocalLogs(userId).find(
          (l) => l.study_date === todayStr
        );
        const baseLog = existingLog ?? localExisting;

        const nextLogPayload = {
          user_id: activeUserId,
          study_date: todayStr,
          reviews_count: (baseLog?.reviews_count ?? 0) + 1,
          correct_count: (baseLog?.correct_count ?? 0) + (isCorrect ? 1 : 0),
          wrong_count: (baseLog?.wrong_count ?? 0) + (isCorrect ? 0 : 1),
          words_added: baseLog?.words_added ?? 0,
          vocab_today: baseLog?.vocab_today ?? baseLog?.words_added ?? 0,
          recall_today:
            (baseLog?.recall_today ?? baseLog?.reviews_count ?? 0) + 1,
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
      }
    } catch (err) {
      recordSupabaseSyncError("recordPracticeAttempt", err);
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
    rating === "easy" ? 20 : rating === "good" ? 15 : rating === "hard" ? 10 : 0;
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
      const activeUserId = await resolveActiveSupabaseUserId(
        supabase,
        userId,
        "recordSm2ReviewAttempt"
      );
      if (activeUserId) {
        await upsertWordToSupabase(
          supabase,
          updatedWord,
          activeUserId,
          userId,
          "recordSm2ReviewAttempt"
        );

        const { data: existingLog, error: logReadErr } = await supabase
          .from("study_logs")
          .select("*")
          .eq("user_id", activeUserId)
          .eq("study_date", todayStr)
          .maybeSingle();

        if (logReadErr) {
          recordSupabaseSyncError("recordSm2ReviewAttempt:readLog", logReadErr);
        }

        const localExisting = readLocalLogs(userId).find(
          (l) => l.study_date === todayStr
        );
        const baseLog = existingLog ?? localExisting;

        const nextLogPayload = {
          user_id: activeUserId,
          study_date: todayStr,
          reviews_count: (baseLog?.reviews_count ?? 0) + 1,
          correct_count: (baseLog?.correct_count ?? 0) + (isCorrect ? 1 : 0),
          wrong_count: (baseLog?.wrong_count ?? 0) + (isCorrect ? 0 : 1),
          words_added: baseLog?.words_added ?? 0,
          vocab_today: baseLog?.vocab_today ?? baseLog?.words_added ?? 0,
          recall_today:
            (baseLog?.recall_today ?? baseLog?.reviews_count ?? 0) + 1,
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
      }
    } catch (err) {
      recordSupabaseSyncError("recordSm2ReviewAttempt", err);
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
      cefrLevel?: CefrLevel;
      cefrOnboardingCompleted?: boolean;
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
          const { data, error } = await supabase
            .from("words")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
          if (error) {
            recordSupabaseSyncError("realtimeWordsRefresh", error);
            return;
          }
          if (data) {
            const cloudWords = (data as WordEntry[]).map((w) =>
              hydrateWordMetadata(w, userId)
            );
            const localCached = readLocalWords(todayStr, userId, false);
            const { mergedWords } = mergeCloudAndLocalWords(
              cloudWords,
              localCached,
              userId,
              userId,
              false
            );
            writeSyncedWordIds(
              userId,
              cloudWords.map((w) => w.id)
            );
            writeLocalWords(mergedWords, userId);
            callbacks.onWordsRefresh(mergedWords);
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
              cefr_level?: string | null;
              cefr_onboarding_completed?: boolean | null;
            };
            const refreshedCefr = normalizeCefrLevel(row.cefr_level);
            callbacks.onProfileRefresh({
              xp: typeof row.xp === "number" ? row.xp : undefined,
              dailyQuota: normalizeDailyQuota({
                wordsPerDay: row.daily_words_quota,
                idiomsPerDay: row.daily_idioms_quota,
                autoShowPopup: row.auto_show_daily_pack,
                targetLevel: readLocalDailyQuota(userId).targetLevel,
              }),
              ringTargets: row.ring_targets_json
                ? normalizeRingTargets(row.ring_targets_json)
                : DAILY_RING_TARGETS,
              cefrLevel: refreshedCefr,
              cefrOnboardingCompleted:
                typeof row.cefr_onboarding_completed === "boolean"
                  ? row.cefr_onboarding_completed
                  : undefined,
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
