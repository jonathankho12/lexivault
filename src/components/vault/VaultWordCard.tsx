"use client";

import { motion } from "framer-motion";
import { ChevronRight, Tag } from "lucide-react";
import { AudioButton } from "@/components/ui/AudioButton";
import { HighlightedText } from "@/components/ui/HighlightedText";
import { PronunciationText } from "@/components/ui/PronunciationText";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { STAGGER_ITEM, TAP_SCALE } from "@/lib/motion";
import {
  cn,
  formatCefrBadgeClass,
  formatRegisterBadgeClass,
  formatSourceTagLabel,
  formatTypeLabel,
  getLocalizedMeaning,
  getWordAccuracy,
} from "@/lib/utils";
import type { WordEntry } from "@/types/lexivault";

export function VaultWordCard({ word }: { word: WordEntry }) {
  const { accent, setSelectedWord } = useLexiVault();
  const { lang, t } = useLanguage();
  const accuracy = getWordAccuracy(word);
  const remoteUrl = accent === "UK" ? word.audio_uk_url : word.audio_us_url;
  const firstExample = word.examples_json?.[0];
  const meaning = getLocalizedMeaning(word, lang);

  return (
    <motion.article
      variants={STAGGER_ITEM}
      whileTap={TAP_SCALE}
      onClick={() => setSelectedWord(word)}
      className="liquid-glass transform-gpu will-change-transform group rounded-3xl p-4 sm:p-5 cursor-pointer transition-colors hover:bg-white/[0.085] hover:border-white/[0.18]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-white/[0.08] border border-white/[0.12] text-[#F5F5F7]">
              {formatTypeLabel(word.type)}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                formatRegisterBadgeClass(word.register)
              )}
            >
              {word.register}
            </span>
            {word.cefr && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold border",
                  formatCefrBadgeClass(word.cefr)
                )}
              >
                {word.cefr}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] text-[#8E8E93] bg-white/[0.04]">
              <Tag className="h-2.5 w-2.5" />
              {formatSourceTagLabel(word.source_tag, lang)}
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[#F5F5F7] break-words">
            {word.term}
          </h3>
          <PronunciationText
            term={word.term}
            pronunciation={word.pronunciation}
            ipa={word.ipa}
            size="xs"
            className="mt-0.5"
          />
        </div>

        <AudioButton
          text={word.term}
          remoteUrl={remoteUrl}
          wordId={word.id}
          size="sm"
        />
      </div>

      <p className="mt-2 text-sm leading-relaxed text-[#E5E5EA] line-clamp-2">
        {meaning}
      </p>

      {firstExample && (
        <p className="mt-2.5 text-xs leading-relaxed text-[#8E8E93] line-clamp-2">
          <HighlightedText text={firstExample.sentence} />
        </p>
      )}

      {/* Footer Metadata */}
      <div className="mt-3.5 pt-3 border-t border-white/[0.08] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {word.word_families_json.length > 0 && (
            <span className="text-[11px] text-[#8E8E93] truncate">
              {word.word_families_json
                .slice(0, 2)
                .map((wf) => `${wf.word} (${wf.pos})`)
                .join(" · ")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {accuracy !== null ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-semibold",
                accuracy >= 70
                  ? "text-[#30D158]"
                  : accuracy >= 45
                    ? "text-[#FF9F0A]"
                    : "text-[#FF453A]"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  accuracy >= 70
                    ? "bg-[#30D158]"
                    : accuracy >= 45
                      ? "bg-[#FF9F0A]"
                      : "bg-[#FF453A]"
                )}
              />
              {accuracy}%
            </span>
          ) : (
            <span className="text-[11px] font-medium text-[#0A84FF]">
              {t.vault.newBadge}
            </span>
          )}
          <ChevronRight className="h-3.5 w-3.5 text-[#8E8E93] group-hover:text-white transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </motion.article>
  );
}
