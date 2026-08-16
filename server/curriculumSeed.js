// ---------------------------------------------------------------------------
// Katalog kurikulum SMP lengkap (semua mapel × kelas 7/8/9 × Merdeka/K-13/KTSP
// × semester Ganjil & Genap). Konten dibangun dari kerangka per mata pelajaran
// agar konsisten dengan struktur masing-masing jenis kurikulum.
// ---------------------------------------------------------------------------

// Kompetensi Inti standar jenjang SMP untuk Kurikulum 2013 (dipakai semua mapel).
const K13_KI = [
  {
    kode: "KI-1",
    deskripsi: "Menghargai dan menghayati ajaran agama yang dianutnya.",
  },
  {
    kode: "KI-2",
    deskripsi:
      "Menghargai dan menghayati perilaku jujur, disiplin, tanggung jawab, peduli (toleransi, gotong royong), santun, dan percaya diri dalam berinteraksi secara efektif dengan lingkungan sosial dan alam dalam jangkauan pergaulan dan keberadaannya.",
  },
  {
    kode: "KI-3",
    deskripsi:
      "Memahami dan menerapkan pengetahuan (faktual, konseptual, dan prosedural) berdasarkan rasa ingin tahunya tentang ilmu pengetahuan, teknologi, seni, budaya terkait fenomena dan kejadian tampak mata.",
  },
  {
    kode: "KI-4",
    deskripsi:
      "Mengolah, menyaji, dan menalar dalam ranah konkret dan ranah abstrak sesuai dengan yang dipelajari di sekolah dan sumber lain yang sama dalam sudut pandang/teori.",
  },
];

// Tema Projek Penguatan Profil Pelajar Pancasila (P5) untuk jenjang SMP/Fase D.
// Dipakai sebagai daftar tema pada Kurikulum Merdeka (standar nasional).
const P5_TEMA = [
  "Gaya Hidup Berkelanjutan",
  "Kearifan Lokal",
  "Bhinneka Tunggal Ika",
  "Bangunlah Jiwa dan Raganya",
  "Suara Demokrasi",
  "Rekayasa dan Teknologi",
  "Kewirausahaan",
];

// Kerangka tiap mata pelajaran: Capaian Pembelajaran + Elemen (Fase D) untuk
// Merdeka, kata kerja operasional untuk membentuk TP/KD/SK, serta daftar topik
// pokok per kelas dan semester.
const SUBJECTS = [
  {
    mapel: "Bahasa Indonesia",
    cp: "Pada akhir Fase D, peserta didik mampu memahami, mengolah, dan menyajikan informasi dari teks lisan, tulis, dan visual untuk berbagai tujuan secara kritis, kreatif, dan santun.",
    elemen: [
      {
        nama: "Menyimak",
        capaian:
          "Peserta didik mampu menganalisis dan mengevaluasi informasi berupa gagasan, pikiran, dan pesan dari teks yang didengar.",
      },
      {
        nama: "Membaca dan Memirsa",
        capaian:
          "Peserta didik memahami informasi eksplisit dan implisit dari beragam teks serta memaknai teks visual.",
      },
      {
        nama: "Berbicara dan Mempresentasikan",
        capaian:
          "Peserta didik menyampaikan gagasan secara runtut, logis, dan santun dalam diskusi maupun presentasi.",
      },
      {
        nama: "Menulis",
        capaian:
          "Peserta didik menulis beragam teks dengan struktur dan kaidah kebahasaan yang tepat.",
      },
    ],
    know: "Menelaah struktur dan kaidah kebahasaan",
    doo: "Menyajikan gagasan secara lisan dan tulis dalam bentuk",
    sk: "Memahami dan mengapresiasi",
    topics: {
      7: {
        ganjil: ["teks deskripsi", "teks narasi (cerita fantasi)", "teks prosedur"],
        genap: [
          "teks laporan hasil observasi",
          "surat pribadi dan surat dinas",
          "puisi rakyat (pantun, gurindam, dan syair)",
        ],
      },
      8: {
        ganjil: ["teks berita", "teks eksposisi", "teks iklan, slogan, dan poster"],
        genap: ["teks ulasan", "teks persuasi", "teks drama"],
      },
      9: {
        ganjil: [
          "teks laporan percobaan",
          "teks pidato persuasif",
          "teks cerita pendek (cerpen)",
        ],
        genap: ["teks tanggapan", "teks diskusi", "teks cerita inspiratif"],
      },
    },
  },
  {
    mapel: "Bahasa Inggris",
    cp: "Pada akhir Fase D, peserta didik menggunakan bahasa Inggris untuk berinteraksi dan bertukar informasi dalam konteks kehidupan sehari-hari melalui teks lisan, tulis, dan visual secara sederhana.",
    elemen: [
      {
        nama: "Menyimak – Berbicara (Listening – Speaking)",
        capaian:
          "Peserta didik menggunakan bahasa Inggris untuk berinteraksi dalam situasi sosial dan bertukar informasi secara lisan.",
      },
      {
        nama: "Membaca – Memirsa (Reading – Viewing)",
        capaian:
          "Peserta didik memahami ide pokok dan informasi rinci dari teks tulis dan visual sederhana.",
      },
      {
        nama: "Menulis – Mempresentasikan (Writing – Presenting)",
        capaian:
          "Peserta didik menyusun dan menyajikan teks tulis sederhana sesuai tujuan dan konteks.",
      },
    ],
    know: "Memahami fungsi sosial, struktur teks, dan unsur kebahasaan terkait",
    doo: "Menyusun teks lisan dan tulis sederhana terkait",
    sk: "Memahami dan mengungkapkan makna terkait",
    topics: {
      7: {
        ganjil: [
          "greetings and self introduction",
          "describing people and things",
          "numbers, days, months, and dates",
        ],
        genap: [
          "daily activities (simple present tense)",
          "describing places (there is/there are)",
          "instructions and prohibitions",
        ],
      },
      8: {
        ganjil: [
          "asking for and giving attention",
          "expressing ability and willingness (can/will)",
          "giving instructions and invitations",
        ],
        genap: [
          "present continuous tense",
          "comparative and superlative degrees",
          "recount text about past events",
        ],
      },
      9: {
        ganjil: [
          "expressing hope and wishes",
          "agreement and disagreement",
          "procedure text (labels and manuals)",
        ],
        genap: [
          "present perfect tense",
          "report text about natural phenomena",
          "narrative text (fairy tales)",
        ],
      },
    },
  },
  {
    mapel: "Ilmu Pengetahuan Alam",
    cp: "Pada akhir Fase D, peserta didik memahami konsep dan gejala alam melalui pengamatan serta menerapkan keterampilan proses ilmiah untuk memecahkan masalah dalam kehidupan sehari-hari.",
    elemen: [
      {
        nama: "Pemahaman IPA",
        capaian:
          "Peserta didik memahami konsep zat, energi, makhluk hidup, dan interaksinya dengan lingkungan.",
      },
      {
        nama: "Keterampilan Proses",
        capaian:
          "Peserta didik mengamati, merencanakan dan melakukan penyelidikan, mengolah data, serta mengomunikasikan hasilnya.",
      },
    ],
    know: "Menganalisis konsep",
    doo: "Menyajikan hasil percobaan atau penyelidikan tentang",
    sk: "Memahami konsep",
    topics: {
      7: {
        ganjil: ["pengukuran dan besaran", "klasifikasi makhluk hidup", "zat dan perubahan wujudnya"],
        genap: ["suhu dan kalor", "ekosistem dan interaksinya", "pencemaran lingkungan"],
      },
      8: {
        ganjil: ["gerak dan gaya (hukum Newton)", "sistem gerak pada manusia", "sistem pencernaan manusia"],
        genap: [
          "tekanan zat dan penerapannya",
          "sistem pernapasan manusia",
          "getaran, gelombang, dan bunyi",
        ],
      },
      9: {
        ganjil: [
          "sistem reproduksi pada manusia",
          "kelistrikan (listrik statis dan dinamis)",
          "kemagnetan dan induksi elektromagnetik",
        ],
        genap: [
          "pewarisan sifat (genetika)",
          "bioteknologi",
          "partikel penyusun benda dan tanah",
        ],
      },
    },
  },
  {
    mapel: "Ilmu Pengetahuan Sosial",
    cp: "Pada akhir Fase D, peserta didik memahami keterkaitan antara kondisi geografis, kehidupan sosial, ekonomi, dan sejarah masyarakat Indonesia serta berpartisipasi dalam kehidupan bermasyarakat.",
    elemen: [
      {
        nama: "Pemahaman Konsep",
        capaian:
          "Peserta didik memahami konsep ruang, waktu, kegiatan ekonomi, dan dinamika sosial masyarakat.",
      },
      {
        nama: "Keterampilan Proses (Inkuiri Sosial)",
        capaian:
          "Peserta didik merumuskan pertanyaan, mengumpulkan dan menganalisis data, serta mengomunikasikan hasil kajian sosial.",
      },
    ],
    know: "Memahami keterkaitan konsep",
    doo: "Menyajikan hasil analisis tentang",
    sk: "Memahami",
    topics: {
      7: {
        ganjil: [
          "keluarga dan lingkungan sekitar",
          "kondisi geografis Indonesia",
          "kegiatan ekonomi masyarakat",
        ],
        genap: ["keragaman sosial budaya", "interaksi sosial", "kehidupan masa praaksara"],
      },
      8: {
        ganjil: [
          "kondisi geografis negara-negara ASEAN",
          "mobilitas sosial",
          "kolonialisme dan imperialisme di Indonesia",
        ],
        genap: [
          "pluralitas masyarakat Indonesia",
          "perdagangan antardaerah dan antarnegara",
          "pergerakan nasional Indonesia",
        ],
      },
      9: {
        ganjil: [
          "interaksi antarnegara Asia dan benua lainnya",
          "perubahan sosial budaya",
          "perjuangan mempertahankan kemerdekaan Indonesia",
        ],
        genap: [
          "perdagangan internasional dan ekonomi kreatif",
          "ketergantungan antarruang",
          "Indonesia masa Orde Baru hingga Reformasi",
        ],
      },
    },
  },
  {
    mapel: "Matematika",
    cp: "Pada akhir Fase D, peserta didik dapat menyelesaikan masalah kontekstual yang berkaitan dengan bilangan, aljabar, pengukuran, geometri, serta analisis data dan peluang.",
    elemen: [
      {
        nama: "Bilangan",
        capaian: "Membaca, menulis, membandingkan, dan mengoperasikan bilangan bulat, pecahan, dan bentuk pangkat.",
      },
      {
        nama: "Aljabar",
        capaian: "Memodelkan dan menyelesaikan persamaan, pertidaksamaan, relasi, dan fungsi.",
      },
      {
        nama: "Pengukuran dan Geometri",
        capaian: "Menyelesaikan masalah pengukuran serta sifat dan hubungan antarbangun datar dan ruang.",
      },
      {
        nama: "Analisis Data dan Peluang",
        capaian: "Menyajikan, menafsirkan data, serta menentukan peluang suatu kejadian.",
      },
    ],
    know: "Menjelaskan dan menentukan konsep",
    doo: "Menyelesaikan masalah yang berkaitan dengan",
    sk: "Memahami konsep",
    topics: {
      7: {
        ganjil: ["bilangan bulat dan pecahan", "himpunan", "bentuk aljabar"],
        genap: [
          "persamaan dan pertidaksamaan linear satu variabel",
          "perbandingan",
          "aritmetika sosial",
        ],
      },
      8: {
        ganjil: ["pola bilangan", "koordinat Kartesius", "relasi dan fungsi"],
        genap: ["persamaan garis lurus", "teorema Pythagoras", "bangun ruang sisi datar"],
      },
      9: {
        ganjil: ["bilangan berpangkat dan bentuk akar", "persamaan kuadrat", "fungsi kuadrat"],
        genap: [
          "kesebangunan dan kekongruenan",
          "bangun ruang sisi lengkung",
          "peluang dan statistika",
        ],
      },
    },
  },
  {
    mapel: "Pendidikan Agama Islam dan Budi Pekerti",
    cp: "Pada akhir Fase D, peserta didik memahami dan menghayati ajaran agama melalui kitab suci, akidah, akhlak, ibadah, serta sejarah, dan menerapkannya dalam kehidupan sehari-hari.",
    elemen: [
      {
        nama: "Al-Qur'an dan Hadis",
        capaian: "Peserta didik membaca, memahami, dan menghayati kandungan Al-Qur'an dan Hadis.",
      },
      { nama: "Akidah", capaian: "Peserta didik meyakini dan menghayati rukun iman." },
      { nama: "Akhlak", capaian: "Peserta didik membiasakan akhlak mulia dalam kehidupan." },
      { nama: "Fikih", capaian: "Peserta didik memahami dan mempraktikkan ketentuan ibadah." },
      {
        nama: "Sejarah Peradaban Islam",
        capaian: "Peserta didik meneladani kisah dan sejarah perkembangan Islam.",
      },
    ],
    know: "Memahami",
    doo: "Menerapkan dan mempraktikkan nilai",
    sk: "Memahami dan menghayati",
    topics: {
      7: {
        ganjil: [
          "bacaan Al-Qur'an dan hukum tajwid",
          "iman kepada Allah melalui Asmaul Husna",
          "perilaku jujur, amanah, dan istiqamah",
        ],
        genap: [
          "ketentuan salat berjamaah",
          "sejarah dakwah Nabi Muhammad saw. di Mekah",
          "empati serta hormat kepada orang tua dan guru",
        ],
      },
      8: {
        ganjil: [
          "menghindari minuman keras, judi, dan pertengkaran",
          "iman kepada kitab-kitab Allah",
          "ketentuan puasa wajib dan sunah",
        ],
        genap: [
          "makanan dan minuman yang halal dan haram",
          "pertumbuhan ilmu pengetahuan masa Bani Umayyah",
          "perilaku rendah hati, hemat, dan hidup sederhana",
        ],
      },
      9: {
        ganjil: [
          "iman kepada hari akhir",
          "ketentuan zakat fitrah dan zakat mal",
          "perilaku jujur dan menepati janji",
        ],
        genap: [
          "iman kepada qada dan qadar",
          "penyembelihan hewan, kurban, dan akikah",
          "sejarah tradisi Islam Nusantara",
        ],
      },
    },
  },
  {
    mapel: "Pendidikan Jasmani, Olahraga, dan Kesehatan",
    cp: "Pada akhir Fase D, peserta didik menunjukkan kemampuan aktivitas jasmani dan pola hidup sehat melalui berbagai keterampilan gerak dalam permainan, olahraga, dan aktivitas kebugaran.",
    elemen: [
      { nama: "Keterampilan Gerak", capaian: "Mempraktikkan pola gerak dalam berbagai aktivitas fisik." },
      { nama: "Pengetahuan Gerak", capaian: "Memahami konsep dan prinsip gerak yang efektif dan efisien." },
      { nama: "Pemanfaatan Gerak", capaian: "Menerapkan aktivitas jasmani untuk kebugaran dan kesehatan." },
      {
        nama: "Pengembangan Karakter",
        capaian: "Menunjukkan sportivitas, kerja sama, dan tanggung jawab dalam beraktivitas.",
      },
    ],
    know: "Memahami konsep gerak spesifik dalam",
    doo: "Mempraktikkan gerak spesifik dalam",
    sk: "Mempraktikkan",
    topics: {
      7: {
        ganjil: [
          "permainan bola besar (sepak bola, bola voli, bola basket)",
          "permainan bola kecil (kasti dan bulu tangkis)",
          "aktivitas atletik (jalan cepat dan lari)",
        ],
        genap: ["aktivitas kebugaran jasmani", "senam lantai", "aktivitas gerak berirama"],
      },
      8: {
        ganjil: [
          "variasi gerak permainan bola besar",
          "variasi gerak permainan bola kecil",
          "aktivitas atletik (lompat jauh dan tolak peluru)",
        ],
        genap: [
          "latihan kebugaran jasmani dan pengukurannya",
          "kombinasi gerak senam lantai",
          "pola gerak dominan aktivitas ritmik",
        ],
      },
      9: {
        ganjil: [
          "pola penyerangan dan pertahanan permainan bola besar",
          "beladiri (pencak silat)",
          "aktivitas atletik lanjutan",
        ],
        genap: [
          "aktivitas kebugaran untuk kesehatan",
          "rangkaian gerak senam lantai",
          "pola hidup sehat dan pencegahan penyakit",
        ],
      },
    },
  },
  {
    mapel: "Pendidikan Pancasila",
    k13Mapel: "Pendidikan Pancasila dan Kewarganegaraan",
    cp: "Pada akhir Fase D, peserta didik memahami dan menerapkan nilai-nilai Pancasila, UUD NRI Tahun 1945, kebinekaan, serta menjaga keutuhan Negara Kesatuan Republik Indonesia.",
    elemen: [
      { nama: "Pancasila", capaian: "Memahami dan menerapkan nilai-nilai Pancasila dalam kehidupan." },
      {
        nama: "Undang-Undang Dasar NRI Tahun 1945",
        capaian: "Memahami kedudukan dan makna UUD NRI Tahun 1945 serta peraturan perundang-undangan.",
      },
      {
        nama: "Bhinneka Tunggal Ika",
        capaian: "Menghargai keberagaman dan membangun harmoni dalam masyarakat.",
      },
      {
        nama: "Negara Kesatuan Republik Indonesia",
        capaian: "Menjaga persatuan dan keutuhan wilayah NKRI.",
      },
    ],
    know: "Memahami",
    doo: "Menyaji hasil telaah tentang",
    sk: "Memahami",
    topics: {
      7: {
        ganjil: [
          "perumusan dan penetapan Pancasila",
          "norma dalam kehidupan bermasyarakat",
          "perumusan UUD NRI Tahun 1945",
        ],
        genap: [
          "keberagaman suku, agama, ras, dan antargolongan",
          "kerja sama dalam kehidupan bermasyarakat",
          "daerah dalam kerangka NKRI",
        ],
      },
      8: {
        ganjil: [
          "kedudukan dan fungsi Pancasila",
          "makna dan kedudukan UUD NRI Tahun 1945",
          "tata urutan peraturan perundang-undangan",
        ],
        genap: [
          "semangat Kebangkitan Nasional",
          "Sumpah Pemuda dan semangat persatuan",
          "memperkuat komitmen kebangsaan",
        ],
      },
      9: {
        ganjil: [
          "dinamika perwujudan Pancasila sebagai dasar dan pandangan hidup",
          "pokok pikiran Pembukaan UUD NRI Tahun 1945",
          "bentuk dan kedaulatan negara",
        ],
        genap: [
          "keberagaman masyarakat dalam bingkai Bhinneka Tunggal Ika",
          "harmoni keberagaman masyarakat",
          "bela negara dalam konteks NKRI",
        ],
      },
    },
  },
  {
    mapel: "Seni Budaya",
    cp: "Pada akhir Fase D, peserta didik mampu mengalami, menciptakan, dan merefleksikan karya seni rupa, musik, tari, dan teater sebagai ekspresi diri dan apresiasi budaya.",
    elemen: [
      { nama: "Mengalami", capaian: "Mengamati dan mengeksplorasi unsur serta karya seni." },
      { nama: "Menciptakan", capaian: "Menciptakan karya seni sesuai konsep dan teknik." },
      { nama: "Merefleksikan", capaian: "Menilai dan memaknai proses serta hasil berkarya." },
      {
        nama: "Berpikir dan Bekerja Artistik",
        capaian: "Bekerja secara kreatif, kolaboratif, dan bertanggung jawab dalam berkarya.",
      },
      { nama: "Berdampak", capaian: "Menghargai peran seni dalam kehidupan dan budaya." },
    ],
    know: "Memahami konsep dan teknik",
    doo: "Membuat dan menampilkan karya",
    sk: "Mengapresiasi dan berkarya",
    topics: {
      7: {
        ganjil: ["menggambar flora, fauna, dan alam benda", "menyanyikan lagu secara unisono"],
        genap: [
          "menggambar ragam hias",
          "memainkan alat musik sederhana",
          "level dan pola lantai gerak tari",
        ],
      },
      8: {
        ganjil: [
          "menggambar model (alam benda)",
          "menyanyikan lagu daerah secara vokal grup",
          "keunikan gerak tari tradisional",
        ],
        genap: ["menggambar ilustrasi", "memainkan ansambel musik", "pementasan tari tradisional"],
      },
      9: {
        ganjil: ["seni lukis dan seni patung", "aransemen lagu populer", "kreasi tari modern"],
        genap: ["seni grafis dan pameran karya", "pergelaran musik", "pementasan teater"],
      },
    },
  },
];

// Kapitalisasi huruf pertama sebuah kalimat/topik.
function cap(s) {
  const t = String(s || "");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// Jumlah JP (Jam Pelajaran) bawaan untuk tiap materi pokok Kurikulum Merdeka.
const DEFAULT_MATERI_JP = 6;

// Alokasi JP intrakurikuler resmi Kurikulum Merdeka SMP/MTs (JP per minggu),
// mengacu Kepmendikbudristek No. 262/M/2022 tentang Struktur Kurikulum Merdeka.
// (Alokasi projek P5 sebesar ~25% dihitung terpisah dan tidak termasuk di sini.)
const WEEKLY_JP = {
  "Bahasa Indonesia": 5,
  "Matematika": 4,
  "Ilmu Pengetahuan Alam": 4,
  "Ilmu Pengetahuan Sosial": 3,
  "Bahasa Inggris": 3,
  "Pendidikan Agama Islam dan Budi Pekerti": 2,
  "Pendidikan Pancasila": 2,
  "Pendidikan Jasmani, Olahraga, dan Kesehatan": 2,
  "Seni Budaya": 2,
};

// Total JP intrakurikuler untuk satu semester: JP/minggu × minggu efektif.
// Kelas 7 & 8 = 36 minggu/tahun (18/semester); Kelas 9 = 32 minggu/tahun (16/semester).
function semesterJP(mapel, kelas) {
  const wk = WEEKLY_JP[mapel] || 2;
  const weeksPerSemester = Number(kelas) === 9 ? 16 : 18;
  return wk * weeksPerSemester;
}

// Bagi total JP rata ke n bagian; sisa dialokasikan ke bagian paling awal.
function distributeJP(total, n) {
  const t = Math.max(0, parseInt(total, 10) || 0);
  if (n <= 0) return [];
  const base = Math.floor(t / n);
  const rem = t - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

// Buat daftar submateri generik dari nama materi pokok, lengkap dengan JP tiap
// submateri (total submateri = JP materi pokok). Dapat disunting admin.
function buildSubmateri(nama, materiJp = DEFAULT_MATERI_JP) {
  const t = String(nama || "").trim();
  if (!t) return [];
  const low = t.charAt(0).toLowerCase() + t.slice(1);
  const labels = [
    `Konsep dasar ${low}`,
    `Ciri & struktur ${low}`,
    `Contoh & penerapan ${low}`,
    `Latihan & evaluasi ${low}`,
  ];
  const parts = distributeJP(materiJp, labels.length);
  return labels.map((l, i) => ({ nama: l, jp: parts[i] }));
}

// Bentuk objek materi pokok lengkap: { nama, jp, submateri:[{nama,jp}] }.
function makeMateri(nama, jp = DEFAULT_MATERI_JP) {
  const clean = cap(String(nama || "").trim());
  const j = Math.max(0, parseInt(jp, 10) || 0);
  return { nama: clean, jp: j, submateri: buildSubmateri(clean, j) };
}

// Huruf pertama menjadi kecil (untuk merangkai kalimat tujuan pembelajaran).
function lc(s) {
  const t = String(s || "");
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

// Bangun bidang Kurikulum 2013 (K-13) untuk satu mapel/kelas/semester:
// Kompetensi Inti (KI), Kompetensi Dasar (KD, dengan alokasi JP), Indikator
// Pencapaian Kompetensi (IPK), dan Tujuan Pembelajaran (TP). KD berpasangan
// (3.x pengetahuan, 4.x keterampilan); IPK & TP diturunkan dari KD sesuai
// praktik penyusunan RPP di sekolah.
function buildK13Fields(subj, topics, jpParts, KI) {
  const kompetensiDasar = [];
  const indikator = [];
  const tujuanPembelajaran = [];
  topics.forEach((t, i) => {
    const n = i + 1;
    const jp = Math.max(0, parseInt(jpParts[i], 10) || 0);
    const jp3 = Math.ceil(jp / 2);
    const jp4 = jp - jp3;
    kompetensiDasar.push({ kode: `3.${n}`, deskripsi: cap(`${subj.know} ${t}.`), jp: jp3 });
    kompetensiDasar.push({ kode: `4.${n}`, deskripsi: cap(`${subj.doo} ${t}.`), jp: jp4 });
    indikator.push({ kode: `3.${n}.1`, deskripsi: cap(`Mengidentifikasi ${t}.`) });
    indikator.push({ kode: `3.${n}.2`, deskripsi: cap(`${subj.know} ${t}.`) });
    indikator.push({ kode: `4.${n}.1`, deskripsi: cap(`${subj.doo} ${t}.`) });
    tujuanPembelajaran.push(
      cap(
        `Melalui kegiatan pembelajaran, peserta didik mampu ${lc(subj.know)} ${t} dan ${lc(subj.doo)} ${t} dengan tepat, teliti, dan penuh tanggung jawab.`
      )
    );
  });
  return { kompetensiInti: KI, kompetensiDasar, indikator, tujuanPembelajaran };
}

// Bangun seluruh entri katalog dari kerangka mata pelajaran.
function buildCurriculumSeed() {
  const out = [];
  for (const subj of SUBJECTS) {
    for (const kelas of [7, 8, 9]) {
      for (const semester of ["ganjil", "genap"]) {
        const topics = (subj.topics[kelas] && subj.topics[kelas][semester]) || [];
        const jpParts = distributeJP(
          semesterJP(subj.mapel, kelas),
          topics.length || 1
        );

        // --- Kurikulum Merdeka (Fase D) ---
        out.push({
          curriculumType: "merdeka",
          kelas,
          mapel: subj.mapel,
          semester,
          fase: "D",
          capaianPembelajaran: subj.cp,
          elemen: subj.elemen,
          materiPokok: topics.map((t, i) => makeMateri(t, jpParts[i])),
          tema: P5_TEMA,
          tujuanPembelajaran: topics.flatMap((t) => [
            cap(`${subj.know} ${t}.`),
            cap(`${subj.doo} ${t}.`),
          ]),
        });

        // --- Kurikulum 2013 (K-13) ---
        out.push({
          curriculumType: "k13",
          kelas,
          mapel: subj.k13Mapel || subj.mapel,
          semester,
          ...buildK13Fields(subj, topics, jpParts, K13_KI),
        });

        // --- KTSP 2006 ---
        out.push({
          curriculumType: "ktsp2006",
          kelas,
          mapel: subj.mapel,
          semester,
          standarKompetensi: topics.map((t, i) => ({
            kode: String(i + 1),
            deskripsi: cap(`${subj.sk} ${t}.`),
            kompetensiDasar: [
              { kode: `${i + 1}.1`, deskripsi: cap(`${subj.know} ${t}.`) },
              { kode: `${i + 1}.2`, deskripsi: cap(`${subj.doo} ${t}.`) },
            ],
          })),
        });
      }
    }
  }
  return out;
}

module.exports = {
  buildCurriculumSeed,
  P5_TEMA,
  makeMateri,
  buildSubmateri,
  distributeJP,
  DEFAULT_MATERI_JP,
  buildK13Fields,
  cap,
  K13_KI,
};
