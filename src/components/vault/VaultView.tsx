"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpDown,
  BookMarked,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Flame,
  PauseCircle,
  Play,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { CefrRecommendationBanner } from "@/components/gamification/CefrRecommendationBanner";
import { LexiStatusCard } from "@/components/LexiStatusCard";
import { ShimmerWordSkeleton } from "@/components/ui/ShimmerWordSkeleton";
import { AiSuggestSheet } from "@/components/vault/AiSuggestSheet";
import { DailyPackModal } from "@/components/vault/DailyPackModal";
import { QuickCaptureBar } from "@/components/vault/QuickCaptureBar";
import { TextExtractorSheet } from "@/components/vault/TextExtractorSheet";
import { VaultWordCard } from "@/components/vault/VaultWordCard";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault, useOverlayBackGuard } from "@/context/LexiVaultContext";
import { formatDailyPackTierLabel } from "@/lib/dailyPackTiers";
import { IOS_SPRING, STAGGER_CONTAINER, TAP_SCALE } from "@/lib/motion";
import { playCorrectChime, playGlassClick } from "@/lib/soundEffects";
import {
  ALL_CEFR_LEVELS,
  cn,
  formatCefrBadgeClass,
  formatSourceTagLabel,
  normalizeCefrLevel,
  normalizeSourceTag,
  normalizeTermKey,
} from "@/lib/utils";
import {
  isValidVaultSortOption,
  sortVaultWords,
  VAULT_SORT_OPTIONS,
  VAULT_SORT_STORAGE_KEY,
  type VaultSortOption,
} from "@/lib/vaultSort";
import type { CefrLevel, RegisterType, WordType } from "@/types/lexivault";

type TypeFilter = "all" | WordType;
type RegisterFilter = "all" | RegisterType;
type CefrFilter = "all" | CefrLevel;

function getStarterMissionDismissKey(userId?: string | null): string {
  return `lexivault_starter_missions_v1_${userId || "guest"}`;
}

export function VaultView() {
  const {
    user,
    words,
    studyLogs,
    todayStr,
    isCapturing,
    isHydrated,
    dailyPack,
    dailyQuota,
    resolvedDailyPackTier,
    openDailyPackModal,
    launchCommuteMode,
    lexiEnabled,
    setLexiEnabled,
    lexiCompanion,
    setActiveTab,
  } = useLexiVault();
  const { lang, t } = useLanguage();

  const dailyPackSummary = useMemo(() => {
    const quotaTotal = dailyQuota.wordsPerDay + dailyQuota.idiomsPerDay;
    const isPaused = quotaTotal === 0;
    const todayPack =
      dailyPack && dailyPack.pack_date === todayStr ? dailyPack : null;
    const total =
      todayPack && todayPack.items.length > 0
        ? todayPack.items.length
        : quotaTotal;
    const completedSet = new Set(todayPack?.completed_terms ?? []);
    const completed = todayPack
      ? todayPack.items.filter((it) =>
          completedSet.has(normalizeTermKey(it.term))
        ).length
      : 0;
    const isComplete = total > 0 && todayPack !== null && completed >= total;
    const inProgress = completed > 0 && !isComplete;
    const pct =
      total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

    return { isPaused, total, completed, isComplete, inProgress, pct };
  }, [dailyPack, dailyQuota, todayStr]);

  const [pendingTerm, setPendingTerm] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [extractorOpen, setExtractorOpen] = useState(false);
  const [packFlameBurst, setPackFlameBurst] = useState(false);
  const [missionDismissed, setMissionDismissed] = useState(true);
  const [missionJustFinished, setMissionJustFinished] = useState(false);
  const [captureHighlight, setCaptureHighlight] = useState(false);
  const [lexiHighlight, setLexiHighlight] = useState(false);
  const packFlameTimerRef = useRef<number | null>(null);
  const quickCaptureWrapRef = useRef<HTMLDivElement>(null);
  const lexiCardWrapRef = useRef<HTMLDivElement>(null);
  const missionAutoDismissedRef = useRef(false);
  const missionDoneTimerRef = useRef<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (packFlameTimerRef.current !== null) {
        window.clearTimeout(packFlameTimerRef.current);
      }
      if (missionDoneTimerRef.current !== null) {
        window.clearTimeout(missionDoneTimerRef.current);
      }
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  const stepAddWord = useMemo(
    () =>
      studyLogs.some((l) => l.words_added > 0) ||
      words.some((w) => !w.id.startsWith("mock-word-")),
    [studyLogs, words]
  );

  const stepReviewCard = useMemo(
    () =>
      words.some(
        (w) => (w.review_count ?? 0) > 0 || w.last_reviewed_date !== null
      ) ||
      studyLogs.some(
        (l) => l.reviews_count > 0 || (l.recall_today ?? 0) > 0
      ),
    [studyLogs, words]
  );

  const stepPetLexi =
    lexiCompanion.hasPetted ||
    lexiCompanion.petsTotal > 0 ||
    lexiCompanion.treatsFedTotal > 0;

  const completedMissionsCount =
    (stepAddWord ? 1 : 0) + (stepReviewCard ? 1 : 0) + (stepPetLexi ? 1 : 0);
  const completedMissionsCountRef = useRef(completedMissionsCount);
  completedMissionsCountRef.current = completedMissionsCount;

  // Hydrate per-user starter mission dismissal state
  useEffect(() => {
    if (!isHydrated) return;
    missionAutoDismissedRef.current = false;
    setMissionJustFinished(false);
    const key = getStarterMissionDismissKey(user?.id);
    try {
      const stored = window.localStorage.getItem(key) === "1";
      if (!stored && completedMissionsCountRef.current === 3) {
        window.localStorage.setItem(key, "1");
        setMissionDismissed(true);
        return;
      }
      setMissionDismissed(stored);
    } catch {
      setMissionDismissed(false);
    }
  }, [isHydrated, user?.id]);

  // Auto-dismiss cleanly once user finishes all 3 starter steps live
  useEffect(() => {
    if (!isHydrated || missionDismissed || completedMissionsCount < 3) return;
    if (missionAutoDismissedRef.current) return;
    missionAutoDismissedRef.current = true;
    playCorrectChime(3);
    setMissionJustFinished(true);
    try {
      window.localStorage.setItem(getStarterMissionDismissKey(user?.id), "1");
    } catch {
      // Ignore storage restrictions
    }
    missionDoneTimerRef.current = window.setTimeout(() => {
      setMissionDismissed(true);
      setMissionJustFinished(false);
      missionDoneTimerRef.current = null;
    }, 1700);
  }, [completedMissionsCount, isHydrated, missionDismissed, user?.id]);

  const handleDismissMissions = useCallback(() => {
    playGlassClick();
    try {
      window.localStorage.setItem(getStarterMissionDismissKey(user?.id), "1");
    } catch {
      // Ignore storage restrictions
    }
    setMissionDismissed(true);
  }, [user?.id]);

  const handleMissionAddWord = useCallback(() => {
    playGlassClick();
    quickCaptureWrapRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    const input = quickCaptureWrapRef.current?.querySelector("input");
    if (input) {
      input.focus({ preventScroll: true });
    }
    setCaptureHighlight(true);
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setCaptureHighlight(false);
      highlightTimerRef.current = null;
    }, 1500);
  }, []);

  const handleMissionReviewCard = useCallback(() => {
    playGlassClick();
    setActiveTab("flashcards");
  }, [setActiveTab]);

  const handleMissionPetLexi = useCallback(() => {
    playGlassClick();
    if (!lexiEnabled) {
      setLexiEnabled(true);
    }
    window.requestAnimationFrame(() => {
      lexiCardWrapRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    setLexiHighlight(true);
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setLexiHighlight(false);
      highlightTimerRef.current = null;
    }, 1600);
  }, [lexiEnabled, setLexiEnabled]);

  const triggerPackFlameBurst = useCallback(() => {
    setPackFlameBurst(true);
    if (packFlameTimerRef.current !== null) {
      window.clearTimeout(packFlameTimerRef.current);
    }
    packFlameTimerRef.current = window.setTimeout(() => {
      setPackFlameBurst(false);
      packFlameTimerRef.current = null;
    }, 900);
  }, []);

  useOverlayBackGuard("ai_suggest", suggestOpen, () => setSuggestOpen(false));
  useOverlayBackGuard("text_extractor", extractorOpen, () =>
    setExtractorOpen(false)
  );
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [registerFilter, setRegisterFilter] = useState<RegisterFilter>("all");
  const [cefrFilter, setCefrFilter] = useState<CefrFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<VaultSortOption>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VAULT_SORT_STORAGE_KEY);
      if (isValidVaultSortOption(saved)) {
        setSortBy(saved);
      }
    } catch {
      // Ignore storage access errors in restricted browsing contexts.
    }
  }, []);

  useEffect(() => {
    if (!sortOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setSortOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSortOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [sortOpen]);

  const handleSelectSort = useCallback((nextSort: VaultSortOption) => {
    playGlassClick();
    setSortBy(nextSort);
    setSortOpen(false);
    try {
      window.localStorage.setItem(VAULT_SORT_STORAGE_KEY, nextSort);
    } catch {
      // Ignore storage access errors in restricted browsing contexts.
    }
  }, []);

  const currentSortOption = useMemo(
    () =>
      VAULT_SORT_OPTIONS.find((opt) => opt.id === sortBy) ??
      VAULT_SORT_OPTIONS[0],
    [sortBy]
  );

  const availableSources = useMemo(() => {
    const set = new Set<string>();
    for (const w of words) {
      set.add(normalizeSourceTag(w.source_tag));
    }
    return ["all", ...Array.from(set)];
  }, [words]);

  const filteredWords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return words.filter((word) => {
      if (typeFilter !== "all" && word.type !== typeFilter) return false;
      if (registerFilter !== "all" && word.register !== registerFilter)
        return false;
      if (
        cefrFilter !== "all" &&
        normalizeCefrLevel(word.cefr) !== cefrFilter
      )
        return false;
      if (
        sourceFilter !== "all" &&
        normalizeSourceTag(word.source_tag) !== sourceFilter
      )
        return false;

      if (!q) return true;
      return (
        word.term.toLowerCase().includes(q) ||
        word.meaning_id.toLowerCase().includes(q) ||
        (word.meaning_en?.toLowerCase().includes(q) ?? false) ||
        (word.cefr?.toLowerCase().includes(q) ?? false) ||
        word.synonyms.some((s) => s.toLowerCase().includes(q)) ||
        word.word_families_json.some((wf) => wf.word.toLowerCase().includes(q))
      );
    });
  }, [words, search, typeFilter, registerFilter, cefrFilter, sourceFilter]);

  const sortedWords = useMemo(
    () => sortVaultWords(filteredWords, sortBy),
    [filteredWords, sortBy]
  );

  const isFiltered =
    search.trim().length > 0 ||
    typeFilter !== "all" ||
    registerFilter !== "all" ||
    cefrFilter !== "all" ||
    sourceFilter !== "all";

  const resultsCountLabel = !isHydrated
    ? "—"
    : lang === "id"
      ? isFiltered || sortedWords.length !== words.length
        ? `Menampilkan ${sortedWords.length} dari ${words.length} item`
        : `Menampilkan ${sortedWords.length} item`
      : isFiltered || sortedWords.length !== words.length
        ? `Showing ${sortedWords.length} of ${words.length} ${words.length === 1 ? "item" : "items"}`
        : `Showing ${sortedWords.length} ${sortedWords.length === 1 ? "item" : "items"}`;

  return (
    <div className="space-y-5">
      {/* Header Title & Quick Actions */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0A84FF]">
            {t.vault.eyebrow}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F7]">
            {t.vault.title}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            onClick={() => {
              playGlassClick();
              setSuggestOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#5E5CE6] to-[#0A84FF] px-3.5 py-1.5 text-xs font-semibold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_4px_16px_rgba(94,92,230,0.38)] hover:brightness-110 transition-all cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t.vault.aiSuggestBtn}</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            onClick={() => {
              playGlassClick();
              setExtractorOpen(true);
            }}
            className="liquid-glass-pill inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-[#70BCFF] border-[#0A84FF]/35 hover:bg-[#0A84FF]/15 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>{t.vault.extractBtn}</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            onClick={launchCommuteMode}
            className="liquid-glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-[#7CF099] border-[#30D158]/30 hover:bg-[#30D158]/15 cursor-pointer"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{t.vault.commuteBtn}</span>
          </motion.button>

          <span className="liquid-glass-pill rounded-full px-3 py-1.5 text-xs font-semibold text-[#F5F5F7]">
            {isHydrated ? `${filteredWords.length} / ${words.length}` : "—"}
          </span>
        </div>
      </div>

      <AiSuggestSheet
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
      />

      <TextExtractorSheet
        open={extractorOpen}
        onClose={() => setExtractorOpen(false)}
      />

      <DailyPackModal />

      {/* Compact "First 3 Steps" Starter Mission Bar for New Users */}
      <AnimatePresence>
        {isHydrated && !missionDismissed && (
          <motion.section
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, scale: 0.985 }}
            transition={IOS_SPRING}
            aria-label={t.vault.starterMissions.title}
            className={cn(
              "liquid-glass rounded-3xl p-4 sm:px-5 sm:py-4 border transition-colors",
              missionJustFinished
                ? "border-[#30D158]/45 bg-[#30D158]/[0.08]"
                : "border-[#0A84FF]/30 bg-gradient-to-r from-[#0A84FF]/[0.07] via-white/[0.02] to-[#30D158]/[0.06]"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-white">
                    {t.vault.starterMissions.title}
                  </span>
                  <span className="rounded-full bg-[#0A84FF]/18 border border-[#0A84FF]/40 px-2 py-0.5 text-[10px] font-bold text-[#70BCFF] tabular-nums">
                    {completedMissionsCount}/3
                  </span>
                </div>
                <p className="text-[11px] text-[#8E8E93]">
                  {missionJustFinished
                    ? t.vault.starterMissions.completedToast
                    : t.vault.starterMissions.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={handleDismissMissions}
                aria-label={t.vault.starterMissions.dismissAria}
                className="shrink-0 rounded-full p-1 text-[#8E8E93] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  {
                    id: "add",
                    label: t.vault.starterMissions.stepAddWord,
                    done: stepAddWord,
                    onClick: handleMissionAddWord,
                  },
                  {
                    id: "review",
                    label: t.vault.starterMissions.stepReviewCard,
                    done: stepReviewCard,
                    onClick: handleMissionReviewCard,
                  },
                  {
                    id: "lexi",
                    label: t.vault.starterMissions.stepPetLexi,
                    done: stepPetLexi,
                    onClick: handleMissionPetLexi,
                  },
                ] as const
              ).map((mission, idx) => (
                <button
                  key={mission.id}
                  type="button"
                  onClick={mission.onClick}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-all cursor-pointer active:scale-[0.98]",
                    mission.done
                      ? "bg-[#30D158]/14 border-[#30D158]/40 text-[#A6F8BA]"
                      : "bg-white/[0.04] border-white/[0.1] text-[#F5F5F7] hover:bg-white/[0.08] hover:border-[#0A84FF]/40"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      mission.done
                        ? "bg-[#30D158] text-black"
                        : "bg-white/[0.08] text-[#8E8E93]"
                    )}
                  >
                    {mission.done ? (
                      <Check className="h-3 w-3 stroke-[2.75]" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 truncate",
                      mission.done && "line-through opacity-80"
                    )}
                  >
                    {mission.label}
                  </span>
                </button>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Lexi Companion Daily Vault Maintenance Card */}
      {lexiEnabled && (
        <div
          ref={lexiCardWrapRef}
          className={cn(
            "rounded-3xl transition-shadow duration-300",
            lexiHighlight &&
              "ring-2 ring-[#0A84FF]/70 shadow-[0_0_28px_rgba(10,132,255,0.35)]"
          )}
        >
          <LexiStatusCard />
        </div>
      )}

      {/* Persistent Daily Learning Pack CTA Card */}
      {isHydrated && (
        <div
          className={cn(
            "liquid-glass rounded-3xl p-4 sm:p-5 border transition-colors",
            dailyPackSummary.isComplete
              ? "border-[#30D158]/35 bg-[#30D158]/[0.06]"
              : dailyPackSummary.isPaused
                ? "border-white/[0.08]"
                : "border-[#FF9F0A]/30 bg-gradient-to-r from-[#FF9F0A]/[0.09] via-white/[0.03] to-[#0A84FF]/[0.09]"
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div
                onClick={
                  !dailyPackSummary.isComplete && !dailyPackSummary.isPaused
                    ? () => {
                        playGlassClick();
                        triggerPackFlameBurst();
                      }
                    : undefined
                }
                className={cn(
                  "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border overflow-visible",
                  dailyPackSummary.isComplete
                    ? "bg-[#30D158]/20 border-[#30D158]/40 text-[#7CF099]"
                    : dailyPackSummary.isPaused
                      ? "bg-white/[0.06] border-white/[0.1] text-[#8E8E93]"
                      : cn(
                          "lexi-flame-trigger cursor-pointer active:scale-95 transition-transform bg-gradient-to-br from-[#FF9F0A]/25 to-[#0A84FF]/25 border-[#FF9F0A]/35 text-[#FFD18C]",
                          packFlameBurst && "is-flaming"
                        )
                )}
              >
                {dailyPackSummary.isComplete ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : dailyPackSummary.isPaused ? (
                  <PauseCircle className="h-5 w-5" />
                ) : (
                  <>
                    <Flame className="h-5 w-5 lexi-flame-icon" />
                    <span
                      aria-hidden="true"
                      className="lexi-flame-spark lexi-flame-spark-1 absolute top-2 left-3.5 h-1.5 w-1.5 rounded-full bg-[#FFD18C]"
                    />
                    <span
                      aria-hidden="true"
                      className="lexi-flame-spark lexi-flame-spark-2 absolute top-1.5 right-3.5 h-1.5 w-1.5 rounded-full bg-[#FF9F0A]"
                    />
                    <span
                      aria-hidden="true"
                      className="lexi-flame-spark lexi-flame-spark-3 absolute top-1 left-1/2 h-1 w-1 rounded-full bg-[#FFE4B5]"
                    />
                    <span
                      aria-hidden="true"
                      className="lexi-flame-spark lexi-flame-spark-4 absolute top-2.5 right-2.5 h-1 w-1 rounded-full bg-[#FF6B35]"
                    />
                  </>
                )}
              </div>

              <div className="min-w-0 space-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#FF9F0A]">
                  {t.dailyPack.eyebrow}
                </p>
                <h3 className="text-sm sm:text-base font-bold text-white truncate">
                  {dailyPackSummary.isPaused
                    ? t.dailyPack.pausedTitle
                    : dailyPackSummary.isComplete
                      ? `${t.dailyPack.completedTitle} (${dailyPackSummary.completed}/${dailyPackSummary.total})`
                      : dailyPackSummary.inProgress
                        ? `${t.dailyPack.resumePrefix} (${dailyPackSummary.completed}/${dailyPackSummary.total})`
                        : `${t.dailyPack.readyPrefix} ${dailyPackSummary.completed}/${dailyPackSummary.total} ${t.dailyPack.readySuffix}`}
                </h3>
                <p className="text-xs text-[#8E8E93] truncate">
                  {dailyPackSummary.isPaused
                    ? t.dailyPack.pausedSubtitle
                    : `${dailyQuota.wordsPerDay} ${t.dailyPack.wordsCountLabel} · ${dailyQuota.idiomsPerDay} ${t.dailyPack.idiomsCountLabel} · ${formatDailyPackTierLabel(dailyQuota.targetLevel, resolvedDailyPackTier)}`}
                </p>
              </div>
            </div>

            {!dailyPackSummary.isPaused && (
              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                onClick={() => {
                  playGlassClick();
                  openDailyPackModal();
                }}
                className={cn(
                  "shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer",
                  dailyPackSummary.isComplete
                    ? "bg-[#30D158]/20 border border-[#30D158]/40 text-[#7CF099] hover:bg-[#30D158]/28"
                    : "bg-gradient-to-r from-[#FF9F0A] to-[#0A84FF] text-white shadow-[0_6px_20px_rgba(255,159,10,0.28)] hover:brightness-110"
                )}
              >
                {!dailyPackSummary.isComplete && (
                  <Play className="h-3.5 w-3.5 fill-current" />
                )}
                <span>
                  {dailyPackSummary.isComplete
                    ? t.dailyPack.reviewBtn
                    : dailyPackSummary.inProgress
                      ? t.dailyPack.resumeBtn
                      : t.dailyPack.startBtn}
                </span>
              </motion.button>
            )}
          </div>

          {!dailyPackSummary.isPaused && dailyPackSummary.inProgress && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <motion.div
                className="h-full w-full rounded-full bg-gradient-to-r from-[#FF9F0A] via-[#30D158] to-[#0A84FF] transform-gpu will-change-transform"
                style={{ transformOrigin: "left" }}
                initial={false}
                animate={{ scaleX: Math.max(0.05, dailyPackSummary.pct / 100) }}
                transition={IOS_SPRING}
              />
            </div>
          )}
        </div>
      )}

      {/* Automatic Next-Level CEFR Recommendation Banner */}
      <CefrRecommendationBanner variant="vault" />

      {/* Floating Quick-Capture Input Bar */}
      <div
        ref={quickCaptureWrapRef}
        className={cn(
          "rounded-3xl transition-shadow duration-300",
          captureHighlight &&
            "ring-2 ring-[#0A84FF]/70 shadow-[0_0_28px_rgba(10,132,255,0.35)]"
        )}
      >
        <QuickCaptureBar onPendingTermChange={setPendingTerm} />
      </div>

      {/* Search & Filter Controls */}
      <div className="space-y-3">
        <div className="liquid-glass-pill flex items-center gap-2.5 rounded-full px-4 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-[#8E8E93]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.vault.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-base sm:text-sm text-[#F5F5F7] placeholder:text-[#8E8E93] focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label={t.vault.clearSearch}
              className="rounded-full p-1 text-[#8E8E93] hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills (Type + Register + Source Tag) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {(
            [
              { id: "all", label: t.vault.allTypes },
              { id: "vocab", label: "Vocab" },
              { id: "idiom", label: "Idiom" },
              { id: "collocation", label: "Collocation" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTypeFilter(item.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer",
                typeFilter === item.id
                  ? "bg-[#0A84FF]/25 border-[#0A84FF]/45 text-white"
                  : "bg-white/[0.05] border-white/[0.09] text-[#8E8E93] hover:text-[#F5F5F7]"
              )}
            >
              {item.label}
            </button>
          ))}

          <span className="h-4 w-px shrink-0 bg-white/[0.12]" />

          {(
            ["all", "Formal", "Academic", "Casual", "Slang"] as RegisterFilter[]
          ).map((reg) => (
            <button
              key={reg}
              type="button"
              onClick={() => setRegisterFilter(reg)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer",
                registerFilter === reg
                  ? "bg-[#5E5CE6]/25 border-[#5E5CE6]/45 text-white"
                  : "bg-white/[0.05] border-white/[0.09] text-[#8E8E93] hover:text-[#F5F5F7]"
              )}
            >
              {reg === "all" ? t.vault.allRegisters : reg}
            </button>
          ))}

          <span className="h-4 w-px shrink-0 bg-white/[0.12]" />

          {(["all", ...ALL_CEFR_LEVELS] as CefrFilter[]).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setCefrFilter(lvl)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors cursor-pointer",
                cefrFilter === lvl
                  ? lvl === "all"
                    ? "bg-[#5E5CE6]/25 border-[#5E5CE6]/45 text-white"
                    : formatCefrBadgeClass(lvl)
                  : "bg-white/[0.05] border-white/[0.09] text-[#8E8E93] hover:text-[#F5F5F7]"
              )}
            >
              {lvl === "all" ? t.vault.allLevels : lvl}
            </button>
          ))}

          <span className="h-4 w-px shrink-0 bg-white/[0.12]" />

          {availableSources.map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => setSourceFilter(src)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer",
                sourceFilter === src
                  ? "bg-[#30D158]/20 border-[#30D158]/40 text-[#7CF099]"
                  : "bg-white/[0.05] border-white/[0.09] text-[#8E8E93] hover:text-[#F5F5F7]"
              )}
            >
              {src === "all"
                ? t.vault.allSources
                : formatSourceTagLabel(src, lang)}
            </button>
          ))}
        </div>

        {/* Results Toolbar — directly below filter pills, outside horizontal scroll */}
        <div className="relative z-30 flex items-center justify-between gap-2.5">
          <p className="min-w-0 truncate text-xs font-medium text-[#8E8E93]">
            {resultsCountLabel}
          </p>

          <div
            ref={sortMenuRef}
            className="relative shrink-0 max-w-[65%] sm:max-w-none"
          >
            <button
              type="button"
              onClick={() => {
                playGlassClick();
                setSortOpen((prev) => !prev);
              }}
              aria-haspopup="listbox"
              aria-expanded={sortOpen}
              className={cn(
                "liquid-glass-pill inline-flex w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                sortOpen
                  ? "border-[#0A84FF]/45 bg-white/[0.1] text-white"
                  : "text-[#E5E5EA] hover:bg-white/[0.09] hover:text-white"
              )}
            >
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-[#0A84FF]" />
              <span className="truncate">
                <span className="text-[#8E8E93]">{t.vault.sortLabel}</span>{" "}
                {t.vault.sortOptions[currentSortOption.id]}
              </span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-[#8E8E93] transition-transform duration-150",
                  sortOpen && "rotate-180"
                )}
              />
            </button>

            <AnimatePresence>
              {sortOpen && (
                <motion.div
                  role="listbox"
                  aria-label={t.vault.sortLabel}
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.14 }}
                  className="liquid-glass-elevated absolute right-0 top-full z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl p-1.5 origin-top-right"
                >
                  {VAULT_SORT_OPTIONS.map((option) => {
                    const isSelected = option.id === sortBy;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectSort(option.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors cursor-pointer",
                          isSelected
                            ? "bg-[#0A84FF]/20 text-white"
                            : "text-[#D1D1D6] hover:bg-white/[0.08] hover:text-white"
                        )}
                      >
                        <span className="truncate">
                          {t.vault.sortOptions[option.id]}
                        </span>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-[#0A84FF]" />
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* AI Processing Skeleton */}
      <AnimatePresence>
        {isCapturing && <ShimmerWordSkeleton term={pendingTerm} />}
      </AnimatePresence>

      {/* Word Cards Grid */}
      {!isHydrated ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ShimmerWordSkeleton />
          <ShimmerWordSkeleton />
        </div>
      ) : sortedWords.length === 0 ? (
        <div className="liquid-glass rounded-3xl p-8 text-center">
          <BookMarked className="mx-auto h-9 w-9 text-[#8E8E93] mb-3" />
          <p className="text-base font-semibold text-[#F5F5F7]">
            {words.length === 0 ? t.vault.emptyTitle : t.vault.emptyFilterTitle}
          </p>
          <p className="mt-1 text-xs text-[#8E8E93]">
            {words.length === 0
              ? t.vault.emptySubtitle
              : t.vault.emptyFilterSubtitle}
          </p>
        </div>
      ) : (
        <motion.div
          key={`${typeFilter}-${registerFilter}-${cefrFilter}-${sourceFilter}-${search ? "q" : "all"}`}
          variants={STAGGER_CONTAINER}
          initial="hidden"
          animate="visible"
          className="vault-word-grid grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {sortedWords.map((word) => (
            <VaultWordCard key={word.id} word={word} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
