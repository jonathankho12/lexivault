import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { BUILT_IN_ENGLISH_MEANINGS } from "@/lib/bilingualCache";
import { generateStructuredWithHybridModel } from "@/lib/gemini";
import {
  buildFallbackAutofill,
  OFFLINE_AUTOFILL_DICTIONARY,
} from "@/lib/mockData";
import { BUILT_IN_PRONUNCIATIONS } from "@/lib/pronunciation";
import { normalizeTermKey } from "@/lib/utils";
import type {
  ExtractedVocabItem,
  RegisterType,
  WordType,
} from "@/types/lexivault";

const STOPWORDS = new Set([
  "about",
  "above",
  "after",
  "again",
  "against",
  "although",
  "always",
  "among",
  "another",
  "around",
  "because",
  "before",
  "being",
  "between",
  "could",
  "during",
  "every",
  "first",
  "found",
  "great",
  "however",
  "large",
  "other",
  "people",
  "place",
  "quite",
  "right",
  "should",
  "since",
  "small",
  "still",
  "study",
  "their",
  "there",
  "these",
  "thing",
  "think",
  "those",
  "three",
  "through",
  "under",
  "until",
  "using",
  "where",
  "which",
  "while",
  "without",
  "would",
  "years",
]);

function extractFallbackFromText(rawText: string): ExtractedVocabItem[] {
  const lower = rawText.toLowerCase();
  const results: ExtractedVocabItem[] = [];
  const seen = new Set<string>();

  for (const [key, entry] of Object.entries(OFFLINE_AUTOFILL_DICTIONARY)) {
    if (lower.includes(key) && !seen.has(key)) {
      seen.add(key);
      const builtInPron = BUILT_IN_PRONUNCIATIONS[key];
      const builtInBilingual = BUILT_IN_ENGLISH_MEANINGS[key];
      results.push({
        ...entry,
        pronunciation: entry.pronunciation || builtInPron?.pronunciation,
        ipa: entry.ipa || builtInPron?.ipa,
        meaning_en: entry.meaning_en || builtInBilingual?.meaning_en,
        cefr: entry.cefr || builtInBilingual?.cefr,
      });
    }
  }

  const tokens = rawText.match(/\b[a-zA-Z]{7,18}\b/g) ?? [];
  for (const tok of tokens) {
    const norm = tok.toLowerCase();
    if (STOPWORDS.has(norm) || seen.has(norm)) continue;
    seen.add(norm);
    results.push(buildFallbackAutofill(norm));
    if (results.length >= 10) break;
  }

  return results.slice(0, 10);
}

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
        },
        { status: 400 }
      );
    }

    const prompt = `You are a bilingual English-Indonesian IELTS & Vocabulary Coach (active learner UI language: ${lang}).
Extract the 6 to 12 MOST valuable English items from the text below for an upper-intermediate/advanced learner (mix C1/C2 vocabulary words, figurative idioms, and useful academic/natural collocations).
Ignore trivial basic words (e.g., "important", "people", "make").

Text:
"""
${rawText}
"""

For EACH extracted item return strictly valid JSON matching the schema:
- "term": canonical expression
- "cefr": "B2" | "C1" | "C2"
- "type": "vocab" | "idiom" | "collocation"
- "register": "Academic" | "Formal" | "Casual" | "Slang"
- "meaning_en": crisp, natural C1–C2 monolingual English learner's dictionary definition
- "meaning_id": accurate natural Indonesian explanation
- "examples": 2 contextual sentences highlighting the term in **bold**, with Indonesian "translation_id" and "context" ("Daily" or "Academic")
- "synonyms": 2-3 strings
- "antonyms": 1-2 strings
- "word_families": array of { "word": string, "pos": string }
- "pronunciation": Google-style "Sounds like" phonetic respelling with "·" syllable dots and ALL CAPS stressed syllable (e.g. "am·BIV·uh·luhnt")
- "ipa": IPA transcription enclosed in slashes (e.g. "/æmˈbɪv.ə.lənt/")`;

    const aiRes = await generateStructuredWithHybridModel<{
      items: Partial<ExtractedVocabItem>[];
    }>({
      tier: "flash",
      contents: prompt,
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

    if (
      aiRes?.data &&
      Array.isArray(aiRes.data.items) &&
      aiRes.data.items.length > 0
    ) {
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
    }

    return NextResponse.json({
      items: extractFallbackFromText(rawText),
      source: "fallback",
    });
  } catch (err) {
    console.error("[api/extract-vocab] Error:", err);
    return NextResponse.json(
      { error: "Failed to extract vocabulary from text" },
      { status: 500 }
    );
  }
}
