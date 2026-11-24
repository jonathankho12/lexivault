"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";
import { AudioButton } from "@/components/ui/AudioButton";
import { PronunciationText } from "@/components/ui/PronunciationText";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import {
  cn,
  formatRegisterBadgeClass,
  getLocalizedMeaning,
} from "@/lib/utils";
import type { PracticeQuestion, SentenceGradeResult } from "@/types/lexivault";

export function SentenceMakerCard({
  question,
  onComplete,
}: {
  question: PracticeQuestion;
  onComplete: (isCorrect: boolean) => void;
}) {
  const { accent } = useLexiVault();
  const { lang } = useLanguage();
  const isEn = lang === "en";

  const [sentence, setSentence] = useState("");
  const [isGrading, setIsGrading] = useState(false);
  const [grade, setGrade] = useState<SentenceGradeResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const nextLockRef = useRef(false);

  const handleNext = () => {
    if (!grade || nextLockRef.current) return;
    nextLockRef.current = true;
    setIsAdvancing(true);
    onComplete(grade.is_correct);
  };

  const { word } = question;
  const remoteUrl = accent === "UK" ? word.audio_uk_url : word.audio_us_url;

  const handleGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentence.trim() || isGrading || grade) return;

    setIsGrading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/grade-sentence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: word.term,
          meaning_id: word.meaning_id,
          meaning_en: word.meaning_en,
          register: word.register,
          sentence: sentence.trim(),
          word_families: word.word_families_json,
          example_sentence: word.examples_json?.[0]?.sentence ?? "",
          lang,
        }),
      });

      if (!res.ok) throw new Error("Grade request failed");
      const json = (await res.json()) as { result: SentenceGradeResult };
      setGrade(json.result);
    } catch {
      setErrorMsg(
        isEn
          ? "Failed to evaluate sentence. Please try submitting again."
          : "Gagal mengevaluasi kalimat. Coba kirim ulang."
      );
    } finally {
      setIsGrading(false);
    }
  };

  const isGoodVerdict =
    grade?.verdict === "Cukup Baik" || grade?.verdict === "Good";

  return (
    <div className="space-y-5">
      {/* Target Word Card */}
      <div className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF]/20 border border-[#0A84FF]/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#70BCFF]">
              <Sparkles className="h-3 w-3" />
              Make Your Own Sentence
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

          <AudioButton
            text={word.term}
            remoteUrl={remoteUrl}
            wordId={word.id}
            size="sm"
          />
        </div>

        <div>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {word.term}
          </h3>
          <PronunciationText
            term={word.term}
            pronunciation={word.pronunciation}
            ipa={word.ipa}
            showIpa
            size="sm"
            className="mt-1"
          />
          <p className="mt-1.5 text-sm text-[#D1D1D6] leading-relaxed">
            {getLocalizedMeaning(word, lang)}
          </p>
        </div>

        {word.word_families_json.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {word.word_families_json.slice(0, 4).map((wf, idx) => (
              <span
                key={idx}
                className="rounded-full bg-white/[0.06] border border-white/[0.1] px-2.5 py-0.5 text-[11px] text-[#A1A1AA]"
              >
                {wf.word} ({wf.pos})
              </span>
            ))}
          </div>
        )}
      </div>

      {/* User Sentence Input */}
      <form onSubmit={handleGrade} className="space-y-3">
        <div className="liquid-glass rounded-3xl p-4 focus-within:border-[#0A84FF]/50">
          <label
            htmlFor="sentence-maker-input"
            className="block text-xs font-medium text-[#8E8E93] mb-2"
          >
            {isEn ? (
              <>
                Write 1 original English sentence using{" "}
                <span className="text-white font-semibold">{word.term}</span>:
              </>
            ) : (
              <>
                Tulis 1 kalimat bahasa Inggris asli buatanmu menggunakan{" "}
                <span className="text-white font-semibold">{word.term}</span>:
              </>
            )}
          </label>
          <textarea
            id="sentence-maker-input"
            rows={3}
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            disabled={isGrading || Boolean(grade)}
            placeholder={
              isEn
                ? `e.g. Write a natural sentence using "${word.term}"...`
                : `Contoh: Write a natural sentence using "${word.term}"...`
            }
            className="w-full resize-none bg-transparent text-base text-[#F5F5F7] placeholder:text-[#8E8E93]/70 focus:outline-none"
          />
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="inline-flex items-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/30 px-3.5 py-2 text-xs text-red-400"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!grade && (
          <div className="flex justify-end">
            <motion.button
              type="submit"
              whileTap={TAP_SCALE}
              disabled={!sentence.trim() || isGrading}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all cursor-pointer",
                sentence.trim() && !isGrading
                  ? "bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] text-white shadow-[0_8px_24px_rgba(10,132,255,0.35)]"
                  : "bg-white/[0.08] text-[#8E8E93] cursor-not-allowed"
              )}
            >
              {isGrading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {isEn ? "Evaluating with AI..." : "Menilai dengan AI..."}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>
                    {isEn ? "Check Sentence Quality" : "Cek Kualitas Kalimat"}
                  </span>
                </>
              )}
            </motion.button>
          </div>
        )}
      </form>

      {/* AI Grading Result */}
      {grade && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={IOS_SPRING}
          className="liquid-glass-elevated rounded-3xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {grade.is_correct ? (
                <CheckCircle2 className="h-5 w-5 text-[#30D158]" />
              ) : (
                <XCircle className="h-5 w-5 text-[#FF453A]" />
              )}
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-bold border",
                  grade.verdict === "Natural"
                    ? "bg-[#30D158]/20 border-[#30D158]/40 text-[#7CF099]"
                    : isGoodVerdict
                      ? "bg-[#FF9F0A]/20 border-[#FF9F0A]/40 text-[#FFD18C]"
                      : "bg-[#FF453A]/20 border-[#FF453A]/40 text-[#FFB4AE]"
                )}
              >
                {grade.verdict} · {grade.score}/100
              </span>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-[#F5F5F7]">
            {grade.feedback_id}
          </p>

          <div className="rounded-2xl bg-[#0A84FF]/10 border border-[#0A84FF]/25 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#70BCFF]">
                {isEn ? "More Native Rewrite" : "Versi Lebih Native"}
              </span>
              <AudioButton text={grade.native_rewrite} size="sm" />
            </div>
            <p className="text-sm font-medium leading-relaxed text-white">
              &ldquo;{grade.native_rewrite}&rdquo;
            </p>
          </div>

          {grade.tip && (
            <p className="text-xs text-[#8E8E93]">
              <span className="font-semibold text-[#F5F5F7]">
                {isEn ? "Tip: " : "Tips: "}
              </span>
              {grade.tip}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <motion.button
              type="button"
              whileTap={isAdvancing ? undefined : TAP_SCALE}
              disabled={isAdvancing}
              onClick={handleNext}
              className="inline-flex items-center gap-2 rounded-full bg-[#0A84FF] px-5 py-2.5 text-sm font-semibold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
