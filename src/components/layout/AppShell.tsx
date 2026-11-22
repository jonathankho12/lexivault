"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Award,
  BarChart3,
  BookMarked,
  Compass,
  Flame,
  GraduationCap,
  Layers,
  LogOut,
  Settings,
  User,
  UserPlus,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ActivityRings } from "@/components/gamification/ActivityRings";
import { AccentToggle } from "@/components/layout/AccentToggle";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { LexiLogo } from "@/components/ui/LexiLogo";
import { WordDetailSheet } from "@/components/ui/WordDetailSheet";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { IOS_SPRING, TAB_TRANSITION, TAP_SCALE } from "@/lib/motion";
import { playGlassClick } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";
import type { TabId } from "@/types/lexivault";

const MOBILE_DOCK_IDS: ReadonlySet<TabId> = new Set([
  "vault",
  "flashcards",
  "practice",
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
    isHydrated,
    openStreakCalendar,
    openRegisterFromGuest,
    logout,
  } = useLexiVault();
  const { t } = useLanguage();
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    { id: "ielts", label: t.nav.ielts, icon: Award },
    { id: "discover", label: t.nav.discover, icon: Compass },
    { id: "stats", label: t.nav.stats, icon: BarChart3 },
  ];

  const mobileDockItems = navItems.filter((item) =>
    MOBILE_DOCK_IDS.has(item.id)
  );

  const isGuest = user?.provider === "guest";

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
    <div className="relative min-h-dvh w-full overflow-x-hidden text-[#F5F5F7]">
      <AmbientBackground />

      {/* Desktop Translucent Glass Sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-64 lg:w-72 flex-col p-4">
        <div className="liquid-glass-chrome flex h-full flex-col justify-between overflow-y-auto no-scrollbar rounded-3xl p-4">
          <div>
            {/* Brand */}
            <div className="group flex items-center gap-3 px-2 py-2">
              <LexiLogo size="md" showHoverShimmer />
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
                  className="shrink-0 cursor-pointer rounded-full p-0.5 hover:bg-white/[0.06]"
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
              <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.08] text-[11px]">
                <span className="text-[#8E8E93]">{t.nav.syncLabel}</span>
                <span className="inline-flex items-center gap-1.5 font-medium text-[#F5F5F7]">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isGuest
                        ? "bg-[#FF9F0A]"
                        : syncMode === "supabase"
                          ? "bg-[#30D158]"
                          : "bg-[#0A84FF]"
                    )}
                  />
                  {isGuest
                    ? t.nav.syncGuest
                    : syncMode === "supabase"
                      ? t.nav.syncSupabase
                      : t.nav.syncLocal}
                </span>
              </div>
            </div>

            {/* Settings Trigger Button */}
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => {
                playGlassClick();
                setSettingsOpen(true);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-2xl bg-white/[0.05] border border-white/[0.09] px-3.5 py-2.5 text-xs font-semibold text-[#F5F5F7] hover:bg-white/[0.1] cursor-pointer transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <Settings className="h-4 w-4 text-[#0A84FF]" />
                <span>{t.nav.settings}</span>
              </span>
              <span className="text-[10px] font-medium text-[#8E8E93]">
                {isGuest ? t.nav.syncGuest : `@${user?.username ?? ""}`}
              </span>
            </motion.button>

            {/* Logged-in User / Guest Profile, XP Rank & Auth Action */}
            {user && (
              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 space-y-2">
                {isGuest ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FF9F0A]/15 border border-[#FF9F0A]/35 text-[#FFBE5C]">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {t.nav.guestModeLabel}
                        </p>
                        <p className="text-[10px] text-[#8E8E93] truncate">
                          {t.nav.guestSavedLocally}
                        </p>
                      </div>
                    </div>

                    <motion.button
                      type="button"
                      whileTap={TAP_SCALE}
                      onClick={() => {
                        playGlassClick();
                        void openRegisterFromGuest();
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0A84FF]/18 border border-[#0A84FF]/40 px-3 py-1.5 text-[11px] font-semibold text-[#70BCFF] hover:bg-[#0A84FF]/28 cursor-pointer"
                    >
                      <UserPlus className="h-3 w-3" />
                      <span>{t.nav.createAccountSync}</span>
                    </motion.button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0A84FF]/20 border border-[#0A84FF]/35 text-[#70BCFF]">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          @{user.username}
                        </p>
                        <p className="text-[10px] text-[#8E8E93] truncate">
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
                      className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] border border-white/[0.1] px-2.5 py-1.5 text-[11px] font-medium text-[#FF8982] hover:bg-[#FF453A]/15 hover:border-[#FF453A]/35 cursor-pointer"
                    >
                      <LogOut className="h-3 w-3" />
                      <span>{t.nav.logout}</span>
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
      <header className="md:hidden sticky top-0 z-30 pt-[env(safe-area-inset-top)] liquid-glass-chrome border-x-0 border-t-0">
        <div className="flex items-center justify-between gap-1.5 px-2.5 py-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <LexiLogo size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-white truncate">
                  LexiVault
                </span>
                {user && !isGuest && (
                  <span className="text-[10px] font-medium text-[#70BCFF] truncate max-w-[60px]">
                    @{user.username}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  playGlassClick();
                  openStreakCalendar();
                }}
                className="text-[10px] text-[#8E8E93] hover:text-[#F5F5F7] truncate text-left cursor-pointer"
              >
                {isGuest
                  ? t.nav.guestModeLabel
                  : isHydrated
                    ? `${streak}d · ${masteryRankInfo.rank}`
                    : t.nav.loading}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                playGlassClick();
                openStreakCalendar();
              }}
              aria-label="Daily Activity Rings & Streak"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.05] border border-white/[0.1] cursor-pointer"
            >
              <ActivityRings rings={dailyRings} variant="mini" />
            </button>

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
                "flex h-8 w-8 items-center justify-center rounded-full border transition-colors cursor-pointer",
                activeTab === "discover"
                  ? "bg-[#0A84FF]/22 border-[#0A84FF]/45 text-[#70BCFF]"
                  : "bg-white/[0.06] border-white/[0.1] text-[#D1D1D6]"
              )}
            >
              <Compass className="h-3.5 w-3.5" />
            </motion.button>

            <AccentToggle instanceId="mobile" compact />

            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => {
                playGlassClick();
                setSettingsOpen(true);
              }}
              aria-label={t.nav.settings}
              title={t.nav.settings}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.1] text-[#D1D1D6] hover:bg-white/[0.12] cursor-pointer"
            >
              <Settings className="h-3.5 w-3.5" />
            </motion.button>

            {user && isGuest && (
              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                onClick={() => {
                  playGlassClick();
                  void openRegisterFromGuest();
                }}
                aria-label={t.nav.createAccountSync}
                title={t.nav.createAccountSync}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0A84FF]/18 border border-[#0A84FF]/40 text-[#70BCFF] hover:bg-[#0A84FF]/28 cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
              </motion.button>
            )}
            {user && !isGuest && (
              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                onClick={() => void logout()}
                aria-label={t.nav.logout}
                title={t.nav.logout}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07] border border-white/[0.12] text-[#FF8982] hover:bg-[#FF453A]/15 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content — Instant 60 FPS Tab Switch */}
      <main className="md:pl-64 lg:pl-72">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 pt-4 sm:pt-7 pb-[calc(6.75rem+env(safe-area-inset-bottom))] md:pb-12">
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
                onClick={() => {
                  playGlassClick();
                  void openRegisterFromGuest();
                }}
                className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#0A84FF]/18 border border-[#0A84FF]/40 px-2.5 py-1 text-[11px] font-semibold text-[#70BCFF] hover:bg-[#0A84FF]/28 cursor-pointer"
              >
                <UserPlus className="h-3 w-3" />
                <span>{t.nav.createAccountSync}</span>
              </motion.button>
            </div>
          )}

          <motion.div
            key={activeTab}
            initial={TAB_TRANSITION.initial}
            animate={TAB_TRANSITION.animate}
            className="transform-gpu will-change-transform"
          >
            {renderTab(activeTab)}
          </motion.div>
        </div>
      </main>

      {/* Mobile Floating Liquid Glass Pill Dock — Strictly 5 Icons */}
      <nav
        aria-label="Mobile Floating Dock"
        className="md:hidden fixed bottom-[max(0.85rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-40 w-[min(calc(100vw-1rem),24rem)]"
      >
        <div className="liquid-glass-chrome grid grid-cols-5 items-center rounded-full p-1">
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
                  "relative flex flex-col items-center justify-center gap-0.5 rounded-full py-2 px-0.5 transition-colors cursor-pointer select-none",
                  active ? "text-white" : "text-[#8E8E93]"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="mobileDockActivePill"
                    transition={IOS_SPRING}
                    className="transform-gpu will-change-transform absolute inset-0 -z-10 rounded-full bg-white/[0.12] border border-white/[0.14] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                  />
                )}
                {item.id === "flashcards" && isHydrated && dueWordsCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 right-3.5 h-2 w-2 rounded-full bg-[#FF9F0A]"
                  />
                )}
                <Icon
                  className={cn(
                    "h-4 w-4",
                    active ? "text-[#0A84FF]" : "text-current"
                  )}
                />
                <span className="text-[10px] font-semibold tracking-tight truncate max-w-full">
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
      />
    </div>
  );
}
