import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
const REMEMBER_ME_KEY = "lexivault_remember_me_v1";

let cachedClient: SupabaseClient | null = null;

export function getRememberMePreference(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(REMEMBER_ME_KEY) !== "false";
}

export function setRememberMePreference(remember: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMEMBER_ME_KEY, remember ? "true" : "false");
}

const adaptiveAuthStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      return (
        window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key)
      );
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
      if (getRememberMePreference()) {
        window.localStorage.setItem(key, value);
        window.sessionStorage.removeItem(key);
      } else {
        window.sessionStorage.setItem(key, value);
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage quota errors
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(key);
      window.localStorage.removeItem(key);
    } catch {
      // Ignore cleanup errors
    }
  },
};

export function isSupabaseConfigured(): boolean {
  return (
    supabaseUrl.length > 0 &&
    supabaseAnonKey.length > 0 &&
    (supabaseUrl.startsWith("https://") || supabaseUrl.startsWith("http://"))
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: adaptiveAuthStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return cachedClient;
}
