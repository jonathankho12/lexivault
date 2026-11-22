"use client";

import { useMemo } from "react";
import {
  resolveWordPronunciation,
  tokenizePronunciation,
} from "@/lib/pronunciation";
import { cn } from "@/lib/utils";

interface PronunciationTextProps {
  term: string;
  pronunciation?: string | null;
  ipa?: string | null;
  showIpa?: boolean;
  align?: "left" | "center";
  size?: "xs" | "sm" | "md";
  className?: string;
}

/**
 * Displays Google-style written pronunciation ("Sounds like") with bolded primary
 * stress syllables (e.g., am · biv · uh · luhnt) plus optional subtle IPA.
 */
export function PronunciationText({
  term,
  pronunciation,
  ipa,
  showIpa = false,
  align = "left",
  size = "sm",
  className,
}: PronunciationTextProps) {
  const resolved = useMemo(
    () => resolveWordPronunciation(term, pronunciation, ipa),
    [term, pronunciation, ipa]
  );

  const tokens = useMemo(
    () =>
      resolved.pronunciation
        ? tokenizePronunciation(resolved.pronunciation)
        : [],
    [resolved.pronunciation]
  );

  if (!resolved.pronunciation && !resolved.ipa) {
    return null;
  }

  const sizeClass =
    size === "xs"
      ? "text-[11px]"
      : size === "md"
        ? "text-sm"
        : "text-xs";

  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 leading-snug tracking-wide",
        align === "center" ? "justify-center text-center" : "justify-start",
        sizeClass,
        className
      )}
    >
      {tokens.length > 0 && (
        <span
          aria-label={`Pronunciation: ${resolved.pronunciation}`}
          className="text-[#9CA3AF]"
        >
          {tokens.map((tok, idx) => {
            if (tok.isDot) {
              return (
                <span key={idx} className="text-white/35 select-none">
                  {tok.text}
                </span>
              );
            }
            if (tok.stressed) {
              return (
                <strong
                  key={idx}
                  className="font-bold text-[#F5F5F7] underline decoration-[#0A84FF]/45 underline-offset-2"
                >
                  {tok.text}
                </strong>
              );
            }
            return <span key={idx}>{tok.text}</span>;
          })}
        </span>
      )}

      {showIpa && resolved.ipa && (
        <span className="font-normal text-[#71717A] text-[0.92em]">
          {resolved.ipa}
        </span>
      )}
    </div>
  );
}
