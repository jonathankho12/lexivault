import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { getGeminiClient, getGeminiFlashModel } from "@/lib/gemini";
import type {
  SentenceGradeResult,
  SentenceGradeVerdict,
  WordFamilyItem,
} from "@/types/lexivault";

const VALID_VERDICTS = new Set<SentenceGradeVerdict>([
  "Natural",
  "Cukup Baik",
  "Kurang Tepat",
  "Belum Menjawab / Tidak Valid",
]);

const NON_ATTEMPT_EXACT = new Set([
  "idunno",
  "i dunno",
  "dunno",
  "idk",
  "i dont know",
  "i don't know",
  "dont know",
  "don't know",
  "no idea",
  "no clue",
  "skip",
  "pass",
  "next",
  "ga tau",
  "gatau",
  "gak tau",
  "gaktau",
  "nggak tau",
  "ngga tau",
  "tidak tahu",
  "ga tahu",
  "gak tahu",
  "kurang tahu",
  "belum tahu",
  "entah",
  "bingung",
  "lupa",
  "test",
  "testing",
  "tes",
  "coba",
  "asdf",
  "qwerty",
  "zxcv",
  "abc",
  "abcd",
  "hmm",
  "hm",
  "huh",
  "none",
  "nothing",
  "n/a",
  "na",
  "whatever",
  "idk bro",
  "idk man",
  "meh",
  "ok",
  "okay",
  "yes",
  "no",
  "hi",
  "hello",
]);

const NON_ATTEMPT_SUBSTRINGS = [
  "i don't know",
  "i dont know",
  "idunno",
  "i dunno",
  "ga tau",
  "gak tau",
  "gatau",
  "nggak tau",
  "tidak tahu",
  "belum tahu",
  "belum paham",
  "tidak paham",
  "lupa artinya",
  "no idea",
];

const KEYBOARD_MASH_REGEX = /(asdf|qwer|zxcv|hjkl|jklm|uiop|dfgh|cvbn|fghj|tyui)/i;

const INDONESIAN_COMMON_WORDS = new Set([
  "saya",
  "aku",
  "kamu",
  "yang",
  "untuk",
  "dengan",
  "tidak",
  "belum",
  "sudah",
  "karena",
  "adalah",
  "hari",
  "ini",
  "itu",
  "sangat",
  "bisa",
  "akan",
  "tapi",
  "tetapi",
  "dalam",
  "pada",
  "mereka",
  "kami",
  "kita",
]);

function stripEdgePunctuation(token: string): string {
  return token.replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, "");
}

function buildSampleNativeRewrite(
  term: string,
  exampleSentence?: string
): string {
  const cleanExample = exampleSentence?.replace(/\*\*/g, "").trim();
  if (cleanExample && cleanExample.length >= 15) {
    return cleanExample;
  }
  return `In a real conversation, you can naturally include "${term}" when explaining a clear situation.`;
}

function detectInvalidOrNonAttempt(
  sentence: string,
  term: string,
  meaningId: string,
  wordFamilies: WordFamilyItem[],
  exampleSentence?: string
): SentenceGradeResult | null {
  const trimmed = sentence.trim();
  const sampleRewrite = buildSampleNativeRewrite(term, exampleSentence);
  const tip = `Ingat maknanya: ${meaningId || `pelajari konteks penggunaan "${term}".`}`;

  if (!trimmed) {
    return {
      is_correct: false,
      verdict: "Belum Menjawab / Tidak Valid",
      score: 0,
      feedback_id: `Kamu belum menuliskan kalimat apa pun. Tulis minimal 1 kalimat bahasa Inggris utuh yang menggunakan "${term}".`,
      native_rewrite: sampleRewrite,
      tip,
    };
  }

  const normalized = trimmed
    .toLowerCase()
    .replace(/[.!?,;:"()\-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const compact = normalized.replace(/\s+/g, "");

  // 1. Direct non-attempt / give-up phrases (e.g. "idunno", "idk", "skip", "ga tau", "test")
  if (
    !normalized ||
    NON_ATTEMPT_EXACT.has(normalized) ||
    NON_ATTEMPT_EXACT.has(compact) ||
    (normalized.split(" ").length <= 6 &&
      NON_ATTEMPT_SUBSTRINGS.some((phrase) => normalized.includes(phrase)))
  ) {
    return {
      is_correct: false,
      verdict: "Belum Menjawab / Tidak Valid",
      score: 0,
      feedback_id: `Input "${trimmed}" bukan percobaan kalimat bahasa Inggris. Coba tulis 1 kalimat sederhana (subjek + kata kerja + konteks) memakai "${term}"—tidak apa-apa salah dulu!`,
      native_rewrite: sampleRewrite,
      tip,
    };
  }

  const rawTokens = trimmed.split(/\s+/).filter(Boolean);
  const cleanedTokens = rawTokens
    .map(stripEdgePunctuation)
    .filter(Boolean);
  const alphaWords = cleanedTokens.filter((w) =>
    /^(i|a|[a-z]{2,}(?:'[a-z]+)?)$/i.test(w)
  );
  const uniqueAlpha = new Set(alphaWords.map((w) => w.toLowerCase()));

  const lowerSentence = trimmed.toLowerCase();
  const candidateForms = [
    term.trim().toLowerCase(),
    ...wordFamilies.map((wf) => wf.word.trim().toLowerCase()),
  ].filter(Boolean);
  const usesTarget = candidateForms.some((form) =>
    lowerSentence.includes(form)
  );

  // 2. Gibberish / keyboard smash / pure symbols / repeated spam
  const hasCharSmash = cleanedTokens.some((w) => /(.)\1{3,}/i.test(w));
  const hasKeyboardMash = cleanedTokens.some((w) => KEYBOARD_MASH_REGEX.test(w));
  const vowellessLongCount = alphaWords.filter(
    (w) => w.length >= 4 && !/[aeiouy]/i.test(w)
  ).length;
  const mostlyGibberish =
    alphaWords.length === 0 ||
    hasCharSmash ||
    hasKeyboardMash ||
    (alphaWords.length >= 2 && vowellessLongCount / alphaWords.length >= 0.4) ||
    (alphaWords.length >= 3 && uniqueAlpha.size < 2);

  if (mostlyGibberish) {
    return {
      is_correct: false,
      verdict: "Belum Menjawab / Tidak Valid",
      score: 0,
      feedback_id: `Jawaban terdeteksi acak atau belum berupa kalimat bahasa Inggris yang valid. Susun kalimat bermakna menggunakan "${term}" agar bisa dinilai dengan akurat.`,
      native_rewrite: sampleRewrite,
      tip,
    };
  }

  // 3. Too short (< 3 real words)
  if (alphaWords.length < 3) {
    return {
      is_correct: false,
      verdict: "Belum Menjawab / Tidak Valid",
      score: usesTarget ? 10 : 5,
      feedback_id: usesTarget
        ? `Kamu baru menulis ${alphaWords.length} kata — "${term}" sudah muncul, tetapi belum membentuk kalimat utuh. Tambahkan subjek dan konteks kalimat lengkap.`
        : `Jawabanmu terlalu pendek (${alphaWords.length} kata) dan belum membentuk kalimat utuh. Tulis minimal 1 kalimat lengkap menggunakan "${term}".`,
      native_rewrite: sampleRewrite,
      tip,
    };
  }

  return null;
}

function buildFallbackGrade(
  term: string,
  meaningId: string,
  sentence: string,
  wordFamilies: WordFamilyItem[] = [],
  exampleSentence?: string
): SentenceGradeResult {
  const invalidCheck = detectInvalidOrNonAttempt(
    sentence,
    term,
    meaningId,
    wordFamilies,
    exampleSentence
  );
  if (invalidCheck) return invalidCheck;

  const trimmed = sentence.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const lowerSentence = trimmed.toLowerCase();
  const lowerTerm = term.trim().toLowerCase();
  const sampleRewrite = buildSampleNativeRewrite(term, exampleSentence);

  const candidateForms = [
    lowerTerm,
    ...wordFamilies.map((wf) => wf.word.trim().toLowerCase()),
  ].filter(Boolean);

  const usesTarget = candidateForms.some((form) =>
    lowerSentence.includes(form)
  );

  // Detect predominantly Indonesian text instead of English
  const indonesianHits = words
    .map((w) => stripEdgePunctuation(w).toLowerCase())
    .filter((w) => INDONESIAN_COMMON_WORDS.has(w)).length;
  if (indonesianHits >= 2 && indonesianHits / words.length >= 0.3) {
    return {
      is_correct: false,
      verdict: "Kurang Tepat",
      score: usesTarget ? 28 : 20,
      feedback_id: `Kalimatmu masih didominasi bahasa Indonesia. Coba tulis kalimat penuh dalam bahasa Inggris sambil memasukkan "${term}" secara alami.`,
      native_rewrite: sampleRewrite,
      tip: `Gunakan struktur kalimat bahasa Inggris penuh untuk melatih "${term}".`,
    };
  }

  // Real English sentence (>= 3 words), but missing target expression -> 20-45 range
  if (!usesTarget) {
    const score = words.length >= 5 ? 32 : 24;
    return {
      is_correct: false,
      verdict: "Kurang Tepat",
      score,
      feedback_id: `Kalimat bahasa Inggrismu sudah mulai terbentuk, tetapi belum memakai kata atau frasa target "${term}". Masukkan "${term}" (atau bentuk turunannya) ke dalam konteks kalimat.`,
      native_rewrite: sampleRewrite,
      tip: `Ingat maknanya: ${meaningId}`,
    };
  }

  // Uses target, 3-4 words fragment -> 42-45 range
  if (words.length < 5) {
    return {
      is_correct: false,
      verdict: "Kurang Tepat",
      score: 45,
      feedback_id: `Kamu sudah memasukkan "${term}", tetapi kalimat masih terlalu singkat (${words.length} kata). Tambahkan konteks siapa, kapan, atau mengapa agar kalimat terasa natural.`,
      native_rewrite: sampleRewrite,
      tip: "Tambahkan keterangan konteks atau alasan agar penggunaan kata terdengar lebih idiomatik.",
    };
  }

  const endsCleanly = /[.!?]$/.test(trimmed);
  const normalizedSentence = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  const cleanPunctuated = endsCleanly
    ? normalizedSentence
    : `${normalizedSentence}.`;

  return {
    is_correct: true,
    verdict: endsCleanly && words.length >= 7 ? "Natural" : "Cukup Baik",
    score: endsCleanly && words.length >= 7 ? 88 : 78,
    feedback_id: `Bagus! Kamu berhasil menyusun kalimat bahasa Inggris yang utuh dengan "${term}". Sambungkan GEMINI_API_KEY untuk evaluasi tata bahasa & nuansa register secara mendalam.`,
    native_rewrite: cleanPunctuated,
    tip: "Perhatikan kesesuaian tenses dan tanda baca di akhir kalimat agar terdengar semakin native.",
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      term?: string;
      meaning_id?: string;
      register?: string;
      sentence?: string;
      word_families?: WordFamilyItem[];
      example_sentence?: string;
    };

    const term = body.term?.trim() ?? "";
    const sentence = body.sentence?.trim() ?? "";
    const meaningId = body.meaning_id?.trim() ?? "";
    const register = body.register?.trim() ?? "Casual";
    const exampleSentence = body.example_sentence?.trim();
    const wordFamilies = Array.isArray(body.word_families)
      ? body.word_families
      : [];

    if (!term) {
      return NextResponse.json(
        { error: "Term is required" },
        { status: 400 }
      );
    }

    // Strict pre-validation guard: immediately catch empty, < 3 words, gibberish,
    // or non-attempts ("idunno", "idk", "skip", "ga tau", "test") with score 0-10.
    const invalidResult = detectInvalidOrNonAttempt(
      sentence,
      term,
      meaningId,
      wordFamilies,
      exampleSentence
    );
    if (invalidResult) {
      return NextResponse.json({
        result: invalidResult,
        source: "validation",
      });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return NextResponse.json({
        result: buildFallbackGrade(
          term,
          meaningId,
          sentence,
          wordFamilies,
          exampleSentence
        ),
        source: "fallback",
      });
    }

    const prompt = `You are a strict yet constructive native English writing coach for an Indonesian learner.
Target expression: "${term}"
Indonesian meaning: "${meaningId}"
Expected register: "${register}"
Allowed word-family forms: ${wordFamilies.map((w) => `${w.word} (${w.pos})`).join(", ") || term}
Learner's sentence: "${sentence}"

Evaluate whether the learner used "${term}" (or a valid inflection/word-family form) accurately, grammatically, and naturally in context.

STRICT SCORING RUBRIC (MUST FOLLOW):
- 0 to 10 ("Belum Menjawab / Tidak Valid", is_correct=false): Empty, < 3 words, random gibberish/keyboard mash, non-English/Indonesian-only refusal, or non-attempts like "idunno", "idk", "skip", "ga tau", "test". NEVER give 35 for non-attempts!
- 20 to 45 ("Kurang Tepat", is_correct=false): Learner wrote a real, complete English sentence, BUT either did not use the target expression at all OR used it with the wrong meaning/context.
- 46 to 69 ("Kurang Tepat", is_correct=false): Uses the target expression with partial understanding, but has significant grammar issues, unnatural collocation, or incomplete context.
- 70 to 84 ("Cukup Baik", is_correct=true): Clear, understandable, mostly natural English sentence using the target expression accurately with only minor phrasing/grammar tweaks.
- 85 to 100 ("Natural", is_correct=true): Idiomatic, accurate meaning, proper grammar, and matching register.

Return strictly valid JSON:
- "is_correct": boolean (true ONLY if Natural or Cukup Baik, false otherwise)
- "verdict": exactly one of "Natural", "Cukup Baik", "Kurang Tepat", or "Belum Menjawab / Tidak Valid"
- "score": integer 0-100 following the strict rubric above
- "feedback_id": specific, natural feedback in Indonesian (2 sentences max) addressing the exact sentence written.
- "native_rewrite": a polished, natural native-speaker English sentence using "${term}" (if the learner didn't write a real idea, provide a clean everyday example sentence using "${term}").
- "tip": 1 short actionable tip in Indonesian on register, collocation, or phrasing.`;

    const response = await ai.models.generateContent({
      model: getGeminiFlashModel(),
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            is_correct: { type: Type.BOOLEAN },
            verdict: {
              type: Type.STRING,
              enum: [
                "Natural",
                "Cukup Baik",
                "Kurang Tepat",
                "Belum Menjawab / Tidak Valid",
              ],
            },
            score: { type: Type.INTEGER },
            feedback_id: { type: Type.STRING },
            native_rewrite: { type: Type.STRING },
            tip: { type: Type.STRING },
          },
          required: [
            "is_correct",
            "verdict",
            "score",
            "feedback_id",
            "native_rewrite",
            "tip",
          ],
        },
      },
    });

    const parsedText = response.text?.trim() ?? "";
    if (!parsedText) {
      return NextResponse.json({
        result: buildFallbackGrade(
          term,
          meaningId,
          sentence,
          wordFamilies,
          exampleSentence
        ),
        source: "fallback",
      });
    }

    const parsed = JSON.parse(parsedText) as Partial<SentenceGradeResult>;
    const rawScore =
      typeof parsed.score === "number" && Number.isFinite(parsed.score)
        ? Math.max(0, Math.min(100, Math.round(parsed.score)))
        : 0;

    let verdict: SentenceGradeVerdict =
      parsed.verdict && VALID_VERDICTS.has(parsed.verdict)
        ? parsed.verdict
        : rawScore <= 10
          ? "Belum Menjawab / Tidak Valid"
          : parsed.is_correct
            ? "Cukup Baik"
            : "Kurang Tepat";

    if (rawScore <= 10) {
      verdict = "Belum Menjawab / Tidak Valid";
    }

    const clampedScore =
      verdict === "Belum Menjawab / Tidak Valid"
        ? Math.min(10, rawScore)
        : rawScore;
    const isCorrect =
      verdict === "Natural" || verdict === "Cukup Baik"
        ? Boolean(parsed.is_correct ?? true)
        : false;

    return NextResponse.json({
      result: {
        is_correct: isCorrect,
        verdict,
        score: clampedScore,
        feedback_id: parsed.feedback_id || "Kalimat sudah dinilai.",
        native_rewrite:
          parsed.native_rewrite ||
          buildSampleNativeRewrite(term, exampleSentence),
        tip: parsed.tip || "Pertahankan latihan menulis kalimat kontekstual!",
      },
      source: "gemini",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to grade sentence" },
      { status: 500 }
    );
  }
}
