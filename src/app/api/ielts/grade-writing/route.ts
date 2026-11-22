import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { generateStructuredWithHybridModel } from "@/lib/gemini";
import { gradeWritingHeuristic, roundToHalfBand } from "@/lib/ieltsUtils";
import type { WritingGradeResult, WritingTaskPack } from "@/types/ielts";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      prompt?: WritingTaskPack;
      essay?: string;
    };

    const task = body.prompt;
    const essay = body.essay?.trim() ?? "";

    if (!task || !essay) {
      return NextResponse.json(
        { error: "Writing prompt and essay are required" },
        { status: 400 }
      );
    }

    const examinerPrompt = `You are a strict, certified Senior IELTS Academic Writing Examiner.
Evaluate the candidate's response using the 4 official IELTS Writing Band Descriptors (each scored 0.0 to 9.0 in exact 0.5 increments).

Task Type: ${task.taskType === "task1" ? "Academic Task 1 (minimum 150 words)" : "Academic Task 2 (minimum 250 words)"}
Prompt: "${task.prompt}"
${task.chartData ? `Dataset: ${JSON.stringify(task.chartData)}` : ""}

Candidate Essay:
"""
${essay}
"""

Return strictly valid JSON:
- "overall_band": weighted overall band rounded to nearest 0.5 (average of the 4 criteria)
- "criteria": {
    "task_response": number (0.0-9.0 in 0.5 steps),
    "coherence_cohesion": number (0.0-9.0 in 0.5 steps),
    "lexical_resource": number (0.0-9.0 in 0.5 steps),
    "grammatical_range": number (0.0-9.0 in 0.5 steps)
  }
- "summary_id": concise, constructive examiner critique in Indonesian (2-3 sentences covering strengths, word count sufficiency, and highest-impact improvement).
- "sentence_upgrades": array of 2-4 specific sentences extracted from the candidate's essay showing { "original": exact weak/improvable sentence, "improved": C1/C2 Band 8.5+ rewrite, "reason_id": brief Indonesian explanation }.
- "band_85_sample": a complete Band 8.5+ model answer tailored directly to this prompt so the learner can compare structure and academic phrasing.`;

    // Hybrid Strategy: Pro model primary for deep rubric grading, automatic fallback to Flash on 429/unavailable
    const aiRes = await generateStructuredWithHybridModel<
      Omit<WritingGradeResult, "modelUsed">
    >({
      tier: "pro",
      contents: examinerPrompt,
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
          summary_id: { type: Type.STRING },
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
          band_85_sample: { type: Type.STRING },
        },
        required: [
          "overall_band",
          "criteria",
          "summary_id",
          "sentence_upgrades",
          "band_85_sample",
        ],
      },
    });

    if (aiRes?.data?.criteria) {
      const tr = roundToHalfBand(aiRes.data.criteria.task_response || 5);
      const cc = roundToHalfBand(aiRes.data.criteria.coherence_cohesion || 5);
      const lr = roundToHalfBand(aiRes.data.criteria.lexical_resource || 5);
      const gr = roundToHalfBand(aiRes.data.criteria.grammatical_range || 5);
      const overall = roundToHalfBand((tr + cc + lr + gr) / 4);

      const normalized: WritingGradeResult = {
        overall_band: overall,
        criteria: {
          task_response: tr,
          coherence_cohesion: cc,
          lexical_resource: lr,
          grammatical_range: gr,
        },
        summary_id: aiRes.data.summary_id,
        sentence_upgrades: Array.isArray(aiRes.data.sentence_upgrades)
          ? aiRes.data.sentence_upgrades.slice(0, 4)
          : [],
        band_85_sample:
          aiRes.data.band_85_sample || task.fallbackBand85Sample,
        modelUsed: aiRes.modelUsed,
      };

      return NextResponse.json({
        result: normalized,
        source: "gemini-hybrid",
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
