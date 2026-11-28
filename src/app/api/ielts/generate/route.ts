import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { generateStructuredWithHybridModel } from "@/lib/gemini";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  FALLBACK_LISTENING_PACKS,
  FALLBACK_READING_PACKS,
  FALLBACK_SPEAKING_PACKS,
  FALLBACK_WRITING_PACKS,
} from "@/lib/ieltsMockData";
import type {
  CefrLevel,
  IeltsSubTab,
  ListeningSectionPack,
  ReadingPassagePack,
  SpeakingPart,
  SpeakingPromptPack,
  WritingTaskPack,
} from "@/types/ielts";

const VALID_CEFR = new Set<CefrLevel>(["A1", "A2", "B1", "B2", "C1", "C2"]);

function normalizeCefr(raw?: string): CefrLevel {
  const upper = (raw ?? "").trim().toUpperCase() as CefrLevel;
  return VALID_CEFR.has(upper) ? upper : "B2";
}

function pickFallback<T extends { id: string }>(
  items: T[],
  excludeIds: string[] = []
): T {
  const unseen = items.filter((item) => !excludeIds.includes(item.id));
  const pool = unseen.length > 0 ? unseen : items;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, {
    bucket: "ielts-generate",
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const body = (await request.json()) as {
      skill?: IeltsSubTab;
      taskType?: "task1" | "task2";
      speakingPart?: SpeakingPart;
      cefrLevel?: CefrLevel;
      excludeIds?: string[];
      lang?: "en" | "id" | "ru";
    };

    const skill: IeltsSubTab =
      body.skill === "listening" ||
      body.skill === "writing" ||
      body.skill === "speaking"
        ? body.skill
        : "reading";
    const cefrLevel = normalizeCefr(body.cefrLevel);
    const excludeIds = Array.isArray(body.excludeIds) ? body.excludeIds : [];
    const lang =
      body.lang === "en" ? "en" : body.lang === "ru" ? "ru" : "id";
    const isRu = lang === "ru";

    if (skill === "reading") {
      const readingTargetLevel: CefrLevel =
        cefrLevel === "A1" ? "A2" : cefrLevel;

      const explanationPromptNote = isRu
        ? `In both "explanation_en" and "explanation_ru" (natural Russian, casual "ты" tone), explicitly explain the IELTS distinction between FALSE (directly contradicted by the passage) vs NOT GIVEN (information not mentioned / unverifiable in the passage). Provide "explanation_en" and "explanation_ru" on every question.`
        : `In both "explanation_en" and "explanation_id", explicitly explain the IELTS distinction between FALSE (directly contradicted by the passage) vs NOT GIVEN (information not mentioned / unverifiable in the passage).`;

      const vocabNoteLang = isRu
        ? 'brief Russian meaning (casual "ты" tone)'
        : "brief English definition";

      const prompt = `Generate a brand-new, authentic IELTS Reading passage adapted to CEFR ${readingTargetLevel} level with 6 exam-style questions.
Adapt passage vocabulary, sentence complexity, and concept density realistically for CEFR ${readingTargetLevel}:
- A2/B1: Clear, accessible general-interest / semi-academic topic (~75-95 words per paragraph).
- B2: Upper-intermediate academic topic (~85-110 words per paragraph).
- C1/C2: Dense scholarly IELTS Academic passage (~95-125 words per paragraph).

Keep the passage, title, topic, question prompts, options, answers, and evidence_quote strictly in English.
Return strictly valid JSON matching the schema:
- "id": unique string id like "read-ai-..."
- "title": engaging article title
- "topic": subject field
- "cefrLevel": "${readingTargetLevel}"
- "recommendedMinutes": integer (10 for A2/B1, 12 for B2/C1/C2)
- "paragraphs": exactly 4 cohesive paragraphs (corresponding to Paragraph A, B, C, D — do NOT prefix the text with "Paragraph A:").
- "questions": exactly 6 questions mixing:
  1. 2 "tfng" questions with options ["TRUE", "FALSE", "NOT GIVEN"] — include at least ONE FALSE and ONE NOT GIVEN. ${explanationPromptNote}
  2. 2 "fill_blank" (Summary Completion) questions using _____ with "wordLimit" set to "ONE WORD ONLY" or "NO MORE THAN TWO WORDS", exact "answer", and lowercase variants in "acceptedAnswers".
  3. 1 "matching_headings" question asking which heading best summarizes a specific paragraph (e.g. "Choose the best heading for Paragraph B"), with 4 concise Roman-numeral options ("i. ...", "ii. ...", "iii. ...", "iv. ...") and "paragraphRef": "Paragraph B".
  4. 1 "mcq" nuanced inference question with 4 options.
  Every question MUST include "evidence_quote" (an EXACT verbatim substring sentence or clause copied from the passage so the UI can highlight it inside the passage).
- "keyVocabulary": array of 4-5 level-appropriate academic English words/collocations from the passage: { "term", "note" (${vocabNoteLang}), "cefr": "${readingTargetLevel}", "category": "vocab"|"collocation"|"idiom" }.`;

      const aiRes = await generateStructuredWithHybridModel<ReadingPassagePack>({
        tier: "flash",
        routeName: "api/ielts/generate:reading",
        contents: prompt,
        maxOutputTokens: 2400,
        fallbackMaxTokens: 2048,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            topic: { type: Type.STRING },
            cefrLevel: {
              type: Type.STRING,
              enum: ["A2", "B1", "B2", "C1", "C2"],
            },
            recommendedMinutes: { type: Type.INTEGER },
            paragraphs: { type: Type.ARRAY, items: { type: Type.STRING } },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: {
                    type: Type.STRING,
                    enum: ["tfng", "mcq", "fill_blank", "matching_headings"],
                  },
                  prompt: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  answer: { type: Type.STRING },
                  acceptedAnswers: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  wordLimit: { type: Type.STRING },
                  paragraphRef: { type: Type.STRING },
                  ...(isRu
                    ? { explanation_ru: { type: Type.STRING } }
                    : { explanation_id: { type: Type.STRING } }),
                  explanation_en: { type: Type.STRING },
                  evidence_quote: { type: Type.STRING },
                },
                required: [
                  "id",
                  "type",
                  "prompt",
                  "answer",
                  isRu ? "explanation_ru" : "explanation_id",
                  "evidence_quote",
                ],
              },
            },
            keyVocabulary: {
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
          },
          required: [
            "id",
            "title",
            "topic",
            "recommendedMinutes",
            "paragraphs",
            "questions",
          ],
        },
      });

      if (
        aiRes.ok &&
        Array.isArray(aiRes.data?.paragraphs) &&
        aiRes.data.paragraphs.length >= 3 &&
        Array.isArray(aiRes.data.questions) &&
        aiRes.data.questions.length >= 4
      ) {
        return NextResponse.json({
          pack: {
            ...aiRes.data,
            questions: aiRes.data.questions.map((q) => ({
              ...q,
              explanation_id: q.explanation_id || "",
            })),
            cefrLevel: aiRes.data.cefrLevel || readingTargetLevel,
            id: aiRes.data.id || `read-ai-${Date.now()}`,
          },
          source: aiRes.providerUsed,
          modelUsed: aiRes.modelUsed,
        });
      }

      return NextResponse.json({
        pack: pickFallback(FALLBACK_READING_PACKS, excludeIds),
        source: "fallback",
      });
    }

    if (skill === "listening") {
      const isFoundation =
        cefrLevel === "A1" || cefrLevel === "A2" || cefrLevel === "B1";
      const sectionType = isFoundation ? "section1" : "section4";

      const explReq = isRu
        ? 'Include both "explanation_en" and "explanation_ru" (natural Russian in casual "ты" tone).'
        : 'Include both "explanation_en" and "explanation_id".';
      const vocabNotePrompt = isRu
        ? 'brief Russian meaning (casual "ты" tone)'
        : "concise explanation";

      const prompt = isFoundation
        ? `Generate a brand-new, realistic IELTS Listening Section 1 (Everyday Dialogue / Form Completion) adapted for CEFR ${cefrLevel}.
Scenario: An everyday booking, registration, library card, clinic appointment, hotel reservation, or sports club inquiry with clear dates, places, numbers, prices, or spelling details.
Keep script segments, question prompts, options, and answers strictly in English.
Return strictly valid JSON:
- "id": unique id
- "sectionLabel": "Section 1 · Everyday Dialogue"
- "sectionType": "section1"
- "cefrLevel": "${cefrLevel}"
- "title": concise realistic title
- "context": 1-sentence concise context description
- "accentsLabel": "British (UK) & American (US)"
- "segments": 6-7 natural short spoken turns (each under 220 characters so TTS is crisp), alternating 2 speakers using accents "GB_F", "GB_M", or "US_M". Include clear dates, times, numbers, and booking details (plus 1 realistic self-correction like IELTS exams!).
- "questions": 5 questions: 3 "form_completion" (with _____ and "wordLimit" like "ONE WORD AND/OR A NUMBER", exact "answer", "acceptedAnswers") + 2 "mcq" (4 options). ${explReq}
- "keyVocabulary": 4 useful everyday/booking English phrases or collocations from the script: { "term", "note" (${vocabNotePrompt}), "cefr": "${cefrLevel}", "category": "vocab"|"collocation"|"idiom" }.`
        : `Generate a brand-new, realistic IELTS Listening Section 4 (Academic Mini-Lecture) adapted for CEFR ${cefrLevel}.
Scenario: A university mini-lecture on science, history, urban design, psychology, or ecology, optionally followed by a brief moderator announcement.
Keep script segments, question prompts, options, and answers strictly in English.
Return strictly valid JSON:
- "id": unique id
- "sectionLabel": "Section 4 · Academic Mini-Lecture"
- "sectionType": "section4"
- "cefrLevel": "${cefrLevel}"
- "title": concise lecture title
- "context": 1-sentence concise context description
- "accentsLabel": "British (UK) & American (US)"
- "segments": 5-6 clear spoken lecture segments (each under 240 characters so TTS is crisp), using accents "GB_F", "GB_M", or "US_M".
- "questions": 5 questions: 3 "form_completion" (Note Completion with _____ and "wordLimit" like "ONE WORD ONLY" or "NO MORE THAN TWO WORDS", exact "answer", "acceptedAnswers") + 2 nuanced inference "mcq" (4 options). ${explReq}
- "keyVocabulary": 4-5 academic English words or collocations from the lecture: { "term", "note" (${vocabNotePrompt}), "cefr": "${cefrLevel}", "category": "vocab"|"collocation"|"idiom" }.`;

      const aiRes = await generateStructuredWithHybridModel<ListeningSectionPack>(
        {
          tier: "flash",
          routeName: "api/ielts/generate:listening",
          contents: prompt,
          maxOutputTokens: 2200,
          fallbackMaxTokens: 2048,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              sectionLabel: { type: Type.STRING },
              sectionType: {
                type: Type.STRING,
                enum: ["section1", "section3", "section4"],
              },
              cefrLevel: {
                type: Type.STRING,
                enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
              },
              title: { type: Type.STRING },
              context: { type: Type.STRING },
              accentsLabel: { type: Type.STRING },
              segments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    speaker: { type: Type.STRING },
                    accent: {
                      type: Type.STRING,
                      enum: ["GB_M", "GB_F", "AU_F", "AU_M", "US_M"],
                    },
                    text: { type: Type.STRING },
                  },
                  required: ["speaker", "accent", "text"],
                },
              },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: {
                      type: Type.STRING,
                      enum: ["mcq", "form_completion"],
                    },
                    prompt: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    answer: { type: Type.STRING },
                    acceptedAnswers: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    wordLimit: { type: Type.STRING },
                    ...(isRu
                      ? { explanation_ru: { type: Type.STRING } }
                      : { explanation_id: { type: Type.STRING } }),
                    explanation_en: { type: Type.STRING },
                  },
                  required: [
                    "id",
                    "type",
                    "prompt",
                    "answer",
                    isRu ? "explanation_ru" : "explanation_id",
                  ],
                },
              },
              keyVocabulary: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    term: { type: Type.STRING },
                    note: { type: Type.STRING },
                    cefr: {
                      type: Type.STRING,
                      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
                    },
                    category: {
                      type: Type.STRING,
                      enum: ["vocab", "idiom", "collocation"],
                    },
                  },
                  required: ["term", "note"],
                },
              },
            },
            required: [
              "id",
              "sectionLabel",
              "title",
              "context",
              "accentsLabel",
              "segments",
              "questions",
            ],
          },
        }
      );

      if (
        aiRes.ok &&
        Array.isArray(aiRes.data?.segments) &&
        aiRes.data.segments.length >= 3 &&
        Array.isArray(aiRes.data.questions) &&
        aiRes.data.questions.length >= 3
      ) {
        return NextResponse.json({
          pack: {
            ...aiRes.data,
            questions: aiRes.data.questions.map((q) => ({
              ...q,
              explanation_id: q.explanation_id || "",
            })),
            sectionType: aiRes.data.sectionType || sectionType,
            cefrLevel: aiRes.data.cefrLevel || cefrLevel,
            id: aiRes.data.id || `list-ai-${Date.now()}`,
          },
          source: aiRes.providerUsed,
          modelUsed: aiRes.modelUsed,
        });
      }

      const levelMatched = FALLBACK_LISTENING_PACKS.filter((p) =>
        isFoundation
          ? p.sectionType === "section1"
          : p.sectionType !== "section1"
      );
      const pool =
        levelMatched.length > 0 ? levelMatched : FALLBACK_LISTENING_PACKS;
      return NextResponse.json({
        pack: pickFallback(pool, excludeIds),
        source: "fallback",
      });
    }

    if (skill === "speaking") {
      const part: SpeakingPart =
        body.speakingPart === "part2" || body.speakingPart === "part3"
          ? body.speakingPart
          : "part1";

      const prompt = `Generate a brand-new, authentic IELTS Speaking ${part.toUpperCase()} prompt calibrated for a CEFR ${cefrLevel} learner.
${
  part === "part1"
    ? "Part 1: Everyday personal interview question + 2 concise follow-up questions. prepSeconds: 0, speakSeconds: 60."
    : part === "part2"
      ? "Part 2: Official Cue Card topic with 4 'cueBullets' ('You should say:' points). prepSeconds: 60, speakSeconds: 120."
      : "Part 3: Abstract analytical discussion question + 2 deeper follow-up questions. prepSeconds: 0, speakSeconds: 90."
}
Return strictly valid JSON with "id", "part": "${part}", "cefrLevel": "${cefrLevel}", "topic", "question", "cueBullets" (if part2), "followUpQuestions" (if part1/part3), "prepSeconds", "speakSeconds", "targetPhrases" (3-4 natural idiomatic/collocational phrases), and "fallbackBand85Sample" (natural spoken Band 8.5 answer).`;

      const aiRes = await generateStructuredWithHybridModel<SpeakingPromptPack>({
        tier: "flash",
        routeName: "api/ielts/generate:speaking",
        contents: prompt,
        maxOutputTokens: 1600,
        fallbackMaxTokens: 1400,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            part: { type: Type.STRING, enum: ["part1", "part2", "part3"] },
            cefrLevel: {
              type: Type.STRING,
              enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
            },
            topic: { type: Type.STRING },
            question: { type: Type.STRING },
            cueBullets: { type: Type.ARRAY, items: { type: Type.STRING } },
            followUpQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            prepSeconds: { type: Type.INTEGER },
            speakSeconds: { type: Type.INTEGER },
            targetPhrases: { type: Type.ARRAY, items: { type: Type.STRING } },
            fallbackBand85Sample: { type: Type.STRING },
          },
          required: [
            "id",
            "part",
            "topic",
            "question",
            "prepSeconds",
            "speakSeconds",
            "targetPhrases",
            "fallbackBand85Sample",
          ],
        },
      });

      if (aiRes.ok && aiRes.data?.question && aiRes.data.fallbackBand85Sample) {
        return NextResponse.json({
          pack: {
            ...aiRes.data,
            part,
            cefrLevel: aiRes.data.cefrLevel || cefrLevel,
            id: aiRes.data.id || `speak-ai-${Date.now()}`,
          },
          source: aiRes.providerUsed,
          modelUsed: aiRes.modelUsed,
        });
      }

      const pool = FALLBACK_SPEAKING_PACKS.filter((p) => p.part === part);
      return NextResponse.json({
        pack: pickFallback(pool, excludeIds),
        source: "fallback",
      });
    }

    // Writing Task 1 or Task 2
    const taskType = body.taskType === "task1" ? "task1" : "task2";
    const tipsLangNote = isRu
      ? 'in natural Russian (casual "ты" tone)'
      : "in English";
    const prompt =
      taskType === "task1"
        ? `Generate a brand-new IELTS Academic Writing Task 1 prompt (calibrated for CEFR ${cefrLevel}) with realistic comparative numeric table/chart data across 4 categories and 2 years/groups.
Keep title, prompt, chartData, and fallbackBand85Sample strictly in English. Write "outlineTips" ${tipsLangNote}.
Return strictly valid JSON with "id", "taskType": "task1", "cefrLevel": "${cefrLevel}", "title", "prompt", "minWords": 150, "recommendedMinutes": 20, "chartData" ({ "title", "unit", "columns" (4 strings), "rows" (2 objects with "label" and 4 numbers in "values") }), "outlineTips" (3 short structural tips ${tipsLangNote}), and "fallbackBand85Sample" (170-190 word Band 8.5 academic report in English).`
        : `Generate a brand-new IELTS Academic Writing Task 2 essay prompt (calibrated for CEFR ${cefrLevel}) on technology, society, environment, or education.
Keep title, prompt, and fallbackBand85Sample strictly in English. Write "outlineTips" ${tipsLangNote}.
Return strictly valid JSON with "id", "taskType": "task2", "cefrLevel": "${cefrLevel}", "title", "prompt", "minWords": 250, "recommendedMinutes": 40, "outlineTips" (4 short essay structure tips ${tipsLangNote}), and "fallbackBand85Sample" (270-300 word Band 8.5 academic essay in English).`;

    const aiRes = await generateStructuredWithHybridModel<WritingTaskPack>({
      tier: "flash",
      routeName: "api/ielts/generate:writing",
      contents: prompt,
      maxOutputTokens: 1800,
      fallbackMaxTokens: 1600,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          taskType: { type: Type.STRING, enum: ["task1", "task2"] },
          cefrLevel: {
            type: Type.STRING,
            enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
          },
          title: { type: Type.STRING },
          prompt: { type: Type.STRING },
          minWords: { type: Type.INTEGER },
          recommendedMinutes: { type: Type.INTEGER },
          chartData: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              unit: { type: Type.STRING },
              columns: { type: Type.ARRAY, items: { type: Type.STRING } },
              rows: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    values: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                  },
                  required: ["label", "values"],
                },
              },
            },
          },
          outlineTips: { type: Type.ARRAY, items: { type: Type.STRING } },
          fallbackBand85Sample: { type: Type.STRING },
        },
        required: [
          "id",
          "taskType",
          "title",
          "prompt",
          "minWords",
          "recommendedMinutes",
          "outlineTips",
          "fallbackBand85Sample",
        ],
      },
    });

    if (aiRes.ok && aiRes.data?.prompt && aiRes.data.fallbackBand85Sample) {
      return NextResponse.json({
        pack: {
          ...aiRes.data,
          taskType,
          cefrLevel: aiRes.data.cefrLevel || cefrLevel,
          id: aiRes.data.id || `write-ai-${Date.now()}`,
        },
        source: aiRes.providerUsed,
        modelUsed: aiRes.modelUsed,
      });
    }

    const fallbackPool = FALLBACK_WRITING_PACKS.filter(
      (p) => p.taskType === taskType
    );
    return NextResponse.json({
      pack: pickFallback(fallbackPool, excludeIds),
      source: "fallback",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate IELTS practice content" },
      { status: 500 }
    );
  }
}
