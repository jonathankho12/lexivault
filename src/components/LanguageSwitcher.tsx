"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { FlagEnIcon, FlagIdIcon, FlagRuIcon } from "@/components/ui/FlagIcons";
import { useLanguage } from "@/context/LanguageContext";
import type { AppLanguage } from "@/lib/i18n";
import { IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { playGlassClick } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";

export interface LanguageOption {
  id: AppLanguage;
  code: string;
  label: string;
  Flag: React.ComponentType<{ className?: string }>;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { id: "en", code: "EN", label: "English", Flag: FlagEnIcon },
  { id: "id", code: "ID", label: "Bahasa Indonesia", Flag: FlagIdIcon },
  { id: "ru", code: "RU", label: "Русский", Flag: FlagRuIcon },
] as const;

export function LanguageSwitcher({
  align = "right",
  direction = "down",
  compact = false,
  className,
}: {
  align?: "left" | "right";
  direction?: "down" | "up";
  compact?: boolean;
  className?: string;
}) {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const activeOption =
    LANGUAGE_OPTIONS.find((opt) => opt.id === lang) ?? LANGUAGE_OPTIONS[0];
  const ActiveFlag = activeOption.Flag;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSelect = (next: AppLanguage) => {
    playGlassClick();
    setLang(next);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <motion.button
        type="button"
        whileTap={TAP_SCALE}
        onClick={() => {
          playGlassClick();
          setOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Language: ${activeOption.label}`}
        className={cn(
          "liquid-glass-pill inline-flex items-center justify-center rounded-full border border-white/[0.14] text-white transition-colors hover:bg-white/[0.12] cursor-pointer select-none whitespace-nowrap",
          compact
            ? "h-8 gap-1 px-2 text-[11px] font-semibold"
            : "h-9 gap-1.5 px-2.5 text-xs font-semibold"
        )}
      >
        <ActiveFlag className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        <span className="tracking-wide">{activeOption.code}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-[#A1A1AA] transition-transform duration-200",
            open && "rotate-180 text-white"
          )}
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="listbox"
            aria-label="Select Language"
            initial={{
              opacity: 0,
              y: direction === "down" ? -6 : 6,
              scale: 0.96,
            }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: direction === "down" ? -4 : 4,
              scale: 0.96,
            }}
            transition={IOS_SPRING}
            className={cn(
              "liquid-glass-elevated absolute z-50 w-48 rounded-2xl border border-white/[0.14] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl",
              align === "right" ? "right-0" : "left-0",
              direction === "down" ? "top-full mt-2" : "bottom-full mb-2"
            )}
          >
            {LANGUAGE_OPTIONS.map((option) => {
              const isSelected = option.id === lang;
              const Flag = option.Flag;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-colors cursor-pointer whitespace-nowrap",
                    isSelected
                      ? "bg-[#0A84FF]/18 text-white"
                      : "text-[#D1D1D6] hover:bg-white/[0.08] hover:text-white"
                  )}
                >
                  <span className="inline-flex items-center gap-2.5 min-w-0">
                    <Flag className="h-4 w-4 shrink-0" />
                    <span className="truncate">{option.label}</span>
                  </span>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#70BCFF] stroke-[2.5]" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
