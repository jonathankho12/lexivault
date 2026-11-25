import { NextResponse } from "next/server";
import { Type, type Schema } from "@google/genai";
import {
  classifyGeminiError,
  generateStructuredWithHybridModel,
  logGeminiRouteError,
} from "@/lib/gemini";
import { enforceRateLimit } from "@/lib/rate-limit";
import type {
  GrammarCheckAlternative,
  GrammarCheckContext,
  GrammarCheckIssue,
  GrammarCheckResult,
  GrammarCheckVerdict,
} from "@/types/lexivault";

const MAX_TEXT_LENGTH = 600;

const VALID_CONTEXTS = new Set<GrammarCheckContext>([
  "auto",
  "casual",
  "academic",
  "work",
]);

const VALID_VERDICTS = new Set<GrammarCheckVerdict>([
  "correct",
  "fragment",
  "unnatural",
  "incorrect",
]);

const DEFAULT_VERDICT_LABELS: Record<GrammarCheckVerdict, string> = {
  correct: "Natural & Correct",
  fragment: "Sentence Fragment",
  unnatural: "Awkward / Unnatural",
  incorrect: "Grammar Issue",
};

const CONTEXT_GUIDANCE: Record<GrammarCheckContext, string> = {
  auto: "auto-detect register (casual, work, or academic)",
  casual: "Casual everyday English (contractions/idioms OK)",
  academic: "Academic / IELTS formal writing (precise, complete clauses, no slang)",
  work: "Work / professional English (clear, polite, concise)",
};

const GRAMMAR_CHECK_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    verdict: {
      type: Type.STRING,
      enum: ["correct", "fragment", "unnatural", "incorrect"],
    },
    verdictLabel: { type: Type.STRING },
    correctedText: { type: Type.STRING },
    explanation: { type: Type.STRING },
    issues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING },
          correction: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ["original", "correction", "reason"],
      },
    },
    alternatives: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          context: { type: Type.STRING },
          example: { type: Type.STRING },
          note: { type: Type.STRING },
        },
        required: ["context", "example", "note"],
      },
    },
  },
  required: [
    "verdict",
    "verdictLabel",
    "correctedText",
    "explanation",
    "issues",
    "alternatives",
  ],
};

function normalizeVerdict(raw: unknown): GrammarCheckVerdict {
  const normalized =
    typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (VALID_VERDICTS.has(normalized as GrammarCheckVerdict)) {
    return normalized as GrammarCheckVerdict;
  }
  if (normalized.includes("fragment") || normalized.includes("incomplete")) {
    return "fragment";
  }
  if (normalized.includes("unnatural") || normalized.includes("awkward")) {
    return "unnatural";
  }
  if (normalized.includes("incorrect") || normalized.includes("error")) {
    return "incorrect";
  }
  return "correct";
}

function normalizeIssues(raw: unknown): GrammarCheckIssue[] {
  if (!Array.isArray(raw)) return [];
  const list: GrammarCheckIssue[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const original =
      typeof record.original === "string" ? record.original.trim() : "";
    const correction =
      typeof record.correction === "string" ? record.correction.trim() : "";
    const reason =
      typeof record.reason === "string" ? record.reason.trim() : "";
    if (!original && !correction && !reason) continue;
    list.push({
      original: original || "—",
      correction: correction || "—",
      reason: reason || "Grammar or phrasing adjustment.",
    });
    if (list.length >= 8) break;
  }
  return list;
}

function normalizeAlternatives(
  raw: unknown,
  fallbackText: string
): GrammarCheckAlternative[] {
  const list: GrammarCheckAlternative[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const context =
        typeof record.context === "string" ? record.context.trim() : "";
      const example =
        typeof record.example === "string" ? record.example.trim() : "";
      const note = typeof record.note === "string" ? record.note.trim() : "";
      if (!example) continue;
      list.push({
        context: context || "Natural",
        example,
        note: note || "Natural phrasing for this situation.",
      });
      if (list.length >= 3) break;
    }
  }

  const defaultContexts = ["Casual", "Work", "Academic / IELTS"];
  while (list.length < 3) {
    const label = defaultContexts[list.length] ?? "Alternative";
    list.push({
      context: label,
      example: fallbackText,
      note: `Polished phrasing suitable for ${label.toLowerCase()} communication.`,
    });
  }

  return list;
}

function validateGrammarResult(
  data: Partial<GrammarCheckResult>
): string | null {
  if (typeof data.verdict !== "string" || !data.verdict.trim()) {
    return "missing verdict";
  }
  if (typeof data.correctedText !== "string" || !data.correctedText.trim()) {
    return "missing correctedText";
  }
  if (typeof data.explanation !== "string" || !data.explanation.trim()) {
    return "missing explanation";
  }
  if (!Array.isArray(data.alternatives) || data.alternatives.length < 1) {
    return "requires at least 1 context-aware alternative";
  }
  const hasValidAlt = data.alternatives.some(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof item.example === "string" &&
      item.example.trim().length > 0
  );
  if (!hasValidAlt) {
    return "incomplete alternatives items";
  }
  return null;
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, {
    bucket: "grammar-check",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    let body: { text?: unknown; context?: unknown };
    try {
      body = (await request.json()) as { text?: unknown; context?: unknown };
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    if (typeof body.text !== "string") {
      return NextResponse.json(
        { error: "Text is required." },
        { status: 400 }
      );
    }

    const text = body.text.trim();
    if (!text) {
      return NextResponse.json(
        { error: "Please enter text to check." },
        { status: 400 }
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const rawContext =
      typeof body.context === "string" ? body.context.trim().toLowerCase() : "auto";
    const context: GrammarCheckContext = VALID_CONTEXTS.has(
      rawContext as GrammarCheckContext
    )
      ? (rawContext as GrammarCheckContext)
      : "auto";

    const systemInstruction =
      "Fast English grammar, naturalness, and register checker. Return concise valid JSON matching the schema.";

    const prompt = `Check this English text (${context}: ${CONTEXT_GUIDANCE[context]}):
"""
${text}
"""

Verdict: "correct" (sound & natural), "fragment" (incomplete clause), "unnatural" (grammatical but awkward/wrong register), "incorrect" (grammar/spelling/punctuation error).
Return JSON:
- verdict, verdictLabel (2-4 words), correctedText (cleanest natural version), explanation (1-2 concise sentences)
- issues: [{original, correction, reason}] ([] if none)
- alternatives: 3 concise rewrites [{context, example, note}] for Casual, Work, Academic (put target context first).`;

    const aiRes = await generateStructuredWithHybridModel<
      Partial<GrammarCheckResult>
    >({
      tier: "flash",
      preferFastModel: true,
      disableThinking: true,
      timeoutMs: 9000,
      fallbackTimeoutMs: 6500,
      routeName: "api/grammar-check",
      systemInstruction,
      contents: prompt,
      responseSchema: GRAMMAR_CHECK_SCHEMA,
      maxOutputTokens: 900,
      fallbackMaxTokens: 900,
      temperature: 0.1,
      validate: validateGrammarResult,
    });

    if (!aiRes.ok) {
      return NextResponse.json(
        {
          error: aiRes.error.detail,
          code: aiRes.error.code,
        },
        { status: aiRes.error.status }
      );
    }

    const raw = aiRes.data;
    const verdict = normalizeVerdict(raw.verdict);
    const correctedText =
      typeof raw.correctedText === "string" && raw.correctedText.trim()
        ? raw.correctedText.trim()
        : text;
    const verdictLabel =
      typeof raw.verdictLabel === "string" && raw.verdictLabel.trim()
        ? raw.verdictLabel.trim()
        : DEFAULT_VERDICT_LABELS[verdict];
    const explanation =
      typeof raw.explanation === "string" && raw.explanation.trim()
        ? raw.explanation.trim()
        : "Grammar and phrasing evaluation completed.";

    const normalizedResult: GrammarCheckResult = {
      verdict,
      verdictLabel,
      correctedText,
      explanation,
      issues: normalizeIssues(raw.issues),
      alternatives: normalizeAlternatives(raw.alternatives, correctedText),
    };

    return NextResponse.json(normalizedResult);
  } catch (err) {
    const classified = classifyGeminiError(err);
    logGeminiRouteError("api/grammar-check", classified);
    return NextResponse.json(
      {
        error: classified.detail,
        code: classified.code,
      },
      { status: classified.status }
    );
  }
}
