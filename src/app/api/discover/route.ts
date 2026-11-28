import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { BUILT_IN_ENGLISH_MEANINGS } from "@/lib/bilingualCache";
import {
  CEFR_CALIBRATION_RULE,
  CHUNKS_GENERATION_RULE,
  classifyGeminiError,
  formatCompactExistingTerms,
  generateStructuredWithHybridModel,
  IDIOM_WORD_FAMILY_RULE,
  logGeminiRouteError,
  REGISTER_CLASSIFICATION_RULE,
} from "@/lib/gemini";
import { FALLBACK_DISCOVERY_PACKS } from "@/lib/mockData";
import { BUILT_IN_PRONUNCIATIONS } from "@/lib/pronunciation";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { normalizeDuplicateKey, normalizeTermKey } from "@/lib/utils";
import type {
  DailyDiscoveryPack,
  DiscoveryItem,
  RegisterType,
  WordType,
} from "@/types/lexivault";

type DiscoverCategory = "mix" | "vocab" | "idiom" | "collocation";
type DiscoverTone = "C1-C2" | "Academic" | "Formal" | "Casual" | "Slang";

function pickFallbackPack(
  dateStr: string,
  excludeKeys: Set<string>
): DiscoveryItem[] {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  const idx = hash % FALLBACK_DISCOVERY_PACKS.length;
  const primary = FALLBACK_DISCOVERY_PACKS[idx];
  const filtered = primary.filter(
    (item) => !excludeKeys.has(normalizeDuplicateKey(item.term))
  );
  if (filtered.length >= 4) return filtered;

  // Gather fresh items across all fallback packs
  const allFresh = FALLBACK_DISCOVERY_PACKS.flat().filter(
    (item) => !excludeKeys.has(normalizeDuplicateKey(item.term))
  );
  return allFresh.length > 0 ? allFresh.slice(0, 7) : primary;
}

function normalizeItems(
  rawItems: Partial<DiscoveryItem>[],
  dateStr: string,
  excludeKeys: Set<string>,
  limit: number,
  lang: "en" | "id" | "ru"
): DiscoveryItem[] {
  const validTypes = new Set<WordType>(["vocab", "idiom", "collocation"]);
  const validRegisters = new Set<RegisterType>([
    "Formal",
    "Academic",
    "Casual",
    "Slang",
  ]);
  const seen = new Set<string>(excludeKeys);
  const out: DiscoveryItem[] = [];
  const nonce = Date.now().toString(36);

  for (let idx = 0; idx < rawItems.length; idx += 1) {
    const item = rawItems[idx];
    const cleanTerm = (item.term || "").trim();
    if (!cleanTerm) continue;
    const dupKey = normalizeDuplicateKey(cleanTerm);
    if (seen.has(dupKey)) continue;
    seen.add(dupKey);

    const key = normalizeTermKey(cleanTerm);
    const builtIn = BUILT_IN_PRONUNCIATIONS[key];
    const builtInBilingual = BUILT_IN_ENGLISH_MEANINGS[key];
    const meaning_en =
      (item.meaning_en || "").trim() || builtInBilingual?.meaning_en || "";
    const meaning_ru = (item.meaning_ru || "").trim();
    const rawMeaningId = (item.meaning_id || "").trim();
    const meaning_id =
      rawMeaningId || (lang === "ru" ? meaning_ru || meaning_en : "");
    const examples = Array.isArray(item.examples_json)
      ? item.examples_json
          .filter(
            (ex) =>
              ex &&
              typeof ex.sentence === "string" &&
              ex.sentence.trim().length >= 8
          )
          .slice(0, 2)
          .map((ex, eIdx) => ({
            sentence: ex.sentence.trim(),
            translation_id: (ex.translation_id || "").trim(),
            ...(ex.translation_ru?.trim()
              ? { translation_ru: ex.translation_ru.trim() }
              : {}),
            context:
              (ex.context || "").trim() || (eIdx === 0 ? "Daily" : "Academic"),
          }))
      : [];

    const hasLocalized =
      lang === "ru" ? meaning_ru.length >= 4 : meaning_id.length >= 4;
    if (meaning_en.length < 4 || !hasLocalized || examples.length === 0) {
      continue;
    }

    const resolvedType: WordType =
      item.type && validTypes.has(item.type) ? item.type : "vocab";

    out.push({
      id: item.id || `disc-${dateStr}-${nonce}-${idx + 1}`,
      term: cleanTerm,
      pronunciation:
        (item.pronunciation || "").trim() || builtIn?.pronunciation || undefined,
      ipa: (item.ipa || "").trim() || builtIn?.ipa || undefined,
      cefr: item.cefr || builtInBilingual?.cefr || "C1",
      type: resolvedType,
      meaning_id,
      meaning_en,
      ...(meaning_ru ? { meaning_ru } : {}),
      examples_json: examples,
      synonyms: Array.isArray(item.synonyms) ? item.synonyms.slice(0, 3) : [],
      antonyms: Array.isArray(item.antonyms) ? item.antonyms.slice(0, 2) : [],
      word_families_json:
        resolvedType === "idiom"
          ? []
          : Array.isArray(item.word_families_json)
            ? item.word_families_json.slice(0, 4)
            : [],
      chunks: Array.isArray(item.chunks)
        ? Array.from(
            new Set(
              item.chunks
                .map((c) => String(c || "").replace(/\*\*/g, "").trim())
                .filter(Boolean)
            )
          ).slice(0, 3)
        : [],
      register:
        item.register && validRegisters.has(item.register)
          ? item.register
          : "Formal",
      source_tag: "discover",
    });

    if (out.length >= limit) break;
  }

  return out;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      date?: string;
      existingTerms?: string[];
      lang?: "en" | "id" | "ru";
      category?: DiscoverCategory;
      tone?: DiscoverTone;
      count?: number;
      mode?: "daily" | "more";
    };

    const dateStr =
      body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : new Date().toISOString().slice(0, 10);
    const lang = body.lang === "en" ? "en" : body.lang === "ru" ? "ru" : "id";
    const isRu = lang === "ru";
    const rateLimit = checkAiRateLimit(request, lang, {
      bucket: "discover",
      limit: 30,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const mode = body.mode === "more" ? "more" : "daily";
    const category: DiscoverCategory =
      body.category === "vocab" ||
      body.category === "idiom" ||
      body.category === "collocation"
        ? body.category
        : "mix";
    const tone: DiscoverTone =
      body.tone === "Academic" ||
      body.tone === "Formal" ||
      body.tone === "Casual" ||
      body.tone === "Slang"
        ? body.tone
        : "C1-C2";
    const requestedCount =
      typeof body.count === "number" && Number.isFinite(body.count)
        ? Math.max(3, Math.min(8, Math.round(body.count)))
        : mode === "more"
          ? 6
          : 7;

    const rawExisting = Array.isArray(body.existingTerms)
      ? body.existingTerms.map((t) => String(t || "").trim()).filter(Boolean)
      : [];
    const excludeKeys = new Set(rawExisting.map(normalizeDuplicateKey));
    const existingCsv = formatCompactExistingTerms(rawExisting, 180);

    const categoryRule =
      category === "mix"
        ? mode === "more"
          ? `Mix 2 vocab, 2 idioms, 2 collocations (${requestedCount} total).`
          : `Exactly 3 vocab, 2 idioms, 2 collocations (${requestedCount} total).`
        : `ALL ${requestedCount} items must have type "${category}".`;
    const toneRule =
      tone === "C1-C2"
        ? "High-utility C1–C2 expressions across Academic, Formal, and Casual registers."
        : `ALL items must fit "${tone}" register (C1–C2 level).`;

    const meaningFieldGuide = isRu
      ? "meaning_ru (1 natural figurative Russian definition)"
      : "meaning_id (1 natural figurative Indonesian sentence)";
    const exampleFieldGuide = isRu
      ? "examples_json (2 concise English sentences with **bold** target + translation_ru + context Daily/Academic)"
      : "examples_json (2 concise sentences with **bold** target + translation_id + context Daily/Academic)";

    const prompt = `Generate ${requestedCount} fresh English expressions (date ${dateStr}, ui ${lang}).
${categoryRule}
${toneRule}
EXCLUDE (no exact or variant matches): ${existingCsv}
${CEFR_CALIBRATION_RULE}
${REGISTER_CLASSIFICATION_RULE}
${IDIOM_WORD_FAMILY_RULE}
${CHUNKS_GENERATION_RULE}

Concise JSON per item (keep English target terms, pronunciation, IPA, English examples, synonyms, antonyms, word_families_json, and chunks in natural English):
term, cefr (C1|C2), type (vocab|idiom|collocation), register (Formal|Academic|Casual|Slang), pronunciation ("·" syllable dots + ALL CAPS primary stress), ipa (/.../), meaning_en (1 crisp sentence), ${meaningFieldGuide}, ${exampleFieldGuide}, synonyms (2-3), antonyms (1-2), word_families_json (1-3 {word,pos} for vocab/collocation ONLY; [] for idioms), chunks (2-3 natural native collocations/phrases or idiom sentence frames).`;

    const aiRes = await generateStructuredWithHybridModel<{
      items?: Partial<DiscoveryItem>[];
    }>({
      tier: "flash",
      routeName: mode === "more" ? "api/discover:more" : "api/discover",
      systemInstruction: isRu
        ? "Fast C1-C2 English lexicographer providing English entries with natural Russian explanations. Return compact valid JSON only with zero duplicates."
        : "Fast C1-C2 English lexicographer. Return compact valid JSON only with zero duplicates.",
      contents: prompt,
      maxOutputTokens: 3584,
      fallbackMaxTokens: 2000,
      temperature: 0.75,
      timeoutMs: 9500,
      validate: (parsed) => {
        if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
          return "empty discover items";
        }
        return normalizeItems(
          parsed.items,
          dateStr,
          excludeKeys,
          requestedCount,
          lang
        ).length > 0
          ? null
          : "no valid complete discover items";
      },
      responseSchema: {
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
                type: {
                  type: Type.STRING,
                  enum: ["vocab", "idiom", "collocation"],
                },
                meaning_en: { type: Type.STRING },
                ...(isRu
                  ? { meaning_ru: { type: Type.STRING } }
                  : { meaning_id: { type: Type.STRING } }),
                examples_json: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      sentence: { type: Type.STRING },
                      ...(isRu
                        ? { translation_ru: { type: Type.STRING } }
                        : { translation_id: { type: Type.STRING } }),
                      context: { type: Type.STRING },
                    },
                    required: [
                      "sentence",
                      isRu ? "translation_ru" : "translation_id",
                      "context",
                    ],
                  },
                },
                synonyms: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                antonyms: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                word_families_json: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      word: { type: Type.STRING },
                      pos: { type: Type.STRING },
                    },
                    required: ["word", "pos"],
                  },
                },
                chunks: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                register: {
                  type: Type.STRING,
                  enum: ["Formal", "Academic", "Casual", "Slang"],
                },
              },
              required: [
                "term",
                "pronunciation",
                "ipa",
                "cefr",
                "type",
                "meaning_en",
                isRu ? "meaning_ru" : "meaning_id",
                "examples_json",
                "synonyms",
                "antonyms",
                "word_families_json",
                "chunks",
                "register",
              ],
            },
          },
        },
        required: ["items"],
      },
    });

    if (aiRes.ok && Array.isArray(aiRes.data.items) && aiRes.data.items.length > 0) {
      const normalized = normalizeItems(
        aiRes.data.items,
        dateStr,
        excludeKeys,
        requestedCount,
        lang
      );
      if (normalized.length > 0) {
        const pack: DailyDiscoveryPack = {
          discovery_date: dateStr,
          items: normalized,
          source: "gemini",
        };
        return NextResponse.json({ ...pack, modelUsed: aiRes.modelUsed });
      }
    }

    if (!aiRes.ok && mode === "more") {
      return NextResponse.json(
        {
          error: aiRes.error.detail,
          code: aiRes.error.code,
          detail: aiRes.error.rawMessage,
          upstreamStatus: aiRes.error.upstreamStatus,
        },
        { status: aiRes.error.status }
      );
    }

    const pack: DailyDiscoveryPack = {
      discovery_date: dateStr,
      items: pickFallbackPack(dateStr, excludeKeys),
      source: "fallback",
    };
    return NextResponse.json(pack);
  } catch (err) {
    const classified = classifyGeminiError(err);
    logGeminiRouteError("api/discover", classified);
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
