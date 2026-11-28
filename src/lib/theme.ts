export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "lexivault_theme";
export const DEFAULT_THEME: ThemePreference = "dark";
export const THEME_CHANGE_EVENT = "lexivault-theme-change";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "dark" || value === "light" || value === "system";
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") {
    return getSystemTheme();
  }
  return preference;
}

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

const HEADER_THEME_COLORS: Record<ResolvedTheme, string> = {
  dark: "#0B0B0F",
  light: "#FFFFFF",
};

export function applyThemeToDom(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference);
  if (typeof document === "undefined") {
    return resolved;
  }

  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.classList.remove("dark", "light");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;

  const headerColor = HEADER_THEME_COLORS[resolved];
  const themeMetas = document.querySelectorAll('meta[name="theme-color"]');
  themeMetas.forEach((meta) => {
    meta.setAttribute("content", headerColor);
  });

  return resolved;
}

export function setThemePreference(
  preference: ThemePreference,
  emitEvent = true
): ResolvedTheme {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Ignore storage quota or private-browsing errors
    }
  }

  const resolved = applyThemeToDom(preference);

  if (emitEvent && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(THEME_CHANGE_EVENT, {
        detail: { preference, resolved },
      })
    );
  }

  return resolved;
}

export interface ThemeTransitionEventLike {
  clientX?: number;
  clientY?: number;
  currentTarget?: EventTarget | null;
  target?: EventTarget | null;
}

export type ThemeTransitionOrigin =
  | ThemeTransitionEventLike
  | Element
  | null
  | undefined;

interface ViewTransitionLike {
  ready: Promise<void>;
  finished?: Promise<void>;
  skipTransition?: () => void;
}

function getCurrentResolvedTheme(): ResolvedTheme {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") {
      return attr;
    }
  }
  return resolveTheme(getStoredTheme());
}

let activeViewTransition: ViewTransitionLike | null = null;
let activeThemeAnimation: Animation | null = null;

function cancelActiveThemeTransition() {
  if (activeThemeAnimation) {
    try {
      activeThemeAnimation.cancel();
    } catch {
      // Ignore animation cancellation errors
    }
    activeThemeAnimation = null;
  }
  if (activeViewTransition?.skipTransition) {
    try {
      activeViewTransition.skipTransition();
    } catch {
      // Ignore if transition already finished
    }
    activeViewTransition = null;
  }
}

/**
 * Switches theme with a lightweight GPU opacity-only View Transition crossfade
 * (zero clip-path, zero flushSync layout thrash) when supported and reduced motion is off.
 */
export function setThemeWithTransition(
  nextTheme: ThemePreference,
  eventOrElement?: ThemeTransitionOrigin,
  onApply?: (resolved: ResolvedTheme, viaViewTransition: boolean) => void
): ResolvedTheme {
  void eventOrElement;
  const nextResolved = resolveTheme(nextTheme);
  const currentResolved = getCurrentResolvedTheme();

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const startViewTransition =
    typeof document !== "undefined"
      ? (
          document as unknown as {
            startViewTransition?: (
              callback: () => void | Promise<void>
            ) => ViewTransitionLike;
          }
        ).startViewTransition
      : undefined;

  cancelActiveThemeTransition();

  if (
    currentResolved === nextResolved ||
    typeof startViewTransition !== "function" ||
    prefersReducedMotion ||
    typeof window === "undefined"
  ) {
    const resolved = setThemePreference(nextTheme, !onApply);
    onApply?.(resolved, false);
    return resolved;
  }

  let applied = false;
  const apply = () => {
    if (applied) return;
    applied = true;
    const resolved = setThemePreference(nextTheme, !onApply);
    onApply?.(resolved, false);
  };

  const root = document.documentElement;

  try {
    const transition = startViewTransition.call(document, apply);
    activeViewTransition = transition;

    if (transition.finished && typeof transition.finished.finally === "function") {
      transition.finished
        .finally(() => {
          if (activeViewTransition === transition) {
            activeViewTransition = null;
            activeThemeAnimation = null;
          }
        })
        .catch(() => {
          // Ignore AbortError when rapid toggles skip an in-flight transition
        });
    }

    transition.ready
      .then(() => {
        if (activeViewTransition !== transition) return;
        activeThemeAnimation = root.animate(
          {
            opacity: [0, 1],
          },
          {
            duration: 160,
            easing: "ease-out",
            fill: "both",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      })
      .catch(() => {
        // Ignore AbortError when rapid toggles skip an in-flight transition
      });
  } catch {
    cancelActiveThemeTransition();
    apply();
  }

  return nextResolved;
}

/**
 * Synchronous inline script injected into <head> before React hydration
 * to prevent any dark/light flash on initial load or reload.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k="${THEME_STORAGE_KEY}";var s=localStorage.getItem(k);var p=(s==="light"||s==="dark"||s==="system")?s:"${DEFAULT_THEME}";var r=p==="system"?(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;var d=document.documentElement;d.setAttribute("data-theme",r);d.classList.remove("dark","light");d.classList.add(r);d.style.colorScheme=r;var c=r==="light"?"#FFFFFF":"#0B0B0F";var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute("content",c);}catch(e){}})();`;
