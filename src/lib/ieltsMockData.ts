import type {
  CommuteListeningClip,
  ListeningSectionPack,
  PlacementQuestion,
  ReadingPassagePack,
  SpeakingPromptPack,
  WritingTaskPack,
} from "@/types/ielts";

const PLACEMENT_MINI_PASSAGE =
  "Over the past decade, mid-sized municipalities have increasingly turned to 'sponge city' infrastructure—permeable pavements, sunken bioswales, and restored urban wetlands—to manage flash flooding. Unlike conventional concrete drainage, which accelerates storm runoff into overloaded rivers, sponge designs absorb rainwater directly into aquifers. Critics initially questioned retrofitting costs in dense historic cores, yet longitudinal audits in Copenhagen and Wuhan indicate that avoided flood-insurance payouts typically offset capital expenditure within eight to twelve years.";

export const PLACEMENT_TEST_QUESTIONS: PlacementQuestion[] = [
  {
    id: "pl-1",
    category: "vocab_grammar",
    cefrTarget: "A2",
    prompt:
      "Choose the most natural option: 'Although the lecture was long, the students _____ attentive until the end.'",
    options: ["remained", "were remaining", "have remain", "staying"],
    correctAnswer: "remained",
    explanation_id:
      "'Remained' adalah linking verb past simple yang paling alami untuk kondisi di masa lampau.",
  },
  {
    id: "pl-2",
    category: "vocab_grammar",
    cefrTarget: "B1",
    prompt:
      "Choose the closest academic synonym for 'reduce the severity of' in policy writing:",
    options: ["mitigate", "escalate", "procrastinate", "resemble"],
    correctAnswer: "mitigate",
    explanation_id:
      "'Mitigate' berarti mengurangi tingkat keparahan dampak atau risiko.",
  },
  {
    id: "pl-3",
    category: "vocab_grammar",
    cefrTarget: "B2",
    prompt:
      "Complete the sentence: 'Had the research team checked the calibration earlier, the error _____ avoided.'",
    options: [
      "would have been",
      "will have been",
      "would be",
      "had been",
    ],
    correctAnswer: "would have been",
    explanation_id:
      "Inversi Third Conditional ('Had + S + V3, S + would have + V3') digunakan untuk pengandaian masa lalu.",
  },
  {
    id: "pl-4",
    category: "vocab_grammar",
    cefrTarget: "C1",
    prompt:
      "Select the most precise collocation: 'Empirical trials _____ compelling evidence against the early hypothesis.'",
    options: ["yielded", "made", "did", "struck"],
    correctAnswer: "yielded",
    explanation_id:
      "Dalam bahasa akademik C1/C2, kolokasi baku untuk menghasilkan bukti/temuan riset adalah 'yield evidence/results'.",
  },
  {
    id: "pl-5",
    category: "reading",
    cefrTarget: "B1",
    passage: PLACEMENT_MINI_PASSAGE,
    prompt:
      "According to the passage, how does conventional concrete drainage differ from sponge city infrastructure?",
    options: [
      "It pushes storm runoff rapidly into rivers rather than absorbing water locally.",
      "It costs significantly less to retrofit in historic districts.",
      "It restores urban wetlands alongside aquifers.",
      "It prevents insurance claims for up to twelve years.",
    ],
    correctAnswer:
      "It pushes storm runoff rapidly into rivers rather than absorbing water locally.",
    explanation_id:
      "Teks menyatakan concrete drainage 'accelerates storm runoff into overloaded rivers', berlawanan dengan desain sponge yang menyerap air ke akuifer.",
  },
  {
    id: "pl-6",
    category: "reading",
    cefrTarget: "B2",
    passage: PLACEMENT_MINI_PASSAGE,
    prompt:
      "TRUE, FALSE, or NOT GIVEN: 'Every European capital has already replaced its concrete drainage with sponge designs.'",
    options: ["TRUE", "FALSE", "NOT GIVEN"],
    correctAnswer: "NOT GIVEN",
    explanation_id:
      "Teks hanya menyebut kota berukuran sedang secara umum serta Copenhagen dan Wuhan, bukan seluruh ibu kota Eropa.",
  },
  {
    id: "pl-7",
    category: "reading",
    cefrTarget: "C1",
    passage: PLACEMENT_MINI_PASSAGE,
    prompt:
      "What does the author imply by citing 'longitudinal audits in Copenhagen and Wuhan'?",
    options: [
      "Long-term financial evidence weakens early cost criticisms.",
      "Only Asian and Nordic climates can sustain permeable pavements.",
      "Historic city cores should avoid bioswale retrofitting altogether.",
      "Flood insurance companies directly fund municipal drainage projects.",
    ],
    correctAnswer:
      "Long-term financial evidence weakens early cost criticisms.",
    explanation_id:
      "Kata 'yet' setelah kritik biaya menunjukkan data jangka panjang membuktikan penghematan asuransi menutupi biaya modal.",
  },
  {
    id: "pl-8",
    category: "listening",
    cefrTarget: "B2",
    audioSegments: [
      {
        speaker: "Advisor",
        accent: "GB_F",
        text: "Good morning. Before you submit the field-trip form, note that the coastal survey departure has moved from Platform Four to Gate Seven because of track maintenance.",
      },
      {
        speaker: "Student",
        accent: "AU_M",
        text: "Got it, Gate Seven. And should we bring our own soil kits or collect them at the harbour?",
      },
      {
        speaker: "Advisor",
        accent: "GB_F",
        text: "Collect them at the harbour office—they're already labelled with your lab group numbers.",
      },
    ],
    prompt:
      "Where will the students now depart from, and where do they collect their soil kits?",
    options: [
      "Gate Seven; harbour office",
      "Platform Four; harbour office",
      "Gate Seven; university lab",
      "Platform Four; coastal station",
    ],
    correctAnswer: "Gate Seven; harbour office",
    explanation_id:
      "Pembicara Inggris menyebut keberangkatan pindah dari Platform Four ke Gate Seven, dan peralatan diambil di harbour office.",
  },
  {
    id: "pl-9",
    category: "listening",
    cefrTarget: "C1",
    audioSegments: [
      {
        speaker: "Lecturer",
        accent: "AU_F",
        text: "While many assume ancient Polynesians drifted across the Pacific by chance, computer wind-modeling combined with experimental voyaging proves they executed deliberate two-way expeditions, reading swell refraction off distant atolls.",
      },
    ],
    prompt:
      "What key point does the Australian lecturer emphasize about ancient Polynesian navigation?",
    options: [
      "Voyages were intentional two-way journeys guided by wave patterns.",
      "Early navigators relied purely on accidental ocean currents.",
      "Modern GPS tools fail to model Pacific swell refraction.",
      "Atolls prevented sailors from returning to their home islands.",
    ],
    correctAnswer:
      "Voyages were intentional two-way journeys guided by wave patterns.",
    explanation_id:
      "Dosen menekankan ekspedisi dilakukan secara sengaja ('deliberate two-way expeditions') dengan membaca pembiasan gelombang ('swell refraction').",
  },
  {
    id: "pl-10",
    category: "writing_paraphrase",
    cefrTarget: "C2",
    originalSentence:
      "Governments should invest more money in public transport so that fewer people use private cars in big cities.",
    keywords: [
      "funding",
      "allocate",
      "transit",
      "commuters",
      "reduce",
      "reliance",
      "urban",
      "congestion",
      "private",
      "vehicles",
      "public",
      "investment",
    ],
    prompt:
      "Paraphrase this sentence into formal IELTS Academic C1/C2 style (change vocabulary & structure while keeping exact meaning):",
    correctAnswer:
      "Municipal authorities ought to allocate greater funding to public transit networks in order to curb commuters' reliance on private vehicles in metropolitan areas.",
    explanation_id:
      "Parafrase Band 8+ mengganti frasa umum ('more money', 'fewer people', 'big cities') menjadi istilah akademik presisi ('allocate greater funding', 'curb reliance', 'metropolitan areas').",
  },
];

export const FALLBACK_READING_PACKS: ReadingPassagePack[] = [
  {
    id: "read-pack-1",
    title: "The Cognitive Ecology of Urban Soundscapes",
    topic: "Acoustic Urbanism & Cognitive Psychology",
    recommendedMinutes: 12,
    paragraphs: [
      "For most of the twentieth century, municipal noise policies treated sound exclusively as an environmental pollutant to be measured in decibels and suppressed behind concrete barriers. Yet acoustic ecologists now contend that decibel meters capture only volume, overlooking how different auditory textures shape human attention and stress recovery. A busy fountain emitting 65 decibels of broadband water noise, for instance, is routinely perceived as restorative, whereas an intermittent 55-decibel delivery alarm triggers measurable spikes in salivary cortisol.",
      "Research led by Dr. Mei-Ling Tan at the Urban Perception Lab demonstrates that predictable natural acoustics—wind rustling through plane trees, distant birdsong, and flowing water—engage what psychologists term 'soft fascination.' Unlike sudden mechanical shrieks that hijack involuntary attention and deplete working memory, soft fascination allows the prefrontal cortex to replenish depleted cognitive resources. In controlled trials across three metropolitan hospitals, wards facing courtyard water features recorded a 19 percent reduction in self-reported post-operative anxiety compared with equally quiet wards facing sealed brick walls.",
      "Nevertheless, acoustic designers warn against treating artificial soundscaping as a universal substitute for noise abatement. When outdoor speakers broadcast synthetic birdsong to mask heavy freight traffic, listeners frequently report cognitive dissonance when visual cues contradict what they hear. Field interviews conducted in Zurich showed that pedestrians became irritated by concealed speakers once they noticed the absence of actual trees or nesting habitats, rating the street less authentic than an unmasked pedestrian lane.",
      "Consequently, progressive urban planners are shifting toward 'bio-integrated sound design,' where physical vegetation and porous street surfacing work together to attenuate low-frequency tyre roar while attracting genuine songbird populations. Although porous asphalt requires slightly more frequent vacuum cleaning to prevent dust clogging, municipal audits indicate that combining vegetative buffers with quiet road surfaces extends cardiovascular health benefits across high-density residential corridors far more durably than electronic masking alone.",
    ],
    questions: [
      {
        id: "rq-1",
        type: "tfng",
        prompt:
          "Decibel level alone reliably predicts whether an urban sound causes psychological stress.",
        options: ["TRUE", "FALSE", "NOT GIVEN"],
        answer: "FALSE",
        explanation_id:
          "FALSE — Paragraf 1 menegaskan decibel meter hanya mengukur volume dan melewatkan bagaimana tekstur suara memengaruhi stres (air mancur 65 dB terasa memulihkan dibanding alarm 55 dB).",
        evidence_quote:
          "decibel meters capture only volume, overlooking how different auditory textures shape human attention and stress recovery.",
      },
      {
        id: "rq-2",
        type: "tfng",
        prompt:
          "Hospital rooms overlooking courtyard water features reported lower patient anxiety than silent rooms facing brick walls.",
        options: ["TRUE", "FALSE", "NOT GIVEN"],
        answer: "TRUE",
        explanation_id:
          "TRUE — Paragraf 2 menyebutkan penurunan kecemasan pasca-operasi sebesar 19 persen dibanding bangsal tenang yang menghadap tembok bata.",
        evidence_quote:
          "wards facing courtyard water features recorded a 19 percent reduction in self-reported post-operative anxiety compared with equally quiet wards facing sealed brick walls.",
      },
      {
        id: "rq-3",
        type: "tfng",
        prompt:
          "Zurich spent more municipal funding on concealed speakers than on tree-planting initiatives in 2024.",
        options: ["TRUE", "FALSE", "NOT GIVEN"],
        answer: "NOT GIVEN",
        explanation_id:
          "NOT GIVEN — Paragraf 3 hanya membahas wawancara pejalan kaki di Zurich soal speaker tersembunyi, tanpa menyebutkan perbandingan anggaran tahun 2024.",
        evidence_quote:
          "Field interviews conducted in Zurich showed that pedestrians became irritated by concealed speakers once they noticed the absence of actual trees",
      },
      {
        id: "rq-4",
        type: "mcq",
        prompt:
          "Why did pedestrians in Zurich react negatively to artificial birdsong speakers?",
        options: [
          "The broadcast volume exceeded safe decibel limits.",
          "Visual surroundings did not match the natural sounds they heard.",
          "The speakers disrupted local migratory bird patterns.",
          "They preferred hearing heavy freight traffic instead.",
        ],
        answer:
          "Visual surroundings did not match the natural sounds they heard.",
        explanation_id:
          "Paragraf 3 menjelaskan munculnya 'cognitive dissonance' ketika petunjuk visual (tidak adanya pepohonan) bertentangan dengan suara burung buatan.",
        evidence_quote:
          "listeners frequently report cognitive dissonance when visual cues contradict what they hear.",
      },
      {
        id: "rq-5",
        type: "fill_blank",
        prompt:
          "Complete the summary (ONE OR TWO WORDS from the passage): Natural sounds such as wind and water induce _____ , enabling the brain's prefrontal cortex to recover.",
        answer: "soft fascination",
        acceptedAnswers: ["soft fascination"],
        explanation_id:
          "Paragraf 2 secara eksplisit menyebut istilah 'soft fascination' sebagai mekanisme pemulihan korteks prefrontal.",
        evidence_quote:
          "engage what psychologists term 'soft fascination.' ... soft fascination allows the prefrontal cortex to replenish depleted cognitive resources.",
      },
      {
        id: "rq-6",
        type: "fill_blank",
        prompt:
          "Complete the note (ONE OR TWO WORDS from the passage): One maintenance drawback of porous asphalt is the need for more regular _____ to keep dust from blocking pores.",
        answer: "vacuum cleaning",
        acceptedAnswers: ["vacuum cleaning", "cleaning"],
        explanation_id:
          "Paragraf 4 menyatakan porous asphalt membutuhkan 'vacuum cleaning' yang lebih rutin agar tidak tersumbat debu.",
        evidence_quote:
          "Although porous asphalt requires slightly more frequent vacuum cleaning to prevent dust clogging",
      },
    ],
  },
  {
    id: "read-pack-2",
    title: "Mycorrhizal Networks and Forest Resilience",
    topic: "Botany & Ecological Systems",
    recommendedMinutes: 12,
    paragraphs: [
      "Beneath the leaf litter of temperate forests lies an intricate subterranean web of fungal filaments known as mycorrhizal hyphae. Because tree roots have limited surface area to absorb immobile minerals such as phosphorus, over 90 percent of land plants form symbiotic partnerships with soil fungi. In exchange for carbon-rich sugars synthesized through photosynthesis, the fungal threads extend far beyond root depletion zones, delivering water and micronutrients directly into host cells.",
      "Since the late 1990s, isotope-tracing experiments have suggested that this underground network does more than feed individual trees: it also links neighboring trees—even across distinct species—into shared resource conduits. In shaded understories where seedlings receive insufficient sunlight, mature canopy trees have been observed transferring small pulses of carbon through fungal bridges, improving early seedling survival during drought years.",
      "However, contemporary forest ecologists caution against overly romantic metaphors that portray forests as purely altruistic cooperatives. Controlled field re-analyses published between 2022 and 2025 emphasize that fungi operate according to evolutionary self-interest rather than tree charity. Fungi often hoard nitrogen in nutrient-poor soils or preferentially allocate phosphorus to whichever host supplies the highest sugar return, sometimes exacerbating competition between dominant and stressed trees.",
      "Understanding both cooperative buffering and fungal self-interest has practical stakes for commercial forestry. Clear-cutting practices that strip topsoil and sever intact fungal networks force newly planted saplings to rebuild symbioses from scratch, slowing early timber recovery by years. By leaving scattered 'retention islands' of mature trees undisturbed during harvest, foresters preserve living fungal inoculum that accelerates regeneration while curbing artificial fertilizer runoff.",
    ],
    questions: [
      {
        id: "rq2-1",
        type: "tfng",
        prompt:
          "Most terrestrial plants rely on partnerships with soil fungi to obtain minerals efficiently.",
        options: ["TRUE", "FALSE", "NOT GIVEN"],
        answer: "TRUE",
        explanation_id:
          "TRUE — Paragraf 1 menyatakan lebih dari 90 persen tumbuhan darat membentuk kemitraan simbiotik dengan jamur tanah.",
        evidence_quote:
          "over 90 percent of land plants form symbiotic partnerships with soil fungi.",
      },
      {
        id: "rq2-2",
        type: "tfng",
        prompt:
          "Fungal networks always distribute nutrients equally regardless of how much sugar a host tree supplies.",
        options: ["TRUE", "FALSE", "NOT GIVEN"],
        answer: "FALSE",
        explanation_id:
          "FALSE — Paragraf 3 menjelaskan jamur memprioritaskan alokasi fosfor ke inang yang memberi pasokan gula tertinggi.",
        evidence_quote:
          "preferentially allocate phosphorus to whichever host supplies the highest sugar return",
      },
      {
        id: "rq2-3",
        type: "mcq",
        prompt:
          "Why do foresters leave 'retention islands' of mature trees during timber harvests?",
        options: [
          "To preserve living fungal networks that help new saplings establish faster",
          "To completely eliminate the need for sunlight in shaded understories",
          "To stop mature trees from absorbing phosphorus from the soil",
          "To prevent isotope tracing experiments from disturbing topsoil",
        ],
        answer:
          "To preserve living fungal networks that help new saplings establish faster",
        explanation_id:
          "Paragraf 4 menyebutkan pulau retensi menjaga inokulum jamur tetap hidup guna mempercepat regenerasi bibit baru.",
        evidence_quote:
          "foresters preserve living fungal inoculum that accelerates regeneration while curbing artificial fertilizer runoff.",
      },
      {
        id: "rq2-4",
        type: "fill_blank",
        prompt:
          "Complete the note (ONE WORD from the passage): Tree roots often struggle to absorb immobile minerals such as _____ without fungal assistance.",
        answer: "phosphorus",
        acceptedAnswers: ["phosphorus"],
        explanation_id:
          "Paragraf 1 secara langsung menyebut mineral tidak bergerak seperti 'phosphorus'.",
        evidence_quote:
          "absorb immobile minerals such as phosphorus, over 90 percent of land plants form symbiotic partnerships",
      },
      {
        id: "rq2-5",
        type: "fill_blank",
        prompt:
          "Complete the sentence (ONE OR TWO WORDS from the passage): Techniques known as _____ confirmed that carbon passes between neighboring trees.",
        answer: "isotope-tracing",
        acceptedAnswers: ["isotope-tracing", "isotope tracing"],
        explanation_id:
          "Paragraf 2 merujuk pada eksperimen 'isotope-tracing' yang membuktikan perpindahan karbon antarpohon.",
        evidence_quote:
          "isotope-tracing experiments have suggested that this underground network does more than feed individual trees",
      },
    ],
  },
];

export const FALLBACK_LISTENING_PACKS: ListeningSectionPack[] = [
  {
    id: "list-pack-1",
    sectionLabel: "Section 3 · Academic Tutorial",
    title: "Evaluating Campus Microgrid Battery Trials",
    context:
      "Percakapan antara seorang mahasiswa Australia dan dosen pembimbing Inggris mengenai riset baterai kampus.",
    accentsLabel: "British (UK) & Australian (AU)",
    segments: [
      {
        speaker: "Dr. Carter (UK)",
        accent: "GB_F",
        text: "Come in, Liam. I've read your draft report on the campus solar microgrid trial. Overall the data analysis is sharp, though I noticed a gap in how you explained peak evening demand.",
      },
      {
        speaker: "Liam (AU)",
        accent: "AU_M",
        text: "Thanks, Dr. Carter. Yes, between five and eight p.m., the engineering dorms drew nearly forty-two percent more electricity than our simulation predicted.",
      },
      {
        speaker: "Dr. Carter (UK)",
        accent: "GB_F",
        text: "Right. Was that mainly due to electric heaters or the new induction kitchens?",
      },
      {
        speaker: "Liam (AU)",
        accent: "AU_M",
        text: "Actually, neither. When we checked the smart meters, almost half the spike came from rapid e-bike charging stations installed outside the north courtyard.",
      },
      {
        speaker: "Dr. Carter (UK)",
        accent: "GB_F",
        text: "Interesting! Make sure you highlight that in Section Two. Also, for the battery degradation chart, let's replace the weekly averages with monthly median figures so outliers from maintenance shutdowns don't skew the trend.",
      },
      {
        speaker: "Liam (AU)",
        accent: "AU_M",
        text: "Good call. Should I submit the revised appendices before Friday's seminar or wait until the external auditor sends the safety log?",
      },
      {
        speaker: "Dr. Carter (UK)",
        accent: "GB_F",
        text: "Send the appendices by Thursday noon—upload them to the shared archive folder titled 'Grid Phase Two' so the panel can review them in advance.",
      },
    ],
    questions: [
      {
        id: "lq-1",
        type: "mcq",
        prompt:
          "What caused the unexpected electricity spike between 5 p.m. and 8 p.m.?",
        options: [
          "New induction kitchens in the dorms",
          "Electric space heaters during cold evenings",
          "Fast e-bike charging stations outside the north courtyard",
          "Scheduled maintenance shutdowns on the solar panels",
        ],
        answer: "Fast e-bike charging stations outside the north courtyard",
        explanation_id:
          "Liam membantah pemanas maupun dapur induksi, lalu menyebut lonjakan berasal dari stasiun pengisian cepat e-bike di north courtyard.",
      },
      {
        id: "lq-2",
        type: "mcq",
        prompt:
          "Why does Dr. Carter recommend switching the battery chart to monthly median figures?",
        options: [
          "To reduce the total number of pages in the appendix",
          "To prevent maintenance anomalies from distorting the overall trend",
          "Because weekly smart-meter records were deleted",
          "To match the format required by the external safety auditor",
        ],
        answer:
          "To prevent maintenance anomalies from distorting the overall trend",
        explanation_id:
          "Dr. Carter berkata agar 'outliers from maintenance shutdowns don't skew the trend'.",
      },
      {
        id: "lq-3",
        type: "form_completion",
        prompt:
          "Complete the note (A NUMBER): Electricity usage in the dorms exceeded predictions by _____ percent.",
        answer: "42",
        acceptedAnswers: ["42", "forty-two", "forty two"],
        explanation_id:
          "Liam menyatakan 'nearly forty-two percent more electricity than our simulation predicted'.",
      },
      {
        id: "lq-4",
        type: "form_completion",
        prompt:
          "Complete the deadline note (TWO WORDS): Liam must upload the revised appendices by _____.",
        answer: "Thursday noon",
        acceptedAnswers: ["thursday noon"],
        explanation_id:
          "Dr. Carter menginstruksikan: 'Send the appendices by Thursday noon'.",
      },
      {
        id: "lq-5",
        type: "form_completion",
        prompt:
          "Complete the archive label (THREE WORDS): The shared folder is named '_____'.",
        answer: "Grid Phase Two",
        acceptedAnswers: ["grid phase two", "grid phase 2"],
        explanation_id:
          "Dr. Carter menyebut folder tersebut berjudul 'Grid Phase Two'.",
      },
    ],
  },
  {
    id: "list-pack-2",
    sectionLabel: "Section 4 · University Lecture",
    title: "Deep-Sea Hydrothermal Vents & Early Biochemistry",
    context:
      "Monolog kuliah biologi kelautan dengan aksen Australia dan komentar penutup dari moderator Amerika.",
    accentsLabel: "Australian (AU) & American (US)",
    segments: [
      {
        speaker: "Prof. Harris (AU)",
        accent: "AU_F",
        text: "Today we examine why deep-sea hydrothermal vents challenge long-standing assumptions about where life on Earth began. Prior to 1977, biologists assumed every food web ultimately depended on sunlight and photosynthesis.",
      },
      {
        speaker: "Prof. Harris (AU)",
        accent: "AU_F",
        text: "However, submersibles exploring the Galapagos Rift discovered thriving colonies of giant tube worms living over two thousand meters below the surface, sustained entirely by chemosynthetic bacteria oxidizing hydrogen sulfide.",
      },
      {
        speaker: "Prof. Harris (AU)",
        accent: "AU_F",
        text: "Even more intriguing are alkaline white smokers, such as the Lost City vent field. Unlike violent black smokers that erupt at four hundred degrees Celsius, alkaline vents release warm, mineral-rich fluids at roughly seventy degrees, creating microscopic porous chimneys ideal for concentrating early organic molecules.",
      },
      {
        speaker: "Moderator (US)",
        accent: "US_M",
        text: "Thank you, Professor Harris. Students attending next week's lab session should bring their comparative mineral sheet and arrive at Room 304 ten minutes early.",
      },
    ],
    questions: [
      {
        id: "lq2-1",
        type: "mcq",
        prompt:
          "What major biological assumption was overturned by the 1977 Galapagos Rift expedition?",
        options: [
          "That all ecosystems ultimately rely on sunlight for energy",
          "That hydrogen sulfide is toxic to all marine microorganisms",
          "That black smokers are cooler than alkaline white smokers",
          "That giant tube worms only inhabit shallow coastal reefs",
        ],
        answer: "That all ecosystems ultimately rely on sunlight for energy",
        explanation_id:
          "Sebelum 1977, ahli biologi mengira semua jaring makanan bergantung pada cahaya matahari dan fotosintesis.",
      },
      {
        id: "lq2-2",
        type: "form_completion",
        prompt:
          "Complete the summary (ONE WORD): Bacteria near deep vents sustain tube worms through oxidizing hydrogen _____.",
        answer: "sulfide",
        acceptedAnswers: ["sulfide", "sulphide"],
        explanation_id:
          "Dosen menyebut bakteri kemosintetik mengoksidasi 'hydrogen sulfide'.",
      },
      {
        id: "lq2-3",
        type: "form_completion",
        prompt:
          "Complete the lecture note (A NUMBER): Alkaline white smokers release fluids at approximately _____ degrees Celsius.",
        answer: "70",
        acceptedAnswers: ["70", "seventy"],
        explanation_id:
          "Berbeda dengan black smoker (400°C), alkaline vent melepas cairan hangat sekitar 70°C.",
      },
      {
        id: "lq2-4",
        type: "form_completion",
        prompt:
          "Complete the lab notice (NUMBER): Next week's lab takes place in Room _____.",
        answer: "304",
        acceptedAnswers: ["304"],
        explanation_id:
          "Moderator Amerika mengumumkan sesi lab diadakan di 'Room 304'.",
      },
    ],
  },
];

export const FALLBACK_WRITING_PACKS: WritingTaskPack[] = [
  {
    id: "write-t1-1",
    taskType: "task1",
    title: "Task 1 · Urban Commuter Transport Modes (2015 vs 2025)",
    prompt:
      "The table and chart below illustrate the percentage of daily commuters using four primary modes of transport across three metropolitan cities in 2015 and 2025. Summarize the information by selecting and reporting the main features, and make comparisons where relevant.",
    minWords: 150,
    recommendedMinutes: 20,
    chartData: {
      title: "Share of Daily Commuters (%) — 2015 vs 2025",
      unit: "%",
      columns: ["Rail & Metro", "Cycling / E-Bike", "Bus Transit", "Private Car"],
      rows: [
        { label: "2015", values: [28, 9, 24, 39] },
        { label: "2025", values: [37, 21, 19, 23] },
      ],
    },
    outlineTips: [
      "Paragraf 1: Parafrase prompt (tunjukkan jenis grafik/tabel, periode 2015 & 2025, dan satuan persentase).",
      "Paragraf 2 (Overview): Soroti tren utama tanpa angka rinci — lonjakan tajam Rail & Cycling/E-Bike beriringan dengan turunnya penggunaan mobil pribadi.",
      "Paragraf 3–4 (Detail): Bandingkan pergeseran spesifik (misal Private Car turun dari 39% ke 23%, sementara Cycling naik lebih dari dua kali lipat dari 9% menjadi 21%).",
    ],
    fallbackBand85Sample:
      "The chart compares the proportion of urban commuters relying on four distinct transport modes in 2015 and 2025.\n\nOverall, commuter habits shifted substantially away from private vehicles and conventional bus services toward rail networks and active micro-mobility. While private cars represented the single largest share at the outset of the decade, rail and metro transit emerged as the dominant commuting option by 2025.\n\nIn 2015, private car usage accounted for 39% of daily journeys, well ahead of rail and metro at 28% and buses at 24%. Over the subsequent ten-year period, however, car dependency contracted markedly by 16 percentage points to 23%, accompanied by a gentler decline in bus ridership to 19%.\n\nConversely, sustainable modes expanded rapidly. Rail and metro adoption climbed by 9 percentage points to reach 37%, making it the most popular choice in 2025. Even more strikingly, cycling and e-bike commuting more than doubled over the decade, surging from just 9% to 21% and overtaking bus transit.",
  },
  {
    id: "write-t2-1",
    taskType: "task2",
    title: "Task 2 · Automation, AI & University Curriculum Reform",
    prompt:
      "As artificial intelligence increasingly automates routine analytical and writing tasks, some educators argue that universities should replace traditional essay exams with oral defenses and collaborative project work. To what extent do you agree or disagree with this view?",
    minWords: 250,
    recommendedMinutes: 40,
    outlineTips: [
      "Introduction: Parafrase topik AI di perguruan tinggi + nyatakan posisi jelas (misal setuju sebagian: asesmen perlu beradaptasi tanpa menghapus penulisan terstruktur sepenuhnya).",
      "Body 1: Mengapa ujian lisan (oral defense) & proyek kolaboratif efektif memvalidasi pemahaman otentik dan kemampuan komunikasi nyata.",
      "Body 2: Mengapa keterampilan menulis esai akademis tetap krusial untuk melatih ketajaman berpikir terstruktur dan sintesis argumen.",
      "Conclusion: Rangkum argumen seimbang — model penilaian hibrida (eseminar proyek + esai tersupervisi) adalah solusi paling tangguh.",
    ],
    fallbackBand85Sample:
      "The rapid proliferation of generative artificial intelligence has prompted intense debate over the integrity and relevance of traditional university assessment. While I agree that oral examinations and collaborative projects should occupy a far larger share of higher-education grading, entirely eliminating written essay assessments would inadvertently weaken students' capacity for rigorous independent thought.\n\nExpanding oral defenses and team-based projects addresses a glaring vulnerability of take-home essays: verifying genuine comprehension. When students must articulate their reasoning spontaneously before peers or examiners, superficial reliance on automated drafts becomes immediately apparent. Moreover, modern workplaces rarely reward solitary text generation; instead, employers value cross-functional negotiation, iterative problem-solving, and clear verbal persuasion—all skills honed effectively through structured project work.\n\nNevertheless, abolishing written essays altogether would be shortsighted. Composing a sustained academic argument demands a level of conceptual precision, evidence synthesis, and structural discipline that casual conversation cannot replicate. Rather than replacing written work outright, universities can redesign writing tasks around supervised in-class synthesis or reflective process logs documenting how drafts evolved.\n\nIn conclusion, integrating oral defenses and collaborative projects offers a vital safeguard against passive AI dependency, yet retaining thoughtfully redesigned essay assessments remains indispensable for cultivating deep analytical literacy.",
  },
  {
    id: "write-t1-2",
    taskType: "task1",
    title: "Task 1 · Renewable Electricity Generation by Source (GWh)",
    prompt:
      "The table shows electricity output (in gigawatt-hours) generated from four renewable energy sources in a coastal region between 2020 and 2024. Summarize the information by selecting and reporting the main features, and make comparisons where relevant.",
    minWords: 150,
    recommendedMinutes: 20,
    chartData: {
      title: "Regional Renewable Output (GWh) — 2020 vs 2024",
      unit: " GWh",
      columns: ["Offshore Wind", "Solar PV", "Hydroelectric", "Biomass"],
      rows: [
        { label: "2020", values: [180, 110, 260, 95] },
        { label: "2024", values: [410, 295, 255, 115] },
      ],
    },
    outlineTips: [
      "Overview: Total output terbarukan meningkat tajam, terutama didorong oleh Offshore Wind dan Solar PV, sementara Hydroelectric relatif stagnan.",
      "Detail Comparisons: Offshore Wind melampaui Hydroelectric menjadi sumber terbesar (180 -> 410 GWh); Solar PV hampir tiga kali lipat (110 -> 295 GWh).",
    ],
    fallbackBand85Sample:
      "The table presents electricity generation across four renewable sources, measured in gigawatt-hours, in a coastal region in 2020 and 2024.\n\nOverall, combined renewable output expanded substantially over the four-year period, driven overwhelmingly by rapid growth in offshore wind and solar photovoltaics. By contrast, hydroelectric output remained virtually unchanged, relinquishing its position as the primary power supplier.\n\nIn 2020, hydroelectric stations generated 260 GWh, making them the largest contributor ahead of offshore wind (180 GWh). By 2024, however, hydroelectric output edged down slightly to 255 GWh, whereas offshore wind more than doubled to 410 GWh, establishing a clear lead.\n\nSolar PV recorded the fastest proportional rise, climbing nearly threefold from 110 GWh to 295 GWh and overtaking hydroelectricity into second place. Biomass remained the smallest source throughout, experiencing only modest growth from 95 GWh to 115 GWh.",
  },
  {
    id: "write-t2-2",
    taskType: "task2",
    title: "Task 2 · Congestion Pricing vs Free Public Transit",
    prompt:
      "Some cities charge drivers a daily fee to enter congested city centers, whereas others invest in making public transportation completely free. Which approach is more effective at reducing urban traffic and pollution?",
    minWords: 250,
    recommendedMinutes: 40,
    outlineTips: [
      "Introduction: Kontekstualisasikan kemacetan & emisi kota + nyatakan tesis (kombinasi keduanya, atau jelaskan mengapa satu lebih efektif secara perilaku & fiskal).",
      "Body 1: Analisis efektivitas congestion pricing dalam mengubah perilaku pengemudi secara langsung dan mendanai infrastruktur.",
      "Body 2: Keunggulan dan keterbatasan transportasi publik gratis (meningkatkan aksesibilitas, namun tanpa disinsentif mobil pribadi sering belum cukup memindahkan pengguna mobil).",
      "Conclusion: Ringkasan posisi yang tegas dan realistis.",
    ],
    fallbackBand85Sample:
      "Urban planners increasingly confront the dual challenge of paralyzing traffic congestion and deteriorating air quality. While offering fare-free public transit appeals broadly on grounds of social equity, implementing congestion pricing in dense city centers proves significantly more effective at curbing vehicle volumes and emissions—particularly when fee revenues directly finance transit upgrades.\n\nA daily congestion charge tackles urban gridlock at its behavioral root by internalizing the hidden social costs of driving. Empirical evidence from cities such as London and Stockholm demonstrates that requiring motorists to pay for peak-hour road space immediately filters out non-essential private car trips, cutting inner-city delays and particulate emissions within months. Crucially, these charges generate a dedicated funding stream that municipal authorities can reinvest into faster bus corridors and frequent rail headways.\n\nConversely, eliminating transit fares alone often fails to entice habitual car commuters out of their vehicles. Research consistently shows that affluent drivers prioritize reliability, door-to-door speed, and comfort over modest ticket savings; consequently, free transit initiatives frequently shift existing pedestrians onto buses without substantially lowering the number of cars on the road, while straining municipal maintenance budgets.\n\nIn summary, although fare-free transit supports lower-income residents, congestion pricing delivers far stronger reductions in traffic and pollution and creates the fiscal capacity needed to make public transport genuinely competitive.",
  },
];

export const FALLBACK_SPEAKING_PACKS: SpeakingPromptPack[] = [
  {
    id: "speak-p1-1",
    part: "part1",
    topic: "Daily Routine & Urban Cafés",
    question:
      "Do you prefer working or studying in quiet rooms at home, or in busy places like cafés? Why?",
    followUpQuestions: [
      "How has your ideal study environment changed over the past few years?",
      "Do background noises ever help you concentrate better?",
    ],
    prepSeconds: 0,
    speakSeconds: 60,
    targetPhrases: ["ambient noise", "strike a balance", "get snowed under"],
    fallbackBand85Sample:
      "Honestly, I tend to alternate depending on the cognitive load of the task. When I'm tackling dense academic reading, I definitely gravitate toward a quiet room at home so nothing breaks my train of thought. However, if I'm brainstorming or feeling slightly snowed under with routine emails, a lively café actually gives me a subtle energy boost—the low hum of ambient noise helps me strike a balance between relaxation and focus.",
  },
  {
    id: "speak-p2-1",
    part: "part2",
    topic: "A Complex Skill You Learned Recently",
    question:
      "Describe a challenging practical or intellectual skill you learned recently that proved genuinely useful.",
    cueBullets: [
      "What the skill was and why you decided to learn it",
      "How you practiced or overcame initial difficulties",
      "How long it took before you felt confident",
      "And explain how this skill has made a difference in your work or daily life.",
    ],
    prepSeconds: 60,
    speakSeconds: 120,
    targetPhrases: ["steep learning curve", "bite the bullet", "yield results"],
    fallbackBand85Sample:
      "One genuinely transformative skill I picked up over the past year is structured public speaking in English. Previously, whenever I had to present technical findings, I would rush through slides out of sheer nervousness. Eventually I decided to bite the bullet and join a small weekly critique circle. There was certainly a steep learning curve at first—recording myself and watching awkward pauses was humbling—but focusing on deliberate pacing and signposting slowly began to yield results. Within three months, colleagues noticed how much more compelling and composed my briefings felt, and I now approach client presentations with genuine confidence rather than dread.",
  },
  {
    id: "speak-p3-1",
    part: "part3",
    topic: "Urbanization & Local Community Identity",
    question:
      "When historic city neighborhoods rapidly modernize or attract wealthier residents, what are the main social trade-offs for long-term locals?",
    followUpQuestions: [
      "Should local governments cap commercial rents to protect heritage businesses?",
      "Can modern architecture coexist harmoniously with traditional street culture?",
    ],
    prepSeconds: 0,
    speakSeconds: 90,
    targetPhrases: ["gentrified", "bear the brunt", "nuanced approach"],
    fallbackBand85Sample:
      "That's a deeply nuanced issue because urban renewal rarely produces purely positive or negative outcomes. On the one hand, newly gentrified districts often enjoy upgraded transit infrastructure, safer streetscapes, and revitalized local commerce. On the other hand, long-standing residents and independent family shops frequently bear the brunt of soaring property taxes and rents, gradually eroding the very cultural authenticity that made the neighborhood appealing in the first place. Consequently, policymakers need a balanced approach—combining targeted housing protections with measured private investment.",
  },
];

export const COMMUTE_MINI_CLIPS: CommuteListeningClip[] = [
  {
    id: "commute-clip-1",
    title: "Library Locker Extension (UK + AU)",
    accentsLabel: "British & Australian",
    segments: [
      {
        speaker: "Librarian (UK)",
        accent: "GB_F",
        text: "Good morning! Starting next Monday, overnight study lockers on Level Three can be booked for up to seventy-two hours using your student card.",
      },
      {
        speaker: "Student (AU)",
        accent: "AU_M",
        text: "Awesome, and do we drop keys at the front desk or scan the QR code?",
      },
      {
        speaker: "Librarian (UK)",
        accent: "GB_F",
        text: "Just scan the QR sticker inside the door—no physical keys anymore.",
      },
    ],
    questions: [
      {
        id: "cmq-1",
        prompt: "How long can Level Three lockers be booked starting next Monday?",
        options: ["24 hours", "48 hours", "72 hours", "One week"],
        answer: "72 hours",
      },
      {
        id: "cmq-2",
        prompt: "How do students unlock or check out their locker now?",
        options: [
          "Pick up a brass key at reception",
          "Scan the QR sticker inside the door",
          "Email the library helpdesk",
          "Use a four-digit PIN from the printer",
        ],
        answer: "Scan the QR sticker inside the door",
      },
    ],
  },
  {
    id: "commute-clip-2",
    title: "Evening Shuttle Route Change (AU + US)",
    accentsLabel: "Australian & American",
    segments: [
      {
        speaker: "Coordinator (AU)",
        accent: "AU_F",
        text: "Quick reminder for evening commuters: the eight-fifteen shuttle will now bypass South Avenue due to bridge resurfacing and stop directly at Central Station Bay Nine.",
      },
      {
        speaker: "Passenger (US)",
        accent: "US_M",
        text: "Got it, Bay Nine. Does the return bus still leave every twenty minutes?",
      },
      {
        speaker: "Coordinator (AU)",
        accent: "AU_F",
        text: "Yes, still every twenty minutes right up until midnight.",
      },
    ],
    questions: [
      {
        id: "cmq2-1",
        prompt: "Where will the 8:15 shuttle stop instead of South Avenue?",
        options: [
          "North Gate Terminal",
          "Central Station Bay Nine",
          "Bridge East Pier",
          "Harbour Plaza",
        ],
        answer: "Central Station Bay Nine",
      },
      {
        id: "cmq2-2",
        prompt: "How frequently does the return bus run?",
        options: [
          "Every 10 minutes",
          "Every 15 minutes",
          "Every 20 minutes",
          "Every 30 minutes",
        ],
        answer: "Every 20 minutes",
      },
    ],
  },
];
