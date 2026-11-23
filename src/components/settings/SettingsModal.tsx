"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Database,
  Download,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  Loader2,
  LogOut,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldCheck,
  Trash2,
  User,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { GetAndroidAppPill } from "@/components/pwa/AndroidAppModal";
import { SettingsDeveloperCard } from "@/components/ui/DeveloperCredits";
import { FlagEnIcon, FlagIdIcon } from "@/components/ui/FlagIcons";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { usePwaInstall } from "@/context/PwaInstallContext";
import { clearPronunciationCache } from "@/lib/audioCache";
import { IOS_SHEET_SPRING, TAP_SCALE } from "@/lib/motion";
import { playCorrectChime, playGlassClick } from "@/lib/soundEffects";
import { cn, getLocalDateString } from "@/lib/utils";

export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    user,
    xp,
    masteryRankInfo,
    accent,
    setAccent,
    sfxMuted,
    toggleSfxMuted,
    ringTargets,
    updateRingTargets,
    resetRingTargets,
    dailyQuota,
    updateDailyQuota,
    dailyPack,
    todayStr,
    applyQuotaToTodayPack,
    words,
    studyLogs,
    syncMode,
    syncStatus,
    changePassword,
    openRegisterFromGuest,
    logout,
  } = useLexiVault();
  const { openAppModal } = usePwaInstall();
  const { lang, setLang, t } = useLanguage();

  const [editingPassword, setEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdFeedback, setPwdFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [clearingAudio, setClearingAudio] = useState(false);
  const [clearAudioMsg, setClearAudioMsg] = useState<string | null>(null);
  const [applyingPack, setApplyingPack] = useState(false);
  const [applyPackMsg, setApplyPackMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEditingPassword(false);
      setNewPassword("");
      setConfirmPassword("");
      setPwdFeedback(null);
      setExportMsg(null);
      setClearAudioMsg(null);
      setApplyPackMsg(null);
    }
  }, [open]);

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

  const isGuest = user?.provider === "guest";
  const isCloud = user?.provider === "supabase";

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdLoading) return;
    setPwdFeedback(null);

    if (newPassword.length < 6) {
      setPwdFeedback({
        ok: false,
        message: t.settings.account.passwordTooShort,
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdFeedback({
        ok: false,
        message: t.settings.account.passwordMismatch,
      });
      return;
    }

    setPwdLoading(true);
    try {
      const res = await changePassword(newPassword);
      if (res.ok) {
        playCorrectChime(2);
        setPwdFeedback({
          ok: true,
          message: t.settings.account.passwordUpdated,
        });
        setNewPassword("");
        setConfirmPassword("");
        setEditingPassword(false);
      } else {
        setPwdFeedback({
          ok: false,
          message:
            res.error ||
            (lang === "en"
              ? "Failed to update password."
              : "Gagal memperbarui password."),
        });
      }
    } finally {
      setPwdLoading(false);
    }
  };

  const handleExportJson = () => {
    playGlassClick();
    const today = getLocalDateString();
    const payload = {
      exportedAt: new Date().toISOString(),
      username: user?.username ?? "guest",
      provider: user?.provider ?? "guest",
      xp,
      words,
      studyLogs,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lexivault-backup-${today}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportMsg(t.settings.dataStorage.exportedMsg);
  };

  const handleClearAudioCache = async () => {
    if (clearingAudio) return;
    playGlassClick();
    setClearingAudio(true);
    setClearAudioMsg(null);
    try {
      const { clearedCount } = await clearPronunciationCache();
      setClearAudioMsg(
        `${t.settings.dataStorage.clearedAudioPrefix}${clearedCount} ${t.settings.dataStorage.clearedAudioSuffix}`
      );
    } finally {
      setClearingAudio(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          key="settings-modal-portal"
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6"
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
            aria-label={t.settings.title}
            initial={{ opacity: 0, y: 44 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 34 }}
            transition={IOS_SHEET_SPRING}
            className="liquid-glass-elevated transform-gpu will-change-transform relative z-10 w-full md:max-w-2xl max-h-[88dvh] overflow-y-auto no-scrollbar rounded-t-[32px] md:rounded-3xl p-5 sm:p-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] space-y-5"
          >
            {/* Mobile Drag Handle */}
            <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-white/25 md:hidden" />

            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0A84FF]/20 border border-[#0A84FF]/35 text-[#70BCFF]">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {t.settings.title}
                  </h2>
                  <p className="text-xs text-[#8E8E93]">
                    {t.settings.subtitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={t.settings.close}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[#8E8E93] hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 1. ACCOUNT & SECURITY */}
            <section className="space-y-2">
              <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                {t.settings.sections.account}
              </h3>

              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] divide-y divide-white/[0.08]">
                {/* Profile & Rank */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                        isGuest
                          ? "bg-[#FF9F0A]/15 border-[#FF9F0A]/35 text-[#FFBE5C]"
                          : "bg-[#0A84FF]/20 border-[#0A84FF]/35 text-[#70BCFF]"
                      )}
                    >
                      <User className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {isGuest
                          ? t.nav.guestModeLabel
                          : `@${user?.username ?? "user"}`}
                      </p>
                      <p className="text-xs text-[#8E8E93] truncate">
                        {masteryRankInfo.rank} · {xp.toLocaleString()} XP
                      </p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold",
                      isCloud
                        ? "bg-[#30D158]/15 border-[#30D158]/35 text-[#7CF099]"
                        : isGuest
                          ? "bg-[#FF9F0A]/15 border-[#FF9F0A]/35 text-[#FFBE5C]"
                          : "bg-[#0A84FF]/15 border-[#0A84FF]/35 text-[#70BCFF]"
                    )}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>
                      {isCloud
                        ? t.settings.account.statusCloud
                        : isGuest
                          ? t.settings.account.statusGuest
                          : t.settings.account.statusLocal}
                    </span>
                  </span>
                </div>

                {/* Password Management */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <KeyRound className="h-4 w-4 text-[#8E8E93] shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-[#8E8E93]">
                          {t.settings.account.passwordLabel}
                        </p>
                        <p className="text-sm font-mono tracking-widest text-white">
                          ••••••••
                        </p>
                      </div>
                    </div>

                    {!isGuest && (
                      <motion.button
                        type="button"
                        whileTap={TAP_SCALE}
                        onClick={() => {
                          playGlassClick();
                          setEditingPassword((prev) => !prev);
                          setPwdFeedback(null);
                        }}
                        className="rounded-full bg-white/[0.08] border border-white/[0.12] px-3 py-1.5 text-xs font-semibold text-[#F5F5F7] hover:bg-white/[0.14] cursor-pointer"
                      >
                        {editingPassword
                          ? t.settings.account.cancelChangeBtn
                          : t.settings.account.changePasswordBtn}
                      </motion.button>
                    )}
                  </div>

                  {isGuest && (
                    <p className="text-xs text-[#8E8E93] leading-relaxed">
                      {t.settings.account.guestPasswordNote}
                    </p>
                  )}

                  {pwdFeedback && (
                    <div
                      className={cn(
                        "rounded-xl border px-3 py-2 text-xs font-medium",
                        pwdFeedback.ok
                          ? "bg-[#30D158]/15 border-[#30D158]/35 text-[#7CF099]"
                          : "bg-[#FF453A]/15 border-[#FF453A]/35 text-[#FFB4AE]"
                      )}
                    >
                      {pwdFeedback.message}
                    </div>
                  )}

                  {!isGuest && editingPassword && (
                    <form
                      onSubmit={handlePasswordSubmit}
                      className="space-y-2.5 pt-1"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="liquid-glass-pill flex items-center gap-2 rounded-xl px-3 py-2">
                          <input
                            type={showPwd ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder={t.settings.account.newPassword}
                            required
                            className="min-w-0 flex-1 bg-transparent text-xs text-white placeholder:text-[#8E8E93] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPwd((p) => !p)}
                            className="text-[#8E8E93] hover:text-white cursor-pointer"
                          >
                            {showPwd ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="liquid-glass-pill flex items-center gap-2 rounded-xl px-3 py-2">
                          <input
                            type={showPwd ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder={t.settings.account.confirmPassword}
                            required
                            className="min-w-0 flex-1 bg-transparent text-xs text-white placeholder:text-[#8E8E93] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <motion.button
                          type="submit"
                          whileTap={TAP_SCALE}
                          disabled={pwdLoading}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1A8EFF] cursor-pointer disabled:opacity-60"
                        >
                          {pwdLoading && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          )}
                          <span>
                            {pwdLoading
                              ? t.settings.account.savingPassword
                              : t.settings.account.savePasswordBtn}
                          </span>
                        </motion.button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Auth Action Row */}
                <div className="p-3.5 flex justify-end">
                  {isGuest ? (
                    <motion.button
                      type="button"
                      whileTap={TAP_SCALE}
                      onClick={() => {
                        playGlassClick();
                        onClose();
                        void openRegisterFromGuest();
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0A84FF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1A8EFF] cursor-pointer"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>{t.settings.account.createAccountSync}</span>
                    </motion.button>
                  ) : (
                    <motion.button
                      type="button"
                      whileTap={TAP_SCALE}
                      onClick={() => {
                        playGlassClick();
                        onClose();
                        void logout();
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#FF453A]/15 border border-[#FF453A]/35 px-4 py-2 text-xs font-semibold text-[#FF8982] hover:bg-[#FF453A]/25 cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>{t.settings.account.logoutBtn}</span>
                    </motion.button>
                  )}
                </div>
              </div>
            </section>

            {/* 2. INTERFACE LANGUAGE */}
            <section className="space-y-2">
              <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                {t.settings.sections.language}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(
                  [
                    {
                      id: "id",
                      label: t.settings.language.indonesia,
                      sub: t.settings.language.indonesiaSub,
                      Flag: FlagIdIcon,
                    },
                    {
                      id: "en",
                      label: t.settings.language.english,
                      sub: t.settings.language.englishSub,
                      Flag: FlagEnIcon,
                    },
                  ] as const
                ).map((item) => {
                  const active = lang === item.id;
                  const Flag = item.Flag;
                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      whileTap={TAP_SCALE}
                      onClick={() => {
                        playGlassClick();
                        setLang(item.id);
                      }}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-colors cursor-pointer",
                        active
                          ? "bg-[#0A84FF]/15 border-[#0A84FF]/50 text-white"
                          : "bg-white/[0.04] border-white/[0.08] text-[#D1D1D6] hover:bg-white/[0.08]"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Flag className="h-4.5 w-6" />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-semibold truncate">
                            {item.label}
                          </p>
                          <p className="text-[11px] text-[#8E8E93] truncate">
                            {item.sub}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                          active
                            ? "bg-[#0A84FF] border-[#0A84FF] text-white"
                            : "border-white/20 text-transparent"
                        )}
                      >
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </section>

            {/* 3. DAILY LEARNING PACK QUOTA */}
            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                  {t.settings.sections.dailyPack}
                </h3>
                <span className="text-[10px] font-medium text-[#70BCFF]">
                  {isCloud
                    ? t.settings.dailyPack.cloudSyncNote
                    : t.settings.dailyPack.guestLocalNote}
                </span>
              </div>

              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] divide-y divide-white/[0.08]">
                {/* New Words / Day (0 - 30) */}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-white">
                        {t.settings.dailyPack.wordsPerDay}
                      </p>
                      <p className="text-[11px] text-[#8E8E93]">
                        {t.settings.dailyPack.wordsPerDayDesc}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          playGlassClick();
                          setApplyPackMsg(null);
                          updateDailyQuota({
                            wordsPerDay: Math.max(0, dailyQuota.wordsPerDay - 1),
                          });
                        }}
                        aria-label="Decrease words per day"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-[#70BCFF] tabular-nums">
                        {dailyQuota.wordsPerDay}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          playGlassClick();
                          setApplyPackMsg(null);
                          updateDailyQuota({
                            wordsPerDay: Math.min(30, dailyQuota.wordsPerDay + 1),
                          });
                        }}
                        aria-label="Increase words per day"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={1}
                    value={dailyQuota.wordsPerDay}
                    onChange={(e) => {
                      setApplyPackMsg(null);
                      updateDailyQuota({ wordsPerDay: Number(e.target.value) });
                    }}
                    className="w-full accent-[#0A84FF] cursor-pointer"
                  />
                </div>

                {/* New Idioms / Day (0 - 20) */}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-white">
                        {t.settings.dailyPack.idiomsPerDay}
                      </p>
                      <p className="text-[11px] text-[#8E8E93]">
                        {t.settings.dailyPack.idiomsPerDayDesc}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          playGlassClick();
                          setApplyPackMsg(null);
                          updateDailyQuota({
                            idiomsPerDay: Math.max(0, dailyQuota.idiomsPerDay - 1),
                          });
                        }}
                        aria-label="Decrease idioms per day"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-[#FFD18C] tabular-nums">
                        {dailyQuota.idiomsPerDay}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          playGlassClick();
                          setApplyPackMsg(null);
                          updateDailyQuota({
                            idiomsPerDay: Math.min(20, dailyQuota.idiomsPerDay + 1),
                          });
                        }}
                        aria-label="Increase idioms per day"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    step={1}
                    value={dailyQuota.idiomsPerDay}
                    onChange={(e) => {
                      setApplyPackMsg(null);
                      updateDailyQuota({ idiomsPerDay: Number(e.target.value) });
                    }}
                    className="w-full accent-[#FF9F0A] cursor-pointer"
                  />
                </div>

                {/* Auto-show Daily Pop-up Toggle */}
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Flame className="h-4 w-4 text-[#FF9F0A] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-white">
                        {t.settings.dailyPack.autoShowPopup}
                      </p>
                      <p className="text-[11px] text-[#8E8E93]">
                        {dailyQuota.autoShowPopup
                          ? t.settings.dailyPack.autoShowOnDesc
                          : t.settings.dailyPack.autoShowOffDesc}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={dailyQuota.autoShowPopup}
                    onClick={() => {
                      playGlassClick();
                      updateDailyQuota({
                        autoShowPopup: !dailyQuota.autoShowPopup,
                      });
                    }}
                    className={cn(
                      "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors cursor-pointer p-0.5",
                      dailyQuota.autoShowPopup
                        ? "bg-[#30D158] border-[#30D158]"
                        : "bg-white/[0.1] border-white/[0.15]"
                    )}
                  >
                    <span
                      className={cn(
                        "h-5.5 w-5.5 rounded-full bg-white shadow transition-transform transform-gpu",
                        dailyQuota.autoShowPopup ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {/* Summary / Paused Warning / Apply Today CTA */}
                <div className="p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#D1D1D6]">
                      {t.settings.dailyPack.totalPerDayPrefix}{" "}
                      <span className="text-white tabular-nums">
                        {dailyQuota.wordsPerDay + dailyQuota.idiomsPerDay}{" "}
                        {t.settings.dailyPack.totalPerDaySuffix}
                      </span>
                    </span>

                    {dailyQuota.wordsPerDay + dailyQuota.idiomsPerDay > 0 &&
                      (!dailyPack ||
                        dailyPack.pack_date !== todayStr ||
                        (dailyPack.completed_terms.length === 0 &&
                          (dailyPack.words_quota !== dailyQuota.wordsPerDay ||
                            dailyPack.idioms_quota !==
                              dailyQuota.idiomsPerDay))) && (
                        <motion.button
                          type="button"
                          whileTap={TAP_SCALE}
                          disabled={applyingPack}
                          onClick={async () => {
                            playGlassClick();
                            setApplyingPack(true);
                            setApplyPackMsg(null);
                            try {
                              await applyQuotaToTodayPack();
                              setApplyPackMsg(
                                t.settings.dailyPack.appliedTodayMsg
                              );
                            } finally {
                              setApplyingPack(false);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF]/20 border border-[#0A84FF]/40 px-3 py-1.5 text-[11px] font-semibold text-[#70BCFF] hover:bg-[#0A84FF]/30 cursor-pointer disabled:opacity-50"
                        >
                          {applyingPack ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          <span>
                            {applyingPack
                              ? t.settings.dailyPack.applyingTodayBtn
                              : t.settings.dailyPack.applyTodayBtn}
                          </span>
                        </motion.button>
                      )}
                  </div>

                  {dailyQuota.wordsPerDay + dailyQuota.idiomsPerDay === 0 && (
                    <div className="flex items-start gap-2 rounded-xl bg-[#FF9F0A]/12 border border-[#FF9F0A]/30 px-3 py-2 text-xs text-[#FFD18C]">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{t.settings.dailyPack.pausedHint}</span>
                    </div>
                  )}

                  {applyPackMsg && (
                    <div className="rounded-xl bg-[#30D158]/15 border border-[#30D158]/35 px-3 py-2 text-xs font-medium text-[#7CF099]">
                      {applyPackMsg}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* 4. AUDIO & STUDY PREFERENCES */}
            <section className="space-y-2">
              <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                {t.settings.sections.audioStudy}
              </h3>

              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] divide-y divide-white/[0.08]">
                {/* Default Accent */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <span className="text-xs sm:text-sm font-medium text-white">
                    {t.settings.audioStudy.defaultAccent}
                  </span>
                  <div className="inline-grid grid-cols-2 rounded-full bg-white/[0.06] border border-white/[0.1] p-0.5">
                    {(
                      [
                        { id: "US", label: t.settings.audioStudy.usLabel },
                        { id: "UK", label: t.settings.audioStudy.ukLabel },
                      ] as const
                    ).map((opt) => {
                      const active = accent === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            playGlassClick();
                            setAccent(opt.id);
                          }}
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer",
                            active
                              ? "bg-[#0A84FF] text-white"
                              : "text-[#8E8E93] hover:text-white"
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Micro SFX Toggle */}
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {sfxMuted ? (
                      <VolumeX className="h-4 w-4 text-[#8E8E93] shrink-0" />
                    ) : (
                      <Volume2 className="h-4 w-4 text-[#0A84FF] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-white">
                        {t.settings.audioStudy.sfxLabel}
                      </p>
                      <p className="text-[11px] text-[#8E8E93] truncate">
                        {sfxMuted
                          ? t.settings.audioStudy.sfxMutedDesc
                          : t.settings.audioStudy.sfxOnDesc}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={!sfxMuted}
                    onClick={toggleSfxMuted}
                    className={cn(
                      "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors cursor-pointer p-0.5",
                      !sfxMuted
                        ? "bg-[#30D158] border-[#30D158]"
                        : "bg-white/[0.1] border-white/[0.15]"
                    )}
                  >
                    <span
                      className={cn(
                        "h-5.5 w-5.5 rounded-full bg-white shadow transition-transform transform-gpu",
                        !sfxMuted ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {/* Daily Ring Targets */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-white">
                        {t.settings.audioStudy.ringTargetsTitle}
                      </p>
                      <p className="text-[11px] text-[#8E8E93]">
                        {t.settings.audioStudy.ringTargetsDesc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        playGlassClick();
                        resetRingTargets();
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/[0.1] px-2.5 py-1 text-[11px] font-medium text-[#D1D1D6] hover:bg-white/[0.12] cursor-pointer shrink-0"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>{t.settings.audioStudy.resetDefaults}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(
                      [
                        {
                          key: "vocab",
                          label: t.settings.audioStudy.vocabTarget,
                          value: ringTargets.vocab,
                          step: 1,
                          min: 1,
                          max: 20,
                          accentText: "text-[#70BCFF]",
                        },
                        {
                          key: "recall",
                          label: t.settings.audioStudy.recallTarget,
                          value: ringTargets.recall,
                          step: 5,
                          min: 5,
                          max: 50,
                          accentText: "text-[#7CF099]",
                        },
                        {
                          key: "ielts",
                          label: t.settings.audioStudy.ieltsTarget,
                          value: ringTargets.ielts,
                          step: 1,
                          min: 1,
                          max: 5,
                          accentText: "text-[#E0AAFF]",
                        },
                      ] as const
                    ).map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2"
                      >
                        <span className="text-[11px] font-medium text-[#D1D1D6]">
                          {item.label}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              playGlassClick();
                              updateRingTargets({
                                [item.key]: Math.max(
                                  item.min,
                                  item.value - item.step
                                ),
                              });
                            }}
                            aria-label={`Decrease ${item.label}`}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.07] hover:bg-white/[0.14] text-white cursor-pointer"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span
                            className={cn(
                              "w-6 text-center text-xs font-bold tabular-nums",
                              item.accentText
                            )}
                          >
                            {item.value}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              playGlassClick();
                              updateRingTargets({
                                [item.key]: Math.min(
                                  item.max,
                                  item.value + item.step
                                ),
                              });
                            }}
                            aria-label={`Increase ${item.label}`}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.07] hover:bg-white/[0.14] text-white cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 4. DATA & STORAGE */}
            <section className="space-y-2">
              <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                {t.settings.sections.dataStorage}
              </h3>

              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] divide-y divide-white/[0.08]">
                <div className="flex flex-wrap items-center justify-between gap-2 p-4 text-xs">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-[#0A84FF]" />
                    <span className="text-[#8E8E93]">
                      {t.settings.dataStorage.connectionLabel}:
                    </span>
                    <span className="font-semibold text-white">
                      {isGuest
                        ? t.settings.dataStorage.connGuest
                        : isCloud
                          ? syncStatus === "syncing"
                            ? t.nav.syncing
                            : syncStatus === "synced" || syncMode === "supabase"
                              ? t.settings.dataStorage.connCloud
                              : t.settings.dataStorage.connLocal
                          : t.settings.dataStorage.connLocal}
                    </span>
                  </div>
                  <span className="font-semibold text-[#D1D1D6]">
                    {t.settings.dataStorage.savedExpressions}: {words.length}
                  </span>
                </div>

                <div className="p-4 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <motion.button
                      type="button"
                      whileTap={TAP_SCALE}
                      onClick={handleExportJson}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/[0.07] border border-white/[0.12] px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/[0.12] cursor-pointer"
                    >
                      <Download className="h-4 w-4 text-[#0A84FF]" />
                      <span>{t.settings.dataStorage.exportBtn}</span>
                    </motion.button>

                    <motion.button
                      type="button"
                      whileTap={TAP_SCALE}
                      disabled={clearingAudio}
                      onClick={() => void handleClearAudioCache()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/[0.07] border border-white/[0.12] px-4 py-2.5 text-xs font-semibold text-[#FFB4AE] hover:bg-[#FF453A]/15 hover:border-[#FF453A]/35 cursor-pointer disabled:opacity-50"
                    >
                      {clearingAudio ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      <span>
                        {clearingAudio
                          ? t.settings.dataStorage.clearingAudioBtn
                          : t.settings.dataStorage.clearAudioBtn}
                      </span>
                    </motion.button>
                  </div>

                  {(exportMsg || clearAudioMsg) && (
                    <div className="rounded-xl bg-[#30D158]/15 border border-[#30D158]/35 px-3 py-2 text-xs font-medium text-[#7CF099]">
                      {exportMsg || clearAudioMsg}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Bottom Get Android App CTA */}
            <div className="pt-2 border-t border-white/[0.08] flex justify-center">
              <GetAndroidAppPill
                onClick={openAppModal}
                className="w-full justify-center py-2.5"
              />
            </div>

            {/* About & Developer */}
            <SettingsDeveloperCard />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
