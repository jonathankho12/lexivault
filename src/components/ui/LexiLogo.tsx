"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export type LexiLogoSize = "xs" | "sm" | "md" | "lg" | "hero";

export interface LexiLogoProps {
  size?: LexiLogoSize;
  showHoverShimmer?: boolean;
  showAmbientGlow?: boolean;
  className?: string;
  title?: string;
}

const SIZE_CLASSES: Record<LexiLogoSize, string> = {
  xs: "h-7 w-7",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  hero: "h-[92px] w-[92px] sm:h-[104px] sm:w-[104px]",
};

/**
 * Transparent Rottweiler mascot shield badge ("Lexi") rendered directly without
 * any square box or rectangular frame so its natural curved badge shape blends
 * seamlessly into the iOS Dark Liquid Glass UI at 60 FPS.
 */
export function LexiLogo({
  size = "md",
  showHoverShimmer = false,
  showAmbientGlow = false,
  className,
  title = "LexiVault",
}: LexiLogoProps) {
  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center transform-gpu",
        SIZE_CLASSES[size],
        className
      )}
    >
      {showAmbientGlow && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-4 rounded-full bg-[radial-gradient(circle,rgba(94,92,230,0.36)_0%,rgba(56,189,248,0.16)_46%,rgba(0,0,0,0)_74%)] blur-xl transform-gpu"
        />
      )}

      <Image
        src="/logo-badge.png"
        alt={title}
        width={728}
        height={785}
        priority={size === "hero" || size === "lg"}
        className={cn(
          "relative z-10 h-full w-full object-contain select-none pointer-events-none transform-gpu",
          showAmbientGlow
            ? "drop-shadow-[0_14px_28px_rgba(0,0,0,0.75)]"
            : "drop-shadow-[0_4px_12px_rgba(0,0,0,0.52)]",
          showHoverShimmer &&
            "will-change-transform transition-transform duration-300 ease-out group-hover:scale-[1.06] hover:scale-[1.06]"
        )}
      />
    </div>
  );
}
