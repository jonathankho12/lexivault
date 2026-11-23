import { NextResponse } from "next/server";
import { Type, type Schema } from "@google/genai";
import { BUILT_IN_ENGLISH_MEANINGS } from "@/lib/bilingualCache";
import {
  classifyGeminiError,
  formatCompactExistingTerms,
  generateStructuredWithHybridModel,
  incompleteGeminiResponseError,
  logGeminiRouteError,
} from "@/lib/gemini";
import { BUILT_IN_PRONUNCIATIONS } from "@/lib/pronunciation";
import { checkAiRateLimit } from "@/lib/rate-limit";
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
  phonetic?: string;
  definition?: string;
}

const CORE_ENTRY_PROPERTIES: Record<string, Schema> = {
  term: { type: Type.STRING },
  pronunciation: { type: Type.STRING },
  ipa: { type: Type.STRING },
  cefr: { type: Type.STRING, enum: ["B2", "C1", "C2"] },
  type: {
    type: Type.STRING,
    enum: ["vocab", "idiom", "collocation"],
  },
  register: {
    type: Type.STRING,
    enum: ["Formal", "Academic", "Casual", "Slang"],
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
};

const CORE_REQUIRED_FIELDS = [
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
];

function validateAndNormalizeAutofillPayload(
  raw: AutofillModelOutput,
  fallbackTerm: string
): { ok: true; data: AutofillPayload } | { ok: false; missing: string[] } {
  const cleanTerm = (raw.term || fallbackTerm).trim();
  const key = normalizeTermKey(cleanTerm);
  const type: WordType =
    raw.type && VALID_TYPES.has(raw.type) ? raw.type : "vocab";
  const register: RegisterType =
    raw.register && VALID_REGISTERS.has(raw.register) ? raw.register : "Formal";

  const builtInPron = BUILT_IN_PRONUNCIATIONS[key];
  const builtInBilingual = BUILT_IN_ENGLISH_MEANINGS[key];

  const pronunciation =
    (raw.pronunciation || raw.phonetic || "").trim() ||
    builtInPron?.pronunciation ||
    undefined;
  const ipa = (raw.ipa || "").trim() || builtInPron?.ipa || undefined;

  const meaning_en =
    (raw.meaning_en || raw.definition || "").trim() ||
    builtInBilingual?.meaning_en ||
    "";
  const meaning_id = (raw.meaning_id || "").trim();

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

  const missing: string[] = [];
  if (meaning_en.length < 4) missing.push("meaning_en");
  if (meaning_id.length < 4) missing.push("meaning_id");
  if (examples.length === 0) missing.push("examples");
  if (!pronunciation && !ipa) missing.push("pronunciation/ipa");

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const word_families: WordFamilyItem[] = Array.isArray(raw.word_families)
    ? raw.word_families
        .filter((wf) => wf && typeof wf.word === "string" && wf.word.trim())
        .slice(0, 5)
        .map((wf) => ({
          word: wf.word.trim(),
          pos: (wf.pos || type).trim(),
        }))
    : [];

  const cefr: CefrLevel =
    raw.cefr === "B2" || raw.cefr === "C1" || raw.cefr === "C2"
      ? raw.cefr
      : builtInBilingual?.cefr || "C1";

  return {
    ok: true,
    data: {
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
    },
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

    const rateLimit = checkAiRateLimit(request, lang);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const existingCsv = formatCompactExistingTerms(existingList, 140);
    const hasExisting = existingCsv !== "none";

    const systemInstruction =
      "Precise English-Indonesian lexicographer. Return complete, valid JSON matching the exact schema. Never invent fake derivatives or placeholder text.";

    const duplicateBlock = hasExisting
      ? `Existing Vault terms: ${existingCsv}
First check if "${term}" is an exact, inflectional, morphological, or phrase variant of ANY existing Vault term (e.g. "spilling the tea" matches "spill the tea", "gentrify" matches "gentrified").
- If YES: set duplicate=true and existing_term="<exact matched term from list>".
- If NO: set duplicate=false, existing_term="", and populate ALL dictionary fields below completely and accurately.`
      : `Populate ALL dictionary fields below completely and accurately.`;

    const prompt = `Create a complete bilingual English-Indonesian dictionary card for "${term}" (source: ${body.sourceTag || "general"}, ui: ${lang}).
${duplicateBlock}

Required fields (never leave blank when not a duplicate):
- term: canonical English spelling/casing
- pronunciation: Google "Sounds like" phonetic spelling with "·" syllable dots & ALL CAPS primary stress (e.g. "am·BIV·uh·luhnt")
- ipa: standard IPA inside slashes (e.g. "/æmˈbɪv.ə.lənt/")
- cefr: B2, C1, or C2
- type: vocab, idiom, or collocation
- register: Academic, Formal, Casual, or Slang
- meaning_en: 1 clear, natural English definition (figurative meaning for idioms)
- meaning_id: 1 clear, natural Indonesian definition (figurative meaning for idioms, never literal word-by-word)
- examples: 2 natural example sentences (1 Daily, 1 Academic) wrapping the target term in **bold**, each with natural Indonesian translation_id and context
- synonyms: 2–4 register-matched English synonyms
- antonyms: 1–3 contrasting English antonyms (or contextual opposites)
- word_families: 1–4 real {word, pos} morphological forms (for idioms, use base form or key lemma; never invent fake words)`;

    const responseSchema: Schema = hasExisting
      ? {
          type: Type.OBJECT,
          properties: {
            duplicate: { type: Type.BOOLEAN },
            existing_term: { type: Type.STRING },
            ...CORE_ENTRY_PROPERTIES,
          },
          required: ["duplicate", "existing_term", ...CORE_REQUIRED_FIELDS],
        }
      : {
          type: Type.OBJECT,
          properties: CORE_ENTRY_PROPERTIES,
          required: CORE_REQUIRED_FIELDS,
        };

    const aiRes = await generateStructuredWithHybridModel<AutofillModelOutput>({
      tier: "flash",
      routeName: "api/autofill",
      systemInstruction,
      contents: prompt,
      maxOutputTokens: 2048,
      temperature: 0.25,
      timeoutMs: 12000,
      responseSchema,
      validate: (raw) => {
        if (hasExisting && raw.duplicate === true) {
          return null;
        }
        const checked = validateAndNormalizeAutofillPayload(raw, term);
        return checked.ok ? null : `missing ${checked.missing.join(", ")}`;
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
    if (hasExisting && aiRes.data.duplicate === true) {
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

    const validated = validateAndNormalizeAutofillPayload(aiRes.data, term);
    if (!validated.ok) {
      const incompleteErr = incompleteGeminiResponseError(
        aiRes.modelUsed,
        `missing ${validated.missing.join(", ")}`
      );
      logGeminiRouteError("api/autofill", incompleteErr, {
        term,
        model: aiRes.modelUsed,
      });
      return NextResponse.json(
        {
          error: incompleteErr.detail,
          code: incompleteErr.code,
          detail: incompleteErr.rawMessage,
        },
        { status: incompleteErr.status }
      );
    }

    const normalized = validated.data;
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
