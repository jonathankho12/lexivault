import { NextResponse } from "next/server";
import { Type, type Schema } from "@google/genai";
import {
  classifyGeminiError,
  generateStructuredWithHybridModel,
  logGeminiRouteError,
} from "@/lib/gemini";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { normalizeRegister } from "@/lib/utils";
import type { RegisterType, WordType } from "@/types/lexivault";

const MAX_BATCH_ITEMS = 12;
const DISTRACTOR_TIMEOUT_MS = 6500;

interface DistractorRequestItem {
  id?: string;
  term?: string;
  type?: WordType;
  register?: RegisterType;
  cefr?: string;
  meaning?: string;
}

interface SanitizedDistractorItem {
  id: string;
  term: string;
  type: WordType;
  register: RegisterType;
  cefr: string;
  meaning: string;
}

interface DistractorModelResponse {
  results?: Array<{
    id?: string;
    distractors?: string[];
  }>;
}

const VALID_TYPES = new Set<WordType>(["vocab", "idiom", "collocation"]);

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          distractors: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["id", "distractors"],
      },
    },
  },
  required: ["results"],
};

function sanitizeItems(raw: unknown): SanitizedDistractorItem[] {
  if (!Array.isArray(raw)) return [];
  const out: SanitizedDistractorItem[] = [];
  const seenIds = new Set<string>();

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as DistractorRequestItem;
    const id = String(item.id || "").trim().slice(0, 80);
    const term = String(item.term || "").trim().slice(0, 100);
    const meaning = String(item.meaning || "").trim().slice(0, 260);
    if (!id || !term || meaning.length < 4 || seenIds.has(id)) continue;

    seenIds.add(id);
    const type: WordType =
      item.type && VALID_TYPES.has(item.type) ? item.type : "vocab";
    const register: RegisterType = normalizeRegister(item.register, "Casual");
    const cefr = String(item.cefr || "B2").trim().toUpperCase().slice(0, 4);

    out.push({ id, term, type, register, cefr, meaning });
    if (out.length >= MAX_BATCH_ITEMS) break;
  }

  return out;
}

function cleanDistractorText(
  raw: string,
  targetTerm: string,
  correctMeaning: string
): string | null {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (cleaned.length < 6 || cleaned.length > 260) return null;
  const lower = cleaned.toLowerCase();
  const correctLower = correctMeaning.toLowerCase().trim();
  if (lower === correctLower) return null;
  // Avoid leaking the exact target term inside the distractor definition
  const termLower = targetTerm.toLowerCase().trim();
  if (termLower.length >= 4 && lower.includes(termLower)) {
    return null;
  }
  return cleaned;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      lang?: "en" | "id";
      items?: unknown;
    };

    const lang = body.lang === "en" ? "en" : "id";
    const rateLimit = checkAiRateLimit(request, lang, {
      bucket: "quiz-distractors",
      limit: 40,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const items = sanitizeItems(body.items);
    if (items.length === 0) {
      return NextResponse.json(
        { error: "At least one quiz item is required.", code: "invalid_input" },
        { status: 400 }
      );
    }

    const outputLanguage =
      lang === "en"
        ? "English"
        : "natural Bahasa Indonesia (matching the style of the correct meaning)";

    const serializedItems = items
      .map(
        (it) =>
          `- id="${it.id}" | term="${it.term}" | type=${it.type} | register=${it.register} | cefr=${it.cefr} | correct_meaning="${it.meaning}"`
      )
      .join("\n");

    const prompt = `Generate EXACTLY 3 hard, plausible WRONG definitions (distractors) in ${outputLanguage} for each quiz item below.

STRICT DISTRACTOR RULES (MANDATORY):
1. Exact Type & Part-of-Speech Match: Match the target's exact item type and grammatical framing (e.g., noun definition vs noun definitions, "To ..." verb phrase vs "To ..." verb phrases, figurative idiom meaning vs figurative idiom meanings, collocation meaning vs collocation meanings).
2. Exact Register Match: Match the target's register (${items.map((i) => i.register).filter((v, idx, arr) => arr.indexOf(v) === idx).join("/")}) — Academic vs Academic, Formal vs Formal, Casual vs Casual, Slang vs Slang.
3. Visual & Structural Uniformity: Match the sentence length, clause structure, and phrasing style of the correct_meaning closely so no option stands out visually.
4. Nearby Semantic Domain: Each distractor must come from a closely related semantic field or plausible conceptual trap — NEVER obviously unrelated, silly, or absurd — while remaining unambiguously FALSE for the target term.
5. Never paraphrase the correct meaning, never repeat another distractor, and never mention the target term itself.

Items:
${serializedItems}

Return compact JSON: { "results": [{ "id": "...", "distractors": ["...", "...", "..."] }] }`;

    const aiRes = await generateStructuredWithHybridModel<DistractorModelResponse>({
      tier: "flash",
      routeName: "api/quiz-distractors",
      systemInstruction:
        "Precision psychometric test writer for advanced English-Indonesian vocabulary quizzes. Return compact valid JSON only with 3 plausible, register-matched, length-matched wrong definitions per item.",
      contents: prompt,
      maxOutputTokens: Math.min(2600, Math.max(900, items.length * 220)),
      fallbackMaxTokens: Math.min(2000, Math.max(800, items.length * 180)),
      temperature: 0.45,
      timeoutMs: DISTRACTOR_TIMEOUT_MS,
      fallbackTimeoutMs: DISTRACTOR_TIMEOUT_MS,
      responseSchema: RESPONSE_SCHEMA,
      validate: (parsed) => {
        if (!Array.isArray(parsed.results) || parsed.results.length === 0) {
          return "empty results array";
        }
        const hasAny = parsed.results.some(
          (r) =>
            Boolean(r?.id) &&
            Array.isArray(r.distractors) &&
            r.distractors.some((d) => typeof d === "string" && d.trim().length >= 6)
        );
        return hasAny ? null : "no valid distractors";
      },
    });

    if (!aiRes.ok) {
      return NextResponse.json(
        {
          error: aiRes.error.detail,
          code: aiRes.error.code,
          detail: aiRes.error.rawMessage,
        },
        { status: aiRes.error.status }
      );
    }

    const itemById = new Map(items.map((it) => [it.id, it]));
    const distractorsById: Record<string, string[]> = {};

    for (const row of aiRes.data.results ?? []) {
      const id = String(row?.id || "").trim();
      const target = itemById.get(id);
      if (!target || !Array.isArray(row.distractors)) continue;

      const seen = new Set<string>([target.meaning.toLowerCase()]);
      const valid: string[] = [];
      for (const rawDist of row.distractors) {
        if (typeof rawDist !== "string") continue;
        const cleaned = cleanDistractorText(rawDist, target.term, target.meaning);
        if (!cleaned) continue;
        const key = cleaned.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        valid.push(cleaned);
        if (valid.length >= 3) break;
      }

      if (valid.length > 0) {
        distractorsById[id] = valid;
      }
    }

    return NextResponse.json({
      distractorsById,
      providerUsed: aiRes.providerUsed,
      modelUsed: aiRes.modelUsed,
    });
  } catch (err) {
    const classified = classifyGeminiError(err);
    logGeminiRouteError("api/quiz-distractors", classified);
    return NextResponse.json(
      {
        error: classified.detail,
        code: classified.code,
        detail: classified.rawMessage,
      },
      { status: classified.status }
    );
  }
}
