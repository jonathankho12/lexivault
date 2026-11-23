import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { generateStructuredWithHybridModel } from "@/lib/gemini";
import { countWords, roundToHalfBand } from "@/lib/ieltsUtils";
import type { SpeakingGradeResult, SpeakingPromptPack } from "@/types/ielts";

function buildFallbackSpeakingGrade(
  prompt: SpeakingPromptPack,
  transcript: string
): SpeakingGradeResult {
  const words = countWords(transcript);
  const sentences = transcript
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
  const uniqueWords = new Set(
    transcript
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

  const targetCount = prompt.part === "part2" ? 130 : 55;
  const fluencyScore = roundToHalfBand(
    3.5 + Math.min(4.5, (words / targetCount) * 3.8 + (sentences.length >= 3 ? 0.8 : 0))
  );
  const lexicalScore = roundToHalfBand(
    3.5 + Math.min(4.5, uniqueWords.size / 14)
  );
  const grammarScore = roundToHalfBand(
    3.5 + (sentences.length >= 3 ? 2.5 : 1.5) + (words >= targetCount * 0.7 ? 1.2 : 0.4)
  );
  const overall = roundToHalfBand(
    (fluencyScore + lexicalScore + grammarScore) / 3
  );

  return {
    overall_band: overall,
    criteria: {
      fluency_coherence: fluencyScore,
      lexical_resource: lexicalScore,
      grammatical_range: grammarScore,
    },
    summary_id:
      words < targetCount * 0.6
        ? `Jawaban lisanmu sepanjang ${words} kata masih cukup singkat untuk ${prompt.part.toUpperCase()}. Kembangkan alasan dengan contoh konkret dan kata hubung alami; sambungkan GEMINI_API_KEY untuk evaluasi Examiner Pro penuh.`
        : `Jawaban sepanjang ${words} kata sudah cukup mengalir dan menyentuh topik utama. Tingkatkan variasi idiom/kolokasi C1 agar skor Lexical Resource menembus Band 7.5+.`,
    phrase_upgrades: [
      {
        awkward:
          sentences[0] || "I think it is very good and helpful for my life.",
        natural:
          "Honestly, it has proven genuinely transformative in my day-to-day routine.",
        reason_id:
          "Mengganti kata umum 'very good' dengan frasa alami khas pembicara Band 8.0+.",
      },
    ],
    band_85_sample: prompt.fallbackBand85Sample,
    modelUsed: "heuristic-fallback",
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      prompt?: SpeakingPromptPack;
      transcript?: string;
      durationSec?: number;
    };

    const prompt = body.prompt;
    const transcript = body.transcript?.trim() ?? "";

    if (!prompt || !transcript) {
      return NextResponse.json(
        { error: "Speaking prompt and transcript are required" },
        { status: 400 }
      );
    }

    const examinerPrompt = `You are a certified Senior IELTS Speaking Examiner.
Evaluate the candidate's spoken transcript for IELTS Speaking ${prompt.part.toUpperCase()}.
Topic: "${prompt.topic}"
Question: "${prompt.question}"
${prompt.cueBullets ? `Cue Points: ${prompt.cueBullets.join("; ")}` : ""}
Spoken duration (approx): ${body.durationSec ?? 0}s

Candidate Transcript:
"""
${transcript}
"""

Assess strictly on 3 official IELTS Speaking criteria (each 0.0–9.0 in exact 0.5 increments):
1. "fluency_coherence": smoothness, logical progression, linking devices, response development.
2. "lexical_resource": idiomaticity, collocation precision, avoiding repetitive simple words.
3. "grammatical_range": natural mix of simple & complex structures without frequent errors.

Return strictly valid JSON:
- "overall_band": average rounded to nearest 0.5
- "criteria": { "fluency_coherence", "lexical_resource", "grammatical_range" }
- "summary_id": concise encouraging feedback in Indonesian (2-3 sentences).
- "phrase_upgrades": 2-3 specific awkward/simple phrases from the transcript -> { "awkward", "natural" (Band 8+ spoken English), "reason_id" (Indonesian) }.
- "band_85_sample": a fluent, natural spoken Band 8.5+ model answer tailored to this exact prompt.`;

    const aiRes = await generateStructuredWithHybridModel<
      Omit<SpeakingGradeResult, "modelUsed">
    >({
      tier: "pro",
      routeName: "api/ielts/grade-speaking",
      contents: examinerPrompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overall_band: { type: Type.NUMBER },
          criteria: {
            type: Type.OBJECT,
            properties: {
              fluency_coherence: { type: Type.NUMBER },
              lexical_resource: { type: Type.NUMBER },
              grammatical_range: { type: Type.NUMBER },
            },
            required: [
              "fluency_coherence",
              "lexical_resource",
              "grammatical_range",
            ],
          },
          summary_id: { type: Type.STRING },
          phrase_upgrades: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                awkward: { type: Type.STRING },
                natural: { type: Type.STRING },
                reason_id: { type: Type.STRING },
              },
              required: ["awkward", "natural", "reason_id"],
            },
          },
          band_85_sample: { type: Type.STRING },
        },
        required: [
          "overall_band",
          "criteria",
          "summary_id",
          "phrase_upgrades",
          "band_85_sample",
        ],
      },
    });

    if (aiRes.ok && aiRes.data?.criteria) {
      const fc = roundToHalfBand(aiRes.data.criteria.fluency_coherence || 5);
      const lr = roundToHalfBand(aiRes.data.criteria.lexical_resource || 5);
      const gr = roundToHalfBand(aiRes.data.criteria.grammatical_range || 5);
      const overall = roundToHalfBand((fc + lr + gr) / 3);

      const normalized: SpeakingGradeResult = {
        overall_band: overall,
        criteria: {
          fluency_coherence: fc,
          lexical_resource: lr,
          grammatical_range: gr,
        },
        summary_id: aiRes.data.summary_id,
        phrase_upgrades: Array.isArray(aiRes.data.phrase_upgrades)
          ? aiRes.data.phrase_upgrades.slice(0, 4)
          : [],
        band_85_sample:
          aiRes.data.band_85_sample || prompt.fallbackBand85Sample,
        modelUsed: aiRes.modelUsed,
      };

      return NextResponse.json({
        result: normalized,
        source: "gemini-hybrid",
      });
    }

    return NextResponse.json({
      result: buildFallbackSpeakingGrade(prompt, transcript),
      source: "fallback",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to grade IELTS speaking response" },
      { status: 500 }
    );
  }
}
