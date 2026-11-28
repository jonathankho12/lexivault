import { NextResponse } from "next/server";
import { Type, type Schema } from "@google/genai";
import { getBuiltInRussianMeaning } from "@/lib/bilingualCache";
import {
  classifyGeminiError,
  generateStructuredWithHybridModel,
  logGeminiRouteError,
} from "@/lib/gemini";
import { checkAiRateLimit } from "@/lib/rate-limit";

interface TranslateRuInputItem {
  id: string;
  term: string;
  meaning_en: string;
  type?: string;
}

interface TranslateRuModelOutput {
  translations?: Array<{
    id?: string;
    meaning_ru?: string;
  }>;
}

const MAX_BATCH_SIZE = 10;

const TRANSLATE_RU_SYSTEM_INSTRUCTION =
  "Concise English-to-Russian lexicographer. For each English word, idiom, or collocation and its English definition, produce one crisp, natural Russian definition (for idioms, give the figurative Russian meaning — never a literal word-for-word translation). Keep each meaning_ru concise (1 short sentence). Return strictly valid JSON matching the exact schema and preserve every input id.";

const TRANSLATE_RU_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    translations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          meaning_ru: { type: Type.STRING },
        },
        required: ["id", "meaning_ru"],
      },
    },
  },
  required: ["translations"],
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      items?: TranslateRuInputItem[];
    };

    const rawItems = Array.isArray(body.items) ? body.items : [];
    const cleanedItems = rawItems
      .filter(
        (it): it is TranslateRuInputItem =>
          Boolean(it) &&
          typeof it.id === "string" &&
          it.id.trim().length > 0 &&
          typeof it.term === "string" &&
          it.term.trim().length > 0
      )
      .slice(0, MAX_BATCH_SIZE)
      .map((it) => ({
        id: it.id.trim(),
        term: it.term.trim(),
        meaning_en: String(it.meaning_en || "").trim(),
        type: typeof it.type === "string" ? it.type.trim() : "vocab",
      }));

    if (cleanedItems.length === 0) {
      return NextResponse.json(
        { error: "No valid vocabulary items provided.", code: "invalid_input" },
        { status: 400 }
      );
    }

    // Resolve any items already present in the built-in Russian dictionary without spending AI tokens
    const resolvedLocally: Array<{ id: string; meaning_ru: string }> = [];
    const toTranslate: TranslateRuInputItem[] = [];

    for (const item of cleanedItems) {
      const builtInRu = getBuiltInRussianMeaning(item.term);
      if (builtInRu) {
        resolvedLocally.push({ id: item.id, meaning_ru: builtInRu });
      } else {
        toTranslate.push(item);
      }
    }

    if (toTranslate.length === 0) {
      return NextResponse.json({
        translations: resolvedLocally,
        source: "builtin",
      });
    }

    const rateLimit = checkAiRateLimit(request, "ru", {
      bucket: "translate-ru-batch",
      limit: 20,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const listBlock = toTranslate
      .map(
        (it, idx) =>
          `${idx + 1}. id="${it.id}" | term="${it.term}" (${it.type}) | meaning_en="${it.meaning_en || it.term}"`
      )
      .join("\n");

    const prompt = `Translate the meanings of these ${toTranslate.length} English vocabulary entries into concise, natural Russian definitions.
For idioms, explain the figurative meaning in natural Russian (never translate literally).
Preserve each exact "id" value.

Items:
${listBlock}`;

    const aiRes = await generateStructuredWithHybridModel<TranslateRuModelOutput>(
      {
        tier: "flash",
        routeName: "api/translate-ru",
        systemInstruction: TRANSLATE_RU_SYSTEM_INSTRUCTION,
        contents: prompt,
        maxOutputTokens: 1200,
        fallbackMaxTokens: 900,
        temperature: 0.15,
        timeoutMs: 10_000,
        responseSchema: TRANSLATE_RU_SCHEMA,
        validate: (raw) => {
          if (!Array.isArray(raw.translations) || raw.translations.length === 0) {
            return "empty translations array";
          }
          const validCount = raw.translations.filter(
            (t) =>
              t &&
              typeof t.id === "string" &&
              t.id.trim().length > 0 &&
              typeof t.meaning_ru === "string" &&
              t.meaning_ru.trim().length >= 2
          ).length;
          return validCount > 0 ? null : "no valid Russian translations returned";
        },
      }
    );

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

    const validIds = new Set(toTranslate.map((it) => it.id));
    const aiTranslations = (aiRes.data.translations ?? [])
      .filter(
        (t): t is { id: string; meaning_ru: string } =>
          Boolean(t) &&
          typeof t.id === "string" &&
          validIds.has(t.id.trim()) &&
          typeof t.meaning_ru === "string" &&
          t.meaning_ru.trim().length >= 2
      )
      .map((t) => ({
        id: t.id.trim(),
        meaning_ru: t.meaning_ru.trim(),
      }));

    return NextResponse.json({
      translations: [...resolvedLocally, ...aiTranslations],
      source: "gemini",
      modelUsed: aiRes.modelUsed,
    });
  } catch (err) {
    const classified = classifyGeminiError(err);
    logGeminiRouteError("api/translate-ru", classified);
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
