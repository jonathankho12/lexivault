"use client";

import { useCallback, useEffect, useRef } from "react";
import type { TabId } from "@/types/lexivault";

const VALID_TABS: ReadonlySet<TabId> = new Set([
  "vault",
  "flashcards",
  "practice",
  "ielts",
  "discover",
  "stats",
]);

export interface LexiHistoryState {
  __lexivault: true;
  tab: TabId;
  overlay: string | null;
  seq: number;
}

function isLexiHistoryState(val: unknown): val is LexiHistoryState {
  return (
    Boolean(val) &&
    typeof val === "object" &&
    (val as Record<string, unknown>).__lexivault === true &&
    typeof (val as Record<string, unknown>).tab === "string"
  );
}

export function readInitialTabFromUrl(): TabId {
  if (typeof window === "undefined") return "vault";
  try {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam && VALID_TABS.has(tabParam as TabId)) {
      return tabParam as TabId;
    }
  } catch {
    // Ignore malformed URLs
  }
  return "vault";
}

function buildTabUrl(tab: TabId): string {
  if (typeof window === "undefined") return "/";
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return `/?tab=${tab}`;
  }
}

export interface BrowserHistoryController {
  navigateTab: (nextTab: TabId) => void;
  registerOverlay: (overlayId: string, onBackClose: () => void) => () => void;
  openOverlay: (overlayId: string) => void;
  closeOverlay: (overlayId: string) => void;
}

export function useBrowserHistoryNav(
  activeTab: TabId,
  setActiveTabState: (tab: TabId) => void
): BrowserHistoryController {
  const activeTabRef = useRef<TabId>(activeTab);
  activeTabRef.current = activeTab;

  const seqRef = useRef(0);
  const initializedRef = useRef(false);
  const overlaysRef = useRef<Map<string, () => void>>(new Map());
  const closedByPopRef = useRef<Set<string>>(new Set());

  // Initialize URL tab & replace initial history state cleanly (never push on mount)
  useEffect(() => {
    if (typeof window === "undefined" || initializedRef.current) return;
    initializedRef.current = true;

    const urlTab = readInitialTabFromUrl();
    if (urlTab !== activeTabRef.current) {
      activeTabRef.current = urlTab;
      setActiveTabState(urlTab);
    }

    const currentState = window.history.state;
    const initialState: LexiHistoryState = isLexiHistoryState(currentState)
      ? { ...currentState, tab: urlTab, overlay: null }
      : { __lexivault: true, tab: urlTab, overlay: null, seq: 0 };
    seqRef.current = initialState.seq;

    try {
      window.history.replaceState(initialState, "", buildTabUrl(urlTab));
    } catch {
      // Ignore history API restrictions
    }
  }, [setActiveTabState]);

  // Listen for browser / mobile hardware Back & Forward navigation
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (!isLexiHistoryState(state)) {
        // Fallback: read tab from URL if state was cleared
        const fallbackTab = readInitialTabFromUrl();
        overlaysRef.current.forEach((closeFn, id) => {
          closedByPopRef.current.add(id);
          closeFn();
        });
        if (fallbackTab !== activeTabRef.current) {
          activeTabRef.current = fallbackTab;
          setActiveTabState(fallbackTab);
        }
        return;
      }

      seqRef.current = Math.max(seqRef.current, state.seq);

      // Close any registered overlay that is not the target state's active overlay
      overlaysRef.current.forEach((closeFn, id) => {
        if (id !== state.overlay) {
          closedByPopRef.current.add(id);
          closeFn();
        }
      });

      if (VALID_TABS.has(state.tab) && state.tab !== activeTabRef.current) {
        activeTabRef.current = state.tab;
        setActiveTabState(state.tab);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setActiveTabState]);

  const navigateTab = useCallback(
    (nextTab: TabId) => {
      if (!VALID_TABS.has(nextTab)) return;
      const prevTab = activeTabRef.current;
      activeTabRef.current = nextTab;
      setActiveTabState(nextTab);

      if (typeof window === "undefined") return;

      const cur = window.history.state;
      if (isLexiHistoryState(cur)) {
        // Prevent duplicate consecutive pushes for the exact same tab with no overlay
        if (cur.tab === nextTab && !cur.overlay) {
          return;
        }
        // If an overlay is currently on top of the history stack, replace it with the new tab
        if (cur.overlay) {
          const nextState: LexiHistoryState = {
            __lexivault: true,
            tab: nextTab,
            overlay: null,
            seq: cur.seq,
          };
          try {
            window.history.replaceState(nextState, "", buildTabUrl(nextTab));
          } catch {
            // ignore
          }
          return;
        }
      }

      if (prevTab === nextTab) return;

      seqRef.current += 1;
      const nextState: LexiHistoryState = {
        __lexivault: true,
        tab: nextTab,
        overlay: null,
        seq: seqRef.current,
      };
      try {
        window.history.pushState(nextState, "", buildTabUrl(nextTab));
      } catch {
        // ignore
      }
    },
    [setActiveTabState]
  );

  const registerOverlay = useCallback(
    (overlayId: string, onBackClose: () => void) => {
      overlaysRef.current.set(overlayId, onBackClose);
      return () => {
        overlaysRef.current.delete(overlayId);
      };
    },
    []
  );

  const openOverlay = useCallback((overlayId: string) => {
    closedByPopRef.current.delete(overlayId);
    if (typeof window === "undefined") return;

    const cur = window.history.state;
    if (isLexiHistoryState(cur) && cur.overlay === overlayId) {
      return;
    }

    seqRef.current += 1;
    const nextState: LexiHistoryState = {
      __lexivault: true,
      tab: activeTabRef.current,
      overlay: overlayId,
      seq: seqRef.current,
    };
    try {
      window.history.pushState(nextState, "", buildTabUrl(activeTabRef.current));
    } catch {
      // ignore
    }
  }, []);

  const closeOverlay = useCallback((overlayId: string) => {
    // If closed via hardware/browser Back, the history entry is already popped
    if (closedByPopRef.current.has(overlayId)) {
      closedByPopRef.current.delete(overlayId);
      return;
    }

    if (typeof window === "undefined") return;
    const cur = window.history.state;
    if (isLexiHistoryState(cur) && cur.overlay === overlayId) {
      try {
        window.history.back();
      } catch {
        // ignore
      }
    }
  }, []);

  return {
    navigateTab,
    registerOverlay,
    openOverlay,
    closeOverlay,
  };
}
