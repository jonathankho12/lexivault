import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { BUILT_IN_ENGLISH_MEANINGS } from "@/lib/bilingualCache";
import {
  classifyGeminiError,
  formatCompactExistingTerms,
  generateStructuredWithHybridModel,
  logGeminiRouteError,
} from "@/lib/gemini";
import { FALLBACK_SUGGESTED_WORDS } from "@/lib/mockData";
import { BUILT_IN_PRONUNCIATIONS } from "@/lib/pronunciation";
import { checkAiRateLimit } from "@/lib/rate-limit";
import {
  normalizeDuplicateKey,
  normalizeSourceTag,
  normalizeTermKey,
} from "@/lib/utils";
import type {
  CefrLevel,
  RegisterType,
  SourceTag,
  SuggestCategory,
  SuggestRegister,
  SuggestedWordItem,
  WordExample,
  WordFamilyItem,
  WordType,
} from "@/types/lexivault";

const VALID_TYPES = new Set<WordType>(["vocab", "idiom", "collocation"]);
const VALID_REGISTERS = new Set<RegisterType>([
  "Formal",
  "Academic",
  "Casual",
  "Slang",
]);
const VALID_SOURCES = new Set<SourceTag>([
  "film",
  "book",
  "lecture",
  "article",
  "general",
]);

function normalizeSuggestedItem(
  raw: Partial<SuggestedWordItem> & {
    phonetic?: string;
    example?: string;
    source?: string;
  }
): SuggestedWordItem | null {
  const term = (raw.term || "").trim();
  if (!term) return null;

  const key = normalizeTermKey(term);
  const builtInPron = BUILT_IN_PRONUNCIATIONS[key];
  const builtInBilingual = BUILT_IN_ENGLISH_MEANINGS[key];

  const type: WordType =
    raw.type && VALID_TYPES.has(raw.type) ? raw.type : "idiom";
  const register: RegisterType =
    raw.register && VALID_REGISTERS.has(raw.register)
      ? raw.register
      : type === "idiom"
        ? "Casual"
        : "Academic";
  const cefr: CefrLevel = raw.cefr === "C2" ? "C2" : "C1";

  const rawSource = normalizeSourceTag(
    raw.source_tag || raw.source || "article"
  );
  const source_tag: SourceTag = VALID_SOURCES.has(rawSource as SourceTag)
    ? (rawSource as SourceTag)
    : "article";

  const examples: WordExample[] = Array.isArray(raw.examples)
    ? raw.examples
        .filter(
          (ex) =>
            ex &&
            typeof ex.sentence === "string" &&
            ex.sentence.trim().length >= 8
        )
        .slice(0, 2)
        .map((ex, idx) => ({
          sentence: ex.sentence.trim(),
          translation_id: (ex.translation_id || "").trim(),
          context: (ex.context || "").trim() || (idx === 0 ? "Daily" : "Academic"),
        }))
    : [];

  if (
    examples.length === 0 &&
    typeof raw.example === "string" &&
    raw.example.trim().length >= 8
  ) {
    examples.push({
      sentence: raw.example.trim(),
      translation_id: "",
      context: register === "Academic" ? "Academic" : "Daily",
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
    source_tag,
  };
}

function pickFallbackSuggestions(
  excludeKeys: Set<string>,
  category: SuggestCategory,
  register: SuggestRegister,
  needed = 4
): SuggestedWordItem[] {
  const candidates = FALLBACK_SUGGESTED_WORDS.filter((item) => {
    const key = normalizeDuplicateKey(item.term);
    if (excludeKeys.has(key)) return false;
    if (category !== "mix" && item.type !== category) return false;
    if (register !== "any" && item.register !== register) return false;
    return true;
  });

  // Relax register constraint if strict combo runs low, keeping category first
  const relaxedCategory =
    candidates.length >= needed
      ? candidates
      : [
          ...candidates,
          ...FALLBACK_SUGGESTED_WORDS.filter((item) => {
            const key = normalizeDuplicateKey(item.term);
            if (excludeKeys.has(key)) return false;
            if (
              candidates.some((c) => normalizeDuplicateKey(c.term) === key)
            ) {
              return false;
            }
            return category === "mix" || item.type === category;
          }),
        ];

  // Relax fully if still under needed
  const finalPool =
    relaxedCategory.length >= needed
      ? relaxedCategory
      : [
          ...relaxedCategory,
          ...FALLBACK_SUGGESTED_WORDS.filter((item) => {
            const key = normalizeDuplicateKey(item.term);
            return (
              !excludeKeys.has(key) &&
              !relaxedCategory.some(
                (c) => normalizeDuplicateKey(c.term) === key
              )
            );
          }),
        ];

  // Light shuffle for variety across "Generate More" clicks
  const shuffled = [...finalPool].sort(() => Math.random() - 0.5);
  if (category !== "mix") {
    return shuffled.slice(0, needed);
  }

  // For "mix", aim for a balanced C1–C2 set: 2 idioms + 1 vocab + 1 collocation
  const picked: SuggestedWordItem[] = [];
  const pickedKeys = new Set<string>();
  const takeByType = (targetType: WordType, limit: number) => {
    let count = 0;
    for (const item of shuffled) {
      if (count >= limit) break;
      const key = normalizeDuplicateKey(item.term);
      if (pickedKeys.has(key) || item.type !== targetType) continue;
      pickedKeys.add(key);
      picked.push(item);
      count += 1;
    }
  };

  takeByType("idiom", 2);
  takeByType("vocab", 1);
  takeByType("collocation", 1);

  for (const item of shuffled) {
    if (picked.length >= needed) break;
    const key = normalizeDuplicateKey(item.term);
    if (pickedKeys.has(key)) continue;
    pickedKeys.add(key);
    picked.push(item);
  }

  return picked.slice(0, needed);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      existingTerms?: string[];
      category?: SuggestCategory;
      register?: SuggestRegister;
      lang?: "en" | "id";
    };

    const category: SuggestCategory =
      body.category === "idiom" ||
      body.category === "vocab" ||
      body.category === "collocation"
        ? body.category
        : "mix";
    const register: SuggestRegister =
      body.register === "Academic" ||
      body.register === "Formal" ||
      body.register === "Casual"
        ? body.register
        : "any";
    const lang = body.lang === "en" ? "en" : "id";

    const rateLimit = checkAiRateLimit(request, lang, {
      bucket: "suggest-words",
      limit: 30,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const rawExisting = Array.isArray(body.existingTerms)
      ? body.existingTerms
          .map((t) => String(t).trim())
          .filter(Boolean)
          .slice(0, 150)
      : [];
    const excludeKeys = new Set(rawExisting.map(normalizeDuplicateKey));

    const existingCsv = formatCompactExistingTerms(rawExisting, 150);
    const categoryInstruction =
      category === "mix"
        ? "Mix: 2 idioms, 1 vocab, 1 collocation."
        : `ALL 4 items must have type "${category}".`;
    const registerInstruction =
      register === "any"
        ? "Balance Academic, Formal, and Casual registers."
        : `ALL 4 items must fit register "${register}".`;

    const prompt = `Generate 4 fresh C1–C2 English expressions (ui: ${lang}).
${categoryInstruction} ${registerInstruction}
EXCLUDE (no exact or variant matches): ${existingCsv}

Concise complete JSON per item:
term, type (vocab|idiom|collocation), cefr (C1|C2), register (Academic|Formal|Casual), pronunciation ("·" dots + ALL CAPS stress), ipa (/.../), meaning_en (1 concise sentence), meaning_id (1 natural figurative Indonesian sentence), examples (2 short sentences — 1 Daily, 1 Academic — wrapping target in **bold**, with translation_id & context), synonyms (2-3), antonyms (1-2), word_families (1-2 real {word,pos}), source_tag (film|book|lecture|article|general).`;

    const aiRes = await generateStructuredWithHybridModel<{
      items?: Partial<SuggestedWordItem>[];
    }>({
      tier: "flash",
      routeName: "api/suggest-words",
      systemInstruction:
        "Fast C1-C2 English lexicographer. Output complete, compact valid JSON only with zero duplicates.",
      contents: prompt,
      maxOutputTokens: 3072,
      fallbackMaxTokens: 1800,
      temperature: 0.7,
      timeoutMs: 9500,
      validate: (parsed) => {
        if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
          return "empty items array";
        }
        const validCount = parsed.items.filter(
          (it) => normalizeSuggestedItem(it) !== null
        ).length;
        return validCount === 0 ? "no valid complete items" : null;
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
                register: {
                  type: Type.STRING,
                  enum: ["Academic", "Formal", "Casual"],
                },
                meaning_en: { type: Type.STRING },
                meaning_id: { type: Type.STRING },
                examples: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      sentence: { type: Type.STRING },
                      translation_id: { type: Type.STRING },
                      context: { type: Type.STRING },
                    },
                    required: ["sentence", "translation_id", "context"],
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
                word_families: {
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
                source_tag: {
                  type: Type.STRING,
                  enum: ["film", "book", "lecture", "article", "general"],
                },
              },
              required: [
                "term",
                "pronunciation",
                "ipa",
                "cefr",
                "type",
                "register",
                "meaning_en",
                "meaning_id",
                "examples",
                "synonyms",
                "antonyms",
                "word_families",
                "source_tag",
              ],
            },
          },
        },
        required: ["items"],
      },
    });

    if (!aiRes.ok) {
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

    const seenBatch = new Set<string>(excludeKeys);
    const uniqueItems: SuggestedWordItem[] = [];

    if (Array.isArray(aiRes.data.items)) {
      for (const rawItem of aiRes.data.items) {
        const normalized = normalizeSuggestedItem(rawItem);
        if (!normalized) continue;
        const key = normalizeDuplicateKey(normalized.term);
        if (seenBatch.has(key)) continue;
        seenBatch.add(key);
        uniqueItems.push(normalized);
        if (uniqueItems.length >= 4) break;
      }
    }

    if (uniqueItems.length < 4) {
      const topUp = pickFallbackSuggestions(
        seenBatch,
        category,
        register,
        4 - uniqueItems.length
      );
      uniqueItems.push(...topUp);
    }

    return NextResponse.json({
      items: uniqueItems,
      source: "gemini",
      modelUsed: aiRes.modelUsed,
    });
  } catch (err) {
    const classified = classifyGeminiError(err);
    logGeminiRouteError("api/suggest-words", classified);
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
