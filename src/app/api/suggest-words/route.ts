import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { BUILT_IN_ENGLISH_MEANINGS } from "@/lib/bilingualCache";
import {
  classifyGeminiError,
  emptyGeminiResponseError,
  getGeminiClient,
  getGeminiFlashModel,
  logGeminiRouteError,
  missingGeminiKeyError,
} from "@/lib/gemini";
import { FALLBACK_SUGGESTED_WORDS } from "@/lib/mockData";
import { BUILT_IN_PRONUNCIATIONS } from "@/lib/pronunciation";
import { normalizeSourceTag, normalizeTermKey } from "@/lib/utils";
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

  const rawSource = normalizeSourceTag(raw.source_tag || raw.source || "article");
  const source_tag: SourceTag = VALID_SOURCES.has(rawSource as SourceTag)
    ? (rawSource as SourceTag)
    : "article";

  const examples: WordExample[] = Array.isArray(raw.examples)
    ? raw.examples
        .filter(
          (ex) => ex && typeof ex.sentence === "string" && ex.sentence.trim()
        )
        .slice(0, 2)
        .map((ex, idx) => ({
          sentence: ex.sentence.trim(),
          translation_id: (ex.translation_id || "").trim(),
          context: ex.context || (idx === 0 ? "Daily" : "Academic"),
        }))
    : [];

  if (examples.length === 0 && typeof raw.example === "string" && raw.example.trim()) {
    examples.push({
      sentence: raw.example.trim(),
      translation_id: "",
      context: register === "Academic" ? "Academic" : "Daily",
    });
  }

  if (examples.length === 0) {
    examples.push({
      sentence: `Using **${term}** accurately elevates your spoken and written fluency.`,
      translation_id: `Menggunakan **${term}** secara tepat membuat bahasa Inggrismu terdengar lebih fasih.`,
      context: "Daily",
    });
  }

  const word_families: WordFamilyItem[] = Array.isArray(raw.word_families)
    ? raw.word_families
        .filter((wf) => wf && typeof wf.word === "string" && wf.word.trim())
        .map((wf) => ({
          word: wf.word.trim(),
          pos: (wf.pos || type).trim(),
        }))
    : [{ word: term, pos: type }];

  const meaning_en =
    (raw.meaning_en || "").trim() ||
    builtInBilingual?.meaning_en ||
    `Advanced C1–C2 English expression "${term}".`;
  const meaning_id =
    (raw.meaning_id || "").trim() ||
    `Ekspresi bahasa Inggris tingkat C1–C2 "${term}".`;

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
    const key = normalizeTermKey(item.term);
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
            const key = normalizeTermKey(item.term);
            if (excludeKeys.has(key)) return false;
            if (candidates.some((c) => normalizeTermKey(c.term) === key)) {
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
            const key = normalizeTermKey(item.term);
            return (
              !excludeKeys.has(key) &&
              !relaxedCategory.some((c) => normalizeTermKey(c.term) === key)
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
      const key = normalizeTermKey(item.term);
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
    const key = normalizeTermKey(item.term);
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

    const rawExisting = Array.isArray(body.existingTerms)
      ? body.existingTerms
          .map((t) => String(t).trim())
          .filter(Boolean)
          .slice(0, 150)
      : [];
    const excludeKeys = new Set(rawExisting.map(normalizeTermKey));

    const ai = await getGeminiClient();
    if (!ai) {
      const missingErr = missingGeminiKeyError();
      logGeminiRouteError("api/suggest-words", missingErr, {
        category,
        register,
      });
      return NextResponse.json(
        {
          error: missingErr.detail,
          code: missingErr.code,
          detail: missingErr.rawMessage,
        },
        { status: missingErr.status }
      );
    }

    const model = await getGeminiFlashModel();
    const categoryInstruction =
      category === "mix"
        ? 'Return a rich C1–C2 mix: 2 idiomatic expressions ("idiom"), 1 advanced single word ("vocab"), and 1 natural collocation ("collocation").'
        : `Every single item MUST have type "${category}".`;
    const registerInstruction =
      register === "any"
        ? 'Balance natural registers across "Academic", "Formal", and "Casual".'
        : `Every single item MUST fit register "${register}".`;

    const prompt = `You are a master C1–C2 English lexicographer & IELTS Band 8.5+ vocabulary coach.
Generate EXACTLY 4 fresh, high-utility, authentic C1 or C2 English expressions for an ambitious learner whose current UI language is "${lang}".

STRICT RULES:
1. ${categoryInstruction}
2. ${registerInstruction}
3. STRICT DEDUPLICATION: You MUST NOT suggest any of these already-known or previously shown expressions (or trivial inflections of them):
   ${rawExisting.length > 0 ? rawExisting.join(", ") : "none"}.
4. Prioritize genuinely useful C1–C2 idioms, precise academic/formal words, and natural collocations used by educated native speakers (avoid cliché B1 words or obscure archaic words).
5. For EVERY item return strictly valid JSON matching the schema:
   - "term": canonical English expression
   - "type": "vocab" | "idiom" | "collocation"
   - "cefr": "C1" or "C2"
   - "register": "Academic" | "Formal" | "Casual"
   - "pronunciation": Google-style "Sounds like" phonetic respelling using middle dots "·" and ALL CAPS on the primary stressed syllable (e.g., "bair thuh BRUHNT", "am·BIV·uh·luhnt")
   - "ipa": standard IPA transcription in slashes (e.g., "/beər ðə brʌnt/")
   - "meaning_en": crisp, natural monolingual English C1–C2 learner's dictionary definition (1-2 clear sentences)
   - "meaning_id": accurate, natural, figurative-aware Indonesian explanation (1-2 crisp sentences; never word-by-word literal for idioms)
   - "examples": 2 natural contextual sentences (1 "Daily", 1 "Academic") wrapping the expression in **bold**, each with a natural Indonesian "translation_id" and "context"
   - "synonyms": 2-4 register-matched English synonyms
   - "antonyms": 1-3 contrasting expressions
   - "word_families": array of { "word": string, "pos": string }
   - "source_tag": best canonical source key from "film", "book", "lecture", "article", "general"`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
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
      },
    });

    const parsedText = response.text?.trim() ?? "";
    if (!parsedText) {
      const emptyErr = emptyGeminiResponseError(model);
      logGeminiRouteError("api/suggest-words", emptyErr, { model });
      return NextResponse.json(
        {
          error: emptyErr.detail,
          code: emptyErr.code,
          detail: emptyErr.rawMessage,
        },
        { status: emptyErr.status }
      );
    }

    const parsed = JSON.parse(parsedText) as {
      items?: Partial<SuggestedWordItem>[];
    };
    const seenBatch = new Set<string>(excludeKeys);
    const uniqueItems: SuggestedWordItem[] = [];

    if (Array.isArray(parsed.items)) {
      for (const rawItem of parsed.items) {
        const normalized = normalizeSuggestedItem(rawItem);
        if (!normalized) continue;
        const key = normalizeTermKey(normalized.term);
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
      modelUsed: model,
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
