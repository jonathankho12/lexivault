import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { getGeminiClient, getGeminiFlashModel } from "@/lib/gemini";
import { FALLBACK_DISCOVERY_PACKS } from "@/lib/mockData";
import { BUILT_IN_PRONUNCIATIONS } from "@/lib/pronunciation";
import { normalizeTermKey } from "@/lib/utils";
import type {
  DailyDiscoveryPack,
  DiscoveryItem,
  RegisterType,
  WordType,
} from "@/types/lexivault";

function pickFallbackPack(dateStr: string): DiscoveryItem[] {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  const idx = hash % FALLBACK_DISCOVERY_PACKS.length;
  return FALLBACK_DISCOVERY_PACKS[idx];
}

function normalizeItems(
  rawItems: Partial<DiscoveryItem>[],
  dateStr: string
): DiscoveryItem[] {
  const validTypes = new Set<WordType>(["vocab", "idiom", "collocation"]);
  const validRegisters = new Set<RegisterType>([
    "Formal",
    "Academic",
    "Casual",
    "Slang",
  ]);

  return rawItems.slice(0, 7).map((item, idx) => {
    const cleanTerm = (item.term || `expression-${idx + 1}`).trim();
    const builtIn = BUILT_IN_PRONUNCIATIONS[normalizeTermKey(cleanTerm)];
    return {
      id: item.id || `disc-${dateStr}-${idx + 1}`,
      term: cleanTerm,
      pronunciation:
        (item.pronunciation || "").trim() || builtIn?.pronunciation || undefined,
      ipa: (item.ipa || "").trim() || builtIn?.ipa || undefined,
      type: item.type && validTypes.has(item.type) ? item.type : "vocab",
      meaning_id: (item.meaning_id || "").trim(),
      examples_json: Array.isArray(item.examples_json)
        ? item.examples_json.slice(0, 2)
        : [],
      synonyms: Array.isArray(item.synonyms) ? item.synonyms.slice(0, 4) : [],
      antonyms: Array.isArray(item.antonyms) ? item.antonyms.slice(0, 3) : [],
      word_families_json: Array.isArray(item.word_families_json)
        ? item.word_families_json
        : [],
      register:
        item.register && validRegisters.has(item.register)
          ? item.register
          : "Formal",
      source_tag: "Discover",
    };
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      date?: string;
      existingTerms?: string[];
    };

    const dateStr =
      body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : new Date().toISOString().slice(0, 10);
    const existingTerms = Array.isArray(body.existingTerms)
      ? body.existingTerms.slice(0, 60)
      : [];

    const ai = getGeminiClient();
    if (ai) {
      try {
        const prompt = `Generate today's curated English Daily Discovery Pack for date ${dateStr}.
Provide EXACTLY 7 items in this exact order:
- 3 items with type "vocab" (C1/C2 advanced versatile English vocabulary)
- 2 items with type "idiom" (high-utility modern English idioms)
- 2 items with type "collocation" (natural academic/professional English collocations)

Avoid these already-saved terms: ${existingTerms.join(", ") || "none"}.

For EVERY item return:
- "term": English word/idiom/collocation
- "type": "vocab" | "idiom" | "collocation"
- "meaning_id": crisp, natural Indonesian explanation
- "examples_json": 2 natural sentences (1 Daily, 1 Academic) highlighting the target in **bold**, with Indonesian "translation_id" and "context"
- "synonyms": 2-3 strings
- "antonyms": 1-2 strings
- "word_families_json": list of { "word": string, "pos": string }
- "register": "Formal" | "Academic" | "Casual" | "Slang"
- "pronunciation": easy-to-read Google "Sounds like" phonetic respelling separating syllables with "·" and putting STRESSED syllables in ALL CAPS (e.g. "am·BIV·uh·luhnt", "bair thuh BRUHNT")
- "ipa": IPA transcription enclosed in slashes (e.g. "/æmˈbɪv.ə.lənt/")`;

        const response = await ai.models.generateContent({
          model: getGeminiFlashModel(),
          contents: prompt,
          config: {
            responseMimeType: "application/json",
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
                      type: {
                        type: Type.STRING,
                        enum: ["vocab", "idiom", "collocation"],
                      },
                      meaning_id: { type: Type.STRING },
                      examples_json: {
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
                      synonyms: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      antonyms: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      word_families_json: {
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
                      register: {
                        type: Type.STRING,
                        enum: ["Formal", "Academic", "Casual", "Slang"],
                      },
                    },
                    required: [
                      "term",
                      "pronunciation",
                      "ipa",
                      "type",
                      "meaning_id",
                      "examples_json",
                      "synonyms",
                      "antonyms",
                      "word_families_json",
                      "register",
                    ],
                  },
                },
              },
              required: ["items"],
            },
          },
        });

        const parsedText = response.text?.trim() ?? "";
        if (parsedText) {
          const parsed = JSON.parse(parsedText) as {
            items?: Partial<DiscoveryItem>[];
          };
          if (Array.isArray(parsed.items) && parsed.items.length >= 7) {
            const pack: DailyDiscoveryPack = {
              discovery_date: dateStr,
              items: normalizeItems(parsed.items, dateStr),
              source: "gemini",
            };
            return NextResponse.json(pack);
          }
        }
      } catch {
        // Fall back smoothly below
      }
    }

    const pack: DailyDiscoveryPack = {
      discovery_date: dateStr,
      items: pickFallbackPack(dateStr),
      source: "fallback",
    };
    return NextResponse.json(pack);
  } catch {
    return NextResponse.json(
      { error: "Failed to load daily discoveries" },
      { status: 500 }
    );
  }
}
