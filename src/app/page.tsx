"use client";

import { AuthView } from "@/components/auth/AuthView";
import { DiscoverView } from "@/components/discover/DiscoverView";
import { FlashcardsView } from "@/components/flashcards/FlashcardsView";
import { IeltsView } from "@/components/ielts/IeltsView";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { AppShell } from "@/components/layout/AppShell";
import { PracticeView } from "@/components/practice/PracticeView";
import { StatsView } from "@/components/stats/StatsView";
import { LexiLogo } from "@/components/ui/LexiLogo";
import { VaultView } from "@/components/vault/VaultView";
import { useLexiVault } from "@/context/LexiVaultContext";
import type { TabId } from "@/types/lexivault";

export default function HomePage() {
  const { user, isAuthChecked } = useLexiVault();

  if (!isAuthChecked) {
    return (
      <div className="relative min-h-dvh w-full flex items-center justify-center bg-black">
        <AmbientBackground />
        <div className="flex flex-col items-center gap-3.5">
          <div className="animate-pulse">
            <LexiLogo size="lg" showAmbientGlow />
          </div>
          <p className="text-xs font-medium text-[#8E8E93]">
            Memuat LexiVault...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  const renderTab = (tab: TabId) => {
    switch (tab) {
      case "flashcards":
        return <FlashcardsView />;
      case "practice":
        return <PracticeView />;
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
