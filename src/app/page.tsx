"use client";

import Image from "next/image";
import { AuthView } from "@/components/auth/AuthView";
import { IntroducingLexiModal } from "@/components/IntroducingLexiModal";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import { DiscoverView } from "@/components/discover/DiscoverView";
import { FlashcardsView } from "@/components/flashcards/FlashcardsView";
import { GrammarCheckerView } from "@/components/GrammarCheckerView";
import { IeltsView } from "@/components/ielts/IeltsView";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { AppShell } from "@/components/layout/AppShell";
import { PracticeView } from "@/components/practice/PracticeView";
import { StatsView } from "@/components/stats/StatsView";
import { VaultView } from "@/components/vault/VaultView";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import type { TabId } from "@/types/lexivault";

export default function HomePage() {
  const { user, isAuthChecked, showAuthModal } = useLexiVault();
  const { lang } = useLanguage();

  if (!isAuthChecked) {
    return (
      <div
        className="relative min-h-dvh w-full flex items-center justify-center bg-black"
        style={{
          minHeight: "100dvh",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000000",
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <AmbientBackground />
        <div
          className="flex flex-col items-center gap-3.5"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            className="relative inline-flex h-16 w-16 shrink-0 items-center justify-center animate-pulse transform-gpu"
            style={{
              position: "relative",
              display: "inline-flex",
              width: "64px",
              height: "64px",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-4 rounded-full bg-[radial-gradient(circle,rgba(94,92,230,0.36)_0%,rgba(56,189,248,0.16)_46%,rgba(0,0,0,0)_74%)] blur-xl transform-gpu"
            />
            <Image
              src="/logo-badge.png"
              alt="LexiVault"
              width={64}
              height={64}
              priority
              className="relative z-10 h-16 w-16 object-contain select-none pointer-events-none transform-gpu drop-shadow-[0_14px_28px_rgba(0,0,0,0.75)]"
              style={{
                width: "64px",
                height: "64px",
                objectFit: "contain",
              }}
            />
          </div>
          <p
            className="text-xs font-medium text-[#8E8E93]"
            style={{
              margin: 0,
              fontSize: "12px",
              fontWeight: 500,
              color: "#8E8E93",
              fontFamily:
                'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            {lang === "en"
              ? "Loading LexiVault..."
              : lang === "ru"
                ? "Загрузка LexiVault..."
                : "Memuat LexiVault..."}
          </p>
        </div>
      </div>
    );
  }

  if (!user || showAuthModal) {
    return (
      <>
        <AuthView />
        {!showAuthModal && <IntroducingLexiModal />}
        {!showAuthModal && <WhatsNewModal />}
      </>
    );
  }

  const renderTab = (tab: TabId) => {
    switch (tab) {
      case "flashcards":
        return <FlashcardsView />;
      case "practice":
        return <PracticeView />;
      case "grammar":
        return <GrammarCheckerView />;
      case "ielts":
        return <IeltsView />;
      case "discover":
        return <DiscoverView />;
      case "stats":
        return <StatsView />;
      case "vault":
      default:
        return <VaultView />;
    }
  };

  return <AppShell renderTab={renderTab} />;
}
