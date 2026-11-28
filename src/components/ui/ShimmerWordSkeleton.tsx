"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { IOS_SPRING } from "@/lib/motion";

export function ShimmerWordSkeleton({ term }: { term?: string }) {
  const { lang } = useLanguage();
  const isEn = lang === "en";
  const isRu = lang === "ru";

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={IOS_SPRING}
      className="liquid-glass shimmer-glass rounded-3xl p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0A84FF]/20 border border-[#0A84FF]/35">
            <Sparkles className="h-4 w-4 text-[#0A84FF] animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#F5F5F7]">
              {term
                ? isEn
                  ? `Preparing "${term}"...`
                  : isRu
                    ? `Готовлю «${term}»...`
                    : `Menyiapkan "${term}"...`
                : isEn
                  ? "AI is analyzing..."
                  : isRu
                    ? "ИИ анализирует..."
                    : "AI sedang menganalisis..."}
            </p>
            <p className="text-xs text-[#8E8E93]">
              {isEn
                ? "Definition, example sentences, word family & US/UK audio"
                : isRu
                  ? "Значение, примеры предложений, однокоренные и US/UK аудио"
                  : "Arti, contoh kalimat, word family & audio US/UK"}
            </p>
          </div>
        </div>
        <div className="h-6 w-20 rounded-full bg-white/[0.08]" />
      </div>

      <div className="mt-4 space-y-2.5">
        <div className="h-3.5 w-11/12 rounded-full bg-white/[0.08]" />
        <div className="h-3.5 w-3/4 rounded-full bg-white/[0.06]" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="h-6 w-20 rounded-full bg-white/[0.07]" />
        <div className="h-6 w-24 rounded-full bg-white/[0.07]" />
        <div className="h-6 w-16 rounded-full bg-white/[0.07]" />
      </div>
    </motion.div>
  );
}
