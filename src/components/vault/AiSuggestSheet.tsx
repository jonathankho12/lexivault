"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { AudioButton } from "@/components/ui/AudioButton";
import { HighlightedText } from "@/components/ui/HighlightedText";
import { PronunciationText } from "@/components/ui/PronunciationText";
import { ShimmerWordSkeleton } from "@/components/ui/ShimmerWordSkeleton";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { IOS_SHEET_SPRING, TAP_SCALE } from "@/lib/motion";
import { playCorrectChime, playGlassClick } from "@/lib/soundEffects";
import {
  cn,
  formatGeminiClientError,
  formatRegisterBadgeClass,
  formatSourceTagLabel,
  formatTypeLabel,
  getLocalizedMeaning,
  normalizeDuplicateKey,
} from "@/lib/utils";
import type {
  SuggestCategory,
  SuggestRegister,
  SuggestedWordItem,
} from "@/types/lexivault";

interface CachedSuggestEntry {
  items: SuggestedWordItem[];
  source: "gemini" | "fallback" | null;
  savedAt: number;
}

const SUGGEST_CACHE_PREFIX = "lexivault_suggest_cache_v1_";
const SUGGEST_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min session cache
const memorySuggestCache = new Map<string, CachedSuggestEntry>();

function buildCacheKey(
  lang: string,
  category: SuggestCategory,
  register: SuggestRegister
): string {
  return `${lang}:${category}:${register}`;
}

function readSuggestCache(key: string): CachedSuggestEntry | null {
  const now = Date.now();
  const inMem = memorySuggestCache.get(key);
  if (inMem && now - inMem.savedAt < SUGGEST_CACHE_TTL_MS && inMem.items.length > 0) {
    return inMem;
  }

  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${SUGGEST_CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSuggestEntry;
    if (
      parsed &&
      Array.isArray(parsed.items) &&
      parsed.items.length > 0 &&
      now - parsed.savedAt < SUGGEST_CACHE_TTL_MS
    ) {
      memorySuggestCache.set(key, parsed);
      return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function writeSuggestCache(key: string, entry: CachedSuggestEntry): void {
  memorySuggestCache.set(key, entry);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      `${SUGGEST_CACHE_PREFIX}${key}`,
      JSON.stringify(entry)
    );
  } catch {
    // Ignore sessionStorage quota errors
  }
}

export function AiSuggestSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { words, addSuggestedWordToVault } = useLexiVault();
  const { lang, t } = useLanguage();

  const [mounted, setMounted] = useState(false);
  const [category, setCategory] = useState<SuggestCategory>("mix");
  const [register, setRegister] = useState<SuggestRegister>("any");
  const [items, setItems] = useState<SuggestedWordItem[]>([]);
  const [source, setSource] = useState<"gemini" | "fallback" | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSettledForOpen, setHasSettledForOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const seenTermsRef = useRef<Set<string>>(new Set());
  const wordsRef = useRef(words);
  wordsRef.current = words;
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const vaultTermKeys = useMemo(
    () => new Set(words.map((w) => normalizeDuplicateKey(w.term))),
    [words]
  );

  const fetchSuggestions = useCallback(
    async (
      nextCategory: SuggestCategory,
      nextRegister: SuggestRegister,
      appendSeen: boolean
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setErrorMsg(null);
      try {
        const excludeList = new Set<string>(
          wordsRef.current.map((w) => w.term)
        );
        if (appendSeen) {
          seenTermsRef.current.forEach((term) => excludeList.add(term));
        }

        const res = await fetch("/api/suggest-words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            existingTerms: Array.from(excludeList),
            category: nextCategory,
            register: nextRegister,
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
            `[AiSuggestSheet] /api/suggest-words failed (HTTP ${res.status}, code=${apiCode || "unknown"}):`,
            apiDetail || apiError || res.statusText
          );

          const reason = formatGeminiClientError(
            apiCode,
            res.status,
            apiError || `${t.suggest.errorFallback} (HTTP ${res.status})`,
            lang
          );

          setErrorMsg(reason);
          setItems([]);
          setSource(null);
          return;
        }

        const json = (await res.json()) as {
          items?: SuggestedWordItem[];
          source?: "gemini" | "fallback";
        };
        const list = Array.isArray(json.items) ? json.items : [];
        list.forEach((item) => seenTermsRef.current.add(item.term));
        const nextSource = json.source ?? null;
        setItems(list);
        setSource(nextSource);

        if (list.length > 0) {
          writeSuggestCache(buildCacheKey(lang, nextCategory, nextRegister), {
            items: list,
            source: nextSource,
            savedAt: Date.now(),
          });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("[AiSuggestSheet] Failed to load suggestions:", err);
        setErrorMsg(t.suggest.errorFallback);
        setItems([]);
      } finally {
        if (abortRef.current === controller) {
          setLoading(false);
          setHasSettledForOpen(true);
        }
      }
    },
    [lang, t.suggest.errorFallback]
  );

  // Instant 0ms cache hydrate on open (only calls API if cache for this filter is empty)
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setHasSettledForOpen(false);
      return;
    }

    const cacheKey = buildCacheKey(lang, category, register);
    const cached = readSuggestCache(cacheKey);
    if (cached && cached.items.length > 0) {
      cached.items.forEach((item) => seenTermsRef.current.add(item.term));
      setItems(cached.items);
      setSource(cached.source);
      setErrorMsg(null);
      setLoading(false);
      setHasSettledForOpen(true);
      return;
    }

    seenTermsRef.current = new Set();
    setHasSettledForOpen(false);
    setErrorMsg(null);
    setItems([]);
    void fetchSuggestions(category, register, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const loadForFilter = (
    nextCategory: SuggestCategory,
    nextRegister: SuggestRegister
  ) => {
    const cacheKey = buildCacheKey(lang, nextCategory, nextRegister);
    const cached = readSuggestCache(cacheKey);
    if (cached && cached.items.length > 0) {
      cached.items.forEach((item) => seenTermsRef.current.add(item.term));
      setItems(cached.items);
      setSource(cached.source);
      setErrorMsg(null);
      setLoading(false);
      setHasSettledForOpen(true);
      return;
    }
    void fetchSuggestions(nextCategory, nextRegister, false);
  };

  const handleCategoryChange = (next: SuggestCategory) => {
    if (next === category || loading) return;
    playGlassClick();
    setCategory(next);
    loadForFilter(next, register);
  };

  const handleRegisterChange = (next: SuggestRegister) => {
    if (next === register || loading) return;
    playGlassClick();
    setRegister(next);
    loadForFilter(category, next);
  };

  const handleRetry = () => {
    if (loading) return;
    playGlassClick();
    void fetchSuggestions(category, register, false);
  };

  const handleGenerateMore = () => {
    if (loading) return;
    playGlassClick();
    void fetchSuggestions(category, register, true);
  };

  // Instant 0ms optimistic save (no API roundtrip wait!)
  const handleAdd = (item: SuggestedWordItem) => {
    const key = normalizeDuplicateKey(item.term);
    if (vaultTermKeys.has(key)) return;
    playCorrectChime(1);
    void addSuggestedWordToVault(item);
  };

  const categoryOptions: Array<{ id: SuggestCategory; label: string }> = [
    { id: "mix", label: t.suggest.catMix },
    { id: "idiom", label: t.suggest.catIdiom },
    { id: "vocab", label: t.suggest.catVocab },
    { id: "collocation", label: t.suggest.catCollocation },
  ];

  const registerOptions: Array<{ id: SuggestRegister; label: string }> = [
    { id: "any", label: t.suggest.regAny },
    { id: "Academic", label: t.suggest.regAcademic },
    { id: "Formal", label: t.suggest.regFormal },
    { id: "Casual", label: t.suggest.regCasual },
  ];

  const showLoadingSkeleton =
    loading || (open && !hasSettledForOpen && !errorMsg && items.length === 0);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          key="ai-suggest-portal"
          className="fixed inset-0 z-[90] flex items-end md:items-center justify-center p-0 md:p-6"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t.suggest.title}
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 36 }}
            transition={IOS_SHEET_SPRING}
            className="liquid-glass-elevated transform-gpu will-change-transform relative z-10 w-full md:max-w-2xl max-h-[90dvh] flex flex-col rounded-t-[32px] md:rounded-3xl overflow-hidden"
          >
            {/* Sticky Header */}
            <div className="p-5 sm:p-6 pb-3.5 border-b border-white/[0.08] space-y-4">
              <div className="mx-auto -mt-1 mb-1 h-1 w-10 rounded-full bg-white/25 md:hidden" />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5E5CE6]/30 to-[#0A84FF]/30 border border-[#5E5CE6]/45">
                    <Sparkles className="h-5 w-5 text-[#A7A5FF]" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg sm:text-xl font-bold text-white">
                        {t.suggest.title}
                      </h3>
                      {source && (
                        <span className="rounded-full bg-[#5E5CE6]/20 border border-[#5E5CE6]/40 px-2 py-0.5 text-[10px] font-semibold text-[#C8C6FF]">
                          {source === "gemini"
                            ? t.suggest.sourceAi
                            : t.suggest.sourceCurated}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8E8E93] mt-0.5">
                      {t.suggest.subtitle}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t.suggest.close}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[#8E8E93] hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Quick Filter Pills */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="shrink-0 text-[11px] font-medium text-[#8E8E93] mr-1">
                    {t.suggest.categoryLabel}:
                  </span>
                  {categoryOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={loading}
                      onClick={() => handleCategoryChange(opt.id)}
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer disabled:opacity-60",
                        category === opt.id
                          ? "bg-[#0A84FF]/25 border-[#0A84FF]/50 text-white"
                          : "bg-white/[0.04] border-white/[0.09] text-[#8E8E93] hover:text-[#F5F5F7]"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="shrink-0 text-[11px] font-medium text-[#8E8E93] mr-1">
                    {t.suggest.registerLabel}:
                  </span>
                  {registerOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={loading}
                      onClick={() => handleRegisterChange(opt.id)}
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer disabled:opacity-60",
                        register === opt.id
                          ? "bg-[#5E5CE6]/25 border-[#5E5CE6]/50 text-white"
                          : "bg-white/[0.04] border-white/[0.09] text-[#8E8E93] hover:text-[#F5F5F7]"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-5 sm:p-6 space-y-3.5">
              {showLoadingSkeleton ? (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-[#A7A5FF] flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{t.suggest.loadingHint}</span>
                  </p>
                  <ShimmerWordSkeleton />
                  <ShimmerWordSkeleton />
                </div>
              ) : errorMsg ? (
                <div
                  role="alert"
                  className="rounded-2xl bg-red-500/10 border border-red-500/30 p-5 text-center space-y-3"
                >
                  <AlertCircle className="mx-auto h-7 w-7 text-red-400" />
                  <p className="text-xs sm:text-sm font-medium text-red-300 leading-relaxed">
                    {errorMsg}
                  </p>
                  <motion.button
                    type="button"
                    whileTap={TAP_SCALE}
                    onClick={handleRetry}
                    className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-500/40 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/30 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>{t.suggest.retryBtn}</span>
                  </motion.button>
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-6 text-center space-y-1.5">
                  <p className="text-sm font-semibold text-white">
                    {t.suggest.emptyTitle}
                  </p>
                  <p className="text-xs text-[#8E8E93]">
                    {t.suggest.emptySubtitle}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => {
                    const key = normalizeDuplicateKey(item.term);
                    const isAdded = vaultTermKeys.has(key);
                    const meaning = getLocalizedMeaning(item, lang);
                    const firstEx = item.examples?.[0];

                    return (
                      <div
                        key={item.term}
                        className="rounded-2xl bg-white/[0.045] border border-white/[0.1] p-4 space-y-2.5 transition-colors hover:border-white/[0.18]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                              <span className="rounded-full bg-[#5E5CE6]/25 border border-[#5E5CE6]/45 px-2 py-0.5 text-[10px] font-bold text-[#C8C6FF]">
                                {item.cefr}
                              </span>
                              <span className="rounded-full bg-white/[0.08] border border-white/[0.12] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#F5F5F7]">
                                {formatTypeLabel(item.type)}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                                  formatRegisterBadgeClass(item.register)
                                )}
                              >
                                {item.register}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] text-[#8E8E93] bg-white/[0.04]">
                                <Tag className="h-2.5 w-2.5" />
                                {formatSourceTagLabel(item.source_tag, lang)}
                              </span>
                            </div>

                            <h4 className="text-base sm:text-lg font-bold text-white break-words">
                              {item.term}
                            </h4>
                            <PronunciationText
                              term={item.term}
                              pronunciation={item.pronunciation}
                              ipa={item.ipa}
                              showIpa
                              size="xs"
                              className="mt-0.5"
                            />
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <AudioButton text={item.term} size="sm" />
                            <motion.button
                              type="button"
                              whileTap={isAdded ? undefined : TAP_SCALE}
                              disabled={isAdded}
                              onClick={() => handleAdd(item)}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-all cursor-pointer",
                                isAdded
                                  ? "bg-[#30D158]/20 border-[#30D158]/40 text-[#7CF099] cursor-default"
                                  : "bg-[#0A84FF] border-[#0A84FF] text-white shadow-[0_4px_14px_rgba(10,132,255,0.35)] hover:bg-[#1A8EFF]"
                              )}
                            >
                              {isAdded ? (
                                <>
                                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                  <span>{t.suggest.added}</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                                  <span>
                                    {t.suggest.addToVault.replace(/^\+\s*/, "")}
                                  </span>
                                </>
                              )}
                            </motion.button>
                          </div>
                        </div>

                        <p className="text-sm leading-relaxed text-[#E5E5EA]">
                          {meaning}
                        </p>

                        {firstEx && (
                          <div className="rounded-xl bg-black/30 border border-white/[0.06] px-3 py-2 space-y-1">
                            <p className="text-xs leading-relaxed text-[#D1D1D6]">
                              <HighlightedText text={firstEx.sentence} />
                            </p>
                            {lang === "id" && firstEx.translation_id && (
                              <p className="text-[11px] leading-relaxed text-[#8E8E93]">
                                <HighlightedText
                                  text={firstEx.translation_id}
                                />
                              </p>
                            )}
                          </div>
                        )}

                        {(item.synonyms.length > 0 ||
                          item.word_families.length > 0) && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {item.synonyms.slice(0, 3).map((syn, idx) => (
                              <span
                                key={`syn-${idx}`}
                                className="rounded-full bg-[#30D158]/10 border border-[#30D158]/25 px-2 py-0.5 text-[10px] text-[#A5F2B8]"
                              >
                                {syn}
                              </span>
                            ))}
                            {item.word_families.slice(0, 2).map((wf, idx) => (
                              <span
                                key={`wf-${idx}`}
                                className="rounded-full bg-[#5E5CE6]/15 border border-[#5E5CE6]/25 px-2 py-0.5 text-[10px] text-[#D7D6FF]"
                              >
                                {wf.word} ({wf.pos})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="p-4 sm:p-5 pt-3 border-t border-white/[0.08] pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3 bg-black/25">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-4 py-2 text-xs font-medium text-[#8E8E93] hover:text-white cursor-pointer"
              >
                {t.suggest.close}
              </button>

              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                disabled={loading}
                onClick={errorMsg ? handleRetry : handleGenerateMore}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#5E5CE6] to-[#0A84FF] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-[0_6px_22px_rgba(94,92,230,0.35)] hover:brightness-110 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t.suggest.generating}</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>
                      {errorMsg ? t.suggest.retryBtn : t.suggest.generateMore}
                    </span>
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
