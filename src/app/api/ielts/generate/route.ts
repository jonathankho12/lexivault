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
  IeltsSubTab,
  ListeningSectionPack,
  ReadingPassagePack,
  SpeakingPart,
  SpeakingPromptPack,
  WritingTaskPack,
} from "@/types/ielts";

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
      excludeIds?: string[];
    };

    const skill: IeltsSubTab =
      body.skill === "listening" ||
      body.skill === "writing" ||
      body.skill === "speaking"
        ? body.skill
        : "reading";
    const excludeIds = Array.isArray(body.excludeIds) ? body.excludeIds : [];

    if (skill === "reading") {
      const prompt = `Generate a brand-new, authentic IELTS Academic Reading passage with 6 questions.
Return strictly valid JSON matching the schema:
- "id": unique string id like "read-ai-..."
- "title": scholarly article title
- "topic": academic field (e.g., Environmental Engineering, Cognitive Neuroscience, Economic History)
- "recommendedMinutes": integer (12)
- "paragraphs": 4 rich, cohesive academic paragraphs (~90-120 words each, C1/C2 vocabulary)
- "questions": 6 questions mixing "tfng" (3 questions with options ["TRUE","FALSE","NOT GIVEN"]), "mcq" (1 question with 4 options), and "fill_blank" (2 summary/note completion questions using _____ for ONE OR TWO WORDS directly from the passage).
Each question MUST include "answer", "acceptedAnswers" (lowercase variants), "explanation_id" (Indonesian explanation citing which paragraph), and "evidence_quote" (exact short quote from the passage).`;

      const aiRes = await generateStructuredWithHybridModel<ReadingPassagePack>({
        tier: "flash",
        routeName: "api/ielts/generate:reading",
        contents: prompt,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            topic: { type: Type.STRING },
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
                    enum: ["tfng", "mcq", "fill_blank"],
                  },
                  prompt: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  answer: { type: Type.STRING },
                  acceptedAnswers: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  explanation_id: { type: Type.STRING },
                  evidence_quote: { type: Type.STRING },
                },
                required: [
                  "id",
                  "type",
                  "prompt",
                  "answer",
                  "explanation_id",
                  "evidence_quote",
                ],
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
            id: aiRes.data.id || `read-ai-${Date.now()}`,
          },
          source: "gemini-flash",
          modelUsed: aiRes.modelUsed,
        });
      }

      return NextResponse.json({
        pack: pickFallback(FALLBACK_READING_PACKS, excludeIds),
        source: "fallback",
      });
    }

    if (skill === "listening") {
      const prompt = `Generate a brand-new, authentic IELTS Listening Section 3 (academic tutorial dialogue between 2 speakers) or Section 4 (academic lecture + moderator) pack.
Return strictly valid JSON:
- "id": unique id
- "sectionLabel": e.g., "Section 3 · Academic Discussion"
- "title": concise title
- "context": 1-sentence Indonesian context description
- "accentsLabel": e.g., "British (UK) & Australian (AU)"
- "segments": 6-8 natural spoken turns, each with "speaker", "accent" (one of "GB_M","GB_F","AU_F","AU_M","US_M" — mix at least 2 accents), and "text" (natural spoken English containing clear specific facts, numbers, names, or reasons).
- "questions": 5 questions mixing "mcq" (2 questions with 4 options) and "form_completion" (3 questions with _____ where answer is 1-2 words or a number heard directly in the script). Include "answer", "acceptedAnswers", and Indonesian "explanation_id".`;

      const aiRes = await generateStructuredWithHybridModel<ListeningSectionPack>(
        {
          tier: "flash",
          routeName: "api/ielts/generate:listening",
          contents: prompt,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              sectionLabel: { type: Type.STRING },
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
                    explanation_id: { type: Type.STRING },
                  },
                  required: ["id", "type", "prompt", "answer", "explanation_id"],
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
            id: aiRes.data.id || `list-ai-${Date.now()}`,
          },
          source: "gemini-flash",
          modelUsed: aiRes.modelUsed,
        });
      }

      return NextResponse.json({
        pack: pickFallback(FALLBACK_LISTENING_PACKS, excludeIds),
        source: "fallback",
      });
    }

    if (skill === "speaking") {
      const part: SpeakingPart =
        body.speakingPart === "part2" || body.speakingPart === "part3"
          ? body.speakingPart
          : "part1";

      const prompt = `Generate a brand-new, authentic IELTS Speaking ${part.toUpperCase()} prompt.
${
  part === "part1"
    ? "Part 1: Everyday personal interview question + 2 concise follow-up questions. prepSeconds: 0, speakSeconds: 60."
    : part === "part2"
      ? "Part 2: Cue Card topic with 4 'cueBullets' ('You should say:' points). prepSeconds: 60, speakSeconds: 120."
      : "Part 3: Abstract analytical discussion question + 2 deeper follow-up questions. prepSeconds: 0, speakSeconds: 90."
}
Return strictly valid JSON with "id", "part": "${part}", "topic", "question", "cueBullets" (if part2), "followUpQuestions" (if part1/part3), "prepSeconds", "speakSeconds", "targetPhrases" (3 C1/C2 phrases), and "fallbackBand85Sample" (natural spoken Band 8.5 answer).`;

      const aiRes = await generateStructuredWithHybridModel<SpeakingPromptPack>({
        tier: "flash",
        routeName: "api/ielts/generate:speaking",
        contents: prompt,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            part: { type: Type.STRING, enum: ["part1", "part2", "part3"] },
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
            id: aiRes.data.id || `speak-ai-${Date.now()}`,
          },
          source: "gemini-flash",
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
    const prompt =
      taskType === "task1"
        ? `Generate a brand-new IELTS Academic Writing Task 1 prompt with realistic comparative numeric table/chart data across 4 categories and 2 years/groups.
Return strictly valid JSON with "id", "taskType": "task1", "title", "prompt", "minWords": 150, "recommendedMinutes": 20, "chartData" ({ "title", "unit", "columns" (4 strings), "rows" (2 objects with "label" and 4 numbers in "values") }), "outlineTips" (3 short Indonesian structural tips), and "fallbackBand85Sample" (170-190 word Band 8.5 academic report).`
        : `Generate a brand-new IELTS Academic Writing Task 2 essay prompt on technology, society, environment, or education.
Return strictly valid JSON with "id", "taskType": "task2", "title", "prompt", "minWords": 250, "recommendedMinutes": 40, "outlineTips" (4 short Indonesian essay structure tips), and "fallbackBand85Sample" (270-300 word Band 8.5 academic essay).`;

    const aiRes = await generateStructuredWithHybridModel<WritingTaskPack>({
      tier: "flash",
      routeName: "api/ielts/generate:writing",
      contents: prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          taskType: { type: Type.STRING, enum: ["task1", "task2"] },
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
          id: aiRes.data.id || `write-ai-${Date.now()}`,
        },
        source: "gemini-flash",
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
