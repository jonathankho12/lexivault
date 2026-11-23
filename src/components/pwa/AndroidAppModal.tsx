"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  MoreVertical,
  PlusSquare,
  Share,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { IOS_SHEET_SPRING, TAP_SCALE } from "@/lib/motion";
import { playCorrectChime, playGlassClick } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";

export function AndroidLogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0 text-[#3DDC84]", className)}
    >
      <path d="M16.53 7.58l1.42-2.46a.46.46 0 0 0-.17-.63.46.46 0 0 0-.63.17l-1.44 2.49A8.72 8.72 0 0 0 12 6.33c-1.35 0-2.62.29-3.71.82L6.85 4.66a.46.46 0 0 0-.63-.17.46.46 0 0 0-.17.63l1.42 2.46C4.76 9.05 3 11.77 3 15h18c0-3.23-1.76-5.95-4.47-7.42zM8.5 12.6a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
    </svg>
  );
}

export function GetAndroidAppPill({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  const { t } = useLanguage();

  return (
    <motion.button
      type="button"
      whileTap={TAP_SCALE}
      onClick={() => {
        playGlassClick();
        onClick();
      }}
      className={cn(
        "liquid-glass-pill transform-gpu inline-flex items-center justify-between gap-2 rounded-full px-3.5 py-2 text-xs font-semibold text-[#F5F5F7] hover:bg-white/[0.11] hover:border-white/[0.22] transition-colors cursor-pointer",
        className
      )}
    >
      <span className="inline-flex items-center gap-2">
        <AndroidLogoIcon />
        <span>{t.pwa.getAndroidAppBtn}</span>
      </span>
      <ChevronRight className="h-3.5 w-3.5 text-[#8E8E93]" />
    </motion.button>
  );
}

interface AndroidAppModalProps {
  open: boolean;
  onClose: () => void;
  canPromptInstall: boolean;
  isInstalled: boolean;
  isIos: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

export function AndroidAppModal({
  open,
  onClose,
  canPromptInstall,
  isInstalled,
  isIos,
  promptInstall,
}: AndroidAppModalProps) {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [installing, setInstalling] = useState(false);

  const apkUrl = process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim() ?? "";
  const hasApk = apkUrl.length > 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleInstantInstall = async () => {
    if (installing || !canPromptInstall) return;
    playGlassClick();
    setInstalling(true);
    try {
      const outcome = await promptInstall();
      if (outcome === "accepted") {
        playCorrectChime(2);
      }
    } finally {
      setInstalling(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          key="android-app-modal-portal"
          className="fixed inset-0 z-[90] flex items-end md:items-center justify-center p-0 md:p-6"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75"
          />

          {/* Bottom-sheet (Mobile) / Centered Modal (Desktop) */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t.pwa.modalTitle}
            initial={{ opacity: 0, y: 44 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 34 }}
            transition={IOS_SHEET_SPRING}
            className="liquid-glass-elevated transform-gpu will-change-transform relative z-10 w-full md:max-w-lg max-h-[88dvh] overflow-y-auto no-scrollbar rounded-t-[32px] md:rounded-3xl p-5 sm:p-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] space-y-5"
          >
            <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-white/25 md:hidden" />

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#3DDC84]/15 border border-[#3DDC84]/35">
                  <AndroidLogoIcon className="h-5.5 w-5.5" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    {t.pwa.modalTitle}
                  </h2>
                  <p className="text-xs text-[#8E8E93]">
                    {t.pwa.modalSubtitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={t.pwa.close}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[#8E8E93] hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Primary Option: Install Instant PWA (Native Prompt or Clean 2-Step Guide) */}
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.09] p-4 space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0A84FF]/15 border border-[#0A84FF]/35">
                    <Sparkles className="h-4 w-4 text-[#70BCFF]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {t.pwa.instantTitle}
                    </h3>
                    <p className="text-xs text-[#8E8E93]">
                      {t.pwa.instantDesc}
                    </p>
                  </div>
                </div>

                {isInstalled && (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#30D158]/18 border border-[#30D158]/40 px-2.5 py-0.5 text-[10px] font-semibold text-[#7CF099]">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{t.pwa.installedBadge}</span>
                  </span>
                )}
              </div>

              {isInstalled ? (
                <div className="rounded-xl bg-[#30D158]/12 border border-[#30D158]/30 px-3.5 py-2.5 text-xs font-medium text-[#7CF099]">
                  {t.pwa.installedNote}
                </div>
              ) : canPromptInstall ? (
                <motion.button
                  type="button"
                  whileTap={TAP_SCALE}
                  disabled={installing}
                  onClick={() => void handleInstantInstall()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-[0_8px_22px_rgba(10,132,255,0.3)] hover:brightness-110 cursor-pointer disabled:opacity-60"
                >
                  {installing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span>
                    {installing
                      ? t.pwa.instantInstallingBtn
                      : t.pwa.instantInstallBtn}
                  </span>
                </motion.button>
              ) : (
                <div className="space-y-2 rounded-xl bg-white/[0.04] border border-white/[0.08] p-3.5">
                  <p className="text-xs font-semibold text-white">
                    {t.pwa.iosGuideTitle}
                  </p>
                  <div className="space-y-2 text-xs text-[#D1D1D6]">
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0A84FF]/20 text-[10px] font-bold text-[#70BCFF]">
                        1
                      </span>
                      <p className="inline-flex flex-wrap items-center gap-1 leading-relaxed">
                        {isIos ? (
                          <Share className="h-3.5 w-3.5 text-[#70BCFF] inline shrink-0" />
                        ) : (
                          <MoreVertical className="h-3.5 w-3.5 text-[#70BCFF] inline shrink-0" />
                        )}
                        <span>
                          {isIos ? t.pwa.iosStep1 : t.pwa.androidStep1}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#30D158]/20 text-[10px] font-bold text-[#7CF099]">
                        2
                      </span>
                      <p className="inline-flex flex-wrap items-center gap-1 leading-relaxed">
                        <PlusSquare className="h-3.5 w-3.5 text-[#7CF099] inline shrink-0" />
                        <span>
                          {isIos ? t.pwa.iosStep2 : t.pwa.androidStep2}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Direct APK Download (only shown when a real APK URL is configured) */}
            {hasApk && (
              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.09] p-4 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3DDC84]/15 border border-[#3DDC84]/30">
                    <Smartphone className="h-4 w-4 text-[#3DDC84]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {t.pwa.apkTitle}
                    </h3>
                    <p className="text-xs text-[#8E8E93]">{t.pwa.apkDesc}</p>
                  </div>
                </div>

                <a
                  href={apkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  onClick={() => playGlassClick()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#3DDC84] px-4 py-2.5 text-xs sm:text-sm font-bold text-black hover:brightness-110 transition-all"
                >
                  <Download className="h-4 w-4" />
                  <span>{t.pwa.apkDownloadBtn}</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-75" />
                </a>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
