"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { flushSync } from "react-dom";
import {
  applyThemeToDom,
  DEFAULT_THEME,
  getStoredTheme,
  isThemePreference,
  resolveTheme,
  setThemeWithTransition,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
  type ThemeTransitionOrigin,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  mounted: boolean;
  setTheme: (next: ThemePreference, origin?: ThemeTransitionOrigin) => void;
  toggleTheme: (origin?: ThemeTransitionOrigin) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  resolvedTheme: "dark",
  mounted: false,
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(DEFAULT_THEME);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = getStoredTheme();
    const resolved = applyThemeToDom(stored);
    setThemeState(stored);
    setResolvedTheme(resolved);
    setMounted(true);

    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: light)")
        : null;

    const handleMediaChange = () => {
      const current = getStoredTheme();
      if (current === "system") {
        setResolvedTheme(applyThemeToDom("system"));
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const next = isThemePreference(event.newValue)
        ? event.newValue
        : DEFAULT_THEME;
      setThemeState(next);
      setResolvedTheme(applyThemeToDom(next));
    };

    const handleCustomChange = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          preference?: ThemePreference;
          resolved?: ResolvedTheme;
        }>
      ).detail;
      if (detail?.preference && isThemePreference(detail.preference)) {
        setThemeState(detail.preference);
        setResolvedTheme(detail.resolved ?? resolveTheme(detail.preference));
      }
    };

    mediaQuery?.addEventListener("change", handleMediaChange);
    window.addEventListener("storage", handleStorage);
    window.addEventListener(THEME_CHANGE_EVENT, handleCustomChange);

    return () => {
      mediaQuery?.removeEventListener("change", handleMediaChange);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(THEME_CHANGE_EVENT, handleCustomChange);
    };
  }, []);

  const setTheme = useCallback(
    (next: ThemePreference, origin?: ThemeTransitionOrigin) => {
      setThemeWithTransition(next, origin, (resolved, viaViewTransition) => {
        if (viaViewTransition) {
          flushSync(() => {
            setThemeState(next);
            setResolvedTheme(resolved);
          });
        } else {
          setThemeState(next);
          setResolvedTheme(resolved);
        }
      });
    },
    []
  );

  const toggleTheme = useCallback(
    (origin?: ThemeTransitionOrigin) => {
      const currentResolved = resolveTheme(theme);
      const next: ThemePreference =
        currentResolved === "dark" ? "light" : "dark";
      setTheme(next, origin);
    },
    [theme, setTheme]
  );

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      mounted,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, mounted, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
