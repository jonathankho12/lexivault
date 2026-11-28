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
import { useBrowserHistoryNav } from "@/hooks/useBrowserHistoryNav";
import {
  changeUserPassword,
  continueAsGuestSession,
  getCurrentSessionUser,
  signInWithUsername,
  signOutUser,
  signUpWithUsername,
  subscribeAuthChanges,
} from "@/lib/auth";
import {
  computeDailyRings,
  DAILY_RING_TARGETS,
  getMasteryRankInfo,
  readCustomRingTargets,
  writeCustomRingTargets,
  type DailyRingTargets,
  type MasteryRankInfo,
} from "@/lib/gamification";
import {
  computeCefrPromotionStatus,
  type CefrPromotionStatus,
} from "@/lib/cefrProgression";
import {
  getDailyPackTierMeta,
  resolveDailyPackTier,
} from "@/lib/dailyPackTiers";
import { TRANSLATIONS } from "@/lib/i18n";
import {
  applyLexiFeedTreatToState,
  applyLexiMilestoneTreatToState,
  applyLexiPetToState,
  DEFAULT_LEXI_COMPANION_STATE,
  formatLexiTemplate,
  getLexiBondInfo,
  hasUserMetLexi,
  isLexiHappyBoostActive,
  markUserMetLexi,
  readLexiCompanionState,
  writeLexiCompanionState,
  type LexiBondInfo,
  type LexiBondTierId,
  type LexiCheerReason,
  type LexiCheerState,
  type LexiCompanionState,
  type LexiMilestoneKey,
} from "@/lib/lexi";
import {
  getLatestRelease,
  hasUserSeenRelease,
  LEXI_COMPANION_RELEASE_ID,
  markReleaseSeen,
  type FeatureRelease,
} from "@/lib/releases";
import { loadIeltsState } from "@/lib/ieltsStorage";
import { getDueWords } from "@/lib/sm2";
import {
  isSfxMuted,
  playCorrectChime,
  playRingCompleteChord,
  setSfxMuted as persistSfxMuted,
} from "@/lib/soundEffects";
import {
  addUserXp,
  clearDemoData,
  clearLastSupabaseSyncError,
  DEFAULT_DAILY_QUOTA,
  deleteWordEntry,
  forceSyncVaultToCloud,
  getLastSupabaseSyncError,
  incrementWordsAddedLog,
  loadInitialData,
  normalizeDailyQuota,
  PENDING_GUEST_UPGRADE_KEY,
  readLocalCefrOnboarding,
  recordPracticeAttempt,
  recordSm2ReviewAttempt,
  recordWrongQuizLogOnly,
  saveCloudUserSettings,
  saveDailyPack,
  saveWordEntry,
  seedStarterWordsForSupabaseUser,
  subscribeRealtimeSync,
  subscribeSupabaseSyncErrors,
  updateWordAudioUrls,
  updateWordEntry,
  type SupabaseSyncErrorInfo,
} from "@/lib/storage";
import {
  calculateStreak,
  findLocalDuplicateWord,
  formatGeminiClientError,
  getLocalDateString,
  normalizeDuplicateKey,
  normalizeSourceTag,
  normalizeTermKey,
} from "@/lib/utils";
import type {
  AccentType,
  AuthUser,
  AutofillPayload,
  CaptureToastState,
  CefrLevel,
  CloudSyncStatus,
  DailyPackItem,
  DailyPackRecord,
  DailyPackTargetTier,
  DailyQuotaSettings,
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
const LEXI_ENABLED_STORAGE_KEY = "lexivault_lexi_enabled";
const pendingLexiIntroSessionKey = (userId: string) =>
  `lexivault_pending_lexi_intro_${userId}`;
const dailyDismissKey = (userId: string, dateStr: string) =>
  `lexivault_daily_dismissed_${userId}_${dateStr}`;

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
  aborted?: boolean;
  error?: string;
}

export interface BatchRefreshState {
  status: "idle" | "running" | "done" | "cancelled";
  currentIndex: number;
  completedCount: number;
  total: number;
  currentTerm: string;
  updatedCount: number;
  failedCount: number;
}

const INITIAL_BATCH_REFRESH_STATE: BatchRefreshState = {
  status: "idle",
  currentIndex: 0,
  completedCount: 0,
  total: 0,
  currentTerm: "",
  updatedCount: 0,
  failedCount: 0,
};

export interface RuBatchTranslateState {
  status: "idle" | "running" | "done" | "cancelled" | "rate_limited" | "error";
  completedCount: number;
  total: number;
  translatedCount: number;
  failedCount: number;
  error?: string;
}

const INITIAL_RU_BATCH_TRANSLATE_STATE: RuBatchTranslateState = {
  status: "idle",
  completedCount: 0,
  total: 0,
  translatedCount: 0,
  failedCount: 0,
};

const RU_TRANSLATE_BATCH_SIZE = 8;
const RU_TRANSLATE_BATCH_DELAY_MS = 750;

const BATCH_REFRESH_DELAY_MS = 650;
const BATCH_REFRESH_429_BACKOFF_MS = 3500;
// Comfortably above worst-case server-side fallback budget (Gemini 10s + Groq 10s + CF Workers AI 10s = 30s)
const DAILY_PACK_CLIENT_TIMEOUT_MS = 40_000;

function sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export interface CelebrationToastState {
  id: number;
  title: string;
  message: string;
  cefr: CefrLevel;
}

export interface TriggerLexiCheerInput {
  reason: LexiCheerReason;
  combo?: number;
  term?: string;
  treatEarned?: boolean;
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
  registerOverlayHistory: (
    overlayId: string,
    onBackClose: () => void
  ) => () => void;
  openOverlayHistory: (overlayId: string) => void;
  closeOverlayHistory: (overlayId: string) => void;
  accent: AccentType;
  setAccent: (accent: AccentType) => void;
  words: WordEntry[];
  studyLogs: StudyLog[];
  syncMode: SyncMode;
  syncStatus: CloudSyncStatus;
  syncError: SupabaseSyncErrorInfo | null;
  isForceSyncing: boolean;
  forceSyncNow: () => Promise<{
    ok: boolean;
    uploadedCount: number;
    totalWords: number;
    error?: string;
  }>;
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
  // Daily Pack & Quota
  dailyQuota: DailyQuotaSettings;
  updateDailyQuota: (patch: Partial<DailyQuotaSettings>) => void;
  placementCefr: CefrLevel | null;
  userCefr: CefrLevel | null;
  effectiveCefr: CefrLevel;
  cefrOnboardingCompleted: boolean;
  showCefrOnboarding: boolean;
  cefrOnboardingInitialStep: "select" | "placement";
  isLexiIntroOpen: boolean;
  completeLexiIntro: (action: "check-level" | "skip") => Promise<void>;
  activeWhatsNewRelease: FeatureRelease | null;
  isWhatsNewOpen: boolean;
  acknowledgeWhatsNew: () => void;
  lexiEnabled: boolean;
  setLexiEnabled: (enabled: boolean) => void;
  toggleLexiEnabled: () => void;
  lexiCompanion: LexiCompanionState;
  lexiBondInfo: LexiBondInfo;
  isLexiHappyBoosted: boolean;
  petLexi: () => void;
  feedLexiTreat: () => { fed: boolean; leveledUpTo: LexiBondTierId | null };
  awardLexiMilestoneTreat: (milestone: LexiMilestoneKey) => boolean;
  lexiCheerToast: LexiCheerState | null;
  triggerLexiCheer: (input: TriggerLexiCheerInput) => void;
  clearLexiCheerToast: () => void;
  cefrPromotion: CefrPromotionStatus;
  completeCefrOnboarding: (
    cefr: CefrLevel,
    options?: { fromPlacement?: boolean; keepModalOpen?: boolean }
  ) => Promise<void>;
  dismissCefrOnboarding: () => Promise<void>;
  levelUpCefr: (
    nextCefr: CefrLevel,
    options?: { celebrate?: boolean; silent?: boolean; forceAutoTier?: boolean }
  ) => Promise<void>;
  placementLaunchNonce: number;
  launchPlacementTest: () => void;
  clearPlacementLaunch: () => void;
  celebrationToast: CelebrationToastState | null;
  clearCelebrationToast: () => void;
  resolvedDailyPackTier: DailyPackTargetTier;
  applyPlacementLevel: (cefr: CefrLevel) => Promise<void>;
  dailyPack: DailyPackRecord | null;
  isDailyPackLoading: boolean;
  dailyPackError: string | null;
  dailyPackModalOpen: boolean;
  setDailyPackModalOpen: (open: boolean) => void;
  openDailyPackModal: () => void;
  dismissDailyPackForSession: () => void;
  ensureDailyPackLoaded: (
    forceRegenerateIfUnstarted?: boolean
  ) => Promise<DailyPackRecord | null>;
  applyQuotaToTodayPack: () => Promise<DailyPackRecord | null>;
  completeDailyPackItem: (item: DailyPackItem) => Promise<WordEntry | null>;
  recordDailyPackWrongAttempt: () => Promise<void>;
  // Vault & Practice actions
  addWordViaAI: (term: string, sourceTag: string) => Promise<AddWordResult>;
  addExtractedWordsBatch: (
    items: ExtractedVocabItem[],
    sourceTag: string
  ) => Promise<number>;
  addSuggestedWordToVault: (item: SuggestedWordItem) => Promise<WordEntry | null>;
  refreshWordWithAI: (
    wordId: string,
    options?: { signal?: AbortSignal }
  ) => Promise<RefreshWordResult>;
  batchRefresh: BatchRefreshState;
  startBatchRefreshAllWords: () => Promise<void>;
  cancelBatchRefreshAllWords: () => void;
  resetBatchRefreshStatus: () => void;
  ruBatchTranslate: RuBatchTranslateState;
  startTranslateMissingRuMeanings: () => Promise<void>;
  cancelTranslateMissingRuMeanings: () => void;
  resetRuBatchTranslateStatus: () => void;
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
  showAuthModal: boolean;
  continueAsGuest: () => void;
  ringTargets: DailyRingTargets;
  updateRingTargets: (patch: Partial<DailyRingTargets>) => void;
  resetRingTargets: () => void;
  changePassword: (newPassword: string) => Promise<AuthActionResult>;
  openRegisterFromGuest: () => void;
  closeAuthModal: () => void;
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [todayStr, setTodayStr] = useState("2026-01-01");
  const [activeTab, setActiveTabState] = useState<TabId>("vault");
  const {
    navigateTab: setActiveTab,
    registerOverlay: registerOverlayHistory,
    openOverlay: openOverlayHistory,
    closeOverlay: closeOverlayHistory,
  } = useBrowserHistoryNav(activeTab, setActiveTabState);
  const [accent, setAccentState] = useState<AccentType>("US");
  const [words, setWords] = useState<WordEntry[]>([]);
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>([]);
  const [syncMode, setSyncMode] = useState<SyncMode>("local");
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>("local");
  const [syncError, setSyncError] = useState<SupabaseSyncErrorInfo | null>(null);
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [xp, setXp] = useState(0);
  const [sfxMuted, setSfxMutedState] = useState(false);
  const [ringTargets, setRingTargets] = useState<DailyRingTargets>(
    DAILY_RING_TARGETS
  );
  const [dailyQuota, setDailyQuota] = useState<DailyQuotaSettings>(
    DEFAULT_DAILY_QUOTA
  );
  const [placementCefr, setPlacementCefr] = useState<CefrLevel | null>(null);
  const [userCefr, setUserCefr] = useState<CefrLevel | null>(null);
  const [cefrOnboardingCompleted, setCefrOnboardingCompleted] = useState(true);
  const [showCefrOnboarding, setShowCefrOnboarding] = useState(false);
  const [cefrOnboardingInitialStep, setCefrOnboardingInitialStep] = useState<
    "select" | "placement"
  >("select");
  const [showLexiIntro, setShowLexiIntro] = useState(false);
  const [previewLexiIntro, setPreviewLexiIntro] = useState(false);
  const [whatsNewRelease, setWhatsNewRelease] = useState<FeatureRelease | null>(
    null
  );
  const [previewWhatsNew, setPreviewWhatsNew] = useState(false);
  const [lexiEnabled, setLexiEnabledState] = useState(true);
  const [lexiCompanion, setLexiCompanion] = useState<LexiCompanionState>(() => ({
    ...DEFAULT_LEXI_COMPANION_STATE,
    earnedMilestonesByDate: {},
  }));
  const [lexiNowMs, setLexiNowMs] = useState(() => Date.now());
  const [lexiCheerToast, setLexiCheerToast] = useState<LexiCheerState | null>(
    null
  );
  const [placementLaunchNonce, setPlacementLaunchNonce] = useState(0);
  const [celebrationToast, setCelebrationToast] =
    useState<CelebrationToastState | null>(null);
  const [dailyPack, setDailyPack] = useState<DailyPackRecord | null>(null);
  const [isDailyPackLoading, setIsDailyPackLoading] = useState(false);
  const [dailyPackError, setDailyPackError] = useState<string | null>(null);
  const [dailyPackModalOpen, setDailyPackModalOpen] = useState(false);

  const [selectedWord, setSelectedWord] = useState<WordEntry | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureToast, setCaptureToast] = useState<CaptureToastState | null>(
    null
  );
  const [practiceLaunch, setPracticeLaunch] =
    useState<PracticeLaunchRequest | null>(null);
  const [streakFocusNonce, setStreakFocusNonce] = useState(0);
  const [commuteLaunchNonce, setCommuteLaunchNonce] = useState(0);
  const [batchRefresh, setBatchRefresh] = useState<BatchRefreshState>(
    INITIAL_BATCH_REFRESH_STATE
  );
  const [ruBatchTranslate, setRuBatchTranslate] =
    useState<RuBatchTranslateState>(INITIAL_RU_BATCH_TRANSLATE_STATE);

  const launchNonceRef = useRef(0);
  const celebrationNonceRef = useRef(0);
  const lexiCheerNonceRef = useRef(0);
  const lexiEnabledRef = useRef(lexiEnabled);
  lexiEnabledRef.current = lexiEnabled;
  const lexiCompanionRef = useRef<LexiCompanionState>(lexiCompanion);
  lexiCompanionRef.current = lexiCompanion;
  const todayStrRef = useRef(todayStr);
  todayStrRef.current = todayStr;
  const pendingDailyPackTreatDateRef = useRef<string | null>(null);
  const batchRefreshAbortRef = useRef<AbortController | null>(null);
  const batchRefreshRunningRef = useRef(false);
  const ruTranslateAbortRef = useRef<AbortController | null>(null);
  const ruTranslateRunningRef = useRef(false);
  const wordsRef = useRef<WordEntry[]>([]);
  wordsRef.current = words;
  const ringTargetsRef = useRef<DailyRingTargets>(ringTargets);
  ringTargetsRef.current = ringTargets;
  const dailyQuotaRef = useRef<DailyQuotaSettings>(dailyQuota);
  dailyQuotaRef.current = dailyQuota;
  const placementCefrRef = useRef<CefrLevel | null>(placementCefr);
  placementCefrRef.current = placementCefr;
  const userCefrRef = useRef<CefrLevel | null>(userCefr);
  userCefrRef.current = userCefr;
  const resolvedDailyPackTier = useMemo(
    () =>
      resolveDailyPackTier(dailyQuota.targetLevel, userCefr ?? placementCefr),
    [dailyQuota.targetLevel, placementCefr, userCefr]
  );
  const resolvedDailyPackTierRef = useRef<DailyPackTargetTier>(
    resolvedDailyPackTier
  );
  resolvedDailyPackTierRef.current = resolvedDailyPackTier;
  const dailyPackRef = useRef<DailyPackRecord | null>(dailyPack);
  dailyPackRef.current = dailyPack;
  const userRef = useRef<AuthUser | null>(user);
  userRef.current = user;
  const prevRingsRef = useRef<DailyRingsProgress | null>(null);
  const pendingCloudOpsRef = useRef(0);
  const dailyPackInFlightRef = useRef<Promise<DailyPackRecord | null> | null>(
    null
  );
  const autoPopupCheckedKeyRef = useRef<string | null>(null);
  const whatsNewCheckedKeyRef = useRef<string | null>(null);
  const wordsLogQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingLexiIntroRef = useRef(false);
  const justRegisteredUserIdRef = useRef<string | null>(null);
  const onboardingFlowActiveRef = useRef(false);

  const runCloudMutation = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      const isCloudAccount = userRef.current?.provider === "supabase";
      if (!isCloudAccount) {
        return fn();
      }
      pendingCloudOpsRef.current += 1;
      setSyncStatus("syncing");
      try {
        return await fn();
      } finally {
        pendingCloudOpsRef.current = Math.max(
          0,
          pendingCloudOpsRef.current - 1
        );
        if (pendingCloudOpsRef.current === 0) {
          if (userRef.current?.provider !== "supabase") {
            setSyncStatus("local");
          } else if (getLastSupabaseSyncError()) {
            setSyncStatus("error");
          } else {
            setSyncStatus("synced");
          }
        }
      }
    },
    []
  );

  // Subscribe to any Supabase sync errors so UI badges & Settings never hide failures
  useEffect(() => {
    setSyncError(getLastSupabaseSyncError());
    return subscribeSupabaseSyncErrors((err) => {
      setSyncError(err);
      if (userRef.current?.provider === "supabase") {
        if (err) {
          setSyncStatus("error");
        } else if (pendingCloudOpsRef.current === 0) {
          setSyncStatus("synced");
        }
      }
    });
  }, []);

  // Initial client bootstrap + midnight calendar rollover watcher
  useEffect(() => {
    const localToday = getLocalDateString();
    setTodayStr(localToday);
    setSfxMutedState(isSfxMuted());
    setRingTargets(readCustomRingTargets());

    const savedAccent = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    if (savedAccent === "UK" || savedAccent === "US") {
      setAccentState(savedAccent);
    }

    const savedLexiEnabled = window.localStorage.getItem(LEXI_ENABLED_STORAGE_KEY);
    if (savedLexiEnabled === "false") {
      setLexiEnabledState(false);
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("previewLexiIntro") === "1") {
      setPreviewLexiIntro(true);
    }
    if (params.get("previewWhatsNew") === "1") {
      setPreviewWhatsNew(true);
    }

    let mounted = true;
    getCurrentSessionUser().then((sessionUser) => {
      if (!mounted) return;
      setUser(sessionUser);
      setIsAuthChecked(true);
    });

    const unsubAuth = subscribeAuthChanges((nextUser) => {
      setUser((prev) => {
        if (
          prev?.id === nextUser?.id &&
          prev?.username === nextUser?.username &&
          prev?.provider === nextUser?.provider
        ) {
          return prev;
        }
        return nextUser;
      });
      if (nextUser && nextUser.provider !== "guest") {
        setShowAuthModal(false);
        setAuthInitialMode("login");
      }
      setIsAuthChecked(true);
    });

    const checkDateRollover = () => {
      const freshDate = getLocalDateString();
      setTodayStr((prev) => (prev === freshDate ? prev : freshDate));
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkDateRollover();
      }
    };

    window.addEventListener("focus", checkDateRollover);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mounted = false;
      unsubAuth();
      window.removeEventListener("focus", checkDateRollover);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Hydrate full Cloud + Local state on auth change or calendar day change
  useEffect(() => {
    if (!isAuthChecked) return;

    if (!user) {
      setWords([]);
      setStudyLogs([]);
      setXp(0);
      setDailyPack(null);
      setDailyPackModalOpen(false);
      setDailyPackError(null);
      setSelectedWord(null);
      setPlacementCefr(null);
      setUserCefr(null);
      setCefrOnboardingCompleted(true);
      setShowCefrOnboarding(false);
      setCefrOnboardingInitialStep("select");
      setShowLexiIntro(false);
      setWhatsNewRelease(null);
      setCelebrationToast(null);
      const emptyCompanion: LexiCompanionState = {
        ...DEFAULT_LEXI_COMPANION_STATE,
        earnedMilestonesByDate: {},
      };
      lexiCompanionRef.current = emptyCompanion;
      setLexiCompanion(emptyCompanion);
      setLexiCheerToast(null);
      pendingDailyPackTreatDateRef.current = null;
      setSyncMode("local");
      setSyncStatus("local");
      setSyncError(null);
      clearLastSupabaseSyncError();
      setIsHydrated(false);
      prevRingsRef.current = null;
      autoPopupCheckedKeyRef.current = null;
      whatsNewCheckedKeyRef.current = null;
      return;
    }

    let active = true;
    let unsubscribeSync: (() => void) | undefined;
    const localToday = getLocalDateString();
    if (localToday !== todayStr) {
      setTodayStr(localToday);
    }
    setIsHydrated(false);
    setSyncStatus(user.provider === "supabase" ? "syncing" : "local");
    if (user.provider !== "supabase") {
      setSyncError(null);
      clearLastSupabaseSyncError();
    }

    loadInitialData(localToday, user.id, { username: user.username }).then(
      (res) => {
        if (!active) return;
        setWords(res.words);
        setStudyLogs(res.studyLogs);
        setXp(res.xp);
        setDailyQuota(res.dailyQuota);
        setRingTargets(res.ringTargets);
        setDailyPack(res.dailyPack);
        setUserCefr(res.cefrLevel);
        setPlacementCefr(res.placementCompleted ? res.cefrLevel : null);
        setCefrOnboardingCompleted(res.cefrOnboardingCompleted);

        const isJustRegistered =
          pendingLexiIntroRef.current ||
          justRegisteredUserIdRef.current === user.id ||
          (typeof window !== "undefined" &&
            window.sessionStorage.getItem(
              pendingLexiIntroSessionKey(user.id)
            ) === "1");
        const alreadyMetLexi = hasUserMetLexi(user.id);
        const shouldShowNewUserLexiIntro =
          !alreadyMetLexi &&
          (isJustRegistered || !res.cefrOnboardingCompleted);

        pendingLexiIntroRef.current = false;

        if (shouldShowNewUserLexiIntro) {
          onboardingFlowActiveRef.current = true;
          if (typeof window !== "undefined") {
            try {
              window.sessionStorage.setItem(
                pendingLexiIntroSessionKey(user.id),
                "1"
              );
            } catch {
              // Ignore sessionStorage restrictions
            }
          }
          // Step 1: Show IntroducingLexiModal first; hold CefrOnboardingModal & DailyPackModal back.
          setShowLexiIntro(true);
          setShowCefrOnboarding(false);
          autoPopupCheckedKeyRef.current = `${user.id}_${localToday}`;
        } else {
          onboardingFlowActiveRef.current = !res.cefrOnboardingCompleted;
          setShowLexiIntro(false);
          setShowCefrOnboarding(!res.cefrOnboardingCompleted);
        }
        setSyncMode(res.syncMode);
        setSyncError(res.syncError);
        setSyncStatus(
          user.provider === "supabase"
            ? res.cloudReachable && !res.syncError
              ? "synced"
              : "error"
            : "local"
        );
        prevRingsRef.current = computeDailyRings(
          res.studyLogs,
          localToday,
          res.ringTargets
        );
        const loadedCompanion = readLexiCompanionState(user.id);
        lexiCompanionRef.current = loadedCompanion;
        setLexiCompanion(loadedCompanion);
        pendingDailyPackTreatDateRef.current = null;
        setIsHydrated(true);

        void loadIeltsState(user.id)
          .then((ieltsRes) => {
            if (!active) return;
            if (ieltsRes.profile.placement_completed) {
              setPlacementCefr(ieltsRes.profile.cefr_level);
              setUserCefr((prev) => prev ?? ieltsRes.profile.cefr_level);
              setCefrOnboardingCompleted(true);
              setShowCefrOnboarding(false);
            }
          })
          .catch(() => {
            // Keep default placementCefr on error
          });

        unsubscribeSync = subscribeRealtimeSync(localToday, user.id, {
          onWordsRefresh: (freshWords) => setWords(freshWords),
          onLogsRefresh: (freshLogs) => setStudyLogs(freshLogs),
          onProfileRefresh: (profile) => {
            if (typeof profile.xp === "number") {
              setXp((prev) => Math.max(prev, profile.xp!));
            }
            if (profile.dailyQuota) {
              setDailyQuota(profile.dailyQuota);
            }
            if (profile.ringTargets) {
              setRingTargets(profile.ringTargets);
            }
            if (profile.cefrLevel) {
              setUserCefr(profile.cefrLevel);
            }
            if (typeof profile.cefrOnboardingCompleted === "boolean") {
              setCefrOnboardingCompleted(profile.cefrOnboardingCompleted);
              if (profile.cefrOnboardingCompleted) {
                setShowCefrOnboarding(false);
              }
            }
          },
          onDailyPackRefresh: (freshPack) => {
            setDailyPack(freshPack);
          },
        });
      }
    );

    return () => {
      active = false;
      unsubscribeSync?.();
    };
  }, [isAuthChecked, todayStr, user]);

  const dailyRings = useMemo(
    () => computeDailyRings(studyLogs, todayStr, ringTargets),
    [studyLogs, todayStr, ringTargets]
  );

  useEffect(() => {
    const until = lexiCompanion.happyBoostUntil;
    const now = Date.now();
    if (!lexiEnabled || until <= now) return;
    const delay = Math.min(until - now + 150, 2_147_483_000);
    const timer = window.setTimeout(() => {
      setLexiNowMs(Date.now());
    }, delay);
    return () => window.clearTimeout(timer);
  }, [lexiCompanion.happyBoostUntil, lexiEnabled]);

  const lexiBondInfo = useMemo(
    () => getLexiBondInfo(lexiCompanion.treatsFedTotal),
    [lexiCompanion.treatsFedTotal]
  );

  const isLexiHappyBoosted = isLexiHappyBoostActive(
    lexiCompanion,
    lexiNowMs
  );

  const awardLexiMilestoneTreat = useCallback(
    (milestone: LexiMilestoneKey): boolean => {
      const activeUser = userRef.current;
      if (!activeUser || !lexiEnabledRef.current) return false;
      const { nextState, awarded } = applyLexiMilestoneTreatToState(
        lexiCompanionRef.current,
        todayStrRef.current,
        milestone
      );
      if (!awarded) return false;
      lexiCompanionRef.current = nextState;
      setLexiCompanion(nextState);
      writeLexiCompanionState(activeUser.id, nextState);
      return true;
    },
    []
  );

  const petLexi = useCallback(() => {
    const activeUser = userRef.current;
    if (!activeUser || !lexiEnabledRef.current) return;
    const next = applyLexiPetToState(lexiCompanionRef.current);
    lexiCompanionRef.current = next;
    setLexiCompanion(next);
    writeLexiCompanionState(activeUser.id, next);
  }, []);

  const feedLexiTreat = useCallback((): {
    fed: boolean;
    leveledUpTo: LexiBondTierId | null;
  } => {
    const activeUser = userRef.current;
    if (!activeUser || !lexiEnabledRef.current) {
      return { fed: false, leveledUpTo: null };
    }
    const res = applyLexiFeedTreatToState(lexiCompanionRef.current, Date.now());
    if (!res.fed) {
      return { fed: false, leveledUpTo: null };
    }
    lexiCompanionRef.current = res.nextState;
    setLexiCompanion(res.nextState);
    writeLexiCompanionState(activeUser.id, res.nextState);
    return { fed: true, leveledUpTo: res.leveledUpTo };
  }, []);

  const clearLexiCheerToast = useCallback(() => {
    setLexiCheerToast(null);
  }, []);

  const triggerLexiCheer = useCallback(
    (input: TriggerLexiCheerInput) => {
      if (!userRef.current || !lexiEnabledRef.current) return;
      const cheerDict = TRANSLATIONS[lang].lexi.cheer;
      let title = cheerDict.dailyPackTitle;
      let body = cheerDict.dailyPackBody;
      let treatEarned = Boolean(input.treatEarned);

      if (input.reason === "daily_pack_complete") {
        title = cheerDict.dailyPackTitle;
        body = cheerDict.dailyPackBody;
        if (pendingDailyPackTreatDateRef.current === todayStrRef.current) {
          pendingDailyPackTreatDateRef.current = null;
          treatEarned = true;
        } else if (!treatEarned) {
          treatEarned = awardLexiMilestoneTreat("daily_pack");
        }
      } else if (input.reason === "combo_5x") {
        title = formatLexiTemplate(cheerDict.comboTitle, {
          combo: input.combo ?? 5,
        });
        body = cheerDict.comboBody;
      } else if (input.reason === "weakest_word_cleared") {
        title = cheerDict.weakestClearedTitle;
        body = formatLexiTemplate(cheerDict.weakestClearedBody, {
          term: input.term ?? "",
        });
      }

      lexiCheerNonceRef.current += 1;
      setLexiCheerToast({
        id: lexiCheerNonceRef.current,
        reason: input.reason,
        title,
        body,
        treatEarned,
      });
    },
    [awardLexiMilestoneTreat, lang]
  );

  // Trigger harmonic ring completion chord & award daily Lexi treats when rings close
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
    if (vocabClosed) awardLexiMilestoneTreat("ring_vocab");
    if (recallClosed) awardLexiMilestoneTreat("ring_recall");
    if (ieltsClosed) awardLexiMilestoneTreat("ring_ielts");
  }, [awardLexiMilestoneTreat, dailyRings, isHydrated]);

  const toggleSfxMuted = useCallback(() => {
    setSfxMutedState((prev) => {
      const next = !prev;
      persistSfxMuted(next);
      return next;
    });
  }, []);

  const setLexiEnabled = useCallback((enabled: boolean) => {
    lexiEnabledRef.current = enabled;
    setLexiEnabledState(enabled);
    if (!enabled) {
      setLexiCheerToast(null);
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          LEXI_ENABLED_STORAGE_KEY,
          enabled ? "true" : "false"
        );
      } catch {
        // Ignore storage access errors
      }
    }
  }, []);

  const toggleLexiEnabled = useCallback(() => {
    setLexiEnabled(!lexiEnabledRef.current);
  }, [setLexiEnabled]);

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

  // Serialize XP + vocab ring increments so rapid 0ms optimistic saves never race
  const enqueueWordsAddedLog = useCallback(
    (userId: string, count = 1) => {
      const next = wordsLogQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const { updatedLog, newXp } = await runCloudMutation(() =>
            incrementWordsAddedLog(todayStr, userId, count)
          );
          setStudyLogs((prev) => [
            updatedLog,
            ...prev.filter((l) => l.study_date !== updatedLog.study_date),
          ]);
          setXp(newXp);
        });
      wordsLogQueueRef.current = next;
      return next;
    },
    [runCloudMutation, todayStr]
  );

  // Background non-blocking enrichment ONLY if optional fields are missing on a card
  const silentlyEnrichWordIfNeeded = useCallback(
    async (entry: WordEntry, userId: string) => {
      const missingExamples = entry.examples_json.length < 2;
      const missingEn = !entry.meaning_en?.trim();
      const missingId = !entry.meaning_id?.trim();
      const missingRu = lang === "ru" && !entry.meaning_ru?.trim();
      const missingPron = !entry.pronunciation?.trim();
      const missingChunks = !entry.chunks || entry.chunks.length === 0;
      if (
        !missingExamples &&
        !missingEn &&
        !missingId &&
        !missingRu &&
        !missingPron &&
        !missingChunks
      ) {
        return;
      }

      try {
        const res = await fetch("/api/autofill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            term: entry.term,
            sourceTag: normalizeSourceTag(entry.source_tag),
            lang,
            skipDuplicateCheck: true,
          }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { data?: AutofillPayload };
        const aiData = json.data;
        if (!aiData) return;

        const latest =
          wordsRef.current.find((w) => w.id === entry.id) ?? entry;
        const merged: WordEntry = {
          ...latest,
          pronunciation: latest.pronunciation || aiData.pronunciation,
          ipa: latest.ipa || aiData.ipa,
          cefr: latest.cefr || aiData.cefr,
          meaning_en: latest.meaning_en || aiData.meaning_en,
          meaning_id: latest.meaning_id || aiData.meaning_id,
          meaning_ru: latest.meaning_ru || aiData.meaning_ru,
          examples_json:
            latest.examples_json.length >= 2
              ? lang === "ru" &&
                !latest.examples_json.some((ex) => ex.translation_ru?.trim()) &&
                aiData.examples.some((ex) => ex.translation_ru?.trim())
                ? aiData.examples
                : latest.examples_json
              : aiData.examples.length > latest.examples_json.length
                ? aiData.examples
                : latest.examples_json,
          synonyms:
            latest.synonyms.length > 0 ? latest.synonyms : aiData.synonyms,
          antonyms:
            latest.antonyms.length > 0 ? latest.antonyms : aiData.antonyms,
          word_families_json:
            latest.word_families_json.length > 0
              ? latest.word_families_json
              : aiData.word_families,
          chunks:
            latest.chunks && latest.chunks.length > 0
              ? latest.chunks
              : aiData.chunks ?? [],
        };

        const updated = await runCloudMutation(() =>
          updateWordEntry(merged, userId)
        );
        setWords((prev) =>
          prev.map((w) => (w.id === entry.id ? updated : w))
        );
        setSelectedWord((prev) =>
          prev && prev.id === entry.id ? updated : prev
        );
      } catch {
        // Silent background enrichment — never disrupt user flow
      }
    },
    [lang, runCloudMutation]
  );

  // ---------------------------------------------------------------------------
  // Daily Learning Pack ("Daily Pack") Lifecycle
  // ---------------------------------------------------------------------------
  const ensureDailyPackLoaded = useCallback(
    async (
      forceRegenerateIfUnstarted = false
    ): Promise<DailyPackRecord | null> => {
      const activeUser = userRef.current;
      if (!activeUser) return null;

      const quota = dailyQuotaRef.current;
      const totalQuota = quota.wordsPerDay + quota.idiomsPerDay;
      if (totalQuota <= 0) {
        setDailyPackError(null);
        return null;
      }

      const existing = dailyPackRef.current;
      if (
        existing &&
        existing.pack_date === todayStr &&
        existing.items.length > 0
      ) {
        // Never discard partial progress on the same calendar day
        if (!forceRegenerateIfUnstarted || existing.completed_terms.length > 0) {
          return existing;
        }
      }

      if (dailyPackInFlightRef.current && !forceRegenerateIfUnstarted) {
        return dailyPackInFlightRef.current;
      }

      const task = (async (): Promise<DailyPackRecord | null> => {
        setIsDailyPackLoading(true);
        setDailyPackError(null);
        const controller = new AbortController();
        let didClientTimeout = false;
        const timeoutId = setTimeout(() => {
          didClientTimeout = true;
          controller.abort();
        }, DAILY_PACK_CLIENT_TIMEOUT_MS);

        try {
          const res = await fetch("/api/daily-pack", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              date: todayStr,
              wordsQuota: quota.wordsPerDay,
              idiomsQuota: quota.idiomsPerDay,
              targetTier: resolvedDailyPackTierRef.current,
              existingTerms: wordsRef.current.map((w) => w.term),
              lang,
            }),
          });

          if (!res.ok) {
            let apiErr = "";
            let apiCode = "";
            try {
              const errJson = (await res.json()) as {
                error?: string;
                code?: string;
                detail?: string;
                providerFailures?: Array<{
                  batch?: string;
                  provider: string;
                  status: number | null;
                  message?: string;
                  timeout: boolean;
                  code?: string;
                  reason?: string;
                }>;
              };
              apiErr = errJson.error ?? "";
              apiCode = errJson.code ?? "";
              console.error(
                `[LexiVault] /api/daily-pack failed (HTTP ${res.status}, code=${apiCode || "unknown"}):`,
                {
                  detail: errJson.detail || apiErr || res.statusText,
                  status: res.status,
                  providerFailures: errJson.providerFailures ?? [],
                }
              );
            } catch {
              console.error(
                `[LexiVault] /api/daily-pack failed (HTTP ${res.status}):`,
                { status: res.status, detail: res.statusText }
              );
            }
            const reason = formatGeminiClientError(
              apiCode,
              res.status,
              apiErr ||
                (lang === "en"
                  ? `Failed to load today's Daily Pack (HTTP ${res.status}).`
                  : lang === "ru"
                    ? `Не удалось загрузить Пак дня (HTTP ${res.status}).`
                    : `Gagal memuat Target Harian hari ini (HTTP ${res.status}).`),
              lang
            );
            setDailyPackError(reason);
            return null;
          }

          const json = (await res.json()) as {
            pack_date: string;
            words_quota: number;
            idioms_quota: number;
            target_tier?: DailyPackTargetTier;
            items: DailyPackItem[];
            source?: "gemini" | "fallback";
          };

          const newPack: DailyPackRecord = {
            pack_date: todayStr,
            words_quota: quota.wordsPerDay,
            idioms_quota: quota.idiomsPerDay,
            target_tier: json.target_tier ?? resolvedDailyPackTierRef.current,
            items: Array.isArray(json.items) ? json.items : [],
            completed_terms: [],
            completed_at: null,
            source: json.source ?? "fallback",
          };

          setDailyPack(newPack);
          await runCloudMutation(() => saveDailyPack(newPack, activeUser.id));
          return newPack;
        } catch (err) {
          if (didClientTimeout) {
            console.error("[LexiVault] /api/daily-pack client fetch timeout:", {
              provider: "client-fetch",
              status: null,
              timeout: true,
              timeoutMs: DAILY_PACK_CLIENT_TIMEOUT_MS,
            });
            setDailyPackError(
              lang === "en"
                ? "Daily Pack generation timed out while waiting for AI providers. Please try again."
                : lang === "ru"
                  ? "Время ожидания генерации Пака дня истекло. Попробуй ещё раз."
                  : "Pembuatan Target Harian timeout saat menunggu server AI. Silakan coba lagi."
            );
          } else {
            console.error("[LexiVault] Failed to load Daily Pack:", {
              provider: "client-fetch",
              status: null,
              timeout: false,
              error: err,
            });
            setDailyPackError(
              lang === "en"
                ? "Failed to load today's Daily Pack. Please try again."
                : lang === "ru"
                  ? "Не удалось загрузить Пак дня. Попробуй ещё раз."
                  : "Gagal memuat Target Harian hari ini. Silakan coba lagi."
            );
          }
          return null;
        } finally {
          clearTimeout(timeoutId);
          setIsDailyPackLoading(false);
          dailyPackInFlightRef.current = null;
        }
      })();

      dailyPackInFlightRef.current = task;
      return task;
    },
    [lang, runCloudMutation, todayStr]
  );

  const openDailyPackModal = useCallback(() => {
    setDailyPackModalOpen(true);
    void ensureDailyPackLoaded(false);
  }, [ensureDailyPackLoaded]);

  const dismissDailyPackForSession = useCallback(() => {
    setDailyPackModalOpen(false);
    if (typeof window !== "undefined" && userRef.current) {
      try {
        window.sessionStorage.setItem(
          dailyDismissKey(userRef.current.id, todayStr),
          "1"
        );
      } catch {
        // Ignore sessionStorage restrictions
      }
    }
  }, [todayStr]);

  // Auto-open What's New modal once per release for existing onboarded users
  useEffect(() => {
    if (!isHydrated || !user || previewWhatsNew) return;
    if (
      !cefrOnboardingCompleted ||
      showCefrOnboarding ||
      showLexiIntro ||
      previewLexiIntro ||
      dailyPackModalOpen ||
      onboardingFlowActiveRef.current ||
      (typeof window !== "undefined" &&
        window.sessionStorage.getItem(pendingLexiIntroSessionKey(user.id)) ===
          "1")
    ) {
      return;
    }

    const latest = getLatestRelease();
    if (!latest) return;

    const checkKey = `${user.id}:${latest.id}`;
    if (whatsNewCheckedKeyRef.current === checkKey) return;
    whatsNewCheckedKeyRef.current = checkKey;

    if (!hasUserSeenRelease(user.id, latest.id)) {
      setWhatsNewRelease(latest);
    }
  }, [
    cefrOnboardingCompleted,
    dailyPackModalOpen,
    isHydrated,
    previewLexiIntro,
    previewWhatsNew,
    showCefrOnboarding,
    showLexiIntro,
    user,
  ]);

  // Auto-open Daily Pack modal once per session on new day if incomplete & autoShowPopup ON
  useEffect(() => {
    if (!isHydrated || !user || activeTab !== "vault") return;
    const latestRelease = getLatestRelease();
    const hasPendingWhatsNew =
      Boolean(whatsNewRelease) ||
      previewWhatsNew ||
      Boolean(latestRelease && !hasUserSeenRelease(user.id, latestRelease.id));
    if (
      !cefrOnboardingCompleted ||
      showCefrOnboarding ||
      showLexiIntro ||
      previewLexiIntro ||
      hasPendingWhatsNew ||
      onboardingFlowActiveRef.current ||
      (typeof window !== "undefined" &&
        window.sessionStorage.getItem(pendingLexiIntroSessionKey(user.id)) ===
          "1")
    ) {
      return;
    }

    const checkKey = `${user.id}_${todayStr}`;
    if (autoPopupCheckedKeyRef.current === checkKey) return;
    autoPopupCheckedKeyRef.current = checkKey;

    const quota = dailyQuotaRef.current;
    if (!quota.autoShowPopup || quota.wordsPerDay + quota.idiomsPerDay <= 0) {
      return;
    }

    if (typeof window !== "undefined") {
      try {
        if (window.sessionStorage.getItem(dailyDismissKey(user.id, todayStr))) {
          return;
        }
      } catch {
        // Ignore sessionStorage read errors
      }
    }

    const pack = dailyPackRef.current;
    const alreadyDoneToday =
      pack &&
      pack.pack_date === todayStr &&
      pack.items.length > 0 &&
      pack.completed_terms.length >= pack.items.length;

    if (alreadyDoneToday) return;

    setDailyPackModalOpen(true);
    void ensureDailyPackLoaded(false);
  }, [
    activeTab,
    cefrOnboardingCompleted,
    ensureDailyPackLoaded,
    isHydrated,
    previewLexiIntro,
    previewWhatsNew,
    showCefrOnboarding,
    showLexiIntro,
    todayStr,
    user,
    whatsNewRelease,
  ]);

  const completeDailyPackItem = useCallback(
    async (item: DailyPackItem): Promise<WordEntry | null> => {
      const activeUser = userRef.current;
      if (!activeUser) return null;

      const normalized = normalizeTermKey(item.term);
      const existingEntry =
        wordsRef.current.find((w) => normalizeTermKey(w.term) === normalized) ??
        null;

      const nowIso = new Date().toISOString();
      const draft: WordEntry | null = existingEntry
        ? null
        : {
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `local-dp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            user_id: activeUser.id,
            term: item.term,
            pronunciation: item.pronunciation,
            ipa: item.ipa,
            cefr: item.cefr,
            type: item.type,
            meaning_id: item.meaning_id,
            meaning_en: item.meaning_en,
            meaning_ru: item.meaning_ru,
            examples_json: item.examples,
            synonyms: item.synonyms,
            antonyms: item.antonyms,
            word_families_json: item.word_families,
            chunks: item.chunks ?? [],
            register: item.register,
            source_tag: "daily_pack",
            audio_us_url: null,
            audio_uk_url: null,
            correct_count: 0,
            wrong_count: 0,
            last_practiced_at: null,
            last_reviewed_date: null,
            review_count: 0,
            next_review_at: nowIso,
            interval_days: 0,
            ease_factor: 2.5,
            repetitions: 0,
            created_at: nowIso,
          };

      // Optimistically update Daily Pack progress and words state synchronously before cloud I/O
      const currentPack = dailyPackRef.current;
      const alreadyRecorded = Boolean(
        currentPack?.completed_terms.some(
          (term) => normalizeTermKey(term) === normalized
        )
      );

      if (currentPack && currentPack.pack_date === todayStr) {
        const nextCompleted = alreadyRecorded
          ? currentPack.completed_terms
          : [...currentPack.completed_terms, normalized];
        const isAllDone =
          currentPack.items.length > 0 &&
          currentPack.items.every((it) =>
            nextCompleted.some(
              (term) => normalizeTermKey(term) === normalizeTermKey(it.term)
            )
          );

        const nextPack: DailyPackRecord = {
          ...currentPack,
          completed_terms: nextCompleted,
          completed_at: isAllDone
            ? currentPack.completed_at ?? new Date().toISOString()
            : currentPack.completed_at ?? null,
        };
        dailyPackRef.current = nextPack;
        setDailyPack(nextPack);
        if (isAllDone && !alreadyRecorded) {
          const awarded = awardLexiMilestoneTreat("daily_pack");
          if (awarded) {
            pendingDailyPackTreatDateRef.current = todayStr;
          }
        }
        void runCloudMutation(() =>
          saveDailyPack(nextPack, activeUser.id)
        ).catch((err) => {
          console.warn("[LexiVault][daily-pack] Background saveDailyPack failed:", err);
        });
      }

      if (draft) {
        wordsRef.current = [
          draft,
          ...wordsRef.current.filter(
            (w) => normalizeTermKey(w.term) !== normalized
          ),
        ];
        setWords((prev) => [
          draft,
          ...prev.filter((w) => normalizeTermKey(w.term) !== normalized),
        ]);
      }

      let savedEntry: WordEntry | null = existingEntry ?? draft;

      if (draft) {
        try {
          const persisted = await runCloudMutation(() =>
            saveWordEntry(draft, activeUser.id)
          );
          savedEntry = persisted;
          setWords((prev) => [
            persisted,
            ...prev.filter(
              (w) => w.id !== persisted.id && w.id !== draft.id
            ),
          ]);
          void silentlyEnrichWordIfNeeded(persisted, activeUser.id);
        } catch (err) {
          console.warn("[LexiVault][daily-pack] Background saveWordEntry failed:", err);
        }
      }

      // Award +20 XP & update vocab + recall rings + streak + accuracy in background
      if (!alreadyRecorded) {
        try {
          const { updatedLog, newXp } = await runCloudMutation(() =>
            incrementWordsAddedLog(todayStr, activeUser.id, 1, true)
          );
          setStudyLogs((prev) => [
            updatedLog,
            ...prev.filter((l) => l.study_date !== updatedLog.study_date),
          ]);
          setXp(newXp);
        } catch (err) {
          console.warn("[LexiVault][daily-pack] Background study log update failed:", err);
        }
      }

      return savedEntry;
    },
    [awardLexiMilestoneTreat, runCloudMutation, silentlyEnrichWordIfNeeded, todayStr]
  );

  const recordDailyPackWrongAttempt = useCallback(async () => {
    const activeUser = userRef.current;
    if (!activeUser) return;
    const updatedLog = await runCloudMutation(() =>
      recordWrongQuizLogOnly(todayStr, activeUser.id)
    );
    setStudyLogs((prev) => [
      updatedLog,
      ...prev.filter((l) => l.study_date !== updatedLog.study_date),
    ]);
  }, [runCloudMutation, todayStr]);

  const updateDailyQuota = useCallback(
    (patch: Partial<DailyQuotaSettings>) => {
      const activeUser = userRef.current;
      setDailyQuota((prev) => {
        const next = normalizeDailyQuota({ ...prev, ...patch });
        dailyQuotaRef.current = next;
        if (activeUser) {
          void runCloudMutation(() =>
            saveCloudUserSettings(activeUser.id, { dailyQuota: next })
          );
        }
        return next;
      });
    },
    [runCloudMutation]
  );

  const applyQuotaToTodayPack = useCallback(async () => {
    const existing = dailyPackRef.current;
    if (
      existing &&
      existing.pack_date === todayStr &&
      existing.completed_terms.length > 0
    ) {
      return existing;
    }
    return ensureDailyPackLoaded(true);
  }, [ensureDailyPackLoaded, todayStr]);

  const applyPlacementLevel = useCallback(
    async (cefr: CefrLevel): Promise<void> => {
      const activeUser = userRef.current;
      setPlacementCefr(cefr);
      placementCefrRef.current = cefr;
      setUserCefr(cefr);
      userCefrRef.current = cefr;
      setCefrOnboardingCompleted(true);
      const nextTier = resolveDailyPackTier(
        dailyQuotaRef.current.targetLevel,
        cefr
      );
      resolvedDailyPackTierRef.current = nextTier;

      if (activeUser) {
        void runCloudMutation(() =>
          saveCloudUserSettings(activeUser.id, {
            cefrLevel: cefr,
            cefrOnboardingCompleted: true,
          })
        );
      }

      const existing = dailyPackRef.current;
      if (
        dailyQuotaRef.current.targetLevel === "auto" &&
        existing &&
        existing.pack_date === todayStr &&
        existing.completed_terms.length === 0 &&
        existing.target_tier !== nextTier
      ) {
        await ensureDailyPackLoaded(true);
      }
    },
    [ensureDailyPackLoaded, runCloudMutation, todayStr]
  );

  const completeCefrOnboarding = useCallback(
    async (
      cefr: CefrLevel,
      options?: { fromPlacement?: boolean; keepModalOpen?: boolean }
    ): Promise<void> => {
      const activeUser = userRef.current;
      if (!activeUser) return;

      setUserCefr(cefr);
      userCefrRef.current = cefr;
      if (options?.fromPlacement) {
        setPlacementCefr(cefr);
        placementCefrRef.current = cefr;
      }
      setCefrOnboardingCompleted(true);
      if (!options?.keepModalOpen) {
        setShowCefrOnboarding(false);
        if (onboardingFlowActiveRef.current) {
          onboardingFlowActiveRef.current = false;
          autoPopupCheckedKeyRef.current = `${activeUser.id}_${todayStr}`;
        }
      }

      const nextQuota = normalizeDailyQuota({
        ...dailyQuotaRef.current,
        targetLevel: "auto",
      });
      setDailyQuota(nextQuota);
      dailyQuotaRef.current = nextQuota;

      const nextTier = resolveDailyPackTier("auto", cefr);
      resolvedDailyPackTierRef.current = nextTier;

      await runCloudMutation(() =>
        saveCloudUserSettings(activeUser.id, {
          dailyQuota: nextQuota,
          cefrLevel: cefr,
          cefrOnboardingCompleted: true,
          syncIeltsProfile: true,
        })
      );

      const existing = dailyPackRef.current;
      if (
        existing &&
        existing.pack_date === todayStr &&
        existing.completed_terms.length === 0 &&
        existing.target_tier !== nextTier
      ) {
        await ensureDailyPackLoaded(true);
      }
    },
    [ensureDailyPackLoaded, runCloudMutation, todayStr]
  );

  const dismissCefrOnboarding = useCallback(async (): Promise<void> => {
    const activeUser = userRef.current;
    onboardingFlowActiveRef.current = false;
    setCefrOnboardingCompleted(true);
    setShowCefrOnboarding(false);
    if (!activeUser) return;
    autoPopupCheckedKeyRef.current = `${activeUser.id}_${todayStr}`;
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(
          dailyDismissKey(activeUser.id, todayStr),
          "1"
        );
      } catch {
        // Ignore sessionStorage restrictions
      }
    }
    const fallbackCefr = userCefrRef.current ?? placementCefrRef.current ?? "B1";
    setUserCefr((prev) => prev ?? fallbackCefr);
    await runCloudMutation(() =>
      saveCloudUserSettings(activeUser.id, {
        cefrLevel: fallbackCefr,
        cefrOnboardingCompleted: true,
      })
    );
  }, [runCloudMutation, todayStr]);

  const completeLexiIntro = useCallback(
    async (action: "check-level" | "skip"): Promise<void> => {
      const activeUser = userRef.current;
      pendingLexiIntroRef.current = false;
      justRegisteredUserIdRef.current = null;

      if (typeof window !== "undefined") {
        if (activeUser) {
          markUserMetLexi(activeUser.id);
          markReleaseSeen(activeUser.id, LEXI_COMPANION_RELEASE_ID);
          try {
            window.sessionStorage.removeItem(
              pendingLexiIntroSessionKey(activeUser.id)
            );
          } catch {
            // Ignore sessionStorage restrictions
          }
        }
        try {
          const url = new URL(window.location.href);
          if (url.searchParams.has("previewLexiIntro")) {
            url.searchParams.delete("previewLexiIntro");
            window.history.replaceState(
              window.history.state,
              "",
              `${url.pathname}${url.search}${url.hash}`
            );
          }
        } catch {
          // Ignore history API errors
        }
      }

      const wasPreview = previewLexiIntro;
      setShowLexiIntro(false);
      setPreviewLexiIntro(false);

      if (!activeUser) {
        const guest = continueAsGuestSession();
        markUserMetLexi(guest.id);
        markReleaseSeen(guest.id, LEXI_COMPANION_RELEASE_ID);
        setAuthInitialMode("login");
        setUser(guest);
        if (action === "check-level") {
          const alreadyOnboarded = Boolean(
            readLocalCefrOnboarding(guest.id)?.completed
          );
          if (alreadyOnboarded) {
            setPlacementLaunchNonce((n) => n + 1);
            setActiveTab("ielts");
          } else {
            onboardingFlowActiveRef.current = true;
            setCefrOnboardingInitialStep("select");
            setActiveTab("vault");
          }
        } else {
          onboardingFlowActiveRef.current = false;
          setCefrOnboardingInitialStep("select");
          if (typeof window !== "undefined") {
            try {
              window.sessionStorage.setItem(
                dailyDismissKey(guest.id, todayStr),
                "1"
              );
            } catch {
              // Ignore sessionStorage restrictions
            }
          }
          setActiveTab("vault");
        }
        return;
      }

      if (action === "check-level") {
        if (!cefrOnboardingCompleted) {
          onboardingFlowActiveRef.current = true;
          autoPopupCheckedKeyRef.current = `${activeUser.id}_${todayStr}`;
          setCefrOnboardingInitialStep("select");
          setShowCefrOnboarding(true);
        } else {
          onboardingFlowActiveRef.current = false;
          setPlacementLaunchNonce((n) => n + 1);
          setActiveTab("ielts");
        }
        return;
      }

      onboardingFlowActiveRef.current = false;
      setCefrOnboardingInitialStep("select");
      autoPopupCheckedKeyRef.current = `${activeUser.id}_${todayStr}`;
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(
            dailyDismissKey(activeUser.id, todayStr),
            "1"
          );
        } catch {
          // Ignore sessionStorage restrictions
        }
      }
      if (!cefrOnboardingCompleted || showCefrOnboarding) {
        await dismissCefrOnboarding();
      }
      if (wasPreview) {
        setActiveTab("vault");
      }
    },
    [
      cefrOnboardingCompleted,
      dismissCefrOnboarding,
      previewLexiIntro,
      setActiveTab,
      showCefrOnboarding,
      todayStr,
    ]
  );

  const activeWhatsNewRelease = useMemo(
    () => whatsNewRelease ?? (previewWhatsNew ? getLatestRelease() : null),
    [previewWhatsNew, whatsNewRelease]
  );

  const acknowledgeWhatsNew = useCallback(() => {
    const currentRelease =
      whatsNewRelease ?? (previewWhatsNew ? getLatestRelease() : null);
    const activeUser = userRef.current;

    if (currentRelease) {
      markReleaseSeen(activeUser?.id ?? null, currentRelease.id);
      if (activeUser && currentRelease.id === LEXI_COMPANION_RELEASE_ID) {
        markUserMetLexi(activeUser.id);
      }
    }

    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has("previewWhatsNew")) {
          url.searchParams.delete("previewWhatsNew");
          window.history.replaceState(
            window.history.state,
            "",
            `${url.pathname}${url.search}${url.hash}`
          );
        }
      } catch {
        // Ignore history API errors
      }
    }

    setWhatsNewRelease(null);
    setPreviewWhatsNew(false);
  }, [previewWhatsNew, whatsNewRelease]);

  const clearCelebrationToast = useCallback(() => {
    setCelebrationToast(null);
  }, []);

  const levelUpCefr = useCallback(
    async (
      nextCefr: CefrLevel,
      options?: {
        celebrate?: boolean;
        silent?: boolean;
        forceAutoTier?: boolean;
      }
    ): Promise<void> => {
      const activeUser = userRef.current;
      if (!activeUser) return;

      setUserCefr(nextCefr);
      userCefrRef.current = nextCefr;
      if (placementCefrRef.current) {
        setPlacementCefr(nextCefr);
        placementCefrRef.current = nextCefr;
      }
      setCefrOnboardingCompleted(true);
      setShowCefrOnboarding(false);

      const shouldUpdateToAuto =
        options?.forceAutoTier !== false &&
        dailyQuotaRef.current.targetLevel !== "auto";
      const nextQuota = shouldUpdateToAuto
        ? normalizeDailyQuota({
            ...dailyQuotaRef.current,
            targetLevel: "auto",
          })
        : dailyQuotaRef.current;
      if (shouldUpdateToAuto) {
        setDailyQuota(nextQuota);
        dailyQuotaRef.current = nextQuota;
      }

      const nextTier = resolveDailyPackTier(nextQuota.targetLevel, nextCefr);
      resolvedDailyPackTierRef.current = nextTier;

      if (options?.celebrate !== false) {
        playRingCompleteChord();
      }
      if (!options?.silent) {
        const tierLabel = getDailyPackTierMeta(nextTier).displayLabel;
        celebrationNonceRef.current += 1;
        setCelebrationToast({
          id: celebrationNonceRef.current,
          cefr: nextCefr,
          title:
            lang === "en"
              ? `Leveled Up to ${nextCefr}!`
              : lang === "ru"
                ? `Новый уровень ${nextCefr}!`
                : `Naik ke Level ${nextCefr}!`,
          message:
            lang === "en"
              ? `Your CEFR profile is now ${nextCefr} · Daily Pack target synced to ${tierLabel}.`
              : lang === "ru"
                ? `Твой уровень CEFR теперь ${nextCefr} · Пак дня настроен под ${tierLabel}.`
                : `Profil CEFR kamu sekarang ${nextCefr} · Target Harian disesuaikan ke ${tierLabel}.`,
        });
      }

      await runCloudMutation(() =>
        saveCloudUserSettings(activeUser.id, {
          dailyQuota: nextQuota,
          cefrLevel: nextCefr,
          cefrOnboardingCompleted: true,
          syncIeltsProfile: true,
        })
      );

      const existing = dailyPackRef.current;
      if (
        nextQuota.targetLevel === "auto" &&
        existing &&
        existing.pack_date === todayStr &&
        existing.completed_terms.length === 0 &&
        existing.target_tier !== nextTier
      ) {
        await ensureDailyPackLoaded(true);
      }
    },
    [ensureDailyPackLoaded, lang, runCloudMutation, todayStr]
  );

  const launchPlacementTest = useCallback(() => {
    setPlacementLaunchNonce((n) => n + 1);
    setActiveTab("ielts");
  }, [setActiveTab]);

  const clearPlacementLaunch = useCallback(() => {
    setPlacementLaunchNonce(0);
  }, []);

  // ---------------------------------------------------------------------------
  // Vault Mutations
  // ---------------------------------------------------------------------------
  const addWordViaAI = useCallback(
    async (rawTerm: string, sourceTag: string): Promise<AddWordResult> => {
      const isEn = lang === "en";
      const isRu = lang === "ru";
      if (!user) {
        return {
          ok: false,
          error: isEn
            ? "Please sign in first."
            : isRu
              ? "Сначала войди в аккаунт."
              : "Silakan login terlebih dahulu.",
        };
      }

      const trimmed = rawTerm.trim();
      if (!trimmed) {
        return {
          ok: false,
          error: isEn
            ? "Please enter a word or idiom first."
            : isRu
              ? "Сначала введи слово или идиому."
              : "Masukkan kata atau idiom terlebih dahulu.",
        };
      }

      // Layer 1 (0ms local duplicate check: case/punctuation/leading-article/to normalized)
      const existing = findLocalDuplicateWord(trimmed, wordsRef.current);
      if (existing) {
        setCaptureToast({
          type: "duplicate",
          message: isEn
            ? `Already registered in your Vault: "${existing.term}"`
            : isRu
              ? `Уже есть в словаре: «${existing.term}»`
              : `Sudah terdaftar di Vault: "${existing.term}"`,
          matchedWord: existing,
        });
        return { ok: false, duplicate: true, word: existing };
      }

      setIsCapturing(true);
      setCaptureToast(null);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35_000);
      try {
        const canonicalSource = normalizeSourceTag(sourceTag || "general");
        const res = await fetch("/api/autofill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            term: trimmed,
            sourceTag: canonicalSource,
            lang,
            existingTerms: wordsRef.current.map((w) => w.term),
          }),
        });

        if (!res.ok) {
          let apiCode = "";
          let apiError = "";
          let apiMessage = "";
          let apiDetail = "";
          try {
            const errJson = (await res.json()) as {
              error?: string;
              code?: string;
              message?: string;
              detail?: string;
            };
            apiCode = errJson.code ?? "";
            apiError = errJson.error ?? "";
            apiMessage = errJson.message ?? "";
            apiDetail = errJson.detail ?? "";
          } catch {
            // Non-JSON error body
          }
          if (apiCode === "NOT_ENGLISH" || apiError === "NOT_ENGLISH") {
            const rejectionMsg =
              (apiError && apiError !== "NOT_ENGLISH" ? apiError : "") ||
              apiMessage ||
              "Please enter a valid English word, idiom, or collocation.";
            setCaptureToast({ type: "error", message: rejectionMsg });
            return { ok: false, error: rejectionMsg };
          }
          console.error(
            `[LexiVault] /api/autofill failed (HTTP ${res.status}, code=${apiCode || "unknown"}):`,
            apiDetail || apiMessage || apiError || res.statusText
          );
          const errMsg = formatGeminiClientError(
            apiCode,
            res.status,
            apiMessage ||
              (isEn
                ? `Failed to save word. Please try again. (HTTP ${res.status})`
                : isRu
                  ? `Не удалось сохранить слово. Попробуй ещё раз. (HTTP ${res.status})`
                  : `Gagal menyimpan kata. Coba lagi. (HTTP ${res.status})`),
            lang
          );
          setCaptureToast({ type: "error", message: errMsg });
          return { ok: false, error: errMsg };
        }

        const json = (await res.json()) as {
          duplicate?: boolean;
          existingTerm?: string;
          data?: AutofillPayload;
        };

        // Layer 2 (AI semantic / inflectional variant duplicate guard)
        if (json.duplicate === true) {
          const existingTermLabel = (json.existingTerm || trimmed).trim();
          const matchedEntry =
            findLocalDuplicateWord(existingTermLabel, wordsRef.current) ??
            wordsRef.current.find(
              (w) =>
                normalizeDuplicateKey(w.term) ===
                normalizeDuplicateKey(existingTermLabel)
            );
          const displayTerm = matchedEntry?.term || existingTermLabel;
          setCaptureToast({
            type: "duplicate",
            message: isEn
              ? `Already in Vault as "${displayTerm}"`
              : isRu
                ? `Уже в словаре как «${displayTerm}»`
                : `Sudah terdaftar di Vault sebagai "${displayTerm}"`,
            matchedWord: matchedEntry,
          });
          return { ok: false, duplicate: true, word: matchedEntry };
        }

        if (!json.data) {
          throw new Error("Missing autofill data payload");
        }

        const aiData = json.data;
        // Defensive completeness guard: never save a hollow or broken card to the Vault
        const hasRealMeaning =
          Boolean(aiData.meaning_en?.trim()) &&
          Boolean(aiData.meaning_id?.trim() || aiData.meaning_ru?.trim());
        const hasRealExamples =
          Array.isArray(aiData.examples) &&
          aiData.examples.some((ex) => Boolean(ex?.sentence?.trim()));
        if (!hasRealMeaning || !hasRealExamples) {
          const incompleteMsg = isEn
            ? "Gemini AI returned incomplete word details. Please try again."
            : isRu
              ? "Gemini AI вернул неполное описание слова. Попробуй ещё раз."
              : "Detail kata dari Gemini AI tidak lengkap. Silakan coba lagi.";
          setCaptureToast({ type: "error", message: incompleteMsg });
          return { ok: false, error: incompleteMsg };
        }
        // Final safeguard if AI canonicalized the lemma to an already-saved Vault term
        const canonicalDup = findLocalDuplicateWord(
          aiData.term,
          wordsRef.current
        );
        if (canonicalDup) {
          setCaptureToast({
            type: "duplicate",
            message: isEn
              ? `Already in Vault as "${canonicalDup.term}"`
              : isRu
                ? `Уже в словаре как «${canonicalDup.term}»`
                : `Sudah terdaftar di Vault sebagai "${canonicalDup.term}"`,
            matchedWord: canonicalDup,
          });
          return { ok: false, duplicate: true, word: canonicalDup };
        }

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
          meaning_ru: aiData.meaning_ru,
          examples_json: aiData.examples,
          synonyms: aiData.synonyms,
          antonyms: aiData.antonyms,
          word_families_json: aiData.word_families,
          chunks: aiData.chunks ?? [],
          register: aiData.register,
          source_tag: canonicalSource,
          audio_us_url: null,
          audio_uk_url: null,
          correct_count: 0,
          wrong_count: 0,
          last_practiced_at: null,
          last_reviewed_date: null,
          review_count: 0,
          next_review_at: nowIso,
          interval_days: 0,
          ease_factor: 2.5,
          repetitions: 0,
          created_at: nowIso,
        };

        // Optimistic instant insert so Vault updates immediately without waiting for DB RTT
        wordsRef.current = [
          draft,
          ...wordsRef.current.filter((w) => w.id !== draft.id),
        ];
        setWords((prev) => [draft, ...prev.filter((w) => w.id !== draft.id)]);
        setCaptureToast({
          type: "success",
          message: isEn
            ? `"${draft.term}" saved (${draft.type} · ${draft.register})`
            : isRu
              ? `«${draft.term}» сохранено (${draft.type} · ${draft.register})`
              : `"${draft.term}" tersimpan (${draft.type} · ${draft.register})`,
        });

        const targetUserId = user.id;
        void runCloudMutation(() => saveWordEntry(draft, targetUserId))
          .then((saved) => {
            if (saved.id !== draft.id) {
              setWords((prev) =>
                prev.map((w) => (w.id === draft.id ? saved : w))
              );
            }
          })
          .catch((persistErr) => {
            console.error(
              "[LexiVault] Background saveWordEntry failed:",
              persistErr
            );
          });
        void enqueueWordsAddedLog(targetUserId, 1);

        return { ok: true, word: draft };
      } catch (err) {
        console.error("[LexiVault] addWordViaAI network/client error:", err);
        const errMsg = isEn
          ? "Failed to save word. Please try again."
          : isRu
            ? "Не удалось сохранить слово. Попробуй ещё раз."
            : "Gagal menyimpan kata. Coba lagi.";
        setCaptureToast({ type: "error", message: errMsg });
        return { ok: false, error: errMsg };
      } finally {
        clearTimeout(timeoutId);
        setIsCapturing(false);
      }
    },
    [enqueueWordsAddedLog, lang, runCloudMutation, user]
  );

  const addExtractedWordsBatch = useCallback(
    async (items: ExtractedVocabItem[], sourceTag: string): Promise<number> => {
      if (!user || items.length === 0) return 0;
      const isEn = lang === "en";
      const isRu = lang === "ru";
      const canonicalSource = normalizeSourceTag(sourceTag || "article");

      const existingKeys = new Set(
        wordsRef.current.map((w) => normalizeDuplicateKey(w.term))
      );
      const drafts: WordEntry[] = [];
      const nowIso = new Date().toISOString();

      for (const item of items) {
        const key = normalizeDuplicateKey(item.term);
        if (!key || existingKeys.has(key)) continue;
        existingKeys.add(key);

        drafts.push({
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
          meaning_ru: item.meaning_ru,
          examples_json: item.examples,
          synonyms: item.synonyms,
          antonyms: item.antonyms,
          word_families_json: item.word_families,
          chunks: item.chunks ?? [],
          register: item.register,
          source_tag: canonicalSource,
          audio_us_url: null,
          audio_uk_url: null,
          correct_count: 0,
          wrong_count: 0,
          last_practiced_at: null,
          last_reviewed_date: null,
          review_count: 0,
          next_review_at: nowIso,
          interval_days: 0,
          ease_factor: 2.5,
          repetitions: 0,
          created_at: nowIso,
        });
      }

      if (drafts.length > 0) {
        const draftIds = new Set(drafts.map((d) => d.id));
        wordsRef.current = [
          ...drafts,
          ...wordsRef.current.filter((w) => !draftIds.has(w.id)),
        ];
        setWords((prev) => [
          ...drafts,
          ...prev.filter((w) => !draftIds.has(w.id)),
        ]);
        setCaptureToast({
          type: "success",
          message: isEn
            ? `${drafts.length} new expression(s) extracted to Vault`
            : isRu
              ? `Сохранено новых выражений: ${drafts.length}`
              : `${drafts.length} kosakata baru diekstrak ke Vault`,
        });

        const targetUserId = user.id;
        void runCloudMutation(async () => {
          for (const draft of drafts) {
            const saved = await saveWordEntry(draft, targetUserId);
            if (saved.id !== draft.id) {
              setWords((prev) =>
                prev.map((w) => (w.id === draft.id ? saved : w))
              );
            }
          }
        }).catch((err) => {
          console.error("[LexiVault] Background batch save failed:", err);
        });
        void enqueueWordsAddedLog(targetUserId, drafts.length);
      }

      return drafts.length;
    },
    [enqueueWordsAddedLog, lang, runCloudMutation, user]
  );

  // 0ms optimistic save from AI Suggest (NEVER calls /api/autofill before insert)
  const addSuggestedWordToVault = useCallback(
    async (item: SuggestedWordItem): Promise<WordEntry | null> => {
      if (!user) return null;
      const isEn = lang === "en";
      const isRu = lang === "ru";
      const existing = findLocalDuplicateWord(item.term, wordsRef.current);
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
        meaning_ru: item.meaning_ru,
        examples_json: item.examples,
        synonyms: item.synonyms,
        antonyms: item.antonyms,
        word_families_json: item.word_families,
        chunks: item.chunks ?? [],
        register: item.register,
        source_tag: normalizeSourceTag(item.source_tag || "article"),
        audio_us_url: null,
        audio_uk_url: null,
        correct_count: 0,
        wrong_count: 0,
        last_practiced_at: null,
        last_reviewed_date: null,
        review_count: 0,
        next_review_at: nowIso,
        interval_days: 0,
        ease_factor: 2.5,
        repetitions: 0,
        created_at: nowIso,
      };

      // Synchronous 0ms UI update
      wordsRef.current = [
        draft,
        ...wordsRef.current.filter((w) => w.id !== draft.id),
      ];
      setWords((prev) => [draft, ...prev.filter((w) => w.id !== draft.id)]);
      setCaptureToast({
        type: "success",
        message: isEn
          ? `"${draft.term}" added to your Vault`
          : isRu
            ? `«${draft.term}» добавлено в словарь`
            : `"${draft.term}" ditambahkan ke Vault`,
      });

      // Background persistence + silent optional-field enrichment
      const targetUserId = user.id;
      void runCloudMutation(() => saveWordEntry(draft, targetUserId))
        .then((saved) => {
          if (saved.id !== draft.id) {
            setWords((prev) =>
              prev.map((w) => (w.id === draft.id ? saved : w))
            );
          }
          void silentlyEnrichWordIfNeeded(saved, targetUserId);
        })
        .catch((err) => {
          console.error(
            "[LexiVault] Background addSuggestedWordToVault failed:",
            err
          );
        });
      void enqueueWordsAddedLog(targetUserId, 1);

      return draft;
    },
    [
      enqueueWordsAddedLog,
      lang,
      runCloudMutation,
      silentlyEnrichWordIfNeeded,
      user,
    ]
  );

  const refreshWordWithAI = useCallback(
    async (
      wordId: string,
      options?: { signal?: AbortSignal }
    ): Promise<RefreshWordResult> => {
      const isEn = lang === "en";
      const isRu = lang === "ru";
      if (options?.signal?.aborted) {
        return { ok: false, aborted: true };
      }
      if (!user) {
        return {
          ok: false,
          error: isEn
            ? "Not signed in."
            : isRu
              ? "Вход не выполнен."
              : "Belum login.",
        };
      }
      const target = wordsRef.current.find((w) => w.id === wordId);
      if (!target) {
        return {
          ok: false,
          error: isEn
            ? "Word not found."
            : isRu
              ? "Слово не найдено."
              : "Kata tidak ditemukan.",
        };
      }

      try {
        const res = await fetch("/api/autofill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: options?.signal,
          body: JSON.stringify({
            term: target.term,
            sourceTag: normalizeSourceTag(target.source_tag),
            lang,
            skipDuplicateCheck: true,
          }),
        });
        if (!res.ok) {
          let apiCode = "";
          let apiError = "";
          let apiMessage = "";
          try {
            const errJson = (await res.json()) as {
              error?: string;
              code?: string;
              message?: string;
              detail?: string;
            };
            apiCode = errJson.code ?? "";
            apiError = errJson.error ?? "";
            apiMessage = errJson.message ?? "";
            if (apiError !== "NOT_ENGLISH" && apiCode !== "NOT_ENGLISH") {
              console.error(
                `[LexiVault] refreshWordWithAI failed (HTTP ${res.status}, code=${apiCode || "unknown"}):`,
                errJson.detail || apiMessage || apiError || res.statusText
              );
            }
          } catch {
            // Non-JSON error
          }
          if (apiCode === "NOT_ENGLISH" || apiError === "NOT_ENGLISH") {
            return {
              ok: false,
              error:
                (apiError && apiError !== "NOT_ENGLISH" ? apiError : "") ||
                apiMessage ||
                "Please enter a valid English word, idiom, or collocation.",
            };
          }
          return {
            ok: false,
            error: formatGeminiClientError(
              apiCode,
              res.status,
              apiMessage ||
                apiError ||
                (isEn
                  ? `Failed to refresh details with AI (HTTP ${res.status}).`
                  : isRu
                    ? `Не удалось обновить карточку через ИИ (HTTP ${res.status}).`
                    : `Gagal memperbarui dengan AI (HTTP ${res.status}).`),
              lang
            ),
          };
        }

        const json = (await res.json()) as {
          data: AutofillPayload;
          source: "gemini" | "fallback";
        };
        if (options?.signal?.aborted) {
          return { ok: false, aborted: true };
        }
        const aiData = json.data;
        const latestTarget =
          wordsRef.current.find((w) => w.id === wordId) ?? target;

        const merged: WordEntry = {
          ...latestTarget,
          term: aiData.term,
          pronunciation: aiData.pronunciation || latestTarget.pronunciation,
          ipa: aiData.ipa || latestTarget.ipa,
          cefr: aiData.cefr || latestTarget.cefr,
          type: aiData.type,
          meaning_id:
            lang === "ru"
              ? latestTarget.meaning_id || aiData.meaning_id
              : aiData.meaning_id || latestTarget.meaning_id,
          meaning_en: aiData.meaning_en || latestTarget.meaning_en,
          meaning_ru: aiData.meaning_ru || latestTarget.meaning_ru,
          examples_json: aiData.examples,
          synonyms: aiData.synonyms,
          antonyms: aiData.antonyms,
          word_families_json:
            aiData.type === "idiom" ? [] : aiData.word_families,
          chunks:
            aiData.chunks && aiData.chunks.length > 0
              ? aiData.chunks
              : latestTarget.chunks ?? [],
          register: aiData.register,
        };

        const updated = await runCloudMutation(() =>
          updateWordEntry(merged, user.id)
        );
        wordsRef.current = wordsRef.current.map((w) =>
          w.id === wordId ? updated : w
        );
        setWords((prev) =>
          prev.map((w) => (w.id === wordId ? updated : w))
        );
        setSelectedWord((prev) =>
          prev && prev.id === wordId ? updated : prev
        );

        return { ok: true, source: json.source };
      } catch (err) {
        if (
          options?.signal?.aborted ||
          (err &&
            typeof err === "object" &&
            "name" in err &&
            (err as { name?: string }).name === "AbortError")
        ) {
          return { ok: false, aborted: true };
        }
        console.error("[LexiVault] refreshWordWithAI failed:", err);
        return {
          ok: false,
          error: isEn
            ? "Failed to refresh details with AI."
            : isRu
              ? "Не удалось обновить карточку через ИИ."
              : "Gagal memperbarui dengan AI.",
        };
      }
    },
    [lang, runCloudMutation, user]
  );

  const cancelBatchRefreshAllWords = useCallback(() => {
    batchRefreshAbortRef.current?.abort();
  }, []);

  const resetBatchRefreshStatus = useCallback(() => {
    if (batchRefreshRunningRef.current) return;
    setBatchRefresh(INITIAL_BATCH_REFRESH_STATE);
  }, []);

  const startBatchRefreshAllWords = useCallback(async () => {
    if (batchRefreshRunningRef.current || !userRef.current) return;
    const queue = [...wordsRef.current];
    if (queue.length === 0) return;

    const abortController = new AbortController();
    batchRefreshAbortRef.current = abortController;
    batchRefreshRunningRef.current = true;

    let updatedCount = 0;
    let failedCount = 0;

    setBatchRefresh({
      status: "running",
      currentIndex: 1,
      completedCount: 0,
      total: queue.length,
      currentTerm: queue[0].term,
      updatedCount: 0,
      failedCount: 0,
    });

    try {
      for (let i = 0; i < queue.length; i += 1) {
        if (abortController.signal.aborted) break;
        const item = queue[i];

        setBatchRefresh({
          status: "running",
          currentIndex: i + 1,
          completedCount: i,
          total: queue.length,
          currentTerm: item.term,
          updatedCount,
          failedCount,
        });

        let res = await refreshWordWithAI(item.id, {
          signal: abortController.signal,
        });

        // Gentle single retry if a transient rate-limit (429) or overload occurred mid-batch
        if (
          !res.ok &&
          !res.aborted &&
          !abortController.signal.aborted &&
          res.error &&
          /429|rate limit|batas permintaan|sibuk|high demand|лимит|перегружен/i.test(
            res.error
          )
        ) {
          await sleepAbortable(
            BATCH_REFRESH_429_BACKOFF_MS,
            abortController.signal
          );
          if (!abortController.signal.aborted) {
            res = await refreshWordWithAI(item.id, {
              signal: abortController.signal,
            });
          }
        }

        if (abortController.signal.aborted || res.aborted) {
          break;
        }

        if (res.ok) {
          updatedCount += 1;
        } else {
          failedCount += 1;
        }

        setBatchRefresh({
          status: "running",
          currentIndex: i + 1,
          completedCount: i + 1,
          total: queue.length,
          currentTerm: item.term,
          updatedCount,
          failedCount,
        });

        if (i < queue.length - 1 && !abortController.signal.aborted) {
          await sleepAbortable(BATCH_REFRESH_DELAY_MS, abortController.signal);
        }
      }
    } finally {
      const wasCancelled = abortController.signal.aborted;
      batchRefreshRunningRef.current = false;
      batchRefreshAbortRef.current = null;

      if (!wasCancelled && updatedCount > 0) {
        playCorrectChime(2);
      }

      setBatchRefresh((prev) => ({
        ...prev,
        status: wasCancelled ? "cancelled" : "done",
        completedCount: wasCancelled ? prev.completedCount : queue.length,
        updatedCount,
        failedCount,
      }));
    }
  }, [refreshWordWithAI]);

  const cancelTranslateMissingRuMeanings = useCallback(() => {
    ruTranslateAbortRef.current?.abort();
  }, []);

  const resetRuBatchTranslateStatus = useCallback(() => {
    if (ruTranslateRunningRef.current) return;
    setRuBatchTranslate(INITIAL_RU_BATCH_TRANSLATE_STATE);
  }, []);

  const startTranslateMissingRuMeanings = useCallback(async () => {
    if (ruTranslateRunningRef.current || !userRef.current) return;
    const activeUserId = userRef.current.id;
    const missingWords = wordsRef.current.filter((w) => !w.meaning_ru?.trim());
    if (missingWords.length === 0) return;

    const abortController = new AbortController();
    ruTranslateAbortRef.current = abortController;
    ruTranslateRunningRef.current = true;

    let completedCount = 0;
    let translatedCount = 0;
    let failedCount = 0;
    let stopStatus: RuBatchTranslateState["status"] = "done";
    let stopError: string | undefined;

    setRuBatchTranslate({
      status: "running",
      completedCount: 0,
      total: missingWords.length,
      translatedCount: 0,
      failedCount: 0,
    });

    try {
      for (
        let offset = 0;
        offset < missingWords.length;
        offset += RU_TRANSLATE_BATCH_SIZE
      ) {
        if (abortController.signal.aborted) {
          stopStatus = "cancelled";
          break;
        }

        const chunk = missingWords.slice(
          offset,
          offset + RU_TRANSLATE_BATCH_SIZE
        );

        let res: Response;
        try {
          res = await fetch("/api/translate-ru", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abortController.signal,
            body: JSON.stringify({
              items: chunk.map((w) => ({
                id: w.id,
                term: w.term,
                meaning_en: w.meaning_en || w.meaning_id || w.term,
                type: w.type,
              })),
            }),
          });
        } catch (err) {
          if (
            abortController.signal.aborted ||
            (err &&
              typeof err === "object" &&
              "name" in err &&
              (err as { name?: string }).name === "AbortError")
          ) {
            stopStatus = "cancelled";
            break;
          }
          stopStatus = "error";
          stopError = "Не удалось подключиться к ИИ. Попробуй снова чуть позже.";
          break;
        }

        if (!res.ok) {
          let apiCode: string | undefined;
          let apiError = "";
          try {
            const errJson = (await res.json()) as {
              code?: string;
              error?: string;
              message?: string;
            };
            apiCode = errJson.code;
            apiError = errJson.error || errJson.message || "";
          } catch {
            // ignore
          }

          if (
            res.status === 429 ||
            res.status === 503 ||
            apiCode === "rate_limit" ||
            apiCode === "quota" ||
            apiCode === "overload"
          ) {
            stopStatus = "rate_limited";
            stopError =
              "Достигнут лимит запросов ИИ — переведённые слова сохранены. Продолжи через минуту.";
            break;
          }

          stopStatus = "error";
          stopError = formatGeminiClientError(
            apiCode,
            res.status,
            apiError || `Ошибка перевода (HTTP ${res.status}).`,
            "ru"
          );
          break;
        }

        const json = (await res.json()) as {
          translations?: Array<{ id: string; meaning_ru: string }>;
        };
        const returnedMap = new Map<string, string>();
        for (const item of json.translations ?? []) {
          if (item?.id && item.meaning_ru?.trim()) {
            returnedMap.set(item.id, item.meaning_ru.trim());
          }
        }

        for (const targetWord of chunk) {
          if (abortController.signal.aborted) break;
          const ruText = returnedMap.get(targetWord.id);
          if (ruText) {
            const latest =
              wordsRef.current.find((w) => w.id === targetWord.id) ??
              targetWord;
            const updatedEntry = await runCloudMutation(() =>
              updateWordEntry({ ...latest, meaning_ru: ruText }, activeUserId)
            );
            wordsRef.current = wordsRef.current.map((w) =>
              w.id === targetWord.id ? updatedEntry : w
            );
            setWords((prev) =>
              prev.map((w) => (w.id === targetWord.id ? updatedEntry : w))
            );
            setSelectedWord((prev) =>
              prev && prev.id === targetWord.id ? updatedEntry : prev
            );
            translatedCount += 1;
          } else {
            failedCount += 1;
          }
        }

        completedCount = Math.min(
          missingWords.length,
          offset + chunk.length
        );

        setRuBatchTranslate({
          status: "running",
          completedCount,
          total: missingWords.length,
          translatedCount,
          failedCount,
        });

        if (
          offset + RU_TRANSLATE_BATCH_SIZE < missingWords.length &&
          !abortController.signal.aborted
        ) {
          await sleepAbortable(
            RU_TRANSLATE_BATCH_DELAY_MS,
            abortController.signal
          );
        }
      }
    } finally {
      const wasCancelled =
        abortController.signal.aborted || stopStatus === "cancelled";
      ruTranslateRunningRef.current = false;
      ruTranslateAbortRef.current = null;

      if (!wasCancelled && stopStatus === "done" && translatedCount > 0) {
        playCorrectChime(2);
      }

      setRuBatchTranslate({
        status: wasCancelled ? "cancelled" : stopStatus,
        completedCount,
        total: missingWords.length,
        translatedCount,
        failedCount,
        error: stopError,
      });
    }
  }, [runCloudMutation]);

  // 0ms optimistic save from Discover (NEVER calls /api/autofill before insert)
  const saveDiscoveryItemToVault = useCallback(
    async (item: DiscoveryItem): Promise<WordEntry | null> => {
      if (!user) return null;
      const existing = findLocalDuplicateWord(item.term, wordsRef.current);
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
        meaning_ru: item.meaning_ru,
        examples_json: item.examples_json,
        synonyms: item.synonyms,
        antonyms: item.antonyms,
        word_families_json: item.word_families_json,
        chunks: item.chunks ?? [],
        register: item.register,
        source_tag: "discover",
        audio_us_url: null,
        audio_uk_url: null,
        correct_count: 0,
        wrong_count: 0,
        last_practiced_at: null,
        last_reviewed_date: null,
        review_count: 0,
        next_review_at: nowIso,
        interval_days: 0,
        ease_factor: 2.5,
        repetitions: 0,
        created_at: nowIso,
      };

      // Synchronous 0ms UI update
      wordsRef.current = [
        draft,
        ...wordsRef.current.filter((w) => w.id !== draft.id),
      ];
      setWords((prev) => [draft, ...prev.filter((w) => w.id !== draft.id)]);

      // Background persistence + silent enrichment if optional fields are missing
      const targetUserId = user.id;
      void runCloudMutation(() => saveWordEntry(draft, targetUserId))
        .then((saved) => {
          if (saved.id !== draft.id) {
            setWords((prev) =>
              prev.map((w) => (w.id === draft.id ? saved : w))
            );
          }
          void silentlyEnrichWordIfNeeded(saved, targetUserId);
        })
        .catch((err) => {
          console.error(
            "[LexiVault] Background saveDiscoveryItemToVault failed:",
            err
          );
        });
      void enqueueWordsAddedLog(targetUserId, 1);

      return draft;
    },
    [
      enqueueWordsAddedLog,
      runCloudMutation,
      silentlyEnrichWordIfNeeded,
      user,
    ]
  );

  const removeWord = useCallback(
    async (id: string) => {
      if (!user) return;
      setWords((prev) => prev.filter((w) => w.id !== id));
      setSelectedWord((prev) => (prev?.id === id ? null : prev));
      await runCloudMutation(() => deleteWordEntry(id, user.id));
    },
    [runCloudMutation, user]
  );

  const recordAnswer = useCallback(
    async (wordId: string, isCorrect: boolean) => {
      if (!user) return;
      const target = wordsRef.current.find((w) => w.id === wordId);
      if (!target) {
        const { updatedLog, newXp } = await runCloudMutation(() =>
          recordPracticeAttempt(
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
              source_tag: "discover",
              correct_count: 0,
              wrong_count: 0,
              created_at: new Date().toISOString(),
            },
            isCorrect,
            todayStr,
            user.id
          )
        );
        setStudyLogs((prev) => [
          updatedLog,
          ...prev.filter((l) => l.study_date !== updatedLog.study_date),
        ]);
        setXp(newXp);
        return;
      }

      const nowIso = new Date().toISOString();
      const prevReps =
        typeof target.repetitions === "number" &&
        Number.isFinite(target.repetitions)
          ? Math.max(0, Math.floor(target.repetitions))
          : 0;
      const optimisticWord: WordEntry = {
        ...target,
        correct_count: target.correct_count + (isCorrect ? 1 : 0),
        wrong_count: target.wrong_count + (isCorrect ? 0 : 1),
        last_practiced_at: nowIso,
        review_count:
          Math.max(
            target.review_count ?? 0,
            (target.correct_count || 0) + (target.wrong_count || 0)
          ) + 1,
        last_reviewed_date: isCorrect
          ? todayStr
          : target.last_reviewed_date ?? null,
        repetitions: isCorrect ? prevReps + 1 : 0,
      };

      wordsRef.current = wordsRef.current.map((w) =>
        w.id === wordId ? optimisticWord : w
      );
      setWords((prev) =>
        prev.map((w) => (w.id === wordId ? optimisticWord : w))
      );
      setSelectedWord((prev) =>
        prev && prev.id === wordId ? optimisticWord : prev
      );

      const { updatedWord, updatedLog, newXp } = await runCloudMutation(() =>
        recordPracticeAttempt(target, isCorrect, todayStr, user.id)
      );

      wordsRef.current = wordsRef.current.map((w) =>
        w.id === wordId ? updatedWord : w
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
    [runCloudMutation, todayStr, user]
  );

  const recordSm2Review = useCallback(
    async (wordId: string, rating: Sm2Rating) => {
      if (!user) return;
      const target = wordsRef.current.find((w) => w.id === wordId);
      if (!target) return;

      const { updatedWord, updatedLog, newXp } = await runCloudMutation(() =>
        recordSm2ReviewAttempt(target, rating, todayStr, user.id)
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
    [runCloudMutation, todayStr, user]
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
    [setActiveTab]
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
        const nextXp = await runCloudMutation(() => addUserXp(user.id, xpDelta));
        setXp(nextXp);
      }
    },
    [runCloudMutation, user]
  );

  const streak = useMemo(
    () => (isHydrated ? calculateStreak(studyLogs, todayStr) : 0),
    [isHydrated, studyLogs, todayStr]
  );

  const effectiveCefr = useMemo<CefrLevel>(() => {
    if (userCefr) return userCefr;
    if (placementCefr) return placementCefr;
    if (dailyQuota.targetLevel !== "auto") {
      return getDailyPackTierMeta(dailyQuota.targetLevel).cefrPair[0];
    }
    return "B1";
  }, [dailyQuota.targetLevel, placementCefr, userCefr]);

  const cefrPromotion = useMemo(
    () =>
      computeCefrPromotionStatus({
        currentLevel: effectiveCefr,
        words,
        studyLogs,
        streak,
      }),
    [effectiveCefr, streak, studyLogs, words]
  );

  const masteryRankInfo = useMemo(() => getMasteryRankInfo(xp), [xp]);

  const dueWordsCount = useMemo(
    () => (isHydrated ? getDueWords(words, Date.now(), todayStr).length : 0),
    [isHydrated, todayStr, words]
  );

  const hasDemoWords = useMemo(
    () => words.some((w) => w.id.startsWith("mock-word-")),
    [words]
  );

  const openStreakCalendar = useCallback(() => {
    setStreakFocusNonce((n) => n + 1);
    setActiveTab("stats");
  }, [setActiveTab]);

  const launchCommuteMode = useCallback(() => {
    setCommuteLaunchNonce((n) => n + 1);
    setActiveTab("practice");
  }, [setActiveTab]);

  const clearCommuteLaunch = useCallback(() => {
    setCommuteLaunchNonce(0);
  }, []);

  const resetDemoData = useCallback(async () => {
    if (!user) return;
    const cleaned = await runCloudMutation(() =>
      clearDemoData(todayStr, user.id)
    );
    setWords(cleaned.words);
    setStudyLogs(cleaned.studyLogs);
    setSelectedWord(null);
  }, [runCloudMutation, todayStr, user]);

  const updateRingTargets = useCallback(
    (patch: Partial<DailyRingTargets>) => {
      const activeUser = userRef.current;
      setRingTargets((prev) => {
        const next = writeCustomRingTargets({ ...prev, ...patch });
        if (activeUser) {
          void runCloudMutation(() =>
            saveCloudUserSettings(activeUser.id, { ringTargets: next })
          );
        }
        return next;
      });
    },
    [runCloudMutation]
  );

  const resetRingTargets = useCallback(() => {
    const activeUser = userRef.current;
    const next = writeCustomRingTargets(DAILY_RING_TARGETS);
    setRingTargets(next);
    if (activeUser) {
      void runCloudMutation(() =>
        saveCloudUserSettings(activeUser.id, { ringTargets: next })
      );
    }
  }, [runCloudMutation]);

  const changePassword = useCallback(
    async (newPassword: string): Promise<AuthActionResult> => {
      if (!user) {
        return {
          ok: false,
          error:
            lang === "en"
              ? "User is not signed in."
              : lang === "ru"
                ? "Пользователь не вошёл в аккаунт."
                : "Pengguna belum masuk.",
        };
      }
      return changeUserPassword(user, newPassword, lang);
    },
    [lang, user]
  );

  const continueAsGuest = useCallback(() => {
    const guest = continueAsGuestSession();
    setShowAuthModal(false);
    setAuthInitialMode("login");
    setUser(guest);
    setActiveTab("vault");
  }, [setActiveTab]);

  const forceSyncNow = useCallback(async (): Promise<{
    ok: boolean;
    uploadedCount: number;
    totalWords: number;
    error?: string;
  }> => {
    const activeUser = userRef.current;
    if (!activeUser || activeUser.provider !== "supabase") {
      return {
        ok: false,
        uploadedCount: 0,
        totalWords: wordsRef.current.length,
        error:
          lang === "en"
            ? "Sign in with a Cloud account to sync with Supabase."
            : lang === "ru"
              ? "Войди в облачный аккаунт для синхронизации с Supabase."
              : "Masuk dengan akun Cloud untuk menyinkronkan ke Supabase.",
      };
    }

    setIsForceSyncing(true);
    setSyncStatus("syncing");
    try {
      const localToday = getLocalDateString();
      const res = await forceSyncVaultToCloud(localToday, activeUser.id, {
        username: activeUser.username,
        inMemoryWords: wordsRef.current,
      });

      setWords(res.state.words);
      setStudyLogs(res.state.studyLogs);
      setXp(res.state.xp);
      setDailyQuota(res.state.dailyQuota);
      setRingTargets(res.state.ringTargets);
      setDailyPack(res.state.dailyPack);
      setSyncMode(res.state.syncMode);
      setSyncError(res.error);
      setSyncStatus(res.ok ? "synced" : "error");

      return {
        ok: res.ok,
        uploadedCount: res.uploadedCount,
        totalWords: res.totalWords,
        error: res.error?.formatted,
      };
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err ?? "Sync failed");
      setSyncStatus("error");
      return {
        ok: false,
        uploadedCount: 0,
        totalWords: wordsRef.current.length,
        error: msg,
      };
    } finally {
      setIsForceSyncing(false);
    }
  }, [lang]);

  const openRegisterFromGuest = useCallback(() => {
    if (
      userRef.current?.provider === "guest" &&
      typeof window !== "undefined"
    ) {
      try {
        window.localStorage.setItem(
          PENDING_GUEST_UPGRADE_KEY,
          userRef.current.id
        );
      } catch {
        // Ignore storage error
      }
    }
    setAuthInitialMode("register");
    setShowAuthModal(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setShowAuthModal(false);
    setAuthInitialMode("login");
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(PENDING_GUEST_UPGRADE_KEY);
      } catch {
        // Ignore storage error
      }
    }
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
        setShowAuthModal(false);
        setAuthInitialMode("login");
        setUser(res.user);
        setActiveTab("vault");
        return { ok: true };
      }
      return { ok: false, error: res.error };
    },
    [lang, setActiveTab]
  );

  const register = useCallback(
    async (
      username: string,
      password: string,
      rememberMe: boolean
    ): Promise<AuthActionResult> => {
      const upgradingGuestId =
        userRef.current?.provider === "guest" ? userRef.current.id : null;
      const guestAlreadyMetLexi = upgradingGuestId
        ? hasUserMetLexi(upgradingGuestId)
        : false;
      if (upgradingGuestId && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            PENDING_GUEST_UPGRADE_KEY,
            upgradingGuestId
          );
        } catch {
          // Ignore storage error
        }
      }
      if (!guestAlreadyMetLexi) {
        pendingLexiIntroRef.current = true;
        onboardingFlowActiveRef.current = true;
      }
      const res = await signUpWithUsername(
        username,
        password,
        rememberMe,
        lang
      );
      if (res.user) {
        if (guestAlreadyMetLexi) {
          markUserMetLexi(res.user.id);
        } else {
          justRegisteredUserIdRef.current = res.user.id;
          if (typeof window !== "undefined") {
            try {
              window.sessionStorage.setItem(
                pendingLexiIntroSessionKey(res.user.id),
                "1"
              );
            } catch {
              // Ignore sessionStorage restrictions
            }
          }
        }
        if (res.user.provider === "supabase") {
          await seedStarterWordsForSupabaseUser(
            getLocalDateString(),
            res.user.id
          );
        }
        setShowAuthModal(false);
        setAuthInitialMode("login");
        setUser(res.user);
        setActiveTab("vault");
        return { ok: true };
      }
      pendingLexiIntroRef.current = false;
      onboardingFlowActiveRef.current = false;
      return { ok: false, error: res.error };
    },
    [lang, setActiveTab]
  );

  const logout = useCallback(async () => {
    batchRefreshAbortRef.current?.abort();
    batchRefreshAbortRef.current = null;
    batchRefreshRunningRef.current = false;
    ruTranslateAbortRef.current?.abort();
    ruTranslateAbortRef.current = null;
    ruTranslateRunningRef.current = false;
    pendingLexiIntroRef.current = false;
    justRegisteredUserIdRef.current = null;
    onboardingFlowActiveRef.current = false;
    setBatchRefresh(INITIAL_BATCH_REFRESH_STATE);
    setRuBatchTranslate(INITIAL_RU_BATCH_TRANSLATE_STATE);
    await signOutUser();
    setShowAuthModal(false);
    setAuthInitialMode("login");
    setUser(null);
    setWords([]);
    setStudyLogs([]);
    setXp(0);
    setDailyPack(null);
    setDailyPackModalOpen(false);
    setWhatsNewRelease(null);
    whatsNewCheckedKeyRef.current = null;
    setSelectedWord(null);
    setLexiCheerToast(null);
    pendingDailyPackTreatDateRef.current = null;
    setSyncError(null);
    clearLastSupabaseSyncError();
    setActiveTab("vault");
  }, [setActiveTab]);

  // Sync global modals (Word Detail & Daily Pack) with Browser / Mobile Back button
  const wordDetailOpen = Boolean(selectedWord);
  const prevWordDetailOpenRef = useRef(false);
  useEffect(() => {
    return registerOverlayHistory("word_detail", () => setSelectedWord(null));
  }, [registerOverlayHistory]);
  useEffect(() => {
    if (wordDetailOpen && !prevWordDetailOpenRef.current) {
      openOverlayHistory("word_detail");
    } else if (!wordDetailOpen && prevWordDetailOpenRef.current) {
      closeOverlayHistory("word_detail");
    }
    prevWordDetailOpenRef.current = wordDetailOpen;
  }, [wordDetailOpen, openOverlayHistory, closeOverlayHistory]);

  const prevDailyPackOpenRef = useRef(false);
  useEffect(() => {
    return registerOverlayHistory("daily_pack", () => {
      setDailyPackModalOpen(false);
    });
  }, [registerOverlayHistory]);
  useEffect(() => {
    if (dailyPackModalOpen && !prevDailyPackOpenRef.current) {
      openOverlayHistory("daily_pack");
    } else if (!dailyPackModalOpen && prevDailyPackOpenRef.current) {
      closeOverlayHistory("daily_pack");
    }
    prevDailyPackOpenRef.current = dailyPackModalOpen;
  }, [dailyPackModalOpen, openOverlayHistory, closeOverlayHistory]);

  const value: LexiVaultContextValue = {
    user,
    isAuthChecked,
    isHydrated,
    todayStr,
    activeTab,
    setActiveTab,
    registerOverlayHistory,
    openOverlayHistory,
    closeOverlayHistory,
    accent,
    setAccent,
    words,
    studyLogs,
    syncMode,
    syncStatus,
    syncError,
    isForceSyncing,
    forceSyncNow,
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
    dailyQuota,
    updateDailyQuota,
    placementCefr,
    userCefr,
    effectiveCefr,
    cefrOnboardingCompleted,
    showCefrOnboarding,
    cefrOnboardingInitialStep,
    isLexiIntroOpen: showLexiIntro || previewLexiIntro,
    completeLexiIntro,
    activeWhatsNewRelease,
    isWhatsNewOpen: Boolean(activeWhatsNewRelease),
    acknowledgeWhatsNew,
    lexiEnabled,
    setLexiEnabled,
    toggleLexiEnabled,
    lexiCompanion,
    lexiBondInfo,
    isLexiHappyBoosted,
    petLexi,
    feedLexiTreat,
    awardLexiMilestoneTreat,
    lexiCheerToast,
    triggerLexiCheer,
    clearLexiCheerToast,
    cefrPromotion,
    completeCefrOnboarding,
    dismissCefrOnboarding,
    levelUpCefr,
    placementLaunchNonce,
    launchPlacementTest,
    clearPlacementLaunch,
    celebrationToast,
    clearCelebrationToast,
    resolvedDailyPackTier,
    applyPlacementLevel,
    dailyPack,
    isDailyPackLoading,
    dailyPackError,
    dailyPackModalOpen,
    setDailyPackModalOpen,
    openDailyPackModal,
    dismissDailyPackForSession,
    ensureDailyPackLoaded,
    applyQuotaToTodayPack,
    completeDailyPackItem,
    recordDailyPackWrongAttempt,
    addWordViaAI,
    addExtractedWordsBatch,
    addSuggestedWordToVault,
    refreshWordWithAI,
    batchRefresh,
    startBatchRefreshAllWords,
    cancelBatchRefreshAllWords,
    resetBatchRefreshStatus,
    ruBatchTranslate,
    startTranslateMissingRuMeanings,
    cancelTranslateMissingRuMeanings,
    resetRuBatchTranslateStatus,
    saveDiscoveryItemToVault,
    removeWord,
    recordAnswer,
    recordSm2Review,
    syncExternalStudyLog,
    grantXpAndSyncLog,
    updateWordAudioUrl,
    authInitialMode,
    showAuthModal,
    ringTargets,
    updateRingTargets,
    resetRingTargets,
    changePassword,
    continueAsGuest,
    openRegisterFromGuest,
    closeAuthModal,
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

/**
 * Integrates any modal, drawer, or active session with Browser / Mobile Back.
 * Pushing a history state on open and closing cleanly on `popstate` (or popping on UI close).
 */
export function useOverlayBackGuard(
  overlayId: string,
  isOpen: boolean,
  onClose: () => void
) {
  const { registerOverlayHistory, openOverlayHistory, closeOverlayHistory } =
    useLexiVault();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const wasOpenRef = useRef(false);

  useEffect(() => {
    return registerOverlayHistory(overlayId, () => onCloseRef.current());
  }, [overlayId, registerOverlayHistory]);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      openOverlayHistory(overlayId);
    } else if (!isOpen && wasOpenRef.current) {
      closeOverlayHistory(overlayId);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, overlayId, openOverlayHistory, closeOverlayHistory]);
}
