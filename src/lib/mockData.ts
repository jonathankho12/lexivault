import type {
  AutofillPayload,
  DiscoveryItem,
  WordEntry,
} from "@/types/lexivault";
import { BUILT_IN_PRONUNCIATIONS } from "@/lib/pronunciation";
import { normalizeTermKey, shiftDateString } from "@/lib/utils";

function attachPronunciation<
  T extends { term: string; pronunciation?: string; ipa?: string },
>(item: T): T {
  const info = BUILT_IN_PRONUNCIATIONS[normalizeTermKey(item.term)];
  if (!info) return item;
  return {
    ...item,
    pronunciation: item.pronunciation || info.pronunciation,
    ipa: item.ipa || info.ipa,
  };
}

export function buildInitialMockWords(todayStr: string): WordEntry[] {
  const ts = (daysAgo: number, hour = 14) => {
    const dateStr = shiftDateString(todayStr, -daysAgo);
    return `${dateStr}T${String(hour).padStart(2, "0")}:20:00.000Z`;
  };

  const baseWords: WordEntry[] = [
    {
      id: "mock-word-01",
      term: "gentrified",
      type: "vocab",
      meaning_id:
        "Mengalami gentrifikasi; berubah menjadi kawasan yang lebih elit dan mahal sehingga penduduk asli berpenghasilan rendah tergeser.",
      examples_json: [
        {
          sentence:
            "This once-affordable arts district has rapidly **gentrified**, pricing out local families and small bakeries.",
          translation_id:
            "Kawasan seni yang dulunya terjangkau ini cepat mengalami **gentrifikasi**, membuat keluarga lokal dan toko roti kecil tersingkir karena harga naik.",
          context: "Daily",
        },
        {
          sentence:
            "Urban sociologists examine how **gentrified** neighborhoods alter long-standing civic participation and public transit demand.",
          translation_id:
            "Sosiolog perkotaan meneliti bagaimana lingkungan yang telah **tergentrifikasi** mengubah partisipasi warga dan permintaan transportasi publik.",
          context: "Academic",
        },
      ],
      synonyms: ["upscaled", "revitalized", "bourgeoisified"],
      antonyms: ["impoverished", "blighted", "neglected"],
      word_families_json: [
        { word: "gentrify", pos: "v" },
        { word: "gentrification", pos: "n" },
        { word: "gentrified", pos: "adj" },
        { word: "gentrifier", pos: "n" },
      ],
      register: "Academic",
      source_tag: "Artikel",
      correct_count: 5,
      wrong_count: 1,
      last_practiced_at: ts(1),
      created_at: ts(0, 10),
    },
    {
      id: "mock-word-02",
      term: "ubiquitous",
      type: "vocab",
      meaning_id:
        "Ada di mana-mana secara bersamaan; sangat umum ditemui hingga terasa melekat dalam keseharian.",
      examples_json: [
        {
          sentence:
            "QR code menus have become **ubiquitous** in urban cafés over the past three years.",
          translation_id:
            "Menu kode QR kini **ada di mana-mana** di kafe-kafe perkotaan selama tiga tahun terakhir.",
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
      register: "Academic",
      source_tag: "Kuliah",
      correct_count: 3,
      wrong_count: 3,
      last_practiced_at: ts(1),
      created_at: ts(1, 11),
    },
    {
      id: "mock-word-03",
      term: "pragmatic",
      type: "vocab",
      meaning_id:
        "Pragmatis; bersikap realistis dan fokus pada solusi yang benar-benar bisa diterapkan secara praktis.",
      examples_json: [
        {
          sentence:
            "Instead of chasing perfection, the engineering lead took a **pragmatic** approach to ship on time.",
          translation_id:
            "Alih-alih mengejar kesempurnaan, pimpinan tim teknik mengambil pendekatan **pragmatis** agar rilis tepat waktu.",
          context: "Daily",
        },
        {
          sentence:
            "Policymakers proposed a **pragmatic** framework balancing fiscal restraint with green subsidies.",
          translation_id:
            "Para pembuat kebijakan mengusulkan kerangka kerja **pragmatis** yang menyeimbangkan kendali fiskal dan subsidi hijau.",
          context: "Academic",
        },
      ],
      synonyms: ["practical", "realistic", "sensible"],
      antonyms: ["idealistic", "impractical", "quixotic"],
      word_families_json: [
        { word: "pragmatism", pos: "n" },
        { word: "pragmatist", pos: "n" },
        { word: "pragmatic", pos: "adj" },
        { word: "pragmatically", pos: "adv" },
      ],
      register: "Formal",
      source_tag: "Buku",
      correct_count: 7,
      wrong_count: 1,
      last_practiced_at: ts(2),
      created_at: ts(2, 16),
    },
    {
      id: "mock-word-04",
      term: "ephemeral",
      type: "vocab",
      meaning_id:
        "Fana atau sementara; hanya bertahan dalam waktu yang sangat singkat sebelum memudar.",
      examples_json: [
        {
          sentence:
            "Viral internet fame is notoriously **ephemeral**; people move on within days.",
          translation_id:
            "Ketenaran viral di internet terkenal sangat **singkat/fana**; orang cepat beralih dalam hitungan hari.",
          context: "Daily",
        },
        {
          sentence:
            "The exhibition captures the **ephemeral** beauty of morning mist over volcanic lakes.",
          translation_id:
            "Pameran itu mengabadikan keindahan **sesaat** kabut pagi di atas danau vulkanik.",
          context: "Academic",
        },
      ],
      synonyms: ["transient", "fleeting", "short-lived"],
      antonyms: ["permanent", "enduring", "perpetual"],
      word_families_json: [
        { word: "ephemera", pos: "n" },
        { word: "ephemerality", pos: "n" },
        { word: "ephemeral", pos: "adj" },
        { word: "ephemerally", pos: "adv" },
      ],
      register: "Academic",
      source_tag: "Buku",
      correct_count: 2,
      wrong_count: 4,
      last_practiced_at: ts(1),
      created_at: ts(3, 9),
    },
    {
      id: "mock-word-05",
      term: "mitigate",
      type: "vocab",
      meaning_id:
        "Meringankan atau meminimalkan tingkat keparahan risiko, dampak buruk, maupun rasa sakit.",
      examples_json: [
        {
          sentence:
            "Installing storm shutters helped **mitigate** water damage during the typhoon.",
          translation_id:
            "Memasang penutup jendela badai membantu **mengurangi** kerusakan akibat air saat topan.",
          context: "Daily",
        },
        {
          sentence:
            "Diversifying supply chains is essential to **mitigate** geopolitical disruptions.",
          translation_id:
            "Mendiversifikasi rantai pasok penting untuk **memitigasi** gangguan geopolitik.",
          context: "Academic",
        },
      ],
      synonyms: ["alleviate", "lessen", "attenuate"],
      antonyms: ["aggravate", "exacerbate", "intensify"],
      word_families_json: [
        { word: "mitigate", pos: "v" },
        { word: "mitigation", pos: "n" },
        { word: "mitigating", pos: "adj" },
        { word: "mitigable", pos: "adj" },
      ],
      register: "Formal",
      source_tag: "Kuliah",
      correct_count: 6,
      wrong_count: 2,
      last_practiced_at: ts(2),
      created_at: ts(4, 15),
    },
    {
      id: "mock-word-06",
      term: "nuanced",
      type: "vocab",
      meaning_id:
        "Penuh nuansa halus; mempertimbangkan detail dan sudut pandang kompleks, bukan hitam-putih.",
      examples_json: [
        {
          sentence:
            "The documentary offered a surprisingly **nuanced** portrait of small-town politics.",
          translation_id:
            "Film dokumenter itu menyajikan gambaran politik kota kecil yang kaya **nuansa** secara mengejutkan.",
          context: "Daily",
        },
        {
          sentence:
            "A **nuanced** reading of the treaty reveals subtle concessions from both parties.",
          translation_id:
            "Pembacaan perjanjian yang **mendalam dan bernuansa** mengungkap konsesi halus dari kedua pihak.",
          context: "Academic",
        },
      ],
      synonyms: ["subtle", "layered", "sophisticated"],
      antonyms: ["simplistic", "blunt", "one-dimensional"],
      word_families_json: [
        { word: "nuance", pos: "n" },
        { word: "nuance", pos: "v" },
        { word: "nuanced", pos: "adj" },
      ],
      register: "Academic",
      source_tag: "Artikel",
      correct_count: 8,
      wrong_count: 1,
      last_practiced_at: ts(3),
      created_at: ts(5, 13),
    },
    {
      id: "mock-word-07",
      term: "ambivalent",
      type: "vocab",
      meaning_id:
        "Ambivalen; memiliki perasaan campur aduk atau ragu-ragu karena dua sikap yang saling bertentangan.",
      examples_json: [
        {
          sentence:
            "She felt **ambivalent** about relocating abroad—thrilled by the job yet anxious about leaving family.",
          translation_id:
            "Ia merasa **bimbang/campur aduk** soal pindah ke luar negeri—antusias dengan pekerjaannya namun cemas meninggalkan keluarga.",
          context: "Daily",
        },
        {
          sentence:
            "Voters remained **ambivalent** toward the infrastructure bill despite broad media coverage.",
          translation_id:
            "Para pemilih tetap **mendua** terhadap rancangan undang-undang infrastruktur meski liputan media masif.",
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
      register: "Formal",
      source_tag: "Film",
      correct_count: 2,
      wrong_count: 3,
      last_practiced_at: ts(1),
      created_at: ts(6, 19),
    },
    {
      id: "mock-word-08",
      term: "resilient",
      type: "vocab",
      meaning_id:
        "Tangguh dan cepat pulih; mampu bangkit kembali setelah menghadapi tekanan atau krisis.",
      examples_json: [
        {
          sentence:
            "Coastal mangroves form a **resilient** natural barrier against rising tides.",
          translation_id:
            "Hutan bakau pesisir membentuk benteng alami yang **tangguh** terhadap kenaikan pasang laut.",
          context: "Daily",
        },
        {
          sentence:
            "Organizations with decentralized decision-making proved more **resilient** during market shocks.",
          translation_id:
            "Organisasi dengan pengambilan keputusan terdesentralisasi terbukti lebih **tahan banting** saat guncangan pasar.",
          context: "Academic",
        },
      ],
      synonyms: ["adaptable", "hardy", "buoyant"],
      antonyms: ["fragile", "brittle", "vulnerable"],
      word_families_json: [
        { word: "resilience", pos: "n" },
        { word: "resiliency", pos: "n" },
        { word: "resilient", pos: "adj" },
        { word: "resiliently", pos: "adv" },
      ],
      register: "Formal",
      source_tag: "Artikel",
      correct_count: 9,
      wrong_count: 0,
      last_practiced_at: ts(2),
      created_at: ts(7, 12),
    },
    {
      id: "mock-word-09",
      term: "bite the bullet",
      type: "idiom",
      meaning_id:
        "Memberanikan diri menghadapi situasi sulit atau tidak menyenangkan yang sudah tak bisa dihindari lagi.",
      examples_json: [
        {
          sentence:
            "After months of putting off dental surgery, I finally had to **bite the bullet** and book an appointment.",
          translation_id:
            "Setelah berbulan-bulan menunda operasi gigi, akhirnya aku harus **memberanikan diri menghadapinya** dan membuat janji.",
          context: "Daily",
        },
        {
          sentence:
            "The startup decided to **bite the bullet** and rewrite its legacy billing engine from scratch.",
          translation_id:
            "Startup itu memutuskan untuk **mengambil langkah pahit namun perlu** dengan menulis ulang sistem penagihan lamanya dari awal.",
          context: "Daily",
        },
      ],
      synonyms: ["face the music", "grit one's teeth", "take the plunge"],
      antonyms: ["chicken out", "procrastinate", "evade"],
      word_families_json: [
        { word: "bite the bullet", pos: "idiom" },
        { word: "biting the bullet", pos: "phr" },
      ],
      register: "Casual",
      source_tag: "Film",
      correct_count: 6,
      wrong_count: 1,
      last_practiced_at: ts(2),
      created_at: ts(2, 20),
    },
    {
      id: "mock-word-10",
      term: "burn the midnight oil",
      type: "idiom",
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
            "Medical residents often **burn the midnight oil** preparing case notes before morning rounds.",
          translation_id:
            "Dokter residen sering **bekerja hingga larut malam** menyiapkan catatan kasus sebelum visite pagi.",
          context: "Daily",
        },
      ],
      synonyms: ["pull an all-nighter", "work late", "toil"],
      antonyms: ["slack off", "call it a day", "turn in early"],
      word_families_json: [
        { word: "burn the midnight oil", pos: "idiom" },
      ],
      register: "Casual",
      source_tag: "Film",
      correct_count: 5,
      wrong_count: 2,
      last_practiced_at: ts(3),
      created_at: ts(4, 21),
    },
    {
      id: "mock-word-11",
      term: "cut corners",
      type: "idiom",
      meaning_id:
        "Mengambil jalan pintas dengan mengorbankan kualitas atau prosedur standar demi menghemat waktu atau biaya.",
      examples_json: [
        {
          sentence:
            "Never **cut corners** on safety inspections just to hit a quarterly deadline.",
          translation_id:
            "Jangan pernah **mengambil jalan pintas murahan** pada inspeksi keselamatan hanya demi mengejar tenggat kuartal.",
          context: "Daily",
        },
        {
          sentence:
            "Auditors discovered the contractor had **cut corners** by substituting cheaper insulation materials.",
          translation_id:
            "Auditor menemukan kontraktor tersebut telah **mengurangi standar kualitas** dengan mengganti material insulasi yang lebih murah.",
          context: "Academic",
        },
      ],
      synonyms: ["skimp", "take shortcuts", "compromise quality"],
      antonyms: ["go by the book", "be thorough", "spare no expense"],
      word_families_json: [
        { word: "cut corners", pos: "idiom" },
        { word: "corner-cutting", pos: "n" },
      ],
      register: "Casual",
      source_tag: "Kuliah",
      correct_count: 4,
      wrong_count: 0,
      last_practiced_at: ts(4),
      created_at: ts(5, 17),
    },
    {
      id: "mock-word-12",
      term: "play devil's advocate",
      type: "idiom",
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
      register: "Casual",
      source_tag: "Kuliah",
      correct_count: 1,
      wrong_count: 3,
      last_practiced_at: ts(1),
      created_at: ts(6, 14),
    },
    {
      id: "mock-word-13",
      term: "get out of hand",
      type: "idiom",
      meaning_id:
        "Menjadi tidak terkendali lagi; lepas kendali dan makin memburuk.",
      examples_json: [
        {
          sentence:
            "What started as a friendly debate in the group chat quickly **got out of hand**.",
          translation_id:
            "Yang awalnya debat ramah di grup obrolan dengan cepat **lepas kendali**.",
          context: "Daily",
        },
        {
          sentence:
            "Without clear scope boundaries, software projects easily **get out of hand**.",
          translation_id:
            "Tanpa batasan ruang lingkup yang jelas, proyek perangkat lunak mudah **tidak terkendali**.",
          context: "Daily",
        },
      ],
      synonyms: ["spiral out of control", "escalate", "run wild"],
      antonyms: ["stay in check", "remain contained", "be under control"],
      word_families_json: [{ word: "get out of hand", pos: "idiom" }],
      register: "Casual",
      source_tag: "Film",
      correct_count: 5,
      wrong_count: 0,
      last_practiced_at: ts(4),
      created_at: ts(8, 18),
    },
    {
      id: "mock-word-14",
      term: "make a compelling case",
      type: "collocation",
      meaning_id:
        "Menyampaikan argumen yang sangat kuat, logis, dan meyakinkan didukung bukti.",
      examples_json: [
        {
          sentence:
            "Her presentation **made a compelling case** for shifting 30% of our budget to retention.",
          translation_id:
            "Presentasinya **memberikan argumen yang sangat meyakinkan** untuk mengalihkan 30% anggaran ke retensi pengguna.",
          context: "Daily",
        },
        {
          sentence:
            "The researchers **make a compelling case** that sleep deprivation impairs moral reasoning.",
          translation_id:
            "Para peneliti **mengajukan argumen kuat** bahwa kurang tidur mengganggu penalaran moral.",
          context: "Academic",
        },
      ],
      synonyms: ["present a persuasive argument", "build a strong case"],
      antonyms: ["offer a weak excuse", "undermine one's argument"],
      word_families_json: [
        { word: "compelling", pos: "adj" },
        { word: "compel", pos: "v" },
        { word: "compellingly", pos: "adv" },
      ],
      register: "Formal",
      source_tag: "Artikel",
      correct_count: 4,
      wrong_count: 1,
      last_practiced_at: ts(2),
      created_at: ts(3, 11),
    },
    {
      id: "mock-word-15",
      term: "strike a balance",
      type: "collocation",
      meaning_id:
        "Mencapai titik keseimbangan yang adil atau tepat di antara dua hal yang saling tarik-menarik.",
      examples_json: [
        {
          sentence:
            "Great mobile apps **strike a balance** between visual richness and battery efficiency.",
          translation_id:
            "Aplikasi seluler yang hebat **menemukan keseimbangan** antara kekayaan visual dan efisiensi baterai.",
          context: "Daily",
        },
        {
          sentence:
            "Regulators must **strike a balance** between fostering AI innovation and protecting consumer privacy.",
          translation_id:
            "Regulator harus **menjaga titik imbang** antara mendorong inovasi AI dan melindungi privasi konsumen.",
          context: "Academic",
        },
      ],
      synonyms: ["find middle ground", "reconcile", "calibrate"],
      antonyms: ["lean to one extreme", "skew", "polarize"],
      word_families_json: [
        { word: "strike a balance", pos: "collocation" },
        { word: "balanced", pos: "adj" },
      ],
      register: "Formal",
      source_tag: "Buku",
      correct_count: 7,
      wrong_count: 1,
      last_practiced_at: ts(3),
      created_at: ts(7, 9),
    },
    {
      id: "mock-word-16",
      term: "bear the brunt",
      type: "collocation",
      meaning_id:
        "Menanggung dampak terberat atau konsekuensi paling parah dari suatu masalah atau peristiwa.",
      examples_json: [
        {
          sentence:
            "Small island nations **bear the brunt** of rising sea levels despite minimal emissions.",
          translation_id:
            "Negara-negara pulau kecil **menanggung dampak paling parah** kenaikan permukaan laut meski emisinya minim.",
          context: "Academic",
        },
        {
          sentence:
            "Customer support agents always **bear the brunt** of users' frustration during an outage.",
          translation_id:
            "Staf layanan pelanggan selalu **menanggung imbas terberat** dari rasa frustrasi pengguna saat gangguan layanan.",
          context: "Daily",
        },
      ],
      synonyms: ["shoulder the burden", "take the hardest hit", "absorb the shock"],
      antonyms: ["escape unscathed", "be shielded from"],
      word_families_json: [
        { word: "bear the brunt", pos: "collocation" },
        { word: "brunt", pos: "n" },
      ],
      register: "Formal",
      source_tag: "Artikel",
      correct_count: 2,
      wrong_count: 4,
      last_practiced_at: ts(1),
      created_at: ts(5, 8),
    },
    {
      id: "mock-word-17",
      term: "spark a debate",
      type: "collocation",
      meaning_id:
        "Memicu perdebatan luas atau diskusi hangat di kalangan publik maupun akademisi.",
      examples_json: [
        {
          sentence:
            "The new four-day workweek trial **sparked a debate** across tech companies nationwide.",
          translation_id:
            "Uji coba empat hari kerja seminggu yang baru itu **memicu perdebatan** di berbagai perusahaan teknologi nasional.",
          context: "Daily",
        },
        {
          sentence:
            "Her essay **sparked a debate** over whether algorithmic curation erodes shared cultural touchstones.",
          translation_id:
            "Esainya **memicu diskursus sengit** mengenai apakah kurasi algoritmik mengikis referensi budaya bersama.",
          context: "Academic",
        },
      ],
      synonyms: ["ignite discussion", "provoke controversy", "trigger debate"],
      antonyms: ["settle an issue", "quell dissent", "end discussion"],
      word_families_json: [
        { word: "spark", pos: "v" },
        { word: "debate", pos: "n" },
      ],
      register: "Formal",
      source_tag: "Artikel",
      correct_count: 6,
      wrong_count: 0,
      last_practiced_at: ts(5),
      created_at: ts(9, 15),
    },
    {
      id: "mock-word-18",
      term: "draw a parallel",
      type: "collocation",
      meaning_id:
        "Menarik garis persamaan atau membandingkan kemiripan antara dua situasi yang berbeda.",
      examples_json: [
        {
          sentence:
            "Historians often **draw a parallel** between the printing press revolution and modern generative AI.",
          translation_id:
            "Sejarawan kerap **menarik perbandingan sejajar** antara revolusi mesin cetak dan AI generatif modern.",
          context: "Academic",
        },
        {
          sentence:
            "In his speech, he **drew a parallel** between marathon training and building lasting habits.",
          translation_id:
            "Dalam pidatonya, ia **membuat analogi sejajar** antara latihan maraton dan membangun kebiasaan jangka panjang.",
          context: "Daily",
        },
      ],
      synonyms: ["compare", "liken", "establish an analogy"],
      antonyms: ["draw a contrast", "differentiate", "distinguish"],
      word_families_json: [
        { word: "parallel", pos: "n" },
        { word: "parallel", pos: "adj" },
        { word: "parallel", pos: "v" },
      ],
      register: "Academic",
      source_tag: "Kuliah",
      correct_count: 3,
      wrong_count: 2,
      last_practiced_at: ts(2),
      created_at: ts(4, 10),
    },
  ];

  return baseWords.map(attachPronunciation);
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
  RAW_FALLBACK_DISCOVERY_PACKS.map((pack) => pack.map(attachPronunciation));

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
    return attachPronunciation(directMatch);
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

  const stem = cleanTerm.replace(/(ed|ing|ly|es|s)$/i, "");
  const families =
    inferredType === "vocab" && stem.length >= 3
      ? [
          { word: cleanTerm, pos: cleanTerm.endsWith("ly") ? "adv" : "n/v" },
          { word: `${stem}ed`, pos: "adj" },
          { word: `${stem}tion`, pos: "n" },
        ]
      : [{ word: cleanTerm, pos: inferredType }];

  return attachPronunciation({
    term: cleanTerm,
    type: inferredType,
    meaning_id: `Ungkapan/kata "${cleanTerm}" dalam konteks bahasa Inggris modern (mode offline — sambungkan GEMINI_API_KEY untuk definisi AI penuh).`,
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
