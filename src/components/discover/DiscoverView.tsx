"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  BookmarkCheck,
  BookmarkPlus,
  Compass,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { AudioButton } from "@/components/ui/AudioButton";
import { HighlightedText } from "@/components/ui/HighlightedText";
import { PronunciationText } from "@/components/ui/PronunciationText";
import { ShimmerWordSkeleton } from "@/components/ui/ShimmerWordSkeleton";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { usePronunciation } from "@/hooks/usePronunciation";
import {
  IOS_SPRING,
  STAGGER_CONTAINER,
  STAGGER_ITEM,
  TAP_SCALE,
} from "@/lib/motion";
import {
  loadDailyDiscovery,
  saveDailyDiscovery,
} from "@/lib/storage";
import {
  cn,
  formatRegisterBadgeClass,
  formatTypeLabel,
  getLocalizedMeaning,
  normalizeTermKey,
} from "@/lib/utils";
import type { DailyDiscoveryPack, DiscoveryItem } from "@/types/lexivault";

export function DiscoverView() {
  const {
    user,
    todayStr,
    words,
    accent,
    isHydrated,
    saveDiscoveryItemToVault,
    launchPractice,
  } = useLexiVault();
  const { lang, t } = useLanguage();
  const { prefetchMany } = usePronunciation();

  const [pack, setPack] = useState<DailyDiscoveryPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const wordsRef = useRef(words);
  wordsRef.current = words;
  const langRef = useRef(lang);
  langRef.current = lang;

  const savedTermKeys = useMemo(
    () => new Set(words.map((w) => normalizeTermKey(w.term))),
    [words]
  );

  useEffect(() => {
    if (!isHydrated || !user) return;

    let cancelled = false;

    const loadOrGenerate = async () => {
      setLoading(true);
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
            existingTerms: wordsRef.current.slice(0, 40).map((w) => w.term),
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
        // Ignore; user can tap retry
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadOrGenerate();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, todayStr, user]);

  // Background pre-fetch audio for discovery items
  useEffect(() => {
    if (!pack?.items.length) return;
    prefetchMany(
      pack.items.slice(0, 5).map((item) => ({
        text: item.term,
        accent,
      }))
    );
  }, [pack, accent, prefetchMany]);

  const handleSaveOne = async (item: DiscoveryItem) => {
    setSavingId(item.id);
    await saveDiscoveryItemToVault(item);
    setSavingId(null);
  };

  const handleSaveAll = async () => {
    if (!pack || savingAll) return;
    setSavingAll(true);
    for (const item of pack.items) {
      if (!savedTermKeys.has(normalizeTermKey(item.term))) {
        await saveDiscoveryItemToVault(item);
      }
    }
    setSavingAll(false);
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayStr,
          existingTerms: words.slice(0, 40).map((w) => w.term),
          lang,
        }),
      });
      if (res.ok && user) {
        const data = (await res.json()) as DailyDiscoveryPack;
        setPack(data);
        await saveDailyDiscovery(data, user.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const allSaved =
    Boolean(pack?.items.length) &&
    pack!.items.every((item) => savedTermKeys.has(normalizeTermKey(item.term)));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0A84FF]">
            {t.discover.eyebrow} · {isHydrated ? todayStr : t.discover.todayFallback}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F7]">
            {t.discover.title}
          </h2>
        </div>

        <motion.button
          type="button"
          whileTap={TAP_SCALE}
          onClick={() => void handleRefresh()}
          className="liquid-glass-pill inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-[#8E8E93] hover:text-white cursor-pointer"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          <span>{t.discover.reloadBtn}</span>
        </motion.button>
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
                3 Vocab · 2 Idioms · 2 Collocations
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
            disabled={!pack || pack.items.length === 0 || allSaved || savingAll}
            onClick={() => void handleSaveAll()}
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
                <span>
                  {savingAll ? t.discover.savingAllBtn : t.discover.saveAllBtn}
                </span>
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
          {pack.items.map((item, idx) => {
            const isSaved = savedTermKeys.has(normalizeTermKey(item.term));
            const isSavingThis = savingId === item.id;

            return (
              <motion.article
                key={item.id || `${item.term}-${idx}`}
                variants={STAGGER_ITEM}
                className="liquid-glass rounded-3xl p-5 space-y-3.5"
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

                  {/* US / UK Audio + Save Button */}
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
                      disabled={isSaved || isSavingThis}
                      onClick={() => void handleSaveOne(item)}
                      transition={IOS_SPRING}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors cursor-pointer",
                        isSaved
                          ? "bg-[#30D158]/20 border-[#30D158]/40 text-[#7CF099]"
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
                          <span>
                            {isSavingThis ? t.discover.saving : t.discover.saveToVault}
                          </span>
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
                        {lang === "id" && ex.translation_id && (
                          <p className="text-[11px] leading-relaxed text-[#8E8E93]">
                            <HighlightedText text={ex.translation_id} />
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Word Family */}
                {item.word_families_json.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-[#8E8E93] mr-1">
                      Word Family:
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
        </motion.div>
      )}
    </div>
  );
}
