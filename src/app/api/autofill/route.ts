import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { BUILT_IN_ENGLISH_MEANINGS } from "@/lib/bilingualCache";
import {
  classifyGeminiError,
  formatCompactExistingTerms,
  generateStructuredWithHybridModel,
  logGeminiRouteError,
} from "@/lib/gemini";
import { BUILT_IN_PRONUNCIATIONS } from "@/lib/pronunciation";
import { normalizeDuplicateKey, normalizeTermKey } from "@/lib/utils";
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

interface AutofillModelOutput extends Partial<AutofillPayload> {
  duplicate?: boolean;
  existing_term?: string;
  meaning?: string;
}

function normalizeAutofillPayload(
  raw: AutofillModelOutput,
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
        .slice(0, 5)
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
      ? raw.synonyms.map((s) => String(s).trim()).filter(Boolean).slice(0, 4)
      : [],
    antonyms: Array.isArray(raw.antonyms)
      ? raw.antonyms.map((s) => String(s).trim()).filter(Boolean).slice(0, 3)
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
      existingTerms?: string[];
      skipDuplicateCheck?: boolean;
    };
    const term = body.term?.trim() ?? "";
    const lang = body.lang === "en" ? "en" : "id";

    if (!term) {
      return NextResponse.json(
        { error: "Term is required", code: "invalid_input" },
        { status: 400 }
      );
    }

    const existingList =
      !body.skipDuplicateCheck && Array.isArray(body.existingTerms)
        ? body.existingTerms
        : [];

    // Fast 0ms server-side normalized duplicate guard
    if (existingList.length > 0) {
      const targetDupKey = normalizeDuplicateKey(term);
      const exactMatch = existingList.find(
        (t) => normalizeDuplicateKey(String(t || "")) === targetDupKey
      );
      if (exactMatch) {
        return NextResponse.json({
          duplicate: true,
          existingTerm: String(exactMatch).trim(),
          source: "local-check",
        });
      }
    }

    const existingCsv = formatCompactExistingTerms(existingList, 140);
    const hasExisting = existingCsv !== "none";

    const systemInstruction =
      "Fast English-Indonesian lexicographer. Output compact valid JSON only. Never invent fake word-family derivatives.";

    const prompt = `Term: "${term}" (source: ${body.sourceTag || "general"}, ui: ${lang}).
${
  hasExisting
    ? `Existing Vault terms: ${existingCsv}
FIRST check if "${term}" is an exact, inflectional, or morphological/phrase variant of ANY existing Vault term (e.g. "spilling the tea" matches "spill the tea", "gentrify" matches "gentrified").
If YES: return ONLY {"duplicate":true,"existing_term":"<exact matched term from list>"}.
If NO: return {"duplicate":false, ...all fields below}.`
    : 'Return {"duplicate":false, ...all fields below}.'
}

Fields when duplicate=false:
- term: canonical casing
- cefr: B2|C1|C2
- type: vocab|idiom|collocation
- register: Academic|Formal|Casual|Slang
- pronunciation: Google "Sounds like" with "·" dots & ALL CAPS primary stress (e.g. "am·BIV·uh·luhnt")
- ipa: /IPA/
- meaning_en: 1 concise natural English C1-C2 definition (figurative for idioms)
- meaning_id: 1 concise natural Indonesian definition (figurative for idioms, never literal word-by-word)
- examples: 2 short sentences (1 Daily, 1 Academic) wrapping target in **bold**, with Indonesian translation_id & context
- synonyms: 2-3 register-matched strings
- antonyms: 1-2 contrasting strings
- word_families: 1-4 real {word, pos} derivatives`;

    const aiRes = await generateStructuredWithHybridModel<AutofillModelOutput>({
      tier: "flash",
      routeName: "api/autofill",
      systemInstruction,
      contents: prompt,
      maxOutputTokens: 600,
      temperature: 0.2,
      timeoutMs: 6000,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          duplicate: { type: Type.BOOLEAN },
          existing_term: { type: Type.STRING },
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
        required: ["duplicate"],
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

    // Layer 2 AI semantic/variant duplicate detection
    if (aiRes.data.duplicate === true && hasExisting) {
      const aiMatched = (aiRes.data.existing_term || "").trim();
      const verifiedMatch =
        existingList.find(
          (t) =>
            normalizeDuplicateKey(String(t || "")) ===
            normalizeDuplicateKey(aiMatched)
        ) ||
        aiMatched ||
        term;
      return NextResponse.json({
        duplicate: true,
        existingTerm: String(verifiedMatch).trim(),
        source: "gemini",
        modelUsed: aiRes.modelUsed,
      });
    }

    const normalized = normalizeAutofillPayload(aiRes.data, term);
    return NextResponse.json({
      duplicate: false,
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
