"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookMarked, Clock, FileText, Search, X } from "lucide-react";
import { ShimmerWordSkeleton } from "@/components/ui/ShimmerWordSkeleton";
import { QuickCaptureBar } from "@/components/vault/QuickCaptureBar";
import { TextExtractorSheet } from "@/components/vault/TextExtractorSheet";
import { VaultWordCard } from "@/components/vault/VaultWordCard";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { usePronunciation } from "@/hooks/usePronunciation";
import { STAGGER_CONTAINER, TAP_SCALE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { RegisterType, WordType } from "@/types/lexivault";

type TypeFilter = "all" | WordType;
type RegisterFilter = "all" | RegisterType;

export function VaultView() {
  const { words, accent, isCapturing, isHydrated, launchCommuteMode } =
    useLexiVault();
  const { t } = useLanguage();
  const { prefetchMany } = usePronunciation();

  const [pendingTerm, setPendingTerm] = useState("");
  const [extractorOpen, setExtractorOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [registerFilter, setRegisterFilter] = useState<RegisterFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const availableSources = useMemo(() => {
    const set = new Set<string>();
    for (const w of words) {
      if (w.source_tag) set.add(w.source_tag);
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
        sourceFilter !== "all" &&
        (word.source_tag || "Umum") !== sourceFilter
      )
        return false;

      if (!q) return true;
      return (
        word.term.toLowerCase().includes(q) ||
        word.meaning_id.toLowerCase().includes(q) ||
        word.synonyms.some((s) => s.toLowerCase().includes(q)) ||
        word.word_families_json.some((wf) => wf.word.toLowerCase().includes(q))
      );
    });
  }, [words, search, typeFilter, registerFilter, sourceFilter]);

  // Background pre-fetch audio for top visible cards so tapping Play is 0ms lag
  useEffect(() => {
    if (!isHydrated || filteredWords.length === 0) return;
    const topVisible = filteredWords.slice(0, 6).map((w) => ({
      text: w.term,
      accent,
      remoteUrl: accent === "UK" ? w.audio_uk_url : w.audio_us_url,
      wordId: w.id,
    }));
    prefetchMany(topVisible);
  }, [filteredWords, accent, isHydrated, prefetchMany]);

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
            onClick={() => setExtractorOpen(true)}
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

      <TextExtractorSheet
        open={extractorOpen}
        onClose={() => setExtractorOpen(false)}
      />

      {/* Floating Quick-Capture Input Bar */}
      <QuickCaptureBar onPendingTermChange={setPendingTerm} />

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
              {src === "all" ? t.vault.allSources : src}
            </button>
          ))}
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
      ) : filteredWords.length === 0 ? (
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
          key={`${typeFilter}-${registerFilter}-${sourceFilter}-${search ? "q" : "all"}`}
          variants={STAGGER_CONTAINER}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {filteredWords.map((word) => (
            <VaultWordCard key={word.id} word={word} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
