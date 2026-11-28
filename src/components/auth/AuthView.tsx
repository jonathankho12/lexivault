"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  User,
  UserRound,
} from "lucide-react";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { GetAndroidAppPill } from "@/components/pwa/AndroidAppModal";
import { AuthDeveloperFooter } from "@/components/ui/DeveloperCredits";
import { LanguageFlagPill } from "@/components/ui/FlagIcons";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { usePwaInstall } from "@/context/PwaInstallContext";
import { IOS_EASE, IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { playGlassClick } from "@/lib/soundEffects";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register";

export function AuthView() {
  const { authInitialMode, login, register, continueAsGuest } = useLexiVault();
  const { openAppModal } = usePwaInstall();
  const { t } = useLanguage();
  const [mode, setMode] = useState<AuthMode>(authInitialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cloudConfigured = isSupabaseConfigured();

  useEffect(() => {
    setMode(authInitialMode);
    setErrorMsg(null);
  }, [authInitialMode]);

  const handleModeChange = (next: AuthMode) => {
    setMode(next);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);

    if (mode === "register" && password !== confirmPassword) {
      setErrorMsg(t.auth.confirmMismatch);
      return;
    }

    setSubmitting(true);
    try {
      const res =
        mode === "login"
          ? await login(username, password, rememberMe)
          : await register(username, password, rememberMe);

      if (!res.ok) {
        setErrorMsg(res.error || t.auth.genericAuthError);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueAsGuest = () => {
    playGlassClick();
    continueAsGuest();
  };

  return (
    <div className="relative min-h-dvh w-full flex items-center justify-center px-4 pt-16 pb-8 sm:py-10 overflow-x-hidden">
      <AmbientBackground />

      {/* Floating Top-Right Minimalist Language Switcher */}
      <div className="fixed top-[max(1.25rem,env(safe-area-inset-top))] right-5 sm:top-6 sm:right-6 z-30">
        <LanguageFlagPill
          instanceId="auth"
          className="backdrop-blur-md bg-[#0E101A]/75 border-white/[0.14] shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_0.5px_rgba(255,255,255,0.18)]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: IOS_EASE }}
        className="w-full max-w-md space-y-6 transform-gpu will-change-transform"
      >
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="relative mx-auto inline-flex h-[92px] w-[92px] sm:h-[104px] sm:w-[104px] shrink-0 items-center justify-center transform-gpu">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-4 rounded-full bg-[radial-gradient(circle,rgba(94,92,230,0.34)_0%,rgba(56,189,248,0.16)_46%,rgba(0,0,0,0)_74%)] blur-xl transform-gpu"
            />
            <Image
              src="/lexi-badge.png"
              alt="LexiVault"
              width={384}
              height={415}
              priority
              className="relative z-10 h-full w-full object-contain select-none pointer-events-none transform-gpu drop-shadow-[0_12px_24px_rgba(15,23,42,0.32)] dark:drop-shadow-[0_14px_28px_rgba(0,0,0,0.75)] will-change-transform transition-transform duration-300 ease-out hover:scale-[1.06]"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              LexiVault
            </h1>
            <p className="text-sm text-[#8E8E93]">{t.auth.subtitle}</p>
          </div>
        </div>

        {/* Auth Glass Card */}
        <div className="liquid-glass-elevated rounded-[32px] p-6 sm:p-7 space-y-5">
          {/* Segmented Login / Register Switch */}
          <div className="grid grid-cols-2 rounded-full bg-white/[0.06] border border-white/[0.1] p-1">
            {(
              [
                { id: "login", label: t.auth.loginTab },
                { id: "register", label: t.auth.registerTab },
              ] as const
            ).map((tab) => {
              const active = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleModeChange(tab.id)}
                  className={cn(
                    "relative z-10 rounded-full py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer",
                    active ? "text-white" : "text-[#8E8E93] hover:text-[#F5F5F7]"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="authTabIndicator"
                      transition={IOS_SPRING}
                      className="absolute inset-0 -z-10 rounded-full bg-white/[0.14] border border-white/[0.16] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
                    />
                  )}
                  {tab.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="auth-username"
                className="block text-xs font-medium text-[#8E8E93] px-1"
              >
                {t.auth.usernameLabel}
              </label>
              <div className="liquid-glass-pill flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 focus-within:border-[#0A84FF]/60">
                <User className="h-4 w-4 shrink-0 text-[#8E8E93]" />
                <input
                  id="auth-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t.auth.usernamePlaceholder}
                  required
                  className="min-w-0 flex-1 bg-transparent text-base text-[#F5F5F7] placeholder:text-[#8E8E93]/70 focus:outline-none"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="auth-password"
                className="block text-xs font-medium text-[#8E8E93] px-1"
              >
                {t.auth.passwordLabel}
              </label>
              <div className="liquid-glass-pill flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 focus-within:border-[#0A84FF]/60">
                <Lock className="h-4 w-4 shrink-0 text-[#8E8E93]" />
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.auth.passwordPlaceholder}
                  required
                  className="min-w-0 flex-1 bg-transparent text-base text-[#F5F5F7] placeholder:text-[#8E8E93]/70 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? t.auth.hidePassword : t.auth.showPassword
                  }
                  className="text-[#8E8E93] hover:text-white cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password (Register only) */}
            {mode === "register" && (
              <div className="space-y-1.5">
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-xs font-medium text-[#8E8E93] px-1"
                >
                  {t.auth.confirmPasswordLabel}
                </label>
                <div className="liquid-glass-pill flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 focus-within:border-[#0A84FF]/60">
                  <Lock className="h-4 w-4 shrink-0 text-[#8E8E93]" />
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t.auth.confirmPasswordPlaceholder}
                    required
                    className="min-w-0 flex-1 bg-transparent text-base text-[#F5F5F7] placeholder:text-[#8E8E93]/70 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Remember Me Checkbox */}
            <label className="flex items-center gap-2.5 pt-0.5 cursor-pointer select-none">
              <button
                type="button"
                role="checkbox"
                aria-checked={rememberMe}
                onClick={() => setRememberMe((prev) => !prev)}
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer",
                  rememberMe
                    ? "bg-[#0A84FF] border-[#0A84FF] text-white"
                    : "bg-white/[0.06] border-white/[0.2] text-transparent"
                )}
              >
                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              </button>
              <span className="text-xs text-[#D1D1D6]">
                {t.auth.rememberMe}
              </span>
            </label>

            {/* Error Banner */}
            {errorMsg && (
              <div className="flex items-start gap-2 rounded-2xl bg-[#FF453A]/15 border border-[#FF453A]/35 px-3.5 py-2.5 text-xs text-[#FFB4AE]">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#FF453A]" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Submit Button */}
            <motion.button
              type="submit"
              whileTap={TAP_SCALE}
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] py-3 px-5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(10,132,255,0.3)] hover:brightness-110 cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {mode === "login"
                      ? t.auth.submittingLogin
                      : t.auth.submittingRegister}
                  </span>
                </>
              ) : (
                <span>
                  {mode === "login"
                    ? t.auth.submitLogin
                    : t.auth.submitRegister}
                </span>
              )}
            </motion.button>
          </form>

          {/* Guest Mode & Backend Indicator */}
          <div className="pt-3 border-t border-white/[0.09] space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/[0.08]" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#8E8E93]">
                {t.auth.orDivider}
              </span>
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>

            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={handleContinueAsGuest}
              className="liquid-glass-pill transform-gpu w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-white/[0.11] hover:border-white/[0.22] cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] border border-white/[0.14] text-[#F5F5F7]">
                  <UserRound className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-white truncate">
                    {t.auth.guestTitle}
                  </p>
                  <p className="text-[11px] text-[#8E8E93] truncate">
                    {t.auth.guestSubtitle}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-[#8E8E93]" />
            </motion.button>

            <div className="flex items-center justify-between text-[11px] px-0.5">
              <span className="text-[#8E8E93]">{t.auth.backendLabel}</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-[#F5F5F7]">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    cloudConfigured ? "bg-[#30D158]" : "bg-[#0A84FF]"
                  )}
                />
                {cloudConfigured ? t.auth.backendCloud : t.auth.backendLocal}
              </span>
            </div>

            <div className="pt-1 flex justify-center">
              <GetAndroidAppPill onClick={openAppModal} />
            </div>
          </div>
        </div>

        <AuthDeveloperFooter />
      </motion.div>
    </div>
  );
}
