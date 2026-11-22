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

export type ReadingQuestionType = "tfng" | "mcq" | "fill_blank";

export interface ReadingQuestion {
  id: string;
  type: ReadingQuestionType;
  prompt: string;
  options?: string[];
  answer: string;
  acceptedAnswers?: string[];
  explanation_id: string;
  evidence_quote: string;
}

export interface ReadingPassagePack {
  id: string;
  title: string;
  topic: string;
  recommendedMinutes: number;
  paragraphs: string[];
  questions: ReadingQuestion[];
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
  explanation_id: string;
}

export interface ListeningSectionPack {
  id: string;
  sectionLabel: string;
  title: string;
  context: string;
  accentsLabel: string;
  segments: ListeningDialogueSegment[];
  questions: ListeningQuestion[];
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

export interface WritingGradeResult {
  overall_band: number;
  criteria: {
    task_response: number;
    coherence_cohesion: number;
    lexical_resource: number;
    grammatical_range: number;
  };
  summary_id: string;
  sentence_upgrades: SentenceUpgradeItem[];
  band_85_sample: string;
  modelUsed: string;
}

export type SpeakingPart = "part1" | "part2" | "part3";

export interface SpeakingPromptPack {
  id: string;
  part: SpeakingPart;
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
  summary_id: string;
  phrase_upgrades: SpeakingPhraseUpgrade[];
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
