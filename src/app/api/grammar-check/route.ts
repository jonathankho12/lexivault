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
  auto: "Auto-detect the most likely intended register (casual, work, or academic) and evaluate accordingly.",
  casual:
    "Target context is Casual / everyday conversational English (contractions, idioms, relaxed phrasing are natural).",
  academic:
    "Target context is Academic / IELTS Writing (formal tone, precise vocabulary, complete well-structured clauses, no slang).",
  work:
    "Target context is Work / professional communication (polite, concise, clear, natural business English).",
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
  if (!Array.isArray(data.alternatives) || data.alternatives.length < 3) {
    return "requires 3 context-aware alternatives";
  }
  const hasValidAlt = data.alternatives.every(
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
      "You are an expert English linguist, grammar checker, and register coach. Evaluate grammar, sentence completeness, naturalness, and register appropriateness accurately. Return strictly valid JSON matching the exact schema with 3 distinct context-aware alternative rewrites.";

    const prompt = `Analyze the following English text for grammar, completeness, naturalness, and register fit.

Context setting: ${context} (${CONTEXT_GUIDANCE[context]})
User text:
"""
${text}
"""

Classification rules for "verdict":
- "correct": Grammatically sound, complete, and natural for the target context (or valid standalone idiomatic phrase if clearly complete in context).
- "fragment": Missing a subject, finite verb, or main clause; incomplete thought that needs completion.
- "unnatural": Grammatically understandable, but awkward, overly literal, unidiomatic, or mismatched to the requested register/context.
- "incorrect": Contains clear grammar, tense, agreement, preposition, article, spelling, or punctuation mistakes.

Output requirements (strict JSON):
1. "verdict": one of "correct" | "fragment" | "unnatural" | "incorrect".
2. "verdictLabel": short, clear 2-4 word status badge (e.g., "Natural & Correct", "Sentence Fragment", "Awkward Phrasing", "Grammar Error").
3. "correctedText": the cleanest corrected and natural version tailored to the selected context. If already completely natural and error-free, return the polished input.
4. "explanation": concise 1-3 sentence explanation in clear English explaining what is wrong, incomplete, unnatural, or why it already works well.
5. "issues": array of specific fixes [{ "original": "...", "correction": "...", "reason": "..." }]. Return [] when there are no errors or phrasing issues.
6. "alternatives": ALWAYS provide exactly 3 distinct, natural context-aware rewrites [{ "context": "...", "example": "...", "note": "..." }] covering contrasting registers (e.g. "Casual Spoken", "Work / Professional", "Academic / IELTS"), putting the requested context style first when applicable.`;

    const aiRes = await generateStructuredWithHybridModel<
      Partial<GrammarCheckResult>
    >({
      tier: "flash",
      routeName: "api/grammar-check",
      systemInstruction,
      contents: prompt,
      responseSchema: GRAMMAR_CHECK_SCHEMA,
      maxOutputTokens: 1200,
      fallbackMaxTokens: 1200,
      temperature: 0.2,
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
