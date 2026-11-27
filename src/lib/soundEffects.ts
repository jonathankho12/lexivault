const SFX_MUTE_STORAGE_KEY = "lexivault_sfx_muted_v1";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (isSfxMuted()) return null;

  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;

  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSfxMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SFX_MUTE_STORAGE_KEY) === "true";
}

export function setSfxMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SFX_MUTE_STORAGE_KEY, muted ? "true" : "false");
}

function playTone(
  freq: number,
  durationSec: number,
  type: OscillatorType,
  gainPeak: number,
  delaySec = 0,
  endFreq?: number
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const startAt = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startAt);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, startAt + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(gainPeak, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startAt);
    osc.stop(startAt + durationSec + 0.02);
  } catch {
    // Ignore audio context autoplay or hardware errors
  }
}

export function playGlassClick(): void {
  playTone(980, 0.045, "sine", 0.04, 0, 1320);
}

export function playCorrectChime(combo = 1): void {
  const stepBoost = Math.min(6, Math.max(0, combo - 1)) * 35;
  playTone(587 + stepBoost, 0.14, "triangle", 0.06, 0);
  playTone(880 + stepBoost, 0.22, "sine", 0.075, 0.055);
}

export function playWrongThud(): void {
  playTone(170, 0.14, "sine", 0.07, 0, 95);
}

export function playRingCompleteChord(): void {
  // Warm major9 ascending chord
  playTone(523.25, 0.35, "sine", 0.05, 0);
  playTone(659.25, 0.35, "sine", 0.05, 0.04);
  playTone(783.99, 0.4, "sine", 0.05, 0.08);
  playTone(1046.5, 0.48, "triangle", 0.055, 0.12);
}

/**
 * Gentle, playful micro-SFX when tapping/petting Lexi.
 * Automatically respects the global SFX mute toggle via getAudioContext().
 */
export function playLexiPetSfx(): void {
  playTone(540, 0.065, "sine", 0.036, 0, 740);
  playTone(780, 0.085, "triangle", 0.032, 0.055, 920);
}

/**
 * Joyful ascending chime when giving Lexi a treat.
 * Automatically respects the global SFX mute toggle via getAudioContext().
 */
export function playLexiTreatSfx(): void {
  playTone(587.33, 0.12, "triangle", 0.048, 0);
  playTone(783.99, 0.14, "sine", 0.05, 0.06);
  playTone(1046.5, 0.24, "sine", 0.055, 0.12, 1174.66);
}
