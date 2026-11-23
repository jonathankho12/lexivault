"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import { AudioButton } from "@/components/ui/AudioButton";
import { HighlightedText } from "@/components/ui/HighlightedText";
import { PronunciationText } from "@/components/ui/PronunciationText";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { cn, getLocalizedMeaning, normalizeTermKey } from "@/lib/utils";
import type { PracticeQuestion } from "@/types/lexivault";

export function FillBlankCard({
  question,
  onComplete,
}: {
  question: PracticeQuestion;
  onComplete: (isCorrect: boolean) => void;
}) {
  const { accent } = useLexiVault();
  const { lang } = useLanguage();
  const isEn = lang === "en";

  const [inputValue, setInputValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const {
    word,
    blankSentence = "",
    blankTarget = word.term,
    blankTranslation,
    choices = [],
  } = question;

  const meaningHint =
    isEn
      ? getLocalizedMeaning(word, "en")
      : blankTranslation || getLocalizedMeaning(word, "id");

  const remoteUrl = accent === "UK" ? word.audio_uk_url : word.audio_us_url;

  const evaluateAnswer = (candidate: string) => {
    if (submitted) return;
    const normCandidate = normalizeTermKey(candidate);
    const normTarget = normalizeTermKey(blankTarget);
    const normTerm = normalizeTermKey(word.term);
    const ok =
      normCandidate.length > 0 &&
      (normCandidate === normTarget || normCandidate === normTerm);

    setInputValue(candidate);
    setIsCorrect(ok);
    setSubmitted(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || submitted) return;
    evaluateAnswer(inputValue);
  };

  const sentenceParts = blankSentence.split("_____");

  return (
    <div className="space-y-5">
      <div className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5E5CE6]/20 border border-[#5E5CE6]/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#C4C2FF]">
            Fill-in-the-Blank
          </span>
          <AudioButton
            text={word.term}
            remoteUrl={remoteUrl}
            wordId={word.id}
            label={
              submitted ? word.term : isEn ? "Hear Target" : "Dengar Target"
            }
            size="sm"
          />
        </div>

        <p className="text-lg sm:text-xl font-medium leading-relaxed text-[#F5F5F7]">
          {sentenceParts.length > 1 ? (
            <>
              {sentenceParts[0]}
              <span
                className={cn(
                  "inline-flex items-center rounded-xl px-2.5 py-0.5 mx-1 border font-semibold transition-colors",
                  !submitted
                    ? "bg-[#0A84FF]/15 border-[#0A84FF]/40 text-[#70BCFF]"
                    : isCorrect
                      ? "bg-[#30D158]/20 border-[#30D158]/50 text-[#7CF099]"
                      : "bg-[#FF453A]/20 border-[#FF453A]/50 text-[#FFB4AE]"
                )}
              >
                {submitted ? blankTarget : inputValue.trim() || "_____"}
              </span>
              {sentenceParts.slice(1).join("_____")}
            </>
          ) : (
            blankSentence
          )}
        </p>

        <div className="flex items-start gap-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3 text-xs text-[#8E8E93]">
          <HelpCircle className="h-4 w-4 shrink-0 text-[#0A84FF] mt-0.5" />
          <span className="leading-relaxed">
            {isEn ? "Meaning hint: " : "Petunjuk makna: "}
            {meaningHint}
          </span>
        </div>
      </div>

      {/* Type Answer Form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2.5">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={submitted}
          placeholder={
            isEn
              ? "Type the expression or pick below..."
              : "Ketik kata/frasa atau pilih di bawah..."
          }
          className="liquid-glass-pill min-w-0 flex-1 rounded-full px-4 py-3 text-base text-[#F5F5F7] placeholder:text-[#8E8E93] focus:outline-none focus:border-[#0A84FF]/55"
        />
        <motion.button
          type="submit"
          whileTap={TAP_SCALE}
          disabled={submitted || !inputValue.trim()}
          className={cn(
            "shrink-0 rounded-full px-5 py-3 text-sm font-semibold transition-all cursor-pointer",
            !submitted && inputValue.trim()
              ? "bg-[#0A84FF] text-white shadow-[0_6px_20px_rgba(10,132,255,0.35)]"
              : "bg-white/[0.08] text-[#8E8E93] cursor-not-allowed"
          )}
        >
          {isEn ? "Check" : "Cek"}
        </motion.button>
      </form>

      {/* Quick Word Bank Pills */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93] px-1">
          {isEn
            ? "Or pick quickly from the Word Bank:"
            : "Atau pilih cepat dari Word Bank:"}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {choices.map((choice, idx) => {
            const isTarget =
              normalizeTermKey(choice) === normalizeTermKey(blankTarget);
            const isUserPick =
              normalizeTermKey(choice) === normalizeTermKey(inputValue);

            let btnStyle =
              "bg-white/[0.06] border-white/[0.12] text-[#F5F5F7] hover:bg-white/[0.11]";
            if (submitted) {
              if (isTarget) {
                btnStyle = "bg-[#30D158]/20 border-[#30D158]/55 text-white";
              } else if (isUserPick) {
                btnStyle = "bg-[#FF453A]/20 border-[#FF453A]/55 text-[#FFB4AE]";
              } else {
                btnStyle =
                  "bg-white/[0.03] border-white/[0.07] text-[#8E8E93] opacity-60";
              }
            }

            return (
              <motion.button
                key={idx}
                type="button"
                whileTap={submitted ? undefined : TAP_SCALE}
                disabled={submitted}
                onClick={() => evaluateAnswer(choice)}
                className={cn(
                  "rounded-2xl border px-3.5 py-3 text-sm font-medium text-center transition-all cursor-pointer",
                  btnStyle
                )}
              >
                {choice}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Result Banner */}
      {submitted && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={IOS_SPRING}
          className="liquid-glass rounded-3xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {isCorrect ? (
                <CheckCircle2 className="h-5 w-5 text-[#30D158]" />
              ) : (
                <XCircle className="h-5 w-5 text-[#FF453A]" />
              )}
              <span
                className={cn(
                  "text-sm font-semibold",
                  isCorrect ? "text-[#30D158]" : "text-[#FF453A]"
                )}
              >
                {isCorrect
                  ? isEn
                    ? "Correct! Accurate contextual usage."
                    : "Benar! Penggunaan kontekstual tepat."
                  : isEn
                    ? `Correct answer: "${blankTarget}"`
                    : `Jawaban yang tepat: "${blankTarget}"`}
              </span>
            </div>
          </div>

          <PronunciationText
            term={word.term}
            pronunciation={word.pronunciation}
            ipa={word.ipa}
            showIpa
            size="xs"
          />

          {word.examples_json?.[0] && (
            <p className="text-xs text-[#A1A1AA]">
              <HighlightedText text={word.examples_json[0].sentence} />
            </p>
          )}

          <div className="flex justify-end">
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => onComplete(isCorrect)}
              className="inline-flex items-center gap-2 rounded-full bg-[#0A84FF] px-5 py-2.5 text-sm font-semibold text-white cursor-pointer"
            >
              <span>{isEn ? "Next" : "Lanjut"}</span>
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
