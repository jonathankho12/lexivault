import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { BUILT_IN_ENGLISH_MEANINGS } from "@/lib/bilingualCache";
import {
  classifyGeminiError,
  generateStructuredWithHybridModel,
  logGeminiRouteError,
} from "@/lib/gemini";
import { BUILT_IN_PRONUNCIATIONS } from "@/lib/pronunciation";
import { normalizeTermKey } from "@/lib/utils";
import type {
  AutofillPayload,
  CefrLevel,
  RegisterType,
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

function normalizeAutofillPayload(
  raw: Partial<AutofillPayload> & { meaning?: string },
  fallbackTerm: string
): AutofillPayload {
  const cleanTerm = (raw.term || fallbackTerm).trim();
  const key = normalizeTermKey(cleanTerm);
  const type: WordType =
    raw.type && VALID_TYPES.has(raw.type) ? raw.type : "vocab";
  const register: RegisterType =
    raw.register && VALID_REGISTERS.has(raw.register) ? raw.register : "Formal";

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

  if (examples.length === 0) {
    examples.push({
      sentence: `Using **${cleanTerm}** accurately elevates your English expression.`,
      translation_id: `Menggunakan **${cleanTerm}** secara tepat membuat ungkapan bahasa Inggrismu lebih natural.`,
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
    : [{ word: cleanTerm, pos: type }];

  const builtInPron = BUILT_IN_PRONUNCIATIONS[key];
  const builtInBilingual = BUILT_IN_ENGLISH_MEANINGS[key];
  const pronunciation =
    (raw.pronunciation || "").trim() || builtInPron?.pronunciation || undefined;
  const ipa = (raw.ipa || "").trim() || builtInPron?.ipa || undefined;

  const meaning_en =
    (raw.meaning_en || "").trim() ||
    builtInBilingual?.meaning_en ||
    undefined;
  const meaning_id =
    (raw.meaning_id || "").trim() ||
    (raw.meaning || "").trim() ||
    meaning_en ||
    `Makna kontekstual untuk "${cleanTerm}".`;
  const cefr: CefrLevel | undefined =
    raw.cefr === "B2" || raw.cefr === "C1" || raw.cefr === "C2"
      ? raw.cefr
      : builtInBilingual?.cefr;

  return {
    term: cleanTerm,
    pronunciation,
    ipa,
    cefr,
    type,
    meaning_id,
    meaning_en,
    examples,
    synonyms: Array.isArray(raw.synonyms)
      ? raw.synonyms.map((s) => String(s).trim()).filter(Boolean).slice(0, 5)
      : [],
    antonyms: Array.isArray(raw.antonyms)
      ? raw.antonyms.map((s) => String(s).trim()).filter(Boolean).slice(0, 4)
      : [],
    word_families,
    register,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      term?: string;
      sourceTag?: string;
      lang?: "en" | "id";
    };
    const term = body.term?.trim() ?? "";
    const lang = body.lang === "en" ? "en" : "id";

    if (!term) {
      return NextResponse.json(
        { error: "Term is required", code: "invalid_input" },
        { status: 400 }
      );
    }

    const prompt = `You are an expert bilingual English-Indonesian lexicographer and C1–C2 ESL linguistic coach.
Analyze the English expression: "${term}".
Source context hint (optional): "${body.sourceTag || "general"}".
Active UI language preference: "${lang}".

You MUST accurately perform Auto-Categorization and return strictly valid JSON matching the schema:
1. "term": clean canonical English casing for "${term}".
2. "cefr": estimated CEFR level ("B2", "C1", or "C2").
3. "type": auto-detect the exact lexical category:
   - "vocab": single vocabulary word (including phrasal adjectives/participles like "gentrified", "ubiquitous", "ephemeral").
   - "idiom": figurative multi-word expression whose overall meaning is non-literal (e.g., "snowed under", "bite the bullet", "burn the midnight oil", "on thin ice").
   - "collocation": natural habitual pairing of words with literal/semi-literal meaning (e.g., "make a compelling case", "pose a threat", "strike a balance", "yield results").
4. "register": auto-detect the primary stylistic register:
   - "Academic": scholarly, analytical, research, essay vocabulary.
   - "Formal": professional, business, polite official writing.
   - "Casual": everyday conversational English and common idioms.
   - "Slang": very informal, street, internet, or youth colloquialisms.
5. "meaning_en": clear, natural, C1–C2 monolingual English learner's dictionary definition (1-2 crisp sentences). For idioms, explain the real figurative meaning in English.
6. "meaning_id": accurate, natural, figurative-aware Indonesian explanation (1-2 crisp sentences). For idioms, explain the real figurative meaning in Indonesian, NOT word-by-word literal translation.
7. "examples": exactly 2 natural English example sentences (1 "Daily" conversation/scenario, 1 "Academic" or professional scenario) wrapping the target expression (or its inflected form) in **double asterisks** like **${term}**, each paired with a natural Indonesian "translation_id".
8. "synonyms": 2-4 natural English synonyms or equivalent expressions matching the same register.
9. "antonyms": 1-3 natural English antonyms or contrasting expressions.
10. "word_families": real morphological derivatives or closely related expressions with part-of-speech tags ("n", "v", "adj", "adv", "idiom", "collocation"). NEVER invent nonexistent words.
11. "pronunciation": easy-to-read Google "Sounds like" phonetic respelling separating syllables with middle dots "·" and putting the primary STRESSED syllable in ALL CAPS (e.g., "am·BIV·uh·luhnt", "JEN·truh·fyd", "bair thuh BRUHNT").
12. "ipa": standard IPA transcription enclosed in slashes (e.g., "/æmˈbɪv.ə.lənt/").`;

    const aiRes = await generateStructuredWithHybridModel<
      Partial<AutofillPayload>
    >({
      tier: "flash",
      routeName: "api/autofill",
      contents: prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          term: { type: Type.STRING },
          pronunciation: { type: Type.STRING },
          ipa: { type: Type.STRING },
          cefr: { type: Type.STRING, enum: ["B2", "C1", "C2"] },
          type: {
            type: Type.STRING,
            enum: ["vocab", "idiom", "collocation"],
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
          "meaning_id",
          "examples",
          "synonyms",
          "antonyms",
          "word_families",
          "register",
        ],
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

    const normalized = normalizeAutofillPayload(aiRes.data, term);
    return NextResponse.json({
      data: normalized,
      meaning:
        lang === "en"
          ? normalized.meaning_en || normalized.meaning_id
          : normalized.meaning_id,
      source: "gemini",
      modelUsed: aiRes.modelUsed,
    });
  } catch (err) {
    const classified = classifyGeminiError(err);
    logGeminiRouteError("api/autofill", classified);
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
