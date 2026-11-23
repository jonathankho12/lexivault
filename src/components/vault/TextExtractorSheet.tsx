"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { playCorrectChime, playGlassClick } from "@/lib/soundEffects";
import { IOS_SHEET_SPRING, TAP_SCALE } from "@/lib/motion";
import {
  CANONICAL_SOURCE_TAGS,
  cn,
  formatRegisterBadgeClass,
  formatSourceTagLabel,
  formatTypeLabel,
  getLocalizedMeaning,
  normalizeTermKey,
} from "@/lib/utils";
import type { ExtractedVocabItem, SourceTag } from "@/types/lexivault";

export function TextExtractorSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { words, addExtractedWordsBatch } = useLexiVault();
  const { lang, t } = useLanguage();

  const [mounted, setMounted] = useState(false);
  const [rawText, setRawText] = useState("");
  const [sourceTag, setSourceTag] = useState<SourceTag>("article");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ExtractedVocabItem[]>([]);
  const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const existingVaultKeys = new Set(
    words.map((w) => normalizeTermKey(w.term))
  );

  const handleExtract = async () => {
    if (extracting || rawText.trim().length < 15) return;
    setExtracting(true);
    setErrorMsg(null);
    setSavedCount(null);
    playGlassClick();

    try {
      const res = await fetch("/api/extract-vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawText.trim(),
          sourceTag,
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
            detail?: string;
          };
          apiCode = errJson.code ?? "";
          apiError = errJson.error ?? "";
          console.error(
            `[TextExtractorSheet] /api/extract-vocab failed (HTTP ${res.status}, code=${apiCode || "unknown"}):`,
            errJson.detail || apiError || res.statusText
          );
        } catch {
          // Non-JSON error body
        }
        const isEn = lang === "en";
        const reason =
          apiCode === "missing_key"
            ? isEn
              ? "GEMINI_API_KEY is not configured on the server."
              : "GEMINI_API_KEY belum terkonfigurasi di server."
            : apiCode === "quota"
              ? isEn
                ? "Gemini AI quota limit reached. Please retry shortly."
                : "Batas kuota Gemini AI tercapai. Coba lagi sebentar lagi."
              : apiCode === "auth"
                ? isEn
                  ? "Gemini API key authentication failed."
                  : "Autentikasi Gemini API key gagal."
                : apiError || `${t.extractor.genericErr} (HTTP ${res.status})`;
        setErrorMsg(reason);
        return;
      }
      const json = (await res.json()) as { items?: ExtractedVocabItem[] };
      const extracted = Array.isArray(json.items) ? json.items : [];
      if (extracted.length === 0) {
        setErrorMsg(t.extractor.emptyErr);
        setItems([]);
        setSelectedTerms(new Set());
        return;
      }
      setItems(extracted);
      const autoCheck = new Set(
        extracted
          .filter((it) => !existingVaultKeys.has(normalizeTermKey(it.term)))
          .map((it) => normalizeTermKey(it.term))
      );
      setSelectedTerms(autoCheck);
    } catch {
      setErrorMsg(t.extractor.genericErr);
    } finally {
      setExtracting(false);
    }
  };

  const toggleSelect = (term: string) => {
    const key = normalizeTermKey(term);
    setSelectedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSaveSelected = async () => {
    if (saving || selectedTerms.size === 0) return;
    setSaving(true);
    const chosen = items.filter((it) =>
      selectedTerms.has(normalizeTermKey(it.term))
    );
    const count = await addExtractedWordsBatch(chosen, sourceTag);
    setSaving(false);
    setSavedCount(count);
    if (count > 0) {
      playCorrectChime(2);
    }
  };

  const resetAll = () => {
    setRawText("");
    setItems([]);
    setSelectedTerms(new Set());
    setErrorMsg(null);
    setSavedCount(null);
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          key="text-extractor-portal"
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
            aria-label={t.extractor.title}
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 36 }}
            transition={IOS_SHEET_SPRING}
            className="liquid-glass-elevated transform-gpu will-change-transform relative z-10 w-full md:max-w-2xl max-h-[90dvh] overflow-y-auto no-scrollbar rounded-t-[32px] md:rounded-3xl p-5 sm:p-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] space-y-4"
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/25 md:hidden" />

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0A84FF]/20 border border-[#0A84FF]/35">
                  <FileText className="h-5 w-5 text-[#70BCFF]" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    {t.extractor.title}
                  </h3>
                  <p className="text-xs text-[#8E8E93]">
                    {t.extractor.subtitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={t.extractor.close}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-[#8E8E93] hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Source Tag Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-xs text-[#8E8E93] mr-1 shrink-0">
                {t.extractor.sourceLabel}:
              </span>
              {CANONICAL_SOURCE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSourceTag(tag)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-medium border cursor-pointer",
                    sourceTag === tag
                      ? "bg-[#0A84FF]/22 border-[#0A84FF]/45 text-[#70BCFF]"
                      : "bg-white/[0.04] border-white/[0.09] text-[#8E8E93]"
                  )}
                >
                  {formatSourceTagLabel(tag, lang)}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              rows={5}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              disabled={extracting}
              placeholder={t.extractor.textPlaceholder}
              className="w-full resize-y rounded-2xl bg-black/40 border border-white/[0.12] p-3.5 text-base sm:text-sm leading-relaxed text-[#F5F5F7] placeholder:text-[#8E8E93]/75 focus:outline-none focus:border-[#0A84FF]/60"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              {items.length > 0 ? (
                <button
                  type="button"
                  onClick={resetAll}
                  className="text-xs font-medium text-[#8E8E93] hover:text-white cursor-pointer"
                >
                  Clear
                </button>
              ) : (
                <span className="text-[11px] text-[#8E8E93]">Min 15 chars</span>
              )}

              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                disabled={extracting || rawText.trim().length < 15}
                onClick={() => void handleExtract()}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white cursor-pointer disabled:opacity-50"
              >
                {extracting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t.extractor.extractingBtn}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>{t.extractor.extractBtn}</span>
                  </>
                )}
              </motion.button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs text-red-400"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {savedCount !== null && (
              <div className="flex items-center gap-2 rounded-2xl bg-[#30D158]/15 border border-[#30D158]/35 px-4 py-2.5 text-xs font-semibold text-[#7CF099]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  {t.extractor.savedPrefix} {savedCount} {t.extractor.savedSuffix}
                </span>
              </div>
            )}

            {/* Extracted Checklist */}
            {items.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-white/[0.1]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">
                    {t.extractor.pickItemsHint} ({items.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedTerms.size === items.length) {
                        setSelectedTerms(new Set());
                      } else {
                        setSelectedTerms(
                          new Set(items.map((it) => normalizeTermKey(it.term)))
                        );
                      }
                    }}
                    className="font-semibold text-[#70BCFF] hover:text-white cursor-pointer"
                  >
                    {t.extractor.selectAll}
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
                  {items.map((item) => {
                    const key = normalizeTermKey(item.term);
                    const checked = selectedTerms.has(key);
                    const alreadyInVault = existingVaultKeys.has(key);

                    return (
                      <div
                        key={item.term}
                        onClick={() => toggleSelect(item.term)}
                        className={cn(
                          "flex items-start gap-3 rounded-2xl border p-3 cursor-pointer transition-colors",
                          checked
                            ? "bg-[#0A84FF]/14 border-[#0A84FF]/45"
                            : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07]"
                        )}
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                            checked
                              ? "bg-[#0A84FF] border-[#0A84FF] text-white"
                              : "bg-white/[0.05] border-white/[0.2] text-transparent"
                          )}
                        >
                          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-bold text-white">
                              {item.term}
                            </span>
                            <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#D1D1D6]">
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
                            {alreadyInVault && (
                              <span className="rounded-full bg-[#30D158]/15 px-2 py-0.5 text-[10px] font-medium text-[#7CF099]">
                                {t.extractor.alreadyInVault}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#D1D1D6] leading-snug">
                            {getLocalizedMeaning(item, lang)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <motion.button
                  type="button"
                  whileTap={TAP_SCALE}
                  disabled={saving || selectedTerms.size === 0}
                  onClick={() => void handleSaveSelected()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#30D158] py-3 text-sm font-bold text-black cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t.extractor.savingBtn}</span>
                    </>
                  ) : (
                    <span>
                      {t.extractor.saveSelectedBtn} ({selectedTerms.size})
                    </span>
                  )}
                </motion.button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
