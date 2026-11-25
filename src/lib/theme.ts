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

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute(
      "content",
      resolved === "light" ? "#F5F7FB" : "#000000"
    );
  }

  return resolved;
}

export function setThemePreference(preference: ThemePreference): ResolvedTheme {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Ignore storage quota or private-browsing errors
    }
  }

  const resolved = applyThemeToDom(preference);

  if (typeof window !== "undefined") {
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

function getTransitionOrigin(origin?: ThemeTransitionOrigin): {
  x: number;
  y: number;
} {
  const fallback = {
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
  };

  if (!origin) {
    return fallback;
  }

  if (typeof Element !== "undefined" && origin instanceof Element) {
    const rect = origin.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
    return fallback;
  }

  const evt = origin as ThemeTransitionEventLike;
  if (
    typeof evt.clientX === "number" &&
    typeof evt.clientY === "number" &&
    (evt.clientX !== 0 || evt.clientY !== 0)
  ) {
    return { x: evt.clientX, y: evt.clientY };
  }

  const targetEl = evt.currentTarget ?? evt.target;
  if (typeof Element !== "undefined" && targetEl instanceof Element) {
    const rect = targetEl.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
  }

  return fallback;
}

let activeThemeTransitionId = 0;

/**
 * Switches theme with an origin-aware circular View Transition reveal
 * when supported, reduced motion is off, and the resolved theme changes.
 */
export function setThemeWithTransition(
  nextTheme: ThemePreference,
  eventOrElement?: ThemeTransitionOrigin,
  onApply?: (resolved: ResolvedTheme, viaViewTransition: boolean) => void
): ResolvedTheme {
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

  if (
    currentResolved === nextResolved ||
    typeof startViewTransition !== "function" ||
    prefersReducedMotion ||
    typeof window === "undefined"
  ) {
    const resolved = setThemePreference(nextTheme);
    onApply?.(resolved, false);
    return resolved;
  }

  const { x, y } = getTransitionOrigin(eventOrElement);
  const endRadius = Math.ceil(
    Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )
  );

  let applied = false;
  const apply = (viaViewTransition: boolean) => {
    if (applied) return;
    applied = true;
    const resolved = setThemePreference(nextTheme);
    onApply?.(resolved, viaViewTransition);
  };

  const root = document.documentElement;
  const transitionId = ++activeThemeTransitionId;
  const clearTransitionClass = () => {
    if (activeThemeTransitionId === transitionId) {
      root.classList.remove("theme-transitioning");
    }
  };

  root.classList.add("theme-transitioning");

  try {
    const transition = startViewTransition.call(document, () => {
      apply(true);
    });

    if (transition.finished && typeof transition.finished.finally === "function") {
      transition.finished.finally(clearTransitionClass).catch(() => {
        // Ignore AbortError if a rapid follow-up toggle skips this transition
      });
    } else {
      transition.ready
        .then(() => {
          setTimeout(clearTransitionClass, 540);
        })
        .catch(clearTransitionClass);
    }

    transition.ready
      .then(() => {
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 520,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            fill: "both",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      })
      .catch(() => {
        // Ignore AbortError if a rapid follow-up toggle skips this transition
      });
  } catch {
    clearTransitionClass();
    apply(false);
  }

  return nextResolved;
}

/**
 * Synchronous inline script injected into <head> before React hydration
 * to prevent any dark/light flash on initial load or reload.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k="${THEME_STORAGE_KEY}";var s=localStorage.getItem(k);var p=(s==="light"||s==="dark"||s==="system")?s:"${DEFAULT_THEME}";var r=p==="system"?(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;var d=document.documentElement;d.setAttribute("data-theme",r);d.classList.remove("dark","light");d.classList.add(r);d.style.colorScheme=r;}catch(e){}})();`;
