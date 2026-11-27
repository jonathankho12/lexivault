export type AppLanguage = "id" | "en";

export const LANGUAGE_STORAGE_KEY = "lexivault_ui_lang_v1";

export interface TranslationDictionary {
  auth: {
    subtitle: string;
    lexiInspiration: string;
    loginTab: string;
    registerTab: string;
    usernameLabel: string;
    usernamePlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    confirmPasswordLabel: string;
    confirmPasswordPlaceholder: string;
    confirmMismatch: string;
    rememberMe: string;
    submitLogin: string;
    submittingLogin: string;
    submitRegister: string;
    submittingRegister: string;
    orDivider: string;
    guestTitle: string;
    guestSubtitle: string;
    backendLabel: string;
    backendCloud: string;
    backendLocal: string;
    genericAuthError: string;
    showPassword: string;
    hidePassword: string;
  };
  nav: {
    brandSubtitle: string;
    vault: string;
    flashcards: string;
    cardsMobile: string;
    practice: string;
    grammar: string;
    ielts: string;
    discover: string;
    stats: string;
    audioAccent: string;
    sfxOn: string;
    sfxOff: string;
    dailyStreak: string;
    streakDaysSuffix: string;
    loading: string;
    cumulativePool: string;
    itemsSuffix: string;
    syncLabel: string;
    syncSupabase: string;
    syncing: string;
    syncError: string;
    syncLocal: string;
    syncGuest: string;
    cloudAccount: string;
    localAccount: string;
    guestModeLabel: string;
    guestSavedLocally: string;
    createAccountSync: string;
    logout: string;
    settings: string;
  };
  dailyPack: {
    eyebrow: string;
    modalTitle: string;
    readyPrefix: string;
    readySuffix: string;
    resumePrefix: string;
    completedTitle: string;
    pausedTitle: string;
    pausedSubtitle: string;
    startBtn: string;
    resumeBtn: string;
    reviewBtn: string;
    doLaterBtn: string;
    close: string;
    loadingTitle: string;
    loadingSubtitle: string;
    errorFallback: string;
    retryBtn: string;
    roundLabel: string;
    ofLabel: string;
    stageMemorize: string;
    stageQuiz: string;
    memorizeHint: string;
    prevCard: string;
    nextCard: string;
    startRecallQuiz: string;
    quizSubtitle: string;
    promptMeaning: string;
    promptFillBlank: string;
    correctFeedback: string;
    wrongFeedback: string;
    requeuedBadge: string;
    continueBtn: string;
    roundCompleteTitle: string;
    roundCompleteBody: string;
    nextRoundBtn: string;
    allDoneEyebrow: string;
    allDoneTitle: string;
    allDoneSubtitle: string;
    learnedListTitle: string;
    doneBtn: string;
    openFlashcardsBtn: string;
    wordsCountLabel: string;
    idiomsCountLabel: string;
    progressLabel: string;
    quotaHintPrefix: string;
  };
  vault: {
    eyebrow: string;
    title: string;
    aiSuggestBtn: string;
    extractBtn: string;
    commuteBtn: string;
    searchPlaceholder: string;
    clearSearch: string;
    allTypes: string;
    allRegisters: string;
    allLevels: string;
    allSources: string;
    newBadge: string;
    emptyTitle: string;
    emptySubtitle: string;
    emptyFilterTitle: string;
    emptyFilterSubtitle: string;
    capturePlaceholder: string;
    captureSave: string;
    captureSaving: string;
    captureSourceLabel: string;
    captureHint: string;
    duplicateExact: string;
    duplicateVariantPrefix: string;
    viewCardBtn: string;
  };
  suggest: {
    title: string;
    subtitle: string;
    categoryLabel: string;
    registerLabel: string;
    catMix: string;
    catIdiom: string;
    catVocab: string;
    catCollocation: string;
    regAny: string;
    regAcademic: string;
    regFormal: string;
    regCasual: string;
    addToVault: string;
    adding: string;
    added: string;
    generateMore: string;
    generating: string;
    loadingHint: string;
    emptyTitle: string;
    emptySubtitle: string;
    errorFallback: string;
    retryBtn: string;
    close: string;
    sourceAi: string;
    sourceCurated: string;
  };
  extractor: {
    title: string;
    subtitle: string;
    textPlaceholder: string;
    sourceLabel: string;
    extractBtn: string;
    extractingBtn: string;
    pickItemsHint: string;
    selectAll: string;
    saveSelectedBtn: string;
    savingBtn: string;
    savedPrefix: string;
    savedSuffix: string;
    emptyErr: string;
    genericErr: string;
    close: string;
    alreadyInVault: string;
  };
  wordDetail: {
    meaningTitle: string;
    examplesTitle: string;
    synonymsTitle: string;
    antonymsTitle: string;
    wordFamilyTitle: string;
    accuracyLabel: string;
    refreshAiBtn: string;
    refreshingAi: string;
    deleteBtn: string;
    confirmDeleteBtn: string;
    cancelBtn: string;
    close: string;
  };
  flashcards: {
    eyebrow: string;
    title: string;
    shuffleDeck: string;
    filterDue: string;
    filterAll: string;
    filterWeakest: string;
    filterRecent: string;
    cardWordPrefix: string;
    ofWord: string;
    doneLabel: string;
    cardsSuffix: string;
    recallCount: string;
    repeatCount: string;
    emptyVaultTitle: string;
    emptyVaultBody: string;
    emptyVaultCta: string;
    emptyDueTitle: string;
    emptyDueBody: string;
    emptyWeakTitle: string;
    emptyWeakBody: string;
    viewAllWords: string;
    sessionDoneEyebrow: string;
    sessionDoneTitlePrefix: string;
    sessionDoneTitleMid: string;
    sessionDoneTitleSuffix: string;
    sessionDoneRepeatHint: string;
    sessionDoneAllMastered: string;
    repeatAgainBtn: string;
    reloadDeckBtn: string;
    flipCard: string;
    closeMeaning: string;
    shortcutHint: string;
    rateAgain: string;
    rateHard: string;
    rateGood: string;
    rateEasy: string;
    tapFlipHint: string;
    meaningTitle: string;
    exampleTitle: string;
    synonymsLabel: string;
    antonymsLabel: string;
    swipeGood: string;
    swipeAgain: string;
    filterUnreviewed: string;
    allCaughtUpTitle: string;
    allCaughtUpSubtitle: string;
    reviewedTodayStat: string;
    accuracyTodayStat: string;
    xpTodayStat: string;
    extraPracticeBtn: string;
    extraPracticeBanner: string;
    exitExtraPractice: string;
    requeuedToast: string;
    brandNewBadge: string;
  };
  practice: {
    eyebrow: string;
    title: string;
    subtitle: string;
    poolBannerTitle: string;
    poolExpressions: string;
    commuteTitle: string;
    commuteBadge: string;
    commuteDescPrefix: string;
    commuteDescMid: string;
    commuteStart: string;
    smartMixBadge: string;
    smartMixTitle: string;
    smartMixDesc: string;
    smartMixCountSuffix: string;
    fullMarathonBadge: string;
    fullMarathonTitle: string;
    fullMarathonDesc: string;
    fullMarathonCountSuffix: string;
    weakestTitle: string;
    weakestSubtitlePrefix: string;
    weakestCta: string;
    startBtn: string;
    startMarathonBtn: string;
    modeSmartMix: string;
    modeFullMarathon: string;
    modeWeakestDrill: string;
    modeDailyMini: string;
    exitSession: string;
    summaryTitle: string;
    summaryAccuracy: string;
    summaryAgainBtn: string;
    summaryBackBtn: string;
  };
  commute: {
    exit: string;
    badge: string;
    stageFlashcardsPrefix: string;
    stageListening: string;
    stageDone: string;
    sourceLabel: string;
    accentLabel: string;
    tapToFlip: string;
    pickSm2Below: string;
    flipBack: string;
    flipCard: string;
    clipLabel: string;
    switchClip: string;
    audioLoading: string;
    audioPlaying: string;
    audioTapPlay: string;
    deviceSpeechActive: string;
    segmentsHint: string;
    finishClaimBtn: string;
    completedEyebrow: string;
    completedTitle: string;
    flashcardLabel: string;
    listeningCorrectLabel: string;
    correctAnswerLabel: string;
    yourChoiceLabel: string;
    transcriptTitle: string;
    nextClipBtn: string;
    backPracticeBtn: string;
  };
  discover: {
    eyebrow: string;
    todayFallback: string;
    title: string;
    reloadBtn: string;
    heroTitle: string;
    heroSubtitle: string;
    allSavedBtn: string;
    savingAllBtn: string;
    saveAllBtn: string;
    miniQuizBtn: string;
    saveToVault: string;
    savedInVault: string;
    saving: string;
    allInVaultTitle: string;
    allInVaultSubtitle: string;
    generateMoreTitle: string;
    generateMoreBtn: string;
    generatingMoreBtn: string;
    typeLabel: string;
    toneLabel: string;
    typeMix: string;
    toneC1C2: string;
    errorLoadMore: string;
    retryBtn: string;
    hideSaved: string;
    showAll: string;
  };
  ielts: {
    bannerEyebrow: string;
    bannerTitleFallback: string;
    retakePlacement: string;
    startPlacement: string;
    reading: string;
    listening: string;
    writing: string;
    speaking: string;
    totalSessions: string;
  };
  stats: {
    eyebrow: string;
    title: string;
    dueSuffix: string;
    masteryRank: string;
    nextRankPrefix: string;
    maxRankReached: string;
    dailyStreak: string;
    daysUnit: string;
    streakActiveHint: string;
    streakIdleHint: string;
    masteredTitle: string;
    accuracyTitle: string;
    correctLabel: string;
    ofLabel: string;
    attemptsLabel: string;
    weeklyTitle: string;
    weakestSectionTitle: string;
    weakestClearHint: string;
    drillWeakestBtn: string;
  };
  rings: {
    eyebrow: string;
    titleAllClosed: string;
    titleOpen: string;
    allClosedBadge: string;
    vocab: string;
    recall: string;
    ielts: string;
  };
  settings: {
    title: string;
    subtitle: string;
    close: string;
    sections: {
      account: string;
      language: string;
      dailyPack: string;
      audioStudy: string;
      dataStorage: string;
    };
    dailyPack: {
      wordsPerDay: string;
      wordsPerDayDesc: string;
      idiomsPerDay: string;
      idiomsPerDayDesc: string;
      targetLevelLabel: string;
      targetLevelDesc: string;
      autoShowPopup: string;
      autoShowOnDesc: string;
      autoShowOffDesc: string;
      totalPerDayPrefix: string;
      totalPerDaySuffix: string;
      pausedHint: string;
      applyTodayBtn: string;
      applyingTodayBtn: string;
      appliedTodayMsg: string;
      cloudSyncNote: string;
      guestLocalNote: string;
    };
    account: {
      username: string;
      status: string;
      statusCloud: string;
      statusLocal: string;
      statusGuest: string;
      rankXp: string;
      passwordLabel: string;
      changePasswordBtn: string;
      cancelChangeBtn: string;
      newPassword: string;
      confirmPassword: string;
      savePasswordBtn: string;
      savingPassword: string;
      passwordTooShort: string;
      passwordMismatch: string;
      passwordUpdated: string;
      guestPasswordNote: string;
      createAccountSync: string;
      logoutBtn: string;
    };
    language: {
      indonesia: string;
      indonesiaSub: string;
      english: string;
      englishSub: string;
    };
    audioStudy: {
      defaultAccent: string;
      usLabel: string;
      ukLabel: string;
      sfxLabel: string;
      sfxOnDesc: string;
      sfxMutedDesc: string;
      ringTargetsTitle: string;
      ringTargetsDesc: string;
      resetDefaults: string;
      vocabTarget: string;
      recallTarget: string;
      ieltsTarget: string;
    };
    dataStorage: {
      connectionLabel: string;
      connCloud: string;
      connError: string;
      connLocal: string;
      connGuest: string;
      savedExpressions: string;
      forceSyncTitle: string;
      forceSyncDesc: string;
      forceSyncDisabledDesc: string;
      forceSyncBtn: string;
      forceSyncingBtn: string;
      syncErrorTitle: string;
      refreshAllBtn: string;
      refreshAllDesc: string;
      refreshAllEmpty: string;
      refreshConfirmPromptPrefix: string;
      refreshConfirmPromptSuffix: string;
      refreshConfirmStartBtn: string;
      refreshCancelBtn: string;
      refreshingProgressPrefix: string;
      exportBtn: string;
      exportedMsg: string;
      clearAudioBtn: string;
      clearingAudioBtn: string;
      clearedAudioPrefix: string;
      clearedAudioSuffix: string;
    };
  };
  pwa: {
    getAndroidAppBtn: string;
    modalTitle: string;
    modalSubtitle: string;
    close: string;
    apkTitle: string;
    apkDesc: string;
    apkDownloadBtn: string;
    apkComingSoonBadge: string;
    apkComingSoonBtn: string;
    instantTitle: string;
    instantDesc: string;
    instantInstallBtn: string;
    instantInstallingBtn: string;
    installedBadge: string;
    installedNote: string;
    iosGuideTitle: string;
    iosStep1: string;
    iosStep2: string;
    androidStep1: string;
    androidStep2: string;
    androidManualHint: string;
  };
  developer: {
    builtBy: string;
    sectionTitle: string;
    name: string;
    roleSubtitle: string;
    mascotName: string;
    mascotStatus: string;
    github: string;
    linkedin: string;
    email: string;
    emailCopied: string;
  };
}

export const TRANSLATIONS: Record<AppLanguage, TranslationDictionary> = {
  id: {
    auth: {
      subtitle: "Penguasaan Bahasa Inggris & IELTS Adaptif (A1–C2)",
      lexiInspiration: "Inspirasi dari anjing setia Abel, Lexi",
      loginTab: "Masuk",
      registerTab: "Daftar Akun",
      usernameLabel: "Username",
      usernamePlaceholder: "misal: abeljonathan_dev",
      passwordLabel: "Password",
      passwordPlaceholder: "Minimal 6 karakter",
      confirmPasswordLabel: "Konfirmasi Password",
      confirmPasswordPlaceholder: "Ulangi password",
      confirmMismatch: "Konfirmasi password tidak cocok.",
      rememberMe: "Remember Me (Tetap login di perangkat ini)",
      submitLogin: "Masuk ke Vault",
      submittingLogin: "Masuk...",
      submitRegister: "Buat Akun & Mulai Belajar",
      submittingRegister: "Mendaftarkan...",
      orDivider: "atau",
      guestTitle: "Lanjutkan sebagai Tamu",
      guestSubtitle: "Continue as Guest · Tersimpan lokal di perangkat ini",
      backendLabel: "Backend Autentikasi",
      backendCloud: "Supabase Cloud Auth",
      backendLocal: "Mode Lokal (Perangkat)",
      genericAuthError: "Gagal memproses autentikasi.",
      showPassword: "Lihat password",
      hidePassword: "Sembunyikan password",
    },
    nav: {
      brandSubtitle: "Adaptive English & IELTS Mastery (A1–C2)",
      vault: "Vault",
      flashcards: "Flashcards",
      cardsMobile: "Cards",
      practice: "Practice",
      grammar: "Grammar",
      ielts: "IELTS",
      discover: "Discover",
      stats: "Stats",
      audioAccent: "Aksen Audio",
      sfxOn: "SFX On",
      sfxOff: "SFX Off",
      dailyStreak: "Daily Streak",
      streakDaysSuffix: "hari",
      loading: "Memuat...",
      cumulativePool: "Pool Kumulatif",
      itemsSuffix: "item",
      syncLabel: "Sync",
      syncSupabase: "Cloud Tersinkron",
      syncing: "Menyinkronkan...",
      syncError: "Sync Error",
      syncLocal: "Local Vault",
      syncGuest: "Local Vault (Tamu)",
      cloudAccount: "Cloud Akun",
      localAccount: "Akun Lokal",
      guestModeLabel: "Mode Tamu (Lokal)",
      guestSavedLocally: "Data tersimpan di perangkat ini",
      createAccountSync: "Buat Akun untuk Sync",
      logout: "Keluar",
      settings: "Settings",
    },
    dailyPack: {
      eyebrow: "Tantangan Belajar Harian",
      modalTitle: "Target Harian",
      readyPrefix: "Target Harian:",
      readySuffix: "Siap",
      resumePrefix: "Lanjutkan Target Harian",
      completedTitle: "Target Harian Selesai ✓",
      pausedTitle: "Target Harian Dijeda",
      pausedSubtitle: "Atur kuota Kata/Idiom di Settings untuk mengaktifkan lagi.",
      startBtn: "Mulai Target Harian",
      resumeBtn: "Lanjutkan",
      reviewBtn: "Lihat Materi Hari Ini",
      doLaterBtn: "Nanti aja",
      close: "Tutup",
      loadingTitle: "Menyiapkan Target Harian Adaptif...",
      loadingSubtitle: "Meracik kosakata & idiom sesuai level targetmu tanpa duplikat dari Vault.",
      errorFallback: "Gagal memuat Target Harian hari ini. Silakan coba lagi.",
      retryBtn: "Coba Lagi",
      roundLabel: "Ronde",
      ofLabel: "dari",
      stageMemorize: "Tahap 1 · Hafalkan Cepat",
      stageQuiz: "Tahap 2 · Kuis Recall Wajib",
      memorizeHint: "Pelajari pelafalan, arti & contoh kalimat, lalu lanjut ke kuis recall.",
      prevCard: "Sebelumnya",
      nextCard: "Berikutnya",
      startRecallQuiz: "Mulai Kuis Recall →",
      quizSubtitle: "Jawab benar untuk menyimpan otomatis ke Vault (+20 XP).",
      promptMeaning: "Pilih arti yang paling tepat:",
      promptFillBlank: "Lengkapi kalimat konteks berikut:",
      correctFeedback: "Benar! Otomatis tersimpan ke Vault (+20 XP) ✓",
      wrongFeedback: "Belum tepat — kartu ini akan diulang di akhir ronde ini.",
      requeuedBadge: "Dijadwalkan Ulang",
      continueBtn: "Lanjut →",
      roundCompleteTitle: "Ronde Tuntas! 🔥",
      roundCompleteBody: "Semua item ronde ini sudah tersimpan di Vault & siap di Flashcards.",
      nextRoundBtn: "Lanjut Ronde Berikutnya →",
      allDoneEyebrow: "Tantangan Hari Ini Tuntas",
      allDoneTitle: "Target Harian Selesai! 🎉",
      allDoneSubtitle: "Seluruh kata & idiom hari ini telah tersimpan di Vault dan siap diulas di Flashcards.",
      learnedListTitle: "Materi yang Dipelajari Hari Ini",
      doneBtn: "Selesai",
      openFlashcardsBtn: "Buka Flashcards",
      wordsCountLabel: "kata",
      idiomsCountLabel: "idiom",
      progressLabel: "Progres Hari Ini",
      quotaHintPrefix: "Target harian:",
    },
    vault: {
      eyebrow: "Leksikon Pribadi",
      title: "Vocabulary Vault",
      aiSuggestBtn: "Tambah Kata / Idiom AI",
      extractBtn: "Ekstrak dari Teks",
      commuteBtn: "5-Min Commute",
      searchPlaceholder: "Cari kata, arti Indonesia, sinonim, atau turunan...",
      clearSearch: "Hapus pencarian",
      allTypes: "Semua Tipe",
      allRegisters: "Semua Register",
      allLevels: "Semua Level",
      allSources: "Semua Sumber",
      newBadge: "Baru",
      emptyTitle: "Vault Kamu Masih Kosong",
      emptySubtitle:
        "Ketik kata atau idiom di atas untuk mengisi kosakata dengan contoh kalimat dan audio.",
      emptyFilterTitle: "Tidak Ada Hasil yang Cocok",
      emptyFilterSubtitle: "Coba ubah filter atau kata kunci pencarianmu.",
      capturePlaceholder: "Ketik 1 kata atau idiom (misal: gentrified)...",
      captureSave: "Save",
      captureSaving: "AI Fill",
      captureSourceLabel: "Sumber:",
      captureHint: "Auto-kategori AI: Vocab / Idiom / Collocation & Register",
      duplicateExact: "Sudah terdaftar di Vault",
      duplicateVariantPrefix: "Sudah terdaftar di Vault sebagai",
      viewCardBtn: "Lihat Kartu",
    },
    suggest: {
      title: "Tambah Kata / Idiom AI",
      subtitle:
        "Temukan ekspresi bahasa Inggris adaptif (A1–C2) yang belum ada di Vault-mu, lalu simpan dalam 1 klik.",
      categoryLabel: "Kategori",
      registerLabel: "Register / Nada",
      catMix: "Mix (A1–C2)",
      catIdiom: "Idiom",
      catVocab: "Vocab",
      catCollocation: "Collocation",
      regAny: "Semua",
      regAcademic: "Academic",
      regFormal: "Formal",
      regCasual: "Casual",
      addToVault: "+ Simpan ke Vault",
      adding: "Menyimpan...",
      added: "Tersimpan ✓",
      generateMore: "Cari Lagi",
      generating: "Mencari...",
      loadingHint: "AI sedang meracik 4 ekspresi baru tanpa duplikat...",
      emptyTitle: "Semua saran pada filter ini sudah ada di Vault",
      emptySubtitle:
        "Coba ganti filter kategori/register atau klik Cari Lagi untuk batch segar.",
      errorFallback: "Gagal memuat saran AI. Silakan coba lagi.",
      retryBtn: "Coba Lagi",
      close: "Tutup",
      sourceAi: "Gemini AI · A1–C2",
      sourceCurated: "Kurasi A1–C2",
    },
    extractor: {
      title: "Paste & Panen Kata",
      subtitle:
        "Tempel paragraf artikel, catatan kuliah, atau cerita — AI mengekstrak kosakata & idiom penting (A1–C2) sekaligus.",
      textPlaceholder:
        "Tempel teks bahasa Inggris di sini (minimal 15 karakter)...",
      sourceLabel: "Tag Sumber",
      extractBtn: "Ekstrak Kosakata",
      extractingBtn: "Menganalisis Teks...",
      pickItemsHint: "Centang item yang ingin disimpan ke Vault:",
      selectAll: "Pilih Semua",
      saveSelectedBtn: "Simpan Terpilih",
      savingBtn: "Menyimpan...",
      savedPrefix: "Berhasil menyimpan",
      savedSuffix: "ekspresi ke Vault!",
      emptyErr:
        "Tidak ditemukan kosakata/idiom menonjol dari teks ini. Coba paragraf yang lebih kaya.",
      genericErr: "Gagal mengekstrak kosakata. Coba ulangi.",
      close: "Tutup",
      alreadyInVault: "Sudah di Vault",
    },
    wordDetail: {
      meaningTitle: "Arti Bahasa Indonesia",
      examplesTitle: "Contoh Kalimat",
      synonymsTitle: "Sinonim",
      antonymsTitle: "Antonim",
      wordFamilyTitle: "Word Family",
      accuracyLabel: "Akurasi",
      refreshAiBtn: "Perbarui Detail AI",
      refreshingAi: "Memperbarui...",
      deleteBtn: "Hapus Kata",
      confirmDeleteBtn: "Konfirmasi Hapus",
      cancelBtn: "Batal",
      close: "Tutup",
    },
    flashcards: {
      eyebrow: "Deck Spaced Repetition SM-2",
      title: "Flashcards",
      shuffleDeck: "Acak Deck",
      filterDue: "Antrean Cerdas",
      filterAll: "Semua Kata",
      filterWeakest: "Belum Hafal / Weakest",
      filterRecent: "Baru Ditambahkan",
      cardWordPrefix: "Kartu",
      ofWord: "dari",
      doneLabel: "Selesai",
      cardsSuffix: "kartu",
      recallCount: "Recall",
      repeatCount: "Ulangi",
      emptyVaultTitle: "Vault Masih Kosong",
      emptyVaultBody:
        "Simpan kosakata atau idiom pertamamu di tab Vault atau Discover untuk mulai berlatih.",
      emptyVaultCta: "Tambah Kata di Vault",
      emptyDueTitle: "Semua Review Hari Ini Selesai!",
      emptyDueBody:
        "Jadwal SM-2 hari ini sudah bersih. Kamu tetap bisa berlatih bebas lewat filter Semua Kata.",
      emptyWeakTitle: "Semua Kata Sudah Hafal!",
      emptyWeakBody:
        "Tidak ada kata yang masuk kategori Belum Hafal / Weakest saat ini.",
      viewAllWords: "Lihat Semua Kata",
      sessionDoneEyebrow: "Sesi SM-2 Selesai",
      sessionDoneTitlePrefix: "",
      sessionDoneTitleMid: "dari",
      sessionDoneTitleSuffix: "Kartu Dikuasai",
      sessionDoneRepeatHint:
        "kartu dijadwalkan ulang < 1 hari agar makin melekat.",
      sessionDoneAllMastered:
        "Luar biasa! Seluruh kartu berhasil dijadwalkan ke interval SM-2 berikutnya.",
      repeatAgainBtn: "Ulangi yang Again",
      reloadDeckBtn: "Muat Ulang Deck",
      flipCard: "Balik Kartu (Space)",
      closeMeaning: "Tutup Arti (Space)",
      shortcutHint:
        "Shortcut Keyboard: Space balik kartu · 1 / 2 / 3 / 4 rating SM-2 · ← / → Again / Good",
      rateAgain: "Again",
      rateHard: "Hard",
      rateGood: "Good",
      rateEasy: "Easy",
      tapFlipHint: "Tap kartu untuk melihat arti & contoh",
      meaningTitle: "Arti Bahasa Indonesia",
      exampleTitle: "Contoh Kalimat",
      synonymsLabel: "Sinonim",
      antonymsLabel: "Antonim",
      swipeGood: "Good",
      swipeAgain: "Again",
      filterUnreviewed: "Belum Diulas Hari Ini",
      allCaughtUpTitle: "Semua flashcard hari ini sudah selesai! 🎉",
      allCaughtUpSubtitle:
        "Tidak ada kartu tersisa untuk hari ini. Kartu baru yang kamu simpan di Vault atau Target Harian otomatis muncul di sini.",
      reviewedTodayStat: "Diulas Hari Ini",
      accuracyTodayStat: "Akurasi Hari Ini",
      xpTodayStat: "XP Hari Ini",
      extraPracticeBtn: "Latihan Ekstra (Ulangi Kartu Selesai)",
      extraPracticeBanner:
        "Mode Latihan Ekstra · Mengulas ulang kartu yang sudah selesai hari ini",
      exitExtraPractice: "Kembali ke Antrean Harian",
      requeuedToast:
        "Dijadwalkan ulang di akhir sesi ini agar lebih melekat",
      brandNewBadge: "Baru · Belum Diulas",
    },
    practice: {
      eyebrow: "Mesin Recall Kumulatif",
      title: "Daily Recall Practice",
      subtitle:
        "Menguji seluruh kata, idiom, dan collocation kumulatif dari Hari 1 sampai hari ini.",
      poolBannerTitle: "Total Pool Materi (Hari 1 – Hari Ini)",
      poolExpressions: "Ekspresi Tersimpan",
      commuteTitle: "5-Min Commute Mode",
      commuteBadge: "Satu Tangan · +45 XP",
      commuteDescPrefix: "5 Flashcard SM-2 jatuh tempo (",
      commuteDescMid: "siap) + 1 Mini Listening Clip (2 soal tap).",
      commuteStart: "Mulai Commute",
      smartMixBadge: "Rekomendasi Harian",
      smartMixTitle: "Daily Smart Mix",
      smartMixDesc:
        "Hingga 20 soal dari seluruh pool kumulatif dengan prioritas untuk kata terbaru dan yang paling sering salah.",
      smartMixCountSuffix: "Soal Campuran",
      fullMarathonBadge: "Sapu Bersih",
      fullMarathonTitle: "Full Marathon",
      fullMarathonDesc:
        "Uji tuntas 100% seluruh kosakata, idiom, dan collocation yang tersimpan di Vault.",
      fullMarathonCountSuffix: "Soal Lengkap",
      weakestTitle: "Drill Weakest Words",
      weakestSubtitlePrefix: "Fokus perbaiki kata dengan rasio salah tertinggi:",
      weakestCta: "Drill Sekarang",
      startBtn: "Mulai",
      startMarathonBtn: "Mulai Marathon",
      modeSmartMix: "Daily Smart Mix",
      modeFullMarathon: "Full Marathon",
      modeWeakestDrill: "Weakest Drill",
      modeDailyMini: "Daily Mini-Quiz",
      exitSession: "Keluar sesi latihan",
      summaryTitle: "Hasil Sesi Latihan",
      summaryAccuracy: "Akurasi Sesi",
      summaryAgainBtn: "Latihan Lagi",
      summaryBackBtn: "Pilih Mode Lain",
    },
    commute: {
      exit: "Keluar",
      badge: "5-Min Commute",
      stageFlashcardsPrefix: "Tahap 1/2 · Flashcard",
      stageListening: "Tahap 2/2 · Mini Listening (2 Soal Tap)",
      stageDone: "Commute Selesai!",
      sourceLabel: "Sumber:",
      accentLabel: "Aksen",
      tapToFlip: "Tap kartu untuk lihat arti & contoh",
      pickSm2Below: "Pilih tingkat ingatan SM-2 di bawah",
      flipBack: "Balik ke Depan",
      flipCard: "Balik Kartu",
      clipLabel: "Mini Listening Clip",
      switchClip: "Ganti Klip",
      audioLoading: "Memuat audio multi-aksen...",
      audioPlaying: "Sedang diputar — dengarkan detail utama",
      audioTapPlay: "Tap Play untuk mendengarkan klip singkat",
      deviceSpeechActive: "Mode suara perangkat aktif.",
      segmentsHint: "segmen dialog cepat · Tap jawaban di bawah",
      finishClaimBtn: "Selesai & Klaim +45 XP",
      completedEyebrow: "5-Min Commute Tuntas",
      completedTitle: "+45 XP Commute Bonus!",
      flashcardLabel: "flashcard SM-2",
      listeningCorrectLabel: "Listening benar",
      correctAnswerLabel: "Jawaban benar:",
      yourChoiceLabel: "kamu pilih:",
      transcriptTitle: "Transkrip Singkat",
      nextClipBtn: "Klip Commute Lainnya",
      backPracticeBtn: "Kembali ke Practice",
    },
    discover: {
      eyebrow: "Paket Kurasi Harian",
      todayFallback: "Hari Ini",
      title: "Daily New Discovery",
      reloadBtn: "Muat Ulang",
      heroTitle: "Paket Harian Adaptif",
      heroSubtitle:
        "Simpan ke Vault untuk masuk otomatis ke pool tes kumulatif, atau langsung uji kemampuan lewat mini-quiz hari ini.",
      allSavedBtn: "Semua Tersimpan",
      savingAllBtn: "Menyimpan...",
      saveAllBtn: "Save All to Vault",
      miniQuizBtn: "Start Daily Mini-Quiz",
      saveToVault: "Simpan ke Vault",
      savedInVault: "Tersimpan di Vault",
      saving: "Menyimpan...",
      allInVaultTitle: "Semua kata di Discover sudah ada di Vault!",
      allInVaultSubtitle:
        "Buat batch kosakata, idiom, atau kolokasi A1–C2 baru yang belum ada di Vault-mu.",
      generateMoreTitle: "Tambah Kata & Idiom Tanpa Batas",
      generateMoreBtn: "+ Tambah Kata & Idiom Baru",
      generatingMoreBtn: "Meracik Ekspresi Baru...",
      typeLabel: "Tipe",
      toneLabel: "Nada / Level",
      typeMix: "Mix (Semua)",
      toneC1C2: "Adaptive",
      errorLoadMore: "Gagal memuat kata tambahan. Coba lagi.",
      retryBtn: "Coba Lagi",
      hideSaved: "Hanya yang Baru",
      showAll: "Tampilkan Semua",
    },
    ielts: {
      bannerEyebrow: "Pelacak IELTS & CEFR Adaptif (A1–C2)",
      bannerTitleFallback: "Peta Kemampuan Bahasa Inggris & IELTS Kamu",
      retakePlacement: "Ulangi Placement Test",
      startPlacement: "Mulai Placement Test",
      reading: "Reading",
      listening: "Listening",
      writing: "Writing",
      speaking: "Speaking",
      totalSessions: "Total sesi IELTS selesai:",
    },
    stats: {
      eyebrow: "Analitik Belajar",
      title: "Progres & Kata Terlemah",
      dueSuffix: "SM-2 jatuh tempo",
      masteryRank: "Mastery Rank",
      nextRankPrefix: "Berikutnya:",
      maxRankReached: "Rank Tertinggi Tercapai!",
      dailyStreak: "Daily Streak",
      daysUnit: "Hari",
      streakActiveHint: "Pertahankan ritme belajarmu!",
      streakIdleHint: "Selesaikan latihan hari ini untuk memulai streak.",
      masteredTitle: "Kata Dikuasai",
      accuracyTitle: "Akurasi Recall",
      correctLabel: "benar dari",
      ofLabel: "dari",
      attemptsLabel: "percobaan",
      weeklyTitle: "Aktivitas 7 Hari Terakhir",
      weakestSectionTitle: "Top Weakest Words",
      weakestClearHint:
        "Jawab benar 2× berturut-turut untuk menghapus kata dari daftar ini.",
      drillWeakestBtn: "Latih Semua",
    },
    rings: {
      eyebrow: "Daily Activity Rings",
      titleAllClosed: "Semua Ring Hari Ini Penuh!",
      titleOpen: "Tutup 3 Target Harianmu",
      allClosedBadge: "Semua Penuh",
      vocab: "Vocab",
      recall: "Recall",
      ielts: "IELTS",
    },
    settings: {
      title: "Settings",
      subtitle: "Preferensi Akun, Bahasa, Audio & Data",
      close: "Tutup Settings",
      sections: {
        account: "Akun & Keamanan",
        language: "Bahasa Interface",
        dailyPack: "Target Harian (Daily Pack)",
        audioStudy: "Preferensi Audio & Belajar",
        dataStorage: "Data & Penyimpanan",
      },
      dailyPack: {
        wordsPerDay: "Kata Baru / Hari",
        wordsPerDayDesc: "Kosakata baru sesuai target levelmu (0–30)",
        idiomsPerDay: "Idiom Baru / Hari",
        idiomsPerDayDesc: "Idiom & frasa baru sesuai target levelmu (0–20)",
        targetLevelLabel: "Target Level CEFR",
        targetLevelDesc: "Pilih tier kesulitan paket harian atau gunakan Auto sesuai Placement Test.",
        autoShowPopup: "Tampilkan Pop-up Otomatis Tiap Hari",
        autoShowOnDesc:
          "Aktif — pop-up Target Harian muncul otomatis sekali sehari saat membuka Vault",
        autoShowOffDesc:
          "Nonaktif — kamu tetap bisa memulai Target Harian secara manual dari banner Vault",
        totalPerDayPrefix: "Total Target Harian:",
        totalPerDaySuffix: "item / hari",
        pausedHint:
          "Target Harian sedang dijeda (0 kata & 0 idiom). Naikkan salah satu kuota untuk mengaktifkan kembali.",
        applyTodayBtn: "Terapkan ke Paket Hari Ini",
        applyingTodayBtn: "Memperbarui Paket...",
        appliedTodayMsg: "Paket hari ini diperbarui sesuai kuota baru!",
        cloudSyncNote: "Tersinkron ke Cloud Supabase",
        guestLocalNote: "Tersimpan lokal di perangkat ini",
      },
      account: {
        username: "Username Aktif",
        status: "Status Akun",
        statusCloud: "Cloud Tersinkron",
        statusLocal: "Akun Lokal",
        statusGuest: "Mode Tamu (Guest Mode)",
        rankXp: "Mastery Rank & XP",
        passwordLabel: "Password",
        changePasswordBtn: "Ubah Password",
        cancelChangeBtn: "Batal",
        newPassword: "Password Baru",
        confirmPassword: "Konfirmasi Password",
        savePasswordBtn: "Simpan Password",
        savingPassword: "Menyimpan...",
        passwordTooShort: "Password baru minimal 6 karakter.",
        passwordMismatch: "Konfirmasi password tidak cocok.",
        passwordUpdated: "Password berhasil diperbarui!",
        guestPasswordNote:
          "Mode Tamu tidak menggunakan password. Buat akun untuk menyinkronkan progress ke Cloud.",
        createAccountSync: "Buat Akun untuk Sync",
        logoutBtn: "Keluar (Logout)",
      },
      language: {
        indonesia: "Bahasa Indonesia",
        indonesiaSub: "Tampilan aplikasi berbahasa Indonesia",
        english: "English",
        englishSub: "Full English interface across all tabs",
      },
      audioStudy: {
        defaultAccent: "Default Audio Accent",
        usLabel: "US American",
        ukLabel: "UK British",
        sfxLabel: "Micro Sound Effects (SFX)",
        sfxOnDesc: "Aktif — efek suara lembut saat flip, benar & ring penuh",
        sfxMutedDesc: "Senyap — seluruh efek suara antarmuka dimatikan",
        ringTargetsTitle: "Target Harian Daily Rings",
        ringTargetsDesc:
          "Atur target penutupan harian untuk Vocab, Recall, dan IELTS.",
        resetDefaults: "Reset Default",
        vocabTarget: "Vocab / hari",
        recallTarget: "Recall / hari",
        ieltsTarget: "Sesi IELTS",
      },
      dataStorage: {
        connectionLabel: "Status Koneksi",
        connCloud: "Supabase Cloud Live",
        connError: "Sync Error (Lihat Detail di Bawah)",
        connLocal: "Local Vault (Perangkat)",
        connGuest: "Mode Tamu · LocalStorage Perangkat",
        savedExpressions: "Total Kosakata",
        forceSyncTitle: "Sinkronisasi Cloud Vault",
        forceSyncDesc:
          "Gabungkan & unggah seluruh kata lokal, progres review, dan pengaturan ke Supabase Cloud.",
        forceSyncDisabledDesc:
          "Masuk dengan akun Cloud untuk menyinkronkan Vault antar perangkat.",
        forceSyncBtn: "Force Sync Now",
        forceSyncingBtn: "Menyinkronkan...",
        syncErrorTitle: "Error Sinkronisasi Supabase",
        refreshAllBtn: "Refresh All AI Details",
        refreshAllDesc:
          "Perbarui ulang CEFR (A1–C2), register, fonetik, arti & contoh kalimat satu per satu (~400ms jeda aman).",
        refreshAllEmpty: "Belum ada kata tersimpan di Vault.",
        refreshConfirmPromptPrefix:
          "Perbarui ulang detail AI (CEFR & register) untuk seluruh",
        refreshConfirmPromptSuffix: "item tersimpan secara berurutan?",
        refreshConfirmStartBtn: "Mulai Refresh",
        refreshCancelBtn: "Batal",
        refreshingProgressPrefix: "Memperbarui",
        exportBtn: "Export Vault ke JSON",
        exportedMsg: "Backup JSON berhasil diunduh.",
        clearAudioBtn: "Bersihkan Cache Audio (IndexedDB)",
        clearingAudioBtn: "Membersihkan...",
        clearedAudioPrefix: "Cache audio dibersihkan (",
        clearedAudioSuffix: "klip dihapus).",
      },
    },
    pwa: {
      getAndroidAppBtn: "Get Android App",
      modalTitle: "LexiVault App",
      modalSubtitle: "Pasang LexiVault sebagai aplikasi layar penuh di HP atau Laptop",
      close: "Tutup",
      apkTitle: "Download APK (Android)",
      apkDesc: "File installer .apk native-wrapped untuk perangkat Android.",
      apkDownloadBtn: "Download Android APK",
      apkComingSoonBadge: "Coming Soon",
      apkComingSoonBtn: "APK segera tersedia / Coming Soon",
      instantTitle: "Install Instant (Web App / iOS & Android)",
      instantDesc:
        "Bekerja layar penuh (standalone), ikon home screen, dan cache cepat tanpa toko aplikasi.",
      instantInstallBtn: "Install Sekarang (PWA)",
      instantInstallingBtn: "Memasang...",
      installedBadge: "Terpasang",
      installedNote:
        "LexiVault sudah terpasang sebagai Web App di perangkat ini.",
      iosGuideTitle: "Panduan 2 Langkah Add to Home Screen:",
      iosStep1: "Ketuk ikon Bagikan (Share) pada bilah browser Safari.",
      iosStep2: "Pilih 'Add to Home Screen' / 'Tambahkan ke Layar Utama'.",
      androidStep1: "Ketuk menu titik tiga (⋮) di pojok kanan atas browser Chrome.",
      androidStep2: "Pilih 'Install app' atau 'Add to Home screen', lalu konfirmasi.",
      androidManualHint:
        "Buka menu titik tiga browser (⋮), lalu pilih 'Install app' atau 'Add to Home screen'.",
    },
    developer: {
      builtBy: "Dibuat oleh Abel Jonathan",
      sectionTitle: "Tentang Pengembang",
      name: "Abel Jonathan",
      roleSubtitle: "Pembuat LexiVault",
      mascotName: "Lexi",
      mascotStatus: "The Real-life Lexi (Maskot Rottweiler)",
      github: "GitHub",
      linkedin: "LinkedIn",
      email: "Email",
      emailCopied: "abeljonathankho@gmail.com disalin!",
    },
  },
  en: {
    auth: {
      subtitle: "Adaptive English & IELTS Mastery (A1–C2)",
      lexiInspiration: "Inspired by Abel's loyal Rottweiler, Lexi",
      loginTab: "Sign In",
      registerTab: "Create Account",
      usernameLabel: "Username",
      usernamePlaceholder: "e.g. abeljonathan_dev",
      passwordLabel: "Password",
      passwordPlaceholder: "At least 6 characters",
      confirmPasswordLabel: "Confirm Password",
      confirmPasswordPlaceholder: "Repeat password",
      confirmMismatch: "Password confirmation does not match.",
      rememberMe: "Remember Me (Stay signed in on this device)",
      submitLogin: "Sign In to Vault",
      submittingLogin: "Signing in...",
      submitRegister: "Create Account & Start",
      submittingRegister: "Creating account...",
      orDivider: "or",
      guestTitle: "Continue as Guest",
      guestSubtitle: "Stored locally on this device · No account required",
      backendLabel: "Auth Backend",
      backendCloud: "Supabase Cloud Auth",
      backendLocal: "Local Mode (Device)",
      genericAuthError: "Authentication failed.",
      showPassword: "Show password",
      hidePassword: "Hide password",
    },
    nav: {
      brandSubtitle: "Adaptive English & IELTS Mastery (A1–C2)",
      vault: "Vault",
      flashcards: "Flashcards",
      cardsMobile: "Cards",
      practice: "Practice",
      grammar: "Grammar",
      ielts: "IELTS",
      discover: "Discover",
      stats: "Stats",
      audioAccent: "Audio Accent",
      sfxOn: "SFX On",
      sfxOff: "SFX Off",
      dailyStreak: "Daily Streak",
      streakDaysSuffix: "days",
      loading: "Loading...",
      cumulativePool: "Cumulative Pool",
      itemsSuffix: "items",
      syncLabel: "Sync",
      syncSupabase: "Cloud Synced",
      syncing: "Syncing...",
      syncError: "Sync Error",
      syncLocal: "Local Vault",
      syncGuest: "Local Vault (Guest)",
      cloudAccount: "Cloud Account",
      localAccount: "Local Account",
      guestModeLabel: "Guest Mode (Local)",
      guestSavedLocally: "Saved locally on this device",
      createAccountSync: "Create Account to Sync",
      logout: "Sign Out",
      settings: "Settings",
    },
    dailyPack: {
      eyebrow: "Daily Learning Challenge",
      modalTitle: "Daily Pack",
      readyPrefix: "Daily Pack:",
      readySuffix: "Ready",
      resumePrefix: "Resume Daily Pack",
      completedTitle: "Daily Pack Completed ✓",
      pausedTitle: "Daily Pack Paused",
      pausedSubtitle: "Increase Words or Idioms quota in Settings to re-enable.",
      startBtn: "Start Daily Pack",
      resumeBtn: "Resume",
      reviewBtn: "Review Today's Pack",
      doLaterBtn: "Do it later",
      close: "Close",
      loadingTitle: "Curating Today's Adaptive Daily Pack...",
      loadingSubtitle: "Selecting fresh vocabulary & idioms tailored to your target level.",
      errorFallback: "Failed to load today's Daily Pack. Please try again.",
      retryBtn: "Try Again",
      roundLabel: "Round",
      ofLabel: "of",
      stageMemorize: "Stage 1 · Quick Memorize",
      stageQuiz: "Stage 2 · Mandatory Recall Quiz",
      memorizeHint: "Review pronunciation, meaning & example, then prove recall to save.",
      prevCard: "Previous",
      nextCard: "Next",
      startRecallQuiz: "Start Recall Quiz →",
      quizSubtitle: "Pass each item to auto-save to your Vault (+20 XP).",
      promptMeaning: "Choose the accurate meaning:",
      promptFillBlank: "Complete the sentence in context:",
      correctFeedback: "Correct! Auto-saved to your Vault (+20 XP) ✓",
      wrongFeedback: "Not quite — this item will return at the end of this round.",
      requeuedBadge: "Re-queued",
      continueBtn: "Continue →",
      roundCompleteTitle: "Round Complete! 🔥",
      roundCompleteBody: "All items in this round are saved in your Vault & ready in Flashcards.",
      nextRoundBtn: "Start Next Round →",
      allDoneEyebrow: "Today's Challenge Complete",
      allDoneTitle: "Daily Pack Completed! 🎉",
      allDoneSubtitle: "All of today's words & idioms have been saved to your Vault and synced to Flashcards.",
      learnedListTitle: "Items Learned Today",
      doneBtn: "Done",
      openFlashcardsBtn: "Open Flashcards",
      wordsCountLabel: "words",
      idiomsCountLabel: "idioms",
      progressLabel: "Today's Progress",
      quotaHintPrefix: "Daily quota:",
    },
    vault: {
      eyebrow: "Personal Lexicon",
      title: "Vocabulary Vault",
      aiSuggestBtn: "AI Suggest Idiom / Word",
      extractBtn: "Extract from Text",
      commuteBtn: "5-Min Commute",
      searchPlaceholder: "Search term, meaning, synonyms, or word family...",
      clearSearch: "Clear search",
      allTypes: "All Types",
      allRegisters: "All Registers",
      allLevels: "All Levels",
      allSources: "All Sources",
      newBadge: "New",
      emptyTitle: "Your Vault Is Still Empty",
      emptySubtitle:
        "Type a word or idiom above to auto-fill definitions, examples, and US/UK audio.",
      emptyFilterTitle: "No Matching Expressions",
      emptyFilterSubtitle: "Try adjusting your filters or search query.",
      capturePlaceholder: "Type a word or idiom (e.g. gentrified)...",
      captureSave: "Save",
      captureSaving: "AI Fill",
      captureSourceLabel: "Source:",
      captureHint: "AI auto-tags: Vocab / Idiom / Collocation & Register",
      duplicateExact: "Already registered in your Vault",
      duplicateVariantPrefix: "Already in Vault as",
      viewCardBtn: "View Card",
    },
    suggest: {
      title: "AI Suggest Idiom / Word",
      subtitle:
        "Discover fresh adaptive English expressions (A1–C2) not yet in your Vault and save them in one click.",
      categoryLabel: "Category",
      registerLabel: "Register / Tone",
      catMix: "Mix (A1–C2)",
      catIdiom: "Idiom",
      catVocab: "Vocab",
      catCollocation: "Collocation",
      regAny: "Any",
      regAcademic: "Academic",
      regFormal: "Formal",
      regCasual: "Casual",
      addToVault: "+ Add to Vault",
      adding: "Adding...",
      added: "Added ✓",
      generateMore: "Generate More",
      generating: "Generating...",
      loadingHint: "AI is curating 4 fresh non-duplicate expressions...",
      emptyTitle: "All suggestions in this filter are already in your Vault",
      emptySubtitle:
        "Try switching the category or register filter, or tap Generate More for a new batch.",
      errorFallback: "Failed to load AI suggestions. Please try again.",
      retryBtn: "Try Again",
      close: "Close",
      sourceAi: "Gemini AI · A1–C2",
      sourceCurated: "Curated A1–C2",
    },
    extractor: {
      title: "Paste & Harvest Vocabulary",
      subtitle:
        "Paste an article paragraph, lecture notes, or story — AI extracts key vocabulary & idioms (A1–C2) at once.",
      textPlaceholder: "Paste English text here (minimum 15 characters)...",
      sourceLabel: "Source Tag",
      extractBtn: "Extract Vocabulary",
      extractingBtn: "Analyzing Text...",
      pickItemsHint: "Select items to save into your Vault:",
      selectAll: "Select All",
      saveSelectedBtn: "Save Selected",
      savingBtn: "Saving...",
      savedPrefix: "Successfully saved",
      savedSuffix: "expressions to Vault!",
      emptyErr:
        "No notable vocabulary or idioms detected. Try a richer paragraph.",
      genericErr: "Failed to extract vocabulary. Please try again.",
      close: "Close",
      alreadyInVault: "Already in Vault",
    },
    wordDetail: {
      meaningTitle: "Definition",
      examplesTitle: "Example Sentences",
      synonymsTitle: "Synonyms",
      antonymsTitle: "Antonyms",
      wordFamilyTitle: "Word Family",
      accuracyLabel: "Accuracy",
      refreshAiBtn: "Refresh AI Details",
      refreshingAi: "Refreshing...",
      deleteBtn: "Delete Word",
      confirmDeleteBtn: "Confirm Delete",
      cancelBtn: "Cancel",
      close: "Close",
    },
    flashcards: {
      eyebrow: "SM-2 Spaced Repetition Deck",
      title: "Flashcards",
      shuffleDeck: "Shuffle Deck",
      filterDue: "Smart Queue",
      filterAll: "All Words",
      filterWeakest: "Weakest / Unmastered",
      filterRecent: "Recently Added",
      cardWordPrefix: "Card",
      ofWord: "of",
      doneLabel: "Complete",
      cardsSuffix: "cards",
      recallCount: "Recalled",
      repeatCount: "Repeat",
      emptyVaultTitle: "Vault Is Empty",
      emptyVaultBody:
        "Save your first vocabulary word or idiom in Vault or Discover to start flashcard recall.",
      emptyVaultCta: "Add Words in Vault",
      emptyDueTitle: "All Due Reviews Done Today!",
      emptyDueBody:
        "Your SM-2 queue for today is clear. Switch to All Words anytime for extra practice.",
      emptyWeakTitle: "All Words Mastered!",
      emptyWeakBody: "No words currently fall under Weakest / Unmastered.",
      viewAllWords: "View All Words",
      sessionDoneEyebrow: "SM-2 Session Complete",
      sessionDoneTitlePrefix: "",
      sessionDoneTitleMid: "of",
      sessionDoneTitleSuffix: "Cards Recalled",
      sessionDoneRepeatHint:
        "cards rescheduled < 1 day to reinforce retention.",
      sessionDoneAllMastered:
        "Awesome! All cards advanced to their next SM-2 intervals.",
      repeatAgainBtn: "Repeat 'Again' Cards",
      reloadDeckBtn: "Reload Deck",
      flipCard: "Flip Card (Space)",
      closeMeaning: "Hide Meaning (Space)",
      shortcutHint:
        "Keyboard Shortcuts: Space to flip · 1 / 2 / 3 / 4 SM-2 rating · ← / → Again / Good",
      rateAgain: "Again",
      rateHard: "Hard",
      rateGood: "Good",
      rateEasy: "Easy",
      tapFlipHint: "Tap card to reveal meaning & example",
      meaningTitle: "Definition",
      exampleTitle: "Example Sentence",
      synonymsLabel: "Synonyms",
      antonymsLabel: "Antonyms",
      swipeGood: "Good",
      swipeAgain: "Again",
      filterUnreviewed: "Unreviewed Today",
      allCaughtUpTitle: "All caught up for today! 🎉",
      allCaughtUpSubtitle:
        "Zero cards remaining for today. Any new words you save in Vault or Daily Pack will appear here automatically.",
      reviewedTodayStat: "Reviewed Today",
      accuracyTodayStat: "Today's Accuracy",
      xpTodayStat: "XP Earned Today",
      extraPracticeBtn: "Extra Practice (Review Completed Cards)",
      extraPracticeBanner:
        "Extra Practice Mode · Reviewing cards already completed today",
      exitExtraPractice: "Back to Daily Queue",
      requeuedToast: "Re-queued later in this session until recalled",
      brandNewBadge: "New · Unreviewed",
    },
    practice: {
      eyebrow: "Cumulative Recall Engine",
      title: "Daily Recall Practice",
      subtitle:
        "Tests your entire cumulative pool of vocabulary, idioms, and collocations from Day 1.",
      poolBannerTitle: "Total Study Pool (Day 1 – Today)",
      poolExpressions: "Saved Expressions",
      commuteTitle: "5-Min Commute Mode",
      commuteBadge: "One-Handed · +45 XP",
      commuteDescPrefix: "5 due SM-2 flashcards (",
      commuteDescMid: "ready) + 1 Mini Listening Clip (2 tap MCQs).",
      commuteStart: "Start Commute",
      smartMixBadge: "Daily Pick",
      smartMixTitle: "Daily Smart Mix",
      smartMixDesc:
        "Up to 20 questions across your vault prioritizing recent items and high-error words.",
      smartMixCountSuffix: "Mixed Questions",
      fullMarathonBadge: "Complete Sweep",
      fullMarathonTitle: "Full Marathon",
      fullMarathonDesc:
        "Full test covering 100% of your saved vocabulary, idioms, and collocations.",
      fullMarathonCountSuffix: "Full Questions",
      weakestTitle: "Drill Weakest Words",
      weakestSubtitlePrefix: "Target your highest miss-rate items:",
      weakestCta: "Drill Now",
      startBtn: "Start",
      startMarathonBtn: "Start Marathon",
      modeSmartMix: "Daily Smart Mix",
      modeFullMarathon: "Full Marathon",
      modeWeakestDrill: "Weakest Drill",
      modeDailyMini: "Daily Mini-Quiz",
      exitSession: "Exit practice session",
      summaryTitle: "Practice Summary",
      summaryAccuracy: "Session Accuracy",
      summaryAgainBtn: "Practice Again",
      summaryBackBtn: "Choose Another Mode",
    },
    commute: {
      exit: "Exit",
      badge: "5-Min Commute",
      stageFlashcardsPrefix: "Step 1/2 · Flashcard",
      stageListening: "Step 2/2 · Mini Listening (2 Tap Questions)",
      stageDone: "Commute Complete!",
      sourceLabel: "Source:",
      accentLabel: "Accent",
      tapToFlip: "Tap card to view meaning & example",
      pickSm2Below: "Choose an SM-2 recall rating below",
      flipBack: "Flip to Front",
      flipCard: "Flip Card",
      clipLabel: "Mini Listening Clip",
      switchClip: "Switch Clip",
      audioLoading: "Loading multi-accent audio...",
      audioPlaying: "Playing — listen for key details",
      audioTapPlay: "Tap Play to hear the short clip",
      deviceSpeechActive: "Device speech fallback active.",
      segmentsHint: "quick dialogue turns · Tap your answers below",
      finishClaimBtn: "Finish & Claim +45 XP",
      completedEyebrow: "5-Min Commute Complete",
      completedTitle: "+45 XP Commute Bonus!",
      flashcardLabel: "SM-2 flashcards",
      listeningCorrectLabel: "Listening correct",
      correctAnswerLabel: "Correct answer:",
      yourChoiceLabel: "you picked:",
      transcriptTitle: "Short Transcript",
      nextClipBtn: "Next Commute Clip",
      backPracticeBtn: "Back to Practice",
    },
    discover: {
      eyebrow: "Curated Daily Pack",
      todayFallback: "Today",
      title: "Daily New Discovery",
      reloadBtn: "Refresh",
      heroTitle: "Adaptive Daily Pack",
      heroSubtitle:
        "Save to your Vault to include in cumulative drills, or test yourself immediately with today's mini-quiz.",
      allSavedBtn: "All Saved",
      savingAllBtn: "Saving...",
      saveAllBtn: "Save All to Vault",
      miniQuizBtn: "Start Daily Mini-Quiz",
      saveToVault: "Save to Vault",
      savedInVault: "Saved in Vault",
      saving: "Saving...",
      allInVaultTitle: "All Discover items are already in your Vault!",
      allInVaultSubtitle:
        "Generate a fresh batch of A1–C2 vocabulary, idioms, or collocations excluded from your Vault.",
      generateMoreTitle: "Endless AI Discovery",
      generateMoreBtn: "+ Generate More Words & Idioms",
      generatingMoreBtn: "Generating Fresh Expressions...",
      typeLabel: "Type",
      toneLabel: "Tone / Level",
      typeMix: "Mix (All)",
      toneC1C2: "Adaptive",
      errorLoadMore: "Failed to generate more expressions. Please try again.",
      retryBtn: "Retry",
      hideSaved: "Fresh Only",
      showAll: "Show All",
    },
    ielts: {
      bannerEyebrow: "Adaptive IELTS & CEFR Tracker (A1–C2)",
      bannerTitleFallback: "Your English & IELTS Skill Map",
      retakePlacement: "Retake Placement Test",
      startPlacement: "Start Placement Test",
      reading: "Reading",
      listening: "Listening",
      writing: "Writing",
      speaking: "Speaking",
      totalSessions: "Completed IELTS sessions:",
    },
    stats: {
      eyebrow: "Learning Analytics",
      title: "Progress & Weakest Words",
      dueSuffix: "SM-2 due",
      masteryRank: "Mastery Rank",
      nextRankPrefix: "Next:",
      maxRankReached: "Highest Rank Achieved!",
      dailyStreak: "Daily Streak",
      daysUnit: "Days",
      streakActiveHint: "Keep your daily momentum going!",
      streakIdleHint: "Complete a review today to start your streak.",
      masteredTitle: "Mastered Words",
      accuracyTitle: "Recall Accuracy",
      correctLabel: "correct out of",
      ofLabel: "of",
      attemptsLabel: "attempts",
      weeklyTitle: "Last 7 Days Activity",
      weakestSectionTitle: "Top Weakest Words",
      weakestClearHint:
        "Get a word right 2× in a row to clear it from this list.",
      drillWeakestBtn: "Drill Weakest",
    },
    rings: {
      eyebrow: "Daily Activity Rings",
      titleAllClosed: "All Daily Rings Closed!",
      titleOpen: "Close Your 3 Daily Rings",
      allClosedBadge: "All Rings Closed",
      vocab: "Vocab",
      recall: "Recall",
      ielts: "IELTS",
    },
    settings: {
      title: "Settings",
      subtitle: "Account, Language, Audio & Storage",
      close: "Close Settings",
      sections: {
        account: "Account & Security",
        language: "Interface Language",
        dailyPack: "Daily Learning Pack",
        audioStudy: "Audio & Study Preferences",
        dataStorage: "Data & Storage",
      },
      dailyPack: {
        wordsPerDay: "New Words / Day",
        wordsPerDayDesc: "Fresh vocabulary tailored to your target level (0–30)",
        idiomsPerDay: "New Idioms / Day",
        idiomsPerDayDesc: "Fresh idioms & expressions tailored to your target level (0–20)",
        targetLevelLabel: "CEFR Target Tier",
        targetLevelDesc: "Pick your Daily Pack difficulty tier or use Auto from your Placement Test.",
        autoShowPopup: "Auto-show Daily Pop-up",
        autoShowOnDesc:
          "Enabled — automatically opens once per new day when visiting Vault",
        autoShowOffDesc:
          "Disabled — start your Daily Pack manually anytime from the Vault banner",
        totalPerDayPrefix: "Daily Total:",
        totalPerDaySuffix: "items / day",
        pausedHint:
          "Daily Pack is paused (0 words & 0 idioms). Raise either quota to re-enable.",
        applyTodayBtn: "Apply to Today's Pack",
        applyingTodayBtn: "Updating Pack...",
        appliedTodayMsg: "Today's pack refreshed with your new quota!",
        cloudSyncNote: "Synced to Supabase Cloud",
        guestLocalNote: "Saved locally on this device",
      },
      account: {
        username: "Active Username",
        status: "Account Status",
        statusCloud: "Cloud Synced",
        statusLocal: "Local Account",
        statusGuest: "Guest Mode",
        rankXp: "Mastery Rank & XP",
        passwordLabel: "Password",
        changePasswordBtn: "Change Password",
        cancelChangeBtn: "Cancel",
        newPassword: "New Password",
        confirmPassword: "Confirm Password",
        savePasswordBtn: "Update Password",
        savingPassword: "Updating...",
        passwordTooShort: "New password must be at least 6 characters.",
        passwordMismatch: "Passwords do not match.",
        passwordUpdated: "Password updated successfully!",
        guestPasswordNote:
          "Guest Mode has no password. Create an account anytime to sync across devices.",
        createAccountSync: "Create Account to Sync",
        logoutBtn: "Sign Out",
      },
      language: {
        indonesia: "Bahasa Indonesia",
        indonesiaSub: "Tampilan aplikasi berbahasa Indonesia",
        english: "English",
        englishSub: "Full English interface across all tabs",
      },
      audioStudy: {
        defaultAccent: "Default Audio Accent",
        usLabel: "US American",
        ukLabel: "UK British",
        sfxLabel: "Micro Sound Effects (SFX)",
        sfxOnDesc: "Enabled — subtle chimes on flips, answers & ring goals",
        sfxMutedDesc: "Muted — all UI sound effects silenced",
        ringTargetsTitle: "Daily Activity Ring Targets",
        ringTargetsDesc:
          "Customize daily goals for Vocab, Recall, and IELTS sessions.",
        resetDefaults: "Reset Default",
        vocabTarget: "Vocab / day",
        recallTarget: "Recall / day",
        ieltsTarget: "IELTS / day",
      },
      dataStorage: {
        connectionLabel: "Connection Status",
        connCloud: "Supabase Cloud Live",
        connError: "Sync Error (See Details Below)",
        connLocal: "Local Vault (Device)",
        connGuest: "Guest Mode · Device LocalStorage",
        savedExpressions: "Saved Expressions",
        forceSyncTitle: "Cloud Vault Sync",
        forceSyncDesc:
          "Merge and upsert all local Vault items, study logs, and settings with Supabase Cloud.",
        forceSyncDisabledDesc:
          "Sign in with a Cloud account to sync your Vault across devices.",
        forceSyncBtn: "Force Sync Now",
        forceSyncingBtn: "Syncing...",
        syncErrorTitle: "Supabase Sync Error",
        refreshAllBtn: "Refresh All AI Details",
        refreshAllDesc:
          "Sequentially re-analyze CEFR (A1–C2), register, phonetics, definitions & examples (~400ms safe delay).",
        refreshAllEmpty: "No saved expressions in Vault yet.",
        refreshConfirmPromptPrefix:
          "Re-analyze AI details (CEFR & register) for all",
        refreshConfirmPromptSuffix: "saved Vault items sequentially?",
        refreshConfirmStartBtn: "Start Refresh",
        refreshCancelBtn: "Cancel",
        refreshingProgressPrefix: "Refreshing",
        exportBtn: "Export Vault to JSON",
        exportedMsg: "JSON backup downloaded.",
        clearAudioBtn: "Clear Audio Cache (IndexedDB)",
        clearingAudioBtn: "Clearing...",
        clearedAudioPrefix: "Audio cache cleared (",
        clearedAudioSuffix: "clips removed).",
      },
    },
    pwa: {
      getAndroidAppBtn: "Get Android App",
      modalTitle: "LexiVault App",
      modalSubtitle: "Install LexiVault as a full-screen app on Android, iOS, or Desktop",
      close: "Close",
      apkTitle: "Download APK (Android)",
      apkDesc: "Standalone Android .apk installer package.",
      apkDownloadBtn: "Download Android APK",
      apkComingSoonBadge: "Coming Soon",
      apkComingSoonBtn: "APK Coming Soon",
      instantTitle: "Install Instant (Web App / iOS & Android)",
      instantDesc:
        "Full-screen standalone launch, home screen icon, and fast offline cache.",
      instantInstallBtn: "Install Instant (Web App)",
      instantInstallingBtn: "Installing...",
      installedBadge: "Installed",
      installedNote:
        "LexiVault is already installed as a Web App on this device.",
      iosGuideTitle: "2-Step Add to Home Screen Guide:",
      iosStep1: "Tap the Share icon in the Safari toolbar.",
      iosStep2: "Choose 'Add to Home Screen' and confirm.",
      androidStep1: "Tap the browser menu (⋮) in the top-right corner of Chrome.",
      androidStep2: "Tap 'Install app' or 'Add to Home screen' and confirm.",
      androidManualHint:
        "Open your browser menu (⋮), then tap 'Install app' or 'Add to Home screen'.",
    },
    developer: {
      builtBy: "Built by Abel Jonathan",
      sectionTitle: "About & Developer",
      name: "Abel Jonathan",
      roleSubtitle: "Creator of LexiVault",
      mascotName: "Lexi",
      mascotStatus: "The Real-life Lexi (Rottweiler mascot)",
      github: "GitHub",
      linkedin: "LinkedIn",
      email: "Email",
      emailCopied: "abeljonathankho@gmail.com copied!",
    },
  },
};
