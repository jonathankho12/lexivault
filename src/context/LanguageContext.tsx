"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  LANGUAGE_STORAGE_KEY,
  TRANSLATIONS,
  type AppLanguage,
  type TranslationDictionary,
} from "@/lib/i18n";

interface LanguageContextValue {
  lang: AppLanguage;
  setLang: (next: AppLanguage) => void;
  t: TranslationDictionary;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLanguage>("id");

  useEffect(() => {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === "id" || saved === "en") {
      setLangState(saved);
      document.documentElement.lang = saved;
    } else {
      document.documentElement.lang = "id";
    }
  }, []);

  const setLang = useCallback((next: AppLanguage) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      document.documentElement.lang = next;
    }
  }, []);

  const value: LanguageContextValue = {
    lang,
    setLang,
    t: TRANSLATIONS[lang],
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
