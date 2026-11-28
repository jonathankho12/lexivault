"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  BarChart3,
  BookMarked,
  Compass,
  Flame,
  GraduationCap,
  HelpCircle,
  Layers,
  LogOut,
  Moon,
  Settings,
  Sparkles,
  SpellCheck,
  Sun,
  Trophy,
  User,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { CefrOnboardingModal } from "@/components/CefrOnboardingModal";
import { IntroducingLexiModal } from "@/components/IntroducingLexiModal";
import { LexiCheerToast } from "@/components/LexiCheerToast";
import {
  hasSeenQuickGuide,
  markQuickGuideSeen,
  QuickGuideModal,
} from "@/components/QuickGuideModal";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import { ActivityRings } from "@/components/gamification/ActivityRings";
import { AccentToggle } from "@/components/layout/AccentToggle";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { FlagRuIcon } from "@/components/ui/FlagIcons";
import { WordDetailSheet } from "@/components/ui/WordDetailSheet";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault, useOverlayBackGuard } from "@/context/LexiVaultContext";
import { useTheme } from "@/context/ThemeContext";
import { IOS_SHEET_SPRING, IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { playCorrectChime, playGlassClick } from "@/lib/soundEffects";
import { cn, formatCefrBadgeClass } from "@/lib/utils";
import type { TabId } from "@/types/lexivault";

const RU_ANNOUNCEMENT_SEEN_KEY = "lexivault_ru_announcement_seen_v1";

function hasSeenRuAnnouncement(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(RU_ANNOUNCEMENT_SEEN_KEY) === "true";
  } catch {
    return true;
  }
}

function markRuAnnouncementSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RU_ANNOUNCEMENT_SEEN_KEY, "true");
  } catch {
    // Ignore storage quota errors
  }
}

const MOBILE_DOCK_IDS: ReadonlySet<TabId> = new Set([
  "vault",
  "flashcards",
  "practice",
  "grammar",
  "ielts",
  "stats",
]);

export function AppShell({
  renderTab,
}: {
  renderTab: (tab: TabId) => React.ReactNode;
}) {
  const {
    user,
    activeTab,
    setActiveTab,
    streak,
    xp,
    masteryRankInfo,
    dailyRings,
    dueWordsCount,
    sfxMuted,
    toggleSfxMuted,
    words,
    syncMode,
    syncStatus,
    syncError,
    isHydrated,
    cefrOnboardingCompleted,
    showCefrOnboarding,
    isLexiIntroOpen,
    isWhatsNewOpen,
    dailyPackModalOpen,
    openDailyPackModal,
    selectedWord,
    celebrationToast,
    clearCelebrationToast,
    openStreakCalendar,
    openRegisterFromGuest,
    logout,
  } = useLexiVault();
  const { lang, setLang, t } = useLanguage();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickGuideOpen, setQuickGuideOpen] = useState(false);
  const [ruAnnouncementOpen, setRuAnnouncementOpen] = useState(false);

  const handleCloseQuickGuide = React.useCallback(() => {
    markQuickGuideSeen(user);
    setQuickGuideOpen(false);
  }, [user]);

  const handleOpenQuickGuide = React.useCallback(() => {
    setQuickGuideOpen(true);
  }, []);

  const handleCreateAccountFromGuest = React.useCallback(() => {
    playGlassClick();
    setSettingsOpen(false);
    openRegisterFromGuest();
  }, [openRegisterFromGuest]);

  const handleStartFirstDailyPack = React.useCallback(() => {
    markQuickGuideSeen(user);
    setQuickGuideOpen(false);
    setActiveTab("vault");
    openDailyPackModal();
  }, [openDailyPackModal, setActiveTab, user]);

  const handleDismissRuAnnouncement = React.useCallback(() => {
    markRuAnnouncementSeen();
    setRuAnnouncementOpen(false);
  }, []);

  const handleSwitchToRussian = React.useCallback(() => {
    playCorrectChime(2);
    markRuAnnouncementSeen();
    setLang("ru");
    setRuAnnouncementOpen(false);
  }, [setLang]);

  // Auto-open Quick Guide once for first-time users only when no other blocking modal is open
  useEffect(() => {
    if (!isHydrated || !user || quickGuideOpen) return;
    if (
      !cefrOnboardingCompleted ||
      showCefrOnboarding ||
      isLexiIntroOpen ||
      isWhatsNewOpen ||
      dailyPackModalOpen ||
      settingsOpen ||
      Boolean(selectedWord)
    ) {
      return;
    }
    if (hasSeenQuickGuide(user)) return;

    const timer = setTimeout(() => {
      if (!hasSeenQuickGuide(user)) {
        setQuickGuideOpen(true);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [
    cefrOnboardingCompleted,
    dailyPackModalOpen,
    isHydrated,
    isLexiIntroOpen,
    isWhatsNewOpen,
    quickGuideOpen,
    selectedWord,
    settingsOpen,
    showCefrOnboarding,
    user,
  ]);

  // One-time Russian UI & AI support announcement for existing users (skip onboarding or if lang is already ru)
  useEffect(() => {
    if (!isHydrated || !user || ruAnnouncementOpen) return;
    if (lang === "ru") return;
    if (hasSeenRuAnnouncement()) return;
    if (
      !cefrOnboardingCompleted ||
      showCefrOnboarding ||
      isLexiIntroOpen ||
      isWhatsNewOpen ||
      quickGuideOpen ||
      !hasSeenQuickGuide(user) ||
      dailyPackModalOpen ||
      settingsOpen ||
      Boolean(selectedWord)
    ) {
      return;
    }

    const timer = setTimeout(() => {
      if (!hasSeenRuAnnouncement() && hasSeenQuickGuide(user)) {
        setRuAnnouncementOpen(true);
      }
    }, 550);

    return () => clearTimeout(timer);
  }, [
    cefrOnboardingCompleted,
    dailyPackModalOpen,
    isHydrated,
    isLexiIntroOpen,
    isWhatsNewOpen,
    lang,
    quickGuideOpen,
    ruAnnouncementOpen,
    selectedWord,
    settingsOpen,
    showCefrOnboarding,
    user,
  ]);

  useEffect(() => {
    if (!ruAnnouncementOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playGlassClick();
        handleDismissRuAnnouncement();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDismissRuAnnouncement, ruAnnouncementOpen]);

  const themeToggleLabel =
    resolvedTheme === "dark"
      ? lang === "en"
        ? "Switch to Light Mode"
        : lang === "ru"
          ? "Включить светлую тему"
          : "Ganti ke Mode Terang"
      : lang === "en"
        ? "Switch to Dark Mode"
        : lang === "ru"
          ? "Включить тёмную тему"
          : "Ganti ke Mode Gelap";

  useOverlayBackGuard("settings", settingsOpen, () => setSettingsOpen(false));
  useOverlayBackGuard(
    "ru_announcement",
    ruAnnouncementOpen,
    handleDismissRuAnnouncement
  );

  useEffect(() => {
    if (!celebrationToast) return;
    const timer = setTimeout(() => {
      clearCelebrationToast();
    }, 5200);
    return () => clearTimeout(timer);
  }, [celebrationToast, clearCelebrationToast]);

  const navItems: Array<{
    id: TabId;
    label: string;
    mobileLabel?: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: "vault", label: t.nav.vault, icon: BookMarked },
    {
      id: "flashcards",
      label: t.nav.flashcards,
      mobileLabel: t.nav.cardsMobile,
      icon: Layers,
    },
    { id: "practice", label: t.nav.practice, icon: GraduationCap },
    {
      id: "grammar",
      label: t.nav.grammar,
      mobileLabel: lang === "ru" ? "Грамм." : undefined,
      icon: SpellCheck,
    },
    { id: "ielts", label: t.nav.ielts, icon: Award },
    { id: "discover", label: t.nav.discover, icon: Compass },
    { id: "stats", label: t.nav.stats, icon: BarChart3 },
  ];

  const mobileDockItems = navItems.filter((item) =>
    MOBILE_DOCK_IDS.has(item.id)
  );

  const isGuest = user?.provider === "guest";
  const hasSyncError =
    user?.provider === "supabase" &&
    (syncStatus === "error" || Boolean(syncError));

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <div className="relative min-h-dvh w-full overflow-x-clip text-[#F5F5F7]">
      <AmbientBackground />

      {/* Desktop Translucent Glass Sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 h-[100dvh] w-64 lg:w-72 flex-col p-3 lg:p-4">
        <div className="liquid-glass-chrome flex h-full flex-col justify-between overflow-y-auto overscroll-contain no-scrollbar rounded-3xl p-3.5 lg:p-4">
          <div>
            {/* Brand */}
            <div className="group flex items-center gap-3 px-2 py-2">
              <div className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center transform-gpu">
                <Image
                  src="/lexi-badge.png"
                  alt="LexiVault"
                  width={384}
                  height={415}
                  priority
                  className="h-full w-full object-contain select-none pointer-events-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.52)] transform-gpu will-change-transform transition-transform duration-300 ease-out group-hover:scale-[1.06]"
                />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">
                  LexiVault
                </h1>
                <p className="text-[11px] text-[#8E8E93]">
                  {t.nav.brandSubtitle}
                </p>
              </div>
            </div>

            {/* Navigation */}
            <nav aria-label="Primary Navigation" className="mt-6 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    whileTap={TAP_SCALE}
                    onClick={() => {
                      playGlassClick();
                      setActiveTab(item.id);
                    }}
                    className={cn(
                      "relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer select-none",
                      active
                        ? "text-white"
                        : "text-[#8E8E93] hover:text-[#F5F5F7] hover:bg-white/[0.04]"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebarActivePill"
                        transition={IOS_SPRING}
                        className="transform-gpu will-change-transform absolute inset-0 -z-10 rounded-xl bg-white/[0.10] border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                      />
                    )}
                    <Icon
                      className={cn(
                        "h-4.5 w-4.5 transition-colors",
                        active ? "text-[#0A84FF]" : "text-current"
                      )}
                    />
                    <span>{item.label}</span>
                    {item.id === "flashcards" &&
                      isHydrated &&
                      dueWordsCount > 0 && (
                        <span className="ml-auto rounded-full bg-[#FF9F0A]/20 border border-[#FF9F0A]/40 px-2 py-0.5 text-[10px] font-bold text-[#FFD18C] tabular-nums">
                          {dueWordsCount}
                        </span>
                      )}
                  </motion.button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Controls */}
          <div className="space-y-2.5 pt-3">
            {/* Global US / UK Segmented Control & SFX Toggle */}
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                  {t.nav.audioAccent}
                </span>
                <button
                  type="button"
                  onClick={toggleSfxMuted}
                  title={sfxMuted ? t.nav.sfxOff : t.nav.sfxOn}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border transition-colors cursor-pointer",
                    sfxMuted
                      ? "bg-white/[0.04] border-white/[0.1] text-[#8E8E93]"
                      : "bg-[#0A84FF]/15 border-[#0A84FF]/35 text-[#70BCFF]"
                  )}
                >
                  {sfxMuted ? (
                    <VolumeX className="h-3 w-3" />
                  ) : (
                    <Volume2 className="h-3 w-3" />
                  )}
                  <span>{sfxMuted ? t.nav.sfxOff : t.nav.sfxOn}</span>
                </button>
              </div>
              <div className="flex justify-center">
                <AccentToggle instanceId="desktop" />
              </div>
            </div>

            {/* Streak, Mini Activity Rings & Sync Status Card */}
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <motion.button
                  type="button"
                  whileTap={TAP_SCALE}
                  onClick={() => {
                    playGlassClick();
                    openStreakCalendar();
                  }}
                  title={t.nav.dailyStreak}
                  className="flex flex-1 min-w-0 items-center justify-between rounded-xl px-1.5 py-1 -mx-1.5 transition-colors hover:bg-white/[0.06] cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Flame className="h-4 w-4 text-[#30D158] shrink-0" />
                    <span className="text-xs font-medium text-[#F5F5F7] truncate">
                      {t.nav.dailyStreak}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[#30D158] shrink-0">
                    {isHydrated ? `${streak} ${t.nav.streakDaysSuffix}` : "—"}
                  </span>
                </motion.button>
                <button
                  type="button"
                  onClick={() => {
                    playGlassClick();
                    openStreakCalendar();
                  }}
                  aria-label="Daily Activity Rings"
                  title="Daily Activity Rings"
                  className="shrink-0 cursor-pointer rounded-full p-0.5 hover:bg-white/[0.06] transition-[transform,opacity,border-color,background-color]"
                >
                  <ActivityRings rings={dailyRings} variant="mini" />
                </button>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#8E8E93]">
                <span>{t.nav.cumulativePool}</span>
                <span className="font-semibold text-[#F5F5F7]">
                  {isHydrated ? `${words.length} ${t.nav.itemsSuffix}` : "—"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  playGlassClick();
                  setSettingsOpen(true);
                }}
                title={syncError?.formatted ?? t.nav.settings}
                className="flex w-full items-center justify-between pt-1.5 border-t border-white/[0.08] text-[11px] text-left hover:opacity-90 cursor-pointer transition-[transform,opacity,border-color,background-color]"
              >
                <span className="text-[#8E8E93]">{t.nav.syncLabel}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 font-medium",
                    hasSyncError ? "text-[#FF8982]" : "text-[#F5F5F7]"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isGuest
                        ? "bg-[#FF9F0A]"
                        : user?.provider === "supabase"
                          ? syncStatus === "syncing"
                            ? "bg-[#0A84FF] animate-pulse"
                            : hasSyncError
                              ? "bg-[#FF453A] animate-pulse"
                              : syncStatus === "synced" ||
                                  syncMode === "supabase"
                                ? "bg-[#30D158]"
                                : "bg-[#FF9F0A]"
                          : "bg-[#0A84FF]"
                    )}
                  />
                  {isGuest
                    ? t.nav.syncGuest
                    : user?.provider === "supabase"
                      ? syncStatus === "syncing"
                        ? t.nav.syncing
                        : hasSyncError
                          ? t.nav.syncError
                          : syncStatus === "synced" || syncMode === "supabase"
                            ? t.nav.syncSupabase
                            : t.nav.syncLocal
                      : t.nav.syncLocal}
                </span>
              </button>
            </div>

            {/* Settings Trigger & 1-Click Theme Toggle */}
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                onClick={() => {
                  playGlassClick();
                  setSettingsOpen(true);
                }}
                title={t.nav.settings}
                className="flex h-10 flex-1 min-w-0 items-center justify-center gap-1.5 rounded-2xl bg-white/[0.05] border border-white/[0.09] px-2.5 lg:px-3 text-xs font-semibold text-[#F5F5F7] hover:bg-white/[0.1] cursor-pointer touch-manipulation transition-colors"
              >
                <Settings className="h-4 w-4 text-[#0A84FF] shrink-0" />
                <span className="whitespace-nowrap">{t.nav.settings}</span>
              </motion.button>

              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                onClick={() => {
                  playGlassClick();
                  handleOpenQuickGuide();
                }}
                aria-label={t.nav.quickGuide}
                title={t.nav.quickGuide}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] border border-white/[0.09] text-[#8E8E93] hover:text-white hover:bg-white/[0.1] cursor-pointer touch-manipulation transition-colors"
              >
                <HelpCircle className="h-4 w-4" />
              </motion.button>

              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                onClick={(e) => {
                  playGlassClick();
                  toggleTheme(e);
                }}
                aria-label={themeToggleLabel}
                title={themeToggleLabel}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] border border-white/[0.09] text-[#F5F5F7] hover:bg-white/[0.1] cursor-pointer touch-manipulation transition-colors"
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="h-4 w-4 text-[#FF9F0A]" />
                ) : (
                  <Moon className="h-4 w-4 text-[#0A84FF]" />
                )}
              </motion.button>
            </div>

            {/* Logged-in User / Guest Profile, XP Rank & Auth Action */}
            {user && (
              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 space-y-2">
                {isGuest ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF9F0A]/15 border border-[#FF9F0A]/35 text-[#FFBE5C]">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-xs font-semibold text-white truncate"
                          title={t.nav.guestModeLabel}
                        >
                          {t.nav.guestModeLabel}
                        </p>
                        <p
                          className="text-[10px] text-[#8E8E93] truncate"
                          title={t.nav.guestSavedLocally}
                        >
                          {t.nav.guestSavedLocally}
                        </p>
                      </div>
                    </div>

                    <motion.button
                      type="button"
                      whileTap={TAP_SCALE}
                      onClick={handleCreateAccountFromGuest}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0A84FF]/18 border border-[#0A84FF]/40 px-3 py-1.5 text-[11px] font-semibold text-[#70BCFF] hover:bg-[#0A84FF]/28 transition-[opacity,border-color,background-color] cursor-pointer touch-manipulation"
                    >
                      <UserPlus className="h-3 w-3 shrink-0" />
                      <span>{t.nav.createAccountSync}</span>
                    </motion.button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0A84FF]/20 border border-[#0A84FF]/35 text-[#70BCFF]">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-xs font-semibold text-white truncate"
                          title={`@${user.username}`}
                        >
                          @{user.username}
                        </p>
                        <p
                          className="text-[10px] text-[#8E8E93] truncate"
                          title={
                            user.provider === "supabase"
                              ? t.nav.cloudAccount
                              : t.nav.localAccount
                          }
                        >
                          {user.provider === "supabase"
                            ? t.nav.cloudAccount
                            : t.nav.localAccount}
                        </p>
                      </div>
                    </div>

                    <motion.button
                      type="button"
                      whileTap={TAP_SCALE}
                      onClick={() => void logout()}
                      title={t.nav.logout}
                      aria-label={t.nav.logout}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] px-3 py-1.5 text-[11px] font-semibold text-[#FF8982] hover:bg-[#FF453A]/15 hover:border-[#FF453A]/35 transition-[opacity,border-color,background-color] cursor-pointer touch-manipulation"
                    >
                      <LogOut className="h-3 w-3 shrink-0" />
                      <span className="whitespace-nowrap">{t.nav.logout}</span>
                    </motion.button>
                  </div>
                )}

                <div className="space-y-1 pt-1 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-[#FFBE5C]">
                      {isHydrated ? masteryRankInfo.rank : "Observer"}
                    </span>
                    <span className="font-semibold text-[#8E8E93] tabular-nums">
                      {isHydrated ? `${xp} XP` : "0 XP"}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                    <motion.div
                      className="h-full w-full rounded-full bg-gradient-to-r from-[#FF9F0A] via-[#30D158] to-[#0A84FF] transform-gpu will-change-transform"
                      style={{ transformOrigin: "left" }}
                      initial={false}
                      animate={{
                        scaleX: isHydrated
                          ? Math.max(0.05, masteryRankInfo.progressPct / 100)
                          : 0.05,
                      }}
                      transition={IOS_SPRING}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Top Translucent Header */}
      <header className="md:hidden sticky top-0 z-30 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] liquid-glass-chrome mobile-chrome-bar mobile-chrome-top rounded-none">
        <div className="flex items-center justify-between gap-2 px-2.5 sm:px-3.5 py-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center transform-gpu">
              <Image
                src="/lexi-badge.png"
                alt="LexiVault"
                width={384}
                height={415}
                priority
                className="h-full w-full object-contain select-none pointer-events-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.52)] transform-gpu"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center min-w-0">
                <span className="text-[15px] leading-tight font-bold tracking-tight text-white truncate">
                  LexiVault
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  playGlassClick();
                  openStreakCalendar();
                }}
                className="block max-w-full truncate text-left text-[11px] leading-tight text-[#8E8E93] hover:text-[#F5F5F7] transition-[opacity,color] cursor-pointer touch-manipulation"
              >
                {isGuest
                  ? t.nav.guestModeLabel
                  : isHydrated
                    ? `${streak}d · ${masteryRankInfo.rank}`
                    : t.nav.loading}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => {
                playGlassClick();
                setActiveTab("discover");
              }}
              aria-label={t.nav.discover}
              title={t.nav.discover}
              className={cn(
                "flex h-9 w-9 min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-full border transition-colors cursor-pointer touch-manipulation",
                activeTab === "discover"
                  ? "bg-[#0A84FF]/22 border-[#0A84FF]/45 text-[#70BCFF]"
                  : "bg-white/[0.06] border-white/[0.1] text-[#D1D1D6]"
              )}
            >
              <Compass className="h-4 w-4" />
            </motion.button>

            <AccentToggle instanceId="mobile" compact />

            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={(e) => {
                playGlassClick();
                toggleTheme(e);
              }}
              aria-label={themeToggleLabel}
              title={themeToggleLabel}
              className="flex h-9 w-9 min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-full border bg-white/[0.06] border-white/[0.1] text-[#D1D1D6] hover:bg-white/[0.12] cursor-pointer touch-manipulation transition-colors"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4 text-[#FF9F0A]" />
              ) : (
                <Moon className="h-4 w-4 text-[#0A84FF]" />
              )}
            </motion.button>

            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => {
                playGlassClick();
                handleOpenQuickGuide();
              }}
              aria-label={t.nav.quickGuide}
              title={t.nav.quickGuide}
              className="hidden min-[410px]:flex h-9 w-9 min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-full border bg-white/[0.06] border-white/[0.1] text-[#D1D1D6] hover:bg-white/[0.12] cursor-pointer touch-manipulation transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
            </motion.button>

            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => {
                playGlassClick();
                setSettingsOpen(true);
              }}
              aria-label={hasSyncError ? t.nav.syncError : t.nav.settings}
              title={
                hasSyncError
                  ? syncError?.formatted ?? t.nav.syncError
                  : t.nav.settings
              }
              className={cn(
                "relative flex h-9 w-9 min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-full border transition-[opacity,border-color,background-color] cursor-pointer touch-manipulation",
                hasSyncError
                  ? "bg-[#FF453A]/15 border-[#FF453A]/45 text-[#FF8982] hover:bg-[#FF453A]/25"
                  : "bg-white/[0.06] border-white/[0.1] text-[#D1D1D6] hover:bg-white/[0.12]"
              )}
            >
              <Settings className="h-4 w-4" />
              {hasSyncError && (
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#FF453A] ring-2 ring-black/80 animate-pulse"
                />
              )}
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content — Instant 60 FPS Tab Switch */}
      <main className="md:pl-64 lg:pl-72">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 pt-4 sm:pt-7 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-12">
          {isGuest && (
            <div className="md:hidden mb-3.5 flex items-center justify-between gap-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#F5F5F7] truncate">
                  {t.nav.guestModeLabel}
                </p>
              </div>
              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                onClick={handleCreateAccountFromGuest}
                className="shrink-0 min-h-[36px] inline-flex items-center gap-1 rounded-full bg-[#0A84FF]/18 border border-[#0A84FF]/40 px-3 py-1.5 text-[11px] font-semibold text-[#70BCFF] hover:bg-[#0A84FF]/28 transition-[opacity,border-color,background-color] cursor-pointer touch-manipulation whitespace-nowrap"
              >
                <UserPlus className="h-3 w-3 shrink-0" />
                <span>{t.nav.createAccountSync}</span>
              </motion.button>
            </div>
          )}

          <div key={activeTab} className="tab-panel-enter">
            {renderTab(activeTab)}
          </div>
        </div>
      </main>

      {/* Mobile Edge-to-Edge Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 m-0 bg-[var(--ios-surface)] mobile-chrome-bottom rounded-none pt-1.5 pl-[max(0.375rem,env(safe-area-inset-left))] pr-[max(0.375rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto grid max-w-md grid-cols-6 items-center gap-0.5">
          {mobileDockItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  playGlassClick();
                  setActiveTab(item.id);
                }}
                className={cn(
                  "relative flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 px-0.5 transition-colors cursor-pointer select-none touch-manipulation",
                  active ? "text-white" : "text-[#8E8E93]"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="mobileDockActivePill"
                    transition={IOS_SPRING}
                    className="transform-gpu will-change-transform absolute inset-0 -z-10 rounded-2xl bg-white/[0.12] border border-white/[0.14] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                  />
                )}
                {item.id === "flashcards" && isHydrated && dueWordsCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1 right-2.5 sm:right-3 h-2 w-2 rounded-full bg-[#FF9F0A]"
                  />
                )}
                <Icon
                  className={cn(
                    "h-4 w-4",
                    active ? "text-[#0A84FF]" : "text-current"
                  )}
                />
                <span className="text-[9.5px] sm:text-[10px] font-semibold tracking-tight truncate max-w-full">
                  {item.mobileLabel ?? item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </nav>

      {/* Global Word Detail Bottom Sheet / Modal */}
      <WordDetailSheet />

      {/* Global Settings Bottom Sheet / Modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenQuickGuide={handleOpenQuickGuide}
        onCreateAccountFromGuest={handleCreateAccountFromGuest}
      />

      {/* Quick App Guide (Duolingo-Style Interactive Onboarding) */}
      <QuickGuideModal
        open={quickGuideOpen}
        onClose={handleCloseQuickGuide}
        onStartDailyPack={handleStartFirstDailyPack}
      />

      {/* First-Time Lexi Guardian Introduction Modal */}
      <IntroducingLexiModal />

      {/* Versioned What's New Feature Announcement Modal */}
      <WhatsNewModal />

      {/* One-Time Russian Language Support Announcement (Existing Users) */}
      <AnimatePresence>
        {ruAnnouncementOpen && (
          <div
            key="ru-announcement-portal"
            className="fixed inset-0 z-[65] flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => {
                playGlassClick();
                handleDismissRuAnnouncement();
              }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Liquid Glass Card */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="ru-announcement-title"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={IOS_SHEET_SPRING}
              className="liquid-glass-elevated transform-gpu will-change-transform relative z-10 w-full max-w-md max-h-[90dvh] overflow-y-auto overflow-x-hidden overscroll-contain no-scrollbar rounded-[32px] p-6 sm:p-8 text-center"
            >
              {/* Subtle top accent glow */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#0A84FF]/65 to-transparent"
              />

              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  playGlassClick();
                  handleDismissRuAnnouncement();
                }}
                aria-label={t.russianAnnouncement.closeAria}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] border border-white/[0.08] text-[#8E8E93] hover:text-white hover:bg-white/[0.1] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex flex-col items-center space-y-4">
                {/* Badge */}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF]/15 border border-[#0A84FF]/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#70BCFF]">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{t.russianAnnouncement.badge}</span>
                </span>

                {/* Hero SVG RU Flag Emblem */}
                <div className="relative flex items-center justify-center py-1">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-4 rounded-full blur-xl"
                    style={{
                      background:
                        "radial-gradient(circle,rgba(10,132,255,0.28) 0%,rgba(213,43,30,0.16) 52%,transparent 75%)",
                    }}
                  />
                  <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.07] border border-white/[0.16] shadow-[0_12px_30px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.22)]">
                    <FlagRuIcon className="h-10 w-10" />
                  </div>
                </div>

                {/* Title & Description */}
                <div className="space-y-2">
                  <h2
                    id="ru-announcement-title"
                    className="text-xl sm:text-2xl font-bold tracking-tight text-white"
                  >
                    {t.russianAnnouncement.title}
                  </h2>
                  <p className="text-sm text-[#D1D1D6] leading-relaxed">
                    {t.russianAnnouncement.description}
                  </p>
                </div>

                {/* Actions */}
                <div className="w-full space-y-2.5 pt-1">
                  <motion.button
                    type="button"
                    whileTap={TAP_SCALE}
                    onClick={handleSwitchToRussian}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(10,132,255,0.34)] hover:brightness-110 transition-all cursor-pointer"
                  >
                    <FlagRuIcon className="h-4 w-4" />
                    <span>{t.russianAnnouncement.switchCta}</span>
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={TAP_SCALE}
                    onClick={() => {
                      playGlassClick();
                      handleDismissRuAnnouncement();
                    }}
                    className="w-full inline-flex items-center justify-center rounded-full bg-white/[0.07] border border-white/[0.12] px-6 py-3 text-sm font-semibold text-[#E5E5EA] hover:bg-white/[0.12] hover:text-white transition-colors cursor-pointer"
                  >
                    {t.russianAnnouncement.gotItCta}
                  </motion.button>
                </div>

                <p className="text-[11px] text-[#8E8E93]">
                  {t.russianAnnouncement.settingsHint}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* First-Time CEFR Onboarding Modal */}
      <CefrOnboardingModal />

      {/* Celebratory CEFR Level-Up Toast */}
      <AnimatePresence>
        {celebrationToast && (
          <motion.div
            key={celebrationToast.id}
            initial={{ opacity: 0, y: -18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.96 }}
            transition={IOS_SPRING}
            role="status"
            className="liquid-glass-elevated fixed top-[max(1rem,env(safe-area-inset-top))] right-4 left-4 md:left-auto md:right-6 z-[70] md:w-96 rounded-2xl border border-[#30D158]/45 bg-[#0C1412]/90 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#30D158]/20 border border-[#30D158]/45 text-[#7CF099]">
                <Trophy className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white truncate">
                    {celebrationToast.title}
                  </p>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0",
                      formatCefrBadgeClass(celebrationToast.cefr)
                    )}
                  >
                    {celebrationToast.cefr}
                  </span>
                </div>
                <p className="text-xs text-[#D1D1D6] leading-relaxed">
                  {celebrationToast.message}
                </p>
              </div>
              <button
                type="button"
                onClick={clearCelebrationToast}
                aria-label="Dismiss notification"
                className="rounded-full p-1 text-[#8E8E93] hover:text-white transition-[transform,opacity,border-color,background-color,color] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact Lexi Study-Session Mini Cheer Toast */}
      <LexiCheerToast />
    </div>
  );
}
