import { BUILT_IN_ENGLISH_MEANINGS } from "@/lib/bilingualCache";
import { BUILT_IN_PRONUNCIATIONS } from "@/lib/pronunciation";
import { normalizeTermKey, shiftDateString } from "@/lib/utils";
import type {
  AutofillPayload,
  DiscoveryItem,
  SuggestedWordItem,
  WordEntry,
} from "@/types/lexivault";

function attachMetadata<
  T extends {
    term: string;
    pronunciation?: string;
    ipa?: string;
    meaning_en?: string;
    cefr?: string;
  },
>(item: T): T {
  const key = normalizeTermKey(item.term);
  const pron = BUILT_IN_PRONUNCIATIONS[key];
  const bilingual = BUILT_IN_ENGLISH_MEANINGS[key];
  return {
    ...item,
    pronunciation: item.pronunciation || pron?.pronunciation,
    ipa: item.ipa || pron?.ipa,
    meaning_en: item.meaning_en || bilingual?.meaning_en,
    cefr: item.cefr || bilingual?.cefr,
  };
}

/**
 * Minimal, uncluttered starter vault for new registrations and Guest Mode:
 * 5 high-value C1–C2 expressions (3 idioms + 2 academic/formal words) with full
 * bilingual definitions, pronunciation, examples, word families, and canonical source tags.
 */
export function buildInitialMockWords(todayStr: string): WordEntry[] {
  const ts = (daysAgo: number, hour = 14) => {
    const dateStr = shiftDateString(todayStr, -daysAgo);
    return `${dateStr}T${String(hour).padStart(2, "0")}:20:00.000Z`;
  };

  const baseWords: WordEntry[] = [
    {
      id: "mock-word-01",
      term: "bear the brunt",
      cefr: "C2",
      type: "idiom",
      meaning_en:
        "To endure the heaviest impact, burden, or worst consequences of an adverse event or policy.",
      meaning_id:
        "Menanggung dampak terberat atau konsekuensi paling parah dari suatu masalah atau peristiwa.",
      examples_json: [
        {
          sentence:
            "Small island nations **bear the brunt** of rising sea levels despite minimal carbon emissions.",
          translation_id:
            "Negara-negara pulau kecil **menanggung dampak paling parah** kenaikan permukaan laut meski emisi karbonnya minim.",
          context: "Academic",
        },
        {
          sentence:
            "Customer support teams always **bear the brunt** of user frustration during a major outage.",
          translation_id:
            "Tim layanan pelanggan selalu **menanggung imbas terberat** dari rasa frustrasi pengguna saat gangguan besar.",
          context: "Daily",
        },
      ],
      synonyms: ["shoulder the burden", "take the hardest hit", "absorb the shock"],
      antonyms: ["escape unscathed", "be shielded from"],
      word_families_json: [
        { word: "bear the brunt", pos: "idiom" },
        { word: "brunt", pos: "n" },
      ],
      chunks: [
        "bear the brunt of the criticism",
        "often bear the brunt of...",
        "bore the brunt of the economic downturn",
      ],
      register: "Formal",
      source_tag: "article",
      correct_count: 0,
      wrong_count: 0,
      last_practiced_at: null,
      created_at: ts(0, 10),
    },
    {
      id: "mock-word-02",
      term: "play devil's advocate",
      cefr: "C1",
      type: "idiom",
      meaning_en:
        "To deliberately argue an opposing or unpopular position in order to test the strength of an idea and expose blind spots.",
      meaning_id:
        "Sengaja mengambil posisi berlawanan dalam diskusi untuk menguji kekuatan argumen atau ide orang lain.",
      examples_json: [
        {
          sentence:
            "Let me **play devil's advocate** for a minute—what happens if user growth stalls next quarter?",
          translation_id:
            "Izinkan saya **berperan sebagai penantang argumen** sebentar—bagaimana jika pertumbuhan pengguna melambat kuartal depan?",
          context: "Daily",
        },
        {
          sentence:
            "Having one team member **play devil's advocate** prevents costly groupthink in strategy meetings.",
          translation_id:
            "Menunjuk satu anggota tim untuk **menguji ide secara kritis dari sisi berlawanan** mencegah pemikiran seragam yang merugikan.",
          context: "Academic",
        },
      ],
      synonyms: ["challenge assumptions", "argue the counterpoint", "stress-test"],
      antonyms: ["rubber-stamp", "echo", "go along with"],
      word_families_json: [
        { word: "play devil's advocate", pos: "idiom" },
        { word: "devil's advocacy", pos: "n" },
      ],
      chunks: [
        "Let me play devil's advocate for a moment",
        "just to play devil's advocate here...",
        "willing to play devil's advocate in meetings",
      ],
      register: "Casual",
      source_tag: "lecture",
      correct_count: 0,
      wrong_count: 0,
      last_practiced_at: null,
      created_at: ts(0, 9),
    },
    {
      id: "mock-word-03",
      term: "burn the midnight oil",
      cefr: "C1",
      type: "idiom",
      meaning_en:
        "To work, study, or concentrate intensely late into the night in order to meet a demanding goal.",
      meaning_id:
        "Lembur bekerja atau belajar hingga larut malam demi menyelesaikan target.",
      examples_json: [
        {
          sentence:
            "We've been **burning the midnight oil** all week to finalize the product launch deck.",
          translation_id:
            "Kami **lembur hingga larut malam** sepanjang minggu untuk menuntaskan presentasi peluncuran produk.",
          context: "Daily",
        },
        {
          sentence:
            "Medical residents often **burn the midnight oil** reviewing case notes before morning rounds.",
          translation_id:
            "Dokter residen sering **bekerja hingga larut malam** menelaah catatan kasus sebelum visite pagi.",
          context: "Daily",
        },
      ],
      synonyms: ["pull an all-nighter", "work late", "toil"],
      antonyms: ["slack off", "call it a day", "turn in early"],
      word_families_json: [{ word: "burn the midnight oil", pos: "idiom" }],
      chunks: [
        "have been burning the midnight oil to...",
        "had to burn the midnight oil before the deadline",
        "often burn the midnight oil during exam week",
      ],
      register: "Casual",
      source_tag: "film",
      correct_count: 0,
      wrong_count: 0,
      last_practiced_at: null,
      created_at: ts(1, 18),
    },
    {
      id: "mock-word-04",
      term: "ubiquitous",
      cefr: "C1",
      type: "vocab",
      meaning_en:
        "Present, appearing, or encountered everywhere at once; so widespread that it feels inseparable from daily life.",
      meaning_id:
        "Ada di mana-mana secara bersamaan; sangat umum ditemui hingga terasa melekat dalam keseharian.",
      examples_json: [
        {
          sentence:
            "QR code menus have become **ubiquitous** in urban cafés over the past few years.",
          translation_id:
            "Menu kode QR kini **ada di mana-mana** di kafe-kafe perkotaan selama beberapa tahun terakhir.",
          context: "Daily",
        },
        {
          sentence:
            "The **ubiquitous** adoption of cloud computing transformed enterprise software economics.",
          translation_id:
            "Adopsi komputasi awan yang **merata di mana-mana** mengubah ekonomi perangkat lunak perusahaan.",
          context: "Academic",
        },
      ],
      synonyms: ["omnipresent", "pervasive", "universal"],
      antonyms: ["rare", "scarce", "uncommon"],
      word_families_json: [
        { word: "ubiquity", pos: "n" },
        { word: "ubiquitous", pos: "adj" },
        { word: "ubiquitously", pos: "adv" },
      ],
      chunks: [
        "has become ubiquitous in modern life",
        "the ubiquitous presence of",
        "ubiquitous across digital platforms",
      ],
      register: "Academic",
      source_tag: "lecture",
      correct_count: 0,
      wrong_count: 0,
      last_practiced_at: null,
      created_at: ts(1, 14),
    },
    {
      id: "mock-word-05",
      term: "ambivalent",
      cefr: "C2",
      type: "vocab",
      meaning_en:
        "Having mixed, contradictory feelings or competing attitudes toward someone or something at the same time.",
      meaning_id:
        "Ambivalen; memiliki perasaan campur aduk atau ragu-ragu karena dua sikap yang saling bertentangan.",
      examples_json: [
        {
          sentence:
            "She felt **ambivalent** about relocating abroad—thrilled by the role yet anxious about leaving family.",
          translation_id:
            "Ia merasa **bimbang/campur aduk** soal pindah ke luar negeri—antusias dengan perannya namun cemas meninggalkan keluarga.",
          context: "Daily",
        },
        {
          sentence:
            "Voters remained **ambivalent** toward the infrastructure bill despite extensive media coverage.",
          translation_id:
            "Para pemilih tetap **mendua** terhadap rancangan undang-undang infrastruktur meski liputan media luas.",
          context: "Academic",
        },
      ],
      synonyms: ["conflicted", "uncertain", "torn"],
      antonyms: ["decisive", "resolute", "certain"],
      word_families_json: [
        { word: "ambivalence", pos: "n" },
        { word: "ambivalent", pos: "adj" },
        { word: "ambivalently", pos: "adv" },
      ],
      chunks: [
        "feel ambivalent about",
        "remain deeply ambivalent toward",
        "an ambivalent attitude toward change",
      ],
      register: "Formal",
      source_tag: "book",
      correct_count: 0,
      wrong_count: 0,
      last_practiced_at: null,
      created_at: ts(2, 12),
    },
  ];

  return baseWords.map(attachMetadata);
}

const RAW_FALLBACK_DISCOVERY_PACKS: DiscoveryItem[][] = [
  [
    {
      id: "disc-p1-1",
      term: "magnanimous",
      type: "vocab",
      meaning_id:
        "Berjiwa besar dan murah hati, terutama dalam memaafkan saingan atau pihak yang lebih lemah.",
      examples_json: [
        {
          sentence:
            "Despite losing a tense final, she was **magnanimous** in defeat and praised her opponent's skill.",
          translation_id:
            "Meski kalah di final yang menegangkan, ia tetap **berjiwa besar** menerima kekalahan dan memuji keahlian lawannya.",
          context: "Daily",
        },
        {
          sentence:
            "A **magnanimous** settlement prevented decades of bitterness between the neighboring regions.",
          translation_id:
            "Kesepakatan yang **berjiwa besar** mencegah permusuhan puluhan tahun di antara dua wilayah bertetangga.",
          context: "Academic",
        },
      ],
      synonyms: ["generous", "chivalrous", "benevolent"],
      antonyms: ["petty", "vindictive", "spiteful"],
      word_families_json: [
        { word: "magnanimity", pos: "n" },
        { word: "magnanimous", pos: "adj" },
        { word: "magnanimously", pos: "adv" },
      ],
      register: "Formal",
      source_tag: "Discover",
    },
    {
      id: "disc-p1-2",
      term: "ameliorate",
      type: "vocab",
      meaning_id:
        "Memperbaiki atau memperingan keadaan yang sebelumnya buruk atau tidak memuaskan.",
      examples_json: [
        {
          sentence:
            "Targeted micro-grants helped **ameliorate** cash-flow stress for independent bookstores.",
          translation_id:
            "Hibah mikro tepat sasaran membantu **memperbaiki/meringankan** tekanan arus kas toko buku independen.",
          context: "Daily",
        },
        {
          sentence:
            "Expanded green corridors can **ameliorate** urban heat-island effects in dense megacities.",
          translation_id:
            "Koridor hijau yang diperluas dapat **meredakan** efek pulau panas perkotaan di megakota padat.",
          context: "Academic",
        },
      ],
      synonyms: ["improve", "enhance", "mitigate"],
      antonyms: ["worsen", "aggravate", "deteriorate"],
      word_families_json: [
        { word: "ameliorate", pos: "v" },
        { word: "amelioration", pos: "n" },
        { word: "ameliorative", pos: "adj" },
      ],
      register: "Academic",
      source_tag: "Discover",
    },
    {
      id: "disc-p1-3",
      term: "clandestine",
      type: "vocab",
      meaning_id:
        "Klandestin atau diam-diam; dilakukan secara rahasia karena sensitif atau terlarang.",
      examples_json: [
        {
          sentence:
            "They held **clandestine** meetings at an unmarked café to keep the merger out of the press.",
          translation_id:
            "Mereka menggelar pertemuan **rahasia** di kafe tanpa papan nama agar merger tidak bocor ke media.",
          context: "Daily",
        },
        {
          sentence:
            "Historians uncovered a **clandestine** network that smuggled banned essays across the border.",
          translation_id:
            "Sejarawan mengungkap jaringan **bawah tanah/rahasia** yang menyelundupkan esai terlarang melintasi perbatasan.",
          context: "Academic",
        },
      ],
      synonyms: ["covert", "secretive", "furtive"],
      antonyms: ["overt", "transparent", "aboveboard"],
      word_families_json: [
        { word: "clandestine", pos: "adj" },
        { word: "clandestinely", pos: "adv" },
        { word: "clandestinity", pos: "n" },
      ],
      register: "Formal",
      source_tag: "Discover",
    },
    {
      id: "disc-p1-4",
      term: "weather the storm",
      type: "idiom",
      meaning_id:
        "Bertahan melewati masa krisis atau situasi yang sangat sulit hingga keadaan kembali membaik.",
      examples_json: [
        {
          sentence:
            "Keeping six months of cash reserves helped the studio **weather the storm** during the downturn.",
          translation_id:
            "Menyimpan dana cadangan enam bulan membantu studio itu **bertahan melewati masa krisis** saat lesu ekonomi.",
          context: "Daily",
        },
        {
          sentence:
            "Diversified exporters managed to **weather the storm** better than single-market peers.",
          translation_id:
            "Eksportir yang terdiversifikasi mampu **melewati badai kesulitan** lebih baik daripada pesaing pasar tunggal.",
          context: "Academic",
        },
      ],
      synonyms: ["ride out", "endure", "survive a crisis"],
      antonyms: ["succumb", "buckle under pressure", "collapse"],
      word_families_json: [{ word: "weather the storm", pos: "idiom" }],
      register: "Casual",
      source_tag: "Discover",
    },
    {
      id: "disc-p1-5",
      term: "read between the lines",
      type: "idiom",
      meaning_id:
        "Menangkap makna tersembunyi atau maksud tersirat yang tidak diucapkan secara langsung.",
      examples_json: [
        {
          sentence:
            "If you **read between the lines** of that polite email, they're actually turning down the offer.",
          translation_id:
            "Kalau kamu **membaca maksud tersirat** dari email sopan itu, sebenarnya mereka menolak tawaran tersebut.",
          context: "Daily",
        },
        {
          sentence:
            "Diplomatic analysts must **read between the lines** of official joint communiqués.",
          translation_id:
            "Analis diplomatik harus **menangkap makna tersembunyi** di balik komunike resmi bersama.",
          context: "Academic",
        },
      ],
      synonyms: ["infer", "pick up on subtext", "decode"],
      antonyms: ["take at face value", "misinterpret"],
      word_families_json: [{ word: "read between the lines", pos: "idiom" }],
      register: "Casual",
      source_tag: "Discover",
    },
    {
      id: "disc-p1-6",
      term: "foster innovation",
      type: "collocation",
      meaning_id:
        "Mendorong dan memupuk lahirnya inovasi serta ide-ide baru dalam organisasi atau ekosistem.",
      examples_json: [
        {
          sentence:
            "Psychological safety within teams is proven to **foster innovation** and faster experimentation.",
          translation_id:
            "Rasa aman psikologis dalam tim terbukti **mendorong inovasi** dan eksperimen yang lebih cepat.",
          context: "Daily",
        },
        {
          sentence:
            "Open data standards **foster innovation** across independent civic technology startups.",
          translation_id:
            "Standar data terbuka **memupuk inovasi** di berbagai startup teknologi sipil independen.",
          context: "Academic",
        },
      ],
      synonyms: ["cultivate creativity", "stimulate invention"],
      antonyms: ["stifle creativity", "hinder progress"],
      word_families_json: [
        { word: "foster", pos: "v" },
        { word: "innovation", pos: "n" },
        { word: "innovative", pos: "adj" },
      ],
      register: "Formal",
      source_tag: "Discover",
    },
    {
      id: "disc-p1-7",
      term: "wield influence",
      type: "collocation",
      meaning_id:
        "Memiliki dan menggunakan pengaruh besar dalam menentukan arah kebijakan atau opini.",
      examples_json: [
        {
          sentence:
            "Independent podcast hosts now **wield influence** comparable to legacy broadcast networks.",
          translation_id:
            "Pembawa acara siniar independen kini **memiliki pengaruh besar** yang sebanding dengan jaringan TV tradisional.",
          context: "Daily",
        },
        {
          sentence:
            "Institutional investors **wield influence** over corporate climate disclosures.",
          translation_id:
            "Investor institusional **memegang pengaruh kuat** terhadap keterbukaan iklim perusahaan.",
          context: "Academic",
        },
      ],
      synonyms: ["exert power", "carry weight", "hold sway"],
      antonyms: ["lack clout", "be powerless"],
      word_families_json: [
        { word: "wield", pos: "v" },
        { word: "influence", pos: "n" },
        { word: "influential", pos: "adj" },
      ],
      register: "Academic",
      source_tag: "Discover",
    },
  ],
  [
    {
      id: "disc-p2-1",
      term: "disparate",
      type: "vocab",
      meaning_id:
        "Sangat berbeda satu sama lain hingga sulit dibandingkan secara langsung.",
      examples_json: [
        {
          sentence:
            "The app stitches together **disparate** data sources into one clean dashboard.",
          translation_id:
            "Aplikasi itu menyatukan sumber data yang **sangat beragam dan terpisah** ke dalam satu dasbor rapi.",
          context: "Daily",
        },
        {
          sentence:
            "Scholars reconciled **disparate** archaeological findings across three coastal excavations.",
          translation_id:
            "Para ilmuwan menyelaraskan temuan arkeologis yang **berbeda jauh** dari tiga penggalian pesisir.",
          context: "Academic",
        },
      ],
      synonyms: ["divergent", "dissimilar", "heterogeneous"],
      antonyms: ["homogeneous", "uniform", "comparable"],
      word_families_json: [
        { word: "disparate", pos: "adj" },
        { word: "disparately", pos: "adv" },
        { word: "disparity", pos: "n" },
      ],
      register: "Academic",
      source_tag: "Discover",
    },
    {
      id: "disc-p2-2",
      term: "ostensible",
      type: "vocab",
      meaning_id:
        "Tampak dari luar atau diklaim demikian, padahal alasan sebenarnya belum tentu sama.",
      examples_json: [
        {
          sentence:
            "The **ostensible** goal of the redesign was speed, though boosting ad views played a role.",
          translation_id:
            "Tujuan **yang diklaim di permukaan** dari desain ulang itu adalah kecepatan, meski peningkatan tayangan iklan ikut berperan.",
          context: "Daily",
        },
        {
          sentence:
            "Its **ostensible** neutrality masked subtle editorial preferences.",
          translation_id:
            "Netralitas **semu/yang tampak di luar** itu menutupi preferensi editorial yang halus.",
          context: "Academic",
        },
      ],
      synonyms: ["apparent", "seeming", "professed"],
      antonyms: ["genuine", "actual", "underlying"],
      word_families_json: [
        { word: "ostensible", pos: "adj" },
        { word: "ostensibly", pos: "adv" },
      ],
      register: "Formal",
      source_tag: "Discover",
    },
    {
      id: "disc-p2-3",
      term: "tenacious",
      type: "vocab",
      meaning_id:
        "Gigih, ulet, dan berpegang teguh tanpa mudah menyerah menghadapi rintangan.",
      examples_json: [
        {
          sentence:
            "Her **tenacious** debugging finally isolated a race condition nobody else could reproduce.",
          translation_id:
            "Proses debugging-nya yang **gigih/ulet** akhirnya menemukan bug sinkronisasi yang tak bisa direproduksi siapa pun.",
          context: "Daily",
        },
        {
          sentence:
            "**Tenacious** investigative reporting kept the water-quality audit in the public eye.",
          translation_id:
            "Liputan investigatif yang **pantang menyerah** membuat audit kualitas air tetap disorot publik.",
          context: "Academic",
        },
      ],
      synonyms: ["persistent", "dogged", "determined"],
      antonyms: ["irresolute", "yielding", "half-hearted"],
      word_families_json: [
        { word: "tenacity", pos: "n" },
        { word: "tenacious", pos: "adj" },
        { word: "tenaciously", pos: "adv" },
      ],
      register: "Formal",
      source_tag: "Discover",
    },
    {
      id: "disc-p2-4",
      term: "ballpark figure",
      type: "idiom",
      meaning_id:
        "Angka perkiraan kasar atau estimasi awal sebelum perhitungan mendetail dilakukan.",
      examples_json: [
        {
          sentence:
            "Could you give me a **ballpark figure** for the cloud hosting cost before we finalize the proposal?",
          translation_id:
            "Bisakah kamu beri **perkiraan kasarnya** untuk biaya hosting cloud sebelum kita memfinalkan proposal?",
          context: "Daily",
        },
        {
          sentence:
            "Even a **ballpark figure** helps stakeholders gauge whether the project is feasible.",
          translation_id:
            "Bahkan **estimasi kasar** pun membantu pemangku kepentingan menilai kelayakan proyek.",
          context: "Daily",
        },
      ],
      synonyms: ["rough estimate", "approximation", "guesstimate"],
      antonyms: ["exact figure", "precise quote"],
      word_families_json: [{ word: "ballpark figure", pos: "idiom" }],
      register: "Casual",
      source_tag: "Discover",
    },
    {
      id: "disc-p2-5",
      term: "touch base",
      type: "idiom",
      meaning_id:
        "Menghubungi kembali secara singkat untuk memberi kabar, mengecek progres, atau berkoordinasi.",
      examples_json: [
        {
          sentence:
            "Let's **touch base** on Friday afternoon once the design tokens are merged.",
          translation_id:
            "Ayo kita **koordinasi singkat** Jumat sore setelah design token selesai digabung.",
          context: "Daily",
        },
        {
          sentence:
            "I always **touch base** with my mentor before submitting scholarship applications.",
          translation_id:
            "Saya selalu **berkonsultasi singkat** dengan mentor sebelum mengirim berkas beasiswa.",
          context: "Daily",
        },
      ],
      synonyms: ["check in", "catch up", "reconnect"],
      antonyms: ["lose contact", "ghost"],
      word_families_json: [{ word: "touch base", pos: "idiom" }],
      register: "Casual",
      source_tag: "Discover",
    },
    {
      id: "disc-p2-6",
      term: "bridge the gap",
      type: "collocation",
      meaning_id:
        "Menjembatani kesenjangan atau perbedaan antara dua kelompok, kemampuan, maupun konsep.",
      examples_json: [
        {
          sentence:
            "Interactive audio flashcards **bridge the gap** between passive recognition and active speaking.",
          translation_id:
            "Kartu kilas audio interaktif **menjembatani celah** antara sekadar mengenali kata dan berbicara aktif.",
          context: "Daily",
        },
        {
          sentence:
            "Community mentorship programs aim to **bridge the gap** between university theory and industry practice.",
          translation_id:
            "Program bimbingan komunitas bertujuan **menjembatani kesenjangan** antara teori kampus dan praktik industri.",
          context: "Academic",
        },
      ],
      synonyms: ["close the divide", "connect", "narrow the disparity"],
      antonyms: ["widen the divide", "polarize"],
      word_families_json: [
        { word: "bridge", pos: "v" },
        { word: "gap", pos: "n" },
      ],
      register: "Formal",
      source_tag: "Discover",
    },
    {
      id: "disc-p2-7",
      term: "reap the rewards",
      type: "collocation",
      meaning_id:
        "Memetik hasil positif atau menikmati buah dari kerja keras dan kesabaran sebelumnya.",
      examples_json: [
        {
          sentence:
            "Learners who review ten words daily soon **reap the rewards** in fluent reading comprehension.",
          translation_id:
            "Pembelajar yang mengulas sepuluh kata setiap hari segera **memetik hasilnya** lewat pemahaman baca yang lancar.",
          context: "Daily",
        },
        {
          sentence:
            "Cities that invested early in cycling lanes now **reap the rewards** through cleaner air.",
          translation_id:
            "Kota yang berinvestasi lebih awal pada jalur sepeda kini **menuai manfaatnya** lewat udara yang lebih bersih.",
          context: "Academic",
        },
      ],
      synonyms: ["harvest the benefits", "enjoy the fruits", "profit from"],
      antonyms: ["suffer the consequences", "come up empty-handed"],
      word_families_json: [
        { word: "reap", pos: "v" },
        { word: "reward", pos: "n" },
        { word: "rewarding", pos: "adj" },
      ],
      register: "Formal",
      source_tag: "Discover",
    },
  ],
  [
    {
      id: "disc-p3-1",
      term: "sagacious",
      type: "vocab",
      meaning_id:
        "Bijaksana dan tajam penilaiannya; mampu melihat inti persoalan jauh ke depan.",
      examples_json: [
        {
          sentence:
            "A **sagacious** mentor tells you which battles are worth fighting and which to ignore.",
          translation_id:
            "Mentor yang **bijaksana dan jeli** memberi tahu masalah mana yang layak diperjuangkan dan mana yang sebaiknya diabaikan.",
          context: "Daily",
        },
        {
          sentence:
            "The board credited her **sagacious** capital allocation for surviving two recessions.",
          translation_id:
            "Dewan direksi memuji alokasi modalnya yang **cerdas dan berpandangan jauh** karena membuat perusahaan selamat dari dua resesi.",
          context: "Academic",
        },
      ],
      synonyms: ["astute", "discerning", "perspicacious"],
      antonyms: ["foolish", "shortsighted", "naive"],
      word_families_json: [
        { word: "sagacity", pos: "n" },
        { word: "sagacious", pos: "adj" },
        { word: "sagaciously", pos: "adv" },
      ],
      register: "Academic",
      source_tag: "Discover",
    },
    {
      id: "disc-p3-2",
      term: "corroborate",
      type: "vocab",
      meaning_id:
        "Menguatkan atau mengonfirmasi kebenaran suatu pernyataan atau temuan dengan bukti tambahan.",
      examples_json: [
        {
          sentence:
            "Two independent witnesses came forward to **corroborate** the driver's account.",
          translation_id:
            "Dua saksi independen tampil untuk **menguatkan** kesaksian pengemudi tersebut.",
          context: "Daily",
        },
        {
          sentence:
            "Ice-core samples **corroborate** satellite measurements of atmospheric warming.",
          translation_id:
            "Sampel inti es **mengonfirmasi** pengukuran satelit mengenai pemanasan atmosfer.",
          context: "Academic",
        },
      ],
      synonyms: ["substantiate", "verify", "validate"],
      antonyms: ["contradict", "refute", "disprove"],
      word_families_json: [
        { word: "corroborate", pos: "v" },
        { word: "corroboration", pos: "n" },
        { word: "corroborative", pos: "adj" },
      ],
      register: "Academic",
      source_tag: "Discover",
    },
    {
      id: "disc-p3-3",
      term: "candid",
      type: "vocab",
      meaning_id:
        "Jujur, blak-blakan, dan apa adanya tanpa dibuat-buat atau ditutup-tutupi.",
      examples_json: [
        {
          sentence:
            "Thank you for the **candid** feedback on my speech—it really helped me tighten the ending.",
          translation_id:
            "Terima kasih atas masukan yang **jujur apa adanya** soal pidatoku—sangat membantu merapikan penutupnya.",
          context: "Daily",
        },
        {
          sentence:
            "Her memoir offers a **candid** reflection on burnout in high-growth startups.",
          translation_id:
            "Memoarnya menyajikan refleksi yang **terbuka dan jujur** tentang kelelahan kerja di startup bertumbuh cepat.",
          context: "Academic",
        },
      ],
      synonyms: ["frank", "forthright", "unvarnished"],
      antonyms: ["evasive", "guarded", "insincere"],
      word_families_json: [
        { word: "candor", pos: "n" },
        { word: "candid", pos: "adj" },
        { word: "candidly", pos: "adv" },
      ],
      register: "Formal",
      source_tag: "Discover",
    },
    {
      id: "disc-p3-4",
      term: "in the long run",
      type: "idiom",
      meaning_id:
        "Dalam jangka panjang; pada akhirnya setelah melewati periode waktu yang cukup lama.",
      examples_json: [
        {
          sentence:
            "Writing clean tests feels slower today, but it saves massive debugging time **in the long run**.",
          translation_id:
            "Menulis tes yang rapi terasa lebih lambat hari ini, tapi menghemat banyak waktu debugging **dalam jangka panjang**.",
          context: "Daily",
        },
        {
          sentence:
            "Preventive healthcare lowers national medical spending **in the long run**.",
          translation_id:
            "Layanan kesehatan preventif menekan belanja medis nasional **dalam jangka panjang**.",
          context: "Academic",
        },
      ],
      synonyms: ["eventually", "over time", "ultimately"],
      antonyms: ["in the short term", "immediately"],
      word_families_json: [{ word: "in the long run", pos: "idiom" }],
      register: "Casual",
      source_tag: "Discover",
    },
    {
      id: "disc-p3-5",
      term: "on the same page",
      type: "idiom",
      meaning_id:
        "Sepaham dan memiliki kesepakatan atau pemahaman yang sama sebelum melangkah bersama.",
      examples_json: [
        {
          sentence:
            "Before we write a line of code, let's get **on the same page** about user privacy rules.",
          translation_id:
            "Sebelum menulis satu baris kode pun, mari pastikan kita **sepaham** soal aturan privasi pengguna.",
          context: "Daily",
        },
        {
          sentence:
            "Weekly sync notes keep remote engineers across three time zones **on the same page**.",
          translation_id:
            "Catatan sinkronisasi mingguan menjaga para insinyur jarak jauh di tiga zona waktu tetap **sejalan pemahamannya**.",
          context: "Daily",
        },
      ],
      synonyms: ["aligned", "in agreement", "seeing eye to eye"],
      antonyms: ["at odds", "out of sync", "misaligned"],
      word_families_json: [{ word: "on the same page", pos: "idiom" }],
      register: "Casual",
      source_tag: "Discover",
    },
    {
      id: "disc-p3-6",
      term: "set a precedent",
      type: "collocation",
      meaning_id:
        "Menciptakan contoh atau standar awal yang kelak dijadikan acuan bagi keputusan serupa di masa depan.",
      examples_json: [
        {
          sentence:
            "Allowing flexible hybrid hours **set a precedent** that every department later adopted.",
          translation_id:
            "Mengizinkan jam kerja hibrida yang fleksibel **menciptakan preseden/contoh acuan** yang kemudian diadopsi semua departemen.",
          context: "Daily",
        },
        {
          sentence:
            "The landmark court ruling **set a precedent** for digital copyright protection.",
          translation_id:
            "Putusan pengadilan bersejarah itu **menetapkan preseden** bagi perlindungan hak cipta digital.",
          context: "Academic",
        },
      ],
      synonyms: ["establish a standard", "serve as a benchmark"],
      antonyms: ["break with tradition", "remain an isolated case"],
      word_families_json: [
        { word: "precedent", pos: "n" },
        { word: "unprecedented", pos: "adj" },
      ],
      register: "Formal",
      source_tag: "Discover",
    },
    {
      id: "disc-p3-7",
      term: "shed light on",
      type: "collocation",
      meaning_id:
        "Memberikan kejelasan atau membantu menjelaskan sesuatu yang sebelumnya sulit dipahami.",
      examples_json: [
        {
          sentence:
            "User interviews **shed light on** why people abandoned the checkout flow on step three.",
          translation_id:
            "Wawancara pengguna **memberi kejelasan** mengapa orang meninggalkan proses checkout di langkah ketiga.",
          context: "Daily",
        },
        {
          sentence:
            "Recent brain-imaging studies **shed light on** how bilingual speakers switch registers effortlessly.",
          translation_id:
            "Studi pencitraan otak terbaru **mengungkap penjelasan** tentang bagaimana penutur dwibahasa berganti ragam bahasa dengan mulus.",
          context: "Academic",
        },
      ],
      synonyms: ["clarify", "illuminate", "elucidate"],
      antonyms: ["obscure", "muddy", "complicate"],
      word_families_json: [{ word: "shed light on", pos: "collocation" }],
      register: "Formal",
      source_tag: "Discover",
    },
  ],
];

export const FALLBACK_DISCOVERY_PACKS: DiscoveryItem[][] =
  RAW_FALLBACK_DISCOVERY_PACKS.map((pack) => pack.map(attachMetadata));

export const OFFLINE_AUTOFILL_DICTIONARY: Record<string, AutofillPayload> = {
  gentrified: {
    term: "gentrified",
    type: "vocab",
    meaning_id:
      "Mengalami gentrifikasi; berubah menjadi kawasan yang lebih elit dan mahal sehingga penduduk asli berpenghasilan rendah tergeser.",
    examples: [
      {
        sentence:
          "This once-affordable neighborhood has rapidly **gentrified**, replacing family diners with artisan coffee bars.",
        translation_id:
          "Lingkungan yang dulunya terjangkau ini cepat mengalami **gentrifikasi**, menggantikan kedai keluarga dengan kafe kopi artisan.",
        context: "Daily",
      },
      {
        sentence:
          "Researchers tracked housing displacement across **gentrified** transit corridors.",
        translation_id:
          "Peneliti melacak perpindahan hunian di koridor transit yang telah **tergentrifikasi**.",
        context: "Academic",
      },
    ],
    synonyms: ["upscaled", "revitalized", "bourgeoisified"],
    antonyms: ["impoverished", "blighted", "neglected"],
    word_families: [
      { word: "gentrify", pos: "v" },
      { word: "gentrification", pos: "n" },
      { word: "gentrified", pos: "adj" },
      { word: "gentrifier", pos: "n" },
    ],
    register: "Academic",
  },
  serendipity: {
    term: "serendipity",
    type: "vocab",
    meaning_id:
      "Keberuntungan tak terduga; menemukan hal berharga atau menyenangkan secara kebetulan.",
    examples: [
      {
        sentence:
          "Meeting my future co-founder on a delayed train was pure **serendipity**.",
        translation_id:
          "Bertemu calon rekan pendiri perusahaanku di kereta yang tertunda adalah **keberuntungan tak terduga**.",
        context: "Daily",
      },
      {
        sentence:
          "Scientific breakthroughs often combine rigorous method with moments of **serendipity**.",
        translation_id:
          "Terobosan ilmiah sering memadukan metode ketat dengan momen **penemuan kebetulan yang berharga**.",
        context: "Academic",
      },
    ],
    synonyms: ["fortuity", "happy accident", "providence"],
    antonyms: ["misfortune", "calamity", "deliberate design"],
    word_families: [
      { word: "serendipity", pos: "n" },
      { word: "serendipitous", pos: "adj" },
      { word: "serendipitously", pos: "adv" },
    ],
    register: "Formal",
  },
  alleviate: {
    term: "alleviate",
    type: "vocab",
    meaning_id:
      "Meringankan atau meredakan rasa sakit, beban, maupun kesulitan tanpa harus menghilangkannya sepenuhnya.",
    examples: [
      {
        sentence:
          "Short walking breaks can **alleviate** lower-back stiffness after long desk sessions.",
        translation_id:
          "Jeda berjalan singkat dapat **meredakan** kekakuan punggung bawah setelah duduk lama di meja.",
        context: "Daily",
      },
      {
        sentence:
          "Targeted subsidies were introduced to **alleviate** energy costs for rural households.",
        translation_id:
          "Subsidi tepat sasaran diperkenalkan untuk **meringankan** biaya energi rumah tangga pedesaan.",
        context: "Academic",
      },
    ],
    synonyms: ["relieve", "ease", "mitigate"],
    antonyms: ["aggravate", "worsen", "intensify"],
    word_families: [
      { word: "alleviate", pos: "v" },
      { word: "alleviation", pos: "n" },
      { word: "alleviating", pos: "adj" },
    ],
    register: "Formal",
  },
  "break the ice": {
    term: "break the ice",
    type: "idiom",
    meaning_id:
      "Mencairkan suasana kaku atau canggung saat baru pertama kali bertemu atau memulai percakapan.",
    examples: [
      {
        sentence:
          "She cracked a warm joke about the rainy commute to **break the ice** before the workshop.",
        translation_id:
          "Ia melontarkan candaan hangat soal perjalanan hujan untuk **mencairkan suasana** sebelum lokakarya.",
        context: "Daily",
      },
      {
        sentence:
          "Interactive icebreaker prompts help remote interns **break the ice** on day one.",
        translation_id:
          "Pertanyaan pembuka interaktif membantu anak magang jarak jauh **menghilangkan kecanggungan** di hari pertama.",
        context: "Daily",
      },
    ],
    synonyms: ["warm up the room", "ease tension", "kick off conversation"],
    antonyms: ["create awkwardness", "clam up"],
    word_families: [
      { word: "break the ice", pos: "idiom" },
      { word: "icebreaker", pos: "n" },
    ],
    register: "Casual",
  },
  "take for granted": {
    term: "take for granted",
    type: "idiom",
    meaning_id:
      "Menganggap remeh atau mengira sesuatu sudah pasti selalu ada sehingga lupa menghargainya.",
    examples: [
      {
        sentence:
          "People often **take clean tap water for granted** until a pipe bursts in the neighborhood.",
        translation_id:
          "Orang sering **menganggap remeh air keran bersih** sampai ada pipa pecah di lingkungannya.",
        context: "Daily",
      },
      {
        sentence:
          "Never **take a supportive team for granted** when building ambitious products.",
        translation_id:
          "Jangan pernah **kurang menghargai tim yang suportif** saat membangun produk ambisius.",
        context: "Daily",
      },
    ],
    synonyms: ["undervalue", "presume", "overlook"],
    antonyms: ["cherish", "appreciate", "value"],
    word_families: [{ word: "take for granted", pos: "idiom" }],
    register: "Casual",
  },
  "cognitive dissonance": {
    term: "cognitive dissonance",
    type: "collocation",
    meaning_id:
      "Disonansi kognitif; ketidaknyamanan psikologis ketika keyakinan seseorang bertentangan dengan tindakannya atau fakta baru.",
    examples: [
      {
        sentence:
          "Preaching sustainability while upgrading phones every year creates mild **cognitive dissonance**.",
        translation_id:
          "Mengampanyekan keberlanjutan sambil mengganti ponsel tiap tahun memicu **ketidaknyamanan batin/disonansi kognitif** ringan.",
        context: "Daily",
      },
      {
        sentence:
          "Behavioral economists study how **cognitive dissonance** shapes post-purchase rationalization.",
        translation_id:
          "Ekonom perilaku meneliti bagaimana **disonansi kognitif** membentuk pembenaran setelah membeli.",
        context: "Academic",
      },
    ],
    synonyms: ["mental conflict", "inner contradiction"],
    antonyms: ["mental harmony", "consistency"],
    word_families: [
      { word: "cognitive", pos: "adj" },
      { word: "dissonance", pos: "n" },
      { word: "dissonant", pos: "adj" },
    ],
    register: "Academic",
  },
  lucrative: {
    term: "lucrative",
    type: "vocab",
    meaning_id:
      "Sangat menguntungkan secara finansial; menghasilkan profit besar.",
    examples: [
      {
        sentence:
          "Specialized cybersecurity consulting has become a **lucrative** career path.",
        translation_id:
          "Konsultasi keamanan siber spesialis telah menjadi jalur karier yang **sangat menguntungkan**.",
        context: "Daily",
      },
      {
        sentence:
          "Streaming licensing deals proved **lucrative** for independent animation studios.",
        translation_id:
          "Kesepakatan lisensi streaming terbukti **mendatangkan laba besar** bagi studio animasi independen.",
        context: "Academic",
      },
    ],
    synonyms: ["profitable", "remunerative", "gainful"],
    antonyms: ["unprofitable", "loss-making", "unrewarding"],
    word_families: [
      { word: "lucrative", pos: "adj" },
      { word: "lucratively", pos: "adv" },
      { word: "lucrativeness", pos: "n" },
    ],
    register: "Formal",
  },
  "under the weather": {
    term: "under the weather",
    type: "idiom",
    meaning_id:
      "Sedang tidak enak badan, sedikit sakit, atau kelelahan.",
    examples: [
      {
        sentence:
          "I'm feeling a bit **under the weather** today, so I'll join the stand-up from home.",
        translation_id:
          "Aku merasa agak **kurang enak badan** hari ini, jadi aku ikut rapat singkat dari rumah saja.",
        context: "Daily",
      },
      {
        sentence:
          "Whenever she feels **under the weather**, warm ginger tea helps her recover faster.",
        translation_id:
          "Setiap kali ia merasa **meriang/tidak fit**, teh jahe hangat membantunya pulih lebih cepat.",
        context: "Daily",
      },
    ],
    synonyms: ["unwell", "off-color", "out of sorts"],
    antonyms: ["fit as a fiddle", "in top shape"],
    word_families: [{ word: "under the weather", pos: "idiom" }],
    register: "Casual",
  },
  eloquent: {
    term: "eloquent",
    type: "vocab",
    meaning_id:
      "Fasih, ekspresif, dan sangat memikat dalam menyampaikan gagasan secara lisan maupun tulisan.",
    examples: [
      {
        sentence:
          "He gave an **eloquent** tribute that moved everyone in the auditorium.",
        translation_id:
          "Ia menyampaikan penghormatan yang **fasih dan menyentuh** hingga menggerakkan semua orang di auditorium.",
        context: "Daily",
      },
      {
        sentence:
          "An **eloquent** defense of open-source education opened the symposium.",
        translation_id:
          "Pembelaan yang **artikulatif dan memikat** terhadap pendidikan terbuka mengawali simposium itu.",
        context: "Academic",
      },
    ],
    synonyms: ["articulate", "fluent", "persuasive"],
    antonyms: ["inarticulate", "halting", "tongue-tied"],
    word_families: [
      { word: "eloquence", pos: "n" },
      { word: "eloquent", pos: "adj" },
      { word: "eloquently", pos: "adv" },
    ],
    register: "Formal",
  },
  procrastinate: {
    term: "procrastinate",
    type: "vocab",
    meaning_id:
      "Menunda-nunda pekerjaan atau keputusan penting meski tahu konsekuensinya.",
    examples: [
      {
        sentence:
          "When a task feels overwhelming, I tend to **procrastinate** by reorganizing my desk.",
        translation_id:
          "Saat tugas terasa berat, aku cenderung **menunda-nunda** dengan merapikan meja kerja.",
        context: "Daily",
      },
      {
        sentence:
          "Perfectionism often causes students to **procrastinate** on starting thesis drafts.",
        translation_id:
          "Perfeksionisme kerap membuat mahasiswa **mengulur waktu** untuk memulai draf skripsi.",
        context: "Academic",
      },
    ],
    synonyms: ["stall", "delay", "put off"],
    antonyms: ["expedite", "act promptly", "tackle head-on"],
    word_families: [
      { word: "procrastinate", pos: "v" },
      { word: "procrastination", pos: "n" },
      { word: "procrastinator", pos: "n" },
    ],
    register: "Casual",
  },
  facade: {
    term: "facade",
    type: "vocab",
    meaning_id:
      "Bagian depan bangunan, atau sikap luar/kepura-puraan yang menutupi kondisi atau emosi sebenarnya.",
    examples: [
      {
        sentence:
          "Behind his cheerful **facade**, he was quietly worrying about the exam results.",
        translation_id:
          "Di balik **topeng keceriaannya**, ia diam-diam mencemaskan hasil ujian.",
        context: "Daily",
      },
      {
        sentence:
          "Architects restored the limestone **facade** of the 1920s library.",
        translation_id:
          "Para arsitek memugar **fasad/bagian depan** batu kapur perpustakaan era 1920-an itu.",
        context: "Academic",
      },
    ],
    synonyms: ["veneer", "front", "exterior"],
    antonyms: ["authenticity", "interior", "truth"],
    word_families: [{ word: "facade", pos: "n" }],
    register: "Formal",
  },
  discrepancy: {
    term: "discrepancy",
    type: "vocab",
    meaning_id:
      "Ketidaksesuaian atau selisih mencolok antara dua data, laporan, atau fakta yang seharusnya sama.",
    examples: [
      {
        sentence:
          "The finance team flagged a $400 **discrepancy** between the invoice and bank statement.",
        translation_id:
          "Tim keuangan menandai **selisih** sebesar $400 antara faktur dan rekening koran.",
        context: "Daily",
      },
      {
        sentence:
          "Sensor calibration resolved the **discrepancy** in temperature readings.",
        translation_id:
          "Kalibrasi sensor mengatasi **ketidaksesuaian** pada pembacaan suhu.",
        context: "Academic",
      },
    ],
    synonyms: ["mismatch", "inconsistency", "divergence"],
    antonyms: ["consistency", "parity", "agreement"],
    word_families: [
      { word: "discrepancy", pos: "n" },
      { word: "discrepant", pos: "adj" },
    ],
    register: "Formal",
  },
  "hit the nail on the head": {
    term: "hit the nail on the head",
    type: "idiom",
    meaning_id:
      "Tepat sasaran sekali; menganalisis atau mengatakan inti masalah dengan akurat.",
    examples: [
      {
        sentence:
          "You **hit the nail on the head**—slow onboarding was the real reason users churned.",
        translation_id:
          "Tebakanmu **tepat sasaran sekali**—proses onboarding yang lambat adalah alasan utama pengguna berhenti.",
        context: "Daily",
      },
      {
        sentence:
          "That editorial **hit the nail on the head** regarding housing affordability.",
        translation_id:
          "Editorial itu **sangat tepat menyentuh inti persoalan** mengenai keterjangkauan hunian.",
        context: "Daily",
      },
    ],
    synonyms: ["nail it", "be spot-on", "get right to the point"],
    antonyms: ["miss the mark", "bark up the wrong tree"],
    word_families: [{ word: "hit the nail on the head", pos: "idiom" }],
    register: "Casual",
  },
  "pose a threat": {
    term: "pose a threat",
    type: "collocation",
    meaning_id:
      "Menimbulkan atau menjadi ancaman serius bagi keamanan, stabilitas, atau kelangsungan sesuatu.",
    examples: [
      {
        sentence:
          "Unpatched browser extensions can **pose a threat** to corporate credentials.",
        translation_id:
          "Ekstensi peramban yang tidak diperbarui dapat **menjadi ancaman** bagi kredensial perusahaan.",
        context: "Daily",
      },
      {
        sentence:
          "Invasive algae **pose a threat** to native reef biodiversity.",
        translation_id:
          "Alga invasif **menimbulkan ancaman** bagi keanekaragaman hayati terumbu karang asli.",
        context: "Academic",
      },
    ],
    synonyms: ["present a danger", "endanger", "jeopardize"],
    antonyms: ["safeguard", "protect", "fortify"],
    word_families: [
      { word: "pose", pos: "v" },
      { word: "threat", pos: "n" },
      { word: "threaten", pos: "v" },
    ],
    register: "Formal",
  },
  "yield results": {
    term: "yield results",
    type: "collocation",
    meaning_id:
      "Membuahkan hasil nyata setelah dilakukan upaya, riset, atau investasi.",
    examples: [
      {
        sentence:
          "Consistent spaced repetition starts to **yield results** within three weeks.",
        translation_id:
          "Pengulangan berjarak yang konsisten mulai **membuahkan hasil** dalam tiga minggu.",
        context: "Daily",
      },
      {
        sentence:
          "Longitudinal clinical trials **yielded results** supporting early screening.",
        translation_id:
          "Uji klinis longitudinal **menghasilkan temuan** yang mendukung deteksi dini.",
        context: "Academic",
      },
    ],
    synonyms: ["produce outcomes", "bear fruit", "deliver results"],
    antonyms: ["come up empty", "fail to deliver"],
    word_families: [
      { word: "yield", pos: "v" },
      { word: "result", pos: "n" },
    ],
    register: "Formal",
  },
  "snowed under": {
    term: "snowed under",
    type: "idiom",
    meaning_id:
      "Kewalahan atau sangat sibuk karena dibanjiri tumpukan pekerjaan, tugas, atau permintaan sekaligus.",
    examples: [
      {
        sentence:
          "I'd love to grab coffee, but I'm completely **snowed under** with final exam prep this week.",
        translation_id:
          "Aku sebenarnya mau ngopi, tapi minggu ini aku benar-benar **kewalahan** dengan persiapan ujian akhir.",
        context: "Daily",
      },
      {
        sentence:
          "The support desk was **snowed under** by ticket requests right after the major software update.",
        translation_id:
          "Tim layanan pelanggan **dibanjiri/kewalahan** oleh permintaan tiket tepat setelah pembaruan perangkat lunak besar.",
        context: "Daily",
      },
    ],
    synonyms: ["overwhelmed", "swamped", "buried in work"],
    antonyms: ["free as a bird", "caught up", "unburdened"],
    word_families: [
      { word: "snowed under", pos: "idiom" },
      { word: "swamped", pos: "adj" },
    ],
    register: "Casual",
  },
  "bite the bullet": {
    term: "bite the bullet",
    type: "idiom",
    meaning_id:
      "Memberanikan diri menghadapi situasi sulit atau tidak menyenangkan yang sudah tak bisa dihindari lagi.",
    examples: [
      {
        sentence:
          "After delaying for months, I decided to **bite the bullet** and schedule the root canal.",
        translation_id:
          "Setelah menunda berbulan-bulan, aku memutuskan **memberanikan diri menghadapinya** dan menjadwalkan perawatan gigi.",
        context: "Daily",
      },
      {
        sentence:
          "The leadership team chose to **bite the bullet** and refactor the core payment module early.",
        translation_id:
          "Tim pimpinan memilih **mengambil langkah pahit namun perlu** untuk merombak modul pembayaran inti lebih awal.",
        context: "Daily",
      },
    ],
    synonyms: ["face the music", "grit one's teeth", "take the plunge"],
    antonyms: ["chicken out", "procrastinate", "evade"],
    word_families: [{ word: "bite the bullet", pos: "idiom" }],
    register: "Casual",
  },
  "burn the midnight oil": {
    term: "burn the midnight oil",
    type: "idiom",
    meaning_id:
      "Lembur bekerja atau belajar hingga larut malam demi menyelesaikan target.",
    examples: [
      {
        sentence:
          "Our design squad has been **burning the midnight oil** to ship the prototype before Friday.",
        translation_id:
          "Tim desain kami **lembur hingga larut malam** agar prototipe siap sebelum Jumat.",
        context: "Daily",
      },
      {
        sentence:
          "Law students often **burn the midnight oil** reviewing landmark cases before bar exams.",
        translation_id:
          "Mahasiswa hukum sering **belajar sampai larut malam** menelaah kasus-kasus penting sebelum ujian profesi.",
        context: "Daily",
      },
    ],
    synonyms: ["pull an all-nighter", "work late", "toil"],
    antonyms: ["slack off", "call it a day", "turn in early"],
    word_families: [{ word: "burn the midnight oil", pos: "idiom" }],
    register: "Casual",
  },
  "cut corners": {
    term: "cut corners",
    type: "idiom",
    meaning_id:
      "Mengambil jalan pintas dengan mengorbankan kualitas atau prosedur standar demi menghemat waktu atau biaya.",
    examples: [
      {
        sentence:
          "Never **cut corners** on electrical wiring just to finish a renovation faster.",
        translation_id:
          "Jangan pernah **mengambil jalan pintas murahan** pada instalasi listrik hanya agar renovasi cepat selesai.",
        context: "Daily",
      },
      {
        sentence:
          "Inspectors found that the manufacturer had **cut corners** during quality testing.",
        translation_id:
          "Inspektur menemukan bahwa produsen telah **mengurangi standar kualitas** selama uji mutu.",
        context: "Academic",
      },
    ],
    synonyms: ["skimp", "take shortcuts", "compromise quality"],
    antonyms: ["go by the book", "be thorough"],
    word_families: [
      { word: "cut corners", pos: "idiom" },
      { word: "corner-cutting", pos: "n" },
    ],
    register: "Casual",
  },
  "on thin ice": {
    term: "on thin ice",
    type: "idiom",
    meaning_id:
      "Berada dalam posisi berisiko tinggi atau situasi genting di mana satu kesalahan kecil saja bisa berakibat fatal.",
    examples: [
      {
        sentence:
          "After missing three deadlines in a row, he's walking **on thin ice** with the project lead.",
        translation_id:
          "Setelah melewatkan tiga tenggat berturut-turut, posisinya **sangat rawan/di ujung tanduk** di mata pimpinan proyek.",
        context: "Daily",
      },
      {
        sentence:
          "Companies making unverified sustainability claims are skating **on thin ice** with regulators.",
        translation_id:
          "Perusahaan yang membuat klaim keberlanjutan tanpa bukti berada di **posisi rentan** di hadapan regulator.",
        context: "Daily",
      },
    ],
    synonyms: ["in a precarious position", "treading dangerously"],
    antonyms: ["on solid ground", "safe and sound"],
    word_families: [{ word: "on thin ice", pos: "idiom" }],
    register: "Casual",
  },
};

export function buildFallbackAutofill(rawTerm: string): AutofillPayload {
  const cleanTerm = rawTerm.trim();
  const key = normalizeTermKey(cleanTerm);
  const directMatch = OFFLINE_AUTOFILL_DICTIONARY[key];
  if (directMatch) {
    return attachMetadata(directMatch);
  }

  const tokens = cleanTerm.split(/\s+/).filter(Boolean);
  const wordCount = tokens.length;
  const idiomIndicators =
    /\b(under|over|out of|on|in|off|up|down|bite|burn|cut|hit|snowed|ice|bullet)\b/i;
  const inferredType =
    wordCount >= 3 || (wordCount === 2 && idiomIndicators.test(cleanTerm))
      ? "idiom"
      : wordCount === 2
        ? "collocation"
        : "vocab";

  const families = [{ word: cleanTerm, pos: inferredType }];

  const builtInBilingual = BUILT_IN_ENGLISH_MEANINGS[key];
  const meaningEn =
    builtInBilingual?.meaning_en ||
    `English expression "${cleanTerm}" used in natural modern contexts (offline mode — configure GEMINI_API_KEY for full AI definitions).`;
  const meaningId = `Ungkapan/kata "${cleanTerm}" dalam konteks bahasa Inggris modern (mode offline — sambungkan GEMINI_API_KEY untuk definisi AI penuh).`;

  return attachMetadata({
    term: cleanTerm,
    cefr: builtInBilingual?.cefr || "C1",
    type: inferredType,
    meaning_en: meaningEn,
    meaning_id: meaningId,
    examples: [
      {
        sentence: `In everyday conversation, speakers naturally use **${cleanTerm}** to express a clear point.`,
        translation_id: `Dalam percakapan sehari-hari, penutur menggunakan **${cleanTerm}** secara alami untuk menyampaikan maksud yang jelas.`,
        context: "Daily",
      },
      {
        sentence: `Academic essays often incorporate **${cleanTerm}** when analyzing real-world examples.`,
        translation_id: `Esai akademik kerap menyertakan **${cleanTerm}** saat menganalisis contoh di dunia nyata.`,
        context: "Academic",
      },
    ],
    synonyms: ["relevant expression", "contextual equivalent"],
    antonyms: ["opposite expression"],
    word_families: families,
    register: inferredType === "idiom" ? "Casual" : "Formal",
  });
}

const RAW_FALLBACK_SUGGESTED_WORDS: SuggestedWordItem[] = [
  {
    term: "at a crossroads",
    cefr: "C1",
    type: "idiom",
    meaning_en:
      "At a decisive turning point where a crucial choice must be made between two very different paths.",
    meaning_id:
      "Berada di persimpangan penting yang menuntut keputusan krusial di antara dua arah yang sangat berbeda.",
    examples: [
      {
        sentence:
          "After five years in consulting, Maya found herself **at a crossroads** between launching her own studio or pursuing a PhD.",
        translation_id:
          "Setelah lima tahun di bidang konsultasi, Maya berada **di persimpangan besar** antara merintis studio sendiri atau melanjutkan S3.",
        context: "Daily",
      },
      {
        sentence:
          "Public broadcasting now stands **at a crossroads** as younger audiences migrate to short-form video.",
        translation_id:
          "Penyiaran publik kini berada **di titik persimpangan** seiring audiens muda beralih ke video pendek.",
        context: "Academic",
      },
    ],
    synonyms: ["at a turning point", "at a juncture", "facing a watershed"],
    antonyms: ["on a settled path", "on autopilot"],
    word_families: [{ word: "at a crossroads", pos: "idiom" }],
    register: "Formal",
    source_tag: "article",
  },
  {
    term: "throw caution to the wind",
    cefr: "C2",
    type: "idiom",
    meaning_en:
      "To abandon careful restraint and act boldly or recklessly despite clear risks.",
    meaning_id:
      "Mengabaikan kehati-hatian dan mengambil keputusan nekat atau sangat berani meski risikonya nyata.",
    examples: [
      {
        sentence:
          "Exhausted by corporate politics, he **threw caution to the wind** and bought a one-way ticket to Lisbon.",
        translation_id:
          "Lelah dengan politik kantor, ia **membuang segala keraguan** dan membeli tiket sekali jalan ke Lisbon.",
        context: "Daily",
      },
      {
        sentence:
          "Early-stage founders rarely **throw caution to the wind** when handling regulated financial data.",
        translation_id:
          "Pendiri startup tahap awal jarang **bersikap nekat tanpa perhitungan** saat menangani data keuangan teregulasi.",
        context: "Academic",
      },
    ],
    synonyms: ["take a leap of faith", "act recklessly", "go all in"],
    antonyms: ["play it safe", "err on the side of caution"],
    word_families: [{ word: "throw caution to the wind", pos: "idiom" }],
    register: "Casual",
    source_tag: "film",
  },
  {
    term: "bark up the wrong tree",
    cefr: "C1",
    type: "idiom",
    meaning_en:
      "To pursue a mistaken course of action or blame the wrong cause when trying to solve a problem.",
    meaning_id:
      "Salah sasaran; mencari solusi di tempat yang keliru atau menyalahkan penyebab yang tidak tepat.",
    examples: [
      {
        sentence:
          "If you think the database is causing the slowdown, you're **barking up the wrong tree**—it's the image payload.",
        translation_id:
          "Kalau kamu mengira database penyebab lambatnya, kamu **salah sasaran**—masalahnya ada di ukuran gambar.",
        context: "Daily",
      },
      {
        sentence:
          "Critics focusing solely on tuition fees may be **barking up the wrong tree** when analyzing student debt.",
        translation_id:
          "Kritikus yang hanya menyoroti biaya kuliah bisa jadi **keliru membidik akar masalah** saat menganalisis utang mahasiswa.",
        context: "Academic",
      },
    ],
    synonyms: ["miss the mark", "pursue a false lead", "look in the wrong place"],
    antonyms: ["hit the nail on the head", "be on the right track"],
    word_families: [{ word: "bark up the wrong tree", pos: "idiom" }],
    register: "Casual",
    source_tag: "film",
  },
  {
    term: "turn a blind eye",
    cefr: "C1",
    type: "idiom",
    meaning_en:
      "To deliberately ignore misconduct, warning signs, or unpleasant facts you are fully aware of.",
    meaning_id:
      "Sengaja menutup mata atau berpura-pura tidak tahu terhadap pelanggaran maupun tanda bahaya yang jelas terlihat.",
    examples: [
      {
        sentence:
          "Regulators can no longer **turn a blind eye** to undisclosed algorithmic pricing practices.",
        translation_id:
          "Regulator tidak bisa lagi **menutup mata** terhadap praktik penetapan harga algoritmik yang tidak transparan.",
        context: "Academic",
      },
      {
        sentence:
          "Managers who **turn a blind eye** to burnout eventually lose their sharpest engineers.",
        translation_id:
          "Manajer yang **mengabaikan begitu saja** kelelahan timnya cepat atau lambat akan kehilangan insinyur terbaiknya.",
        context: "Daily",
      },
    ],
    synonyms: ["look the other way", "overlook deliberately", "condone"],
    antonyms: ["hold accountable", "confront head-on", "scrutinize"],
    word_families: [{ word: "turn a blind eye", pos: "idiom" }],
    register: "Formal",
    source_tag: "article",
  },
  {
    term: "cut to the chase",
    cefr: "C1",
    type: "idiom",
    meaning_en:
      "To skip unnecessary preamble and address the most important point directly.",
    meaning_id:
      "Langsung ke inti pembicaraan tanpa bertele-tele atau basa-basi yang tidak perlu.",
    examples: [
      {
        sentence:
          "We only have ten minutes left, so let's **cut to the chase** and review the launch blockers.",
        translation_id:
          "Waktu kita tinggal sepuluh menit, jadi mari **langsung ke intinya** dan tinjau kendala peluncuran.",
        context: "Daily",
      },
      {
        sentence:
          "Strong executive summaries **cut to the chase** within the opening three sentences.",
        translation_id:
          "Ringkasan eksekutif yang kuat **langsung menyentuh pokok bahasan** dalam tiga kalimat pembuka.",
        context: "Daily",
      },
    ],
    synonyms: ["get straight to the point", "get down to brass tacks"],
    antonyms: ["beat around the bush", "ramble on"],
    word_families: [{ word: "cut to the chase", pos: "idiom" }],
    register: "Casual",
    source_tag: "film",
  },
  {
    term: "a double-edged sword",
    cefr: "C1",
    type: "idiom",
    meaning_en:
      "Something that brings significant advantages while simultaneously carrying serious drawbacks or risks.",
    meaning_id:
      "Pedang bermata dua; sesuatu yang memberi manfaat besar sekaligus membawa risiko atau kerugian yang sebanding.",
    examples: [
      {
        sentence:
          "Remote work is **a double-edged sword**: it boosts autonomy but can quietly erode spontaneous mentorship.",
        translation_id:
          "Kerja jarak jauh adalah **pedang bermata dua**: meningkatkan otonomi namun diam-diam mengikis bimbingan spontan.",
        context: "Daily",
      },
      {
        sentence:
          "Rapid urban tourism often proves **a double-edged sword** for historic port cities.",
        translation_id:
          "Pariwisata perkotaan yang pesat kerap menjadi **pedang bermata dua** bagi kota pelabuhan bersejarah.",
        context: "Academic",
      },
    ],
    synonyms: ["mixed blessing", "two-way trade-off"],
    antonyms: ["unmitigated good", "pure advantage"],
    word_families: [{ word: "a double-edged sword", pos: "idiom" }],
    register: "Formal",
    source_tag: "article",
  },
  {
    term: "pass the buck",
    cefr: "C2",
    type: "idiom",
    meaning_en:
      "To evade accountability by shifting blame or responsibility onto someone else.",
    meaning_id:
      "Lempar tanggung jawab; menghindari akuntabilitas dengan menyalahkan atau melimpahkan masalah ke pihak lain.",
    examples: [
      {
        sentence:
          "Rather than **passing the buck** to vendors, the director owned the outage openly.",
        translation_id:
          "Alih-alih **melempar kesalahan** ke vendor, direktur itu mengakui gangguan sistem secara terbuka.",
        context: "Daily",
      },
      {
        sentence:
          "Fragmented municipal governance makes it dangerously easy for agencies to **pass the buck**.",
        translation_id:
          "Tata kelola kota yang terpecah membuat berbagai lembaga terlalu mudah **saling lempar tanggung jawab**.",
        context: "Academic",
      },
    ],
    synonyms: ["shift blame", "shirk responsibility", "point fingers"],
    antonyms: ["take ownership", "step up", "shoulder responsibility"],
    word_families: [
      { word: "pass the buck", pos: "idiom" },
      { word: "buck-passing", pos: "n" },
    ],
    register: "Casual",
    source_tag: "lecture",
  },
  {
    term: "up in the air",
    cefr: "C1",
    type: "idiom",
    meaning_en:
      "Still undecided, unresolved, or uncertain because key conditions have not yet settled.",
    meaning_id:
      "Masih menggantung atau belum pasti karena keputusan dan faktor kuncinya belum ditetapkan.",
    examples: [
      {
        sentence:
          "Our summer conference venue is still **up in the air** while we wait on final budget sign-off.",
        translation_id:
          "Lokasi konferensi musim panas kami masih **menggantung/belum pasti** sambil menunggu persetujuan anggaran akhir.",
        context: "Daily",
      },
      {
        sentence:
          "Several trade exemptions remain **up in the air** ahead of next month's ministerial summit.",
        translation_id:
          "Beberapa pengecualian dagang masih **belum menemui kepastian** menjelang pertemuan menteri bulan depan.",
        context: "Academic",
      },
    ],
    synonyms: ["unresolved", "undecided", "in limbo"],
    antonyms: ["set in stone", "settled", "finalized"],
    word_families: [{ word: "up in the air", pos: "idiom" }],
    register: "Casual",
    source_tag: "film",
  },
  {
    term: "perspicacious",
    cefr: "C2",
    type: "vocab",
    meaning_en:
      "Having a remarkably sharp insight and swift understanding of subtle or complex matters.",
    meaning_id:
      "Sangat tajam daya tangkap dan wawasannya; cepat memahami hal-hal rumit atau tersirat.",
    examples: [
      {
        sentence:
          "Her **perspicacious** questioning exposed a subtle flaw in the forecast within minutes.",
        translation_id:
          "Pertanyaannya yang **tajam dan jeli** mengungkap cacat halus dalam proyeksi hanya dalam hitungan menit.",
        context: "Daily",
      },
      {
        sentence:
          "The monograph offers a **perspicacious** analysis of post-industrial labor mobility.",
        translation_id:
          "Monograf tersebut menyajikan analisis yang **sangat mendalam dan tajam** mengenai mobilitas tenaga kerja pascaindustri.",
        context: "Academic",
      },
    ],
    synonyms: ["astute", "discerning", "incisive"],
    antonyms: ["obtuse", "unobservant", "shortsighted"],
    word_families: [
      { word: "perspicacity", pos: "n" },
      { word: "perspicacious", pos: "adj" },
      { word: "perspicaciously", pos: "adv" },
    ],
    register: "Academic",
    source_tag: "book",
  },
  {
    term: "quintessential",
    cefr: "C2",
    type: "vocab",
    meaning_en:
      "Representing the purest, most iconic, or textbook example of a particular quality or class.",
    meaning_id:
      "Contoh paling murni, ikonik, atau representatif sempurna dari suatu kualitas atau kategori.",
    examples: [
      {
        sentence:
          "The corner espresso bar became the **quintessential** neighborhood hangout for freelancers.",
        translation_id:
          "Kedai espresso di sudut jalan itu menjadi tempat nongkrong lingkungan yang **paling ikonik** bagi pekerja lepas.",
        context: "Daily",
      },
      {
        sentence:
          "Antibiotic resistance is a **quintessential** collective-action problem in global health.",
        translation_id:
          "Resistensi antibiotik adalah contoh **paling klasik dan representatif** dari persoalan aksi kolektif dalam kesehatan global.",
        context: "Academic",
      },
    ],
    synonyms: ["archetypal", "epitomizing", "definitive"],
    antonyms: ["atypical", "uncharacteristic", "anomalous"],
    word_families: [
      { word: "quintessence", pos: "n" },
      { word: "quintessential", pos: "adj" },
      { word: "quintessentially", pos: "adv" },
    ],
    register: "Academic",
    source_tag: "book",
  },
  {
    term: "fastidious",
    cefr: "C2",
    type: "vocab",
    meaning_en:
      "Very attentive to accuracy and tiny details; difficult to satisfy unless standards are spotless.",
    meaning_id:
      "Sangat teliti, perfeksionis terhadap detail kecil, dan selektif pada standar kualitas.",
    examples: [
      {
        sentence:
          "Our lead typographer is **fastidious** about kerning and baseline rhythm on every screen.",
        translation_id:
          "Tipografer utama kami sangat **teliti hingga detail terkecil** soal jarak huruf dan ritme tata letak di tiap layar.",
        context: "Daily",
      },
      {
        sentence:
          "**Fastidious** archival documentation allowed historians to reconstruct the maritime trade ledger.",
        translation_id:
          "Dokumentasi arsip yang **sangat cermat dan teliti** memungkinkan sejarawan merekonstruksi buku dagang maritim.",
        context: "Academic",
      },
    ],
    synonyms: ["meticulous", "scrupulous", "exacting"],
    antonyms: ["sloppy", "careless", "slipshod"],
    word_families: [
      { word: "fastidious", pos: "adj" },
      { word: "fastidiously", pos: "adv" },
      { word: "fastidiousness", pos: "n" },
    ],
    register: "Formal",
    source_tag: "book",
  },
  {
    term: "intransigent",
    cefr: "C2",
    type: "vocab",
    meaning_en:
      "Stubbornly unwilling to compromise, negotiate, or alter an entrenched viewpoint.",
    meaning_id:
      "Keras kepala dan tidak mau berkompromi sedikit pun terhadap pendirian atau posisinya.",
    examples: [
      {
        sentence:
          "Negotiations stalled because neither faction would budge from its **intransigent** stance.",
        translation_id:
          "Negosiasi macet karena tak satu pun faksi mau bergeser dari sikapnya yang **tak mau berkompromi**.",
        context: "Daily",
      },
      {
        sentence:
          "An **intransigent** regulatory regime delayed cross-border renewable grid integration.",
        translation_id:
          "Rezim regulasi yang **kaku dan tak kenal kompromi** menunda integrasi jaringan energi terbarukan lintas batas.",
        context: "Academic",
      },
    ],
    synonyms: ["uncompromising", "inflexible", "unyielding"],
    antonyms: ["accommodating", "conciliatory", "flexible"],
    word_families: [
      { word: "intransigence", pos: "n" },
      { word: "intransigent", pos: "adj" },
      { word: "intransigently", pos: "adv" },
    ],
    register: "Academic",
    source_tag: "article",
  },
  {
    term: "exacerbate",
    cefr: "C1",
    type: "vocab",
    meaning_en:
      "To make an existing problem, tension, or negative condition noticeably worse.",
    meaning_id:
      "Memperburuk atau memperparah masalah, ketegangan, maupun kondisi negatif yang sudah ada.",
    examples: [
      {
        sentence:
          "Skipping sleep to finish slides will only **exacerbate** your stage anxiety tomorrow.",
        translation_id:
          "Begadang demi menyelesaikan slide hanya akan **memperparah** rasa gugupmu di panggung besok.",
        context: "Daily",
      },
      {
        sentence:
          "Prolonged drought can **exacerbate** food-price volatility across import-dependent regions.",
        translation_id:
          "Kekeringan berkepanjangan dapat **memperburuk** gejolak harga pangan di wilayah yang bergantung pada impor.",
        context: "Academic",
      },
    ],
    synonyms: ["aggravate", "intensify", "compound"],
    antonyms: ["mitigate", "alleviate", "ameliorate"],
    word_families: [
      { word: "exacerbate", pos: "v" },
      { word: "exacerbation", pos: "n" },
    ],
    register: "Academic",
    source_tag: "lecture",
  },
  {
    term: "warrant scrutiny",
    cefr: "C2",
    type: "collocation",
    meaning_en:
      "To justify careful, critical inspection because of notable stakes, anomalies, or claims.",
    meaning_id:
      "Layak mendapatkan pemeriksaan kritis dan pengawasan mendalam karena taruhan atau kejanggalannya.",
    examples: [
      {
        sentence:
          "Any vendor promising zero-risk returns should immediately **warrant scrutiny**.",
        translation_id:
          "Vendor mana pun yang menjanjikan imbal hasil tanpa risiko harus segera **mendapat pemeriksaan ketat**.",
        context: "Daily",
      },
      {
        sentence:
          "Unexplained outliers in the clinical dataset **warrant scrutiny** prior to publication.",
        translation_id:
          "Data pencilan yang tak terjelaskan dalam dataset klinis **layak ditelaah secara kritis** sebelum publikasi.",
        context: "Academic",
      },
    ],
    synonyms: ["merit close inspection", "justify examination", "deserve review"],
    antonyms: ["pass without question", "escape notice"],
    word_families: [
      { word: "warrant", pos: "v" },
      { word: "scrutiny", pos: "n" },
      { word: "scrutinize", pos: "v" },
    ],
    register: "Academic",
    source_tag: "article",
  },
  {
    term: "galvanize support",
    cefr: "C2",
    type: "collocation",
    meaning_en:
      "To energize and rally people into decisive collective backing or urgent action.",
    meaning_id:
      "Menggerakkan, membangkitkan semangat, dan menyatukan dukungan kolektif secara cepat dan kuat.",
    examples: [
      {
        sentence:
          "Her candid town-hall speech managed to **galvanize support** for the neighborhood library rebuild.",
        translation_id:
          "Pidatonya yang lugas di balai warga berhasil **menggalang dukungan besar** untuk pembangunan ulang perpustakaan lingkungan.",
        context: "Daily",
      },
      {
        sentence:
          "Visual climate simulations helped **galvanize support** among reluctant regional delegates.",
        translation_id:
          "Simulasi visual iklim membantu **membangkitkan dukungan nyata** di kalangan delegasi daerah yang awalnya ragu.",
        context: "Academic",
      },
    ],
    synonyms: ["rally backing", "mobilize allies", "spur momentum"],
    antonyms: ["alienate supporters", "dampen enthusiasm"],
    word_families: [
      { word: "galvanize", pos: "v" },
      { word: "galvanizing", pos: "adj" },
      { word: "support", pos: "n" },
    ],
    register: "Formal",
    source_tag: "lecture",
  },
  {
    term: "yield dividends",
    cefr: "C1",
    type: "collocation",
    meaning_en:
      "To pay off handsomely over time, producing lasting strategic or personal gains.",
    meaning_id:
      "Membuahkan imbal hasil berharga dan keuntungan jangka panjang setelah upaya konsisten.",
    examples: [
      {
        sentence:
          "Investing ten minutes a day in spaced repetition will **yield dividends** before your IELTS test.",
        translation_id:
          "Berinvestasi sepuluh menit sehari pada pengulangan berjarak akan **membuahkan hasil besar** sebelum tes IELTS-mu.",
        context: "Daily",
      },
      {
        sentence:
          "Early investments in modular infrastructure continue to **yield dividends** a decade later.",
        translation_id:
          "Investasi awal pada infrastruktur modular terus **menghasilkan manfaat strategis** satu dekade kemudian.",
        context: "Academic",
      },
    ],
    synonyms: ["pay off handsomely", "bear fruit", "reap lasting rewards"],
    antonyms: ["fall flat", "produce no return"],
    word_families: [
      { word: "yield", pos: "v" },
      { word: "dividend", pos: "n" },
    ],
    register: "Formal",
    source_tag: "article",
  },
];

export const FALLBACK_SUGGESTED_WORDS: SuggestedWordItem[] =
  RAW_FALLBACK_SUGGESTED_WORDS.map(attachMetadata);
