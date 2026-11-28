import { normalizeCefrLevel, normalizeTermKey } from "@/lib/utils";
import type { CefrLevel } from "@/types/lexivault";

export interface BilingualMeaningInfo {
  meaning_en: string;
  meaning_id?: string;
  meaning_ru?: string;
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

/**
 * Concise, natural Russian definitions for all built-in starter words,
 * discovery items, AI Suggest fallbacks, and Daily Pack fallback banks.
 */
export const BUILT_IN_RUSSIAN_MEANINGS: Record<string, string> = {
  // Core starter, discovery, and AI Suggest pool
  gentrified:
    "Облагороженный и ставший более дорогим и престижным (о районе), что часто ведёт к росту цен и вытеснению прежних жителей.",
  ubiquitous:
    "Повсеместный, встречающийся буквально на каждом шагу и ставший неотъемлемой частью повседневной жизни.",
  pragmatic:
    "Прагматичный, опирающийся на практическую пользу и реальные обстоятельства, а не на отвлечённые теории.",
  ephemeral:
    "Мимолётный, недолговечный, существующий совсем короткое время.",
  mitigate:
    "Смягчать, ослаблять вредное воздействие, риск или тяжесть неприятной ситуации.",
  nuanced:
    "Тонкий, с учётом множества оттенков смысла и деталей, без упрощённого чёрно-белого взгляда.",
  ambivalent:
    "Противоречивый, испытывающий одновременно противоположные чувства или сомнения по поводу чего-либо.",
  resilient:
    "Устойчивый, способный выдерживать давление и быстро восстанавливаться после трудностей и потрясений.",
  "bite the bullet":
    "Стиснуть зубы и решиться на трудное или неприятное, но неизбежное дело.",
  "burn the midnight oil":
    "Засиживаться за работой или учёбой глубоко за полночь ради важной цели.",
  "cut corners":
    "Халтурить, срезать углы и экономить время или деньги в ущерб качеству или безопасности.",
  "play devil's advocate":
    "Выступать «адвокатом дьявола» — намеренно отстаивать противоположную точку зрения, чтобы проверить идею на прочность.",
  "get out of hand":
    "Выйти из-под контроля, стать неуправляемым или хаотичным.",
  "make a compelling case":
    "Привести убедительные, весомые аргументы в защиту своей позиции.",
  "strike a balance":
    "Найти золотую середину, разумный баланс между двумя крайностями или приоритетами.",
  "bear the brunt":
    "Принять на себя главный удар или самую тяжёлую часть последствий.",
  "spark a debate":
    "Вызвать бурные споры или широкое общественное обсуждение.",
  "draw a parallel":
    "Провести параллель, указать на заметное сходство между двумя разными явлениями.",
  magnanimous:
    "Великодушный, благородный, особенно в умении прощать соперника или достойно вести себя после победы.",
  ameliorate:
    "Улучшать, облегчать или исправлять тяжёлое либо неудовлетворительное положение дел.",
  clandestine:
    "Тайный, подпольный, скрытый — обычно из-за деликатного или незаконного характера действий.",
  "weather the storm":
    "Пережить бурю, выстоять в тяжёлый кризис и выйти из него без серьёзных потерь.",
  "read between the lines":
    "Читать между строк — улавливать скрытый смысл, не высказанный напрямую.",
  "foster innovation":
    "Поощрять и развивать инновации, создавать среду для свежих идей и экспериментов.",
  "wield influence":
    "Обладать значительным влиянием и активно использовать его для воздействия на решения или людей.",
  disparate:
    "Совершенно разнородный, коренным образом отличающийся по природе или происхождению.",
  ostensible:
    "Мнимый, показной — заявленный на поверхности, но не обязательно отражающий истинную причину.",
  tenacious:
    "Упорный, цепкий, настойчивый, не сдающийся даже перед серьёзными препятствиями.",
  "ballpark figure":
    "Приблизительная цифра, грубая оценка «на глазок» до точных расчётов.",
  "touch base":
    "Кратко связаться с кем-либо, чтобы сверить часы, обменяться новостями или уточнить статус.",
  "bridge the gap":
    "Преодолеть разрыв, сблизить разные группы, уровни навыков или точки зрения.",
  "reap the rewards":
    "Пожинать плоды — получать заслуженную награду за прежние усилия или вложения.",
  sagacious:
    "Проницательный, мудрый, обладающий тонким чутьём и дальновидностью в сложных решениях.",
  corroborate:
    "Подтверждать, подкреплять утверждение, свидетельство или гипотезу дополнительными доказательствами.",
  candid:
    "Откровенный, искренний и прямой, без прикрас и уклончивости.",
  "in the long run":
    "В долгосрочной перспективе, в конечном счёте, со временем.",
  "on the same page":
    "На одной волне — иметь одинаковое понимание ситуации, целей и договорённостей.",
  "set a precedent":
    "Создать прецедент — задать пример или стандарт, на который будут ориентироваться в будущем.",
  "shed light on":
    "Пролить свет на что-либо — прояснить запутанный или малоизвестный вопрос.",
  serendipity:
    "Счастливая случайность — удачная находка или открытие, сделанное непреднамеренно.",
  alleviate:
    "Облегчать, ослаблять боль, стресс или трудности, не обязательно устраняя их первопричину.",
  "break the ice":
    "Разрядить обстановку, преодолеть первую неловкость и завязать непринуждённый разговор.",
  "take for granted":
    "Принимать как должное, не ценить что-то важное, считая, что оно будет всегда.",
  "cognitive dissonance":
    "Когнитивный диссонанс — внутренний дискомфорт от противоречия между убеждениями и поступками.",
  lucrative:
    "Прибыльный, доходный, приносящий существенную финансовую выгоду.",
  "under the weather":
    "Неважно себя чувствовать, слегка приболеть или ощущать упадок сил.",
  eloquent:
    "Красноречивый, выразительный и убедительный в речи или на письме.",
  procrastinate:
    "Прокрастинировать — постоянно откладывать важные дела на потом, даже понимая возможный вред.",
  facade:
    "Фасад здания; в переносном смысле — обманчивая внешняя видимость, скрывающая истинное положение вещей.",
  discrepancy:
    "Расхождение, несоответствие между данными, цифрами или показаниями, которые должны совпадать.",
  "hit the nail on the head":
    "Попасть в самую точку — предельно точно определить суть проблемы.",
  "pose a threat":
    "Представлять угрозу, нести серьёзную опасность для стабильности или успеха.",
  "yield results":
    "Приносить ощутимые результаты, давать заметную отдачу после усилий.",
  "snowed under":
    "Заваленный работой по уши, перегруженный делами и обязанностями.",
  "on thin ice":
    "Ходить по тонкому льду — находиться в рискованном положении, где любая ошибка дорого обойдётся.",
  "at a crossroads":
    "На распутье — в решающий момент, когда нужно выбрать один из двух важных путей.",
  "throw caution to the wind":
    "Отбросить всякую осторожность и действовать смело или безрассудно, несмотря на риск.",
  "bark up the wrong tree":
    "Идти по ложному следу, ошибаться в причине проблемы или обвинять не того.",
  "turn a blind eye":
    "Закрывать глаза на что-либо — намеренно игнорировать нарушения или неприятные факты.",
  "cut to the chase":
    "Перейти сразу к делу, без лишних предисловий и отступлений.",
  "a double-edged sword":
    "Палка о двух концах — явление, которое одновременно приносит и пользу, и серьёзные риски.",
  "pass the buck":
    "Перекладывать ответственность или вину на другого, избегая личного ответа.",
  "up in the air":
    "В подвешенном состоянии — ещё не решено и остаётся неопределённым.",
  perspicacious:
    "Проницательный, остроумный, быстро схватывающий тонкие и сложные детали.",
  quintessential:
    "Классический, эталонный — наиболее яркий и чистый образец какого-либо качества или явления.",
  fastidious:
    "Привередливый, щепетильный, крайне внимательный к мелочам и высоким стандартам.",
  intransigent:
    "Непримиримый, упрямый, наотрез отказывающийся идти на компромисс или менять позицию.",
  exacerbate:
    "Усугублять, обострять, делать уже существующую проблему заметно хуже.",
  "warrant scrutiny":
    "Заслуживать пристальной проверки и критического внимания из-за важности или спорности.",
  "galvanize support":
    "Всколыхнуть и сплотить людей, пробудить активную поддержку или решительные действия.",
  "yield dividends":
    "Приносить щедрые дивиденды, со временем окупаться заметной выгодой.",

  // Daily Pack multi-tier fallback bank (A1–C2)
  afford:
    "Позволить себе (финансово или по времени) купить или сделать что-либо.",
  arrive:
    "Прибывать, приезжать или приходить в пункт назначения.",
  astute:
    "Проницательный, сообразительный, умеющий быстро оценить ситуацию и извлечь выгоду.",
  "back to the drawing board":
    "Начинать всё с чистого листа после того, как прежний план не сработал.",
  bolster:
    "Укреплять, усиливать, оказывать дополнительную поддержку идее, уверенности или системе.",
  borrow:
    "Брать взаймы или на время с намерением вернуть обратно.",
  "break new ground":
    "Открывать новые горизонты, делать нечто новаторское и ранее невиданное.",
  circumspect:
    "Осмотрительный, осторожный, тщательно взвешивающий все риски перед действием.",
  coalesce:
    "Объединяться, сливаться в единое целое (об идеях, группах или факторах).",
  coherent:
    "Связный, логичный и последовательный, понятный в изложении.",
  comfortable:
    "Удобный, комфортный, не вызывающий физического или эмоционального напряжения.",
  compelling:
    "Убедительный, захватывающий, вызывающий сильный интерес или доверие.",
  complacent:
    "Самодовольный, благодушный, потерявший бдительность из-за прежних успехов.",
  concise:
    "Краткий и ёмкий, передающий главную мысль без лишних слов.",
  conundrum:
    "Головоломка, запутанная дилемма или сложная задача без простого решения.",
  convenient:
    "Удобный, подходящий по времени, месту или условиям, экономящий силы.",
  detrimental:
    "Вредный, пагубный, наносящий ущерб здоровью, репутации или результату.",
  discerning:
    "Взыскательный, разборчивый, обладающий тонким вкусом и умением отличать качество.",
  "draw the line at":
    "Проводить черту — чётко определять предел, за который ты не готов перейти.",
  efficient:
    "Эффективный, результативный — выполняющий задачу качественно с минимумом лишних затрат.",
  encourage:
    "Подбадривать, поддерживать и вдохновлять кого-либо на действие или уверенность.",
  equivocal:
    "Двусмысленный, уклончивый, допускающий разные толкования.",
  "every cloud has a silver lining":
    "Нет худа без добра — даже в неприятной ситуации можно найти светлую сторону.",
  feasible:
    "Осуществимый, выполнимый, реалистичный с учётом имеющихся ресурсов.",
  "figure out":
    "Разобраться, понять или найти решение задачи путём размышлений.",
  flexible:
    "Гибкий, легко подстраивающийся под изменения, новые условия или графики.",
  "get along":
    "Ладить, поддерживать дружелюбные и спокойные отношения с кем-либо.",
  "get wind of":
    "Пронюхать, случайно узнать о чём-то тайном или ещё не объявленном.",
  "go against the grain":
    "Идти против течения или наперекор привычным правилам и собственным убеждениям.",
  improve:
    "Улучшать, совершенствовать или становиться лучше со временем.",
  "in the same boat":
    "В одной лодке — оказаться в одинаковой трудной ситуации с кем-либо.",
  indispensable:
    "Незаменимый, совершенно необходимый, без которого невозможно обойтись.",
  intricate:
    "Замысловатый, сложный, состоящий из множества тонко переплетённых деталей.",
  "leave no stone unturned":
    "Перевернуть всё вверх дном, испробовать абсолютно все возможности ради результата.",
  "look for":
    "Искать кого-то или что-то, пытаться найти нужное.",
  lucid:
    "Ясный, чёткий и легко понятный (о мысли, объяснении или стиле речи).",
  "make up one's mind":
    "Принять окончательное решение, определиться с выбором.",
  meticulous:
    "Скрупулёзный, дотошный, предельно аккуратный и внимательный к каждой детали.",
  "miss the mark":
    "Не попасть в цель, оказаться неточным или не достичь желаемого эффекта.",
  "move the goalposts":
    "Менять правила игры на ходу, несправедливо усложняя условия достижения цели.",
  "on the same wavelength":
    "На одной волне — мыслить схожим образом и понимать друг друга с полуслова.",
  "open a can of worms":
    "Открыть ящик Пандоры — затронуть тему, которая вызовет лавину новых проблем.",
  "pave the way":
    "Проложить путь, подготовить почву для будущего успеха или перемен.",
  persuade:
    "Убеждать, уговаривать кого-либо согласиться с идеей или предпринять шаг.",
  pervasive:
    "Всепроникающий, широко распространённый, ощущаемый повсюду.",
  precipitate:
    "Стремительно ускорить или внезапно спровоцировать нежелательное событие или кризис.",
  prefer:
    "Предпочитать — выбирать один вариант, потому что он нравится больше других.",
  prepare:
    "Готовиться или подготавливать что-либо заранее к предстоящему делу.",
  prioritize:
    "Расставлять приоритеты, уделяя первоочередное внимание самым важным задачам.",
  proliferate:
    "Стремительно множиться, быстро распространяться и расти в количестве.",
  reliable:
    "Надёжный, проверенный, на которого можно положиться без сомнений.",
  "right away":
    "Немедленно, прямо сейчас, без малейшей задержки.",
  "run out of":
    "Исчерпать запасы чего-либо, остаться без нужного ресурса.",
  salient:
    "Наиболее заметный, ключевой, бросающийся в глаза и важный для понимания.",
  schedule:
    "Планировать, назначать на определённое время или составлять расписание.",
  scrutinize:
    "Пристально изучать, тщательно проверять каждую деталь под микроскопом.",
  substantial:
    "Существенный, значительный по объёму, ценности или важности.",
  superfluous:
    "Излишний, ненужный, избыточный сверх необходимого.",
  "take care":
    "Беречь себя, проявлять осторожность или заботиться о ком-либо.",
  "take into account":
    "Принимать во внимание, учитывать важный факт при принятии решения.",
  "take with a grain of salt":
    "Относиться со скепсисом, не принимать сказанное полностью на веру.",
  "the tip of the iceberg":
    "Верхушка айсберга — лишь малая видимая часть гораздо более крупной проблемы.",
  unprecedented:
    "Беспрецедентный, не имеющий аналогов в прошлом, происходящий впервые.",
};

export function getBuiltInRussianMeaning(term: string): string | undefined {
  const key = normalizeTermKey(term);
  if (!key) return undefined;
  return BUILT_IN_ENGLISH_MEANINGS[key]?.meaning_ru || BUILT_IN_RUSSIAN_MEANINGS[key];
}

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
  cefr?: CefrLevel | string | null,
  meaningRu?: string | null
): void {
  if (typeof window === "undefined") return;
  const cleanEn = meaningEn?.trim();
  const cleanId = meaningId?.trim();
  const cleanRu = meaningRu?.trim();
  if (!cleanEn && !cleanId && !cleanRu) return;

  const key = normalizeTermKey(term);
  if (!key) return;

  try {
    const cache = readBilingualCache();
    const existing = cache[key];
    cache[key] = {
      meaning_en: cleanEn || existing?.meaning_en || "",
      meaning_id: cleanId || existing?.meaning_id,
      meaning_ru: cleanRu || existing?.meaning_ru,
      cefr: normalizeCefrLevel(cefr) || existing?.cefr,
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
  explicitCefr?: string | null,
  explicitMeaningRu?: string | null
): {
  meaning_id: string;
  meaning_en?: string;
  meaning_ru?: string;
  cefr?: CefrLevel;
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

  const meaning_ru =
    explicitMeaningRu?.trim() ||
    cached?.meaning_ru?.trim() ||
    builtIn?.meaning_ru ||
    BUILT_IN_RUSSIAN_MEANINGS[key] ||
    undefined;

  const meaning_id =
    explicitMeaningId?.trim() ||
    cached?.meaning_id?.trim() ||
    meaning_ru ||
    meaning_en ||
    "";

  const cefr =
    normalizeCefrLevel(explicitCefr) ||
    normalizeCefrLevel(cached?.cefr) ||
    builtIn?.cefr ||
    undefined;

  return { meaning_id, meaning_en, meaning_ru, cefr };
}
