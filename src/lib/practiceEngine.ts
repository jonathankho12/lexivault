import type {
  DiscoveryItem,
  PracticeQuestion,
  QuestionKind,
  WordEntry,
} from "@/types/lexivault";
import { getWeakestWords } from "@/lib/utils";

const FALLBACK_MEANING_DISTRACTORS = [
  "Melakukan sesuatu secara tergesa-gesa tanpa pertimbangan jangka panjang.",
  "Keadaan ketika dua pihak menolak berkompromi dalam situasi mendesak.",
  "Kebiasaan menjaga rutinitas lama meskipun lingkungan sudah berubah drastis.",
  "Upaya menyembunyikan informasi penting agar terhindar dari kritik publik.",
];

const FALLBACK_TERM_DISTRACTORS = [
  "pragmatic",
  "mitigate",
  "resilient",
  "cut corners",
  "strike a balance",
  "ubiquitous",
];

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFillBlankPrompt(word: WordEntry): {
  blankSentence: string;
  blankTarget: string;
  blankTranslation: string;
} {
  const sample = word.examples_json?.[0];
  if (!sample) {
    return {
      blankSentence: `We often encounter the expression "_____" when discussing ${word.register.toLowerCase()} topics.`,
      blankTarget: word.term,
      blankTranslation: word.meaning_id,
    };
  }

  const boldMatch = sample.sentence.match(/\*\*(.+?)\*\*/);
  if (boldMatch && boldMatch[1]) {
    const target = boldMatch[1].trim();
    const blankSentence = sample.sentence
      .replace(/\*\*(.+?)\*\*/, "_____")
      .replace(/\*\*/g, "");
    return {
      blankSentence,
      blankTarget: target,
      blankTranslation: sample.translation_id.replace(/\*\*/g, ""),
    };
  }

  const regex = new RegExp(`\\b(${escapeRegExp(word.term)})\\b`, "i");
  if (regex.test(sample.sentence)) {
    const matched = sample.sentence.match(regex)?.[1] ?? word.term;
    return {
      blankSentence: sample.sentence.replace(regex, "_____"),
      blankTarget: matched,
      blankTranslation: sample.translation_id.replace(/\*\*/g, ""),
    };
  }

  return {
    blankSentence: `In context: "_____" — (${word.meaning_id})`,
    blankTarget: word.term,
    blankTranslation: sample.translation_id.replace(/\*\*/g, ""),
  };
}

function createQuestionForWord(
  word: WordEntry,
  kind: QuestionKind,
  pool: WordEntry[],
  index: number
): PracticeQuestion {
  const id = `q-${index}-${word.id}-${kind}`;

  if (kind === "flashcard") {
    const otherMeanings = shuffleArray(
      pool
        .filter((item) => item.id !== word.id && item.meaning_id !== word.meaning_id)
        .map((item) => item.meaning_id)
    );
    const distractors = [...otherMeanings, ...FALLBACK_MEANING_DISTRACTORS].slice(
      0,
      3
    );
    const choices = shuffleArray([word.meaning_id, ...distractors]);

    return {
      id,
      word,
      kind,
      choices,
      correctChoice: word.meaning_id,
    };
  }

  if (kind === "fill_blank") {
    const { blankSentence, blankTarget, blankTranslation } =
      buildFillBlankPrompt(word);
    const otherTerms = shuffleArray(
      pool
        .filter((item) => item.id !== word.id && item.term.toLowerCase() !== word.term.toLowerCase())
        .map((item) => item.term)
    );
    const distractors = [...otherTerms, ...FALLBACK_TERM_DISTRACTORS]
      .filter((t) => t.toLowerCase() !== blankTarget.toLowerCase())
      .slice(0, 3);
    const choices = shuffleArray([blankTarget, ...distractors]);

    return {
      id,
      word,
      kind,
      choices,
      correctChoice: blankTarget,
      blankSentence,
      blankTarget,
      blankTranslation,
    };
  }

  return {
    id,
    word,
    kind: "make_sentence",
  };
}

function assignQuestionKinds(words: WordEntry[], pool: WordEntry[]): PracticeQuestion[] {
  // Cycle across all 3 core exercise types while guaranteeing make_sentence appears regularly
  const pattern: QuestionKind[] = [
    "flashcard",
    "fill_blank",
    "make_sentence",
    "flashcard",
    "fill_blank",
  ];

  return words.map((word, idx) =>
    createQuestionForWord(word, pattern[idx % pattern.length], pool, idx)
  );
}

export function buildSmartMixSession(
  words: WordEntry[],
  maxCount = 20
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
  const selected = scored.slice(0, Math.min(maxCount, scored.length)).map((s) => s.word);

  return assignQuestionKinds(shuffleArray(selected), words);
}

export function buildFullMarathonSession(words: WordEntry[]): PracticeQuestion[] {
  if (words.length === 0) return [];
  const shuffled = shuffleArray(words);
  return assignQuestionKinds(shuffled, words);
}

export function buildWeakestDrillSession(words: WordEntry[]): PracticeQuestion[] {
  if (words.length === 0) return [];
  const weakest = getWeakestWords(words, 15);
  const targetPool =
    weakest.length > 0
      ? weakest
      : [...words]
          .sort((a, b) => a.correct_count - b.correct_count)
          .slice(0, Math.min(10, words.length));

  return assignQuestionKinds(shuffleArray(targetPool), words);
}

export function buildDailyMiniQuizSession(
  items: DiscoveryItem[],
  vaultWords: WordEntry[]
): PracticeQuestion[] {
  const asWords: WordEntry[] = items.map((item) => ({
    id: item.id,
    term: item.term,
    pronunciation: item.pronunciation,
    ipa: item.ipa,
    type: item.type,
    meaning_id: item.meaning_id,
    examples_json: item.examples_json,
    synonyms: item.synonyms,
    antonyms: item.antonyms,
    word_families_json: item.word_families_json,
    register: item.register,
    source_tag: item.source_tag ?? "Discover",
    correct_count: 0,
    wrong_count: 0,
    created_at: new Date().toISOString(),
  }));

  const combinedPool = [...asWords, ...vaultWords];
  return assignQuestionKinds(asWords, combinedPool);
}
