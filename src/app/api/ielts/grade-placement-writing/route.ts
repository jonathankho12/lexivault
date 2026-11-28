import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { generateStructuredWithHybridModel } from "@/lib/gemini";
import { bandToCefr, countWords, roundToHalfBand } from "@/lib/ieltsUtils";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { CefrLevel, PlacementWritingGradeResult } from "@/types/ielts";

const VALID_CEFR = new Set<CefrLevel>(["A1", "A2", "B1", "B2", "C1", "C2"]);

function normalizeCefr(val: unknown, fallbackBand: number): CefrLevel {
  if (typeof val === "string" && VALID_CEFR.has(val.toUpperCase() as CefrLevel)) {
    return val.toUpperCase() as CefrLevel;
  }
  return bandToCefr(fallbackBand);
}

function gradePlacementWritingHeuristic(
  response: string
): PlacementWritingGradeResult {
  const trimmed = response.trim();
  const words = countWords(trimmed);
  const lower = trimmed.toLowerCase();

  // Check for obvious basic A1-A2 grammar/structural issues
  const basicErrorPatterns: Array<{
    regex: RegExp;
    en: string;
    id: string;
    ru: string;
  }> = [
    {
      regex: /\b(i am agree|he don't|she don't|it don't|people is|smartphones is|they was|we was)\b/i,
      en: "Subject-verb agreement and auxiliary verb accuracy",
      id: "Kesesuaian subjek–kata kerja dan kata kerja bantu (auxiliary)",
      ru: "Согласование подлежащего и сказуемого, а также вспомогательные глаголы",
    },
    {
      regex: /\b(smartphone help|phone make|it very|they very|this very|is help|are help|can helps|will helps)\b/i,
      en: "Basic verb inflection & missing 'be' verbs",
      id: "Konjugasi kata kerja dasar & penggunaan kata kerja 'be'",
      ru: "Базовые окончания глаголов и пропуск глагола-связки «be»",
    },
    {
      regex: /\b(a people|a informations|many time|much peoples|more better|more easier)\b/i,
      en: "Countable/uncountable nouns and comparative forms",
      id: "Kata benda countable/uncountable dan bentuk komparatif",
      ru: "Исчисляемые/неисчисляемые существительные и степени сравнения",
    },
  ];

  const matchedErrors = basicErrorPatterns.filter((p) => p.regex.test(trimmed));

  const sentences = trimmed
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => countWords(s) >= 3);

  const tokens = lower
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const uniqueTokens = new Set(tokens);
  const lexicalDiversity =
    tokens.length > 0 ? uniqueTokens.size / tokens.length : 0;

  const complexConnectors = [
    "although",
    "however",
    "whereas",
    "nevertheless",
    "consequently",
    "furthermore",
    "moreover",
    "because",
    "while",
    "unless",
    "despite",
    "since",
    "therefore",
    "nonetheless",
  ];
  const connectorHits = complexConnectors.filter((c) =>
    new RegExp(`\\b${c}\\b`, "i").test(lower)
  ).length;

  const advancedWords = [
    "productivity",
    "distraction",
    "notifications",
    "connectivity",
    "efficiency",
    "attention",
    "ultimately",
    "convenience",
    "essential",
    "overwhelming",
    "instantaneous",
    "fragment",
    "cognitive",
    "ubiquitous",
    "discipline",
  ];
  const advancedHits = advancedWords.filter((w) =>
    new RegExp(`\\b${w}\\b`, "i").test(lower)
  ).length;

  let hasBasicErrors = matchedErrors.length > 0 || words < 15 || sentences.length < 1;

  let grammarAccuracy = 5.0;
  let sentenceControl = 5.0;
  let lexicalRange = 5.0;

  if (words < 12) {
    grammarAccuracy = 3.0;
    sentenceControl = 3.0;
    lexicalRange = 3.0;
    hasBasicErrors = true;
  } else if (hasBasicErrors) {
    grammarAccuracy = matchedErrors.length >= 2 ? 3.5 : 4.0;
    sentenceControl = sentences.length >= 2 ? 4.5 : 3.5;
    lexicalRange = lexicalDiversity > 0.72 ? 4.5 : 4.0;
  } else {
    grammarAccuracy = roundToHalfBand(
      Math.min(6.5, 5.0 + (sentences.length >= 2 ? 0.5 : 0) + (connectorHits >= 1 ? 0.5 : 0))
    );
    sentenceControl = roundToHalfBand(
      Math.min(6.5, 4.5 + (sentences.length >= 2 ? 1.0 : 0) + (connectorHits >= 1 ? 0.5 : 0))
    );
    lexicalRange = roundToHalfBand(
      Math.min(
        6.5,
        4.5 +
          (lexicalDiversity >= 0.72 ? 0.5 : 0) +
          (advancedHits >= 1 ? 0.5 : 0) +
          (advancedHits >= 2 ? 0.5 : 0)
      )
    );
  }

  let band = roundToHalfBand(
    (grammarAccuracy + sentenceControl + lexicalRange) / 3
  );
  if (hasBasicErrors) {
    band = Math.min(band, words < 12 ? 3.5 : 4.5);
  }
  const cefr = bandToCefr(band);

  const weaknessesEn: string[] = matchedErrors.map((e) => e.en);
  const weaknessesId: string[] = matchedErrors.map((e) => e.id);
  const weaknessesRu: string[] = matchedErrors.map((e) => e.ru);

  if (words < 25) {
    weaknessesEn.push("Insufficient response length to demonstrate range");
    weaknessesId.push("Panjang tulisan belum cukup untuk menunjukkan variasi bahasa");
    weaknessesRu.push("Недостаточный объём текста, чтобы раскрыть словарный запас и грамматику");
  }
  if (connectorHits === 0) {
    weaknessesEn.push("Limited use of discourse markers and complex clauses");
    weaknessesId.push("Penggunaan kata penghubung dan klausa kompleks masih terbatas");
    weaknessesRu.push("Мало связующих слов и сложных придаточных предложений");
  }
  if (weaknessesEn.length === 0) {
    weaknessesEn.push("Higher-register lexical precision and syntactic variety");
    weaknessesId.push("Ketepatan diksi tingkat lanjut dan variasi struktur kalimat");
    weaknessesRu.push("Более точный выбор лексики высокого регистра и разнообразие синтаксиса");
  }

  return {
    cefr,
    band,
    grammar_accuracy: grammarAccuracy,
    sentence_control: sentenceControl,
    lexical_range: lexicalRange,
    has_basic_a1_a2_errors: hasBasicErrors,
    weaknesses_en: weaknessesEn.slice(0, 3),
    weaknesses_id: weaknessesId.slice(0, 3),
    weaknesses_ru: weaknessesRu.slice(0, 3),
    summary_en: hasBasicErrors
      ? `Your ${words}-word response communicates a basic idea, but foundational grammar and sentence structure errors keep it in the ${cefr} range.`
      : `Your ${words}-word response is clear and structured (${cefr}, est. Band ${band.toFixed(1)}). Expanding complex clauses and precise vocabulary will push you higher.`,
    summary_id: hasBasicErrors
      ? `Tulisanmu (${words} kata) sudah menyampaikan ide dasar, namun kesalahan grammar dan struktur kalimat dasar masih menahannya di level ${cefr}.`
      : `Tulisanmu (${words} kata) cukup jelas dan terstruktur (${cefr}, est. Band ${band.toFixed(1)}). Menambah klausa kompleks dan diksi presisi akan menaikkan levelmu.`,
    summary_ru: hasBasicErrors
      ? `Твой ответ (${words} сл.) передаёт основную мысль, но базовые ошибки в грамматике и структуре фраз пока удерживают его на уровне ${cefr}.`
      : `Твой ответ (${words} сл.) написан понятно и связно (${cefr}, ориент. Band ${band.toFixed(1)}). Более сложные конструкции и точная лексика помогут подняться выше.`,
    modelUsed: "heuristic-fallback",
  };
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, {
    bucket: "ielts-grade-placement-writing",
    limit: 15,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const body = (await request.json()) as {
      prompt?: string;
      response?: string;
      lang?: "en" | "id" | "ru";
    };

    const lang =
      body.lang === "en" ? "en" : body.lang === "ru" ? "ru" : "id";
    const isRu = lang === "ru";
    const promptText = body.prompt?.trim() ?? "";
    const userResponse = body.response?.trim() ?? "";

    if (!promptText || !userResponse) {
      return NextResponse.json(
        { error: "Prompt and response are required" },
        { status: 400 }
      );
    }

    const wordCount = countWords(userResponse);

    const examinerPrompt = `You are a STRICT, realistic CEFR & IELTS Placement Examiner.
Your job is to accurately diagnose the learner's TRUE written English level from A1 to C2 without grade inflation.

Micro-Writing Prompt:
"${promptText}"

Candidate Response (${wordCount} words):
"""
${userResponse}
"""

STRICT CALIBRATION RULES:
- A1 (Band 2.5–3.5): Very short (<15 words), gibberish, mostly non-English, or severe basic grammar breakdowns (missing verbs, broken word order). Set has_basic_a1_a2_errors = true.
- A2 (Band 4.0–4.5): Understandable simple ideas, but contains basic A1/A2 grammar errors (e.g., 3rd-person singular errors like "smartphone help", missing 'be' verbs, basic tense errors, or repetitive simple clauses). Set has_basic_a1_a2_errors = true.
- B1 (Band 5.0–5.5): Clear everyday English with mostly accurate simple/compound sentences, minor slips, limited lexical sophistication.
- B2 (Band 6.0–6.5): Well-controlled complex sentences, clear reasoning, natural collocations, rare minor slips, zero basic A1/A2 errors.
- C1 (Band 7.0–8.0): Effortless syntactic control, nuanced precision, idiomatic/academic register, virtually error-free.
- C2 (Band 8.5–9.0): Native-like precision, rhetorical sophistication, zero errors.

Return strictly valid JSON:
- "cefr": "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
- "band": number (2.5 to 9.0 in exact 0.5 increments, strictly aligned with cefr)
- "grammar_accuracy": number (2.5 to 9.0 in 0.5 increments)
- "sentence_control": number (2.5 to 9.0 in 0.5 increments)
- "lexical_range": number (2.5 to 9.0 in 0.5 increments)
- "has_basic_a1_a2_errors": boolean
- "weaknesses_en": array of 1–3 concise, specific English diagnostic weaknesses observed in this writing
${isRu ? '- "weaknesses_ru": array of 1–3 matching natural Russian translations (casual "ты" tone) of weaknesses_en\n' : '- "weaknesses_id": array of 1–3 matching Indonesian translations of weaknesses_en\n'}- "summary_en": 1–2 concise sentences diagnosing the writing in English
${isRu ? '- "summary_ru": 1–2 concise sentences diagnosing the writing in natural Russian (casual "ты" tone)' : '- "summary_id": 1–2 concise sentences diagnosing the writing in Indonesian'}`;

    const aiRes = await generateStructuredWithHybridModel<
      Omit<PlacementWritingGradeResult, "modelUsed">
    >({
      tier: "flash",
      routeName: "api/ielts/grade-placement-writing",
      contents: examinerPrompt,
      temperature: 0.2,
      timeoutMs: 12_000,
      fallbackTimeoutMs: 10_000,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          cefr: { type: Type.STRING },
          band: { type: Type.NUMBER },
          grammar_accuracy: { type: Type.NUMBER },
          sentence_control: { type: Type.NUMBER },
          lexical_range: { type: Type.NUMBER },
          has_basic_a1_a2_errors: { type: Type.BOOLEAN },
          weaknesses_en: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          ...(isRu
            ? {
                weaknesses_ru: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                summary_ru: { type: Type.STRING },
              }
            : {
                weaknesses_id: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                summary_id: { type: Type.STRING },
              }),
          summary_en: { type: Type.STRING },
        },
        required: [
          "cefr",
          "band",
          "grammar_accuracy",
          "sentence_control",
          "lexical_range",
          "has_basic_a1_a2_errors",
          "weaknesses_en",
          isRu ? "weaknesses_ru" : "weaknesses_id",
          "summary_en",
          isRu ? "summary_ru" : "summary_id",
        ],
      },
    });

    if (aiRes.ok && aiRes.data) {
      const grammarAcc = roundToHalfBand(
        Math.max(2.5, Math.min(9.0, Number(aiRes.data.grammar_accuracy) || 4.5))
      );
      const sentenceCtrl = roundToHalfBand(
        Math.max(2.5, Math.min(9.0, Number(aiRes.data.sentence_control) || 4.5))
      );
      const lexicalRng = roundToHalfBand(
        Math.max(2.5, Math.min(9.0, Number(aiRes.data.lexical_range) || 4.5))
      );
      let band = roundToHalfBand(
        Math.max(
          2.5,
          Math.min(
            9.0,
            Number(aiRes.data.band) || (grammarAcc + sentenceCtrl + lexicalRng) / 3
          )
        )
      );
      const hasBasic = Boolean(aiRes.data.has_basic_a1_a2_errors);
      if (hasBasic) {
        band = Math.min(band, 4.5);
      }

      const cefr = normalizeCefr(aiRes.data.cefr, band);
      const weaknessesEn = Array.isArray(aiRes.data.weaknesses_en)
        ? aiRes.data.weaknesses_en.filter(Boolean).slice(0, 3)
        : [];
      const weaknessesRu = Array.isArray(aiRes.data.weaknesses_ru)
        ? aiRes.data.weaknesses_ru.filter(Boolean).slice(0, 3)
        : isRu
          ? weaknessesEn
          : undefined;
      const weaknessesId = Array.isArray(aiRes.data.weaknesses_id)
        ? aiRes.data.weaknesses_id.filter(Boolean).slice(0, 3)
        : weaknessesRu ?? weaknessesEn;

      const summaryRu =
        aiRes.data.summary_ru?.trim() ||
        (isRu
          ? `Уровень оценён как ${cefr} (Band ${band.toFixed(1)}).`
          : undefined);

      const normalized: PlacementWritingGradeResult = {
        cefr,
        band,
        grammar_accuracy: grammarAcc,
        sentence_control: sentenceCtrl,
        lexical_range: lexicalRng,
        has_basic_a1_a2_errors: hasBasic,
        weaknesses_en: weaknessesEn,
        weaknesses_id: weaknessesId,
        ...(weaknessesRu ? { weaknesses_ru: weaknessesRu } : {}),
        summary_en:
          aiRes.data.summary_en?.trim() ||
          `Assessed at ${cefr} (Band ${band.toFixed(1)}).`,
        summary_id:
          aiRes.data.summary_id?.trim() ||
          summaryRu ||
          `Dinilai pada level ${cefr} (Band ${band.toFixed(1)}).`,
        ...(summaryRu ? { summary_ru: summaryRu } : {}),
        modelUsed: aiRes.modelUsed,
      };

      return NextResponse.json({
        result: normalized,
        source: "gemini-hybrid",
      });
    }

    return NextResponse.json({
      result: gradePlacementWritingHeuristic(userResponse),
      source: "fallback",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to grade placement micro-writing response" },
      { status: 500 }
    );
  }
}
