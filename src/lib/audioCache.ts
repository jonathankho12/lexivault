import type { AccentType } from "@/types/lexivault";
import { normalizeTermKey } from "@/lib/utils";

const DB_NAME = "lexivault-audio-db";
const DB_VERSION = 2;
const STORE_NAME = "audio_clips";
const TTS_FETCH_TIMEOUT_MS = 4000;

interface StoredAudioClip {
  key: string;
  blob: Blob;
  remoteUrl?: string | null;
  savedAt: number;
}

export interface AudioPlaybackState {
  playingKey: string | null;
  loadingKey: string | null;
}

const objectUrlCache = new Map<string, string>();
const inFlightRequests = new Map<string, Promise<string | null>>();
const listeners = new Set<(state: AudioPlaybackState) => void>();

let dbPromise: Promise<IDBDatabase | null> | null = null;
let currentAudio: HTMLAudioElement | null = null;
let activePlayRequestId = 0;
let currentState: AudioPlaybackState = {
  playingKey: null,
  loadingKey: null,
};

function notifyListeners() {
  for (const listener of listeners) {
    listener({ ...currentState });
  }
}

function setAudioState(patch: Partial<AudioPlaybackState>) {
  currentState = { ...currentState, ...patch };
  notifyListeners();
}

export function subscribeAudioState(
  listener: (state: AudioPlaybackState) => void
): () => void {
  listeners.add(listener);
  listener({ ...currentState });
  return () => {
    listeners.delete(listener);
  };
}

export function buildAudioKey(text: string, accent: AccentType): string {
  return `${accent}:${normalizeTermKey(text)}`;
}

function openAudioDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        } else if (event.oldVersion < 2 && request.transaction) {
          request.transaction.objectStore(STORE_NAME).clear();
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

async function readClipFromIDB(key: string): Promise<StoredAudioClip | null> {
  const db = await openAudioDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as StoredAudioClip) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeClipToIDB(clip: StoredAudioClip): Promise<void> {
  const db = await openAudioDB();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(clip);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Strictly on-demand audio loader invoked ONLY when the user explicitly clicks a speaker button.
 * Deduplicates concurrent requests per `${accent}:${text}`, caches blobs in memory (+ IndexedDB)
 * for 0ms replays, and enforces a 4s timeout so playback seamlessly falls back to speechSynthesis.
 */
async function fetchAudioOnDemand(options: {
  text: string;
  accent: AccentType;
  remoteUrl?: string | null;
  wordId?: string;
  onRemoteUrlDiscovered?: (url: string) => void;
}): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const cleanText = options.text.trim();
  if (!cleanText) return null;

  const key = buildAudioKey(cleanText, options.accent);

  const memUrl = objectUrlCache.get(key);
  if (memUrl) return memUrl;

  const existingInFlight = inFlightRequests.get(key);
  if (existingInFlight) return existingInFlight;

  const task = (async (): Promise<string | null> => {
    try {
      const idbHit = await readClipFromIDB(key);
      if (idbHit?.blob && idbHit.blob.size > 0) {
        const objUrl = URL.createObjectURL(idbHit.blob);
        objectUrlCache.set(key, objUrl);
        return objUrl;
      }

      let blob: Blob | null = null;
      let discoveredRemoteUrl: string | null = options.remoteUrl ?? null;

      if (options.remoteUrl) {
        try {
          const directRes = await fetchWithTimeout(
            options.remoteUrl,
            undefined,
            TTS_FETCH_TIMEOUT_MS
          );
          if (directRes.ok) {
            const candidate = await directRes.blob();
            if (candidate.size > 0) {
              blob = candidate;
            }
          }
        } catch {
          // Fall through to /api/tts if remote URL fetch fails or times out
        }
      }

      if (!blob) {
        const res = await fetchWithTimeout(
          "/api/tts",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: cleanText,
              accent: options.accent,
              wordId: options.wordId,
            }),
          },
          TTS_FETCH_TIMEOUT_MS
        );

        if (res.ok) {
          const headerUrl = res.headers.get("X-Audio-Url");
          if (headerUrl) {
            discoveredRemoteUrl = headerUrl;
            options.onRemoteUrlDiscovered?.(headerUrl);
          }
          const candidate = await res.blob();
          if (candidate.size > 0) {
            blob = candidate;
          }
        }
      }

      if (!blob) return null;

      const objUrl = URL.createObjectURL(blob);
      objectUrlCache.set(key, objUrl);

      // Persist to IndexedDB in background so playback starts immediately
      void writeClipToIDB({
        key,
        blob,
        remoteUrl: discoveredRemoteUrl,
        savedAt: Date.now(),
      });

      return objUrl;
    } catch {
      return null;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, task);
  return task;
}

/**
 * Fetches (or retrieves from memory / IndexedDB cache) a playable Blob URL
 * via LexiVault's on-demand US/UK TTS endpoint (`/api/tts`).
 */
export async function fetchTtsAudioUrl(
  text: string,
  accent: AccentType
): Promise<string | null> {
  return fetchAudioOnDemand({ text, accent });
}

export function stopPronunciation(): void {
  activePlayRequestId += 1;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore synthesis cancel errors
    }
  }
  setAudioState({ playingKey: null, loadingKey: null });
}

export async function clearPronunciationCache(): Promise<{
  clearedCount: number;
}> {
  stopPronunciation();

  const memCount = objectUrlCache.size;
  objectUrlCache.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore revoke errors
    }
  });
  objectUrlCache.clear();
  inFlightRequests.clear();

  const db = await openAudioDB();
  if (!db) {
    return { clearedCount: memCount };
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const countReq = store.count();
      let total = memCount;
      countReq.onsuccess = () => {
        total = Math.max(memCount, Number(countReq.result) || 0);
        store.clear();
      };
      tx.oncomplete = () => resolve({ clearedCount: total });
      tx.onerror = () => resolve({ clearedCount: memCount });
    } catch {
      resolve({ clearedCount: memCount });
    }
  });
}

function speakWithBrowserFallback(
  text: string,
  accent: AccentType,
  key: string
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    setAudioState({ playingKey: null, loadingKey: null });
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = accent === "UK" ? "en-GB" : "en-US";
    utterance.lang = targetLang;
    utterance.rate = 0.94;

    const voices = window.speechSynthesis.getVoices();
    const targetLower = targetLang.toLowerCase();
    const preferredVoice =
      voices.find(
        (v) =>
          v.lang.toLowerCase() === targetLower &&
          /google|natural|samantha|daniel|aria|libby|jenny|sonia/i.test(v.name)
      ) ||
      voices.find((v) => v.lang.toLowerCase() === targetLower) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(targetLower.slice(0, 5))) ||
      voices.find((v) => v.lang.toLowerCase().startsWith("en"));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
      if (currentState.playingKey === key) {
        setAudioState({ playingKey: null, loadingKey: null });
      }
    };
    utterance.onerror = () => {
      if (currentState.playingKey === key) {
        setAudioState({ playingKey: null, loadingKey: null });
      }
    };

    setAudioState({ loadingKey: null, playingKey: key });
    window.speechSynthesis.speak(utterance);
  } catch {
    setAudioState({ playingKey: null, loadingKey: null });
  }
}

export async function playPronunciation(options: {
  text: string;
  accent: AccentType;
  remoteUrl?: string | null;
  wordId?: string;
  onRemoteUrlDiscovered?: (url: string) => void;
}): Promise<void> {
  if (typeof window === "undefined") return;
  const cleanText = options.text.trim();
  if (!cleanText) return;

  const key = buildAudioKey(cleanText, options.accent);

  // Prevent duplicate concurrent requests if user clicks the same loading speaker button
  if (currentState.loadingKey === key) {
    return;
  }

  const wasSamePlaying = currentState.playingKey === key;
  stopPronunciation();
  if (wasSamePlaying) {
    return;
  }

  const requestId = activePlayRequestId;
  const cachedMemUrl = objectUrlCache.get(key);
  if (!cachedMemUrl) {
    setAudioState({ loadingKey: key, playingKey: null });
  }

  const url = cachedMemUrl ?? (await fetchAudioOnDemand(options));

  // Ignore stale completion if user clicked another button or stopped playback
  if (requestId !== activePlayRequestId) {
    return;
  }

  if (!url) {
    // Seamless fallback to browser speechSynthesis when /api/tts fails or exceeds 4s
    speakWithBrowserFallback(cleanText, options.accent, key);
    return;
  }

  const audio = new Audio(url);
  currentAudio = audio;

  audio.onended = () => {
    if (currentAudio === audio) {
      currentAudio = null;
    }
    if (currentState.playingKey === key) {
      setAudioState({ playingKey: null, loadingKey: null });
    }
  };

  audio.onerror = () => {
    if (currentAudio === audio) {
      currentAudio = null;
    }
    if (requestId === activePlayRequestId) {
      speakWithBrowserFallback(cleanText, options.accent, key);
    }
  };

  try {
    setAudioState({ loadingKey: null, playingKey: key });
    await audio.play();
  } catch {
    if (requestId === activePlayRequestId) {
      speakWithBrowserFallback(cleanText, options.accent, key);
    }
  }
}
