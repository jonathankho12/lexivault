"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { playGlassClick } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";

export function FlagIdIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 16"
      aria-hidden="true"
      className={cn("h-3.5 w-5 rounded-[3px] shrink-0 shadow-sm", className)}
    >
      <defs>
        <clipPath id="flag-id-clip">
          <rect width="24" height="16" rx="2.5" />
        </clipPath>
      </defs>
      <g clipPath="url(#flag-id-clip)">
        <rect width="24" height="8" y="0" fill="#E70011" />
        <rect width="24" height="8" y="8" fill="#FFFFFF" />
      </g>
      <rect
        x="0.35"
        y="0.35"
        width="23.3"
        height="15.3"
        rx="2.3"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.7"
      />
    </svg>
  );
}

export function FlagEnIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 16"
      aria-hidden="true"
      className={cn("h-3.5 w-5 rounded-[3px] shrink-0 shadow-sm", className)}
    >
      <defs>
        <clipPath id="flag-uk-clip">
          <rect width="24" height="16" rx="2.5" />
        </clipPath>
      </defs>
      <g clipPath="url(#flag-uk-clip)">
        <rect width="24" height="16" fill="#012169" />
        <path d="M0 0 L24 16 M24 0 L0 16" stroke="#FFFFFF" strokeWidth="3.2" />
        <path d="M0 0 L24 16 M24 0 L0 16" stroke="#C8102E" strokeWidth="1.6" />
        <path d="M12 0 V16 M0 8 H24" stroke="#FFFFFF" strokeWidth="5.2" />
        <path d="M12 0 V16 M0 8 H24" stroke="#C8102E" strokeWidth="3.1" />
      </g>
      <rect
        x="0.35"
        y="0.35"
        width="23.3"
        height="15.3"
        rx="2.3"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.7"
      />
    </svg>
  );
}

export function LanguageFlagPill({
  instanceId = "auth",
  className,
}: {
  instanceId?: string;
  className?: string;
}) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Interface Language Switcher"
      className={cn(
        "liquid-glass-pill inline-flex items-center rounded-full p-0.5 gap-0.5",
        className
      )}
    >
      {(
        [
          { id: "id", label: "ID", Flag: FlagIdIcon },
          { id: "en", label: "EN", Flag: FlagEnIcon },
        ] as const
      ).map((opt) => {
        const active = lang === opt.id;
        const Flag = opt.Flag;
        return (
          <motion.button
            key={opt.id}
            type="button"
            whileTap={TAP_SCALE}
            onClick={() => {
              playGlassClick();
              setLang(opt.id);
            }}
            aria-pressed={active}
            className={cn(
              "relative z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer select-none",
              active ? "text-white" : "text-[#8E8E93] hover:text-[#F5F5F7]"
            )}
          >
            {active && (
              <motion.span
                layoutId={`langPill-${instanceId}`}
                transition={IOS_SPRING}
                className="transform-gpu will-change-transform absolute inset-0 -z-10 rounded-full bg-white/[0.14] border border-white/[0.16] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
              />
            )}
            <Flag className="h-3 w-4" />
            <span>{opt.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
