import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { generateStructuredWithHybridModel } from "@/lib/gemini";
import { countWords, roundToHalfBand } from "@/lib/ieltsUtils";
import { enforceRateLimit } from "@/lib/rate-limit";
import type {
  IeltsVocabItem,
  SpeakingGradeResult,
  SpeakingPromptPack,
} from "@/types/ielts";

function clampBand(val: unknown, fallback = 5.0): number {
  const num = typeof val === "number" && Number.isFinite(val) ? val : fallback;
  return roundToHalfBand(Math.max(3.0, Math.min(9.0, num)));
}

function buildFallbackSpeakingGrade(
  prompt: SpeakingPromptPack,
  transcript: string,
  lang: "en" | "id" | "ru" = "id"
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
  const fluencyScore = clampBand(
    3.0 +
      Math.min(
        4.0,
        (words / targetCount) * 3.2 + (sentences.length >= 4 ? 0.8 : 0)
      ),
    4.5
  );
  const lexicalScore = clampBand(
    3.0 + Math.min(4.0, uniqueWords.size / 16),
    4.5
  );
  const grammarScore = clampBand(
    3.0 +
      (sentences.length >= 4 ? 2.2 : 1.2) +
      (words >= targetCount * 0.7 ? 1.0 : 0.3),
    4.5
  );
  const overall = clampBand(
    (fluencyScore + lexicalScore + grammarScore) / 3,
    4.5
  );

  const isRu = lang === "ru";
  const isEn = lang === "en";

  return {
    overall_band: overall,
    criteria: {
      fluency_coherence: fluencyScore,
      lexical_resource: lexicalScore,
      grammatical_range: grammarScore,
    },
    criteria_feedback: isRu
      ? {
          fluency_coherence:
            words < targetCount * 0.6
              ? `Короткий ответ (${words} сл.) для ${prompt.part.toUpperCase()}; раскрывай мысль подробнее с причинами, примерами и естественными связками.`
              : `Хороший темп и логика на протяжении ${words} сл.; добавь более плавные разговорные связки, чтобы поднять связность речи.`,
          lexical_resource:
            uniqueWords.size < 25
              ? "Много повторяющейся базовой лексики. Используй более точные коллокации по теме и живые идиомы."
              : "Уверенная повседневная лексика; замени общие прилагательные на более точные и естественные формулировки.",
          grammatical_range:
            "Сочетай простые фразы с придаточными, условными конструкциями и контрастом времён, следя за точностью.",
        }
      : {
          fluency_coherence:
            words < targetCount * 0.6
              ? `Short response (${words} words) for ${prompt.part.toUpperCase()}; extend answers with reasons, examples, and natural discourse markers.`
              : `Maintains clear flow across ${words} words; add smoother signposting phrases to elevate coherence.`,
          lexical_resource:
            uniqueWords.size < 25
              ? "Relies on repetitive high-frequency words. Incorporate topic-specific collocations and natural idioms."
              : "Adequate everyday vocabulary; upgrade generic adjectives into more precise native-like phrasing.",
          grammatical_range:
            "Combine simple clauses with natural complex structures (relative clauses, conditionals, past/present contrast) with fewer tense slips.",
        },
    summary_id: isRu
      ? words < targetCount * 0.6
        ? `Твой устный ответ (${words} сл.) пока коротковат для ${prompt.part.toUpperCase()}. Развей аргумент с помощью конкретного примера и естественных слов-связок.`
        : `Ответ из ${words} сл. звучит связно и по теме. Добавь живые идиомы и устойчивые коллокации, чтобы поднять балл за Lexical Resource.`
      : isEn
        ? words < targetCount * 0.6
          ? `Your spoken response (${words} words) is brief for ${prompt.part.toUpperCase()}. Develop your points with concrete examples and natural discourse markers.`
          : `Your ${words}-word answer flows well on topic. Add more idiomatic phrasing and natural collocations to lift Lexical Resource.`
        : words < targetCount * 0.6
          ? `Jawaban lisanmu sepanjang ${words} kata masih cukup singkat untuk ${prompt.part.toUpperCase()}. Kembangkan alasan dengan contoh konkret dan kata hubung alami.`
          : `Jawaban sepanjang ${words} kata sudah cukup mengalir dan menyentuh topik utama. Tingkatkan variasi idiom & kolokasi natural agar skor Lexical Resource naik.`,
    phrase_upgrades: [
      {
        awkward:
          sentences[0] || "I think it is very good and helpful for my life.",
        natural:
          "Honestly, it has proven genuinely transformative in my day-to-day routine.",
        reason_id: isRu
          ? "Заменяет общую базовую фразу на живое разговорное выражение уровня Band 8.0+."
          : isEn
            ? "Replaces a generic phrase with natural Band 8.0+ spoken phrasing."
            : "Mengganti frasa umum dengan ungkapan lisan alami khas Band 8.0+.",
      },
    ],
    upgraded_vocabulary: (prompt.targetPhrases ?? []).slice(0, 4).map((phr) => ({
      term: phr,
      note: isRu
        ? "Естественное разговорное выражение высокого уровня для этой темы"
        : "Natural high-band spoken expression for this topic",
      cefr: "C1",
      category: "idiom",
    })),
    band_85_sample: prompt.fallbackBand85Sample,
    modelUsed: "heuristic-fallback",
  };
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, {
    bucket: "ielts-grade-speaking",
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const body = (await request.json()) as {
      prompt?: SpeakingPromptPack;
      transcript?: string;
      durationSec?: number;
      lang?: "en" | "id" | "ru";
    };

    const prompt = body.prompt;
    const transcript = body.transcript?.trim() ?? "";
    const words = countWords(transcript);
    const lang =
      body.lang === "en" ? "en" : body.lang === "ru" ? "ru" : "id";
    const feedbackLang =
      lang === "en"
        ? "English"
        : lang === "ru"
          ? 'natural Russian (casual "ты" study-buddy tone)'
          : "Indonesian";

    if (!prompt || !transcript) {
      return NextResponse.json(
        { error: "Speaking prompt and transcript are required" },
        { status: 400 }
      );
    }

    const examinerPrompt = `You are a STRICT, certified Senior IDP / British Council IELTS Speaking Examiner.
Evaluate the candidate's spoken transcript for IELTS Speaking ${prompt.part.toUpperCase()} realistically across the FULL 3.0–9.0 scale in exact 0.5 increments.
NEVER artificially inflate brief, hesitant, repetitive, or grammatically flawed responses to 7.0+.

Strict Calibration:
- Band 3.0–4.5: Very short/fragmented answer, basic A1/A2 vocabulary, frequent grammar mistakes that obscure meaning.
- Band 5.0–5.5: Answers the topic with noticeable repetition, limited linking devices, basic vocabulary, frequent grammatical errors in complex clauses.
- Band 6.0–6.5: Willing to speak at length, generally coherent, adequate vocabulary to discuss the topic, mix of simple & complex structures with some errors.
- Band 7.0–7.5: Speaks smoothly without noticeable effort, uses idiomatic/collocational language naturally, produces frequent error-free complex sentences.
- Band 8.0–9.0: Only for genuinely fluent, articulate, nuanced, near-native spoken English.

Topic: "${prompt.topic}"
Question: "${prompt.question}"
${prompt.cueBullets ? `Cue Points: ${prompt.cueBullets.join("; ")}` : ""}
Spoken duration (approx): ${body.durationSec ?? 0}s (${words} words)

Candidate Transcript:
"""
${transcript}
"""

Assess strictly on 3 official IELTS Speaking criteria (each 3.0–9.0 in exact 0.5 increments):
1. "fluency_coherence": flow, logical progression, discourse markers, full development of cue points.
2. "lexical_resource": idiomaticity, natural collocations, precision, avoiding repetitive simple words.
3. "grammatical_range": natural mix of simple & complex spoken structures with accuracy.

Return strictly valid JSON:
- "overall_band": average rounded to nearest 0.5 (3.0–9.0)
- "criteria": { "fluency_coherence", "lexical_resource", "grammatical_range" }
- "criteria_feedback": {
    "fluency_coherence": concrete 1-2 sentence justification in ${feedbackLang},
    "lexical_resource": concrete 1-2 sentence justification in ${feedbackLang},
    "grammatical_range": concrete 1-2 sentence justification in ${feedbackLang}
  }
- "summary_id": concise, strict, actionable feedback in ${feedbackLang} (2-3 sentences).
- "phrase_upgrades": 2-4 specific awkward/simple phrases from the transcript -> { "awkward", "natural" (native-like spoken English), "reason_id" (concise explanation in ${feedbackLang}) }.
- "upgraded_vocabulary": 4-5 natural native-like idioms, phrasal verbs, or collocations from the upgrades/model answer: { "term": exact English phrase (1-4 words), "note": brief meaning in ${feedbackLang}, "cefr": "B1"|"B2"|"C1"|"C2", "category": "vocab"|"idiom"|"collocation" }.
- "band_85_sample": a fluent, natural spoken Band 8.5+ model answer tailored to this exact prompt.`;

    const aiRes = await generateStructuredWithHybridModel<
      Omit<SpeakingGradeResult, "modelUsed">
    >({
      tier: "pro",
      routeName: "api/ielts/grade-speaking",
      contents: examinerPrompt,
      maxOutputTokens: 2200,
      fallbackMaxTokens: 1800,
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
          criteria_feedback: {
            type: Type.OBJECT,
            properties: {
              fluency_coherence: { type: Type.STRING },
              lexical_resource: { type: Type.STRING },
              grammatical_range: { type: Type.STRING },
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
          "phrase_upgrades",
          "upgraded_vocabulary",
          "band_85_sample",
        ],
      },
    });

    if (aiRes.ok && aiRes.data?.criteria) {
      const fc = clampBand(aiRes.data.criteria.fluency_coherence, 5.0);
      const lr = clampBand(aiRes.data.criteria.lexical_resource, 5.0);
      const gr = clampBand(aiRes.data.criteria.grammatical_range, 5.0);
      const overall = clampBand((fc + lr + gr) / 3, 5.0);

      const rawVocab: IeltsVocabItem[] = Array.isArray(
        aiRes.data.upgraded_vocabulary
      )
        ? aiRes.data.upgraded_vocabulary
            .filter((v) => v && typeof v.term === "string" && v.term.trim())
            .slice(0, 6)
        : [];

      const normalized: SpeakingGradeResult = {
        overall_band: overall,
        criteria: {
          fluency_coherence: fc,
          lexical_resource: lr,
          grammatical_range: gr,
        },
        criteria_feedback: aiRes.data.criteria_feedback,
        summary_id: aiRes.data.summary_id,
        phrase_upgrades: Array.isArray(aiRes.data.phrase_upgrades)
          ? aiRes.data.phrase_upgrades.slice(0, 4)
          : [],
        upgraded_vocabulary: rawVocab,
        band_85_sample:
          aiRes.data.band_85_sample || prompt.fallbackBand85Sample,
        modelUsed: aiRes.modelUsed,
      };

      return NextResponse.json({
        result: normalized,
        source: aiRes.providerUsed,
      });
    }

    return NextResponse.json({
      result: buildFallbackSpeakingGrade(prompt, transcript, lang),
      source: "fallback",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to grade IELTS speaking response" },
      { status: 500 }
    );
  }
}
