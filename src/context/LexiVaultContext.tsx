"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLanguage } from "@/context/LanguageContext";
import {
  changeUserPassword,
  continueAsGuestSession,
  getCurrentSessionUser,
  signInWithUsername,
  signOutUser,
  signUpWithUsername,
  subscribeAuthChanges,
} from "@/lib/auth";
import { prefetchPronunciation } from "@/lib/audioCache";
import {
  computeDailyRings,
  DAILY_RING_TARGETS,
  getMasteryRankInfo,
  readCustomRingTargets,
  writeCustomRingTargets,
  type DailyRingTargets,
  type MasteryRankInfo,
} from "@/lib/gamification";
import { getDueWords } from "@/lib/sm2";
import {
  isSfxMuted,
  playRingCompleteChord,
  setSfxMuted as persistSfxMuted,
} from "@/lib/soundEffects";
import {
  addUserXp,
  clearDemoData,
  deleteWordEntry,
  incrementWordsAddedLog,
  loadInitialData,
  loadUserXp,
  recordPracticeAttempt,
  recordSm2ReviewAttempt,
  saveWordEntry,
  seedStarterWordsForSupabaseUser,
  subscribeRealtimeSync,
  updateWordAudioUrls,
  updateWordEntry,
} from "@/lib/storage";
import {
  calculateStreak,
  getLocalDateString,
  normalizeSourceTag,
  normalizeTermKey,
} from "@/lib/utils";
import type {
  AccentType,
  AuthUser,
  AutofillPayload,
  CaptureToastState,
  DailyRingsProgress,
  DiscoveryItem,
  ExtractedVocabItem,
  PracticeMode,
  Sm2Rating,
  StudyLog,
  SuggestedWordItem,
  SyncMode,
  TabId,
  WordEntry,
} from "@/types/lexivault";

const ACCENT_STORAGE_KEY = "lexivault_accent_v1";

export interface PracticeLaunchRequest {
  mode: PracticeMode;
  customItems?: DiscoveryItem[];
  nonce: number;
}

interface AddWordResult {
  ok: boolean;
  duplicate?: boolean;
  word?: WordEntry;
  error?: string;
}

interface RefreshWordResult {
  ok: boolean;
  source?: "gemini" | "fallback";
  error?: string;
}

interface AuthActionResult {
  ok: boolean;
  error?: string;
}

interface LexiVaultContextValue {
  user: AuthUser | null;
  isAuthChecked: boolean;
  isHydrated: boolean;
  todayStr: string;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  accent: AccentType;
  setAccent: (accent: AccentType) => void;
  words: WordEntry[];
  studyLogs: StudyLog[];
  syncMode: SyncMode;
  streak: number;
  xp: number;
  masteryRankInfo: MasteryRankInfo;
  dailyRings: DailyRingsProgress;
  dueWordsCount: number;
  sfxMuted: boolean;
  toggleSfxMuted: () => void;
  hasDemoWords: boolean;
  streakFocusNonce: number;
  commuteLaunchNonce: number;
  openStreakCalendar: () => void;
  launchCommuteMode: () => void;
  clearCommuteLaunch: () => void;
  resetDemoData: () => Promise<void>;
  selectedWord: WordEntry | null;
  setSelectedWord: (word: WordEntry | null) => void;
  isCapturing: boolean;
  captureToast: CaptureToastState | null;
  clearCaptureToast: () => void;
  practiceLaunch: PracticeLaunchRequest | null;
  clearPracticeLaunch: () => void;
  launchPractice: (mode: PracticeMode, customItems?: DiscoveryItem[]) => void;
  addWordViaAI: (term: string, sourceTag: string) => Promise<AddWordResult>;
  addExtractedWordsBatch: (
    items: ExtractedVocabItem[],
    sourceTag: string
  ) => Promise<number>;
  addSuggestedWordToVault: (item: SuggestedWordItem) => Promise<WordEntry | null>;
  refreshWordWithAI: (wordId: string) => Promise<RefreshWordResult>;
  saveDiscoveryItemToVault: (item: DiscoveryItem) => Promise<WordEntry | null>;
  removeWord: (id: string) => Promise<void>;
  recordAnswer: (wordId: string, isCorrect: boolean) => Promise<void>;
  recordSm2Review: (wordId: string, rating: Sm2Rating) => Promise<void>;
  syncExternalStudyLog: (log: StudyLog, nextXp?: number) => void;
  grantXpAndSyncLog: (xpDelta: number, log?: StudyLog) => Promise<void>;
  updateWordAudioUrl: (
    wordId: string,
    accent: AccentType,
    url: string
  ) => void;
  authInitialMode: "login" | "register";
  continueAsGuest: () => void;
  ringTargets: DailyRingTargets;
  updateRingTargets: (patch: Partial<DailyRingTargets>) => void;
  resetRingTargets: () => void;
  changePassword: (newPassword: string) => Promise<AuthActionResult>;
  openRegisterFromGuest: () => Promise<void>;
  login: (
    username: string,
    password: string,
    rememberMe: boolean
  ) => Promise<AuthActionResult>;
  register: (
    username: string,
    password: string,
    rememberMe: boolean
  ) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
}

const LexiVaultContext = createContext<LexiVaultContextValue | null>(null);

export function LexiVaultProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { lang } = useLanguage();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authInitialMode, setAuthInitialMode] = useState<"login" | "register">(
    "login"
  );
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [todayStr, setTodayStr] = useState("2026-01-01");
  const [activeTab, setActiveTab] = useState<TabId>("vault");
  const [accent, setAccentState] = useState<AccentType>("US");
  const [words, setWords] = useState<WordEntry[]>([]);
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>([]);
  const [syncMode, setSyncMode] = useState<SyncMode>("local");
  const [xp, setXp] = useState(0);
  const [sfxMuted, setSfxMutedState] = useState(false);
  const [ringTargets, setRingTargets] = useState<DailyRingTargets>(
    DAILY_RING_TARGETS
  );
  const [selectedWord, setSelectedWord] = useState<WordEntry | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureToast, setCaptureToast] = useState<CaptureToastState | null>(
    null
  );
  const [practiceLaunch, setPracticeLaunch] =
    useState<PracticeLaunchRequest | null>(null);
  const [streakFocusNonce, setStreakFocusNonce] = useState(0);
  const [commuteLaunchNonce, setCommuteLaunchNonce] = useState(0);

  const launchNonceRef = useRef(0);
  const wordsRef = useRef<WordEntry[]>([]);
  wordsRef.current = words;
  const ringTargetsRef = useRef<DailyRingTargets>(ringTargets);
  ringTargetsRef.current = ringTargets;
  const prevRingsRef = useRef<DailyRingsProgress | null>(null);

  useEffect(() => {
    const localToday = getLocalDateString();
    setTodayStr(localToday);
    setSfxMutedState(isSfxMuted());
    setRingTargets(readCustomRingTargets());

    const savedAccent = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    if (savedAccent === "UK" || savedAccent === "US") {
      setAccentState(savedAccent);
    }

    let mounted = true;
    getCurrentSessionUser().then((sessionUser) => {
      if (!mounted) return;
      setUser(sessionUser);
      setIsAuthChecked(true);
    });

    const unsubAuth = subscribeAuthChanges((nextUser) => {
      setUser((prev) => {
        if (prev?.id === nextUser?.id && prev?.username === nextUser?.username) {
          return prev;
        }
        return nextUser;
      });
      setIsAuthChecked(true);
    });

    return () => {
      mounted = false;
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (!isAuthChecked) return;

    if (!user) {
      setWords([]);
      setStudyLogs([]);
      setXp(0);
      setSelectedWord(null);
      setIsHydrated(false);
      prevRingsRef.current = null;
      return;
    }

    let active = true;
    let unsubscribeSync: (() => void) | undefined;
    const localToday = getLocalDateString();
    setTodayStr(localToday);
    setIsHydrated(false);

    Promise.all([
      loadInitialData(localToday, user.id),
      loadUserXp(user.id),
    ]).then(([res, loadedXp]) => {
      if (!active) return;
      setWords(res.words);
      setStudyLogs(res.studyLogs);
      setSyncMode(res.syncMode);
      setXp(loadedXp);
      prevRingsRef.current = computeDailyRings(
        res.studyLogs,
        localToday,
        ringTargetsRef.current
      );
      setIsHydrated(true);

      unsubscribeSync = subscribeRealtimeSync(localToday, user.id, {
        onWordsRefresh: (freshWords) => setWords(freshWords),
        onLogsRefresh: (freshLogs) => setStudyLogs(freshLogs),
      });
    });

    return () => {
      active = false;
      unsubscribeSync?.();
    };
  }, [isAuthChecked, user]);

  const dailyRings = useMemo(
    () => computeDailyRings(studyLogs, todayStr, ringTargets),
    [studyLogs, todayStr, ringTargets]
  );

  // Trigger harmonic ring completion chord when a ring newly reaches 100%
  useEffect(() => {
    if (!isHydrated) return;
    const prev = prevRingsRef.current;
    prevRingsRef.current = dailyRings;
    if (!prev) return;

    const vocabClosed =
      prev.vocab < prev.vocabTarget &&
      dailyRings.vocab >= dailyRings.vocabTarget;
    const recallClosed =
      prev.recall < prev.recallTarget &&
      dailyRings.recall >= dailyRings.recallTarget;
    const ieltsClosed =
      prev.ielts < prev.ieltsTarget &&
      dailyRings.ielts >= dailyRings.ieltsTarget;

    if (vocabClosed || recallClosed || ieltsClosed) {
      playRingCompleteChord();
    }
  }, [dailyRings, isHydrated]);

  const toggleSfxMuted = useCallback(() => {
    setSfxMutedState((prev) => {
      const next = !prev;
      persistSfxMuted(next);
      return next;
    });
  }, []);

  const setAccent = useCallback((next: AccentType) => {
    setAccentState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, next);
    }
  }, []);

  const clearCaptureToast = useCallback(() => setCaptureToast(null), []);

  const updateWordAudioUrl = useCallback(
    (wordId: string, targetAccent: AccentType, url: string) => {
      if (!user) return;
      const patch =
        targetAccent === "UK"
          ? { audio_uk_url: url }
          : { audio_us_url: url };

      setWords((prev) =>
        prev.map((w) => (w.id === wordId ? { ...w, ...patch } : w))
      );
      setSelectedWord((prev) =>
        prev && prev.id === wordId ? { ...prev, ...patch } : prev
      );
      void updateWordAudioUrls(wordId, patch, user.id);
    },
    [user]
  );

  const preGenerateDualAudio = useCallback(
    (entry: WordEntry) => {
      for (const acc of ["US", "UK"] as const) {
        void prefetchPronunciation({
          text: entry.term,
          accent: acc,
          wordId: entry.id,
          onRemoteUrlDiscovered: (url) => {
            updateWordAudioUrl(entry.id, acc, url);
          },
        });
      }
    },
    [updateWordAudioUrl]
  );

  const addWordViaAI = useCallback(
    async (rawTerm: string, sourceTag: string): Promise<AddWordResult> => {
      const isEn = lang === "en";
      if (!user) {
        return {
          ok: false,
          error: isEn
            ? "Please sign in first."
            : "Silakan login terlebih dahulu.",
        };
      }

      const trimmed = rawTerm.trim();
      if (!trimmed) {
        return {
          ok: false,
          error: isEn
            ? "Please enter a word or idiom first."
            : "Masukkan kata atau idiom terlebih dahulu.",
        };
      }

      const normalized = normalizeTermKey(trimmed);
      const existing = wordsRef.current.find(
        (w) => normalizeTermKey(w.term) === normalized
      );
      if (existing) {
        setSelectedWord(existing);
        setCaptureToast({
          type: "info",
          message: isEn
            ? `"${existing.term}" is already in your Vault.`
            : `"${existing.term}" sudah ada di Vault.`,
        });
        return { ok: false, duplicate: true, word: existing };
      }

      setIsCapturing(true);
      setCaptureToast(null);
      try {
        const canonicalSource = normalizeSourceTag(sourceTag || "general");
        const res = await fetch("/api/autofill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            term: trimmed,
            sourceTag: canonicalSource,
            lang,
          }),
        });

        if (!res.ok) {
          let apiCode = "";
          let apiError = "";
          try {
            const errJson = (await res.json()) as {
              error?: string;
              code?: string;
            };
            apiCode = errJson.code ?? "";
            apiError = errJson.error ?? "";
          } catch {
            // Non-JSON error body
          }
          console.error(
            `[LexiVault] /api/autofill failed (HTTP ${res.status}, code=${apiCode || "unknown"}):`,
            apiError || res.statusText
          );
          const reasonSuffix =
            apiCode === "quota"
              ? isEn
                ? " (AI quota limit reached)"
                : " (batas kuota AI tercapai)"
              : apiCode === "auth"
                ? isEn
                  ? " (API authentication error)"
                  : " (kendala autentikasi API)"
                : apiCode === "network"
                  ? isEn
                    ? " (network timeout)"
                    : " (jaringan timeout)"
                  : "";
          const errMsg = isEn
            ? `Failed to save word. Please try again.${reasonSuffix}`
            : `Gagal menyimpan kata. Coba lagi.${reasonSuffix}`;
          setCaptureToast({ type: "error", message: errMsg });
          return { ok: false, error: errMsg };
        }

        const json = (await res.json()) as { data: AutofillPayload };
        const aiData = json.data;
        const nowIso = new Date().toISOString();

        const draft: WordEntry = {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `local-${Date.now()}`,
          user_id: user.id,
          term: aiData.term,
          pronunciation: aiData.pronunciation,
          ipa: aiData.ipa,
          cefr: aiData.cefr,
          type: aiData.type,
          meaning_id: aiData.meaning_id,
          meaning_en: aiData.meaning_en,
          examples_json: aiData.examples,
          synonyms: aiData.synonyms,
          antonyms: aiData.antonyms,
          word_families_json: aiData.word_families,
          register: aiData.register,
          source_tag: canonicalSource,
          audio_us_url: null,
          audio_uk_url: null,
          correct_count: 0,
          wrong_count: 0,
          last_practiced_at: null,
          next_review_at: nowIso,
          interval_days: 0,
          ease_factor: 2.5,
          repetitions: 0,
          created_at: nowIso,
        };

        const saved = await saveWordEntry(draft, user.id);
        setWords((prev) => [
          saved,
          ...prev.filter((w) => w.id !== saved.id),
        ]);

        const { updatedLog, newXp } = await incrementWordsAddedLog(
          todayStr,
          user.id,
          1
        );
        setStudyLogs((prev) => [
          updatedLog,
          ...prev.filter((l) => l.study_date !== updatedLog.study_date),
        ]);
        setXp(newXp);

        preGenerateDualAudio(saved);
        setCaptureToast({
          type: "success",
          message: isEn
            ? `"${saved.term}" saved (${saved.type} · ${saved.register})`
            : `"${saved.term}" tersimpan (${saved.type} · ${saved.register})`,
        });

        return { ok: true, word: saved };
      } catch (err) {
        console.error("[LexiVault] addWordViaAI network/client error:", err);
        const errMsg = isEn
          ? "Failed to save word. Please try again."
          : "Gagal menyimpan kata. Coba lagi.";
        setCaptureToast({ type: "error", message: errMsg });
        return { ok: false, error: errMsg };
      } finally {
        setIsCapturing(false);
      }
    },
    [lang, preGenerateDualAudio, todayStr, user]
  );

  const addExtractedWordsBatch = useCallback(
    async (items: ExtractedVocabItem[], sourceTag: string): Promise<number> => {
      if (!user || items.length === 0) return 0;
      const isEn = lang === "en";
      const canonicalSource = normalizeSourceTag(sourceTag || "article");

      const existingKeys = new Set(
        wordsRef.current.map((w) => normalizeTermKey(w.term))
      );
      const savedList: WordEntry[] = [];
      const nowIso = new Date().toISOString();

      for (const item of items) {
        const key = normalizeTermKey(item.term);
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);

        const draft: WordEntry = {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `local-ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          user_id: user.id,
          term: item.term,
          pronunciation: item.pronunciation,
          ipa: item.ipa,
          cefr: item.cefr,
          type: item.type,
          meaning_id: item.meaning_id,
          meaning_en: item.meaning_en,
          examples_json: item.examples,
          synonyms: item.synonyms,
          antonyms: item.antonyms,
          word_families_json: item.word_families,
          register: item.register,
          source_tag: canonicalSource,
          audio_us_url: null,
          audio_uk_url: null,
          correct_count: 0,
          wrong_count: 0,
          last_practiced_at: null,
          next_review_at: nowIso,
          interval_days: 0,
          ease_factor: 2.5,
          repetitions: 0,
          created_at: nowIso,
        };

        const saved = await saveWordEntry(draft, user.id);
        savedList.push(saved);
        preGenerateDualAudio(saved);
      }

      if (savedList.length > 0) {
        const savedIds = new Set(savedList.map((s) => s.id));
        setWords((prev) => [
          ...savedList,
          ...prev.filter((w) => !savedIds.has(w.id)),
        ]);

        const { updatedLog, newXp } = await incrementWordsAddedLog(
          todayStr,
          user.id,
          savedList.length
        );
        setStudyLogs((prev) => [
          updatedLog,
          ...prev.filter((l) => l.study_date !== updatedLog.study_date),
        ]);
        setXp(newXp);
        setCaptureToast({
          type: "success",
          message: isEn
            ? `${savedList.length} new expression(s) extracted to Vault`
            : `${savedList.length} kosakata baru diekstrak ke Vault`,
        });
      }

      return savedList.length;
    },
    [lang, preGenerateDualAudio, todayStr, user]
  );

  const addSuggestedWordToVault = useCallback(
    async (item: SuggestedWordItem): Promise<WordEntry | null> => {
      if (!user) return null;
      const isEn = lang === "en";
      const normalized = normalizeTermKey(item.term);
      const existing = wordsRef.current.find(
        (w) => normalizeTermKey(w.term) === normalized
      );
      if (existing) {
        return existing;
      }

      const nowIso = new Date().toISOString();
      const draft: WordEntry = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `local-sug-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: user.id,
        term: item.term,
        pronunciation: item.pronunciation,
        ipa: item.ipa,
        cefr: item.cefr,
        type: item.type,
        meaning_id: item.meaning_id,
        meaning_en: item.meaning_en,
        examples_json: item.examples,
        synonyms: item.synonyms,
        antonyms: item.antonyms,
        word_families_json: item.word_families,
        register: item.register,
        source_tag: normalizeSourceTag(item.source_tag || "article"),
        audio_us_url: null,
        audio_uk_url: null,
        correct_count: 0,
        wrong_count: 0,
        last_practiced_at: null,
        next_review_at: nowIso,
        interval_days: 0,
        ease_factor: 2.5,
        repetitions: 0,
        created_at: nowIso,
      };

      const saved = await saveWordEntry(draft, user.id);
      setWords((prev) => [saved, ...prev.filter((w) => w.id !== saved.id)]);

      const { updatedLog, newXp } = await incrementWordsAddedLog(
        todayStr,
        user.id,
        1
      );
      setStudyLogs((prev) => [
        updatedLog,
        ...prev.filter((l) => l.study_date !== updatedLog.study_date),
      ]);
      setXp(newXp);
      preGenerateDualAudio(saved);
      setCaptureToast({
        type: "success",
        message: isEn
          ? `"${saved.term}" added to your Vault`
          : `"${saved.term}" ditambahkan ke Vault`,
      });
      return saved;
    },
    [lang, preGenerateDualAudio, todayStr, user]
  );

  const refreshWordWithAI = useCallback(
    async (wordId: string): Promise<RefreshWordResult> => {
      const isEn = lang === "en";
      if (!user) {
        return {
          ok: false,
          error: isEn ? "Not signed in." : "Belum login.",
        };
      }
      const target = wordsRef.current.find((w) => w.id === wordId);
      if (!target) {
        return {
          ok: false,
          error: isEn ? "Word not found." : "Kata tidak ditemukan.",
        };
      }

      try {
        const res = await fetch("/api/autofill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            term: target.term,
            sourceTag: normalizeSourceTag(target.source_tag),
            lang,
          }),
        });
        if (!res.ok) throw new Error(`AI request failed (${res.status})`);

        const json = (await res.json()) as {
          data: AutofillPayload;
          source: "gemini" | "fallback";
        };
        const aiData = json.data;

        const merged: WordEntry = {
          ...target,
          term: aiData.term,
          pronunciation: aiData.pronunciation || target.pronunciation,
          ipa: aiData.ipa || target.ipa,
          cefr: aiData.cefr || target.cefr,
          type: aiData.type,
          meaning_id: aiData.meaning_id,
          meaning_en: aiData.meaning_en || target.meaning_en,
          examples_json: aiData.examples,
          synonyms: aiData.synonyms,
          antonyms: aiData.antonyms,
          word_families_json: aiData.word_families,
          register: aiData.register,
        };

        const updated = await updateWordEntry(merged, user.id);
        setWords((prev) =>
          prev.map((w) => (w.id === wordId ? updated : w))
        );
        setSelectedWord((prev) =>
          prev && prev.id === wordId ? updated : prev
        );

        return { ok: true, source: json.source };
      } catch (err) {
        console.error("[LexiVault] refreshWordWithAI failed:", err);
        return {
          ok: false,
          error: isEn
            ? "Failed to refresh details with AI."
            : "Gagal memperbarui dengan AI.",
        };
      }
    },
    [lang, user]
  );

  const saveDiscoveryItemToVault = useCallback(
    async (item: DiscoveryItem): Promise<WordEntry | null> => {
      if (!user) return null;
      const normalized = normalizeTermKey(item.term);
      const existing = wordsRef.current.find(
        (w) => normalizeTermKey(w.term) === normalized
      );
      if (existing) {
        return existing;
      }

      const nowIso = new Date().toISOString();
      const draft: WordEntry = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `local-disc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: user.id,
        term: item.term,
        pronunciation: item.pronunciation,
        ipa: item.ipa,
        cefr: item.cefr,
        type: item.type,
        meaning_id: item.meaning_id,
        meaning_en: item.meaning_en,
        examples_json: item.examples_json,
        synonyms: item.synonyms,
        antonyms: item.antonyms,
        word_families_json: item.word_families_json,
        register: item.register,
        source_tag: "discover",
        audio_us_url: null,
        audio_uk_url: null,
        correct_count: 0,
        wrong_count: 0,
        last_practiced_at: null,
        next_review_at: nowIso,
        interval_days: 0,
        ease_factor: 2.5,
        repetitions: 0,
        created_at: nowIso,
      };

      const saved = await saveWordEntry(draft, user.id);
      setWords((prev) => [saved, ...prev.filter((w) => w.id !== saved.id)]);

      const { updatedLog, newXp } = await incrementWordsAddedLog(
        todayStr,
        user.id,
        1
      );
      setStudyLogs((prev) => [
        updatedLog,
        ...prev.filter((l) => l.study_date !== updatedLog.study_date),
      ]);
      setXp(newXp);

      preGenerateDualAudio(saved);
      return saved;
    },
    [preGenerateDualAudio, todayStr, user]
  );

  const removeWord = useCallback(
    async (id: string) => {
      if (!user) return;
      setWords((prev) => prev.filter((w) => w.id !== id));
      setSelectedWord((prev) => (prev?.id === id ? null : prev));
      await deleteWordEntry(id, user.id);
    },
    [user]
  );

  const recordAnswer = useCallback(
    async (wordId: string, isCorrect: boolean) => {
      if (!user) return;
      const target = wordsRef.current.find((w) => w.id === wordId);
      if (!target) {
        const { updatedLog, newXp } = await recordPracticeAttempt(
          {
            id: wordId,
            user_id: user.id,
            term: wordId,
            type: "vocab",
            meaning_id: "",
            examples_json: [],
            synonyms: [],
            antonyms: [],
            word_families_json: [],
            register: "Formal",
            source_tag: "Discover",
            correct_count: 0,
            wrong_count: 0,
            created_at: new Date().toISOString(),
          },
          isCorrect,
          todayStr,
          user.id
        );
        setStudyLogs((prev) => [
          updatedLog,
          ...prev.filter((l) => l.study_date !== updatedLog.study_date),
        ]);
        setXp(newXp);
        return;
      }

      const { updatedWord, updatedLog, newXp } = await recordPracticeAttempt(
        target,
        isCorrect,
        todayStr,
        user.id
      );

      setWords((prev) =>
        prev.map((w) => (w.id === wordId ? updatedWord : w))
      );
      setSelectedWord((prev) =>
        prev && prev.id === wordId ? updatedWord : prev
      );
      setStudyLogs((prev) => [
        updatedLog,
        ...prev.filter((l) => l.study_date !== updatedLog.study_date),
      ]);
      setXp(newXp);
    },
    [todayStr, user]
  );

  const recordSm2Review = useCallback(
    async (wordId: string, rating: Sm2Rating) => {
      if (!user) return;
      const target = wordsRef.current.find((w) => w.id === wordId);
      if (!target) return;

      const { updatedWord, updatedLog, newXp } = await recordSm2ReviewAttempt(
        target,
        rating,
        todayStr,
        user.id
      );

      setWords((prev) =>
        prev.map((w) => (w.id === wordId ? updatedWord : w))
      );
      setSelectedWord((prev) =>
        prev && prev.id === wordId ? updatedWord : prev
      );
      setStudyLogs((prev) => [
        updatedLog,
        ...prev.filter((l) => l.study_date !== updatedLog.study_date),
      ]);
      setXp(newXp);
    },
    [todayStr, user]
  );

  const launchPractice = useCallback(
    (mode: PracticeMode, customItems?: DiscoveryItem[]) => {
      launchNonceRef.current += 1;
      setPracticeLaunch({
        mode,
        customItems,
        nonce: launchNonceRef.current,
      });
      setActiveTab("practice");
    },
    []
  );

  const clearPracticeLaunch = useCallback(() => {
    setPracticeLaunch(null);
  }, []);

  const syncExternalStudyLog = useCallback((log: StudyLog, nextXp?: number) => {
    setStudyLogs((prev) => [
      log,
      ...prev.filter((l) => l.study_date !== log.study_date),
    ]);
    if (typeof nextXp === "number") {
      setXp(nextXp);
    }
  }, []);

  const grantXpAndSyncLog = useCallback(
    async (xpDelta: number, log?: StudyLog) => {
      if (!user) return;
      if (log) {
        setStudyLogs((prev) => [
          log,
          ...prev.filter((l) => l.study_date !== log.study_date),
        ]);
      }
      if (xpDelta > 0) {
        const nextXp = await addUserXp(user.id, xpDelta);
        setXp(nextXp);
      }
    },
    [user]
  );

  const streak = useMemo(
    () => (isHydrated ? calculateStreak(studyLogs, todayStr) : 0),
    [isHydrated, studyLogs, todayStr]
  );

  const masteryRankInfo = useMemo(() => getMasteryRankInfo(xp), [xp]);

  const dueWordsCount = useMemo(
    () => (isHydrated ? getDueWords(words).length : 0),
    [isHydrated, words]
  );

  const hasDemoWords = useMemo(
    () => words.some((w) => w.id.startsWith("mock-word-")),
    [words]
  );

  const openStreakCalendar = useCallback(() => {
    setStreakFocusNonce((n) => n + 1);
    setActiveTab("stats");
  }, []);

  const launchCommuteMode = useCallback(() => {
    setCommuteLaunchNonce((n) => n + 1);
    setActiveTab("practice");
  }, []);

  const clearCommuteLaunch = useCallback(() => {
    setCommuteLaunchNonce(0);
  }, []);

  const resetDemoData = useCallback(async () => {
    if (!user) return;
    const cleaned = await clearDemoData(todayStr, user.id);
    setWords(cleaned.words);
    setStudyLogs(cleaned.studyLogs);
    setSelectedWord(null);
  }, [todayStr, user]);

  const updateRingTargets = useCallback((patch: Partial<DailyRingTargets>) => {
    setRingTargets((prev) => writeCustomRingTargets({ ...prev, ...patch }));
  }, []);

  const resetRingTargets = useCallback(() => {
    setRingTargets(writeCustomRingTargets(DAILY_RING_TARGETS));
  }, []);

  const changePassword = useCallback(
    async (newPassword: string): Promise<AuthActionResult> => {
      if (!user) {
        return {
          ok: false,
          error:
            lang === "en" ? "User is not signed in." : "Pengguna belum masuk.",
        };
      }
      return changeUserPassword(user, newPassword, lang);
    },
    [lang, user]
  );

  const continueAsGuest = useCallback(() => {
    const guest = continueAsGuestSession();
    setAuthInitialMode("login");
    setUser(guest);
    setActiveTab("vault");
  }, []);

  const openRegisterFromGuest = useCallback(async () => {
    await signOutUser();
    setAuthInitialMode("register");
    setUser(null);
    setWords([]);
    setStudyLogs([]);
    setXp(0);
    setSelectedWord(null);
    setActiveTab("vault");
  }, []);

  const login = useCallback(
    async (
      username: string,
      password: string,
      rememberMe: boolean
    ): Promise<AuthActionResult> => {
      const res = await signInWithUsername(
        username,
        password,
        rememberMe,
        lang
      );
      if (res.user) {
        setAuthInitialMode("login");
        setUser(res.user);
        setActiveTab("vault");
        return { ok: true };
      }
      return { ok: false, error: res.error };
    },
    [lang]
  );

  const register = useCallback(
    async (
      username: string,
      password: string,
      rememberMe: boolean
    ): Promise<AuthActionResult> => {
      const res = await signUpWithUsername(
        username,
        password,
        rememberMe,
        lang
      );
      if (res.user) {
        if (res.user.provider === "supabase") {
          await seedStarterWordsForSupabaseUser(
            getLocalDateString(),
            res.user.id
          );
        }
        setAuthInitialMode("login");
        setUser(res.user);
        setActiveTab("vault");
        return { ok: true };
      }
      return { ok: false, error: res.error };
    },
    [lang]
  );

  const logout = useCallback(async () => {
    await signOutUser();
    setAuthInitialMode("login");
    setUser(null);
    setWords([]);
    setStudyLogs([]);
    setXp(0);
    setSelectedWord(null);
    setActiveTab("vault");
  }, []);

  const value: LexiVaultContextValue = {
    user,
    isAuthChecked,
    isHydrated,
    todayStr,
    activeTab,
    setActiveTab,
    accent,
    setAccent,
    words,
    studyLogs,
    syncMode,
    streak,
    xp,
    masteryRankInfo,
    dailyRings,
    dueWordsCount,
    sfxMuted,
    toggleSfxMuted,
    hasDemoWords,
    streakFocusNonce,
    commuteLaunchNonce,
    openStreakCalendar,
    launchCommuteMode,
    clearCommuteLaunch,
    resetDemoData,
    selectedWord,
    setSelectedWord,
    isCapturing,
    captureToast,
    clearCaptureToast,
    practiceLaunch,
    clearPracticeLaunch,
    launchPractice,
    addWordViaAI,
    addExtractedWordsBatch,
    addSuggestedWordToVault,
    refreshWordWithAI,
    saveDiscoveryItemToVault,
    removeWord,
    recordAnswer,
    recordSm2Review,
    syncExternalStudyLog,
    grantXpAndSyncLog,
    updateWordAudioUrl,
    authInitialMode,
    ringTargets,
    updateRingTargets,
    resetRingTargets,
    changePassword,
    continueAsGuest,
    openRegisterFromGuest,
    login,
    register,
    logout,
  };

  return (
    <LexiVaultContext.Provider value={value}>
      {children}
    </LexiVaultContext.Provider>
  );
}

export function useLexiVault(): LexiVaultContextValue {
  const ctx = useContext(LexiVaultContext);
  if (!ctx) {
    throw new Error("useLexiVault must be used within LexiVaultProvider");
  }
  return ctx;
}
