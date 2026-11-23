import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { BUILT_IN_ENGLISH_MEANINGS } from "@/lib/bilingualCache";
import { generateStructuredWithHybridModel } from "@/lib/gemini";
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
    const key = normalizeTermKey(cleanTerm);
    const builtIn = BUILT_IN_PRONUNCIATIONS[key];
    const builtInBilingual = BUILT_IN_ENGLISH_MEANINGS[key];
    const meaning_en =
      (item.meaning_en || "").trim() || builtInBilingual?.meaning_en || undefined;
    const meaning_id = (item.meaning_id || "").trim() || meaning_en || "";

    return {
      id: item.id || `disc-${dateStr}-${idx + 1}`,
      term: cleanTerm,
      pronunciation:
        (item.pronunciation || "").trim() || builtIn?.pronunciation || undefined,
      ipa: (item.ipa || "").trim() || builtIn?.ipa || undefined,
      cefr: item.cefr || builtInBilingual?.cefr || "C1",
      type: item.type && validTypes.has(item.type) ? item.type : "vocab",
      meaning_id,
      meaning_en,
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
      source_tag: "discover",
    };
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      date?: string;
      existingTerms?: string[];
      lang?: "en" | "id";
    };

    const dateStr =
      body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : new Date().toISOString().slice(0, 10);
    const existingTerms = Array.isArray(body.existingTerms)
      ? body.existingTerms.slice(0, 60)
      : [];
    const lang = body.lang === "en" ? "en" : "id";

    const prompt = `Generate today's curated English Daily Discovery Pack for date ${dateStr} (active learner UI language: ${lang}).
Provide EXACTLY 7 items in this exact order:
- 3 items with type "vocab" (C1/C2 advanced versatile English vocabulary)
- 2 items with type "idiom" (high-utility modern C1/C2 English idioms)
- 2 items with type "collocation" (natural academic/professional C1/C2 English collocations)

Avoid these already-saved terms: ${existingTerms.join(", ") || "none"}.

For EVERY item return BOTH bilingual meanings and rich linguistic details:
- "term": English word/idiom/collocation
- "cefr": "C1" or "C2"
- "type": "vocab" | "idiom" | "collocation"
- "meaning_en": concise, natural C1–C2 monolingual English dictionary definition (1-2 clear sentences)
- "meaning_id": crisp, natural Indonesian explanation (figurative meaning for idioms)
- "examples_json": 2 natural sentences (1 Daily, 1 Academic) highlighting the target in **bold**, with Indonesian "translation_id" and "context"
- "synonyms": 2-3 strings
- "antonyms": 1-2 strings
- "word_families_json": list of { "word": string, "pos": string }
- "register": "Formal" | "Academic" | "Casual" | "Slang"
- "pronunciation": easy-to-read Google "Sounds like" phonetic respelling separating syllables with "·" and putting STRESSED syllables in ALL CAPS (e.g. "am·BIV·uh·luhnt", "bair thuh BRUHNT")
- "ipa": IPA transcription enclosed in slashes (e.g. "/æmˈbɪv.ə.lənt/")`;

    const aiRes = await generateStructuredWithHybridModel<{
      items?: Partial<DiscoveryItem>[];
    }>({
      tier: "flash",
      routeName: "api/discover",
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
                cefr: { type: Type.STRING, enum: ["C1", "C2"] },
                type: {
                  type: Type.STRING,
                  enum: ["vocab", "idiom", "collocation"],
                },
                meaning_en: { type: Type.STRING },
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
                "cefr",
                "type",
                "meaning_en",
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
    });

    if (aiRes.ok && Array.isArray(aiRes.data.items) && aiRes.data.items.length >= 7) {
      const pack: DailyDiscoveryPack = {
        discovery_date: dateStr,
        items: normalizeItems(aiRes.data.items, dateStr),
        source: "gemini",
      };
      return NextResponse.json(pack);
    }

    const pack: DailyDiscoveryPack = {
      discovery_date: dateStr,
      items: pickFallbackPack(dateStr),
      source: "fallback",
    };
    return NextResponse.json(pack);
  } catch (err) {
    console.error("[api/discover] Request error:", err);
    return NextResponse.json(
      { error: "Failed to load daily discoveries" },
      { status: 500 }
    );
  }
}
