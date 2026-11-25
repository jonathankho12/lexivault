import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { generateStructuredWithHybridModel } from "@/lib/gemini";
import {
  countWords,
  gradeWritingHeuristic,
  roundToHalfBand,
} from "@/lib/ieltsUtils";
import { enforceRateLimit } from "@/lib/rate-limit";
import type {
  CefrLevel,
  IeltsVocabItem,
  WritingGradeResult,
  WritingTaskPack,
} from "@/types/ielts";

function clampBand(val: unknown, fallback = 5.0): number {
  const num = typeof val === "number" && Number.isFinite(val) ? val : fallback;
  return roundToHalfBand(Math.max(3.0, Math.min(9.0, num)));
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, {
    bucket: "ielts-grade-writing",
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const body = (await request.json()) as {
      prompt?: WritingTaskPack;
      essay?: string;
      lang?: "en" | "id";
      cefrLevel?: CefrLevel;
    };

    const task = body.prompt;
    const essay = body.essay?.trim() ?? "";
    const words = countWords(essay);
    const feedbackLang = body.lang === "en" ? "English" : "Indonesian";

    if (!task || !essay) {
      return NextResponse.json(
        { error: "Writing prompt and essay are required" },
        { status: 400 }
      );
    }

    const examinerPrompt = `You are a STRICT, certified Senior IDP / British Council IELTS Academic Writing Examiner.
Grade the candidate's response realistically across the FULL 3.0–9.0 band scale in exact 0.5 increments.
NEVER artificially inflate weak, under-length, repetitive, or error-prone essays to 7.0+.

Strict Calibration Rules:
- Band 3.0–4.5: Severe under-length (<60% of minimum), off-topic, frequent basic grammar/tense/article/spelling errors, very limited A1/A2 vocabulary, poor paragraphing.
- Band 5.0–5.5: Partially addresses task or misses overview (Task 1) / clear position (Task 2), repetitive simple connectors, noticeable grammatical & collocation errors.
- Band 6.0–6.5: Addresses all parts adequately with clear progression, adequate academic vocabulary with occasional awkward collocations, mix of simple & complex sentences with some errors.
- Band 7.0–7.5: Clear overview/position, well-developed ideas, effective paragraphing, less common academic lexical items with natural collocations, frequent error-free complex sentences.
- Band 8.0–9.0: Only for genuinely near-native, nuanced, virtually error-free academic writing with sophisticated precision.
- Length check: Minimum is ${task.minWords} words. Candidate wrote ${words} words. If significantly below ${task.minWords} words, penalize Task ${task.taskType === "task1" ? "Achievement" : "Response"} realistically.

Task Type: ${task.taskType === "task1" ? "Academic Task 1 (minimum 150 words)" : "Academic Task 2 (minimum 250 words)"}
Prompt: "${task.prompt}"
${task.chartData ? `Dataset: ${JSON.stringify(task.chartData)}` : ""}

Candidate Essay (${words} words):
"""
${essay}
"""

Return strictly valid JSON:
- "overall_band": average of the 4 criteria rounded to nearest 0.5 (3.0–9.0)
- "criteria": {
    "task_response": number (3.0–9.0 in 0.5 steps),
    "coherence_cohesion": number (3.0–9.0 in 0.5 steps),
    "lexical_resource": number (3.0–9.0 in 0.5 steps),
    "grammatical_range": number (3.0–9.0 in 0.5 steps)
  }
- "criteria_feedback": {
    "task_response": concrete 1-2 sentence examiner justification in ${feedbackLang},
    "coherence_cohesion": concrete 1-2 sentence examiner justification in ${feedbackLang},
    "lexical_resource": concrete 1-2 sentence examiner justification in ${feedbackLang},
    "grammatical_range": concrete 1-2 sentence examiner justification in ${feedbackLang}
  }
- "summary_id": concise, strict, actionable examiner summary in ${feedbackLang} (2-3 sentences).
- "inline_errors": array of 3-6 specific grammar, vocabulary, spelling, or collocation mistakes found verbatim in the candidate's essay: { "original": exact phrase/clause from user's essay, "corrected": corrected academic phrase, "reason": concise explanation in ${feedbackLang} }.
- "sentence_upgrades": array of 2-3 sentences from the essay rewritten to Band 8.0+ style: { "original", "improved", "reason_id": brief explanation in ${feedbackLang} }.
- "plus_one_band_rewrite": a targeted rewrite of the candidate's OWN response (preserving their core ideas, ~1.0 band higher than their current overall_band, capped at 9.0). Wrap 4-7 upgraded vocabulary words or collocations inside **double asterisks** like **mitigate the impact** so the UI can highlight them.
- "upgraded_vocabulary": array of 4-6 high-value words/collocations/idioms used in the +1.0 Band rewrite or feedback: { "term": exact English word/collocation (1-4 words), "note": brief meaning/usage note in ${feedbackLang}, "cefr": "B1"|"B2"|"C1"|"C2", "category": "vocab"|"idiom"|"collocation" }.
- "band_85_sample": a complete Band 8.5+ model answer tailored directly to this prompt.`;

    const aiRes = await generateStructuredWithHybridModel<
      Omit<WritingGradeResult, "modelUsed">
    >({
      tier: "pro",
      routeName: "api/ielts/grade-writing",
      contents: examinerPrompt,
      maxOutputTokens: 2600,
      fallbackMaxTokens: 2048,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overall_band: { type: Type.NUMBER },
          criteria: {
            type: Type.OBJECT,
            properties: {
              task_response: { type: Type.NUMBER },
              coherence_cohesion: { type: Type.NUMBER },
              lexical_resource: { type: Type.NUMBER },
              grammatical_range: { type: Type.NUMBER },
            },
            required: [
              "task_response",
              "coherence_cohesion",
              "lexical_resource",
              "grammatical_range",
            ],
          },
          criteria_feedback: {
            type: Type.OBJECT,
            properties: {
              task_response: { type: Type.STRING },
              coherence_cohesion: { type: Type.STRING },
              lexical_resource: { type: Type.STRING },
              grammatical_range: { type: Type.STRING },
            },
            required: [
              "task_response",
              "coherence_cohesion",
              "lexical_resource",
              "grammatical_range",
            ],
          },
          summary_id: { type: Type.STRING },
          inline_errors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: { type: Type.STRING },
                corrected: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
              required: ["original", "corrected", "reason"],
            },
          },
          sentence_upgrades: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: { type: Type.STRING },
                improved: { type: Type.STRING },
                reason_id: { type: Type.STRING },
              },
              required: ["original", "improved", "reason_id"],
            },
          },
          plus_one_band_rewrite: { type: Type.STRING },
          upgraded_vocabulary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                note: { type: Type.STRING },
                cefr: {
                  type: Type.STRING,
                  enum: ["A2", "B1", "B2", "C1", "C2"],
                },
                category: {
                  type: Type.STRING,
                  enum: ["vocab", "idiom", "collocation"],
                },
              },
              required: ["term", "note"],
            },
          },
          band_85_sample: { type: Type.STRING },
        },
        required: [
          "overall_band",
          "criteria",
          "criteria_feedback",
          "summary_id",
          "inline_errors",
          "sentence_upgrades",
          "plus_one_band_rewrite",
          "upgraded_vocabulary",
          "band_85_sample",
        ],
      },
    });

    if (aiRes.ok && aiRes.data?.criteria) {
      const tr = clampBand(aiRes.data.criteria.task_response, 5.0);
      const cc = clampBand(aiRes.data.criteria.coherence_cohesion, 5.0);
      const lr = clampBand(aiRes.data.criteria.lexical_resource, 5.0);
      const gr = clampBand(aiRes.data.criteria.grammatical_range, 5.0);
      const overall = clampBand((tr + cc + lr + gr) / 4, 5.0);
      const targetUpgradeBand = roundToHalfBand(Math.min(9.0, overall + 1.0));

      const rawVocab: IeltsVocabItem[] = Array.isArray(
        aiRes.data.upgraded_vocabulary
      )
        ? aiRes.data.upgraded_vocabulary
            .filter((v) => v && typeof v.term === "string" && v.term.trim())
            .slice(0, 6)
        : [];

      const normalized: WritingGradeResult = {
        overall_band: overall,
        criteria: {
          task_response: tr,
          coherence_cohesion: cc,
          lexical_resource: lr,
          grammatical_range: gr,
        },
        criteria_feedback: aiRes.data.criteria_feedback,
        summary_id: aiRes.data.summary_id,
        inline_errors: Array.isArray(aiRes.data.inline_errors)
          ? aiRes.data.inline_errors
              .filter((e) => e && e.original && e.corrected)
              .slice(0, 6)
          : [],
        sentence_upgrades: Array.isArray(aiRes.data.sentence_upgrades)
          ? aiRes.data.sentence_upgrades.slice(0, 4)
          : [],
        plus_one_band_rewrite: aiRes.data.plus_one_band_rewrite || "",
        target_upgrade_band: targetUpgradeBand,
        upgraded_vocabulary: rawVocab,
        band_85_sample:
          aiRes.data.band_85_sample || task.fallbackBand85Sample,
        modelUsed: aiRes.modelUsed,
      };

      return NextResponse.json({
        result: normalized,
        source: aiRes.providerUsed,
      });
    }

    return NextResponse.json({
      result: gradeWritingHeuristic(task, essay),
      source: "fallback",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to grade IELTS writing response" },
      { status: 500 }
    );
  }
}
