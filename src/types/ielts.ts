export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type IeltsSkill =
  | "placement"
  | "reading"
  | "listening"
  | "writing"
  | "speaking";

export type IeltsSubTab = "reading" | "listening" | "writing" | "speaking";

export type IeltsVoiceAccent = "GB_M" | "GB_F" | "AU_F" | "AU_M" | "US_M";

export interface IeltsProfile {
  user_id: string;
  cefr_level: CefrLevel;
  estimated_band: number;
  reading_band: number | null;
  listening_band: number | null;
  writing_band: number | null;
  speaking_band: number | null;
  xp?: number;
  mastery_rank?: string;
  placement_completed: boolean;
  updated_at: string;
}

export interface IeltsAttempt {
  id: string;
  user_id: string;
  skill: IeltsSkill;
  band_score: number;
  details_json: Record<string, unknown>;
  created_at: string;
}

export type PlacementQuestionCategory =
  | "vocab_grammar"
  | "reading"
  | "listening"
  | "writing_paraphrase";

export interface PlacementQuestion {
  id: string;
  category: PlacementQuestionCategory;
  cefrTarget: CefrLevel;
  prompt: string;
  passage?: string;
  audioSegments?: ListeningDialogueSegment[];
  options?: string[];
  correctAnswer: string;
  originalSentence?: string;
  keywords?: string[];
  explanation_id: string;
}

export type AdaptivePlacementStage = "grammar" | "vocab" | "reading" | "writing";

export interface AdaptivePlacementMcq {
  id: string;
  stage: "grammar" | "vocab";
  cefr: CefrLevel;
  prompt: string;
  options: [string, string, string, string];
  correctAnswer: string;
  skillTagEn: string;
  skillTagId: string;
}

export interface AdaptiveReadingQuestion {
  id: string;
  kind: "literal" | "inference";
  prompt: string;
  options: [string, string, string, string];
  correctAnswer: string;
  skillTagEn: string;
  skillTagId: string;
}

export interface AdaptiveReadingPassage {
  id: string;
  cefr: CefrLevel;
  title: string;
  passage: string;
  questions: [AdaptiveReadingQuestion, AdaptiveReadingQuestion];
}

export interface PlacementWritingGradeResult {
  cefr: CefrLevel;
  band: number;
  grammar_accuracy: number;
  sentence_control: number;
  lexical_range: number;
  has_basic_a1_a2_errors: boolean;
  weaknesses_en: string[];
  weaknesses_id: string[];
  weaknesses_ru?: string[];
  summary_en: string;
  summary_id: string;
  summary_ru?: string;
  modelUsed: string;
}

export interface PlacementDiagnosticSummary {
  cefr: CefrLevel;
  estimatedBand: number;
  subScores: {
    grammar: number;
    vocabulary: number;
    reading: number;
    writing: number;
  };
  weaknessesEn: string[];
  weaknessesId: string[];
  weaknessesRu?: string[];
  capReasonEn: string | null;
  capReasonId: string | null;
  capReasonRu?: string | null;
  writingSummaryEn: string;
  writingSummaryId: string;
  writingSummaryRu?: string;
}

export interface IeltsVocabItem {
  term: string;
  note?: string;
  cefr?: CefrLevel;
  category?: "vocab" | "idiom" | "collocation";
}

export type ReadingQuestionType =
  | "tfng"
  | "mcq"
  | "fill_blank"
  | "matching_headings";

export interface ReadingQuestion {
  id: string;
  type: ReadingQuestionType;
  prompt: string;
  options?: string[];
  answer: string;
  acceptedAnswers?: string[];
  wordLimit?: string;
  paragraphRef?: string;
  explanation_id: string;
  explanation_en?: string;
  explanation_ru?: string;
  evidence_quote: string;
}

export interface ReadingPassagePack {
  id: string;
  title: string;
  topic: string;
  cefrLevel?: CefrLevel;
  recommendedMinutes: number;
  paragraphs: string[];
  questions: ReadingQuestion[];
  keyVocabulary?: IeltsVocabItem[];
}

export interface ListeningDialogueSegment {
  speaker: string;
  accent: IeltsVoiceAccent;
  text: string;
}

export type ListeningQuestionType = "mcq" | "form_completion";

export interface ListeningQuestion {
  id: string;
  type: ListeningQuestionType;
  prompt: string;
  options?: string[];
  answer: string;
  acceptedAnswers?: string[];
  wordLimit?: string;
  explanation_id: string;
  explanation_en?: string;
  explanation_ru?: string;
}

export interface ListeningSectionPack {
  id: string;
  sectionLabel: string;
  sectionType?: "section1" | "section3" | "section4";
  cefrLevel?: CefrLevel;
  title: string;
  context: string;
  accentsLabel: string;
  segments: ListeningDialogueSegment[];
  questions: ListeningQuestion[];
  keyVocabulary?: IeltsVocabItem[];
}

export interface WritingChartRow {
  label: string;
  values: number[];
}

export interface WritingChartData {
  title: string;
  unit: string;
  columns: string[];
  rows: WritingChartRow[];
}

export interface WritingTaskPack {
  id: string;
  taskType: "task1" | "task2";
  cefrLevel?: CefrLevel;
  title: string;
  prompt: string;
  minWords: number;
  recommendedMinutes: number;
  chartData?: WritingChartData;
  outlineTips: string[];
  fallbackBand85Sample: string;
}

export interface SentenceUpgradeItem {
  original: string;
  improved: string;
  reason_id: string;
}

export interface WritingInlineError {
  original: string;
  corrected: string;
  reason: string;
}

export interface WritingGradeResult {
  overall_band: number;
  criteria: {
    task_response: number;
    coherence_cohesion: number;
    lexical_resource: number;
    grammatical_range: number;
  };
  criteria_feedback?: {
    task_response: string;
    coherence_cohesion: string;
    lexical_resource: string;
    grammatical_range: string;
  };
  summary_id: string;
  inline_errors?: WritingInlineError[];
  sentence_upgrades: SentenceUpgradeItem[];
  plus_one_band_rewrite?: string;
  target_upgrade_band?: number;
  upgraded_vocabulary?: IeltsVocabItem[];
  band_85_sample: string;
  modelUsed: string;
}

export type SpeakingPart = "part1" | "part2" | "part3";

export interface SpeakingPromptPack {
  id: string;
  part: SpeakingPart;
  cefrLevel?: CefrLevel;
  topic: string;
  question: string;
  cueBullets?: string[];
  followUpQuestions?: string[];
  prepSeconds: number;
  speakSeconds: number;
  targetPhrases: string[];
  fallbackBand85Sample: string;
}

export interface SpeakingPhraseUpgrade {
  awkward: string;
  natural: string;
  reason_id: string;
}

export interface SpeakingGradeResult {
  overall_band: number;
  criteria: {
    fluency_coherence: number;
    lexical_resource: number;
    grammatical_range: number;
  };
  criteria_feedback?: {
    fluency_coherence: string;
    lexical_resource: string;
    grammatical_range: string;
  };
  summary_id: string;
  phrase_upgrades: SpeakingPhraseUpgrade[];
  upgraded_vocabulary?: IeltsVocabItem[];
  band_85_sample: string;
  modelUsed: string;
}

export interface CommuteListeningClip {
  id: string;
  title: string;
  accentsLabel: string;
  segments: ListeningDialogueSegment[];
  questions: Array<{
    id: string;
    prompt: string;
    options: string[];
    answer: string;
  }>;
}
