export type WordType = "vocab" | "idiom" | "collocation";

export type RegisterType = "Formal" | "Academic" | "Casual" | "Slang";

export type AccentType = "US" | "UK";

export type TabId =
  | "vault"
  | "flashcards"
  | "practice"
  | "ielts"
  | "discover"
  | "stats";

export type SourceTag = "film" | "book" | "lecture" | "article" | "general";

export type CefrLevel = "B2" | "C1" | "C2";

export type SuggestCategory = "mix" | "idiom" | "vocab" | "collocation";

export type SuggestRegister = "any" | "Academic" | "Formal" | "Casual";

export interface CaptureToastState {
  message: string;
  type: "success" | "error" | "info";
}

export type Sm2Rating = "again" | "hard" | "good" | "easy";

export type MasteryRank =
  | "Observer"
  | "Articulate"
  | "Eloquent"
  | "Rhetorician"
  | "Lexicon Master";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  provider: "supabase" | "local" | "guest";
}

export interface WordExample {
  sentence: string;
  translation_id: string;
  context: "Daily" | "Academic" | string;
}

export interface WordFamilyItem {
  word: string;
  pos: string;
}

export interface WordEntry {
  id: string;
  user_id?: string;
  term: string;
  pronunciation?: string;
  ipa?: string;
  cefr?: CefrLevel | string;
  type: WordType;
  meaning_id: string;
  meaning_en?: string;
  examples_json: WordExample[];
  synonyms: string[];
  antonyms: string[];
  word_families_json: WordFamilyItem[];
  register: RegisterType;
  source_tag: string;
  audio_us_url?: string | null;
  audio_uk_url?: string | null;
  correct_count: number;
  wrong_count: number;
  last_practiced_at?: string | null;
  next_review_at?: string | null;
  interval_days?: number;
  ease_factor?: number;
  repetitions?: number;
  created_at: string;
}

export interface DiscoveryItem {
  id: string;
  term: string;
  pronunciation?: string;
  ipa?: string;
  cefr?: CefrLevel | string;
  type: WordType;
  meaning_id: string;
  meaning_en?: string;
  examples_json: WordExample[];
  synonyms: string[];
  antonyms: string[];
  word_families_json: WordFamilyItem[];
  register: RegisterType;
  source_tag?: string;
}

export interface DailyDiscoveryPack {
  discovery_date: string;
  items: DiscoveryItem[];
  source?: "supabase" | "gemini" | "fallback";
}

export interface StudyLog {
  id: string;
  user_id?: string;
  study_date: string;
  reviews_count: number;
  correct_count: number;
  wrong_count: number;
  words_added: number;
  vocab_today?: number;
  recall_today?: number;
  ielts_today?: number;
  xp_earned?: number;
  updated_at?: string;
}

export interface DailyRingsProgress {
  vocab: number;
  recall: number;
  ielts: number;
  vocabTarget: number;
  recallTarget: number;
  ieltsTarget: number;
}

export interface ExtractedVocabItem {
  term: string;
  pronunciation?: string;
  ipa?: string;
  cefr?: CefrLevel | string;
  type: WordType;
  meaning_id: string;
  meaning_en?: string;
  examples: WordExample[];
  synonyms: string[];
  antonyms: string[];
  word_families: WordFamilyItem[];
  register: RegisterType;
}

export interface SuggestedWordItem {
  term: string;
  pronunciation?: string;
  ipa?: string;
  cefr: CefrLevel;
  type: WordType;
  meaning_en: string;
  meaning_id: string;
  examples: WordExample[];
  synonyms: string[];
  antonyms: string[];
  word_families: WordFamilyItem[];
  register: RegisterType;
  source_tag: SourceTag;
}

export type PracticeMode =
  | "smart_mix"
  | "full_marathon"
  | "weakest_drill"
  | "daily_mini";

export type QuestionKind = "flashcard" | "fill_blank" | "make_sentence";

export interface PracticeQuestion {
  id: string;
  word: WordEntry;
  kind: QuestionKind;
  choices?: string[];
  correctChoice?: string;
  blankSentence?: string;
  blankTarget?: string;
  blankTranslation?: string;
}

export type SentenceGradeVerdict =
  | "Natural"
  | "Cukup Baik"
  | "Kurang Tepat"
  | "Belum Menjawab / Tidak Valid"
  | "Good"
  | "Needs Work"
  | "No Valid Attempt";

export interface SentenceGradeResult {
  is_correct: boolean;
  verdict: SentenceGradeVerdict;
  score: number;
  feedback_id: string;
  native_rewrite: string;
  tip: string;
}

export interface AutofillPayload {
  term: string;
  pronunciation?: string;
  ipa?: string;
  cefr?: CefrLevel | string;
  type: WordType;
  meaning_id: string;
  meaning_en?: string;
  examples: WordExample[];
  synonyms: string[];
  antonyms: string[];
  word_families: WordFamilyItem[];
  register: RegisterType;
}

export type SyncMode = "supabase" | "local";
