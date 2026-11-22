import type {
  DailyDiscoveryPack,
  DiscoveryItem,
  Sm2Rating,
  StudyLog,
  SyncMode,
  WordEntry,
} from "@/types/lexivault";
import { isLocalOnlyUserId } from "@/lib/auth";
import { getMasteryRankInfo } from "@/lib/gamification";
import { buildInitialMockWords } from "@/lib/mockData";
import {
  cacheWordPronunciation,
  resolveWordPronunciation,
} from "@/lib/pronunciation";
import { calculateSm2Next } from "@/lib/sm2";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { isValidUuid } from "@/lib/utils";

function getScopedSupabase(userId: string) {
  if (isLocalOnlyUserId(userId) || !isSupabaseConfigured()) return null;
  return getSupabaseClient();
}

const wordsKey = (userId: string) => `lexivault_words_v2_${userId}`;
const logsKey = (userId: string) => `lexivault_study_logs_v2_${userId}`;
const discoverKey = (userId: string) => `lexivault_discoveries_v2_${userId}`;
const demoClearedKey = (userId: string) => `lexivault_demo_cleared_v2_${userId}`;
const xpKey = (userId: string) => `lexivault_xp_v1_${userId}`;

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function hydrateWordPronunciation(word: WordEntry): WordEntry {
  const resolved = resolveWordPronunciation(
    word.term,
    word.pronunciation,
    word.ipa
  );
  if (!resolved.pronunciation && !resolved.ipa) return word;
  return {
    ...word,
    pronunciation: resolved.pronunciation ?? undefined,
    ipa: resolved.ipa ?? undefined,
  };
}

function readLocalWords(todayStr: string, userId: string): WordEntry[] {
  if (typeof window === "undefined") return [];
  const key = wordsKey(userId);
  const raw = window.localStorage.getItem(key);
  const demoCleared =
    window.localStorage.getItem(demoClearedKey(userId)) === "true";

  if (raw === null) {
    if (demoCleared) return [];
    const seeded = buildInitialMockWords(todayStr).map((w) => ({
      ...w,
      user_id: userId,
    }));
    window.localStorage.setItem(key, JSON.stringify(seeded));
    return seeded;
  }

  const parsed = safeParseJson<WordEntry[]>(raw);
  return Array.isArray(parsed) ? parsed.map(hydrateWordPronunciation) : [];
}

function writeLocalWords(words: WordEntry[], userId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(wordsKey(userId), JSON.stringify(words));
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
  window.localStorage.setItem(logsKey(userId), JSON.stringify(logs));
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

export async function loadInitialData(
  todayStr: string,
  userId: string
): Promise<{
  words: WordEntry[];
  studyLogs: StudyLog[];
  syncMode: SyncMode;
}> {
  const supabase = getScopedSupabase(userId);
  if (supabase) {
    try {
      const [wordsRes, logsRes] = await Promise.all([
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
      ]);

      if (wordsRes.error || logsRes.error) {
        throw new Error(wordsRes.error?.message || logsRes.error?.message);
      }

      return {
        words: ((wordsRes.data as WordEntry[]) ?? []).map(
          hydrateWordPronunciation
        ),
        studyLogs: (logsRes.data as StudyLog[]) ?? [],
        syncMode: "supabase",
      };
    } catch {
      return {
        words: readLocalWords(todayStr, userId),
        studyLogs: readLocalLogs(userId),
        syncMode: "local",
      };
    }
  }

  return {
    words: readLocalWords(todayStr, userId),
    studyLogs: readLocalLogs(userId),
    syncMode: "local",
  };
}

export async function saveWordEntry(
  word: WordEntry,
  userId: string
): Promise<WordEntry> {
  cacheWordPronunciation(word.term, word.pronunciation, word.ipa);

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
        source_tag: word.source_tag,
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
      const extendedPayload = {
        ...basePayload,
        pronunciation: word.pronunciation ?? null,
        ipa: word.ipa ?? null,
      };

      let { data, error } = await supabase
        .from("words")
        .insert(extendedPayload)
        .select("*")
        .single();

      // Gracefully retry without pronunciation/ipa columns if remote DB schema hasn't added them yet
      if (error) {
        const retry = await supabase
          .from("words")
          .insert(basePayload)
          .select("*")
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (!error && data) {
        return hydrateWordPronunciation({
          ...(data as WordEntry),
          pronunciation: (data as WordEntry).pronunciation || word.pronunciation,
          ipa: (data as WordEntry).ipa || word.ipa,
        });
      }
    } catch {
      // Fallback to local
    }
  }

  const scopedWord: WordEntry = hydrateWordPronunciation({
    ...word,
    user_id: userId,
  });
  const current = readLocalWords(scopedWord.created_at.slice(0, 10), userId);
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
        })
        .eq("id", word.id)
        .eq("user_id", userId)
        .select("*")
        .single();

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
        return hydrateWordPronunciation({
          ...(data as WordEntry),
          pronunciation: (data as WordEntry).pronunciation || word.pronunciation,
          ipa: (data as WordEntry).ipa || word.ipa,
        });
      }
    } catch {
      // Fallback to local
    }
  }

  const scoped: WordEntry = hydrateWordPronunciation({
    ...word,
    user_id: userId,
  });
  const current = readLocalWords(scoped.created_at.slice(0, 10), userId);
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
      return;
    } catch {
      // Fallback below
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
      return;
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
  if (typeof window !== "undefined") {
    const raw = Number(window.localStorage.getItem(xpKey(userId)) ?? "0");
    const localVal = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;

    const supabase = getScopedSupabase(userId);
    if (supabase) {
      try {
        const { data } = await supabase
          .from("ielts_profiles")
          .select("xp")
          .eq("user_id", userId)
          .maybeSingle();
        if (data && typeof data.xp === "number") {
          const cloudXp = Math.max(localVal, Math.round(data.xp));
          window.localStorage.setItem(xpKey(userId), String(cloudXp));
          return cloudXp;
        }
      } catch {
        // Fallback to localVal
      }
    }
    return localVal;
  }
  return 0;
}

export async function addUserXp(
  userId: string,
  xpDelta: number
): Promise<number> {
  const current = await loadUserXp(userId);
  const nextXp = Math.max(0, current + Math.round(xpDelta));
  if (typeof window !== "undefined") {
    window.localStorage.setItem(xpKey(userId), String(nextXp));
  }

  const supabase = getScopedSupabase(userId);
  if (supabase) {
    try {
      const rankInfo = getMasteryRankInfo(nextXp);
      await supabase.from("ielts_profiles").upsert(
        {
          user_id: userId,
          xp: nextXp,
          mastery_rank: rankInfo.rank,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    } catch {
      // LocalStorage already updated
    }
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
  const updatedWord: WordEntry = {
    ...word,
    user_id: userId,
    correct_count: word.correct_count + (isCorrect ? 1 : 0),
    wrong_count: word.wrong_count + (isCorrect ? 0 : 1),
    last_practiced_at: nowIso,
  };

  const supabase = getScopedSupabase(userId);
  if (supabase) {
    try {
      if (isValidUuid(word.id)) {
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

      const { data: existingLog } = await supabase
        .from("study_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("study_date", todayStr)
        .maybeSingle();

      const nextLogPayload = {
        user_id: userId,
        study_date: todayStr,
        reviews_count: (existingLog?.reviews_count ?? 0) + 1,
        correct_count: (existingLog?.correct_count ?? 0) + (isCorrect ? 1 : 0),
        wrong_count: (existingLog?.wrong_count ?? 0) + (isCorrect ? 0 : 1),
        words_added: existingLog?.words_added ?? 0,
        vocab_today: existingLog?.vocab_today ?? existingLog?.words_added ?? 0,
        recall_today:
          (existingLog?.recall_today ?? existingLog?.reviews_count ?? 0) + 1,
        ielts_today: existingLog?.ielts_today ?? 0,
        xp_earned: (existingLog?.xp_earned ?? 0) + xpDelta,
        updated_at: nowIso,
      };

      const { data: savedLog } = await supabase
        .from("study_logs")
        .upsert(nextLogPayload, { onConflict: "user_id,study_date" })
        .select("*")
        .single();

      if (savedLog) {
        const newXp = await addUserXp(userId, xpDelta);
        return { updatedWord, updatedLog: savedLog as StudyLog, newXp };
      }
    } catch {
      // Fallback to local
    }
  }

  const localWords = readLocalWords(todayStr, userId).map((w) =>
    w.id === word.id ? updatedWord : w
  );
  writeLocalWords(localWords, userId);

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

  const nextLogs = [
    updatedLog,
    ...logs.filter((l) => l.study_date !== todayStr),
  ];
  writeLocalLogs(nextLogs, userId);
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

  const updatedWord: WordEntry = {
    ...word,
    user_id: userId,
    correct_count: word.correct_count + (isCorrect ? 1 : 0),
    wrong_count: word.wrong_count + (isCorrect ? 0 : 1),
    last_practiced_at: nowIso,
    next_review_at: sm2.next_review_at,
    interval_days: sm2.interval_days,
    ease_factor: sm2.ease_factor,
    repetitions: sm2.repetitions,
  };

  const supabase = getScopedSupabase(userId);
  if (supabase) {
    try {
      if (isValidUuid(word.id)) {
        await supabase
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
      }

      const { data: existingLog } = await supabase
        .from("study_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("study_date", todayStr)
        .maybeSingle();

      const nextLogPayload = {
        user_id: userId,
        study_date: todayStr,
        reviews_count: (existingLog?.reviews_count ?? 0) + 1,
        correct_count: (existingLog?.correct_count ?? 0) + (isCorrect ? 1 : 0),
        wrong_count: (existingLog?.wrong_count ?? 0) + (isCorrect ? 0 : 1),
        words_added: existingLog?.words_added ?? 0,
        vocab_today: existingLog?.vocab_today ?? existingLog?.words_added ?? 0,
        recall_today:
          (existingLog?.recall_today ?? existingLog?.reviews_count ?? 0) + 1,
        ielts_today: existingLog?.ielts_today ?? 0,
        xp_earned: (existingLog?.xp_earned ?? 0) + xpDelta,
        updated_at: nowIso,
      };

      const { data: savedLog } = await supabase
        .from("study_logs")
        .upsert(nextLogPayload, { onConflict: "user_id,study_date" })
        .select("*")
        .single();

      if (savedLog) {
        const newXp = await addUserXp(userId, xpDelta);
        return { updatedWord, updatedLog: savedLog as StudyLog, newXp };
      }
    } catch {
      // Fallback to local
    }
  }

  const localWords = readLocalWords(todayStr, userId).map((w) =>
    w.id === word.id ? updatedWord : w
  );
  writeLocalWords(localWords, userId);

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
  count = 1
): Promise<{ updatedLog: StudyLog; newXp: number }> {
  const nowIso = new Date().toISOString();
  const safeCount = Math.max(1, count);
  const xpDelta = 15 * safeCount;
  const supabase = getScopedSupabase(userId);
  if (supabase) {
    try {
      const { data: existing } = await supabase
        .from("study_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("study_date", todayStr)
        .maybeSingle();

      const payload = {
        user_id: userId,
        study_date: todayStr,
        reviews_count: existing?.reviews_count ?? 0,
        correct_count: existing?.correct_count ?? 0,
        wrong_count: existing?.wrong_count ?? 0,
        words_added: (existing?.words_added ?? 0) + safeCount,
        vocab_today:
          (existing?.vocab_today ?? existing?.words_added ?? 0) + safeCount,
        recall_today: existing?.recall_today ?? existing?.reviews_count ?? 0,
        ielts_today: existing?.ielts_today ?? 0,
        xp_earned: (existing?.xp_earned ?? 0) + xpDelta,
        updated_at: nowIso,
      };

      const { data: saved } = await supabase
        .from("study_logs")
        .upsert(payload, { onConflict: "user_id,study_date" })
        .select("*")
        .single();

      if (saved) {
        const newXp = await addUserXp(userId, xpDelta);
        return { updatedLog: saved as StudyLog, newXp };
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
        words_added: existing.words_added + safeCount,
        vocab_today:
          (existing.vocab_today ?? existing.words_added ?? 0) + safeCount,
        recall_today: existing.recall_today ?? existing.reviews_count ?? 0,
        ielts_today: existing.ielts_today ?? 0,
        xp_earned: (existing.xp_earned ?? 0) + xpDelta,
        updated_at: nowIso,
      }
    : {
        id: `local-log-${userId}-${todayStr}`,
        user_id: userId,
        study_date: todayStr,
        reviews_count: 0,
        correct_count: 0,
        wrong_count: 0,
        words_added: safeCount,
        vocab_today: safeCount,
        recall_today: 0,
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

      const payload = {
        user_id: userId,
        study_date: todayStr,
        reviews_count: (existing?.reviews_count ?? 0) + safeReviews,
        correct_count: (existing?.correct_count ?? 0) + safeCorrect,
        wrong_count: (existing?.wrong_count ?? 0) + safeWrong,
        words_added: existing?.words_added ?? 0,
        vocab_today: existing?.vocab_today ?? existing?.words_added ?? 0,
        recall_today: existing?.recall_today ?? existing?.reviews_count ?? 0,
        ielts_today: (existing?.ielts_today ?? 0) + ieltsSessions,
        xp_earned: (existing?.xp_earned ?? 0) + xpDelta,
        updated_at: nowIso,
      };

      const { data: saved } = await supabase
        .from("study_logs")
        .upsert(payload, { onConflict: "user_id,study_date" })
        .select("*")
        .single();

      if (saved) return saved as StudyLog;
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
          items: data.items_json as DiscoveryItem[],
          source: "supabase",
        };
      }
    } catch {
      // Fallback below
    }
  }

  return readLocalDiscoveryCache(dateStr, userId);
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
          if (data) callbacks.onWordsRefresh(data as WordEntry[]);
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
          if (data) callbacks.onLogsRefresh(data as StudyLog[]);
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
      callbacks.onWordsRefresh(readLocalWords(todayStr, userId));
    } else if (event.key === logsKey(userId)) {
      callbacks.onLogsRefresh(readLocalLogs(userId));
    }
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener("storage", handleStorage);
  };
}
