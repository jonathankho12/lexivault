"use client";

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Sparkles, X } from "lucide-react";
import { LexiAvatar } from "@/components/LexiAvatar";
import { useLexiVault, useOverlayBackGuard } from "@/context/LexiVaultContext";
import { IOS_SHEET_SPRING, IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { LEXI_COMPANION_RELEASE_ID, type FeatureToggleKey } from "@/lib/releases";
import { playCorrectChime, playGlassClick } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";

function formatReleaseDate(isoDate: string): string {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(parsed));
}

export function WhatsNewModal() {
  const {
    activeWhatsNewRelease,
    isWhatsNewOpen,
    acknowledgeWhatsNew,
    lexiEnabled,
    setLexiEnabled,
  } = useLexiVault();

  useOverlayBackGuard("whats_new", isWhatsNewOpen, acknowledgeWhatsNew);

  useEffect(() => {
    if (!isWhatsNewOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playGlassClick();
        acknowledgeWhatsNew();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [acknowledgeWhatsNew, isWhatsNewOpen]);

  const toggleConfigs: Record<
    FeatureToggleKey,
    {
      label: string;
      onText: string;
      offText: string;
      enabled: boolean;
      onToggle: () => void;
    }
  > = {
    lexiEnabled: {
      label: "Lexi Companion",
      onText: "Active on your Dashboard",
      offText: "Paused — hidden on Dashboard",
      enabled: lexiEnabled,
      onToggle: () => {
        playGlassClick();
        setLexiEnabled(!lexiEnabled);
      },
    },
  };

  const toggleConfig = activeWhatsNewRelease?.featureToggleKey
    ? toggleConfigs[activeWhatsNewRelease.featureToggleKey]
    : null;

  const isLexiRelease =
    activeWhatsNewRelease?.id === LEXI_COMPANION_RELEASE_ID ||
    activeWhatsNewRelease?.featureToggleKey === "lexiEnabled";

  const handleConfirm = () => {
    playCorrectChime(2);
    acknowledgeWhatsNew();
  };

  const handleClose = () => {
    playGlassClick();
    acknowledgeWhatsNew();
  };

  return (
    <AnimatePresence>
      {isWhatsNewOpen && activeWhatsNewRelease && (
        <div
          key={`whats-new-${activeWhatsNewRelease.id}`}
          className="fixed inset-0 z-[66] flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Centered Announcement Card */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="whats-new-headline"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={IOS_SHEET_SPRING}
            className="liquid-glass-elevated transform-gpu will-change-transform relative z-10 w-full max-w-md max-h-[90dvh] overflow-y-auto no-scrollbar rounded-[32px] p-6 sm:p-8 text-center"
          >
            {/* Subtle top accent glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#0A84FF]/60 to-transparent"
            />

            {/* Top Close Button */}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close announcement"
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] border border-white/[0.08] text-[#8E8E93] hover:text-white hover:bg-white/[0.1] transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center space-y-4">
              {/* Release Badge & Version Metadata */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF]/15 border border-[#0A84FF]/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#70BCFF]">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{activeWhatsNewRelease.badge}</span>
                </span>
                <span className="text-[11px] font-medium text-[#8E8E93]">
                  {activeWhatsNewRelease.version} ·{" "}
                  {formatReleaseDate(activeWhatsNewRelease.date)}
                </span>
              </div>

              {/* Hero Visual */}
              {isLexiRelease ? (
                <div className="flex flex-col items-center gap-2">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.84, y: 10 }}
                    animate={{
                      opacity: lexiEnabled ? 1 : 0.88,
                      scale: lexiEnabled ? 1 : 0.95,
                      y: 0,
                    }}
                    transition={IOS_SPRING}
                    className="relative flex items-center justify-center py-1 transform-gpu will-change-transform"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-4 rounded-full blur-xl transform-gpu transition-opacity duration-300"
                      style={{
                        background: lexiEnabled
                          ? "radial-gradient(circle,rgba(48,209,88,0.24) 0%,rgba(10,132,255,0.14) 48%,transparent 74%)"
                          : "radial-gradient(circle,rgba(10,132,255,0.14) 0%,transparent 72%)",
                      }}
                    />
                    <LexiAvatar
                      mood={lexiEnabled ? "happy" : "sleepy"}
                      size="xl"
                      animated
                      className="relative z-10 rounded-3xl shadow-[0_14px_34px_rgba(0,0,0,0.38)]"
                    />
                  </motion.div>

                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                      lexiEnabled
                        ? "bg-[#30D158]/12 border-[#30D158]/30 text-[#30D158]"
                        : "bg-[#0A84FF]/10 border-[#0A84FF]/25 text-[#70BCFF]"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        lexiEnabled ? "bg-[#30D158]" : "bg-[#70BCFF]"
                      )}
                    />
                    {lexiEnabled ? "Lexi is happy & active" : "Lexi is snoozing"}
                  </span>
                </div>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0A84FF]/15 border border-[#0A84FF]/35 text-[#70BCFF] shadow-[0_10px_28px_rgba(10,132,255,0.22)]">
                  <Sparkles className="h-7 w-7" />
                </div>
              )}

              {/* Title & Description */}
              <div className="space-y-2">
                <h2
                  id="whats-new-headline"
                  className="text-xl sm:text-2xl font-bold tracking-tight text-white"
                >
                  {activeWhatsNewRelease.title}
                </h2>
                <p className="text-sm text-[#D1D1D6] leading-relaxed">
                  {activeWhatsNewRelease.description}
                </p>
              </div>

              {/* Release Highlights */}
              {activeWhatsNewRelease.highlights.length > 0 && (
                <ul className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-left space-y-2">
                  {activeWhatsNewRelease.highlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="flex items-start gap-2.5 text-xs sm:text-[13px] text-[#D1D1D6] leading-snug"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#30D158] mt-0.5" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Interactive Feature Toggle */}
              {toggleConfig && (
                <div className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-left space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs sm:text-sm font-semibold text-white">
                          {toggleConfig.label}
                        </p>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            toggleConfig.enabled
                              ? "bg-[#30D158]/15 text-[#30D158]"
                              : "bg-white/[0.08] text-[#8E8E93]"
                          )}
                        >
                          {toggleConfig.enabled ? "ON" : "OFF"}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-[#70BCFF]">
                        {toggleConfig.enabled
                          ? toggleConfig.onText
                          : toggleConfig.offText}
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-label={`Toggle ${toggleConfig.label}`}
                      aria-checked={toggleConfig.enabled}
                      onClick={toggleConfig.onToggle}
                      className={cn(
                        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors cursor-pointer p-0.5",
                        toggleConfig.enabled
                          ? "bg-[#30D158] border-[#30D158]"
                          : "bg-white/[0.1] border-white/[0.15]"
                      )}
                    >
                      <span
                        className={cn(
                          "h-5.5 w-5.5 rounded-full bg-white shadow transition-transform transform-gpu",
                          toggleConfig.enabled
                            ? "translate-x-5"
                            : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  <p className="text-[11px] text-[#8E8E93] leading-snug">
                    You can turn this on or off anytime in Settings.
                  </p>
                </div>
              )}

              {/* Primary CTA */}
              <div className="w-full pt-1">
                <motion.button
                  type="button"
                  whileTap={TAP_SCALE}
                  onClick={handleConfirm}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(10,132,255,0.34)] hover:brightness-110 transition-all cursor-pointer"
                >
                  <span>Got it, let&apos;s go</span>
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
