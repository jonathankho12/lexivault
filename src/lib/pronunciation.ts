import { normalizeTermKey } from "@/lib/utils";

export interface PronunciationInfo {
  pronunciation: string;
  ipa?: string;
}

const PRONUNCIATION_CACHE_KEY = "lexivault_pron_cache_v1";

/**
 * Curated Google-style phonetic respellings ("Sounds like") & IPA for all built-in
 * seed vocabulary, daily discovery packs, and offline fallback dictionary entries.
 * Uppercase syllables indicate primary stress (rendered bold like Google Dictionary).
 */
export const BUILT_IN_PRONUNCIATIONS: Record<string, PronunciationInfo> = {
  gentrified: {
    pronunciation: "JEN·truh·fyd",
    ipa: "/ˈdʒen.trɪ.faɪd/",
  },
  ubiquitous: {
    pronunciation: "yoo·BIK·wih·tuhs",
    ipa: "/juːˈbɪk.wɪ.təs/",
  },
  pragmatic: {
    pronunciation: "prag·MAT·ik",
    ipa: "/præɡˈmæt.ɪk/",
  },
  ephemeral: {
    pronunciation: "ih·FEM·er·uhl",
    ipa: "/ɪˈfem.ər.əl/",
  },
  mitigate: {
    pronunciation: "MIT·ih·gayt",
    ipa: "/ˈmɪt.ɪ.ɡeɪt/",
  },
  nuanced: {
    pronunciation: "NOO·ahnst",
    ipa: "/ˈnjuː.ɑːnst/",
  },
  ambivalent: {
    pronunciation: "am·BIV·uh·luhnt",
    ipa: "/æmˈbɪv.ə.lənt/",
  },
  resilient: {
    pronunciation: "rih·ZIL·yuhnt",
    ipa: "/rɪˈzɪl.jənt/",
  },
  "bite the bullet": {
    pronunciation: "byt thuh BOOL·it",
    ipa: "/baɪt ðə ˈbʊl.ɪt/",
  },
  "burn the midnight oil": {
    pronunciation: "burn thuh MID·nyt oyl",
    ipa: "/bɜːrn ðə ˈmɪd.naɪt ɔɪl/",
  },
  "cut corners": {
    pronunciation: "kuht KOR·nerz",
    ipa: "/kʌt ˈkɔːr.nərz/",
  },
  "play devil's advocate": {
    pronunciation: "play DEV·uhlz AD·vuh·kuht",
    ipa: "/pleɪ ˈdev.əlz ˈæd.və.kət/",
  },
  "get out of hand": {
    pronunciation: "get owt uhv HAND",
    ipa: "/ɡet aʊt əv hænd/",
  },
  "make a compelling case": {
    pronunciation: "mayk uh kuhm·PEL·ing kays",
    ipa: "/meɪk ə kəmˈpel.ɪŋ keɪs/",
  },
  "strike a balance": {
    pronunciation: "stryk uh BAL·uhns",
    ipa: "/straɪk ə ˈbæl.əns/",
  },
  "bear the brunt": {
    pronunciation: "bair thuh BRUHNT",
    ipa: "/beər ðə brʌnt/",
  },
  "spark a debate": {
    pronunciation: "spark uh dih·BAYT",
    ipa: "/spɑːrk ə dɪˈbeɪt/",
  },
  "draw a parallel": {
    pronunciation: "draw uh PAIR·uh·lel",
    ipa: "/drɔː ə ˈpær.ə.lel/",
  },
  magnanimous: {
    pronunciation: "mag·NAN·uh·muhs",
    ipa: "/mæɡˈnæn.ə.məs/",
  },
  ameliorate: {
    pronunciation: "uh·MEEL·yuh·rayt",
    ipa: "/əˈmiː.li.ə.reɪt/",
  },
  clandestine: {
    pronunciation: "klan·DES·tin",
    ipa: "/klænˈdes.tɪn/",
  },
  "weather the storm": {
    pronunciation: "WETH·er thuh storm",
    ipa: "/ˈweð.ər ðə stɔːrm/",
  },
  "read between the lines": {
    pronunciation: "reed bih·TWEEN thuh lynz",
    ipa: "/riːd bɪˈtwiːn ðə laɪnz/",
  },
  "foster innovation": {
    pronunciation: "FOS·ter in·uh·VAY·shuhn",
    ipa: "/ˈfɒs.tər ˌɪn.əˈveɪ.ʃən/",
  },
  "wield influence": {
    pronunciation: "weeld IN·floo·uhns",
    ipa: "/wiːld ˈɪn.flu.əns/",
  },
  disparate: {
    pronunciation: "DIS·per·uht",
    ipa: "/ˈdɪs.pər.ət/",
  },
  ostensible: {
    pronunciation: "ah·STEN·suh·buhl",
    ipa: "/ɒˈsten.sə.bəl/",
  },
  tenacious: {
    pronunciation: "tuh·NAY·shuhs",
    ipa: "/təˈneɪ.ʃəs/",
  },
  "ballpark figure": {
    pronunciation: "BAWL·park FIG·yer",
    ipa: "/ˈbɔːl.pɑːrk ˈfɪɡ.jər/",
  },
  "touch base": {
    pronunciation: "tuhch BAYS",
    ipa: "/tʌtʃ beɪs/",
  },
  "bridge the gap": {
    pronunciation: "brij thuh GAP",
    ipa: "/brɪdʒ ðə ɡæp/",
  },
  "reap the rewards": {
    pronunciation: "reep thuh rih·WORDZ",
    ipa: "/riːp ðə rɪˈwɔːrdz/",
  },
  sagacious: {
    pronunciation: "suh·GAY·shuhs",
    ipa: "/səˈɡeɪ.ʃəs/",
  },
  corroborate: {
    pronunciation: "kuh·ROB·uh·rayt",
    ipa: "/kəˈrɒb.ə.reɪt/",
  },
  candid: {
    pronunciation: "KAN·did",
    ipa: "/ˈkæn.dɪd/",
  },
  "in the long run": {
    pronunciation: "in thuh LAWNG ruhn",
    ipa: "/ɪn ðə lɒŋ rʌn/",
  },
  "on the same page": {
    pronunciation: "on thuh saym PAYJ",
    ipa: "/ɒn ðə seɪm peɪdʒ/",
  },
  "set a precedent": {
    pronunciation: "set uh PRES·ih·duhnt",
    ipa: "/set ə ˈpres.ɪ.dənt/",
  },
  "shed light on": {
    pronunciation: "shed LYT on",
    ipa: "/ʃed laɪt ɒn/",
  },
  serendipity: {
    pronunciation: "sair·uhn·DIP·ih·tee",
    ipa: "/ˌser.ənˈdɪp.ə.ti/",
  },
  alleviate: {
    pronunciation: "uh·LEE·vee·ayt",
    ipa: "/əˈliː.vi.eɪt/",
  },
  "break the ice": {
    pronunciation: "brayk thee EYS",
    ipa: "/breɪk ði aɪs/",
  },
  "take for granted": {
    pronunciation: "tayk for GRAN·tid",
    ipa: "/teɪk fɔːr ˈɡræn.tɪd/",
  },
  "cognitive dissonance": {
    pronunciation: "KOG·nih·tiv DIS·uh·nuhns",
    ipa: "/ˈkɒɡ.nə.tɪv ˈdɪs.ə.nəns/",
  },
  lucrative: {
    pronunciation: "LOO·kruh·tiv",
    ipa: "/ˈluː.krə.tɪv/",
  },
  "under the weather": {
    pronunciation: "UHN·der thuh WETH·er",
    ipa: "/ˈʌn.dər ðə ˈweð.ər/",
  },
  eloquent: {
    pronunciation: "EL·uh·kwuhnt",
    ipa: "/ˈel.ə.kwənt/",
  },
  procrastinate: {
    pronunciation: "proh·KRAS·tuh·nayt",
    ipa: "/prəˈkræs.tɪ.neɪt/",
  },
  facade: {
    pronunciation: "fuh·SAHD",
    ipa: "/fəˈsɑːd/",
  },
  discrepancy: {
    pronunciation: "dih·SKREP·uhn·see",
    ipa: "/dɪˈskrep.ən.si/",
  },
  "hit the nail on the head": {
    pronunciation: "hit thuh NAYL on thuh hed",
    ipa: "/hɪt ðə neɪl ɒn ðə hed/",
  },
  "pose a threat": {
    pronunciation: "pohz uh THRET",
    ipa: "/pəʊz ə θret/",
  },
  "yield results": {
    pronunciation: "yeeld rih·ZUHLTS",
    ipa: "/jiːld rɪˈzʌlts/",
  },
  "snowed under": {
    pronunciation: "snohd UHN·der",
    ipa: "/snəʊd ˈʌn.dər/",
  },
  "on thin ice": {
    pronunciation: "on thin EYS",
    ipa: "/ɒn θɪn aɪs/",
  },
};

function readPronunciationCache(): Record<string, PronunciationInfo> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PRONUNCIATION_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PronunciationInfo>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function cacheWordPronunciation(
  term: string,
  pronunciation?: string | null,
  ipa?: string | null
): void {
  if (typeof window === "undefined") return;
  const cleanPron = pronunciation?.trim();
  const cleanIpa = ipa?.trim();
  if (!cleanPron && !cleanIpa) return;

  const key = normalizeTermKey(term);
  if (!key) return;

  try {
    const cache = readPronunciationCache();
    cache[key] = {
      pronunciation: cleanPron || cache[key]?.pronunciation || "",
      ipa: cleanIpa || cache[key]?.ipa,
    };
    window.localStorage.setItem(PRONUNCIATION_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Resolves written pronunciation ("Sounds like") & optional IPA safely for both
 * newly generated AI entries and legacy words stored without pronunciation fields.
 */
export function resolveWordPronunciation(
  term: string,
  explicitPronunciation?: string | null,
  explicitIpa?: string | null
): { pronunciation: string | null; ipa: string | null } {
  const key = normalizeTermKey(term);
  const builtIn = BUILT_IN_PRONUNCIATIONS[key];
  const cached =
    typeof window !== "undefined" ? readPronunciationCache()[key] : undefined;

  const pronunciation =
    explicitPronunciation?.trim() ||
    cached?.pronunciation?.trim() ||
    builtIn?.pronunciation ||
    null;

  const ipa =
    explicitIpa?.trim() ||
    cached?.ipa?.trim() ||
    builtIn?.ipa ||
    null;

  return { pronunciation, ipa };
}

export interface PronunciationToken {
  text: string;
  stressed: boolean;
  isDot: boolean;
  isSpace: boolean;
}

/**
 * Splits Google-style phonetic respellings such as "am·BIV·uh·luhnt" or
 * "bair thuh BRUHNT" into styled syllable tokens where ALL-CAPS syllables are stressed.
 */
export function tokenizePronunciation(respelling: string): PronunciationToken[] {
  const normalized = respelling
    .trim()
    .replace(/\s*[·•]\s*/g, "·");

  const tokens: PronunciationToken[] = [];
  const parts = normalized.split(/(·|\s+)/);

  for (const part of parts) {
    if (!part) continue;
    if (part === "·") {
      tokens.push({ text: " · ", stressed: false, isDot: true, isSpace: false });
      continue;
    }
    if (/^\s+$/.test(part)) {
      tokens.push({ text: " ", stressed: false, isDot: false, isSpace: true });
      continue;
    }

    const letters = part.replace(/[^a-zA-Z]/g, "");
    const stressed =
      letters.length > 0 &&
      letters === letters.toUpperCase() &&
      letters !== letters.toLowerCase();

    tokens.push({
      text: stressed ? part.toLowerCase() : part,
      stressed,
      isDot: false,
      isSpace: false,
    });
  }

  return tokens;
}
