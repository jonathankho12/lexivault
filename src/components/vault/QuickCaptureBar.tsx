"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowUp,
  CheckCircle2,
  Eye,
  Info,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { playGlassClick } from "@/lib/soundEffects";
import {
  CANONICAL_SOURCE_TAGS,
  cn,
  formatSourceTagLabel,
} from "@/lib/utils";
import type { SourceTag } from "@/types/lexivault";

export function QuickCaptureBar({
  onPendingTermChange,
}: {
  onPendingTermChange?: (term: string) => void;
}) {
  const {
    addWordViaAI,
    isCapturing,
    captureToast,
    clearCaptureToast,
    setSelectedWord,
  } = useLexiVault();
  const { lang, t } = useLanguage();
  const [term, setTerm] = useState("");
  const [sourceTag, setSourceTag] = useState<SourceTag>("article");

  useEffect(() => {
    if (!captureToast) return;
    const duration =
      captureToast.type === "error" || captureToast.type === "duplicate"
        ? 6000
        : 3600;
    const timer = setTimeout(() => {
      clearCaptureToast();
    }, duration);
    return () => clearTimeout(timer);
  }, [captureToast, clearCaptureToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = term.trim();
    if (!trimmed || isCapturing) return;

    playGlassClick();
    // Clear input immediately for snappy non-blocking UX; restore only on non-duplicate error
    setTerm("");
    onPendingTermChange?.(trimmed);
    const result = await addWordViaAI(trimmed, sourceTag);
    onPendingTermChange?.("");
    if (!result.ok && !result.duplicate) {
      setTerm(trimmed);
    }
  };

  return (
    <div className="space-y-2.5">
      <form
        onSubmit={handleSubmit}
        className="liquid-glass rounded-3xl p-3 sm:p-3.5 transition-shadow focus-within:border-[#0A84FF]/45 focus-within:shadow-[inset_0_1px_1px_rgba(255,255,255,0.28),0_12px_40px_rgba(10,132,255,0.16)]"
      >
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A84FF]/15 border border-[#0A84FF]/30">
            <Sparkles className="h-4 w-4 text-[#0A84FF]" />
          </div>

          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t.vault.capturePlaceholder}
            disabled={isCapturing}
            className="min-w-0 flex-1 bg-transparent px-1.5 py-1.5 text-base text-[#F5F5F7] placeholder:text-[#8E8E93] focus:outline-none"
          />

          <motion.button
            type="submit"
            whileTap={TAP_SCALE}
            disabled={!term.trim() || isCapturing}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer",
              term.trim() && !isCapturing
                ? "bg-[#0A84FF] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_6px_20px_rgba(10,132,255,0.4)] hover:bg-[#1A8EFF]"
                : "bg-white/[0.08] text-[#8E8E93] cursor-not-allowed"
            )}
          >
            {isCapturing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{t.vault.captureSaving}</span>
              </>
            ) : (
              <>
                <span>{t.vault.captureSave}</span>
                <ArrowUp className="h-3.5 w-3.5" />
              </>
            )}
          </motion.button>
        </div>

        {/* Source Tag Pills + AI Auto-Categorization Hint */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.07]">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="shrink-0 text-[11px] font-medium text-[#8E8E93] mr-1">
              {t.vault.captureSourceLabel}
            </span>
            {CANONICAL_SOURCE_TAGS.map((tag) => {
              const active = sourceTag === tag;
              return (
                <motion.button
                  key={tag}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setSourceTag(tag)}
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                    active
                      ? "bg-[#0A84FF]/22 text-[#70BCFF] border border-[#0A84FF]/40"
                      : "bg-white/[0.04] text-[#8E8E93] border border-transparent hover:text-[#F5F5F7]"
                  )}
                >
                  {formatSourceTagLabel(tag, lang)}
                </motion.button>
              );
            })}
          </div>

          <span className="text-[10px] font-medium text-[#8E8E93]">
            {t.vault.captureHint}
          </span>
        </div>
      </form>

      <AnimatePresence>
        {captureToast && (
          <motion.div
            role={captureToast.type === "error" ? "alert" : "status"}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={IOS_SPRING}
            className={cn(
              "inline-flex flex-wrap items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-medium",
              captureToast.type === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : captureToast.type === "duplicate"
                  ? "bg-[#FF9F0A]/12 border-[#FF9F0A]/35 text-[#FFD18C]"
                  : captureToast.type === "info"
                    ? "bg-[#0A84FF]/15 border-[#0A84FF]/35 text-[#70BCFF]"
                    : "bg-[#30D158]/15 border-[#30D158]/35 text-[#7CF099]"
            )}
          >
            {captureToast.type === "error" ? (
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
            ) : captureToast.type === "duplicate" ||
              captureToast.type === "info" ? (
              <Info className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{captureToast.message}</span>

            {captureToast.type === "duplicate" && captureToast.matchedWord && (
              <button
                type="button"
                onClick={() => {
                  playGlassClick();
                  setSelectedWord(captureToast.matchedWord!);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-[#FF9F0A]/22 border border-[#FF9F0A]/45 px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-[#FF9F0A]/35 cursor-pointer transition-colors"
              >
                <Eye className="h-3 w-3" />
                <span>{t.vault.viewCardBtn}</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
