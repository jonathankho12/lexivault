import {
  buildNormalizedMeaningChoices,
  buildNormalizedTermChoices,
  shuffleOptions,
} from "@/lib/distractorEngine";
import type { AppLanguage } from "@/lib/i18n";
import { getLocalizedMeaning, getWeakestWords } from "@/lib/utils";
import type {
  DiscoveryItem,
  PracticeQuestion,
  QuestionKind,
  WordEntry,
} from "@/types/lexivault";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFillBlankPrompt(
  word: WordEntry,
  lang: AppLanguage
): {
  blankSentence: string;
  blankTarget: string;
  blankTranslation: string;
} {
  const localizedMeaning = getLocalizedMeaning(word, lang);
  const sample = word.examples_json?.[0];
  if (!sample) {
    return {
      blankSentence: `We often encounter the expression "_____" when discussing ${word.register.toLowerCase()} topics.`,
      blankTarget: word.term,
      blankTranslation: localizedMeaning,
    };
  }

  const clueText =
    lang === "en"
      ? localizedMeaning
      : sample.translation_id.replace(/\*\*/g, "") || localizedMeaning;

  const boldMatch = sample.sentence.match(/\*\*(.+?)\*\*/);
  if (boldMatch && boldMatch[1]) {
    const target = boldMatch[1].trim();
    const blankSentence = sample.sentence
      .replace(/\*\*(.+?)\*\*/, "_____")
      .replace(/\*\*/g, "");
    return {
      blankSentence,
      blankTarget: target,
      blankTranslation: clueText,
    };
  }

  const regex = new RegExp(`\\b(${escapeRegExp(word.term)})\\b`, "i");
  if (regex.test(sample.sentence)) {
    const matched = sample.sentence.match(regex)?.[1] ?? word.term;
    return {
      blankSentence: sample.sentence.replace(regex, "_____"),
      blankTarget: matched,
      blankTranslation: clueText,
    };
  }

  return {
    blankSentence: `In context: "_____" — (${localizedMeaning})`,
    blankTarget: word.term,
    blankTranslation: clueText,
  };
}

function createQuestionForWord(
  word: WordEntry,
  kind: QuestionKind,
  pool: WordEntry[],
  index: number,
  lang: AppLanguage
): PracticeQuestion {
  const id = `q-${index}-${word.id}-${kind}`;

  if (kind === "flashcard") {
    const { choices, correctChoice } = buildNormalizedMeaningChoices({
      target: word,
      pool,
      lang,
    });

    return {
      id,
      word,
      kind,
      choices,
      correctChoice,
    };
  }

  if (kind === "fill_blank") {
    const { blankSentence, blankTarget, blankTranslation } =
      buildFillBlankPrompt(word, lang);
    const { choices, correctChoice } = buildNormalizedTermChoices({
      target: word,
      blankTarget,
      pool,
    });

    return {
      id,
      word,
      kind,
      choices,
      correctChoice,
      blankSentence,
      blankTarget: correctChoice,
      blankTranslation,
    };
  }

  return {
    id,
    word,
    kind: "make_sentence",
  };
}

export function applyAiDistractorsToPracticeQuestions(
  questions: PracticeQuestion[],
  pool: WordEntry[],
  lang: AppLanguage,
  aiDistractorsByQuestionId: Record<string, string[]>
): PracticeQuestion[] {
  return questions.map((q) => {
    if (q.kind !== "flashcard") return q;
    const aiList = aiDistractorsByQuestionId[q.id];
    if (!aiList || aiList.length === 0) return q;
    const { choices, correctChoice } = buildNormalizedMeaningChoices({
      target: q.word,
      pool,
      lang,
      aiDistractors: aiList,
    });
    return {
      ...q,
      choices,
      correctChoice,
    };
  });
}

function assignQuestionKinds(
  words: WordEntry[],
  pool: WordEntry[],
  lang: AppLanguage
): PracticeQuestion[] {
  const pattern: QuestionKind[] = [
    "flashcard",
    "fill_blank",
    "make_sentence",
    "flashcard",
    "fill_blank",
  ];

  return words.map((word, idx) =>
    createQuestionForWord(word, pattern[idx % pattern.length], pool, idx, lang)
  );
}

export function buildSmartMixSession(
  words: WordEntry[],
  maxCount = 20,
  lang: AppLanguage = "id"
): PracticeQuestion[] {
  if (words.length === 0) return [];

  const now = Date.now();
  const scored = words.map((word) => {
    const totalAttempts = word.correct_count + word.wrong_count;
    const errorRate = (word.wrong_count + 0.5) / (totalAttempts + 1.5);
    const ageDays = Math.max(
      0,
      (now - new Date(word.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const recencyBoost = ageDays <= 3 ? 0.55 : ageDays <= 7 ? 0.25 : 0;
    const untestedBoost = totalAttempts === 0 ? 0.45 : 0;
    const jitter = Math.random() * 0.25;

    return {
      word,
      priority: errorRate * 1.35 + recencyBoost + untestedBoost + jitter,
    };
  });

  scored.sort((a, b) => b.priority - a.priority);
  const selected = scored
    .slice(0, Math.min(maxCount, scored.length))
    .map((s) => s.word);

  return assignQuestionKinds(shuffleOptions(selected), words, lang);
}

export function buildFullMarathonSession(
  words: WordEntry[],
  lang: AppLanguage = "id"
): PracticeQuestion[] {
  if (words.length === 0) return [];
  const shuffled = shuffleOptions(words);
  return assignQuestionKinds(shuffled, words, lang);
}

export function buildWeakestDrillSession(
  words: WordEntry[],
  lang: AppLanguage = "id"
): PracticeQuestion[] {
  if (words.length === 0) return [];
  const weakest = getWeakestWords(words, 15);
  const targetPool =
    weakest.length > 0
      ? weakest
      : [...words]
          .sort((a, b) => a.correct_count - b.correct_count)
          .slice(0, Math.min(10, words.length));

  return assignQuestionKinds(shuffleOptions(targetPool), words, lang);
}

export function buildDailyMiniQuizSession(
  items: DiscoveryItem[],
  vaultWords: WordEntry[],
  lang: AppLanguage = "id"
): PracticeQuestion[] {
  const asWords: WordEntry[] = items.map((item) => ({
    id: item.id,
    term: item.term,
    pronunciation: item.pronunciation,
    ipa: item.ipa,
    cefr: item.cefr,
    type: item.type,
    meaning_id: item.meaning_id,
    meaning_en: item.meaning_en,
    examples_json: item.examples_json,
    synonyms: item.synonyms,
    antonyms: item.antonyms,
    word_families_json: item.word_families_json,
    register: item.register,
    source_tag: item.source_tag ?? "discover",
    correct_count: 0,
    wrong_count: 0,
    created_at: new Date().toISOString(),
  }));

  const combinedPool = [...asWords, ...vaultWords];
  return assignQuestionKinds(asWords, combinedPool, lang);
}
