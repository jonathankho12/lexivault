"use client";

import type React from "react";
import { motion } from "framer-motion";
import { Loader2, Volume2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { usePronunciation } from "@/hooks/usePronunciation";
import { TAP_SCALE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { AccentType } from "@/types/lexivault";

interface AudioButtonProps {
  text: string;
  accentOverride?: AccentType;
  remoteUrl?: string | null;
  wordId?: string;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function AudioButton({
  text,
  accentOverride,
  remoteUrl,
  wordId,
  label,
  size = "sm",
  className,
}: AudioButtonProps) {
  const { accent: globalAccent, updateWordAudioUrl } = useLexiVault();
  const { lang } = useLanguage();
  const { play, isPlaying, isLoading } = usePronunciation();

  const targetAccent = accentOverride ?? globalAccent;
  const playing = isPlaying(text, targetAccent);
  const loading = isLoading(text, targetAccent);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    void play({
      text,
      accent: targetAccent,
      remoteUrl,
      wordId,
      onRemoteUrlDiscovered: (url) => {
        if (wordId) {
          updateWordAudioUrl(wordId, targetAccent, url);
        }
      },
    });
  };

  return (
    <motion.button
      type="button"
      whileTap={loading ? undefined : TAP_SCALE}
      disabled={loading}
      aria-busy={loading}
      onClick={handleClick}
      aria-label={
        lang === "en"
          ? `Play ${targetAccent} pronunciation for ${text}`
          : lang === "ru"
            ? `Воспроизвести произношение (${targetAccent}) для ${text}`
            : `Putar pengucapan ${targetAccent} untuk ${text}`
      }
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full transition-colors select-none",
        loading ? "cursor-wait opacity-85" : "cursor-pointer",
        "border border-white/[0.14] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]",
        playing
          ? "bg-[#0A84FF]/25 border-[#0A84FF]/50 text-[#64B5FF]"
          : "bg-white/[0.08] hover:bg-white/[0.13] text-[#F5F5F7]",
        size === "sm"
          ? label
            ? "h-8 px-3 text-xs font-medium"
            : "h-8 w-8"
          : label
            ? "h-10 px-4 text-sm font-medium"
            : "h-10 w-10",
        className
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0A84FF]" />
      ) : playing ? (
        <span className="inline-flex items-end gap-[2.5px] h-3.5" aria-hidden="true">
          {[0, 1, 2, 3].map((bar) => (
            <motion.span
              key={bar}
              className="w-[2.5px] rounded-full bg-[#0A84FF]"
              animate={{
                height: ["4px", "14px", "6px", "12px", "4px"],
              }}
              transition={{
                duration: 0.75,
                repeat: Infinity,
                ease: "easeInOut",
                delay: bar * 0.12,
              }}
            />
          ))}
        </span>
      ) : (
        <Volume2 className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
      )}
      {label && <span>{label}</span>}
    </motion.button>
  );
}
