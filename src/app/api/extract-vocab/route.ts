import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { BUILT_IN_ENGLISH_MEANINGS } from "@/lib/bilingualCache";
import {
  classifyGeminiError,
  emptyGeminiResponseError,
  generateStructuredWithHybridModel,
  logGeminiRouteError,
} from "@/lib/gemini";
import { BUILT_IN_PRONUNCIATIONS } from "@/lib/pronunciation";
import { normalizeTermKey } from "@/lib/utils";
import type {
  ExtractedVocabItem,
  RegisterType,
  WordType,
} from "@/types/lexivault";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      text?: string;
      sourceTag?: string;
      lang?: "en" | "id";
    };
    const rawText = body.text?.trim().slice(0, 5000) ?? "";
    const lang = body.lang === "en" ? "en" : "id";

    if (rawText.length < 15) {
      return NextResponse.json(
        {
          error:
            lang === "en"
              ? "Please paste at least 15 characters of English text to extract."
              : "Tempelkan teks minimal 15 karakter untuk diekstrak.",
          code: "invalid_input",
        },
        { status: 400 }
      );
    }

    const prompt = `Extract 6–10 high-value C1/C2 vocab, idioms, or collocations from this text (ui: ${lang}). Skip basic words.
Text:
"""
${rawText}
"""
Concise JSON per item: term, cefr (B2|C1|C2), type (vocab|idiom|collocation), register (Academic|Formal|Casual|Slang), pronunciation ("·" dots + ALL CAPS primary stress), ipa (/.../), meaning_en (1 concise sentence), meaning_id (1 natural Indonesian sentence), examples (2 short sentences with **bold** term + translation_id + context), synonyms (2-3), antonyms (1-2), word_families (1-3 real {word,pos}).`;

    const aiRes = await generateStructuredWithHybridModel<{
      items: Partial<ExtractedVocabItem>[];
    }>({
      tier: "flash",
      routeName: "api/extract-vocab",
      systemInstruction:
        "Fast English-Indonesian vocabulary extractor. Return compact valid JSON only.",
      contents: prompt,
      maxOutputTokens: 1650,
      temperature: 0.25,
      timeoutMs: 7500,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                pronunciation: { type: Type.STRING },
                ipa: { type: Type.STRING },
                cefr: { type: Type.STRING, enum: ["B2", "C1", "C2"] },
                type: {
                  type: Type.STRING,
                  enum: ["vocab", "idiom", "collocation"],
                },
                register: {
                  type: Type.STRING,
                  enum: ["Formal", "Academic", "Casual", "Slang"],
                },
                meaning_en: { type: Type.STRING },
                meaning_id: { type: Type.STRING },
                examples: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      sentence: { type: Type.STRING },
                      translation_id: { type: Type.STRING },
                      context: { type: Type.STRING },
                    },
                    required: ["sentence", "translation_id", "context"],
                  },
                },
                synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
                antonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
                word_families: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      word: { type: Type.STRING },
                      pos: { type: Type.STRING },
                    },
                    required: ["word", "pos"],
                  },
                },
              },
              required: [
                "term",
                "pronunciation",
                "ipa",
                "cefr",
                "type",
                "register",
                "meaning_en",
                "meaning_id",
                "examples",
                "synonyms",
                "antonyms",
                "word_families",
              ],
            },
          },
        },
        required: ["items"],
      },
    });

    if (!aiRes.ok) {
      return NextResponse.json(
        {
          error: aiRes.error.detail,
          code: aiRes.error.code,
          detail: aiRes.error.rawMessage,
          upstreamStatus: aiRes.error.upstreamStatus,
        },
        { status: aiRes.error.status }
      );
    }

    if (!Array.isArray(aiRes.data.items) || aiRes.data.items.length === 0) {
      const emptyErr = emptyGeminiResponseError(aiRes.modelUsed);
      logGeminiRouteError("api/extract-vocab", emptyErr, {
        model: aiRes.modelUsed,
      });
      return NextResponse.json(
        {
          error: emptyErr.detail,
          code: emptyErr.code,
          detail: emptyErr.rawMessage,
        },
        { status: emptyErr.status }
      );
    }

    const validTypes = new Set<WordType>(["vocab", "idiom", "collocation"]);
    const validRegisters = new Set<RegisterType>([
      "Formal",
      "Academic",
      "Casual",
      "Slang",
    ]);

    const normalized: ExtractedVocabItem[] = aiRes.data.items
      .filter((it) => it && typeof it.term === "string" && it.term.trim())
      .slice(0, 12)
      .map((it) => {
        const cleanTerm = it.term!.trim();
        const key = normalizeTermKey(cleanTerm);
        const builtIn = BUILT_IN_PRONUNCIATIONS[key];
        const builtInBilingual = BUILT_IN_ENGLISH_MEANINGS[key];
        const meaning_en =
          (it.meaning_en || "").trim() ||
          builtInBilingual?.meaning_en ||
          undefined;
        const meaning_id = (it.meaning_id || "").trim() || meaning_en || "";

        return {
          term: cleanTerm,
          pronunciation:
            (it.pronunciation || "").trim() ||
            builtIn?.pronunciation ||
            undefined,
          ipa: (it.ipa || "").trim() || builtIn?.ipa || undefined,
          cefr: it.cefr || builtInBilingual?.cefr,
          type: it.type && validTypes.has(it.type) ? it.type : "vocab",
          register:
            it.register && validRegisters.has(it.register)
              ? it.register
              : "Academic",
          meaning_en,
          meaning_id,
          examples: Array.isArray(it.examples) ? it.examples.slice(0, 2) : [],
          synonyms: Array.isArray(it.synonyms) ? it.synonyms.slice(0, 4) : [],
          antonyms: Array.isArray(it.antonyms) ? it.antonyms.slice(0, 3) : [],
          word_families: Array.isArray(it.word_families)
            ? it.word_families
            : [],
        };
      });

    return NextResponse.json({
      items: normalized,
      source: "gemini-flash",
      modelUsed: aiRes.modelUsed,
    });
  } catch (err) {
    const classified = classifyGeminiError(err);
    logGeminiRouteError("api/extract-vocab", classified);
    return NextResponse.json(
      {
        error: classified.detail,
        code: classified.code,
        detail: classified.rawMessage,
        upstreamStatus: classified.upstreamStatus,
      },
      { status: classified.status }
    );
  }
}
