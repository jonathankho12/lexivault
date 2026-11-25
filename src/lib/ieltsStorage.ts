import { isLocalOnlyUserId } from "@/lib/auth";
import {
  addUserXp,
  recordIeltsStudyLog,
  writeLocalCefrOnboarding,
} from "@/lib/storage";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { bandToCefr, roundToHalfBand } from "@/lib/ieltsUtils";

function getScopedSupabase(userId: string) {
  if (isLocalOnlyUserId(userId) || !isSupabaseConfigured()) return null;
  return getSupabaseClient();
}
import type {
  CefrLevel,
  IeltsAttempt,
  IeltsProfile,
  IeltsSkill,
} from "@/types/ielts";
import type { StudyLog } from "@/types/lexivault";

const profileKey = (userId: string) => `lexivault_ielts_profile_v1_${userId}`;
const attemptsKey = (userId: string) => `lexivault_ielts_attempts_v1_${userId}`;

function defaultProfile(userId: string): IeltsProfile {
  return {
    user_id: userId,
    cefr_level: "B1",
    estimated_band: 0,
    reading_band: null,
    listening_band: null,
    writing_band: null,
    speaking_band: null,
    placement_completed: false,
    updated_at: new Date().toISOString(),
  };
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readLocalProfile(userId: string): IeltsProfile {
  if (typeof window === "undefined") return defaultProfile(userId);
  const parsed = safeParse<IeltsProfile>(
    window.localStorage.getItem(profileKey(userId))
  );
  if (!parsed || parsed.user_id !== userId) return defaultProfile(userId);
  return {
    ...defaultProfile(userId),
    ...parsed,
  };
}

function writeLocalProfile(profile: IeltsProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    profileKey(profile.user_id),
    JSON.stringify(profile)
  );
}

function readLocalAttempts(userId: string): IeltsAttempt[] {
  if (typeof window === "undefined") return [];
  const parsed = safeParse<IeltsAttempt[]>(
    window.localStorage.getItem(attemptsKey(userId))
  );
  return Array.isArray(parsed) ? parsed : [];
}

function writeLocalAttempts(userId: string, attempts: IeltsAttempt[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    attemptsKey(userId),
    JSON.stringify(attempts.slice(0, 60))
  );
}

function computeSkillAverage(
  attempts: IeltsAttempt[],
  skill: "reading" | "listening" | "writing" | "speaking",
  fallbackBand: number | null
): number | null {
  const skillAttempts = attempts.filter((a) => a.skill === skill);
  if (skillAttempts.length === 0) return fallbackBand;
  const sum = skillAttempts.reduce((acc, a) => acc + Number(a.band_score), 0);
  return roundToHalfBand(sum / skillAttempts.length);
}

function computeOverallProfileBands(
  prev: IeltsProfile,
  attempts: IeltsAttempt[]
): {
  reading_band: number | null;
  listening_band: number | null;
  writing_band: number | null;
  speaking_band: number | null;
  estimated_band: number;
  cefr_level: CefrLevel;
} {
  const reading_band = computeSkillAverage(attempts, "reading", prev.reading_band);
  const listening_band = computeSkillAverage(
    attempts,
    "listening",
    prev.listening_band
  );
  const writing_band = computeSkillAverage(attempts, "writing", prev.writing_band);
  const speaking_band = computeSkillAverage(
    attempts,
    "speaking",
    prev.speaking_band ?? null
  );

  const validSkills = [
    reading_band,
    listening_band,
    writing_band,
    speaking_band,
  ].filter((v): v is number => v !== null && Number.isFinite(v));

  let estimated_band = prev.estimated_band;
  if (validSkills.length > 0) {
    estimated_band = roundToHalfBand(
      validSkills.reduce((a, b) => a + b, 0) / validSkills.length
    );
  }

  return {
    reading_band,
    listening_band,
    writing_band,
    speaking_band,
    estimated_band,
    cefr_level: bandToCefr(estimated_band),
  };
}

export async function loadIeltsState(userId: string): Promise<{
  profile: IeltsProfile;
  attempts: IeltsAttempt[];
}> {
  const supabase = getScopedSupabase(userId);
  if (supabase) {
    try {
      const [profileRes, attemptsRes] = await Promise.all([
        supabase
          .from("ielts_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("ielts_attempts")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(60),
      ]);

      const profileData = profileRes.data
        ? ({
            ...(profileRes.data as IeltsProfile),
            estimated_band: Number(profileRes.data.estimated_band ?? 0),
            reading_band:
              profileRes.data.reading_band !== null
                ? Number(profileRes.data.reading_band)
                : null,
            listening_band:
              profileRes.data.listening_band !== null
                ? Number(profileRes.data.listening_band)
                : null,
            writing_band:
              profileRes.data.writing_band !== null
                ? Number(profileRes.data.writing_band)
                : null,
            speaking_band:
              profileRes.data.speaking_band !== undefined &&
              profileRes.data.speaking_band !== null
                ? Number(profileRes.data.speaking_band)
                : null,
          } satisfies IeltsProfile)
        : defaultProfile(userId);

      const attemptsData = ((attemptsRes.data as IeltsAttempt[]) ?? []).map(
        (a) => ({
          ...a,
          band_score: Number(a.band_score),
        })
      );

      writeLocalProfile(profileData);
      writeLocalAttempts(userId, attemptsData);

      return { profile: profileData, attempts: attemptsData };
    } catch {
      // Fallback below
    }
  }

  return {
    profile: readLocalProfile(userId),
    attempts: readLocalAttempts(userId),
  };
}

export async function savePlacementCompletion(
  userId: string,
  bandScore: number,
  subBands: {
    reading: number;
    listening?: number | null;
    writing: number;
  },
  details: Record<string, unknown>,
  todayStr: string,
  cefrOverride?: CefrLevel
): Promise<{
  profile: IeltsProfile;
  attempts: IeltsAttempt[];
  updatedLog: StudyLog;
  newXp: number;
}> {
  const nowIso = new Date().toISOString();
  const normalizedBand = roundToHalfBand(bandScore);
  const cefr = cefrOverride ?? bandToCefr(normalizedBand);

  const attemptDraft: IeltsAttempt = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `local-ielts-${Date.now()}`,
    user_id: userId,
    skill: "placement",
    band_score: normalizedBand,
    details_json: details,
    created_at: nowIso,
  };

  const nextProfile: IeltsProfile = {
    user_id: userId,
    cefr_level: cefr,
    estimated_band: normalizedBand,
    reading_band: roundToHalfBand(subBands.reading),
    listening_band:
      subBands.listening !== undefined && subBands.listening !== null
        ? roundToHalfBand(subBands.listening)
        : null,
    writing_band: roundToHalfBand(subBands.writing),
    speaking_band: null,
    placement_completed: true,
    updated_at: nowIso,
  };

  const supabase = getScopedSupabase(userId);
  if (supabase) {
    try {
      await Promise.all([
        supabase.from("ielts_profiles").upsert(nextProfile, {
          onConflict: "user_id",
        }),
        supabase.from("ielts_attempts").insert({
          user_id: userId,
          skill: "placement",
          band_score: normalizedBand,
          details_json: details,
          created_at: nowIso,
        }),
      ]);
    } catch {
      // Fall back to local cache below
    }
  }

  const prevAttempts = readLocalAttempts(userId);
  const nextAttempts = [attemptDraft, ...prevAttempts];
  writeLocalProfile(nextProfile);
  writeLocalAttempts(userId, nextAttempts);
  writeLocalCefrOnboarding(userId, { completed: true, cefrLevel: cefr });

  const xpDelta = 75;
  const updatedLog = await recordIeltsStudyLog(
    todayStr,
    userId,
    10,
    Math.round((normalizedBand / 9) * 10),
    1,
    xpDelta
  );
  const newXp = await addUserXp(userId, xpDelta);

  return {
    profile: nextProfile,
    attempts: nextAttempts,
    updatedLog,
    newXp,
  };
}

export async function saveSkillAttempt(
  userId: string,
  skill: Exclude<IeltsSkill, "placement">,
  bandScore: number,
  details: Record<string, unknown>,
  todayStr: string,
  reviewUnits = 5,
  correctUnits = 4
): Promise<{
  profile: IeltsProfile;
  attempts: IeltsAttempt[];
  updatedLog: StudyLog;
  newXp: number;
}> {
  const nowIso = new Date().toISOString();
  const normalizedBand = roundToHalfBand(bandScore);

  const attemptDraft: IeltsAttempt = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `local-ielts-${Date.now()}`,
    user_id: userId,
    skill,
    band_score: normalizedBand,
    details_json: details,
    created_at: nowIso,
  };

  const currentLocal = await loadIeltsState(userId);
  const nextAttempts = [attemptDraft, ...currentLocal.attempts];
  const computed = computeOverallProfileBands(currentLocal.profile, nextAttempts);

  const nextProfile: IeltsProfile = {
    user_id: userId,
    cefr_level: computed.cefr_level,
    estimated_band: computed.estimated_band,
    reading_band: computed.reading_band,
    listening_band: computed.listening_band,
    writing_band: computed.writing_band,
    speaking_band: computed.speaking_band,
    placement_completed: currentLocal.profile.placement_completed,
    updated_at: nowIso,
  };

  const supabase = getScopedSupabase(userId);
  if (supabase) {
    try {
      await Promise.all([
        supabase.from("ielts_profiles").upsert(nextProfile, {
          onConflict: "user_id",
        }),
        supabase.from("ielts_attempts").insert({
          user_id: userId,
          skill,
          band_score: normalizedBand,
          details_json: details,
          created_at: nowIso,
        }),
      ]);
    } catch {
      // Keep local sync
    }
  }

  writeLocalProfile(nextProfile);
  writeLocalAttempts(userId, nextAttempts);

  const xpDelta = 60;
  const updatedLog = await recordIeltsStudyLog(
    todayStr,
    userId,
    reviewUnits,
    correctUnits,
    1,
    xpDelta
  );
  const newXp = await addUserXp(userId, xpDelta);

  return {
    profile: nextProfile,
    attempts: nextAttempts,
    updatedLog,
    newXp,
  };
}
