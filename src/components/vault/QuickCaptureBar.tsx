"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { SourceTag } from "@/types/lexivault";

const SOURCE_TAGS: SourceTag[] = ["Film", "Buku", "Kuliah", "Artikel", "Umum"];

export function QuickCaptureBar({
  onPendingTermChange,
}: {
  onPendingTermChange?: (term: string) => void;
}) {
  const { addWordViaAI, isCapturing, captureToast, clearCaptureToast } =
    useLexiVault();
  const { t } = useLanguage();
  const [term, setTerm] = useState("");
  const [sourceTag, setSourceTag] = useState<SourceTag>("Artikel");

  useEffect(() => {
    if (!captureToast) return;
    const timer = setTimeout(() => {
      clearCaptureToast();
    }, 3600);
    return () => clearTimeout(timer);
  }, [captureToast, clearCaptureToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = term.trim();
    if (!trimmed || isCapturing) return;

    onPendingTermChange?.(trimmed);
    const result = await addWordViaAI(trimmed, sourceTag);
    onPendingTermChange?.("");
    if (result.ok || result.duplicate) {
      setTerm("");
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
            {SOURCE_TAGS.map((tag) => {
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
                  {tag}
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
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={IOS_SPRING}
            className="inline-flex items-center gap-2 rounded-full bg-[#30D158]/15 border border-[#30D158]/35 px-3.5 py-1.5 text-xs font-medium text-[#7CF099]"
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>{captureToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
