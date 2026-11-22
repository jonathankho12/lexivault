import type { User } from "@supabase/supabase-js";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  setRememberMePreference,
} from "@/lib/supabase";
import type { AuthUser } from "@/types/lexivault";

const LOCAL_USERS_KEY = "lexivault_local_users_v1";
const LOCAL_SESSION_KEY = "lexivault_local_session_v1";
const GUEST_DEVICE_ID_KEY = "lexivault_guest_device_id_v1";
const GUEST_USER_ID_PREFIX = "guest-local-";

export function isGuestUserId(userId: string): boolean {
  return userId.startsWith(GUEST_USER_ID_PREFIX);
}

export function isLocalOnlyUserId(userId: string): boolean {
  return (
    userId.startsWith(GUEST_USER_ID_PREFIX) ||
    userId.startsWith("local-user-")
  );
}

interface LocalUserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const clean = normalizeUsername(raw);
  if (clean.length < 3 || clean.length > 24) {
    return "Username harus 3–24 karakter.";
  }
  if (!/^[a-z0-9._-]+$/.test(clean)) {
    return "Username hanya boleh berisi huruf kecil, angka, titik, underscore, atau strip.";
  }
  return null;
}

export function usernameToInternalEmail(username: string): string {
  return `${normalizeUsername(username)}@lexivault.app`;
}

async function hashPassword(password: string): Promise<string> {
  if (
    typeof window !== "undefined" &&
    window.crypto?.subtle &&
    typeof TextEncoder !== "undefined"
  ) {
    const encoded = new TextEncoder().encode(`lexivault:${password}`);
    const digest = await window.crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  let hash = 2166136261;
  for (let i = 0; i < password.length; i++) {
    hash ^= password.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv-${(hash >>> 0).toString(16)}`;
}

function readLocalUsers(): LocalUserRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalUserRecord[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse error
  }
  return [];
}

function getOrCreateGuestDeviceId(): string {
  if (typeof window === "undefined") {
    return `${GUEST_USER_ID_PREFIX}default`;
  }
  const existing = window.localStorage.getItem(GUEST_DEVICE_ID_KEY);
  if (existing && existing.startsWith(GUEST_USER_ID_PREFIX)) {
    return existing;
  }

  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
  const created = `${GUEST_USER_ID_PREFIX}${randomPart}`;
  window.localStorage.setItem(GUEST_DEVICE_ID_KEY, created);
  return created;
}

export function continueAsGuestSession(): AuthUser {
  const id = getOrCreateGuestDeviceId();
  const guestUser: AuthUser = {
    id,
    username: "tamu",
    email: `${id}@guest.local`,
    provider: "guest",
  };
  writeLocalSession(guestUser, true);
  return guestUser;
}

function readLocalSession(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.sessionStorage.getItem(LOCAL_SESSION_KEY) ??
      window.localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed && parsed.id && parsed.username) {
      return parsed;
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

function writeLocalSession(user: AuthUser, rememberMe: boolean): void {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(user);
  if (rememberMe) {
    window.localStorage.setItem(LOCAL_SESSION_KEY, serialized);
    window.sessionStorage.removeItem(LOCAL_SESSION_KEY);
  } else {
    window.sessionStorage.setItem(LOCAL_SESSION_KEY, serialized);
    window.localStorage.removeItem(LOCAL_SESSION_KEY);
  }
}

function clearLocalSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LOCAL_SESSION_KEY);
  window.sessionStorage.removeItem(LOCAL_SESSION_KEY);
}

function mapSupabaseUser(sbUser: User): AuthUser {
  const metaUsername =
    typeof sbUser.user_metadata?.username === "string"
      ? sbUser.user_metadata.username
      : "";
  const emailUsername = (sbUser.email ?? "").split("@")[0] || "user";
  return {
    id: sbUser.id,
    username: normalizeUsername(metaUsername || emailUsername),
    email: sbUser.email ?? usernameToInternalEmail(emailUsername),
    provider: "supabase",
  };
}

export async function getCurrentSessionUser(): Promise<AuthUser | null> {
  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session?.user) {
        return mapSupabaseUser(data.session.user);
      }
    } catch {
      // Check local guest session below
    }
    const localSession = readLocalSession();
    return localSession?.provider === "guest" ? localSession : null;
  }

  return readLocalSession();
}

export async function signInWithUsername(
  rawUsername: string,
  password: string,
  rememberMe: boolean
): Promise<{ user?: AuthUser; error?: string }> {
  const usernameErr = validateUsername(rawUsername);
  if (usernameErr) return { error: usernameErr };
  if (password.length < 6) {
    return { error: "Password minimal 6 karakter." };
  }

  const username = normalizeUsername(rawUsername);
  const email = usernameToInternalEmail(username);
  setRememberMePreference(rememberMe);

  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured()) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.toLowerCase().includes("invalid login")) {
        return { error: "Username atau password salah." };
      }
      return { error: error.message };
    }

    if (!data.user) {
      return { error: "Gagal memuat sesi pengguna." };
    }

    clearLocalSession();
    return { user: mapSupabaseUser(data.user) };
  }

  // Local fallback multi-user auth
  const users = readLocalUsers();
  const target = users.find((u) => u.username === username);
  if (!target) {
    return {
      error: `Akun @${username} belum terdaftar di perangkat ini. Silakan buka tab Daftar Akun.`,
    };
  }

  const candidateHash = await hashPassword(password);
  if (candidateHash !== target.passwordHash) {
    return { error: "Password salah." };
  }

  const authUser: AuthUser = {
    id: target.id,
    username: target.username,
    email: target.email,
    provider: "local",
  };
  writeLocalSession(authUser, rememberMe);
  return { user: authUser };
}

export async function signUpWithUsername(
  rawUsername: string,
  password: string,
  rememberMe: boolean
): Promise<{ user?: AuthUser; error?: string }> {
  const usernameErr = validateUsername(rawUsername);
  if (usernameErr) return { error: usernameErr };
  if (password.length < 6) {
    return { error: "Password minimal 6 karakter." };
  }

  const username = normalizeUsername(rawUsername);
  const email = usernameToInternalEmail(username);
  setRememberMePreference(rememberMe);

  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured()) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes("already registered")) {
        return { error: `Username @${username} sudah digunakan.` };
      }
      return { error: error.message };
    }

    if (data.user && !data.session) {
      return {
        error:
          "Akun dibuat, namun Supabase Auth masih mengaktifkan 'Confirm email'. Matikan 'Confirm email' di Supabase Dashboard → Authentication → Providers → Email agar login langsung aktif tanpa verifikasi email.",
      };
    }

    if (!data.user) {
      return { error: "Gagal membuat akun baru." };
    }

    clearLocalSession();
    return { user: mapSupabaseUser(data.user) };
  }

  // Local fallback multi-user registration
  const users = readLocalUsers();
  if (users.some((u) => u.username === username)) {
    return { error: `Username @${username} sudah terdaftar.` };
  }

  const newRecord: LocalUserRecord = {
    id: `local-user-${username}`,
    username,
    email,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  window.localStorage.setItem(
    LOCAL_USERS_KEY,
    JSON.stringify([...users, newRecord])
  );

  const authUser: AuthUser = {
    id: newRecord.id,
    username: newRecord.username,
    email: newRecord.email,
    provider: "local",
  };
  writeLocalSession(authUser, rememberMe);
  return { user: authUser };
}

export async function changeUserPassword(
  user: AuthUser,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (user.provider === "guest") {
    return { ok: false, error: "Mode Tamu tidak menggunakan password." };
  }
  if (newPassword.length < 6) {
    return { ok: false, error: "Password baru minimal 6 karakter." };
  }

  if (user.provider === "supabase") {
    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured()) {
      return { ok: false, error: "Supabase Auth tidak tersedia." };
    }
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Gagal mengubah password Cloud." };
    }
  }

  // Local multi-user password update
  if (typeof window === "undefined") {
    return { ok: false, error: "Penyimpanan lokal tidak tersedia." };
  }
  const users = readLocalUsers();
  const idx = users.findIndex(
    (u) => u.id === user.id || u.username === user.username
  );
  if (idx === -1) {
    return { ok: false, error: "Akun lokal tidak ditemukan di perangkat ini." };
  }

  const nextHash = await hashPassword(newPassword);
  const updatedUsers = [...users];
  updatedUsers[idx] = {
    ...updatedUsers[idx],
    passwordHash: nextHash,
  };
  window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updatedUsers));
  return { ok: true };
}

export async function signOutUser(): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured()) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore signout error
    }
  }
  clearLocalSession();
}

export function subscribeAuthChanges(
  callback: (user: AuthUser | null) => void
): () => void {
  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured()) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        clearLocalSession();
        callback(mapSupabaseUser(session.user));
        return;
      }
      const localSession = readLocalSession();
      callback(localSession?.provider === "guest" ? localSession : null);
    });
    return () => {
      subscription.unsubscribe();
    };
  }

  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === LOCAL_SESSION_KEY) {
      callback(readLocalSession());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
  };
}
