import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import {
  classifyGeminiError,
  generateStructuredWithHybridModel,
  logGeminiRouteError,
} from "@/lib/gemini";
import type {
  SentenceGradeResult,
  SentenceGradeVerdict,
  WordFamilyItem,
} from "@/types/lexivault";

type GradeLang = "en" | "id";

const VALID_VERDICTS_ID = new Set<SentenceGradeVerdict>([
  "Natural",
  "Cukup Baik",
  "Kurang Tepat",
  "Belum Menjawab / Tidak Valid",
]);

const VALID_VERDICTS_EN = new Set<SentenceGradeVerdict>([
  "Natural",
  "Good",
  "Needs Work",
  "No Valid Attempt",
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

const KEYBOARD_MASH_REGEX =
  /(asdf|qwer|zxcv|hjkl|jklm|uiop|dfgh|cvbn|fghj|tyui)/i;

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
  meaning: string,
  wordFamilies: WordFamilyItem[],
  lang: GradeLang,
  exampleSentence?: string
): SentenceGradeResult | null {
  const trimmed = sentence.trim();
  const sampleRewrite = buildSampleNativeRewrite(term, exampleSentence);
  const isEn = lang === "en";
  const invalidVerdict: SentenceGradeVerdict = isEn
    ? "No Valid Attempt"
    : "Belum Menjawab / Tidak Valid";
  const tip = isEn
    ? `Keep the meaning in mind: ${meaning || `review how "${term}" works in context.`}`
    : `Ingat maknanya: ${meaning || `pelajari konteks penggunaan "${term}".`}`;

  if (!trimmed) {
    return {
      is_correct: false,
      verdict: invalidVerdict,
      score: 0,
      feedback_id: isEn
        ? `You haven't written a sentence yet. Write at least one complete English sentence using "${term}".`
        : `Kamu belum menuliskan kalimat apa pun. Tulis minimal 1 kalimat bahasa Inggris utuh yang menggunakan "${term}".`,
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

  if (
    !normalized ||
    NON_ATTEMPT_EXACT.has(normalized) ||
    NON_ATTEMPT_EXACT.has(compact) ||
    (normalized.split(" ").length <= 6 &&
      NON_ATTEMPT_SUBSTRINGS.some((phrase) => normalized.includes(phrase)))
  ) {
    return {
      is_correct: false,
      verdict: invalidVerdict,
      score: 0,
      feedback_id: isEn
        ? `"${trimmed}" is not a valid English sentence attempt. Try writing one simple sentence (subject + verb + context) using "${term}"—mistakes are totally fine!`
        : `Input "${trimmed}" bukan percobaan kalimat bahasa Inggris. Coba tulis 1 kalimat sederhana (subjek + kata kerja + konteks) memakai "${term}"—tidak apa-apa salah dulu!`,
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

  const hasCharSmash = cleanedTokens.some((w) => /(.)\1{3,}/i.test(w));
  const hasKeyboardMash = cleanedTokens.some((w) =>
    KEYBOARD_MASH_REGEX.test(w)
  );
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
      verdict: invalidVerdict,
      score: 0,
      feedback_id: isEn
        ? `Your input looks like random characters rather than a valid English sentence. Write a meaningful sentence using "${term}" for accurate feedback.`
        : `Jawaban terdeteksi acak atau belum berupa kalimat bahasa Inggris yang valid. Susun kalimat bermakna menggunakan "${term}" agar bisa dinilai dengan akurat.`,
      native_rewrite: sampleRewrite,
      tip,
    };
  }

  if (alphaWords.length < 3) {
    return {
      is_correct: false,
      verdict: invalidVerdict,
      score: usesTarget ? 10 : 5,
      feedback_id: isEn
        ? usesTarget
          ? `You only wrote ${alphaWords.length} word(s)—"${term}" is included, but it isn't a full sentence yet. Add a subject and clear context.`
          : `Your response is too short (${alphaWords.length} word(s)) to be a complete sentence. Write at least one full sentence using "${term}".`
        : usesTarget
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
  meaning: string,
  sentence: string,
  wordFamilies: WordFamilyItem[],
  lang: GradeLang,
  exampleSentence?: string
): SentenceGradeResult {
  const invalidCheck = detectInvalidOrNonAttempt(
    sentence,
    term,
    meaning,
    wordFamilies,
    lang,
    exampleSentence
  );
  if (invalidCheck) return invalidCheck;

  const isEn = lang === "en";
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

  const indonesianHits = words
    .map((w) => stripEdgePunctuation(w).toLowerCase())
    .filter((w) => INDONESIAN_COMMON_WORDS.has(w)).length;
  if (indonesianHits >= 2 && indonesianHits / words.length >= 0.3) {
    return {
      is_correct: false,
      verdict: isEn ? "Needs Work" : "Kurang Tepat",
      score: usesTarget ? 28 : 20,
      feedback_id: isEn
        ? `Your sentence is mostly written in Indonesian. Write a full English sentence incorporating "${term}" naturally.`
        : `Kalimatmu masih didominasi bahasa Indonesia. Coba tulis kalimat penuh dalam bahasa Inggris sambil memasukkan "${term}" secara alami.`,
      native_rewrite: sampleRewrite,
      tip: isEn
        ? `Use complete English sentence structure to actively practice "${term}".`
        : `Gunakan struktur kalimat bahasa Inggris penuh untuk melatih "${term}".`,
    };
  }

  if (!usesTarget) {
    const score = words.length >= 5 ? 32 : 24;
    return {
      is_correct: false,
      verdict: isEn ? "Needs Work" : "Kurang Tepat",
      score,
      feedback_id: isEn
        ? `Your English sentence is taking shape, but it doesn't include the target expression "${term}". Include "${term}" (or one of its word-family forms) in context.`
        : `Kalimat bahasa Inggrismu sudah mulai terbentuk, tetapi belum memakai kata atau frasa target "${term}". Masukkan "${term}" (atau bentuk turunannya) ke dalam konteks kalimat.`,
      native_rewrite: sampleRewrite,
      tip: isEn
        ? `Keep the meaning in mind: ${meaning}`
        : `Ingat maknanya: ${meaning}`,
    };
  }

  if (words.length < 5) {
    return {
      is_correct: false,
      verdict: isEn ? "Needs Work" : "Kurang Tepat",
      score: 45,
      feedback_id: isEn
        ? `You included "${term}", but the sentence is still too brief (${words.length} words). Add who, when, or why to make the context feel natural.`
        : `Kamu sudah memasukkan "${term}", tetapi kalimat masih terlalu singkat (${words.length} kata). Tambahkan konteks siapa, kapan, atau mengapa agar kalimat terasa natural.`,
      native_rewrite: sampleRewrite,
      tip: isEn
        ? "Add a brief clause explaining the reason or setting to sound more idiomatic."
        : "Tambahkan keterangan konteks atau alasan agar penggunaan kata terdengar lebih idiomatik.",
    };
  }

  const endsCleanly = /[.!?]$/.test(trimmed);
  const normalizedSentence = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  const cleanPunctuated = endsCleanly
    ? normalizedSentence
    : `${normalizedSentence}.`;

  return {
    is_correct: true,
    verdict:
      endsCleanly && words.length >= 7
        ? "Natural"
        : isEn
          ? "Good"
          : "Cukup Baik",
    score: endsCleanly && words.length >= 7 ? 88 : 78,
    feedback_id: isEn
      ? `Well done! You built a complete English sentence using "${term}". Connect GEMINI_API_KEY for deeper grammar and register coaching.`
      : `Bagus! Kamu berhasil menyusun kalimat bahasa Inggris yang utuh dengan "${term}". Sambungkan GEMINI_API_KEY untuk evaluasi tata bahasa & nuansa register secara mendalam.`,
    native_rewrite: cleanPunctuated,
    tip: isEn
      ? "Double-check tense agreement and final punctuation to sound even more natural."
      : "Perhatikan kesesuaian tenses dan tanda baca di akhir kalimat agar terdengar semakin native.",
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      term?: string;
      meaning_id?: string;
      meaning_en?: string;
      register?: string;
      sentence?: string;
      word_families?: WordFamilyItem[];
      example_sentence?: string;
      lang?: GradeLang;
    };

    const lang: GradeLang = body.lang === "en" ? "en" : "id";
    const isEn = lang === "en";
    const term = body.term?.trim() ?? "";
    const sentence = body.sentence?.trim() ?? "";
    const meaning = isEn
      ? body.meaning_en?.trim() || body.meaning_id?.trim() || ""
      : body.meaning_id?.trim() || body.meaning_en?.trim() || "";
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

    const invalidResult = detectInvalidOrNonAttempt(
      sentence,
      term,
      meaning,
      wordFamilies,
      lang,
      exampleSentence
    );
    if (invalidResult) {
      return NextResponse.json({
        result: invalidResult,
        source: "validation",
      });
    }

    const verdictEnum = isEn
      ? ["Natural", "Good", "Needs Work", "No Valid Attempt"]
      : [
          "Natural",
          "Cukup Baik",
          "Kurang Tepat",
          "Belum Menjawab / Tidak Valid",
        ];

    const prompt = isEn
      ? `You are a strict yet constructive native English writing coach for an advanced C1–C2 learner.
Target expression: "${term}"
Definition: "${meaning}"
Expected register: "${register}"
Allowed word-family forms: ${wordFamilies.map((w) => `${w.word} (${w.pos})`).join(", ") || term}
Learner's sentence: "${sentence}"

Evaluate whether the learner used "${term}" (or a valid inflection/word-family form) accurately, grammatically, and naturally in context.

STRICT SCORING RUBRIC (MUST FOLLOW):
- 0 to 10 ("No Valid Attempt", is_correct=false): Empty, < 3 words, random gibberish/keyboard mash, non-English refusal, or non-attempts like "idunno", "idk", "skip", "test". NEVER give 35 for non-attempts!
- 20 to 45 ("Needs Work", is_correct=false): Learner wrote a real, complete English sentence, BUT either did not use the target expression at all OR used it with the wrong meaning/context.
- 46 to 69 ("Needs Work", is_correct=false): Uses the target expression with partial understanding, but has significant grammar issues, unnatural collocation, or incomplete context.
- 70 to 84 ("Good", is_correct=true): Clear, understandable, mostly natural English sentence using the target expression accurately with only minor phrasing/grammar tweaks.
- 85 to 100 ("Natural", is_correct=true): Idiomatic, accurate meaning, proper grammar, and matching register.

Return strictly valid JSON (ALL feedback and tips MUST be in natural English — ZERO Indonesian):
- "is_correct": boolean (true ONLY if "Natural" or "Good", false otherwise)
- "verdict": exactly one of "Natural", "Good", "Needs Work", or "No Valid Attempt"
- "score": integer 0-100 following the strict rubric above
- "feedback_id": specific, natural feedback in ENGLISH (2 sentences max) addressing the exact sentence written.
- "native_rewrite": a polished, natural native-speaker English sentence using "${term}".
- "tip": 1 short actionable tip in ENGLISH on register, collocation, or phrasing.`
      : `You are a strict yet constructive native English writing coach for an Indonesian learner.
Target expression: "${term}"
Indonesian meaning: "${meaning}"
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

    const aiRes = await generateStructuredWithHybridModel<
      Partial<SentenceGradeResult>
    >({
      tier: "flash",
      routeName: "api/grade-sentence",
      contents: prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          is_correct: { type: Type.BOOLEAN },
          verdict: {
            type: Type.STRING,
            enum: verdictEnum,
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
    });

    if (!aiRes.ok) {
      return NextResponse.json({
        result: buildFallbackGrade(
          term,
          meaning,
          sentence,
          wordFamilies,
          lang,
          exampleSentence
        ),
        source: "fallback",
      });
    }

    const parsed = aiRes.data;
    const rawScore =
      typeof parsed.score === "number" && Number.isFinite(parsed.score)
        ? Math.max(0, Math.min(100, Math.round(parsed.score)))
        : 0;

    const validSet = isEn ? VALID_VERDICTS_EN : VALID_VERDICTS_ID;
    const invalidVerdict: SentenceGradeVerdict = isEn
      ? "No Valid Attempt"
      : "Belum Menjawab / Tidak Valid";
    const goodVerdict: SentenceGradeVerdict = isEn ? "Good" : "Cukup Baik";
    const weakVerdict: SentenceGradeVerdict = isEn
      ? "Needs Work"
      : "Kurang Tepat";

    let verdict: SentenceGradeVerdict =
      parsed.verdict && validSet.has(parsed.verdict)
        ? parsed.verdict
        : rawScore <= 10
          ? invalidVerdict
          : parsed.is_correct
            ? goodVerdict
            : weakVerdict;

    if (rawScore <= 10) {
      verdict = invalidVerdict;
    }

    const clampedScore =
      verdict === invalidVerdict ? Math.min(10, rawScore) : rawScore;
    const isCorrect =
      verdict === "Natural" || verdict === goodVerdict
        ? Boolean(parsed.is_correct ?? true)
        : false;

    return NextResponse.json({
      result: {
        is_correct: isCorrect,
        verdict,
        score: clampedScore,
        feedback_id:
          parsed.feedback_id ||
          (isEn ? "Sentence evaluated." : "Kalimat sudah dinilai."),
        native_rewrite:
          parsed.native_rewrite ||
          buildSampleNativeRewrite(term, exampleSentence),
        tip:
          parsed.tip ||
          (isEn
            ? "Keep practicing writing sentences in natural context!"
            : "Pertahankan latihan menulis kalimat kontekstual!"),
      },
      source: "gemini",
    });
  } catch (err) {
    const classified = classifyGeminiError(err);
    logGeminiRouteError("api/grade-sentence", classified);
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
