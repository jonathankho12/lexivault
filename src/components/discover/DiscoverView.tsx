"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  BookmarkCheck,
  BookmarkPlus,
  CheckCircle2,
  Compass,
  Eye,
  EyeOff,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { AudioButton } from "@/components/ui/AudioButton";
import { HighlightedText } from "@/components/ui/HighlightedText";
import { PronunciationText } from "@/components/ui/PronunciationText";
import { ShimmerWordSkeleton } from "@/components/ui/ShimmerWordSkeleton";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import {
  IOS_SPRING,
  STAGGER_CONTAINER,
  STAGGER_ITEM,
  TAP_SCALE,
} from "@/lib/motion";
import { playCorrectChime, playGlassClick } from "@/lib/soundEffects";
import { loadDailyDiscovery, saveDailyDiscovery } from "@/lib/storage";
import {
  cn,
  formatCefrBadgeClass,
  formatGeminiClientError,
  formatRegisterBadgeClass,
  formatTypeLabel,
  getLocalizedExampleTranslation,
  getLocalizedMeaning,
  normalizeDuplicateKey,
} from "@/lib/utils";
import type { DailyDiscoveryPack, DiscoveryItem } from "@/types/lexivault";

type DiscoverCategory = "mix" | "vocab" | "idiom" | "collocation";
type DiscoverTone = "C1-C2" | "Academic" | "Formal" | "Casual" | "Slang";

export function DiscoverView() {
  const {
    user,
    todayStr,
    words,
    isHydrated,
    saveDiscoveryItemToVault,
    launchPractice,
  } = useLexiVault();
  const { lang, t } = useLanguage();

  const [pack, setPack] = useState<DailyDiscoveryPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [discoverCategory, setDiscoverCategory] =
    useState<DiscoverCategory>("mix");
  const [discoverTone, setDiscoverTone] = useState<DiscoverTone>("C1-C2");
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [hideSaved, setHideSaved] = useState(false);

  const wordsRef = useRef(words);
  wordsRef.current = words;
  const langRef = useRef(lang);
  langRef.current = lang;
  const packRef = useRef(pack);
  packRef.current = pack;

  const savedTermKeys = useMemo(
    () => new Set(words.map((w) => normalizeDuplicateKey(w.term))),
    [words]
  );

  useEffect(() => {
    if (!isHydrated || !user) return;

    let cancelled = false;

    const loadOrGenerate = async () => {
      setLoading(true);
      setLoadMoreError(null);
      try {
        const cached = await loadDailyDiscovery(todayStr, user.id);
        if (cached && cached.items.length > 0) {
          if (!cancelled) {
            setPack(cached);
            setLoading(false);
          }
          return;
        }

        const res = await fetch("/api/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: todayStr,
            mode: "daily",
            existingTerms: wordsRef.current.slice(0, 180).map((w) => w.term),
            lang: langRef.current,
          }),
        });
        if (!res.ok) throw new Error("Failed to load daily pack");
        const data = (await res.json()) as DailyDiscoveryPack;
        if (!cancelled) {
          setPack(data);
          await saveDailyDiscovery(data, user.id);
        }
      } catch {
        // Ignore; user can tap retry/refresh
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadOrGenerate();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, todayStr, user]);

  // 0ms optimistic single save
  const handleSaveOne = (item: DiscoveryItem) => {
    if (savedTermKeys.has(normalizeDuplicateKey(item.term))) return;
    playCorrectChime(1);
    void saveDiscoveryItemToVault(item);
  };

  // 0ms optimistic save-all
  const handleSaveAll = () => {
    if (!pack) return;
    const unsaved = pack.items.filter(
      (item) => !savedTermKeys.has(normalizeDuplicateKey(item.term))
    );
    if (unsaved.length === 0) return;
    playCorrectChime(2);
    for (const item of unsaved) {
      void saveDiscoveryItemToVault(item);
    }
  };

  const handleRefresh = async () => {
    if (loading || loadingMore) return;
    playGlassClick();
    setLoading(true);
    setLoadMoreError(null);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayStr,
          mode: "daily",
          category: discoverCategory,
          tone: discoverTone,
          existingTerms: wordsRef.current.slice(0, 180).map((w) => w.term),
          lang,
        }),
      });
      if (res.ok && user) {
        const data = (await res.json()) as DailyDiscoveryPack;
        setPack(data);
        setHideSaved(false);
        await saveDailyDiscovery(data, user.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMore = async (fromEmptyState = false) => {
    if (loadingMore || !user) return;
    playGlassClick();
    setLoadingMore(true);
    setLoadMoreError(null);

    try {
      const currentItems = packRef.current?.items ?? [];
      const excludeTerms = Array.from(
        new Set([
          ...wordsRef.current.map((w) => w.term),
          ...currentItems.map((it) => it.term),
        ])
      ).slice(0, 180);

      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayStr,
          mode: "more",
          category: discoverCategory,
          tone: discoverTone,
          count: 6,
          existingTerms: excludeTerms,
          lang,
        }),
      });

      if (!res.ok) {
        let apiCode = "";
        let apiError = "";
        let apiDetail = "";
        try {
          const errJson = (await res.json()) as {
            error?: string;
            code?: string;
            detail?: string;
          };
          apiCode = errJson.code ?? "";
          apiError = errJson.error ?? "";
          apiDetail = errJson.detail ?? "";
        } catch {
          // Non-JSON error response
        }
        console.error(
          `[DiscoverView] /api/discover (more) failed (HTTP ${res.status}, code=${apiCode || "unknown"}):`,
          apiDetail || apiError || res.statusText
        );
        const reason = formatGeminiClientError(
          apiCode,
          res.status,
          apiError || `${t.discover.errorLoadMore} (HTTP ${res.status})`,
          lang
        );
        setLoadMoreError(reason);
        return;
      }

      const data = (await res.json()) as DailyDiscoveryPack;
      const incoming = Array.isArray(data.items) ? data.items : [];
      const existingKeys = new Set(
        currentItems.map((it) => normalizeDuplicateKey(it.term))
      );
      const uniqueFresh = incoming.filter((item) => {
        const k = normalizeDuplicateKey(item.term);
        if (!k || existingKeys.has(k) || savedTermKeys.has(k)) return false;
        existingKeys.add(k);
        return true;
      });

      if (uniqueFresh.length === 0) {
        setLoadMoreError(t.discover.errorLoadMore);
        return;
      }

      // If triggered when all existing items were already in Vault, put fresh items right on top
      const mergedItems = fromEmptyState
        ? [...uniqueFresh, ...currentItems]
        : [...currentItems, ...uniqueFresh];

      const updatedPack: DailyDiscoveryPack = {
        discovery_date: packRef.current?.discovery_date || todayStr,
        items: mergedItems,
        source: data.source || "gemini",
      };

      setPack(updatedPack);
      if (fromEmptyState) {
        setHideSaved(true);
      }
      await saveDailyDiscovery(updatedPack, user.id);
    } catch (err) {
      console.error("[DiscoverView] Generate more failed:", err);
      setLoadMoreError(t.discover.errorLoadMore);
    } finally {
      setLoadingMore(false);
    }
  };

  const totalItems = pack?.items.length ?? 0;
  const savedCount = useMemo(() => {
    if (!pack?.items.length) return 0;
    return pack.items.filter((item) =>
      savedTermKeys.has(normalizeDuplicateKey(item.term))
    ).length;
  }, [pack, savedTermKeys]);

  const unsavedCount = Math.max(0, totalItems - savedCount);
  const allSaved = totalItems > 0 && unsavedCount === 0;

  const visibleItems = useMemo(() => {
    if (!pack?.items.length) return [];
    if (!hideSaved || allSaved) return pack.items;
    return pack.items.filter(
      (item) => !savedTermKeys.has(normalizeDuplicateKey(item.term))
    );
  }, [allSaved, hideSaved, pack, savedTermKeys]);

  const categoryOptions: Array<{ id: DiscoverCategory; label: string }> = [
    { id: "mix", label: t.discover.typeMix },
    { id: "vocab", label: "Vocab" },
    { id: "idiom", label: "Idiom" },
    { id: "collocation", label: "Collocation" },
  ];

  const toneOptions: Array<{ id: DiscoverTone; label: string }> = [
    { id: "C1-C2", label: t.discover.toneC1C2 },
    { id: "Academic", label: "Academic" },
    { id: "Formal", label: "Formal" },
    { id: "Casual", label: "Casual" },
    { id: "Slang", label: "Slang" },
  ];

  const renderGeneratorControls = (isCompletedCard: boolean) => (
    <div
      className={cn(
        "rounded-3xl border p-5 space-y-4",
        isCompletedCard
          ? "liquid-glass border-[#30D158]/30 bg-gradient-to-br from-[#30D158]/[0.08] via-[#0A84FF]/[0.06] to-[#5E5CE6]/[0.08]"
          : "liquid-glass border-white/[0.12]"
      )}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
            isCompletedCard
              ? "bg-[#30D158]/18 border-[#30D158]/40 text-[#7CF099]"
              : "bg-gradient-to-br from-[#0A84FF]/25 to-[#5E5CE6]/25 border-[#0A84FF]/35 text-[#70BCFF]"
          )}
        >
          {isCompletedCard ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-bold text-white">
            {isCompletedCard
              ? t.discover.allInVaultTitle
              : t.discover.generateMoreTitle}
          </h3>
          <p className="mt-0.5 text-xs sm:text-[13px] text-[#AEAEB2] leading-relaxed">
            {t.discover.allInVaultSubtitle}
          </p>
        </div>
      </div>

      {/* Category & Tone Filter Chips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
            {t.discover.typeLabel}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {categoryOptions.map((opt) => {
              const active = discoverCategory === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={loadingMore}
                  onClick={() => {
                    playGlassClick();
                    setDiscoverCategory(opt.id);
                  }}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50",
                    active
                      ? "bg-[#0A84FF]/25 border-[#0A84FF]/55 text-white"
                      : "bg-white/[0.05] border-white/[0.1] text-[#AEAEB2] hover:text-white hover:bg-white/[0.1]"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
            {t.discover.toneLabel}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {toneOptions.map((opt) => {
              const active = discoverTone === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={loadingMore}
                  onClick={() => {
                    playGlassClick();
                    setDiscoverTone(opt.id);
                  }}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50",
                    active
                      ? "bg-[#5E5CE6]/30 border-[#5E5CE6]/60 text-white"
                      : "bg-white/[0.05] border-white/[0.1] text-[#AEAEB2] hover:text-white hover:bg-white/[0.1]"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Red Error Banner + Retry */}
      {loadMoreError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs text-red-400"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{loadMoreError}</span>
          </div>
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void handleGenerateMore(isCompletedCard)}
            className="inline-flex items-center gap-1 rounded-full bg-red-500/20 border border-red-500/40 px-3 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-500/30 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            <span>{t.discover.retryBtn}</span>
          </button>
        </div>
      )}

      {/* Generate More CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <motion.button
          type="button"
          whileTap={TAP_SCALE}
          disabled={loadingMore}
          onClick={() => void handleGenerateMore(isCompletedCard)}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-[0_10px_28px_rgba(10,132,255,0.35)] hover:brightness-110 transition-all cursor-pointer disabled:opacity-60"
        >
          {loadingMore ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t.discover.generatingMoreBtn}</span>
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              <span>{t.discover.generateMoreBtn.replace(/^\+\s*/, "")}</span>
            </>
          )}
        </motion.button>

        {isCompletedCard && totalItems > 0 && (
          <span className="text-[11px] text-[#8E8E93]">
            {savedCount} / {totalItems} {t.discover.savedInVault}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0A84FF]">
            {t.discover.eyebrow} ·{" "}
            {isHydrated ? todayStr : t.discover.todayFallback}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F7]">
            {t.discover.title}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!loading && pack && savedCount > 0 && !allSaved && (
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => {
                playGlassClick();
                setHideSaved((prev) => !prev);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors cursor-pointer",
                hideSaved
                  ? "bg-[#0A84FF]/22 border-[#0A84FF]/45 text-[#70BCFF]"
                  : "liquid-glass-pill text-[#AEAEB2] hover:text-white"
              )}
            >
              {hideSaved ? (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  <span>
                    {t.discover.showAll} ({totalItems})
                  </span>
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  <span>
                    {t.discover.hideSaved} ({unsavedCount})
                  </span>
                </>
              )}
            </motion.button>
          )}

          {!loading && pack && (
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              disabled={loadingMore}
              onClick={() => void handleGenerateMore(allSaved)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#5E5CE6]/22 border border-[#5E5CE6]/45 px-3.5 py-1.5 text-xs font-semibold text-[#C4C2FF] hover:bg-[#5E5CE6]/32 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingMore ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>
                {loadingMore
                  ? t.discover.generatingMoreBtn
                  : t.suggest.generateMore}
              </span>
            </motion.button>
          )}

          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            disabled={loading || loadingMore}
            onClick={() => void handleRefresh()}
            className="liquid-glass-pill inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-[#8E8E93] hover:text-white cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span>{t.discover.reloadBtn}</span>
          </motion.button>
        </div>
      </div>

      {/* Hero Action Banner */}
      <div className="liquid-glass rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0A84FF]/30 to-[#5E5CE6]/30 border border-[#0A84FF]/40">
            <Compass className="h-6 w-6 text-[#70BCFF]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-white">
                {t.discover.heroTitle}
              </h3>
              <span className="rounded-full bg-[#5E5CE6]/25 border border-[#5E5CE6]/40 px-2.5 py-0.5 text-[10px] font-semibold text-[#C4C2FF]">
                {totalItems > 0
                  ? `${unsavedCount} ${
                      lang === "en" ? "New" : lang === "ru" ? "Новых" : "Baru"
                    } · ${totalItems} ${lang === "ru" ? "всего" : "Total"}`
                  : "3 Vocab · 2 Idioms · 2 Collocations"}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#8E8E93]">
              {t.discover.heroSubtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            disabled={!pack || pack.items.length === 0 || allSaved}
            onClick={handleSaveAll}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold border transition-colors cursor-pointer",
              allSaved
                ? "bg-[#30D158]/15 border-[#30D158]/35 text-[#7CF099]"
                : "bg-white/[0.08] border-white/[0.14] text-[#F5F5F7] hover:bg-white/[0.14]"
            )}
          >
            {allSaved ? (
              <>
                <BookmarkCheck className="h-3.5 w-3.5" />
                <span>{t.discover.allSavedBtn}</span>
              </>
            ) : (
              <>
                <BookmarkPlus className="h-3.5 w-3.5" />
                <span>{t.discover.saveAllBtn}</span>
              </>
            )}
          </motion.button>

          <motion.button
            type="button"
            whileTap={TAP_SCALE}
            disabled={!pack || pack.items.length === 0}
            onClick={() => pack && launchPractice("daily_mini", pack.items)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF] px-4 py-2.5 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(10,132,255,0.35)] hover:bg-[#1A8EFF] cursor-pointer disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>{t.discover.miniQuizBtn}</span>
          </motion.button>
        </div>
      </div>

      {/* Prominent Completed + Endless Generate More Card when all items are already in Vault */}
      {!loading && pack && allSaved && renderGeneratorControls(true)}

      {/* Discovery Items */}
      {loading || !pack ? (
        <div className="space-y-4">
          <ShimmerWordSkeleton term="Daily Discovery Pack" />
          <ShimmerWordSkeleton />
          <ShimmerWordSkeleton />
        </div>
      ) : (
        <motion.div
          variants={STAGGER_CONTAINER}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {visibleItems.map((item, idx) => {
            const isSaved = savedTermKeys.has(normalizeDuplicateKey(item.term));

            return (
              <motion.article
                key={item.id || `${item.term}-${idx}`}
                variants={STAGGER_ITEM}
                className={cn(
                  "liquid-glass rounded-3xl p-5 space-y-3.5 transition-opacity",
                  isSaved && "border-[#30D158]/20"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-white/[0.08] border border-white/[0.12] text-[#F5F5F7]">
                        <Sparkles className="h-2.5 w-2.5 text-[#0A84FF]" />
                        {formatTypeLabel(item.type)}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-semibold border",
                          formatRegisterBadgeClass(item.register)
                        )}
                      >
                        {item.register}
                      </span>
                      {item.cefr && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold border",
                            formatCefrBadgeClass(item.cefr)
                          )}
                        >
                          {item.cefr}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white break-words">
                      {item.term}
                    </h3>
                    <PronunciationText
                      term={item.term}
                      pronunciation={item.pronunciation}
                      ipa={item.ipa}
                      showIpa
                      size="sm"
                      className="mt-1"
                    />
                  </div>

                  {/* US / UK Audio + 0ms Save Button */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <AudioButton
                      text={item.term}
                      accentOverride="US"
                      label="US"
                      size="sm"
                    />
                    <AudioButton
                      text={item.term}
                      accentOverride="UK"
                      label="UK"
                      size="sm"
                    />

                    <motion.button
                      type="button"
                      whileTap={TAP_SCALE}
                      disabled={isSaved}
                      onClick={() => handleSaveOne(item)}
                      transition={IOS_SPRING}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors cursor-pointer",
                        isSaved
                          ? "bg-[#30D158]/20 border-[#30D158]/40 text-[#7CF099] cursor-default"
                          : "bg-[#0A84FF]/20 border-[#0A84FF]/45 text-[#70BCFF] hover:bg-[#0A84FF]/30"
                      )}
                    >
                      {isSaved ? (
                        <>
                          <BookmarkCheck className="h-3.5 w-3.5" />
                          <span>{t.discover.savedInVault}</span>
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="h-3.5 w-3.5" />
                          <span>{t.discover.saveToVault}</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>

                {/* Meaning */}
                <p className="text-sm leading-relaxed text-[#E5E5EA]">
                  {getLocalizedMeaning(item, lang)}
                </p>

                {/* Examples */}
                {item.examples_json.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {item.examples_json.map((ex, exIdx) => (
                      <div
                        key={exIdx}
                        className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#70BCFF]">
                            {ex.context || (exIdx === 0 ? "Daily" : "Academic")}
                          </span>
                          <AudioButton
                            text={ex.sentence.replace(/\*\*/g, "")}
                            size="sm"
                          />
                        </div>
                        <p className="text-xs sm:text-[13px] leading-relaxed text-[#F5F5F7]">
                          <HighlightedText text={ex.sentence} />
                        </p>
                        {(() => {
                          const translated = getLocalizedExampleTranslation(
                            ex,
                            lang
                          );
                          return translated ? (
                            <p className="text-[11px] leading-relaxed text-[#8E8E93]">
                              <HighlightedText text={translated} />
                            </p>
                          ) : null;
                        })()}
                      </div>
                    ))}
                  </div>
                )}

                {/* Common Chunks */}
                {item.chunks && item.chunks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#70BCFF] opacity-80">
                      {t.wordDetail.chunksTitle}:
                    </span>
                    {item.chunks.slice(0, 3).map((chunk, chunkIdx) => (
                      <div
                        key={chunkIdx}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF]/10 border border-[#0A84FF]/25 pl-3 pr-1 py-0.5"
                      >
                        <span className="text-[11px] sm:text-xs font-medium text-[#F5F5F7]">
                          {chunk}
                        </span>
                        <AudioButton
                          text={chunk}
                          size="sm"
                          className="h-6 w-6 shrink-0"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Word Family */}
                {item.word_families_json.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-[#8E8E93] mr-1">
                      {t.wordDetail.wordFamilyTitle}:
                    </span>
                    {item.word_families_json.map((wf, wfIdx) => (
                      <span
                        key={wfIdx}
                        className="rounded-full bg-white/[0.06] border border-white/[0.1] px-2.5 py-0.5 text-[11px] text-[#D1D1D6]"
                      >
                        {wf.word}{" "}
                        <span className="text-[#8E8E93]">({wf.pos})</span>
                      </span>
                    ))}
                  </div>
                )}
              </motion.article>
            );
          })}

          {loadingMore && (
            <div className="space-y-4">
              <ShimmerWordSkeleton term={t.discover.generatingMoreBtn} />
              <ShimmerWordSkeleton />
            </div>
          )}
        </motion.div>
      )}

      {/* Always-available Endless Discover Panel at the bottom when unsaved items still remain */}
      {!loading && pack && !allSaved && renderGeneratorControls(false)}
    </div>
  );
}
