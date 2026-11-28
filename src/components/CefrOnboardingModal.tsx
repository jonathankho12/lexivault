"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  GraduationCap,
  Loader2,
  Sparkles,
} from "lucide-react";
import { PlacementTestFlow } from "@/components/ielts/PlacementTestFlow";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { CEFR_LEVEL_META, getCefrMeta } from "@/lib/cefrProgression";
import { IOS_SHEET_SPRING, TAP_SCALE } from "@/lib/motion";
import { playCorrectChime, playGlassClick } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";
import type { CefrLevel } from "@/types/lexivault";

type OnboardingStep = "select" | "placement";

export function CefrOnboardingModal() {
  const {
    user,
    isHydrated,
    showCefrOnboarding,
    isLexiIntroOpen,
    cefrOnboardingInitialStep,
    completeCefrOnboarding,
    dismissCefrOnboarding,
  } = useLexiVault();
  const { lang } = useLanguage();
  const isEn = lang === "en";
  const isRu = lang === "ru";
  const pick = (en: string, id: string, ru: string) =>
    isEn ? en : isRu ? ru : id;

  const [step, setStep] = useState<OnboardingStep>("select");
  const [selectedCefr, setSelectedCefr] = useState<CefrLevel | null>("B1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (showCefrOnboarding) {
      setStep(cefrOnboardingInitialStep);
      setSelectedCefr("B1");
      setSaving(false);
    }
  }, [cefrOnboardingInitialStep, showCefrOnboarding, user?.id]);

  const handleConfirmLevel = async () => {
    if (!selectedCefr || saving) return;
    setSaving(true);
    playCorrectChime(2);
    try {
      await completeCefrOnboarding(selectedCefr);
    } finally {
      setSaving(false);
    }
  };

  const selectedMeta = selectedCefr ? getCefrMeta(selectedCefr) : null;

  return (
    <AnimatePresence>
      {isHydrated && user && showCefrOnboarding && !isLexiIntroOpen && (
        <div
          key="cefr-onboarding-portal"
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-6"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Glass Onboarding Sheet / Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={pick(
              "Choose Your English CEFR Level",
              "Pilih Level CEFR Bahasa Inggris Kamu",
              "Выбери свой уровень английского (CEFR)"
            )}
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={IOS_SHEET_SPRING}
            className="liquid-glass-elevated transform-gpu will-change-transform relative z-10 w-full md:max-w-3xl max-h-[92dvh] overflow-y-auto no-scrollbar rounded-t-[32px] md:rounded-3xl p-5 sm:p-7 pb-[max(1.75rem,env(safe-area-inset-bottom))] space-y-5"
          >
            {/* Mobile drag bar */}
            <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-white/25 md:hidden" />

            {step === "select" ? (
              <>
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.35)]">
                      <GraduationCap className="h-5.5 w-5.5 text-white" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#70BCFF]">
                        {isEn
                          ? `Welcome${user.provider !== "guest" ? `, @${user.username}` : ""} · Step 1`
                          : `Selamat Datang${user.provider !== "guest" ? `, @${user.username}` : ""} · Langkah 1`}
                      </p>
                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                        {isEn
                          ? "Choose Your English CEFR Level"
                          : "Pilih Level CEFR Bahasa Inggris Kamu"}
                      </h2>
                      <p className="text-xs sm:text-sm text-[#8E8E93] leading-relaxed">
                        {isEn
                          ? "LexiVault automatically tailors your Daily Pack vocabulary, idioms, and adaptive IELTS practice to your level."
                          : "LexiVault otomatis menyesuaikan paket kosakata harian, idiom, dan latihan IELTS adaptif sesuai levelmu."}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      playGlassClick();
                      void dismissCefrOnboarding();
                    }}
                    className="shrink-0 rounded-full bg-white/[0.06] border border-white/[0.1] px-3 py-1.5 text-[11px] font-medium text-[#8E8E93] hover:text-white cursor-pointer"
                  >
                    {isEn ? "Skip" : "Lewati"}
                  </button>
                </div>

                {/* 6 Interactive CEFR Level Cards (A1 - C2) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                  {CEFR_LEVEL_META.map((item) => {
                    const selected = selectedCefr === item.level;
                    return (
                      <motion.button
                        key={item.level}
                        type="button"
                        whileTap={TAP_SCALE}
                        onClick={() => {
                          playGlassClick();
                          setSelectedCefr(item.level);
                        }}
                        className={cn(
                          "group relative flex flex-col justify-between gap-2.5 rounded-2xl border p-3.5 sm:p-4 text-left transition-all cursor-pointer",
                          selected
                            ? "bg-[#0A84FF]/16 border-[#0A84FF]/65 shadow-[0_0_0_1px_rgba(10,132,255,0.35),0_10px_28px_rgba(10,132,255,0.16)]"
                            : "bg-white/[0.04] border-white/[0.09] hover:bg-white/[0.07] hover:border-white/[0.18]"
                        )}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold",
                                  item.badgeClass
                                )}
                              >
                                {item.level}
                              </span>
                              <span className="text-sm font-bold text-white">
                                {pick(item.titleEn, item.titleId, item.titleRu)}
                              </span>
                            </div>

                            <span
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                                selected
                                  ? "bg-[#0A84FF] border-[#0A84FF] text-white"
                                  : "border-white/20 text-transparent"
                              )}
                            >
                              <Check className="h-3 w-3 stroke-[2.5]" />
                            </span>
                          </div>

                          <p className="text-xs text-[#D1D1D6] leading-relaxed">
                            {pick(item.canDoEn, item.canDoId, item.canDoRu)}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.08] text-[11px]">
                          <span className="text-[#8E8E93]">
                            {pick("Daily Pack:", "Paket Harian:", "Пак дня:")}
                          </span>
                          <span className="font-semibold text-[#70BCFF]">
                            {item.dailyPackPreviewLabel}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Secondary CTA Card: 3-Minute Placement Test */}
                <motion.button
                  type="button"
                  whileTap={TAP_SCALE}
                  onClick={() => {
                    playGlassClick();
                    setStep("placement");
                  }}
                  className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#5E5CE6]/40 bg-gradient-to-r from-[#5E5CE6]/16 via-[#0A84FF]/10 to-white/[0.03] px-4 py-3.5 text-left hover:border-[#5E5CE6]/70 hover:brightness-110 transition-all cursor-pointer"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5E5CE6]/25 border border-[#5E5CE6]/45 text-[#C4C2FF]">
                      <Compass className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">
                        {pick(
                          "Not sure? Take the 3-Minute Placement Test →",
                          "Belum yakin? Ikuti Placement Test 3 Menit →",
                          "Не уверен? Пройди тест уровня за 3 минуты →"
                        )}
                      </p>
                      <p className="text-xs text-[#A7A5FF]/90">
                        {pick(
                          "10 quick adaptive questions across vocab, reading, listening & writing (+75 XP).",
                          "10 soal cepat adaptif mencakup vocab, reading, listening & writing (+75 XP).",
                          "10 быстрых адаптивных вопросов: лексика, чтение, аудирование и письмо (+75 XP)."
                        )}
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex shrink-0 items-center gap-1 self-start sm:self-center rounded-full bg-[#5E5CE6]/25 border border-[#5E5CE6]/45 px-3 py-1.5 text-xs font-semibold text-[#D6D4FF]">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{pick("Start Test", "Mulai Tes", "Начать тест")}</span>
                  </span>
                </motion.button>

                {/* Primary Confirm Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <p className="text-xs text-[#8E8E93]">
                    {selectedMeta
                      ? pick(
                          `Selected: ${selectedMeta.level} (${selectedMeta.titleEn}) · Daily Pack target set to Auto (${selectedMeta.dailyPackPreviewLabel})`,
                          `Dipilih: ${selectedMeta.level} (${selectedMeta.titleId}) · Target Harian diset Auto (${selectedMeta.dailyPackPreviewLabel})`,
                          `Выбрано: ${selectedMeta.level} (${selectedMeta.titleRu}) · Пак дня: Авто (${selectedMeta.dailyPackPreviewLabel})`
                        )
                      : pick(
                          "Select your starting CEFR level above.",
                          "Pilih level CEFR awalmu di atas.",
                          "Выбери свой стартовый уровень CEFR выше."
                        )}
                  </p>

                  <motion.button
                    type="button"
                    whileTap={TAP_SCALE}
                    disabled={!selectedCefr || saving}
                    onClick={() => void handleConfirmLevel()}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(10,132,255,0.3)] hover:brightness-110 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>
                          {pick(
                            "Saving Profile...",
                            "Menyimpan Profil...",
                            "Сохранение профиля..."
                          )}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          {selectedMeta
                            ? pick(
                                `Start at ${selectedMeta.level} (${selectedMeta.dailyPackPreviewLabel})`,
                                `Mulai di ${selectedMeta.level} (${selectedMeta.dailyPackPreviewLabel})`,
                                `Начать с ${selectedMeta.level} (${selectedMeta.dailyPackPreviewLabel})`
                              )
                            : pick("Continue", "Lanjutkan", "Продолжить")}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </motion.button>
                </div>
              </>
            ) : (
              /* Step 2: Embedded PlacementTestFlow */
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      playGlassClick();
                      setStep("select");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] border border-white/[0.12] px-3.5 py-1.5 text-xs font-semibold text-[#D1D1D6] hover:text-white cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>
                      {pick(
                        "Back to CEFR Level Picker",
                        "Kembali ke Pilihan Level CEFR",
                        "Назад к выбору CEFR"
                      )}
                    </span>
                  </button>

                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#70BCFF]">
                    {pick(
                      "Step 2 · Placement Test",
                      "Langkah 2 · Placement Test",
                      "Шаг 2 · Тест уровня"
                    )}
                  </span>
                </div>

                <PlacementTestFlow
                  startImmediately
                  finishLabel={pick(
                    "Save Level & Enter Vault",
                    "Simpan Level & Masuk Vault",
                    "Сохранить и открыть словарь"
                  )}
                  cancelLabel={pick("Back", "Kembali", "Назад")}
                  onCancel={() => setStep("select")}
                  onResultCalculated={(profile) => {
                    void completeCefrOnboarding(profile.cefr_level, {
                      fromPlacement: true,
                      keepModalOpen: true,
                    });
                  }}
                  onFinished={(profile) => {
                    void completeCefrOnboarding(profile.cefr_level, {
                      fromPlacement: true,
                    });
                  }}
                />
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
