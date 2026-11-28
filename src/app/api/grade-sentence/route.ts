import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import {
  buildSentenceGradingPrompt,
  classifyGeminiError,
  generateStructuredWithHybridModel,
  logGeminiRouteError,
  SENTENCE_GRADING_SYSTEM_INSTRUCTION,
} from "@/lib/gemini";
import { enforceRateLimit } from "@/lib/rate-limit";
import type {
  SentenceGradeResult,
  SentenceGradeVerdict,
  WordFamilyItem,
} from "@/types/lexivault";

type GradeLang = "en" | "id" | "ru";

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

const VALID_VERDICTS_RU = new Set<SentenceGradeVerdict>([
  "Естественно",
  "Хорошо",
  "Нужно доработать",
  "Нет попытки",
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
  "не знаю",
  "незнаю",
  "хз",
  "без понятия",
  "пропуск",
  "пропустить",
  "дальше",
  "непонятно",
  "тест",
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
  "не знаю",
  "без понятия",
  "не понимаю",
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

const ENGLISH_FUNCTION_WORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "for",
  "with",
  "from",
  "up",
  "out",
  "off",
  "it",
  "one",
  "one's",
  "ones",
  "someone",
  "something",
  "somebody",
  "my",
  "your",
  "his",
  "her",
  "its",
  "our",
  "their",
  "be",
]);

function stripEdgePunctuation(token: string): string {
  return token.replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, "");
}

function getInflectionStem(word: string): string {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  if (clean.length <= 3) return clean;
  if (clean.endsWith("ie")) return clean.slice(0, -2);
  if (clean.endsWith("e") && clean.length >= 4) return clean.slice(0, -1);
  if (clean.endsWith("y") && clean.length >= 4) return clean.slice(0, -1);
  return clean;
}

function matchesTargetExpression(
  lowerSentence: string,
  term: string,
  wordFamilies: WordFamilyItem[]
): boolean {
  const candidateForms = [
    term.trim().toLowerCase(),
    ...wordFamilies.map((wf) => wf.word.trim().toLowerCase()),
  ].filter(Boolean);

  if (candidateForms.some((form) => lowerSentence.includes(form))) {
    return true;
  }

  const sentenceWords = lowerSentence
    .split(/\s+/)
    .map((w) => stripEdgePunctuation(w).toLowerCase())
    .filter(Boolean);

  const tokenMatches = (targetWord: string): boolean => {
    const stem = getInflectionStem(targetWord);
    if (stem.length < 3) {
      return sentenceWords.includes(targetWord);
    }
    return sentenceWords.some(
      (sw) => sw === targetWord || (sw.startsWith(stem) && sw.length <= stem.length + 5)
    );
  };

  for (const form of candidateForms) {
    const formWords = form
      .split(/\s+/)
      .map((w) => stripEdgePunctuation(w).toLowerCase())
      .filter(Boolean);

    if (formWords.length === 1) {
      if (tokenMatches(formWords[0])) return true;
      continue;
    }

    const contentWords = formWords.filter(
      (w) => w.length >= 3 && !ENGLISH_FUNCTION_WORDS.has(w)
    );
    if (contentWords.length === 0) continue;

    // Match all content words by inflectional stem (e.g. "burn" -> "burnt"/"burned")
    if (contentWords.every(tokenMatches)) {
      return true;
    }

    // Allow irregular first-verb inflection in multi-word idioms with >= 2 distinctive tail words
    // (e.g. "burn the midnight oil" -> "burnt the midnight oil", "take with a grain of salt" -> "took ... grain of salt")
    if (contentWords.length >= 3) {
      const tailWords = contentWords.slice(1);
      if (tailWords.every(tokenMatches)) {
        return true;
      }
    }
  }

  return false;
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

function getGradeVerdicts(lang: GradeLang): {
  natural: SentenceGradeVerdict;
  good: SentenceGradeVerdict;
  weak: SentenceGradeVerdict;
  invalid: SentenceGradeVerdict;
  validSet: Set<SentenceGradeVerdict>;
  verdictEnum: string[];
} {
  if (lang === "en") {
    return {
      natural: "Natural",
      good: "Good",
      weak: "Needs Work",
      invalid: "No Valid Attempt",
      validSet: VALID_VERDICTS_EN,
      verdictEnum: ["Natural", "Good", "Needs Work", "No Valid Attempt"],
    };
  }
  if (lang === "ru") {
    return {
      natural: "Естественно",
      good: "Хорошо",
      weak: "Нужно доработать",
      invalid: "Нет попытки",
      validSet: VALID_VERDICTS_RU,
      verdictEnum: ["Естественно", "Хорошо", "Нужно доработать", "Нет попытки"],
    };
  }
  return {
    natural: "Natural",
    good: "Cukup Baik",
    weak: "Kurang Tepat",
    invalid: "Belum Menjawab / Tidak Valid",
    validSet: VALID_VERDICTS_ID,
    verdictEnum: [
      "Natural",
      "Cukup Baik",
      "Kurang Tepat",
      "Belum Menjawab / Tidak Valid",
    ],
  };
}

function pickLangText(lang: GradeLang, en: string, ru: string, id: string): string {
  return lang === "en" ? en : lang === "ru" ? ru : id;
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
  const { invalid: invalidVerdict, weak: weakVerdict } = getGradeVerdicts(lang);
  const tip = pickLangText(
    lang,
    `Keep the meaning in mind: ${meaning || `review how "${term}" works in context.`}`,
    `Помни значение: ${meaning || `разбери, как «${term}» работает в контексте.`}`,
    `Ingat maknanya: ${meaning || `pelajari konteks penggunaan "${term}".`}`
  );

  if (!trimmed) {
    return {
      is_correct: false,
      verdict: invalidVerdict,
      score: 0,
      feedback_id: pickLangText(
        lang,
        `You haven't written a sentence yet. Write at least one complete English sentence using "${term}".`,
        `Ты пока не написал(а) предложение. Напиши хотя бы одно законченное английское предложение с выражением «${term}».`,
        `Kamu belum menuliskan kalimat apa pun. Tulis minimal 1 kalimat bahasa Inggris utuh yang menggunakan "${term}".`
      ),
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
      feedback_id: pickLangText(
        lang,
        `"${trimmed}" is not a valid English sentence attempt. Try writing one simple sentence (subject + verb + context) using "${term}"—mistakes are totally fine!`,
        `«${trimmed}» — это не попытка английского предложения. Попробуй написать одно простое предложение (подлежащее + глагол + контекст) с «${term}» — ошибаться нормально!`,
        `Input "${trimmed}" bukan percobaan kalimat bahasa Inggris. Coba tulis 1 kalimat sederhana (subjek + kata kerja + konteks) memakai "${term}"—tidak apa-apa salah dulu!`
      ),
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
  const usesTarget = matchesTargetExpression(lowerSentence, term, wordFamilies);

  const cyrillicTokens = cleanedTokens.filter((w) =>
    /[а-яА-ЯёЁ]{2,}/.test(w)
  ).length;
  if (
    cyrillicTokens >= 2 ||
    (cyrillicTokens >= 1 && alphaWords.length < 3)
  ) {
    return {
      is_correct: false,
      verdict: weakVerdict,
      score: usesTarget ? 25 : 15,
      feedback_id: pickLangText(
        lang,
        `Your sentence is written in Russian. Write a full English sentence incorporating "${term}" naturally.`,
        `Предложение написано на русском. Напиши законченное предложение полностью на английском и органично включи туда «${term}».`,
        `Kalimatmu masih memakai bahasa Rusia. Coba tulis kalimat penuh dalam bahasa Inggris dengan memakai "${term}".`
      ),
      native_rewrite: sampleRewrite,
      tip: pickLangText(
        lang,
        `Use complete English sentence structure to actively practice "${term}".`,
        `Потренируйся строить целую фразу на английском — так «${term}» быстрее запомнится в контексте.`,
        `Gunakan struktur kalimat bahasa Inggris penuh untuk melatih "${term}".`
      ),
    };
  }

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
      feedback_id: pickLangText(
        lang,
        `Your input looks like random characters rather than a valid English sentence. Write a meaningful sentence using "${term}" for accurate feedback.`,
        `Похоже на случайный набор символов, а не на английское предложение. Напиши осмысленное предложение с «${term}», чтобы получить точный разбор.`,
        `Jawaban terdeteksi acak atau belum berupa kalimat bahasa Inggris yang valid. Susun kalimat bermakna menggunakan "${term}" agar bisa dinilai dengan akurat.`
      ),
      native_rewrite: sampleRewrite,
      tip,
    };
  }

  if (alphaWords.length < 3) {
    return {
      is_correct: false,
      verdict: invalidVerdict,
      score: usesTarget ? 10 : 5,
      feedback_id: usesTarget
        ? pickLangText(
            lang,
            `You only wrote ${alphaWords.length} word(s)—"${term}" is included, but it isn't a full sentence yet. Add a subject and clear context.`,
            `Ты написал(а) всего ${alphaWords.length} сл. — «${term}» уже есть, но это ещё не целое предложение. Добавь подлежащее и понятный контекст.`,
            `Kamu baru menulis ${alphaWords.length} kata — "${term}" sudah muncul, tetapi belum membentuk kalimat utuh. Tambahkan subjek dan konteks kalimat lengkap.`
          )
        : pickLangText(
            lang,
            `Your response is too short (${alphaWords.length} word(s)) to be a complete sentence. Write at least one full sentence using "${term}".`,
            `Ответ слишком короткий (${alphaWords.length} сл.) для полноценного предложения. Напиши хотя бы одно законченное предложение с «${term}».`,
            `Jawabanmu terlalu pendek (${alphaWords.length} kata) dan belum membentuk kalimat utuh. Tulis minimal 1 kalimat lengkap menggunakan "${term}".`
          ),
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

  const { natural: naturalVerdict, good: goodVerdict, weak: weakVerdict } =
    getGradeVerdicts(lang);
  const trimmed = sentence.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const lowerSentence = trimmed.toLowerCase();
  const sampleRewrite = buildSampleNativeRewrite(term, exampleSentence);

  const usesTarget = matchesTargetExpression(lowerSentence, term, wordFamilies);

  const indonesianHits = words
    .map((w) => stripEdgePunctuation(w).toLowerCase())
    .filter((w) => INDONESIAN_COMMON_WORDS.has(w)).length;
  if (indonesianHits >= 2 && indonesianHits / words.length >= 0.3) {
    return {
      is_correct: false,
      verdict: weakVerdict,
      score: usesTarget ? 28 : 20,
      feedback_id: pickLangText(
        lang,
        `Your sentence is mostly written in Indonesian. Write a full English sentence incorporating "${term}" naturally.`,
        `Предложение в основном написано на индонезийском. Напиши законченную английскую фразу и естественно встрой в неё «${term}».`,
        `Kalimatmu masih didominasi bahasa Indonesia. Coba tulis kalimat penuh dalam bahasa Inggris sambil memasukkan "${term}" secara alami.`
      ),
      native_rewrite: sampleRewrite,
      tip: pickLangText(
        lang,
        `Use complete English sentence structure to actively practice "${term}".`,
        `Используй законченную английскую конструкцию, чтобы отработать «${term}» на практике.`,
        `Gunakan struktur kalimat bahasa Inggris penuh untuk melatih "${term}".`
      ),
    };
  }

  if (!usesTarget) {
    const score = words.length >= 5 ? 32 : 24;
    return {
      is_correct: false,
      verdict: weakVerdict,
      score,
      feedback_id: pickLangText(
        lang,
        `Your English sentence is taking shape, but it doesn't include the target expression "${term}". Include "${term}" (or one of its word-family forms) in context.`,
        `Предложение на английском уже вырисовывается, но в нём нет целевого выражения «${term}». Обязательно вставь «${term}» (или однокоренную форму) в контекст.`,
        `Kalimat bahasa Inggrismu sudah mulai terbentuk, tetapi belum memakai kata atau frasa target "${term}". Masukkan "${term}" (atau bentuk turunannya) ke dalam konteks kalimat.`
      ),
      native_rewrite: sampleRewrite,
      tip: pickLangText(
        lang,
        `Keep the meaning in mind: ${meaning}`,
        `Держи в голове значение: ${meaning}`,
        `Ingat maknanya: ${meaning}`
      ),
    };
  }

  if (words.length < 5) {
    return {
      is_correct: false,
      verdict: weakVerdict,
      score: 45,
      feedback_id: pickLangText(
        lang,
        `You included "${term}", but the sentence is still too brief (${words.length} words). Add who, when, or why to make the context feel natural.`,
        `Ты использовал(а) «${term}», но фраза пока слишком короткая (${words.length} сл.). Добавь детали — кто, когда или почему, — чтобы контекст звучал живо.`,
        `Kamu sudah memasukkan "${term}", tetapi kalimat masih terlalu singkat (${words.length} kata). Tambahkan konteks siapa, kapan, atau mengapa agar kalimat terasa natural.`
      ),
      native_rewrite: sampleRewrite,
      tip: pickLangText(
        lang,
        "Add a brief clause explaining the reason or setting to sound more idiomatic.",
        "Добавь небольшое придаточное с причиной или ситуацией — так выражение зазвучит естественно.",
        "Tambahkan keterangan konteks atau alasan agar penggunaan kata terdengar lebih idiomatik."
      ),
    };
  }

  const endsCleanly = /[.!?]$/.test(trimmed);
  const normalizedSentence = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  const cleanPunctuated = endsCleanly
    ? normalizedSentence
    : `${normalizedSentence}.`;

  return {
    is_correct: true,
    verdict: endsCleanly && words.length >= 7 ? naturalVerdict : goodVerdict,
    score: endsCleanly && words.length >= 7 ? 88 : 78,
    feedback_id: pickLangText(
      lang,
      `Well done! You built a complete English sentence using "${term}". Connect GEMINI_API_KEY for deeper grammar and register coaching.`,
      `Отлично! Ты составил(а) законченное английское предложение с «${term}». Подключи GEMINI_API_KEY для глубокого разбора грамматики и стиля.`,
      `Bagus! Kamu berhasil menyusun kalimat bahasa Inggris yang utuh dengan "${term}". Sambungkan GEMINI_API_KEY untuk evaluasi tata bahasa & nuansa register secara mendalam.`
    ),
    native_rewrite: cleanPunctuated,
    tip: pickLangText(
      lang,
      "Double-check tense agreement and final punctuation to sound even more natural.",
      "Обрати внимание на согласование времён и финальную пунктуацию, чтобы звучать ещё ближе к носителю.",
      "Perhatikan kesesuaian tenses dan tanda baca di akhir kalimat agar terdengar semakin native."
    ),
  };
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, {
    bucket: "grade-sentence",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const body = (await request.json()) as {
      term?: string;
      meaning_id?: string;
      meaning_en?: string;
      meaning_ru?: string;
      register?: string;
      sentence?: string;
      word_families?: WordFamilyItem[];
      example_sentence?: string;
      lang?: GradeLang;
    };

    const lang: GradeLang =
      body.lang === "en" ? "en" : body.lang === "ru" ? "ru" : "id";
    const term = body.term?.trim() ?? "";
    const sentence = body.sentence?.trim() ?? "";
    const meaning =
      lang === "en"
        ? body.meaning_en?.trim() ||
          body.meaning_id?.trim() ||
          body.meaning_ru?.trim() ||
          ""
        : lang === "ru"
          ? body.meaning_ru?.trim() ||
            body.meaning_en?.trim() ||
            body.meaning_id?.trim() ||
            ""
          : body.meaning_id?.trim() ||
            body.meaning_en?.trim() ||
            body.meaning_ru?.trim() ||
            "";
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

    const {
      natural: naturalVerdict,
      validSet,
      invalidVerdict,
      goodVerdict,
      weakVerdict,
      verdictEnum,
    } = (() => {
      const cfg = getGradeVerdicts(lang);
      return {
        natural: cfg.natural,
        validSet: cfg.validSet,
        invalidVerdict: cfg.invalid,
        goodVerdict: cfg.good,
        weakVerdict: cfg.weak,
        verdictEnum: cfg.verdictEnum,
      };
    })();

    const prompt = buildSentenceGradingPrompt({
      term,
      meaning,
      register,
      wordFamiliesText:
        wordFamilies.map((w) => `${w.word} (${w.pos})`).join(", ") || term,
      sentence,
      lang,
    });

    const aiRes = await generateStructuredWithHybridModel<
      Partial<SentenceGradeResult>
    >({
      tier: "flash",
      routeName: "api/grade-sentence",
      systemInstruction: SENTENCE_GRADING_SYSTEM_INSTRUCTION,
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
      verdict === naturalVerdict || verdict === goodVerdict
        ? Boolean(parsed.is_correct ?? true)
        : false;

    return NextResponse.json({
      result: {
        is_correct: isCorrect,
        verdict,
        score: clampedScore,
        feedback_id:
          parsed.feedback_id ||
          pickLangText(
            lang,
            "Sentence evaluated.",
            "Предложение проверено.",
            "Kalimat sudah dinilai."
          ),
        native_rewrite:
          parsed.native_rewrite ||
          buildSampleNativeRewrite(term, exampleSentence),
        tip:
          parsed.tip ||
          pickLangText(
            lang,
            "Keep practicing writing sentences in natural context!",
            "Продолжай тренировать составление предложений в живом контексте!",
            "Pertahankan latihan menulis kalimat kontekstual!"
          ),
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
