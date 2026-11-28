import { NextResponse } from "next/server";
import { Type, type Schema } from "@google/genai";
import { BUILT_IN_ENGLISH_MEANINGS } from "@/lib/bilingualCache";
import {
  AUTOFILL_SYSTEM_INSTRUCTION,
  buildAutofillPrompt,
  classifyGeminiError,
  formatCompactExistingTerms,
  generateStructuredWithHybridModel,
  incompleteGeminiResponseError,
  logGeminiRouteError,
} from "@/lib/gemini";
import { BUILT_IN_PRONUNCIATIONS } from "@/lib/pronunciation";
import { checkAiRateLimit } from "@/lib/rate-limit";
import {
  normalizeCefrLevel,
  normalizeDuplicateKey,
  normalizeRegister,
  normalizeTermKey,
} from "@/lib/utils";
import type {
  AutofillPayload,
  CefrLevel,
  RegisterType,
  WordExample,
  WordFamilyItem,
  WordType,
} from "@/types/lexivault";

type ApiLang = "en" | "id" | "ru";

const VALID_TYPES = new Set<WordType>(["vocab", "idiom", "collocation"]);
const NOT_ENGLISH_MESSAGE =
  "Please enter a valid English word, idiom, or collocation.";
const NOT_ENGLISH_MESSAGE_RU =
  "Введи корректное английское слово, идиому или словосочетание.";

interface AutofillModelOutput extends Partial<AutofillPayload> {
  is_valid_english?: boolean;
  duplicate?: boolean;
  existing_term?: string;
  phonetic?: string;
  definition?: string;
}

function notEnglishResponse(lang: ApiLang = "en") {
  return NextResponse.json(
    {
      error: lang === "ru" ? NOT_ENGLISH_MESSAGE_RU : NOT_ENGLISH_MESSAGE,
      code: "NOT_ENGLISH",
    },
    { status: 400 }
  );
}

const KEYBOARD_MASH_SEQUENCES = [
  "qwerty",
  "asdfg",
  "sdfgh",
  "dfghj",
  "fghjk",
  "ghjkl",
  "zxcvb",
  "xcvbn",
  "cvbnm",
  "qazwsx",
] as const;

/**
 * Fast deterministic pre-filter for inputs that cannot possibly be valid English
 * (e.g. non-Latin scripts, pure numbers/symbols, keyboard mashes, or impossible consonant clusters).
 */
function isObviouslyNonEnglishOrGibberish(term: string): boolean {
  const trimmed = term.trim();
  if (!trimmed || trimmed.length > 120) return true;
  if (!/\p{Script=Latin}/u.test(trimmed)) return true;
  if (!/^[\p{Script=Latin}0-9\s'’\-.,/&!?]+$/u.test(trimmed)) return true;
  if (/(.)\1{4,}/i.test(trimmed)) return true;

  const lower = trimmed.toLowerCase();
  if (KEYBOARD_MASH_SEQUENCES.some((seq) => lower.includes(seq))) {
    return true;
  }

  // Reject impossible 7+ consecutive consonants or single 6+ letter tokens with zero vowels (including y)
  const tokens = lower.split(/[\s\-/]+/).filter(Boolean);
  for (const tok of tokens) {
    const lettersOnly = tok.replace(/[^a-z]/g, "");
    if (!lettersOnly) continue;
    if (/[bcdfghjklmnpqrstvwxz]{7,}/.test(lettersOnly)) return true;
    if (lettersOnly.length >= 6 && !/[aeiouy]/.test(lettersOnly)) return true;
  }

  return false;
}

function getCoreSchemaConfig(lang: ApiLang): {
  properties: Record<string, Schema>;
  required: string[];
} {
  const isRu = lang === "ru";
  return {
    properties: {
      term: { type: Type.STRING },
      pronunciation: { type: Type.STRING },
      ipa: { type: Type.STRING },
      cefr: { type: Type.STRING, enum: ["A1", "A2", "B1", "B2", "C1", "C2"] },
      type: {
        type: Type.STRING,
        enum: ["vocab", "idiom", "collocation"],
      },
      register: {
        type: Type.STRING,
        enum: ["Formal", "Academic", "Casual", "Slang"],
      },
      meaning_en: { type: Type.STRING },
      ...(isRu
        ? { meaning_ru: { type: Type.STRING } }
        : { meaning_id: { type: Type.STRING } }),
      examples: {
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
          required: isRu
            ? ["sentence", "translation_ru", "context"]
            : ["sentence", "translation_id", "context"],
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
      chunks: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
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
      isRu ? "meaning_ru" : "meaning_id",
      "examples",
      "synonyms",
      "antonyms",
      "word_families",
      "chunks",
    ],
  };
}

function validateAndNormalizeAutofillPayload(
  raw: AutofillModelOutput,
  fallbackTerm: string,
  lang: ApiLang
): { ok: true; data: AutofillPayload } | { ok: false; missing: string[] } {
  const cleanTerm = (raw.term || fallbackTerm).trim();
  const key = normalizeTermKey(cleanTerm);
  const type: WordType =
    raw.type && VALID_TYPES.has(raw.type) ? raw.type : "vocab";
  const register: RegisterType = normalizeRegister(raw.register, "Casual");

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
  const meaning_ru = (raw.meaning_ru || "").trim() || undefined;
  const rawMeaningId = (raw.meaning_id || "").trim();
  const meaning_id =
    rawMeaningId || (lang === "ru" ? meaning_ru || meaning_en : "");

  const examples: WordExample[] = Array.isArray(raw.examples)
    ? raw.examples
        .filter(
          (ex) =>
            ex &&
            typeof ex.sentence === "string" &&
            ex.sentence.trim().length >= 8
        )
        .slice(0, 2)
        .map((ex, idx) => {
          const translationRu = (ex.translation_ru || "").trim();
          return {
            sentence: ex.sentence.trim(),
            translation_id: (ex.translation_id || "").trim(),
            ...(translationRu ? { translation_ru: translationRu } : {}),
            context:
              (ex.context || "").trim() || (idx === 0 ? "Daily" : "Academic"),
          };
        })
    : [];

  const missing: string[] = [];
  if (meaning_en.length < 4) missing.push("meaning_en");
  if (lang === "ru") {
    if (!meaning_ru || meaning_ru.length < 4) missing.push("meaning_ru");
  } else if (meaning_id.length < 4) {
    missing.push("meaning_id");
  }
  if (examples.length === 0) missing.push("examples");
  if (!pronunciation && !ipa) missing.push("pronunciation/ipa");

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const word_families: WordFamilyItem[] =
    type === "idiom"
      ? []
      : Array.isArray(raw.word_families)
        ? raw.word_families
            .filter((wf) => wf && typeof wf.word === "string" && wf.word.trim())
            .slice(0, 5)
            .map((wf) => ({
              word: wf.word.trim(),
              pos: (wf.pos || type).trim(),
            }))
        : [];

  const chunks: string[] = Array.isArray(raw.chunks)
    ? Array.from(
        new Set(
          raw.chunks
            .map((c) => String(c || "").replace(/\*\*/g, "").trim())
            .filter(Boolean)
        )
      ).slice(0, 3)
    : [];

  const cefr: CefrLevel =
    normalizeCefrLevel(raw.cefr) ?? builtInBilingual?.cefr ?? "B1";

  return {
    ok: true,
    data: {
      term: cleanTerm,
      pronunciation,
      ipa,
      cefr,
      type,
      meaning_id,
      ...(meaning_ru ? { meaning_ru } : {}),
      meaning_en,
      examples,
      synonyms: Array.isArray(raw.synonyms)
        ? raw.synonyms.map((s) => String(s).trim()).filter(Boolean).slice(0, 4)
        : [],
      antonyms: Array.isArray(raw.antonyms)
        ? raw.antonyms.map((s) => String(s).trim()).filter(Boolean).slice(0, 3)
        : [],
      word_families,
      chunks,
      register,
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      term?: string;
      sourceTag?: string;
      lang?: ApiLang;
      existingTerms?: string[];
      skipDuplicateCheck?: boolean;
    };
    const term = body.term?.trim() ?? "";
    const lang: ApiLang =
      body.lang === "en" ? "en" : body.lang === "ru" ? "ru" : "id";

    if (!term) {
      return NextResponse.json(
        {
          error:
            lang === "ru" ? "Введи слово или выражение." : "Term is required",
          code: "invalid_input",
        },
        { status: 400 }
      );
    }

    if (isObviouslyNonEnglishOrGibberish(term)) {
      return notEnglishResponse(lang);
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

    const rateLimit = checkAiRateLimit(
      request,
      lang,
      body.skipDuplicateCheck
        ? { bucket: "autofill-refresh", limit: 300, windowMs: 60_000 }
        : { bucket: "autofill", limit: 30, windowMs: 60_000 }
    );
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const existingCsv = formatCompactExistingTerms(existingList, 140);
    const hasExisting = existingCsv !== "none";

    const systemInstruction =
      lang === "ru"
        ? AUTOFILL_SYSTEM_INSTRUCTION.replace(
            "English-Indonesian",
            "English-Russian"
          )
        : AUTOFILL_SYSTEM_INSTRUCTION;
    const prompt = buildAutofillPrompt({
      term,
      sourceTag: body.sourceTag,
      lang,
      existingCsv,
    });

    const { properties: coreProperties, required: coreRequired } =
      getCoreSchemaConfig(lang);

    const responseSchema: Schema = hasExisting
      ? {
          type: Type.OBJECT,
          properties: {
            is_valid_english: { type: Type.BOOLEAN },
            duplicate: { type: Type.BOOLEAN },
            existing_term: { type: Type.STRING },
            ...coreProperties,
          },
          required: [
            "is_valid_english",
            "duplicate",
            "existing_term",
            ...coreRequired,
          ],
        }
      : {
          type: Type.OBJECT,
          properties: {
            is_valid_english: { type: Type.BOOLEAN },
            ...coreProperties,
          },
          required: ["is_valid_english", ...coreRequired],
        };

    const aiRes = await generateStructuredWithHybridModel<AutofillModelOutput>({
      tier: "flash",
      routeName: "api/autofill",
      systemInstruction,
      contents: prompt,
      maxOutputTokens: 2048,
      fallbackMaxTokens: 900,
      temperature: 0.15,
      timeoutMs: 8500,
      responseSchema,
      validate: (raw) => {
        if (typeof raw.is_valid_english !== "boolean") {
          return "missing is_valid_english";
        }
        if (raw.is_valid_english === false) {
          return null;
        }
        if (hasExisting && raw.duplicate === true) {
          return null;
        }
        const checked = validateAndNormalizeAutofillPayload(raw, term, lang);
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

    // Strict English-only gate: reject non-English words, foreign slang, and gibberish
    if (aiRes.data.is_valid_english === false) {
      return notEnglishResponse(lang);
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

    const validated = validateAndNormalizeAutofillPayload(
      aiRes.data,
      term,
      lang
    );
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
          : lang === "ru"
            ? normalized.meaning_ru || normalized.meaning_en
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
