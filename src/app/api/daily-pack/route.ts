import { NextResponse } from "next/server";
import { Type, type Schema } from "@google/genai";
import { BUILT_IN_ENGLISH_MEANINGS } from "@/lib/bilingualCache";
import { pickFallbackDailyPack } from "@/lib/dailyPackFallback";
import {
  getDailyPackTierMeta,
  isValidDailyPackTargetTier,
} from "@/lib/dailyPackTiers";
import {
  CEFR_CALIBRATION_RULE,
  classifyGeminiError,
  formatCompactExistingTerms,
  generateStructuredWithHybridModel,
  logGeminiRouteError,
  REGISTER_CLASSIFICATION_RULE,
  type HybridModelResult,
  type ProviderAttemptFailure,
} from "@/lib/gemini";
import { BUILT_IN_PRONUNCIATIONS } from "@/lib/pronunciation";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { getLocalDateString, normalizeTermKey } from "@/lib/utils";
import type {
  CefrLevel,
  DailyPackItem,
  DailyPackTargetTier,
  RegisterType,
  WordExample,
  WordFamilyItem,
} from "@/types/lexivault";

// Strict per-provider timeout budgets for each small parallel batch (<= 5 items each).
// Worst-case server fallback budget: Gemini (10s) + Groq (10s) + CF Workers AI (10s) = 30s.
const DAILY_PACK_GEMINI_TIMEOUT_MS = 10_000;
const DAILY_PACK_FALLBACK_TIMEOUT_MS = 10_000;
const MAX_DAILY_PACK_BATCH_SIZE = 5;

interface TierPromptSpec {
  vocabThemes: readonly string[];
  idiomThemes: readonly string[];
  vocabGuide: string;
  idiomGuide: string;
  exampleStyle: string;
  systemRole: string;
}

const TIER_PROMPT_SPECS: Record<DailyPackTargetTier, TierPromptSpec> = {
  "A1-A2": {
    vocabThemes: [
      "daily routines, home, and family life",
      "food, shopping, and everyday errands",
      "travel, directions, and basic transport",
      "work, school, and simple hobbies",
      "feelings, weather, and describing people",
      "health, time, and common everyday actions",
    ],
    idiomThemes: [
      "common everyday basic phrasal verbs (e.g. wake up, look for, get ready)",
      "simple daily expressions for greetings, plans, and polite speech",
      "basic travel, shopping, and routine phrases",
      "everyday feelings and simple conversations",
    ],
    vocabGuide:
      "practical high-frequency A1-A2 single English word (everyday essential vocabulary; strictly NO obscure, literary, or C1-C2 words)",
    idiomGuide:
      "common everyday A1-A2 basic phrasal verb or practical expression (e.g. 'look for', 'get along', 'right away', 'take care'; strictly NO obscure C1-C2 idioms)",
    exampleStyle: "1 short, simple everyday sentence (8-14 words) with **bold** target term",
    systemRole:
      "Ultra-fast A1-A2 beginner English-Indonesian lexicographer. Use simple, clear, practical language. Return compact valid JSON only with zero duplicates.",
  },
  "A2-B1": {
    vocabThemes: [
      "everyday communication, plans, and social life",
      "workplace basics, study habits, and goals",
      "travel experiences, culture, and city life",
      "health, lifestyle, and personal well-being",
      "technology, media, and online habits",
      "shopping, money, and practical decisions",
    ],
    idiomThemes: [
      "useful everyday phrasal verbs and social expressions",
      "work, study, and time-management expressions",
      "emotions, agreement, and everyday conversation phrases",
      "travel, plans, and solving small daily problems",
    ],
    vocabGuide:
      "practical A2-B1 single English vocabulary word useful in daily conversation, work, or study (no rare C2 words)",
    idiomGuide:
      "common A2-B1 phrasal verb or everyday idiomatic expression heard in daily speech and workplace chats",
    exampleStyle: "1 clear natural sentence (10-16 words) with **bold** target term",
    systemRole:
      "Ultra-fast A2-B1 English-Indonesian lexicographer. Keep definitions clear and practical. Return compact valid JSON only with zero duplicates.",
  },
  "B1-B2": {
    vocabThemes: [
      "workplace collaboration, projects, and communication",
      "media, technology, and modern society",
      "opinions, arguments, and everyday problem-solving",
      "education, career growth, and productivity",
      "environment, travel, and urban life",
      "psychology, relationships, and decision-making",
    ],
    idiomThemes: [
      "workplace teamwork, deadlines, and problem-solving idioms",
      "everyday conversation, opinions, and social nuance",
      "change, progress, and handling challenges",
      "communication, honesty, and practical habits",
    ],
    vocabGuide:
      "useful B1-B2 single English vocabulary word for confident workplace, media, and IELTS Band 5.5-6.5 communication",
    idiomGuide:
      "natural B1-B2 English idiom or phrasal expression commonly used by native speakers in conversation and work",
    exampleStyle: "1 crisp, natural sentence with **bold** target term",
    systemRole:
      "Ultra-fast B1-B2 English-Indonesian lexicographer. Return compact valid JSON only with zero duplicates and concise text.",
  },
  "B2-C1": {
    vocabThemes: [
      "professional strategy, leadership, and analysis",
      "academic writing, research, and critical thinking",
      "economics, policy, and societal trends",
      "science, innovation, and digital transformation",
      "persuasion, negotiation, and nuanced expression",
      "culture, literature, and complex human behavior",
    ],
    idiomThemes: [
      "workplace strategy, persuasion, and decision-making",
      "nuanced conversation, diplomacy, and resilience",
      "change, risk, and unexpected outcomes",
      "debate, evaluation, and subtle emphasis",
    ],
    vocabGuide:
      "precise B2-C1 single English vocabulary word for professional, academic, and IELTS Band 6.5-8.0 discourse",
    idiomGuide:
      "nuanced B2-C1 English idiom or figurative phrasal expression used in educated speech and journalism",
    exampleStyle: "1 crisp, natural sentence with **bold** target term",
    systemRole:
      "Ultra-fast B2-C1 English-Indonesian lexicographer. Return compact valid JSON only with zero duplicates and concise text.",
  },
  "C1-C2": {
    vocabThemes: [
      "academic, analytical, and formal discourse",
      "expressive, nuanced, and everyday high-level speech",
      "leadership, persuasion, and strategic thinking",
      "science, innovation, and social dynamics",
      "literature, emotion, and critical observation",
      "economics, policy, and global affairs",
    ],
    idiomThemes: [
      "workplace, decision-making, and problem-solving",
      "everyday conversation, emotions, and relationships",
      "persuasion, strategy, and resilience",
      "time, change, and unexpected outcomes",
    ],
    vocabGuide: "single C1-C2 advanced English word",
    idiomGuide: "opaque/figurative C1-C2 English idiom or phrasal expression",
    exampleStyle: "1 short sentence with **bold** target term",
    systemRole:
      "Ultra-fast C1-C2 English-Indonesian lexicographer. Return compact valid JSON only with zero duplicates and concise text.",
  },
};

interface DailyPackBatchSpec {
  batchId: string;
  batchType: "vocab" | "idiom";
  count: number;
  themeHint: string;
}

function buildDailyPackBatches(
  wordsQuota: number,
  idiomsQuota: number,
  targetTier: DailyPackTargetTier
): DailyPackBatchSpec[] {
  const batches: DailyPackBatchSpec[] = [];
  const tierSpec = TIER_PROMPT_SPECS[targetTier];

  let remainingWords = wordsQuota;
  let vocabIdx = 0;
  while (remainingWords > 0) {
    const count = Math.min(MAX_DAILY_PACK_BATCH_SIZE, remainingWords);
    batches.push({
      batchId: `vocab-${vocabIdx + 1}`,
      batchType: "vocab",
      count,
      themeHint: tierSpec.vocabThemes[vocabIdx % tierSpec.vocabThemes.length],
    });
    remainingWords -= count;
    vocabIdx += 1;
  }

  let remainingIdioms = idiomsQuota;
  let idiomIdx = 0;
  while (remainingIdioms > 0) {
    const count = Math.min(MAX_DAILY_PACK_BATCH_SIZE, remainingIdioms);
    batches.push({
      batchId: `idiom-${idiomIdx + 1}`,
      batchType: "idiom",
      count,
      themeHint: tierSpec.idiomThemes[idiomIdx % tierSpec.idiomThemes.length],
    });
    remainingIdioms -= count;
    idiomIdx += 1;
  }

  return batches;
}

const VALID_REGISTERS = new Set<RegisterType>([
  "Formal",
  "Academic",
  "Casual",
  "Slang",
]);

type RawDailyPackItem = Partial<DailyPackItem> & {
  phonetic?: string;
  example?: string;
  example_en?: string;
  example_id?: string;
};

function buildDailyPackSchema(cefrPair: [CefrLevel, CefrLevel]): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            term: { type: Type.STRING },
            pronunciation: { type: Type.STRING },
            ipa: { type: Type.STRING },
            cefr: { type: Type.STRING, enum: cefrPair },
            register: {
              type: Type.STRING,
              enum: ["Academic", "Formal", "Casual"],
            },
            meaning_en: { type: Type.STRING },
            meaning_id: { type: Type.STRING },
            example_en: { type: Type.STRING },
            example_id: { type: Type.STRING },
            synonyms: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            "term",
            "pronunciation",
            "ipa",
            "cefr",
            "register",
            "meaning_en",
            "meaning_id",
            "example_en",
            "example_id",
            "synonyms",
          ],
        },
      },
    },
    required: ["items"],
  };
}

function clampInt(
  val: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const num = typeof val === "number" ? Math.round(val) : Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function normalizeDailyPackItem(
  raw: RawDailyPackItem,
  dateStr: string,
  index: number,
  cefrPair: [CefrLevel, CefrLevel],
  forcedType?: "vocab" | "idiom"
): DailyPackItem | null {
  const term = (raw.term || "").trim();
  if (!term) return null;

  const key = normalizeTermKey(term);
  const builtInPron = BUILT_IN_PRONUNCIATIONS[key];
  const builtInBilingual = BUILT_IN_ENGLISH_MEANINGS[key];

  const type: "vocab" | "idiom" =
    forcedType ??
    (raw.type === "idiom" || term.split(/\s+/).length >= 2 ? "idiom" : "vocab");
  const register: RegisterType =
    raw.register && VALID_REGISTERS.has(raw.register)
      ? raw.register
      : type === "idiom"
        ? "Casual"
        : cefrPair[0] === "A1" || cefrPair[0] === "A2"
          ? "Casual"
          : "Academic";
  const cefr: CefrLevel =
    raw.cefr === cefrPair[1] ? cefrPair[1] : cefrPair[0];
  const defaultContext = register === "Academic" ? "Academic" : "Daily";

  const examples: WordExample[] = [];
  if (typeof raw.example_en === "string" && raw.example_en.trim().length >= 8) {
    examples.push({
      sentence: raw.example_en.trim(),
      translation_id: (raw.example_id || "").trim(),
      context: defaultContext,
    });
  } else if (Array.isArray(raw.examples)) {
    for (const [idx, ex] of raw.examples.slice(0, 2).entries()) {
      if (ex && typeof ex.sentence === "string" && ex.sentence.trim()) {
        examples.push({
          sentence: ex.sentence.trim(),
          translation_id: (ex.translation_id || "").trim(),
          context: ex.context || (idx === 0 ? "Daily" : "Academic"),
        });
      }
    }
  } else if (
    typeof raw.example === "string" &&
    raw.example.trim().length >= 8
  ) {
    examples.push({
      sentence: raw.example.trim(),
      translation_id: "",
      context: defaultContext,
    });
  }

  const meaning_en =
    (raw.meaning_en || "").trim() || builtInBilingual?.meaning_en || "";
  const meaning_id = (raw.meaning_id || "").trim();

  // Never emit placeholder definitions or dummy examples
  if (meaning_en.length < 4 || meaning_id.length < 4 || examples.length === 0) {
    return null;
  }

  const word_families: WordFamilyItem[] =
    type === "idiom"
      ? []
      : Array.isArray(raw.word_families)
        ? raw.word_families
            .filter((wf) => wf && typeof wf.word === "string" && wf.word.trim())
            .slice(0, 4)
            .map((wf) => ({
              word: wf.word.trim(),
              pos: (wf.pos || type).trim(),
            }))
        : [];

  return {
    id: `${dateStr}-ai-${type}-${index}-${key
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 24)}`,
    term,
    pronunciation:
      (raw.pronunciation || raw.phonetic || "").trim() ||
      builtInPron?.pronunciation ||
      undefined,
    ipa: (raw.ipa || "").trim() || builtInPron?.ipa || undefined,
    cefr,
    type,
    meaning_en,
    meaning_id,
    examples,
    synonyms: Array.isArray(raw.synonyms)
      ? raw.synonyms.map((s) => String(s).trim()).filter(Boolean).slice(0, 4)
      : [],
    antonyms: Array.isArray(raw.antonyms)
      ? raw.antonyms.map((s) => String(s).trim()).filter(Boolean).slice(0, 3)
      : [],
    word_families,
    register,
    source_tag: "daily_pack",
  };
}

function interleavePack(
  words: DailyPackItem[],
  idioms: DailyPackItem[]
): DailyPackItem[] {
  const combined: DailyPackItem[] = [];
  let wIdx = 0;
  let iIdx = 0;
  while (wIdx < words.length || iIdx < idioms.length) {
    for (let k = 0; k < 2 && wIdx < words.length; k += 1) {
      combined.push(words[wIdx++]);
    }
    if (iIdx < idioms.length) {
      combined.push(idioms[iIdx++]);
    }
  }
  return combined;
}

async function generateDailyPackBatch(params: {
  batchId: string;
  batchType: "vocab" | "idiom";
  count: number;
  themeHint: string;
  dateStr: string;
  existingCsv: string;
  targetTier: DailyPackTargetTier;
}): Promise<HybridModelResult<{ items?: RawDailyPackItem[] }>> {
  const {
    batchId,
    batchType,
    count,
    themeHint,
    dateStr,
    existingCsv,
    targetTier,
  } = params;
  const tierMeta = getDailyPackTierMeta(targetTier);
  const tierSpec = TIER_PROMPT_SPECS[targetTier];
  const [lowCefr, highCefr] = tierMeta.cefrPair;
  const isIdiom = batchType === "idiom";
  const label = isIdiom
    ? `EXACTLY ${count} ${targetTier} English idioms/phrasal expressions`
    : `EXACTLY ${count} ${targetTier} single English vocabulary words`;

  const prompt = `Daily Pack (${dateStr}, ${batchId}, Tier ${targetTier} — ${tierMeta.nameEn}): generate ${label} focused on ${themeHint}.
EXCLUDE: ${existingCsv}
${CEFR_CALIBRATION_RULE}
${REGISTER_CLASSIFICATION_RULE}

Return compact JSON {items:[...]} strictly calibrated to ${targetTier} learners:
- term: ${isIdiom ? tierSpec.idiomGuide : tierSpec.vocabGuide}
- pronunciation: "·" syllable dots + ALL CAPS primary stress
- ipa: /.../
- cefr: "${lowCefr}" or "${highCefr}" ONLY (strictly matched to Cambridge EVP / Oxford 3000/5000 for ${targetTier})
- register: ${isIdiom ? '"Casual", "Formal", or "Academic"' : '"Casual", "Formal", or "Academic"'}
- meaning_en: 1 short, clear English definition appropriate for ${targetTier} learners
- meaning_id: 1 natural Indonesian definition
- example_en: ${tierSpec.exampleStyle}
- example_id: natural Indonesian translation of example_en
- synonyms: 2 concise synonyms at ${targetTier} level`;

  return generateStructuredWithHybridModel<{ items?: RawDailyPackItem[] }>({
    tier: "flash",
    routeName: `api/daily-pack:${targetTier}:${batchId}`,
    systemInstruction: tierSpec.systemRole,
    contents: prompt,
    maxOutputTokens: Math.min(2200, Math.max(1300, count * (isIdiom ? 280 : 260))),
    fallbackMaxTokens: Math.min(2000, Math.max(1200, count * (isIdiom ? 260 : 240))),
    temperature: 0.65,
    timeoutMs: DAILY_PACK_GEMINI_TIMEOUT_MS,
    fallbackTimeoutMs: DAILY_PACK_FALLBACK_TIMEOUT_MS,
    validate: (parsed) =>
      Array.isArray(parsed.items) &&
      parsed.items.some(
        (it, idx) =>
          normalizeDailyPackItem(
            it,
            dateStr,
            idx,
            tierMeta.cefrPair,
            batchType
          ) !== null
      )
        ? null
        : `no valid complete daily-pack ${batchId} items`,
    responseSchema: buildDailyPackSchema(tierMeta.cefrPair),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      date?: string;
      wordsQuota?: number;
      idiomsQuota?: number;
      targetTier?: DailyPackTargetTier;
      existingTerms?: string[];
      lang?: "en" | "id";
    };

    const dateStr =
      typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : getLocalDateString();
    const wordsQuota = clampInt(body.wordsQuota, 0, 30, 10);
    const idiomsQuota = clampInt(body.idiomsQuota, 0, 20, 5);
    const targetTier: DailyPackTargetTier = isValidDailyPackTargetTier(
      body.targetTier
    )
      ? body.targetTier
      : "B1-B2";
    const tierMeta = getDailyPackTierMeta(targetTier);
    const totalNeeded = wordsQuota + idiomsQuota;

    if (totalNeeded === 0) {
      return NextResponse.json({
        pack_date: dateStr,
        words_quota: 0,
        idioms_quota: 0,
        target_tier: targetTier,
        items: [],
        source: "fallback",
      });
    }

    const lang = body.lang === "en" ? "en" : "id";
    const rateLimit = checkAiRateLimit(request, lang, {
      bucket: "daily-pack",
      limit: 10,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const rawExisting = Array.isArray(body.existingTerms)
      ? body.existingTerms
          .map((t) => String(t).trim())
          .filter(Boolean)
          .slice(0, 250)
      : [];
    const excludeKeys = new Set(rawExisting.map(normalizeTermKey));
    const existingCsv = formatCompactExistingTerms(rawExisting, 60);

    // Split into small fast parallel batches of <= 5 items (e.g., 5+5 words + 5 idioms)
    // so every LLM call finishes quickly within Cloudflare Workers limits.
    const batchSpecs = buildDailyPackBatches(
      wordsQuota,
      idiomsQuota,
      targetTier
    );
    const batchResults = await Promise.all(
      batchSpecs.map(async (spec) => ({
        spec,
        res: await generateDailyPackBatch({
          batchId: spec.batchId,
          batchType: spec.batchType,
          count: spec.count,
          themeHint: spec.themeHint,
          dateStr,
          existingCsv,
          targetTier,
        }),
      }))
    );

    const anySucceeded = batchResults.some(({ res }) => res.ok);

    if (!anySucceeded) {
      const failedResults = batchResults.filter(
        (
          entry
        ): entry is {
          spec: DailyPackBatchSpec;
          res: Extract<
            HybridModelResult<{ items?: RawDailyPackItem[] }>,
            { ok: false }
          >;
        } => !entry.res.ok
      );

      const primaryFailure = failedResults[0]?.res.error;
      const allProviderFailures: Array<
        ProviderAttemptFailure & { batch: string }
      > = failedResults.flatMap(({ spec, res }) =>
        (res.providerFailures ?? []).map((f) => ({ ...f, batch: spec.batchId }))
      );

      console.error(
        "[LexiVault][api/daily-pack] All AI providers failed across parallel batches:",
        allProviderFailures.map((f) => ({
          batch: f.batch,
          provider: f.provider,
          status: f.status,
          message: f.message,
          model: f.model,
          timeout: f.timeout,
          code: f.code,
          reason: f.reason,
          elapsedMs: f.elapsedMs,
        }))
      );

      const err =
        primaryFailure ??
        classifyGeminiError(new Error("Daily Pack AI generation failed"));
      return NextResponse.json(
        {
          error: err.detail,
          code: err.code,
          detail: err.rawMessage,
          upstreamStatus: err.upstreamStatus,
          providerFailures: allProviderFailures.map((f) => ({
            batch: f.batch,
            provider: f.provider,
            status: f.status,
            message: f.message,
            timeout: f.timeout,
            code: f.code,
            reason: f.reason,
          })),
        },
        { status: err.status }
      );
    }

    const seenKeys = new Set<string>(excludeKeys);
    const pickedWords: DailyPackItem[] = [];
    const pickedIdioms: DailyPackItem[] = [];
    let wordCounter = 0;
    let idiomCounter = 0;

    for (const { spec, res } of batchResults) {
      if (!res.ok || !Array.isArray(res.data.items)) continue;
      for (const rawItem of res.data.items) {
        if (spec.batchType === "vocab" && pickedWords.length >= wordsQuota) {
          break;
        }
        if (spec.batchType === "idiom" && pickedIdioms.length >= idiomsQuota) {
          break;
        }
        const itemIndex =
          spec.batchType === "vocab" ? wordCounter++ : idiomCounter++;
        const normalized = normalizeDailyPackItem(
          rawItem,
          dateStr,
          itemIndex,
          tierMeta.cefrPair,
          spec.batchType
        );
        if (!normalized) continue;
        const key = normalizeTermKey(normalized.term);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        if (spec.batchType === "vocab") pickedWords.push(normalized);
        else pickedIdioms.push(normalized);
      }
    }

    // If any batch failed or produced fewer unique items after deduplication, top up the remaining slots
    const missingWords = Math.max(0, wordsQuota - pickedWords.length);
    const missingIdioms = Math.max(0, idiomsQuota - pickedIdioms.length);
    if (missingWords > 0 || missingIdioms > 0) {
      const topUp = pickFallbackDailyPack(
        dateStr,
        missingWords,
        missingIdioms,
        seenKeys,
        targetTier
      );
      for (const item of topUp) {
        if (item.type === "vocab") pickedWords.push(item);
        else pickedIdioms.push(item);
      }
    }

    const modelsUsed = Array.from(
      new Set(
        batchResults
          .map(({ res }) => (res.ok ? res.modelUsed : null))
          .filter(Boolean) as string[]
      )
    );
    const providersUsed = Array.from(
      new Set(
        batchResults
          .map(({ res }) => (res.ok ? res.providerUsed : null))
          .filter(Boolean) as string[]
      )
    );

    const finalItems = interleavePack(pickedWords, pickedIdioms);
    return NextResponse.json({
      pack_date: dateStr,
      words_quota: wordsQuota,
      idioms_quota: idiomsQuota,
      target_tier: targetTier,
      items: finalItems,
      source: "gemini",
      modelUsed: modelsUsed.join(", "),
      providersUsed,
    });
  } catch (err) {
    const classified = classifyGeminiError(err);
    logGeminiRouteError("api/daily-pack", classified);
    return NextResponse.json(
      {
        error: classified.detail,
        code: classified.code,
        detail: classified.rawMessage,
        upstreamStatus: classified.upstreamStatus,
      },
      { status: classified.status }
    );
  }
}
