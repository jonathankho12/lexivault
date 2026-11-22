"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AndroidAppModal } from "@/components/pwa/AndroidAppModal";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface PwaInstallContextValue {
  openAppModal: () => void;
  closeAppModal: () => void;
  canPromptInstall: boolean;
  isInstalled: boolean;
  isIos: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

export function PwaInstallProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = window.navigator.userAgent || "";
    const iosDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === "MacIntel" &&
        window.navigator.maxTouchPoints > 1);
    setIsIos(iosDevice);

    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      Boolean(
        (window.navigator as unknown as { standalone?: boolean }).standalone
      );
    setIsInstalled(standalone);

    if (
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const openAppModal = useCallback(() => setModalOpen(true), []);
  const closeAppModal = useCallback(() => setModalOpen(false), []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return "unavailable";
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      return choice.outcome;
    } catch {
      return "unavailable";
    }
  }, [deferredPrompt]);

  const value: PwaInstallContextValue = {
    openAppModal,
    closeAppModal,
    canPromptInstall: Boolean(deferredPrompt),
    isInstalled,
    isIos,
    promptInstall,
  };

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
      <AndroidAppModal
        open={modalOpen}
        onClose={closeAppModal}
        canPromptInstall={Boolean(deferredPrompt)}
        isInstalled={isInstalled}
        isIos={isIos}
        promptInstall={promptInstall}
      />
    </PwaInstallContext.Provider>
  );
}

export function usePwaInstall(): PwaInstallContextValue {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) {
    throw new Error("usePwaInstall must be used within PwaInstallProvider");
  }
  return ctx;
}
