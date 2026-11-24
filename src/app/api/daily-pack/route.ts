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

// Per-provider timeout budgets for each parallel batch (words & idioms run concurrently).
// Worst-case server fallback budget: Gemini (13s) + Groq (12s) + CF Workers AI (12s) = 37s.
const DAILY_PACK_GEMINI_TIMEOUT_MS = 13_000;
const DAILY_PACK_FALLBACK_TIMEOUT_MS = 12_000;

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
  batchType: "vocab" | "idiom";
  count: number;
  dateStr: string;
  existingCsv: string;
}): Promise<HybridModelResult<{ items?: RawDailyPackItem[] }>> {
  const { batchType, count, dateStr, existingCsv } = params;
  const isIdiom = batchType === "idiom";
  const label = isIdiom
    ? `EXACTLY ${count} C1-C2 English idioms/phrasal expressions`
    : `EXACTLY ${count} C1-C2 single English vocabulary words`;

  const prompt = `Daily Pack (${dateStr}): generate ${label}.
EXCLUDE (no exact or variant matches): ${existingCsv}

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
    routeName: `api/daily-pack:${batchType}`,
    systemInstruction:
      "Ultra-fast C1-C2 English-Indonesian lexicographer. Return compact valid JSON only with zero duplicates and concise text.",
    contents: prompt,
    maxOutputTokens: Math.min(2800, Math.max(1024, count * (isIdiom ? 230 : 210))),
    fallbackMaxTokens: Math.min(2200, Math.max(900, count * (isIdiom ? 190 : 175))),
    temperature: 0.65,
    timeoutMs: DAILY_PACK_GEMINI_TIMEOUT_MS,
    fallbackTimeoutMs: DAILY_PACK_FALLBACK_TIMEOUT_MS,
    validate: (parsed) =>
      Array.isArray(parsed.items) &&
      parsed.items.some(
        (it, idx) => normalizeDailyPackItem(it, dateStr, idx, batchType) !== null
      )
        ? null
        : `no valid complete daily-pack ${batchType} items`,
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
    const rateLimit = checkAiRateLimit(request, lang);
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
    const existingCsv = formatCompactExistingTerms(rawExisting, 100);

    // Split into 2 lean parallel requests (words + idioms) so total latency stays well within timeouts
    const [wordsRes, idiomsRes] = await Promise.all([
      wordsQuota > 0
        ? generateDailyPackBatch({
            batchType: "vocab",
            count: wordsQuota,
            dateStr,
            existingCsv,
          })
        : Promise.resolve(null),
      idiomsQuota > 0
        ? generateDailyPackBatch({
            batchType: "idiom",
            count: idiomsQuota,
            dateStr,
            existingCsv,
          })
        : Promise.resolve(null),
    ]);

    const wordsSucceeded = Boolean(wordsRes?.ok);
    const idiomsSucceeded = Boolean(idiomsRes?.ok);

    if (!wordsSucceeded && !idiomsSucceeded) {
      const failedResults = [
        wordsRes && !wordsRes.ok ? { batch: "vocab", res: wordsRes } : null,
        idiomsRes && !idiomsRes.ok ? { batch: "idiom", res: idiomsRes } : null,
      ].filter(Boolean) as Array<{
        batch: "vocab" | "idiom";
        res: Extract<HybridModelResult<{ items?: RawDailyPackItem[] }>, { ok: false }>;
      }>;

      const primaryFailure = failedResults[0]?.res.error;
      const allProviderFailures: Array<
        ProviderAttemptFailure & { batch: "vocab" | "idiom" }
      > = failedResults.flatMap(({ batch, res }) =>
        (res.providerFailures ?? []).map((f) => ({ ...f, batch }))
      );

      console.error(
        "[LexiVault][api/daily-pack] All AI providers failed across parallel batches:",
        allProviderFailures.map((f) => ({
          batch: f.batch,
          provider: f.provider,
          model: f.model,
          status: f.status,
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

    if (wordsRes?.ok && Array.isArray(wordsRes.data.items)) {
      for (let i = 0; i < wordsRes.data.items.length; i += 1) {
        if (pickedWords.length >= wordsQuota) break;
        const normalized = normalizeDailyPackItem(
          wordsRes.data.items[i],
          dateStr,
          i,
          "vocab"
        );
        if (!normalized) continue;
        const key = normalizeTermKey(normalized.term);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        pickedWords.push(normalized);
      }
    }

    if (idiomsRes?.ok && Array.isArray(idiomsRes.data.items)) {
      for (let i = 0; i < idiomsRes.data.items.length; i += 1) {
        if (pickedIdioms.length >= idiomsQuota) break;
        const normalized = normalizeDailyPackItem(
          idiomsRes.data.items[i],
          dateStr,
          i,
          "idiom"
        );
        if (!normalized) continue;
        const key = normalizeTermKey(normalized.term);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        pickedIdioms.push(normalized);
      }
    }

    // If one batch failed or produced fewer unique items after deduplication, top up the remaining slots
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
        [
          wordsRes?.ok ? wordsRes.modelUsed : null,
          idiomsRes?.ok ? idiomsRes.modelUsed : null,
        ].filter(Boolean) as string[]
      )
    );
    const providersUsed = Array.from(
      new Set(
        [
          wordsRes?.ok ? wordsRes.providerUsed : null,
          idiomsRes?.ok ? idiomsRes.providerUsed : null,
        ].filter(Boolean) as string[]
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
