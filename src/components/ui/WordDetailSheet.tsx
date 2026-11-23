"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Layers,
  Loader2,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { AudioButton } from "@/components/ui/AudioButton";
import { HighlightedText } from "@/components/ui/HighlightedText";
import { PronunciationText } from "@/components/ui/PronunciationText";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { usePronunciation } from "@/hooks/usePronunciation";
import { IOS_SHEET_SPRING, TAP_SCALE } from "@/lib/motion";
import {
  cn,
  formatRegisterBadgeClass,
  formatSourceTagLabel,
  formatTypeLabel,
  getLocalizedMeaning,
  getWordAccuracy,
} from "@/lib/utils";

export function WordDetailSheet() {
  const { selectedWord, setSelectedWord, removeWord, refreshWordWithAI } =
    useLexiVault();
  const { lang, t } = useLanguage();
  const { prefetchMany } = usePronunciation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [refreshingAI, setRefreshingAI] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  useEffect(() => {
    setConfirmDelete(false);
    setAiStatusMsg(null);
    if (!selectedWord) return;

    prefetchMany([
      {
        text: selectedWord.term,
        accent: "US",
        remoteUrl: selectedWord.audio_us_url,
        wordId: selectedWord.id,
      },
      {
        text: selectedWord.term,
        accent: "UK",
        remoteUrl: selectedWord.audio_uk_url,
        wordId: selectedWord.id,
      },
    ]);
  }, [selectedWord, prefetchMany]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedWord(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setSelectedWord]);

  const accuracy = selectedWord ? getWordAccuracy(selectedWord) : null;

  return (
    <AnimatePresence>
      {selectedWord && (
        <div
          key="word-detail-portal"
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setSelectedWord(null)}
            className="fixed inset-0 bg-black/75"
          />

          {/* Bottom sheet (mobile) / Centered glass modal (desktop) */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={
              lang === "en"
                ? `Details for ${selectedWord.term}`
                : `Detail untuk ${selectedWord.term}`
            }
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 36 }}
            transition={IOS_SHEET_SPRING}
            className="liquid-glass-elevated transform-gpu will-change-transform relative z-10 w-full md:max-w-xl max-h-[88dvh] overflow-y-auto no-scrollbar rounded-t-[32px] md:rounded-3xl p-5 sm:p-6 pb-[max(1.75rem,env(safe-area-inset-bottom))]"
          >
            {/* Mobile drag indicator */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25 md:hidden" />

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-white/[0.08] border border-white/[0.12] text-[#F5F5F7]">
                    {formatTypeLabel(selectedWord.type)}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
                      formatRegisterBadgeClass(selectedWord.register)
                    )}
                  >
                    {selectedWord.register}
                  </span>
                  {selectedWord.cefr && (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-[#5E5CE6]/20 border border-[#5E5CE6]/35 text-[#C8C6FF]">
                      {selectedWord.cefr}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] text-[#8E8E93] bg-white/[0.05] border border-white/[0.08]">
                    <Tag className="h-3 w-3" />
                    {formatSourceTagLabel(selectedWord.source_tag, lang)}
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F7] break-words">
                  {selectedWord.term}
                </h2>
                <PronunciationText
                  term={selectedWord.term}
                  pronunciation={selectedWord.pronunciation}
                  ipa={selectedWord.ipa}
                  showIpa
                  size="sm"
                  className="mt-1.5"
                />
              </div>

              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                onClick={() => setSelectedWord(null)}
                aria-label={t.wordDetail.close}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.12] text-[#8E8E93] hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>

            {/* Dual US & UK Audio Bar + AI Refresh */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <AudioButton
                text={selectedWord.term}
                accentOverride="US"
                remoteUrl={selectedWord.audio_us_url}
                wordId={selectedWord.id}
                label="US Accent"
                size="sm"
              />
              <AudioButton
                text={selectedWord.term}
                accentOverride="UK"
                remoteUrl={selectedWord.audio_uk_url}
                wordId={selectedWord.id}
                label="UK Accent"
                size="sm"
              />
              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                disabled={refreshingAI}
                onClick={async () => {
                  setRefreshingAI(true);
                  setAiStatusMsg(null);
                  const res = await refreshWordWithAI(selectedWord.id);
                  setRefreshingAI(false);
                  if (res.ok) {
                    setAiStatusMsg({
                      isError: false,
                      text:
                        res.source === "gemini"
                          ? lang === "en"
                            ? "Updated by Gemini AI"
                            : "Diperbarui oleh Gemini AI"
                          : lang === "en"
                            ? "Updated from offline dictionary"
                            : "Diperbarui dari kamus fallback",
                    });
                  } else {
                    setAiStatusMsg({
                      isError: true,
                      text:
                        res.error ||
                        (lang === "en"
                          ? "Failed to refresh details."
                          : "Gagal memperbarui detail."),
                    });
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-[#0A84FF]/15 border border-[#0A84FF]/35 text-[#70BCFF] hover:bg-[#0A84FF]/25 cursor-pointer disabled:opacity-60"
              >
                {refreshingAI ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>
                  {refreshingAI
                    ? t.wordDetail.refreshingAi
                    : t.wordDetail.refreshAiBtn}
                </span>
              </motion.button>

              {accuracy !== null && (
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-white/[0.06] border border-white/[0.1] text-[#F5F5F7]">
                  <CheckCircle2
                    className={cn(
                      "h-3.5 w-3.5",
                      accuracy >= 70
                        ? "text-[#30D158]"
                        : accuracy >= 45
                          ? "text-[#FF9F0A]"
                          : "text-[#FF453A]"
                    )}
                  />
                  {accuracy}% ({selectedWord.correct_count}/
                  {selectedWord.correct_count + selectedWord.wrong_count})
                </span>
              )}
            </div>

            {aiStatusMsg && (
              <div
                role={aiStatusMsg.isError ? "alert" : "status"}
                className={cn(
                  "mt-2.5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium",
                  aiStatusMsg.isError
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "bg-[#30D158]/15 border-[#30D158]/35 text-[#7CF099]"
                )}
              >
                {aiStatusMsg.isError ? (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>{aiStatusMsg.text}</span>
              </div>
            )}

            {/* Meaning */}
            <div className="mt-5 rounded-2xl bg-white/[0.05] border border-white/[0.09] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93] mb-1">
                {t.wordDetail.meaningTitle}
              </p>
              <p className="text-[15px] leading-relaxed text-[#F5F5F7]">
                {getLocalizedMeaning(selectedWord, lang)}
              </p>
            </div>

            {/* Examples */}
            {selectedWord.examples_json.length > 0 && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">
                  <BookOpen className="h-3.5 w-3.5 text-[#0A84FF]" />
                  <span>{t.wordDetail.examplesTitle}</span>
                </div>
                {selectedWord.examples_json.map((ex, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#0A84FF]/15 text-[#70BCFF] border border-[#0A84FF]/25">
                        {ex.context || (idx === 0 ? "Daily" : "Academic")}
                      </span>
                      <AudioButton
                        text={ex.sentence.replace(/\*\*/g, "")}
                        size="sm"
                      />
                    </div>
                    <p className="text-sm leading-relaxed text-[#F5F5F7]">
                      <HighlightedText text={ex.sentence} />
                    </p>
                    {lang === "id" && ex.translation_id && (
                      <p className="text-xs leading-relaxed text-[#8E8E93]">
                        <HighlightedText text={ex.translation_id} />
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Word Family */}
            {selectedWord.word_families_json.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8E8E93] mb-2.5">
                  <Layers className="h-3.5 w-3.5 text-[#5E5CE6]" />
                  <span>{t.wordDetail.wordFamilyTitle}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedWord.word_families_json.map((wf, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs bg-[#5E5CE6]/15 border border-[#5E5CE6]/30 text-[#D7D6FF]"
                    >
                      <span className="font-medium text-white">{wf.word}</span>
                      <span className="text-[11px] text-[#A7A5FF]">
                        ({wf.pos})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Synonyms & Antonyms */}
            {(selectedWord.synonyms.length > 0 ||
              selectedWord.antonyms.length > 0) && (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedWord.synonyms.length > 0 && (
                  <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#30D158] mb-2">
                      {t.wordDetail.synonymsTitle}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedWord.synonyms.map((syn, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-[#30D158]/10 border border-[#30D158]/25 px-2.5 py-0.5 text-xs text-[#A5F2B8]"
                        >
                          {syn}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedWord.antonyms.length > 0 && (
                  <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#FF9F0A] mb-2">
                      {t.wordDetail.antonymsTitle}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedWord.antonyms.map((ant, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-[#FF9F0A]/10 border border-[#FF9F0A]/25 px-2.5 py-0.5 text-xs text-[#FFD18C]"
                        >
                          {ant}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer Delete */}
            <div className="mt-6 pt-4 border-t border-white/[0.1] flex items-center justify-between">
              <span className="text-xs text-[#8E8E93]">
                {t.wordDetail.accuracyLabel}: {accuracy !== null ? `${accuracy}%` : "—"}
              </span>

              {!confirmDelete ? (
                <motion.button
                  type="button"
                  whileTap={TAP_SCALE}
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-[#FF453A] bg-[#FF453A]/10 border border-[#FF453A]/25 hover:bg-[#FF453A]/20 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{t.wordDetail.deleteBtn}</span>
                </motion.button>
              ) : (
                <div className="flex items-center gap-2">
                  <motion.button
                    type="button"
                    whileTap={TAP_SCALE}
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-full px-3 py-1.5 text-xs text-[#8E8E93] bg-white/[0.06] cursor-pointer"
                  >
                    {t.wordDetail.cancelBtn}
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={TAP_SCALE}
                    onClick={() => void removeWord(selectedWord.id)}
                    className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-white bg-[#FF453A] cursor-pointer"
                  >
                    {t.wordDetail.confirmDeleteBtn}
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
