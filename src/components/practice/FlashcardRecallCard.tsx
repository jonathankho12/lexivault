"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  RotateCw,
  XCircle,
} from "lucide-react";
import { AudioButton } from "@/components/ui/AudioButton";
import { HighlightedText } from "@/components/ui/HighlightedText";
import { PronunciationText } from "@/components/ui/PronunciationText";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import {
  cn,
  formatRegisterBadgeClass,
  formatTypeLabel,
  getLocalizedMeaning,
} from "@/lib/utils";
import type { PracticeQuestion } from "@/types/lexivault";

export function FlashcardRecallCard({
  question,
  onComplete,
}: {
  question: PracticeQuestion;
  onComplete: (isCorrect: boolean) => void;
}) {
  const { accent } = useLexiVault();
  const { lang } = useLanguage();
  const [flipped, setFlipped] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const answerLockRef = useRef(false);
  const nextLockRef = useRef(false);

  const { word, choices = [], correctChoice } = question;
  const remoteUrl = accent === "UK" ? word.audio_uk_url : word.audio_us_url;
  const answered = picked !== null;
  const isCorrect = picked === correctChoice;
  const firstExample = word.examples_json?.[0];

  const handleSelectChoice = (choice: string) => {
    if (answered || answerLockRef.current) return;
    answerLockRef.current = true;
    setPicked(choice);
    setFlipped(true);
  };

  const handleNext = () => {
    if (!answered || nextLockRef.current) return;
    nextLockRef.current = true;
    setIsAdvancing(true);
    onComplete(isCorrect);
  };

  return (
    <div className="space-y-5">
      {/* 3D Flipping Flashcard */}
      <div className="perspective-1200">
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={IOS_SPRING}
          onClick={() => setFlipped((prev) => !prev)}
          className="preserve-3d transform-gpu will-change-transform relative min-h-[236px] sm:min-h-[256px] w-full cursor-pointer"
        >
          {/* Front Face */}
          <div className="liquid-glass backface-hidden absolute inset-0 flex flex-col justify-between rounded-3xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-white/[0.08] border border-white/[0.12] text-[#F5F5F7]">
                  {formatTypeLabel(word.type)}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
                    formatRegisterBadgeClass(word.register)
                  )}
                >
                  {word.register}
                </span>
              </div>

              <div onClick={(e) => e.stopPropagation()}>
                <AudioButton
                  text={word.term}
                  remoteUrl={remoteUrl}
                  wordId={word.id}
                  size="md"
                />
              </div>
            </div>

            <div className="my-auto py-3 text-center space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-widest text-[#8E8E93]">
                {lang === "en"
                  ? "Flashcard Recall · Guess the Meaning"
                  : "Flashcard Recall · Tebak Arti"}
              </p>
              <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-white break-words">
                {word.term}
              </h3>
              <PronunciationText
                term={word.term}
                pronunciation={word.pronunciation}
                ipa={word.ipa}
                showIpa
                align="center"
                size="sm"
              />
            </div>

            <div className="flex items-center justify-center gap-1.5 text-xs text-[#8E8E93]">
              <RotateCw className="h-3.5 w-3.5 text-[#70BCFF]" />
              <span>
                {answered
                  ? lang === "en"
                    ? "Tap card to view full meaning"
                    : "Ketuk kartu untuk lihat arti lengkap"
                  : lang === "en"
                    ? "Tap card for Context Hint"
                    : "Ketuk kartu untuk Context Hint"}
              </span>
            </div>
          </div>

          {/* Back Face — Context Hint ONLY before answering (no spoiler); Full meaning AFTER answering */}
          <div className="liquid-glass-elevated backface-hidden rotate-y-180 absolute inset-0 flex flex-col justify-between rounded-3xl p-5 sm:p-6 overflow-y-auto no-scrollbar">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {!answered ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FF9F0A]/18 border border-[#FF9F0A]/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#FFD18C]">
                      <Lightbulb className="h-3 w-3" />
                      CONTEXT HINT
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-[#0A84FF] truncate">
                      {word.term}
                    </span>
                  )}
                </div>
                {!answered ? (
                  <p className="text-sm font-bold text-white truncate">
                    {word.term}
                  </p>
                ) : (
                  <PronunciationText
                    term={word.term}
                    pronunciation={word.pronunciation}
                    ipa={word.ipa}
                    size="xs"
                  />
                )}
              </div>

              <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                <AudioButton
                  text={
                    !answered && firstExample
                      ? firstExample.sentence.replace(/\*\*/g, "")
                      : word.term
                  }
                  remoteUrl={!answered && firstExample ? undefined : remoteUrl}
                  wordId={!answered && firstExample ? undefined : word.id}
                  size="sm"
                />
              </div>
            </div>

            {!answered ? (
              /* PRE-ANSWER: Context Hint ONLY (English example with target highlighted, NO Indonesian translation) */
              <div className="my-auto space-y-3 py-2">
                {firstExample ? (
                  <div className="rounded-2xl bg-white/[0.05] border border-white/[0.09] p-3.5 sm:p-4">
                    <p className="text-sm sm:text-[15px] leading-relaxed text-[#F5F5F7]">
                      <HighlightedText text={firstExample.sentence} />
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white/[0.05] border border-white/[0.09] p-3.5 text-xs text-[#D1D1D6]">
                    {lang === "en"
                      ? `Usage register: ${word.register} · Category: ${formatTypeLabel(word.type)}`
                      : `Register penggunaan: ${word.register} · Kategori: ${formatTypeLabel(word.type)}`}
                  </div>
                )}

                <p className="text-[11px] text-[#8E8E93] text-center">
                  {lang === "en"
                    ? "Choose an answer below to reveal the full definition."
                    : "Pilih jawaban di bawah untuk membuka arti lengkapnya."}
                </p>
              </div>
            ) : (
              /* POST-ANSWER: Full localized meaning + example + word families */
              <div className="my-auto space-y-2.5 py-2">
                <p className="text-sm sm:text-base font-medium leading-relaxed text-[#F5F5F7]">
                  {getLocalizedMeaning(word, lang)}
                </p>
                {firstExample && (
                  <div className="rounded-2xl bg-white/[0.05] border border-white/[0.08] p-3 space-y-1">
                    <p className="text-xs leading-relaxed text-[#D1D1D6]">
                      <HighlightedText text={firstExample.sentence} />
                    </p>
                    {lang === "id" && firstExample.translation_id && (
                      <p className="text-[11px] leading-relaxed text-[#8E8E93]">
                        <HighlightedText text={firstExample.translation_id} />
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {answered &&
              word.type !== "idiom" &&
              word.word_families_json.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {word.word_families_json.slice(0, 4).map((wf, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-[#5E5CE6]/20 border border-[#5E5CE6]/35 px-2.5 py-0.5 text-[11px] text-[#D7D6FF]"
                  >
                    {wf.word} ({wf.pos})
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Multiple-Choice Meaning Options */}
      <div className="space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93] px-1">
          {lang === "en"
            ? "Select the most accurate meaning:"
            : "Pilih arti Bahasa Indonesia yang paling tepat:"}
        </p>
        <div className="grid grid-cols-1 gap-2.5">
          {choices.map((choice, idx) => {
            const isThisCorrect = choice === correctChoice;
            const isThisPicked = choice === picked;

            let stateClass =
              "bg-white/[0.06] border-white/[0.12] text-[#F5F5F7] hover:bg-white/[0.1]";
            if (answered) {
              if (isThisCorrect) {
                stateClass =
                  "bg-[#30D158]/20 border-[#30D158]/55 text-white shadow-[0_0_24px_rgba(48,209,88,0.18)]";
              } else if (isThisPicked) {
                stateClass =
                  "bg-[#FF453A]/20 border-[#FF453A]/55 text-[#FFD5D2]";
              } else {
                stateClass =
                  "bg-white/[0.03] border-white/[0.07] text-[#8E8E93] opacity-65";
              }
            }

            return (
              <motion.button
                key={idx}
                type="button"
                whileTap={answered ? undefined : TAP_SCALE}
                disabled={answered}
                onClick={() => handleSelectChoice(choice)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm transition-all cursor-pointer",
                  stateClass
                )}
              >
                <span className="leading-snug">{choice}</span>
                {answered && isThisCorrect && (
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-[#30D158]" />
                )}
                {answered && isThisPicked && !isThisCorrect && (
                  <XCircle className="h-4.5 w-4.5 shrink-0 text-[#FF453A]" />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Continue Footer */}
      {answered && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={IOS_SPRING}
          className="flex items-center justify-between gap-3 pt-1"
        >
          <span
            className={cn(
              "text-sm font-semibold",
              isCorrect ? "text-[#30D158]" : "text-[#FF453A]"
            )}
          >
            {isCorrect
              ? lang === "en"
                ? "Spot on!"
                : "Tepat sekali!"
              : lang === "en"
                ? "Not quite — review the meaning on the card."
                : "Belum tepat — pelajari artinya di kartu."}
          </span>

          <motion.button
            type="button"
            whileTap={isAdvancing ? undefined : TAP_SCALE}
            disabled={isAdvancing}
            onClick={handleNext}
            className="inline-flex items-center gap-2 rounded-full bg-[#0A84FF] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(10,132,255,0.35)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{lang === "en" ? "Next" : "Lanjut"}</span>
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
