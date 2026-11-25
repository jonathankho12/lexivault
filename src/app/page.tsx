"use client";

import { AuthView } from "@/components/auth/AuthView";
import { IntroducingLexiModal } from "@/components/IntroducingLexiModal";
import { DiscoverView } from "@/components/discover/DiscoverView";
import { FlashcardsView } from "@/components/flashcards/FlashcardsView";
import { GrammarCheckerView } from "@/components/GrammarCheckerView";
import { IeltsView } from "@/components/ielts/IeltsView";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { AppShell } from "@/components/layout/AppShell";
import { PracticeView } from "@/components/practice/PracticeView";
import { StatsView } from "@/components/stats/StatsView";
import { LexiLogo } from "@/components/ui/LexiLogo";
import { VaultView } from "@/components/vault/VaultView";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import type { TabId } from "@/types/lexivault";

export default function HomePage() {
  const { user, isAuthChecked } = useLexiVault();
  const { lang } = useLanguage();

  if (!isAuthChecked) {
    return (
      <div className="relative min-h-dvh w-full flex items-center justify-center bg-black">
        <AmbientBackground />
        <div className="flex flex-col items-center gap-3.5">
          <div className="animate-pulse">
            <LexiLogo size="lg" showAmbientGlow />
          </div>
          <p className="text-xs font-medium text-[#8E8E93]">
            {lang === "en" ? "Loading LexiVault..." : "Memuat LexiVault..."}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthView />
        <IntroducingLexiModal />
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
