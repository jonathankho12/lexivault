"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { motion } from "framer-motion";
import { BookOpen, Headphones, Mic, PenTool } from "lucide-react";
import { CefrProgressBanner } from "@/components/ielts/CefrProgressBanner";
import { IeltsListeningPanel } from "@/components/ielts/IeltsListeningPanel";
import { IeltsReadingPanel } from "@/components/ielts/IeltsReadingPanel";
import { IeltsSpeakingPanel } from "@/components/ielts/IeltsSpeakingPanel";
import { IeltsWritingPanel } from "@/components/ielts/IeltsWritingPanel";
import { PlacementTestFlow } from "@/components/ielts/PlacementTestFlow";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { loadIeltsState } from "@/lib/ieltsStorage";
import { IOS_SPRING, TAB_TRANSITION } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { IeltsAttempt, IeltsProfile, IeltsSubTab } from "@/types/ielts";

const VALID_SUB_TABS: readonly IeltsSubTab[] = [
  "reading",
  "listening",
  "writing",
  "speaking",
];

function isValidSubTab(value: string | null | undefined): value is IeltsSubTab {
  return Boolean(value && VALID_SUB_TABS.includes(value as IeltsSubTab));
}

export function IeltsView() {
  const { user, isHydrated } = useLexiVault();
  const { t } = useLanguage();

  const subTabs: Array<{
    id: IeltsSubTab;
    label: string;
    icon: ComponentType<{ className?: string }>;
  }> = [
    { id: "reading", label: t.ielts.reading, icon: BookOpen },
    { id: "listening", label: t.ielts.listening, icon: Headphones },
    { id: "writing", label: t.ielts.writing, icon: PenTool },
    { id: "speaking", label: t.ielts.speaking, icon: Mic },
  ];

  const [profile, setProfile] = useState<IeltsProfile | null>(null);
  const [attempts, setAttempts] = useState<IeltsAttempt[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showPlacement, setShowPlacement] = useState(false);
  const [subTab, setSubTab] = useState<IeltsSubTab>("reading");
  const pushedPlacementRef = useRef(false);

  // Sync initial subTab from URL / history and listen to browser Back/Forward
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const paramSkill = params.get("skill");
    const historyState = window.history.state as {
      ieltsTab?: IeltsSubTab;
      ieltsPlacement?: boolean;
    } | null;

    const initialTab = isValidSubTab(historyState?.ieltsTab)
      ? historyState.ieltsTab
      : isValidSubTab(paramSkill)
        ? paramSkill
        : "reading";

    setSubTab(initialTab);
    window.history.replaceState(
      {
        ...(historyState ?? {}),
        ieltsTab: initialTab,
        ieltsPlacement: Boolean(historyState?.ieltsPlacement),
      },
      "",
      window.location.href
    );

    const handlePopState = (event: PopStateEvent) => {
      const st = event.state as {
        ieltsTab?: IeltsSubTab;
        ieltsPlacement?: boolean;
      } | null;
      const nextParams = new URLSearchParams(window.location.search);
      const urlSkill = nextParams.get("skill");

      if (isValidSubTab(st?.ieltsTab)) {
        setSubTab(st.ieltsTab);
      } else if (isValidSubTab(urlSkill)) {
        setSubTab(urlSkill);
      }

      if (st && typeof st.ieltsPlacement === "boolean") {
        setShowPlacement(st.ieltsPlacement);
        pushedPlacementRef.current = st.ieltsPlacement;
      } else {
        const hasPlacementParam = nextParams.get("placement") === "1";
        setShowPlacement(hasPlacementParam);
        pushedPlacementRef.current = hasPlacementParam;
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateSubTab = useCallback(
    (nextTab: IeltsSubTab) => {
      if (nextTab === subTab) return;
      setSubTab(nextTab);
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      url.searchParams.set("skill", nextTab);
      url.searchParams.delete("placement");
      window.history.pushState(
        {
          ...(window.history.state ?? {}),
          ieltsTab: nextTab,
          ieltsPlacement: false,
        },
        "",
        url.toString()
      );
    },
    [subTab]
  );

  const openPlacement = useCallback(() => {
    setShowPlacement(true);
    if (typeof window === "undefined") return;
    pushedPlacementRef.current = true;
    const url = new URL(window.location.href);
    url.searchParams.set("placement", "1");
    window.history.pushState(
      {
        ...(window.history.state ?? {}),
        ieltsTab: subTab,
        ieltsPlacement: true,
      },
      "",
      url.toString()
    );
  }, [subTab]);

  const closePlacement = useCallback(() => {
    if (typeof window !== "undefined" && pushedPlacementRef.current) {
      pushedPlacementRef.current = false;
      window.history.back();
      return;
    }
    setShowPlacement(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("placement");
      window.history.replaceState(
        {
          ...(window.history.state ?? {}),
          ieltsTab: subTab,
          ieltsPlacement: false,
        },
        "",
        url.toString()
      );
    }
  }, [subTab]);

  useEffect(() => {
    if (!isHydrated || !user) return;
    let active = true;
    setLoadingProfile(true);

    loadIeltsState(user.id).then((res) => {
      if (!active) return;
      setProfile(res.profile);
      setAttempts(res.attempts);
      setShowPlacement(!res.profile.placement_completed);
      setLoadingProfile(false);
    });

    return () => {
      active = false;
    };
  }, [isHydrated, user]);

  const handleProfileUpdated = (
    nextProfile: IeltsProfile,
    nextAttempts: IeltsAttempt[]
  ) => {
    setProfile(nextProfile);
    setAttempts(nextAttempts);
  };

  if (!isHydrated || loadingProfile || !profile) {
    return (
      <div className="space-y-4">
        <div className="liquid-glass shimmer-glass h-44 rounded-3xl" />
        <div className="liquid-glass shimmer-glass h-64 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Global CEFR & Band Progress Bar */}
      <CefrProgressBanner
        profile={profile}
        onRetakePlacement={openPlacement}
      />

      {showPlacement ? (
        <PlacementTestFlow
          onFinished={(nextProfile, nextAttempts) => {
            handleProfileUpdated(nextProfile, nextAttempts);
            closePlacement();
          }}
          onCancel={closePlacement}
        />
      ) : (
        <div className="space-y-4">
          {/* Sub-Tabs Segmented Control */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-grid grid-cols-4 rounded-full bg-white/[0.06] border border-white/[0.11] p-1 w-full sm:w-auto">
              {subTabs.map((tab) => {
                const Icon = tab.icon;
                const active = subTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => navigateSubTab(tab.id)}
                    className={cn(
                      "relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer",
                      active ? "text-white" : "text-[#8E8E93] hover:text-white"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="ieltsSubTabPill"
                        transition={IOS_SPRING}
                        className="transform-gpu will-change-transform absolute inset-0 -z-10 rounded-full bg-white/[0.13] border border-white/[0.14]"
                      />
                    )}
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        active ? "text-[#0A84FF]" : "text-current"
                      )}
                    />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <span className="text-xs text-[#8E8E93]">
              {t.ielts.totalSessions}{" "}
              <strong className="text-white">{attempts.length}</strong>
            </span>
          </div>

          {/* Active Sub-Tab Panel */}
          <motion.div
            key={subTab}
            initial={TAB_TRANSITION.initial}
            animate={TAB_TRANSITION.animate}
            className="transform-gpu will-change-transform"
          >
            {subTab === "reading" && (
              <IeltsReadingPanel
                cefrLevel={profile.cefr_level}
                onProfileUpdated={handleProfileUpdated}
              />
            )}
            {subTab === "listening" && (
              <IeltsListeningPanel
                cefrLevel={profile.cefr_level}
                onProfileUpdated={handleProfileUpdated}
              />
            )}
            {subTab === "writing" && (
              <IeltsWritingPanel
                cefrLevel={profile.cefr_level}
                onProfileUpdated={handleProfileUpdated}
              />
            )}
            {subTab === "speaking" && (
              <IeltsSpeakingPanel
                cefrLevel={profile.cefr_level}
                onProfileUpdated={handleProfileUpdated}
              />
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
