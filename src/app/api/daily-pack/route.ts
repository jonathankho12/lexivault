import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { BUILT_IN_ENGLISH_MEANINGS } from "@/lib/bilingualCache";
import { pickFallbackDailyPack } from "@/lib/dailyPackFallback";
import {
  classifyGeminiError,
  formatCompactExistingTerms,
  generateStructuredWithHybridModel,
  logGeminiRouteError,
} from "@/lib/gemini";
import { BUILT_IN_PRONUNCIATIONS } from "@/lib/pronunciation";
import { getLocalDateString, normalizeTermKey } from "@/lib/utils";
import type {
  CefrLevel,
  DailyPackItem,
  RegisterType,
  WordExample,
  WordFamilyItem,
} from "@/types/lexivault";

const VALID_REGISTERS = new Set<RegisterType>([
  "Formal",
  "Academic",
  "Casual",
  "Slang",
]);

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const num = typeof val === "number" ? Math.round(val) : Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function normalizeDailyPackItem(
  raw: Partial<DailyPackItem> & { phonetic?: string; example?: string },
  dateStr: string,
  index: number
): DailyPackItem | null {
  const term = (raw.term || "").trim();
  if (!term) return null;

  const key = normalizeTermKey(term);
  const builtInPron = BUILT_IN_PRONUNCIATIONS[key];
  const builtInBilingual = BUILT_IN_ENGLISH_MEANINGS[key];

  const type: "vocab" | "idiom" =
    raw.type === "idiom" || term.split(/\s+/).length >= 2 ? "idiom" : "vocab";
  const register: RegisterType =
    raw.register && VALID_REGISTERS.has(raw.register)
      ? raw.register
      : type === "idiom"
        ? "Casual"
        : "Academic";
  const cefr: CefrLevel = raw.cefr === "C2" ? "C2" : "C1";

  const examples: WordExample[] = Array.isArray(raw.examples)
    ? raw.examples
        .filter((ex) => ex && typeof ex.sentence === "string" && ex.sentence.trim())
        .slice(0, 2)
        .map((ex, idx) => ({
          sentence: ex.sentence.trim(),
          translation_id: (ex.translation_id || "").trim(),
          context: ex.context || (idx === 0 ? "Daily" : "Academic"),
        }))
    : [];

  if (examples.length === 0 && typeof raw.example === "string" && raw.example.trim()) {
    examples.push({
      sentence: raw.example.trim(),
      translation_id: "",
      context: register === "Academic" ? "Academic" : "Daily",
    });
  }

  if (examples.length === 0) {
    examples.push({
      sentence: `Using **${term}** naturally demonstrates strong C1–C2 command of English.`,
      translation_id: `Menggunakan **${term}** secara natural menunjukkan penguasaan bahasa Inggris level C1–C2.`,
      context: "Daily",
    });
  }

  const word_families: WordFamilyItem[] = Array.isArray(raw.word_families)
    ? raw.word_families
        .filter((wf) => wf && typeof wf.word === "string" && wf.word.trim())
        .map((wf) => ({
          word: wf.word.trim(),
          pos: (wf.pos || type).trim(),
        }))
    : [{ word: term, pos: type }];

  const meaning_en =
    (raw.meaning_en || "").trim() ||
    builtInBilingual?.meaning_en ||
    `Advanced C1–C2 English ${type === "idiom" ? "idiom" : "word"} "${term}".`;
  const meaning_id =
    (raw.meaning_id || "").trim() ||
    `Ekspresi bahasa Inggris C1–C2 "${term}".`;

  return {
    id: `${dateStr}-ai-${index}-${key.replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`,
    term,
    pronunciation:
      (raw.pronunciation || raw.phonetic || "").trim() ||
      builtInPron?.pronunciation ||
      undefined,
    ipa: (raw.ipa || "").trim() || builtInPron?.ipa || undefined,
    cefr,
    type,
    meaning_en,
    meaning_id,
    examples,
    synonyms: Array.isArray(raw.synonyms)
      ? raw.synonyms.map((s) => String(s).trim()).filter(Boolean).slice(0, 4)
      : [],
    antonyms: Array.isArray(raw.antonyms)
      ? raw.antonyms.map((s) => String(s).trim()).filter(Boolean).slice(0, 3)
      : [],
    word_families,
    register,
    source_tag: "daily_pack",
  };
}

function interleavePack(
  words: DailyPackItem[],
  idioms: DailyPackItem[]
): DailyPackItem[] {
  const combined: DailyPackItem[] = [];
  let wIdx = 0;
  let iIdx = 0;
  while (wIdx < words.length || iIdx < idioms.length) {
    for (let k = 0; k < 2 && wIdx < words.length; k += 1) {
      combined.push(words[wIdx++]);
    }
    if (iIdx < idioms.length) {
      combined.push(idioms[iIdx++]);
    }
  }
  return combined;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      date?: string;
      wordsQuota?: number;
      idiomsQuota?: number;
      existingTerms?: string[];
      lang?: "en" | "id";
    };

    const dateStr =
      typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : getLocalDateString();
    const wordsQuota = clampInt(body.wordsQuota, 0, 30, 10);
    const idiomsQuota = clampInt(body.idiomsQuota, 0, 20, 5);
    const totalNeeded = wordsQuota + idiomsQuota;

    if (totalNeeded === 0) {
      return NextResponse.json({
        pack_date: dateStr,
        words_quota: 0,
        idioms_quota: 0,
        items: [],
        source: "fallback",
      });
    }

    const rawExisting = Array.isArray(body.existingTerms)
      ? body.existingTerms
          .map((t) => String(t).trim())
          .filter(Boolean)
          .slice(0, 250)
      : [];
    const excludeKeys = new Set(rawExisting.map(normalizeTermKey));

    const existingCsv = formatCompactExistingTerms(rawExisting, 180);
    const prompt = `Daily Pack for ${dateStr}: generate EXACTLY ${wordsQuota} C1–C2 single words (type:"vocab") and ${idiomsQuota} C1–C2 idioms (type:"idiom"), total ${totalNeeded}.
EXCLUDE (no exact or variant matches): ${existingCsv}

Concise JSON per item:
term, type (vocab|idiom), cefr (C1|C2), register (Academic|Formal|Casual), pronunciation ("·" dots + ALL CAPS primary stress), ipa (/.../), meaning_en (1 crisp sentence), meaning_id (1 natural figurative Indonesian sentence), examples (2 short sentences with **bold** target + translation_id + context Daily/Academic), synonyms (2), antonyms (1-2), word_families (1-2 {word,pos}).`;

    const aiRes = await generateStructuredWithHybridModel<{
      items?: Partial<DailyPackItem>[];
    }>({
      tier: "flash",
      routeName: "api/daily-pack",
      systemInstruction:
        "Fast C1-C2 English lexicographer. Output compact valid JSON only with zero duplicates.",
      contents: prompt,
      maxOutputTokens: Math.min(4096, Math.max(1200, totalNeeded * 260)),
      temperature: 0.65,
      timeoutMs: 9500,
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
                type: { type: Type.STRING, enum: ["vocab", "idiom"] },
                register: {
                  type: Type.STRING,
                  enum: ["Academic", "Formal", "Casual"],
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
                synonyms: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                antonyms: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
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

    const seenKeys = new Set<string>(excludeKeys);
    const pickedWords: DailyPackItem[] = [];
    const pickedIdioms: DailyPackItem[] = [];

    if (Array.isArray(aiRes.data.items)) {
      for (let i = 0; i < aiRes.data.items.length; i += 1) {
        const normalized = normalizeDailyPackItem(aiRes.data.items[i], dateStr, i);
        if (!normalized) continue;
        const key = normalizeTermKey(normalized.term);
        if (seenKeys.has(key)) continue;

        if (normalized.type === "vocab" && pickedWords.length < wordsQuota) {
          seenKeys.add(key);
          pickedWords.push(normalized);
        } else if (
          normalized.type === "idiom" &&
          pickedIdioms.length < idiomsQuota
        ) {
          seenKeys.add(key);
          pickedIdioms.push(normalized);
        }
      }
    }

    // If Gemini succeeded but produced fewer unique items after deduplication, top up the remaining slots
    const missingWords = Math.max(0, wordsQuota - pickedWords.length);
    const missingIdioms = Math.max(0, idiomsQuota - pickedIdioms.length);
    if (missingWords > 0 || missingIdioms > 0) {
      const topUp = pickFallbackDailyPack(
        dateStr,
        missingWords,
        missingIdioms,
        seenKeys
      );
      for (const item of topUp) {
        if (item.type === "vocab") pickedWords.push(item);
        else pickedIdioms.push(item);
      }
    }

    const finalItems = interleavePack(pickedWords, pickedIdioms);
    return NextResponse.json({
      pack_date: dateStr,
      words_quota: wordsQuota,
      idioms_quota: idiomsQuota,
      items: finalItems,
      source: "gemini",
      modelUsed: aiRes.modelUsed,
    });
  } catch (err) {
    const classified = classifyGeminiError(err);
    logGeminiRouteError("api/daily-pack", classified);
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
