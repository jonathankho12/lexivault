export type WordType = "vocab" | "idiom" | "collocation";

export type RegisterType = "Formal" | "Academic" | "Casual" | "Slang";

export type AccentType = "US" | "UK";

export type TabId =
  | "vault"
  | "flashcards"
  | "practice"
  | "grammar"
  | "ielts"
  | "discover"
  | "stats";

export type SourceTag =
  | "film"
  | "book"
  | "lecture"
  | "article"
  | "general"
  | "daily_pack";

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type DailyPackTargetTier =
  | "A1-A2"
  | "A2-B1"
  | "B1-B2"
  | "B2-C1"
  | "C1-C2";

export type DailyPackLevelSetting = "auto" | DailyPackTargetTier;

export type SuggestCategory = "mix" | "idiom" | "vocab" | "collocation";

export type SuggestRegister = "any" | "Academic" | "Formal" | "Casual";

export interface CaptureToastState {
  message: string;
  type: "success" | "error" | "info" | "duplicate";
  matchedWord?: WordEntry;
}

export interface DailyQuotaSettings {
  wordsPerDay: number;
  idiomsPerDay: number;
  autoShowPopup: boolean;
  targetLevel: DailyPackLevelSetting;
}

export interface DailyPackItem {
  id: string;
  term: string;
  pronunciation?: string;
  ipa?: string;
  cefr: CefrLevel;
  type: "vocab" | "idiom";
  meaning_en: string;
  meaning_id: string;
  meaning_ru?: string;
  examples: WordExample[];
  synonyms: string[];
  antonyms: string[];
  word_families: WordFamilyItem[];
  chunks?: string[];
  register: RegisterType;
  source_tag: "daily_pack";
}

export interface DailyPackRecord {
  pack_date: string; // YYYY-MM-DD in local timezone
  words_quota: number;
  idioms_quota: number;
  target_tier?: DailyPackTargetTier;
  items: DailyPackItem[];
  completed_terms: string[]; // normalized term keys completed via recall quiz
  completed_at?: string | null;
  source?: "gemini" | "fallback" | "supabase" | "local";
}

export type CloudSyncStatus = "synced" | "syncing" | "local" | "error";

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
  translation_ru?: string;
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
  meaning_ru?: string;
  examples_json: WordExample[];
  synonyms: string[];
  antonyms: string[];
  word_families_json: WordFamilyItem[];
  chunks?: string[];
  register: RegisterType;
  source_tag: string;
  audio_us_url?: string | null;
  audio_uk_url?: string | null;
  correct_count: number;
  wrong_count: number;
  last_practiced_at?: string | null;
  last_reviewed_date?: string | null;
  review_count?: number;
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
  meaning_ru?: string;
  examples_json: WordExample[];
  synonyms: string[];
  antonyms: string[];
  word_families_json: WordFamilyItem[];
  chunks?: string[];
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
  meaning_ru?: string;
  examples: WordExample[];
  synonyms: string[];
  antonyms: string[];
  word_families: WordFamilyItem[];
  chunks?: string[];
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
  meaning_ru?: string;
  examples: WordExample[];
  synonyms: string[];
  antonyms: string[];
  word_families: WordFamilyItem[];
  chunks?: string[];
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
  | "No Valid Attempt"
  | "Естественно"
  | "Хорошо"
  | "Нужно доработать"
  | "Нет попытки";

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
  meaning_ru?: string;
  examples: WordExample[];
  synonyms: string[];
  antonyms: string[];
  word_families: WordFamilyItem[];
  chunks?: string[];
  register: RegisterType;
}

export type SyncMode = "supabase" | "local";

export type GrammarCheckContext = "auto" | "casual" | "academic" | "work";

export type GrammarCheckVerdict =
  | "correct"
  | "fragment"
  | "unnatural"
  | "incorrect";

export interface GrammarCheckIssue {
  original: string;
  correction: string;
  reason: string;
}

export interface GrammarCheckAlternative {
  context: string;
  example: string;
  note: string;
}

export interface GrammarCheckResult {
  verdict: GrammarCheckVerdict;
  verdictLabel: string;
  correctedText: string;
  explanation: string;
  issues: GrammarCheckIssue[];
  alternatives: GrammarCheckAlternative[];
}
