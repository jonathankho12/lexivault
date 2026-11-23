import { normalizeTermKey } from "@/lib/utils";
import type { CefrLevel } from "@/types/lexivault";

export interface BilingualMeaningInfo {
  meaning_en: string;
  meaning_id?: string;
  cefr?: CefrLevel;
}

const BILINGUAL_CACHE_KEY = "lexivault_bilingual_meanings_v1";

/**
 * Curated C1–C2 monolingual English learner's dictionary definitions for all
 * built-in seed vocabulary, discovery packs, offline dictionary entries, and
 * curated C1–C2 AI suggestion fallbacks.
 */
export const BUILT_IN_ENGLISH_MEANINGS: Record<string, BilingualMeaningInfo> = {
  gentrified: {
    meaning_en:
      "Transformed into a wealthier, more upscale district, often raising property prices and displacing lower-income long-term residents.",
    cefr: "C1",
  },
  ubiquitous: {
    meaning_en:
      "Present, appearing, or encountered everywhere at once; so widespread that it feels inseparable from daily life.",
    cefr: "C1",
  },
  pragmatic: {
    meaning_en:
      "Dealing with problems sensibly and realistically based on practical outcomes rather than abstract theories or idealism.",
    cefr: "C1",
  },
  ephemeral: {
    meaning_en:
      "Lasting for only a very brief period of time; fleeting and quickly fading away.",
    cefr: "C2",
  },
  mitigate: {
    meaning_en:
      "To make a risk, harmful impact, or painful situation less severe, serious, or damaging.",
    cefr: "C1",
  },
  nuanced: {
    meaning_en:
      "Characterized by subtle shades of meaning, detail, or perspective rather than simplistic black-and-white judgments.",
    cefr: "C1",
  },
  ambivalent: {
    meaning_en:
      "Having mixed, contradictory feelings or competing attitudes toward someone or something at the same time.",
    cefr: "C2",
  },
  resilient: {
    meaning_en:
      "Able to withstand pressure or recover swiftly from setbacks, adversity, or systemic shocks.",
    cefr: "C1",
  },
  "bite the bullet": {
    meaning_en:
      "To force yourself to face an unavoidable, difficult, or unpleasant task with quiet resolve.",
    cefr: "C1",
  },
  "burn the midnight oil": {
    meaning_en:
      "To work, study, or concentrate intensely late into the night in order to meet a demanding goal.",
    cefr: "C1",
  },
  "cut corners": {
    meaning_en:
      "To take shortcuts that sacrifice quality, thoroughness, or safety in order to save time or money.",
    cefr: "C1",
  },
  "play devil's advocate": {
    meaning_en:
      "To deliberately argue an opposing or unpopular position in order to test the strength of an idea and expose blind spots.",
    cefr: "C1",
  },
  "get out of hand": {
    meaning_en:
      "To escalate beyond control and become chaotic, unruly, or difficult to manage.",
    cefr: "C1",
  },
  "make a compelling case": {
    meaning_en:
      "To present a logical, well-evidenced argument that strongly convinces listeners or readers.",
    cefr: "C1",
  },
  "strike a balance": {
    meaning_en:
      "To reach a fair, sustainable middle ground between two competing priorities or extremes.",
    cefr: "C1",
  },
  "bear the brunt": {
    meaning_en:
      "To endure the heaviest impact, burden, or worst consequences of an adverse event or policy.",
    cefr: "C2",
  },
  "spark a debate": {
    meaning_en:
      "To trigger widespread public, professional, or academic discussion over a contested issue.",
    cefr: "C1",
  },
  "draw a parallel": {
    meaning_en:
      "To point out a meaningful similarity or structural analogy between two otherwise distinct situations.",
    cefr: "C1",
  },
  magnanimous: {
    meaning_en:
      "Generous and noble in spirit, especially when forgiving a rival or showing grace after victory or defeat.",
    cefr: "C2",
  },
  ameliorate: {
    meaning_en:
      "To improve or make an unsatisfactory, harsh, or troubling condition noticeably better.",
    cefr: "C2",
  },
  clandestine: {
    meaning_en:
      "Kept strictly secret or carried out covertly, typically because the activity is sensitive or illicit.",
    cefr: "C2",
  },
  "weather the storm": {
    meaning_en:
      "To endure a severe crisis or turbulent period and emerge intact once conditions stabilize.",
    cefr: "C1",
  },
  "read between the lines": {
    meaning_en:
      "To infer an implied or hidden message that is not stated explicitly in words.",
    cefr: "C1",
  },
  "foster innovation": {
    meaning_en:
      "To actively nurture an environment where fresh ideas, experimentation, and creative breakthroughs thrive.",
    cefr: "C1",
  },
  "wield influence": {
    meaning_en:
      "To hold and exercise substantial power over decisions, public opinion, or institutional direction.",
    cefr: "C2",
  },
  disparate: {
    meaning_en:
      "Fundamentally different in kind or origin, making direct comparison or unification difficult.",
    cefr: "C2",
  },
  ostensible: {
    meaning_en:
      "Stated or appearing to be true on the surface, though not necessarily reflecting the real underlying motive.",
    cefr: "C2",
  },
  tenacious: {
    meaning_en:
      "Persistent, determined, and unwilling to give up or loosen one's grip despite repeated obstacles.",
    cefr: "C1",
  },
  "ballpark figure": {
    meaning_en:
      "A rough numerical estimate or approximate range used before exact calculations are available.",
    cefr: "C1",
  },
  "touch base": {
    meaning_en:
      "To briefly reconnect with someone in order to share updates, align priorities, or check progress.",
    cefr: "C1",
  },
  "bridge the gap": {
    meaning_en:
      "To reduce or close a significant divide between two groups, skill levels, or opposing viewpoints.",
    cefr: "C1",
  },
  "reap the rewards": {
    meaning_en:
      "To enjoy the positive outcomes and tangible benefits earned through earlier discipline or investment.",
    cefr: "C1",
  },
  sagacious: {
    meaning_en:
      "Showing keen judgment, foresight, and deep practical wisdom when navigating complex decisions.",
    cefr: "C2",
  },
  corroborate: {
    meaning_en:
      "To confirm or strengthen the validity of a claim, testimony, or finding with independent evidence.",
    cefr: "C2",
  },
  candid: {
    meaning_en:
      "Truthful, direct, and unguarded, expressing honest thoughts without sugarcoating or evasion.",
    cefr: "C1",
  },
  "in the long run": {
    meaning_en:
      "Over an extended period of time; ultimately, once short-term effects have played out.",
    cefr: "C1",
  },
  "on the same page": {
    meaning_en:
      "Sharing the exact same understanding, expectations, or agreement before taking joint action.",
    cefr: "C1",
  },
  "set a precedent": {
    meaning_en:
      "To establish an initial decision, example, or standard that guides similar future cases.",
    cefr: "C1",
  },
  "shed light on": {
    meaning_en:
      "To clarify or reveal new information that makes a puzzling or obscure matter easier to understand.",
    cefr: "C1",
  },
  serendipity: {
    meaning_en:
      "The fortunate occurrence of discovering something valuable or delightful purely by chance.",
    cefr: "C2",
  },
  alleviate: {
    meaning_en:
      "To relieve or ease pain, stress, or hardship without necessarily eliminating its root cause.",
    cefr: "C1",
  },
  "break the ice": {
    meaning_en:
      "To ease initial awkwardness or social tension and start natural conversation among unfamiliar people.",
    cefr: "C1",
  },
  "take for granted": {
    meaning_en:
      "To fail to appreciate something valuable because you assume it will always remain available.",
    cefr: "C1",
  },
  "cognitive dissonance": {
    meaning_en:
      "The psychological discomfort experienced when holding conflicting beliefs or acting against one's stated values.",
    cefr: "C2",
  },
  lucrative: {
    meaning_en:
      "Producing substantial financial profit or commercial reward.",
    cefr: "C1",
  },
  "under the weather": {
    meaning_en:
      "Feeling mildly unwell, fatigued, or slightly sick.",
    cefr: "C1",
  },
  eloquent: {
    meaning_en:
      "Fluent, expressive, and persuasive in speaking or writing, able to articulate complex ideas gracefully.",
    cefr: "C1",
  },
  procrastinate: {
    meaning_en:
      "To habitually delay or postpone important tasks despite knowing the delay may cause harm.",
    cefr: "C1",
  },
  facade: {
    meaning_en:
      "The front exterior of a building, or a deceptive outward appearance maintained to conceal true feelings or flaws.",
    cefr: "C2",
  },
  discrepancy: {
    meaning_en:
      "An unexpected mismatch or unexplained difference between two figures, records, or accounts that should agree.",
    cefr: "C1",
  },
  "hit the nail on the head": {
    meaning_en:
      "To identify the exact core of a problem or describe a situation with pinpoint accuracy.",
    cefr: "C1",
  },
  "pose a threat": {
    meaning_en:
      "To represent a serious potential danger or risk to safety, stability, or success.",
    cefr: "C1",
  },
  "yield results": {
    meaning_en:
      "To produce tangible outcomes or measurable success after sustained effort or experimentation.",
    cefr: "C1",
  },
  "snowed under": {
    meaning_en:
      "Completely overwhelmed by an excessive workload, backlog, or flood of obligations.",
    cefr: "C1",
  },
  "on thin ice": {
    meaning_en:
      "In a precarious or risky position where even one small misstep could trigger serious consequences.",
    cefr: "C1",
  },
  // Curated C1–C2 AI Suggest pool
  "at a crossroads": {
    meaning_en:
      "At a decisive turning point where a crucial choice must be made between two very different paths.",
    cefr: "C1",
  },
  "throw caution to the wind": {
    meaning_en:
      "To abandon careful restraint and act boldly or recklessly despite clear risks.",
    cefr: "C2",
  },
  "bark up the wrong tree": {
    meaning_en:
      "To pursue a mistaken course of action or blame the wrong cause when trying to solve a problem.",
    cefr: "C1",
  },
  "turn a blind eye": {
    meaning_en:
      "To deliberately ignore misconduct, warning signs, or unpleasant facts you are fully aware of.",
    cefr: "C1",
  },
  "cut to the chase": {
    meaning_en:
      "To skip unnecessary preamble and address the most important point directly.",
    cefr: "C1",
  },
  "a double-edged sword": {
    meaning_en:
      "Something that brings significant advantages while simultaneously carrying serious drawbacks or risks.",
    cefr: "C1",
  },
  "pass the buck": {
    meaning_en:
      "To evade accountability by shifting blame or responsibility onto someone else.",
    cefr: "C2",
  },
  "up in the air": {
    meaning_en:
      "Still undecided, unresolved, or uncertain because key conditions have not yet settled.",
    cefr: "C1",
  },
  perspicacious: {
    meaning_en:
      "Having a remarkably sharp insight and swift understanding of subtle or complex matters.",
    cefr: "C2",
  },
  quintessential: {
    meaning_en:
      "Representing the purest, most iconic, or textbook example of a particular quality or class.",
    cefr: "C2",
  },
  fastidious: {
    meaning_en:
      "Very attentive to accuracy and tiny details; difficult to satisfy unless standards are spotless.",
    cefr: "C2",
  },
  intransigent: {
    meaning_en:
      "Stubbornly unwilling to compromise, negotiate, or alter an entrenched viewpoint.",
    cefr: "C2",
  },
  exacerbate: {
    meaning_en:
      "To make an existing problem, tension, or negative condition noticeably worse.",
    cefr: "C1",
  },
  "warrant scrutiny": {
    meaning_en:
      "To justify careful, critical inspection because of notable stakes, anomalies, or claims.",
    cefr: "C2",
  },
  "galvanize support": {
    meaning_en:
      "To energize and rally people into decisive collective backing or urgent action.",
    cefr: "C2",
  },
  "yield dividends": {
    meaning_en:
      "To pay off handsomely over time, producing lasting strategic or personal gains.",
    cefr: "C1",
  },
};

function readBilingualCache(): Record<string, BilingualMeaningInfo> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(BILINGUAL_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, BilingualMeaningInfo>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function cacheWordMeanings(
  term: string,
  meaningEn?: string | null,
  meaningId?: string | null,
  cefr?: CefrLevel | string | null
): void {
  if (typeof window === "undefined") return;
  const cleanEn = meaningEn?.trim();
  const cleanId = meaningId?.trim();
  if (!cleanEn && !cleanId) return;

  const key = normalizeTermKey(term);
  if (!key) return;

  try {
    const cache = readBilingualCache();
    const existing = cache[key];
    cache[key] = {
      meaning_en: cleanEn || existing?.meaning_en || "",
      meaning_id: cleanId || existing?.meaning_id,
      cefr:
        (cefr === "B2" || cefr === "C1" || cefr === "C2" ? cefr : undefined) ||
        existing?.cefr,
    };
    window.localStorage.setItem(BILINGUAL_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore quota errors
  }
}

export function resolveWordMeanings(
  term: string,
  explicitMeaningId?: string | null,
  explicitMeaningEn?: string | null,
  explicitCefr?: string | null
): {
  meaning_id: string;
  meaning_en?: string;
  cefr?: CefrLevel | string;
} {
  const key = normalizeTermKey(term);
  const builtIn = BUILT_IN_ENGLISH_MEANINGS[key];
  const cached =
    typeof window !== "undefined" ? readBilingualCache()[key] : undefined;

  const meaning_en =
    explicitMeaningEn?.trim() ||
    cached?.meaning_en?.trim() ||
    builtIn?.meaning_en ||
    undefined;

  const meaning_id =
    explicitMeaningId?.trim() ||
    cached?.meaning_id?.trim() ||
    meaning_en ||
    "";

  const cefr =
    explicitCefr?.trim() || cached?.cefr || builtIn?.cefr || undefined;

  return { meaning_id, meaning_en, cefr };
}
