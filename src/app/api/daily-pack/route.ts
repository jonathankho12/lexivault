import { NextResponse } from "next/server";
import { Type, type Schema } from "@google/genai";
import { BUILT_IN_ENGLISH_MEANINGS } from "@/lib/bilingualCache";
import { pickFallbackDailyPack } from "@/lib/dailyPackFallback";
import {
  classifyGeminiError,
  formatCompactExistingTerms,
  generateStructuredWithHybridModel,
  logGeminiRouteError,
  type HybridModelResult,
  type ProviderAttemptFailure,
} from "@/lib/gemini";
import { BUILT_IN_PRONUNCIATIONS } from "@/lib/pronunciation";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { getLocalDateString, normalizeTermKey } from "@/lib/utils";
import type {
  CefrLevel,
  DailyPackItem,
  RegisterType,
  WordExample,
  WordFamilyItem,
} from "@/types/lexivault";

// Strict per-provider timeout budgets for each small parallel batch (<= 5 items each).
// Worst-case server fallback budget: Gemini (10s) + Groq (10s) + CF Workers AI (10s) = 30s.
const DAILY_PACK_GEMINI_TIMEOUT_MS = 10_000;
const DAILY_PACK_FALLBACK_TIMEOUT_MS = 10_000;
const MAX_DAILY_PACK_BATCH_SIZE = 5;

const VOCAB_BATCH_THEMES = [
  "academic, analytical, and formal discourse",
  "expressive, nuanced, and everyday high-level speech",
  "leadership, persuasion, and strategic thinking",
  "science, innovation, and social dynamics",
  "literature, emotion, and critical observation",
  "economics, policy, and global affairs",
] as const;

const IDIOM_BATCH_THEMES = [
  "workplace, decision-making, and problem-solving",
  "everyday conversation, emotions, and relationships",
  "persuasion, strategy, and resilience",
  "time, change, and unexpected outcomes",
] as const;

interface DailyPackBatchSpec {
  batchId: string;
  batchType: "vocab" | "idiom";
  count: number;
  themeHint: string;
}

function buildDailyPackBatches(
  wordsQuota: number,
  idiomsQuota: number
): DailyPackBatchSpec[] {
  const batches: DailyPackBatchSpec[] = [];

  let remainingWords = wordsQuota;
  let vocabIdx = 0;
  while (remainingWords > 0) {
    const count = Math.min(MAX_DAILY_PACK_BATCH_SIZE, remainingWords);
    batches.push({
      batchId: `vocab-${vocabIdx + 1}`,
      batchType: "vocab",
      count,
      themeHint: VOCAB_BATCH_THEMES[vocabIdx % VOCAB_BATCH_THEMES.length],
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
      themeHint: IDIOM_BATCH_THEMES[idiomIdx % IDIOM_BATCH_THEMES.length],
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

const LEAN_DAILY_PACK_SCHEMA: Schema = {
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
          cefr: { type: Type.STRING, enum: ["C1", "C2"] },
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
        : "Academic";
  const cefr: CefrLevel = raw.cefr === "C2" ? "C2" : "C1";
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

  const word_families: WordFamilyItem[] = Array.isArray(raw.word_families)
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
}): Promise<HybridModelResult<{ items?: RawDailyPackItem[] }>> {
  const { batchId, batchType, count, themeHint, dateStr, existingCsv } = params;
  const isIdiom = batchType === "idiom";
  const label = isIdiom
    ? `EXACTLY ${count} C1-C2 English idioms/phrasal expressions`
    : `EXACTLY ${count} C1-C2 single English vocabulary words`;

  const prompt = `Daily Pack (${dateStr}, ${batchId}): generate ${label} focused on ${themeHint}.
EXCLUDE: ${existingCsv}

Return compact JSON {items:[...]} with brief, crisp fields:
- term: English ${isIdiom ? "idiom" : "single word"}
- pronunciation: "·" syllable dots + ALL CAPS primary stress
- ipa: /.../
- cefr: "C1" or "C2"
- register: ${isIdiom ? '"Casual", "Formal", or "Academic"' : '"Academic", "Formal", or "Casual"'}
- meaning_en: 1 short English definition
- meaning_id: 1 natural Indonesian figurative definition
- example_en: 1 short sentence with **bold** target term
- example_id: natural Indonesian translation of example_en
- synonyms: 2 concise synonyms`;

  return generateStructuredWithHybridModel<{ items?: RawDailyPackItem[] }>({
    tier: "flash",
    routeName: `api/daily-pack:${batchId}`,
    systemInstruction:
      "Ultra-fast C1-C2 English-Indonesian lexicographer. Return compact valid JSON only with zero duplicates and concise text.",
    contents: prompt,
    maxOutputTokens: Math.min(2200, Math.max(1300, count * (isIdiom ? 280 : 260))),
    fallbackMaxTokens: Math.min(2000, Math.max(1200, count * (isIdiom ? 260 : 240))),
    temperature: 0.65,
    timeoutMs: DAILY_PACK_GEMINI_TIMEOUT_MS,
    fallbackTimeoutMs: DAILY_PACK_FALLBACK_TIMEOUT_MS,
    validate: (parsed) =>
      Array.isArray(parsed.items) &&
      parsed.items.some(
        (it, idx) => normalizeDailyPackItem(it, dateStr, idx, batchType) !== null
      )
        ? null
        : `no valid complete daily-pack ${batchId} items`,
    responseSchema: LEAN_DAILY_PACK_SCHEMA,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      date?: string;
      wordsQuota?: number;
      idiomsQuota?: number;
      existingTerms?: string[];
      lang?: "en" | "id";
    };

    const dateStr =
      typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : getLocalDateString();
    const wordsQuota = clampInt(body.wordsQuota, 0, 30, 10);
    const idiomsQuota = clampInt(body.idiomsQuota, 0, 20, 5);
    const totalNeeded = wordsQuota + idiomsQuota;

    if (totalNeeded === 0) {
      return NextResponse.json({
        pack_date: dateStr,
        words_quota: 0,
        idioms_quota: 0,
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
    const batchSpecs = buildDailyPackBatches(wordsQuota, idiomsQuota);
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
        seenKeys
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
