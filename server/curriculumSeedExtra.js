// ---------------------------------------------------------------------------
// Katalog Kurikulum Merdeka untuk jenjang SD/MI (Fase A–C, kelas 1–6) serta
// SMA/MA (Fase E–F) dan SMK/MAK (Fase E–F, muatan umum & kejuruan) kelas 10–12.
// Melengkapi curriculumSeed.js yang mencakup jenjang SMP/MTs (Fase D).
//
// Struktur konten mengikuti Kurikulum Merdeka: Capaian Pembelajaran (CP) per
// fase, Elemen mata pelajaran, Materi Pokok (+ alokasi JP), Tema Projek
// Penguatan Profil Pelajar Pancasila (P5), dan Tujuan Pembelajaran (TP).
// Mengacu pada Capaian Pembelajaran BSKAP Kemendikbudristek.
// ---------------------------------------------------------------------------

const { makeMateri, distributeJP, P5_TEMA, buildK13Fields } = require("./curriculumSeed");

// Kapitalisasi huruf pertama kalimat/topik.
function cap(s) {
  const t = String(s || "");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// Kompetensi Inti (KI) standar Kurikulum 2013 per jenjang (Permendikbud No.
// 37/2018). Dipakai semua mata pelajaran pada jenjang bersangkutan.
const K13_KI_SD = [
  { kode: "KI-1", deskripsi: "Menerima, menjalankan, dan menghargai ajaran agama yang dianutnya." },
  { kode: "KI-2", deskripsi: "Menunjukkan perilaku jujur, disiplin, tanggung jawab, santun, peduli, dan percaya diri dalam berinteraksi dengan keluarga, teman, guru, dan tetangga." },
  { kode: "KI-3", deskripsi: "Memahami pengetahuan faktual dan konseptual dengan cara mengamati, menanya, dan mencoba berdasarkan rasa ingin tahu tentang dirinya, makhluk ciptaan Tuhan dan kegiatannya, serta benda-benda yang dijumpainya di rumah, sekolah, dan tempat bermain." },
  { kode: "KI-4", deskripsi: "Menyajikan pengetahuan faktual dan konseptual dalam bahasa yang jelas, sistematis, dan logis, dalam karya yang estetis, dalam gerakan yang mencerminkan anak sehat, dan dalam tindakan yang mencerminkan perilaku anak beriman dan berakhlak mulia." },
];
const K13_KI_SMA = [
  { kode: "KI-1", deskripsi: "Menghayati dan mengamalkan ajaran agama yang dianutnya." },
  { kode: "KI-2", deskripsi: "Menunjukkan perilaku jujur, disiplin, santun, peduli (gotong royong, kerja sama, toleran, damai), bertanggung jawab, responsif, dan proaktif dalam berinteraksi secara efektif sesuai dengan perkembangan anak di lingkungan keluarga, sekolah, masyarakat, bangsa, negara, kawasan regional, dan kawasan internasional." },
  { kode: "KI-3", deskripsi: "Memahami, menerapkan, dan menganalisis pengetahuan faktual, konseptual, dan prosedural berdasarkan rasa ingin tahunya tentang ilmu pengetahuan, teknologi, seni, budaya, dan humaniora dengan wawasan kemanusiaan, kebangsaan, kenegaraan, dan peradaban terkait penyebab fenomena dan kejadian." },
  { kode: "KI-4", deskripsi: "Mengolah, menalar, dan menyaji dalam ranah konkret dan ranah abstrak terkait dengan pengembangan dari yang dipelajarinya di sekolah secara mandiri, serta mampu menggunakan metode sesuai kaidah keilmuan." },
];
const K13_KI_SMK = [
  { kode: "KI-1", deskripsi: "Menghayati dan mengamalkan ajaran agama yang dianutnya." },
  { kode: "KI-2", deskripsi: "Menghayati dan mengamalkan perilaku jujur, disiplin, santun, peduli, bertanggung jawab, responsif, dan proaktif melalui keteladanan, pemberian nasihat, dan pembiasaan dalam berinteraksi secara efektif dengan lingkungan sosial dan dunia kerja." },
  { kode: "KI-3", deskripsi: "Memahami, menerapkan, menganalisis, dan mengevaluasi pengetahuan faktual, konseptual, prosedural, dan metakognitif sesuai dengan bidang dan lingkup kerja pada tingkat teknis, spesifik, detail, dan kompleks berkenaan dengan ilmu pengetahuan, teknologi, seni, budaya, dan humaniora dalam konteks pengembangan potensi diri sebagai bagian dari dunia kerja dan warga masyarakat." },
  { kode: "KI-4", deskripsi: "Melaksanakan tugas spesifik dengan menggunakan alat, informasi, dan prosedur kerja yang lazim dilakukan serta memecahkan masalah sesuai dengan bidang kerja, dan menampilkan kinerja dengan mutu dan kuantitas yang terukur sesuai dengan standar kompetensi kerja." },
];

// Pemetaan nama mapel versi Kurikulum Merdeka → nama versi Kurikulum 2013,
// bila berbeda. Nama yang sama antar-kurikulum tidak perlu didaftarkan.
const K13_MAPEL_MAP = {
  "Pendidikan Pancasila": "Pendidikan Pancasila dan Kewarganegaraan",
  "Seni Rupa": "Seni Budaya dan Prakarya",
  "Projek Kreatif dan Kewirausahaan": "Produk Kreatif dan Kewirausahaan",
  "Dasar-dasar Program Keahlian": "Dasar Program Keahlian (C2)",
  "Konsentrasi Keahlian": "Kompetensi Keahlian (C3)",
};

// Mapel khas Kurikulum Merdeka yang tidak memiliki padanan pada Kurikulum 2013
// (dilewati saat membangun entri K-13). IPAS SD digantikan IPA & IPS terpisah.
const K13_SKIP = new Set([
  "Ilmu Pengetahuan Alam dan Sosial", // SD: di K-13 dipecah menjadi IPA & IPS
  "Projek Ilmu Pengetahuan Alam dan Sosial", // SMK: projek khas Merdeka
]);

// Mapel khusus Kurikulum 2013 SD: IPA & IPS berdiri sendiri (kelas 4–6).
// Hanya perlu know/doo + topik (K-13 tidak memakai Capaian Pembelajaran).
const IPA_SD_K13 = {
  mapel: "Ilmu Pengetahuan Alam",
  know: "Memahami konsep",
  doo: "Menyelidiki dan menyajikan hasil pengamatan tentang",
  topics: {
    4: { ganjil: ["rangka dan organ tubuh manusia", "bagian tubuh tumbuhan dan fungsinya"], genap: ["gaya dan gerak benda", "sumber energi dan perubahannya"] },
    5: { ganjil: ["organ pernapasan dan pencernaan manusia", "sifat dan perubahan wujud benda"], genap: ["ekosistem dan rantai makanan", "kalor dan perpindahannya"] },
    6: { ganjil: ["perkembangbiakan makhluk hidup", "sistem tata surya"], genap: ["rangkaian listrik dan kemagnetan", "ciri khusus makhluk hidup dan adaptasi"] },
  },
};
const IPS_SD_K13 = {
  mapel: "Ilmu Pengetahuan Sosial",
  know: "Memahami dan mengidentifikasi",
  doo: "Menyajikan hasil telaah tentang",
  topics: {
    4: { ganjil: ["kenampakan alam dan keragaman sosial daerah", "keragaman budaya dan kearifan lokal"], genap: ["kegiatan ekonomi masyarakat", "peninggalan sejarah di lingkungan sekitar"] },
    5: { ganjil: ["kondisi geografis Indonesia", "keragaman sosial budaya masyarakat"], genap: ["kegiatan ekonomi dan jenis usaha", "peristiwa perjuangan bangsa Indonesia"] },
    6: { ganjil: ["kenampakan alam dan sosial negara-negara ASEAN", "kerja sama negara ASEAN"], genap: ["globalisasi dan dampaknya", "peran Indonesia di kancah internasional"] },
  },
};

// Tema P5 khusus jenjang SMK (menambahkan tema Kebekerjaan & Budaya Kerja).
const P5_TEMA_SMK = [
  "Gaya Hidup Berkelanjutan",
  "Kearifan Lokal",
  "Bhinneka Tunggal Ika",
  "Bangunlah Jiwa dan Raganya",
  "Kebekerjaan",
  "Budaya Kerja",
  "Kewirausahaan",
];

// =====================================================================
// SD / MI — Fase A (kelas 1–2), Fase B (kelas 3–4), Fase C (kelas 5–6)
// =====================================================================
const SD_SUBJECTS = [
  {
    mapel: "Pendidikan Agama Islam dan Budi Pekerti",
    elemen: [
      { nama: "Al-Qur'an dan Hadis", capaian: "Mengenal, membaca, dan menghafal huruf hijaiah serta surah-surah pendek pilihan." },
      { nama: "Akidah", capaian: "Mengenal rukun iman dan sifat-sifat Allah melalui asmaul husna." },
      { nama: "Akhlak", capaian: "Membiasakan akhlak terpuji kepada Allah, sesama, dan lingkungan." },
      { nama: "Fikih", capaian: "Mengenal dan mempraktikkan tata cara ibadah dasar (bersuci dan salat)." },
      { nama: "Sejarah Peradaban Islam", capaian: "Meneladani kisah Nabi dan tokoh teladan dalam Islam." },
    ],
    cp: {
      A: "Pada akhir Fase A, peserta didik mengenal huruf hijaiah beserta harakatnya, membaca surah-surah pendek pilihan, mengenal rukun Islam dan rukun iman, membiasakan akhlak terpuji, serta mengenal kisah keteladanan Nabi.",
      B: "Pada akhir Fase B, peserta didik mampu membaca dan menulis surah pendek, memahami makna rukun iman dan asmaul husna, mempraktikkan tata cara bersuci dan salat, membiasakan akhlak mulia, serta meneladani kisah Nabi dan sahabat.",
      C: "Pada akhir Fase C, peserta didik mampu membaca Al-Qur'an dengan tajwid dasar, memahami iman kepada kitab dan rasul, mempraktikkan ibadah salat dan puasa, menerapkan akhlak mulia, serta memahami sejarah perkembangan Islam.",
    },
    know: "Memahami dan mengenal",
    doo: "Membiasakan dan mempraktikkan",
    topics: {
      1: { ganjil: ["huruf hijaiah dan harakatnya", "rukun Islam dan kalimat syahadat"], genap: ["surah-surah pendek pilihan", "adab dan akhlak terpuji sehari-hari"] },
      2: { ganjil: ["bacaan surah pendek", "mengenal asmaul husna"], genap: ["tata cara wudu", "kisah keteladanan Nabi"] },
      3: { ganjil: ["hukum bacaan dasar", "iman kepada Allah dan malaikat"], genap: ["tata cara salat", "kisah keteladanan Nabi dan sahabat"] },
      4: { ganjil: ["membaca dan menulis surah pilihan", "iman kepada kitab-kitab Allah"], genap: ["ibadah salat dan zikir", "akhlak terpuji dalam kehidupan"] },
      5: { ganjil: ["hukum tajwid dasar", "iman kepada rasul Allah"], genap: ["ibadah puasa Ramadan", "kisah Nabi dan para sahabat"] },
      6: { ganjil: ["memahami makna surah pilihan", "iman kepada hari akhir dan qada qadar"], genap: ["ibadah dan zakat", "sejarah perkembangan Islam"] },
    },
  },
  {
    mapel: "Pendidikan Pancasila",
    elemen: [
      { nama: "Pancasila", capaian: "Mengenal dan menerapkan nilai-nilai sila Pancasila dalam kehidupan sehari-hari." },
      { nama: "Undang-Undang Dasar Negara Republik Indonesia Tahun 1945", capaian: "Mengenal aturan, hak, dan kewajiban di lingkungan sekitar." },
      { nama: "Bhinneka Tunggal Ika", capaian: "Menghargai keragaman diri, budaya, dan lingkungan." },
      { nama: "Negara Kesatuan Republik Indonesia", capaian: "Mengenal lingkungan rumah, sekolah, dan wilayah sebagai bagian dari NKRI." },
    ],
    cp: {
      A: "Pada akhir Fase A, peserta didik mampu mengenal simbol dan sila-sila Pancasila, mengenal aturan di keluarga dan sekolah, menyebutkan identitas diri, serta mengenal lingkungan rumah dan sekolah sebagai bagian dari NKRI.",
      B: "Pada akhir Fase B, peserta didik mampu memahami dan menerapkan makna sila-sila Pancasila, mematuhi aturan di lingkungan sekitar, menghargai keragaman budaya dan karakteristik individu, serta mengenal lingkungan dalam kerangka NKRI.",
      C: "Pada akhir Fase C, peserta didik mampu memahami dan menyajikan nilai-nilai Pancasila, menganalisis hak dan kewajiban sebagai warga, menghargai keberagaman dalam bingkai Bhinneka Tunggal Ika, serta memahami pentingnya persatuan NKRI.",
    },
    know: "Mengenal dan memahami",
    doo: "Menunjukkan sikap sesuai nilai",
    topics: {
      1: { ganjil: ["simbol dan bunyi sila-sila Pancasila", "identitas diri dan ciri fisik"], genap: ["aturan di rumah dan sekolah", "sikap kerja sama di lingkungan keluarga"] },
      2: { ganjil: ["makna sila-sila Pancasila dalam kehidupan", "keberagaman di lingkungan sekitar"], genap: ["hak dan kewajiban di rumah dan sekolah", "gotong royong di lingkungan"] },
      3: { ganjil: ["arti penting norma dan aturan", "makna Pancasila sebagai dasar negara"], genap: ["keberagaman suku, budaya, dan agama", "kerja sama dalam keberagaman"] },
      4: { ganjil: ["hak dan kewajiban sebagai warga", "makna dan nilai sila-sila Pancasila"], genap: ["keragaman budaya bangsa Indonesia", "gotong royong dan musyawarah"] },
      5: { ganjil: ["penerapan nilai-nilai Pancasila", "norma dalam kehidupan bermasyarakat"], genap: ["keberagaman dalam bingkai Bhinneka Tunggal Ika", "wilayah NKRI dan lingkungan sekitar"] },
      6: { ganjil: ["nilai Pancasila dalam kehidupan sehari-hari", "hak, kewajiban, dan tanggung jawab warga"], genap: ["persatuan dan kesatuan bangsa", "menjaga keutuhan NKRI"] },
    },
  },
  {
    mapel: "Bahasa Indonesia",
    elemen: [
      { nama: "Menyimak", capaian: "Memahami pesan dan informasi lisan dari teks dan gambar." },
      { nama: "Membaca dan Memirsa", capaian: "Membaca dan memahami informasi dari teks tulis serta visual." },
      { nama: "Berbicara dan Mempresentasikan", capaian: "Menyampaikan gagasan secara lisan dengan runtut dan santun." },
      { nama: "Menulis", capaian: "Menulis kata, kalimat, dan teks sederhana sesuai kaidah." },
    ],
    cp: {
      A: "Pada akhir Fase A, peserta didik mampu menjadi penyimak dan pembaca yang baik, memahami pesan lisan dan informasi dari teks sederhana serta gambar, mengungkapkan gagasan secara lisan, serta menulis permulaan dengan huruf lepas dan tegak bersambung.",
      B: "Pada akhir Fase B, peserta didik mampu memahami informasi dari teks lisan, tulis, dan visual, menyampaikan gagasan dengan runtut, serta menulis teks narasi, deskripsi, dan prosedur sederhana.",
      C: "Pada akhir Fase C, peserta didik mampu memahami dan menanggapi informasi dari beragam teks, menyampaikan gagasan secara logis dan santun, serta menulis beragam teks sesuai struktur dan kaidah kebahasaan.",
    },
    know: "Memahami isi dan informasi",
    doo: "Menyusun dan menyampaikan",
    topics: {
      1: { ganjil: ["mengenal huruf dan bunyi", "membaca suku kata dan kata"], genap: ["membaca kata dan kalimat sederhana", "menulis huruf tegak bersambung"] },
      2: { ganjil: ["teks deskripsi sederhana", "membaca lancar kalimat"], genap: ["teks petunjuk/prosedur sederhana", "menulis kalimat dan cerita pendek"] },
      3: { ganjil: ["teks narasi (cerita)", "kosakata baru dan kalimat"], genap: ["teks deskripsi", "teks prosedur sederhana"] },
      4: { ganjil: ["teks narasi dan fiksi", "gagasan pokok dan pendukung"], genap: ["teks deskripsi", "teks arahan/petunjuk"] },
      5: { ganjil: ["teks narasi dan pantun", "gagasan pokok paragraf"], genap: ["teks eksplanasi sederhana", "teks iklan dan poster"] },
      6: { ganjil: ["teks narasi dan cerita fiksi", "teks laporan sederhana"], genap: ["teks eksplanasi", "teks pidato/persuasi sederhana"] },
    },
  },
  {
    mapel: "Matematika",
    elemen: [
      { nama: "Bilangan", capaian: "Membilang, mengurutkan, membandingkan, dan mengoperasikan bilangan." },
      { nama: "Aljabar", capaian: "Mengenal pola bilangan dan kalimat matematika sederhana." },
      { nama: "Pengukuran", capaian: "Melakukan pengukuran panjang, berat, waktu, dan satuannya." },
      { nama: "Geometri", capaian: "Mengenal dan mengidentifikasi bangun datar serta bangun ruang." },
      { nama: "Analisis Data dan Peluang", capaian: "Mengumpulkan, menyajikan, dan menafsirkan data sederhana." },
    ],
    cp: {
      A: "Pada akhir Fase A, peserta didik mampu membilang, mengurutkan, dan membandingkan bilangan cacah sampai 100, melakukan penjumlahan dan pengurangan, mengenal bangun datar dan bangun ruang, serta melakukan pengukuran sederhana.",
      B: "Pada akhir Fase B, peserta didik mampu melakukan operasi hitung bilangan cacah dan pecahan sederhana, mengenal pola bilangan, melakukan pengukuran panjang, berat, dan waktu, mengidentifikasi bangun datar, serta menyajikan data.",
      C: "Pada akhir Fase C, peserta didik mampu melakukan operasi hitung bilangan cacah besar, pecahan, dan desimal, menyelesaikan masalah KPK dan FPB, menghitung keliling, luas, dan volume, serta mengumpulkan dan menyajikan data.",
    },
    know: "Memahami konsep",
    doo: "Menyelesaikan masalah terkait",
    topics: {
      1: { ganjil: ["bilangan cacah sampai 20", "penjumlahan dan pengurangan"], genap: ["bangun datar dan bangun ruang", "pengukuran panjang satuan tidak baku"] },
      2: { ganjil: ["bilangan cacah sampai 100", "penjumlahan dan pengurangan bersusun"], genap: ["perkalian dan pembagian dasar", "pengukuran waktu dan panjang"] },
      3: { ganjil: ["bilangan cacah sampai 1000", "perkalian dan pembagian"], genap: ["pecahan sederhana", "bangun datar dan keliling"] },
      4: { ganjil: ["bilangan cacah dan nilai tempat", "faktor dan kelipatan (KPK dan FPB)"], genap: ["pecahan dan operasinya", "keliling dan luas bangun datar"] },
      5: { ganjil: ["operasi pecahan dan desimal", "perbandingan dan skala"], genap: ["bangun ruang dan volume", "pengumpulan dan penyajian data"] },
      6: { ganjil: ["bilangan bulat dan operasinya", "lingkaran: keliling dan luas"], genap: ["bangun ruang dan volume", "statistika: rata-rata, median, dan modus"] },
    },
  },
  {
    mapel: "Ilmu Pengetahuan Alam dan Sosial",
    elemen: [
      { nama: "Pemahaman IPAS (sains dan sosial)", capaian: "Memahami konsep alam dan sosial di lingkungan sekitar." },
      { nama: "Keterampilan Proses", capaian: "Mengamati, mempertanyakan, menyelidiki, dan mengomunikasikan hasil." },
    ],
    cp: {
      B: "Pada akhir Fase B, peserta didik mengenal wujud dan sifat benda, gaya dan gerak, bagian tubuh makhluk hidup, serta mengidentifikasi lingkungan sekitar, keragaman budaya, dan kegiatan ekonomi masyarakat.",
      C: "Pada akhir Fase C, peserta didik mampu menjelaskan sistem organ tubuh, siklus hidup makhluk hidup, energi dan perubahannya, tata surya, serta menganalisis kondisi geografis, kebhinekaan, dan aktivitas ekonomi masyarakat Indonesia.",
    },
    know: "Memahami konsep",
    doo: "Menyelidiki dan menyajikan hasil pengamatan tentang",
    topics: {
      3: { ganjil: ["makhluk hidup dan lingkungannya", "wujud dan sifat benda"], genap: ["gaya dan gerak", "lingkungan sekitar dan denah"] },
      4: { ganjil: ["bagian tubuh tumbuhan dan fungsinya", "gaya dan energi di sekitar kita"], genap: ["keragaman budaya dan kearifan lokal", "kegiatan ekonomi masyarakat"] },
      5: { ganjil: ["sistem organ tubuh manusia", "siklus air dan perubahan wujud zat"], genap: ["ekosistem dan rantai makanan", "kondisi geografis Indonesia"] },
      6: { ganjil: ["sistem tata surya", "energi dan perubahannya (listrik dan magnet)"], genap: ["perkembangbiakan makhluk hidup", "kebhinekaan dan kerja sama negara ASEAN"] },
    },
  },
  {
    mapel: "Seni Rupa",
    elemen: [
      { nama: "Mengalami", capaian: "Mengamati dan mengeksplorasi unsur dan karya seni rupa." },
      { nama: "Menciptakan", capaian: "Menciptakan karya seni rupa sesuai konsep dan teknik." },
      { nama: "Merefleksikan", capaian: "Menilai dan memaknai proses serta hasil berkarya." },
      { nama: "Berpikir dan Bekerja Artistik", capaian: "Berkarya secara kreatif, mandiri, dan bertanggung jawab." },
      { nama: "Berdampak", capaian: "Menghargai peran seni dalam kehidupan dan budaya." },
    ],
    cp: {
      A: "Pada akhir Fase A, peserta didik mampu mengamati, mengenal, dan mengeksplorasi unsur rupa serta menciptakan karya seni rupa sederhana sebagai ungkapan diri.",
      B: "Pada akhir Fase B, peserta didik mampu mengeksplorasi alat, bahan, dan teknik untuk menciptakan karya seni rupa dua dan tiga dimensi serta mengapresiasi karya.",
      C: "Pada akhir Fase C, peserta didik mampu menciptakan karya seni rupa dengan berbagai teknik dan media, serta mengapresiasi dan mengomunikasikan makna karya.",
    },
    know: "Memahami unsur dan teknik",
    doo: "Membuat dan menampilkan karya",
    topics: {
      1: { ganjil: ["mengenal garis, bentuk, dan warna", "menggambar dan mewarnai"], genap: ["membentuk dari bahan lunak", "membuat karya kolase sederhana"] },
      2: { ganjil: ["menggambar objek di sekitar", "eksplorasi warna dan tekstur"], genap: ["membuat karya cetak sederhana", "kerajinan dari bahan alam"] },
      3: { ganjil: ["menggambar ekspresif", "ragam hias sederhana"], genap: ["karya kolase dan mozaik", "kerajinan tiga dimensi"] },
      4: { ganjil: ["menggambar ilustrasi", "membuat motif dekoratif"], genap: ["karya cetak dan cap", "membuat karya tiga dimensi"] },
      5: { ganjil: ["menggambar perspektif sederhana", "seni dekoratif dan ragam hias"], genap: ["membuat poster dan komik", "kerajinan dari bahan bekas"] },
      6: { ganjil: ["menggambar ilustrasi dan komik", "desain motif dan pola"], genap: ["membuat karya untuk pameran", "kerajinan kreatif dan pameran karya"] },
    },
  },
  {
    mapel: "Pendidikan Jasmani, Olahraga, dan Kesehatan",
    elemen: [
      { nama: "Keterampilan Gerak", capaian: "Mempraktikkan gerak dasar dan variasinya dalam aktivitas jasmani." },
      { nama: "Pengetahuan Gerak", capaian: "Memahami konsep dan prinsip gerak dalam aktivitas jasmani." },
      { nama: "Pemanfaatan Gerak", capaian: "Menerapkan aktivitas jasmani untuk kebugaran dan kesehatan." },
      { nama: "Pengembangan Karakter", capaian: "Menunjukkan perilaku tanggung jawab, kerja sama, dan sportif." },
    ],
    cp: {
      A: "Pada akhir Fase A, peserta didik mampu menunjukkan kemampuan gerak dasar lokomotor, non-lokomotor, dan manipulatif, serta membiasakan pola hidup sehat.",
      B: "Pada akhir Fase B, peserta didik mampu menerapkan variasi gerak dasar dalam permainan dan aktivitas jasmani, serta memahami pola hidup sehat dan bugar.",
      C: "Pada akhir Fase C, peserta didik mampu mengombinasikan gerak dasar dalam berbagai permainan dan olahraga, serta menganalisis pola hidup sehat dan kebugaran jasmani.",
    },
    know: "Memahami konsep gerak",
    doo: "Mempraktikkan gerak",
    topics: {
      1: { ganjil: ["gerak lokomotor (jalan, lari, lompat)", "gerak non-lokomotor"], genap: ["gerak manipulatif (melempar dan menangkap)", "pola hidup sehat dan kebersihan diri"] },
      2: { ganjil: ["variasi gerak dasar lokomotor", "permainan bola sederhana"], genap: ["senam ketangkasan sederhana", "aktivitas kebugaran"] },
      3: { ganjil: ["variasi gerak permainan bola besar", "gerak dasar atletik"], genap: ["senam lantai sederhana", "pola hidup sehat"] },
      4: { ganjil: ["permainan bola besar dan kecil", "aktivitas atletik (lari dan lompat)"], genap: ["senam dan aktivitas ritmik", "kebugaran jasmani"] },
      5: { ganjil: ["kombinasi gerak permainan bola besar", "atletik: lompat dan lempar"], genap: ["senam lantai", "kesehatan: pola makan dan penyakit"] },
      6: { ganjil: ["permainan bola besar dan kecil (lanjutan)", "kebugaran jasmani dan pengukurannya"], genap: ["senam ritmik dan lantai", "kesehatan: pubertas dan bahaya narkoba"] },
    },
  },
  {
    mapel: "Bahasa Inggris",
    elemen: [
      { nama: "Menyimak – Berbicara (Listening – Speaking)", capaian: "Menggunakan bahasa Inggris untuk berinteraksi lisan sederhana." },
      { nama: "Membaca – Memirsa (Reading – Viewing)", capaian: "Memahami kata dan kalimat pendek dari teks dan gambar." },
      { nama: "Menulis – Mempresentasikan (Writing – Presenting)", capaian: "Menuliskan kata dan kalimat sederhana sesuai konteks." },
    ],
    cp: {
      A: "Pada akhir Fase A, peserta didik mengenal dan menggunakan kosakata bahasa Inggris sederhana terkait diri dan lingkungan terdekat melalui aktivitas menyimak dan berbicara.",
      B: "Pada akhir Fase B, peserta didik memahami dan menggunakan ungkapan sederhana dalam interaksi sehari-hari serta membaca kata dan kalimat pendek.",
      C: "Pada akhir Fase C, peserta didik menggunakan bahasa Inggris untuk berinteraksi sederhana dan memahami teks pendek terkait kehidupan sehari-hari.",
    },
    know: "Memahami kosakata dan ungkapan",
    doo: "Menggunakan bahasa Inggris untuk",
    topics: {
      1: { ganjil: ["greetings and self-introduction", "numbers and colors"], genap: ["family members", "things in the classroom"] },
      2: { ganjil: ["parts of the body", "animals and fruits"], genap: ["days and time", "simple daily activities"] },
      3: { ganjil: ["my house and things", "hobbies and likes"], genap: ["food and drink", "expressions of feeling"] },
      4: { ganjil: ["daily routines", "places in my town"], genap: ["clothes and weather", "asking and giving information"] },
      5: { ganjil: ["describing people and things", "public places and directions"], genap: ["past activities", "short descriptive texts"] },
      6: { ganjil: ["daily activities and schedules", "describing experiences"], genap: ["simple short stories", "expressing plans and intentions"] },
    },
  },
];

// =====================================================================
// SMA / MA — Fase E (kelas 10), Fase F (kelas 11–12)
// =====================================================================
const SMA_SUBJECTS = [
  {
    mapel: "Pendidikan Agama Islam dan Budi Pekerti",
    elemen: [
      { nama: "Al-Qur'an dan Hadis", capaian: "Menganalisis ayat Al-Qur'an dan hadis serta menerapkan kandungannya." },
      { nama: "Akidah", capaian: "Menganalisis cabang iman dan penerapannya dalam kehidupan." },
      { nama: "Akhlak", capaian: "Membiasakan akhlak mulia dan menghindari akhlak tercela." },
      { nama: "Fikih", capaian: "Menganalisis ketentuan hukum Islam dalam muamalah dan ibadah." },
      { nama: "Sejarah Peradaban Islam", capaian: "Mengevaluasi peran Islam dalam peradaban dunia dan Indonesia." },
    ],
    cp: {
      E: "Pada akhir Fase E, peserta didik mampu menganalisis ayat Al-Qur'an dan hadis tentang berpikir kritis dan kontrol diri, memahami cabang iman, menerapkan akhlak mulia, memahami hukum muamalah, serta meneladani peran Islam dalam peradaban Indonesia.",
      F: "Pada akhir Fase F, peserta didik mampu menganalisis ayat dan hadis tentang toleransi dan etos kerja, memperdalam akidah dan akhlak, menganalisis hukum pernikahan dan waris, serta mengevaluasi perkembangan Islam di dunia.",
    },
    know: "Menganalisis dan memahami",
    doo: "Menerapkan dan menyajikan",
    topics: {
      10: { ganjil: ["berpikir kritis dan kontrol diri (kajian Al-Qur'an)", "hakikat iman dan cabang-cabangnya"], genap: ["akhlak mulia dan menghindari pergaulan bebas", "sejarah dakwah Islam di Indonesia"] },
      11: { ganjil: ["toleransi dan menghindari kekerasan", "iman kepada kitab-kitab Allah"], genap: ["etos kerja dan berkompetisi dalam kebaikan", "peradaban Islam pada masa kejayaan"] },
      12: { ganjil: ["berpikir kritis dan demokrasi dalam Islam", "iman kepada hari akhir dan qada qadar"], genap: ["hukum pernikahan dan waris dalam Islam", "perkembangan Islam di dunia"] },
    },
  },
  {
    mapel: "Pendidikan Pancasila",
    elemen: [
      { nama: "Pancasila", capaian: "Menganalisis kedudukan dan penerapan nilai Pancasila." },
      { nama: "Undang-Undang Dasar Negara Republik Indonesia Tahun 1945", capaian: "Menganalisis konstitusi, hukum, dan hak asasi manusia." },
      { nama: "Bhinneka Tunggal Ika", capaian: "Menghargai dan merawat kebinekaan bangsa Indonesia." },
      { nama: "Negara Kesatuan Republik Indonesia", capaian: "Menganalisis komitmen dan ketahanan terhadap NKRI." },
    ],
    cp: {
      E: "Pada akhir Fase E, peserta didik mampu menganalisis kedudukan Pancasila sebagai dasar negara dan pandangan hidup, memahami UUD NRI 1945 dan hubungan antarlembaga negara, menghargai kebinekaan, serta menunjukkan komitmen terhadap NKRI.",
      F: "Pada akhir Fase F, peserta didik mampu mengevaluasi penerapan Pancasila dalam kehidupan berbangsa, menganalisis sistem hukum dan hak asasi manusia, serta merancang solusi atas persoalan kebinekaan dan ketahanan nasional.",
    },
    know: "Menganalisis",
    doo: "Menyajikan hasil analisis tentang",
    topics: {
      10: { ganjil: ["Pancasila sebagai dasar negara dan ideologi", "kedudukan dan fungsi UUD NRI 1945"], genap: ["hak dan kewajiban warga negara", "kebinekaan dan integrasi nasional"] },
      11: { ganjil: ["penerapan nilai Pancasila dalam kehidupan", "sistem hukum dan peradilan nasional"], genap: ["hak asasi manusia", "peran Indonesia dalam hubungan internasional"] },
      12: { ganjil: ["dinamika penerapan Pancasila", "demokrasi Pancasila dan sistem pemerintahan"], genap: ["persatuan dan ketahanan nasional", "wawasan nusantara dan bela negara"] },
    },
  },
  {
    mapel: "Bahasa Indonesia",
    elemen: [
      { nama: "Menyimak", capaian: "Mengevaluasi gagasan dan pesan dari teks yang didengar." },
      { nama: "Membaca dan Memirsa", capaian: "Mengevaluasi informasi dari beragam teks tulis dan visual." },
      { nama: "Berbicara dan Mempresentasikan", capaian: "Menyampaikan gagasan secara logis, kritis, dan santun." },
      { nama: "Menulis", capaian: "Menulis beragam teks akademik dan kreatif sesuai kaidah." },
    ],
    cp: {
      E: "Pada akhir Fase E, peserta didik mampu mengevaluasi informasi dari beragam teks, menyampaikan gagasan secara logis dan kritis, serta menulis teks laporan, eksposisi, dan argumentasi dengan kaidah kebahasaan yang tepat.",
      F: "Pada akhir Fase F, peserta didik mampu mengevaluasi dan mengreasi beragam teks akademik dan sastra secara kritis, kreatif, dan bertanggung jawab dalam berbagai konteks.",
    },
    know: "Mengevaluasi struktur dan isi",
    doo: "Menyusun dan menyajikan",
    topics: {
      10: { ganjil: ["teks laporan hasil observasi", "teks anekdot"], genap: ["teks negosiasi", "teks biografi dan puisi"] },
      11: { ganjil: ["teks prosedur dan eksplanasi", "teks ceramah"], genap: ["teks cerpen", "teks proposal dan karya ilmiah"] },
      12: { ganjil: ["teks editorial dan opini", "novel sejarah"], genap: ["artikel ilmiah populer", "teks drama dan kritik sastra"] },
    },
  },
  {
    mapel: "Matematika",
    elemen: [
      { nama: "Bilangan", capaian: "Menggeneralisasi sifat operasi bilangan dan eksponen." },
      { nama: "Aljabar dan Fungsi", capaian: "Menganalisis persamaan, pertidaksamaan, dan fungsi." },
      { nama: "Geometri", capaian: "Menganalisis bangun geometri dan trigonometri." },
      { nama: "Analisis Data dan Peluang", capaian: "Menyajikan dan menafsirkan data serta menghitung peluang." },
      { nama: "Kalkulus", capaian: "Menganalisis limit, turunan, dan integral fungsi." },
    ],
    cp: {
      E: "Pada akhir Fase E, peserta didik mampu menggeneralisasi sifat bilangan berpangkat, menyelesaikan sistem persamaan dan pertidaksamaan, menganalisis fungsi kuadrat dan eksponen, serta menyajikan dan menafsirkan data statistik dan peluang.",
      F: "Pada akhir Fase F, peserta didik mampu menganalisis fungsi trigonometri, polinomial, limit, turunan, dan integral, serta menerapkan konsep vektor, matriks, dan peluang dalam pemecahan masalah.",
    },
    know: "Memahami konsep",
    doo: "Menyelesaikan masalah terkait",
    topics: {
      10: { ganjil: ["eksponen dan logaritma", "barisan dan deret"], genap: ["sistem persamaan dan pertidaksamaan linear", "fungsi kuadrat dan statistika"] },
      11: { ganjil: ["polinomial", "fungsi dan komposisi fungsi"], genap: ["lingkaran dan geometri analitik", "trigonometri (aturan sinus dan cosinus)"] },
      12: { ganjil: ["limit fungsi", "turunan dan aplikasinya"], genap: ["integral", "vektor, matriks, dan peluang"] },
    },
  },
  {
    mapel: "Bahasa Inggris",
    elemen: [
      { nama: "Menyimak – Berbicara (Listening – Speaking)", capaian: "Berkomunikasi lisan dalam berbagai konteks dan jenis teks." },
      { nama: "Membaca – Memirsa (Reading – Viewing)", capaian: "Memahami dan mengevaluasi teks tulis, visual, dan multimoda." },
      { nama: "Menulis – Mempresentasikan (Writing – Presenting)", capaian: "Menyusun dan menyajikan teks akademik dan sosial." },
    ],
    cp: {
      E: "Pada akhir Fase E, peserta didik menggunakan bahasa Inggris untuk berkomunikasi dalam berbagai konteks melalui beragam jenis teks lisan, tulis, visual, dan multimoda.",
      F: "Pada akhir Fase F, peserta didik menggunakan bahasa Inggris secara mandiri untuk berkomunikasi, menganalisis, dan mengreasi beragam teks dalam konteks akademik dan sosial yang lebih luas.",
    },
    know: "Memahami fungsi sosial dan struktur teks",
    doo: "Menyusun dan menyajikan teks tentang",
    topics: {
      10: { ganjil: ["descriptive and recount texts", "expressing opinions and preferences"], genap: ["narrative texts", "procedure and announcement texts"] },
      11: { ganjil: ["analytical exposition", "hortatory and persuasive texts"], genap: ["explanation texts", "job application and personal letters"] },
      12: { ganjil: ["discussion texts", "news items and reports"], genap: ["review texts", "academic presentations and speeches"] },
    },
  },
  {
    mapel: "Sejarah",
    elemen: [
      { nama: "Pemahaman Konsep Sejarah", capaian: "Memahami peristiwa dan konsep sejarah secara diakronik dan sinkronik." },
      { nama: "Keterampilan Proses Sejarah", capaian: "Meneliti, menganalisis sumber, dan menyajikan narasi sejarah." },
    ],
    cp: {
      E: "Pada akhir Fase E, peserta didik mampu memahami konsep dasar ilmu sejarah, asal-usul nenek moyang bangsa Indonesia, serta perkembangan kerajaan Hindu-Buddha dan Islam di Indonesia.",
      F: "Pada akhir Fase F, peserta didik mampu menganalisis peristiwa penjajahan, pergerakan nasional, proklamasi, mempertahankan kemerdekaan, hingga Indonesia kontemporer dalam konteks lokal, nasional, dan global.",
    },
    know: "Menganalisis",
    doo: "Menyajikan hasil telaah tentang",
    topics: {
      10: { ganjil: ["konsep dasar ilmu sejarah", "asal-usul nenek moyang dan jalur rempah"], genap: ["kerajaan Hindu-Buddha di Indonesia", "kerajaan Islam di Indonesia"] },
      11: { ganjil: ["kolonialisme dan imperialisme Eropa", "pergerakan kebangsaan Indonesia"], genap: ["pendudukan Jepang di Indonesia", "proklamasi dan pembentukan pemerintahan"] },
      12: { ganjil: ["perjuangan mempertahankan kemerdekaan", "demokrasi liberal dan terpimpin"], genap: ["Orde Baru dan Reformasi", "Indonesia dalam peristiwa global kontemporer"] },
    },
  },
  {
    mapel: "Pendidikan Jasmani, Olahraga, dan Kesehatan",
    elemen: [
      { nama: "Keterampilan Gerak", capaian: "Mempraktikkan keterampilan gerak dalam olahraga dan aktivitas jasmani." },
      { nama: "Pengetahuan Gerak", capaian: "Menganalisis konsep, strategi, dan taktik gerak." },
      { nama: "Pemanfaatan Gerak", capaian: "Merancang program kebugaran dan pola hidup sehat." },
      { nama: "Pengembangan Karakter", capaian: "Menunjukkan sportivitas, kerja sama, dan tanggung jawab." },
    ],
    cp: {
      E: "Pada akhir Fase E, peserta didik mampu menganalisis dan mempraktikkan keterampilan gerak dalam permainan, olahraga, senam, ritmik, dan air, serta menerapkan pola hidup sehat.",
      F: "Pada akhir Fase F, peserta didik mampu merancang dan mengevaluasi keterampilan gerak dan program kebugaran, serta menganalisis peran aktivitas jasmani bagi kesehatan.",
    },
    know: "Menganalisis konsep dan strategi",
    doo: "Mempraktikkan keterampilan gerak",
    topics: {
      10: { ganjil: ["permainan bola besar (sepak bola, voli, basket)", "aktivitas atletik"], genap: ["bela diri dan senam", "kebugaran jasmani dan pola hidup sehat"] },
      11: { ganjil: ["variasi dan strategi permainan bola besar", "atletik dan aktivitas ritmik"], genap: ["aktivitas senam dan bela diri", "kesehatan: pergaulan sehat dan gizi"] },
      12: { ganjil: ["strategi dan taktik permainan olahraga", "program kebugaran jasmani"], genap: ["aktivitas ritmik dan senam lanjutan", "kesehatan: pencegahan penyakit dan P3K"] },
    },
  },
  {
    mapel: "Informatika",
    elemen: [
      { nama: "Berpikir Komputasional", capaian: "Menerapkan strategi penyelesaian masalah secara komputasional." },
      { nama: "Sistem Komputer dan Jaringan", capaian: "Memahami sistem komputer, jaringan, dan internet." },
      { nama: "Analisis Data", capaian: "Mengumpulkan, mengolah, dan menganalisis data." },
      { nama: "Algoritma dan Pemrograman", capaian: "Merancang algoritma dan mengembangkan program." },
      { nama: "Dampak Sosial Informatika", capaian: "Mengevaluasi aspek etika, keamanan, dan dampak teknologi." },
    ],
    cp: {
      E: "Pada akhir Fase E, peserta didik mampu menerapkan berpikir komputasional, memanfaatkan aplikasi perkantoran, memahami sistem komputer dan jaringan, mengolah data, serta memahami dampak sosial informatika.",
      F: "Pada akhir Fase F, peserta didik mampu mengembangkan program, menganalisis data kompleks, merancang solusi komputasi lintas bidang, serta mengevaluasi keamanan dan etika teknologi informasi.",
    },
    know: "Memahami konsep",
    doo: "Menerapkan dan membuat solusi",
    topics: {
      10: { ganjil: ["berpikir komputasional", "perangkat keras dan sistem komputer"], genap: ["jaringan komputer dan internet", "aplikasi perkantoran dan pengolahan data"] },
      11: { ganjil: ["algoritma dan pemrograman dasar", "struktur data dan basis data"], genap: ["analisis data", "dampak sosial dan etika informatika"] },
      12: { ganjil: ["pemrograman lanjutan", "pengembangan aplikasi"], genap: ["proyek analisis data", "keamanan informasi dan praktik lintas bidang"] },
    },
  },
  {
    mapel: "Seni Budaya",
    elemen: [
      { nama: "Mengalami", capaian: "Mengamati dan mengeksplorasi karya seni secara kontekstual." },
      { nama: "Menciptakan", capaian: "Menciptakan karya seni sesuai konsep dan teknik." },
      { nama: "Merefleksikan", capaian: "Menilai dan memaknai proses serta hasil berkarya." },
      { nama: "Berpikir dan Bekerja Artistik", capaian: "Berkarya kreatif, kolaboratif, dan bertanggung jawab." },
      { nama: "Berdampak", capaian: "Mengevaluasi peran seni dalam kehidupan sosial-budaya." },
    ],
    cp: {
      E: "Pada akhir Fase E, peserta didik mampu mengalami, menciptakan, dan merefleksikan karya seni sebagai ekspresi diri dan apresiasi budaya secara kontekstual.",
      F: "Pada akhir Fase F, peserta didik mampu menciptakan dan menampilkan karya seni yang bermakna serta mengevaluasi peran seni dalam kehidupan sosial-budaya.",
    },
    know: "Memahami konsep dan teknik",
    doo: "Membuat dan menampilkan karya",
    topics: {
      10: { ganjil: ["apresiasi dan kreasi seni rupa", "seni musik: kreasi dan pertunjukan"], genap: ["seni tari dan pola gerak", "seni teater dan pementasan"] },
      11: { ganjil: ["berkarya seni rupa dua dan tiga dimensi", "aransemen dan pergelaran musik"], genap: ["kreasi tari", "produksi teater"] },
      12: { ganjil: ["pameran karya seni rupa", "pergelaran musik"], genap: ["pertunjukan tari", "pementasan teater dan evaluasi karya"] },
    },
  },
  {
    mapel: "Fisika",
    elemen: [
      { nama: "Pemahaman Fisika", capaian: "Memahami konsep, hukum, dan prinsip fisika." },
      { nama: "Keterampilan Proses", capaian: "Merancang percobaan, mengolah data, dan menyimpulkan." },
    ],
    cp: {
      E: "Pada akhir Fase E, peserta didik mampu memahami pengukuran, gerak, energi, serta gejala pemanasan global melalui penerapan keterampilan proses ilmiah.",
      F: "Pada akhir Fase F, peserta didik mampu menganalisis kinematika, dinamika, fluida, termodinamika, gelombang, listrik, magnet, dan fisika modern melalui percobaan dan pemodelan.",
    },
    know: "Menganalisis konsep",
    doo: "Melakukan percobaan dan menyajikan data tentang",
    topics: {
      10: { ganjil: ["pengukuran dan besaran", "gerak lurus dan gerak parabola"], genap: ["usaha dan energi", "pemanasan global dan energi terbarukan"] },
      11: { ganjil: ["dinamika gerak dan hukum Newton", "fluida statis dan dinamis"], genap: ["suhu, kalor, dan termodinamika", "gelombang dan bunyi"] },
      12: { ganjil: ["listrik statis dan dinamis", "medan magnet dan induksi elektromagnetik"], genap: ["gelombang elektromagnetik dan optik", "fisika modern (relativitas dan kuantum)"] },
    },
  },
  {
    mapel: "Kimia",
    elemen: [
      { nama: "Pemahaman Kimia", capaian: "Memahami struktur, sifat, dan perubahan materi." },
      { nama: "Keterampilan Proses", capaian: "Melakukan percobaan kimia dan menafsirkan datanya." },
    ],
    cp: {
      E: "Pada akhir Fase E, peserta didik mampu memahami struktur atom, sistem periodik, ikatan kimia, hukum dasar kimia, serta reaksi kimia dan penerapannya.",
      F: "Pada akhir Fase F, peserta didik mampu menganalisis termokimia, laju reaksi, kesetimbangan, asam-basa, redoks, elektrokimia, dan kimia karbon melalui percobaan.",
    },
    know: "Memahami konsep",
    doo: "Melakukan percobaan dan menyimpulkan tentang",
    topics: {
      10: { ganjil: ["struktur atom dan sistem periodik", "ikatan kimia"], genap: ["hukum dasar dan stoikiometri", "larutan dan reaksi kimia"] },
      11: { ganjil: ["termokimia", "laju reaksi"], genap: ["kesetimbangan kimia", "asam, basa, dan larutan penyangga"] },
      12: { ganjil: ["sifat koligatif larutan", "reaksi redoks dan elektrokimia"], genap: ["kimia unsur", "senyawa karbon dan makromolekul"] },
    },
  },
  {
    mapel: "Biologi",
    elemen: [
      { nama: "Pemahaman Biologi", capaian: "Memahami struktur, fungsi, dan proses kehidupan." },
      { nama: "Keterampilan Proses", capaian: "Melakukan pengamatan, percobaan, dan menyajikan hasil." },
    ],
    cp: {
      E: "Pada akhir Fase E, peserta didik mampu memahami keanekaragaman hayati, virus, monera, protista, jamur, serta peran makhluk hidup dan ekosistem.",
      F: "Pada akhir Fase F, peserta didik mampu menganalisis sel, sistem organ tubuh, metabolisme, genetika, evolusi, dan bioteknologi melalui pengamatan dan percobaan.",
    },
    know: "Menganalisis",
    doo: "Melakukan pengamatan dan menyajikan tentang",
    topics: {
      10: { ganjil: ["ruang lingkup biologi dan keanekaragaman hayati", "virus dan monera"], genap: ["protista dan fungi (jamur)", "ekosistem dan perubahan lingkungan"] },
      11: { ganjil: ["struktur dan fungsi sel", "sistem gerak dan sistem sirkulasi"], genap: ["sistem pencernaan dan pernapasan", "sistem ekskresi dan koordinasi"] },
      12: { ganjil: ["metabolisme dan enzim", "substansi genetika dan pembelahan sel"], genap: ["pewarisan sifat dan mutasi", "evolusi dan bioteknologi"] },
    },
  },
  {
    mapel: "Ekonomi",
    elemen: [
      { nama: "Pemahaman Konsep Ekonomi", capaian: "Memahami konsep dan permasalahan ekonomi." },
      { nama: "Keterampilan Proses Ekonomi", capaian: "Menganalisis data dan menyajikan solusi ekonomi." },
    ],
    cp: {
      E: "Pada akhir Fase E, peserta didik mampu memahami konsep dasar ilmu ekonomi, kelangkaan, kegiatan ekonomi, pasar, dan sistem pembayaran.",
      F: "Pada akhir Fase F, peserta didik mampu menganalisis pendapatan nasional, ketenagakerjaan, kebijakan moneter dan fiskal, perdagangan internasional, serta akuntansi perusahaan.",
    },
    know: "Menganalisis konsep",
    doo: "Menyajikan hasil analisis tentang",
    topics: {
      10: { ganjil: ["konsep dasar ilmu ekonomi dan kelangkaan", "kegiatan dan pelaku ekonomi"], genap: ["permintaan, penawaran, dan pasar", "sistem pembayaran dan lembaga keuangan"] },
      11: { ganjil: ["pendapatan nasional dan pertumbuhan ekonomi", "ketenagakerjaan dan pembangunan"], genap: ["APBN, APBD, dan perpajakan", "kebijakan moneter dan fiskal"] },
      12: { ganjil: ["perdagangan internasional dan kerja sama ekonomi", "akuntansi sebagai sistem informasi"], genap: ["siklus akuntansi perusahaan jasa", "siklus akuntansi perusahaan dagang"] },
    },
  },
  {
    mapel: "Geografi",
    elemen: [
      { nama: "Pemahaman Geografi", capaian: "Memahami fenomena geosfer dan interaksi antarwilayah." },
      { nama: "Keterampilan Proses Geografi", capaian: "Membaca peta, mengolah data spasial, dan menyajikan laporan." },
    ],
    cp: {
      E: "Pada akhir Fase E, peserta didik mampu memahami pengetahuan dasar geografi, fenomena geosfer, serta dinamika litosfer, atmosfer, dan hidrosfer.",
      F: "Pada akhir Fase F, peserta didik mampu menganalisis dinamika kependudukan, sumber daya alam, kewilayahan, mitigasi bencana, serta kerja sama negara maju dan berkembang.",
    },
    know: "Menganalisis",
    doo: "Menyajikan peta atau laporan tentang",
    topics: {
      10: { ganjil: ["pengetahuan dasar dan objek geografi", "penginderaan jauh dan SIG"], genap: ["dinamika litosfer dan atmosfer", "dinamika hidrosfer dan bencana alam"] },
      11: { ganjil: ["keragaman flora dan fauna", "sumber daya alam dan pengelolaannya"], genap: ["dinamika kependudukan", "keragaman budaya dan kearifan lokal"] },
      12: { ganjil: ["wilayah dan tata ruang", "interaksi desa dan kota"], genap: ["negara maju dan berkembang", "kerja sama dan interaksi antarwilayah global"] },
    },
  },
  {
    mapel: "Sosiologi",
    elemen: [
      { nama: "Pemahaman Konsep Sosiologi", capaian: "Memahami gejala, hubungan, dan struktur sosial." },
      { nama: "Keterampilan Proses Sosiologi", capaian: "Melakukan kajian dan penelitian sosial sederhana." },
    ],
    cp: {
      E: "Pada akhir Fase E, peserta didik mampu memahami fungsi sosiologi, individu dan kelompok sosial, hubungan sosial, serta gejala sosial di masyarakat.",
      F: "Pada akhir Fase F, peserta didik mampu menganalisis kelompok sosial, permasalahan sosial, konflik, integrasi, perubahan sosial, dan pemberdayaan komunitas.",
    },
    know: "Menganalisis",
    doo: "Menyajikan hasil kajian tentang",
    topics: {
      10: { ganjil: ["fungsi sosiologi dan gejala sosial", "individu, kelompok, dan hubungan sosial"], genap: ["ragam gejala sosial di masyarakat", "nilai, norma, dan sosialisasi"] },
      11: { ganjil: ["kelompok sosial dan diferensiasi", "permasalahan sosial di masyarakat"], genap: ["konflik, kekerasan, dan perdamaian", "integrasi dan reintegrasi sosial"] },
      12: { ganjil: ["perubahan sosial dan globalisasi", "ketimpangan sosial"], genap: ["kearifan lokal dan pemberdayaan komunitas", "penelitian sosial sederhana"] },
    },
  },
];

// =====================================================================
// SMK / MAK — Fase E (kelas 10), Fase F (kelas 11–12)
// Muatan umum (nasional) mengikuti kerangka SMA; ditambah muatan kejuruan.
// =====================================================================
const SMA_BY_MAPEL = Object.fromEntries(SMA_SUBJECTS.map((s) => [s.mapel, s]));

// Ambil salinan mata pelajaran umum dengan pembatasan kelas tertentu (SMK
// menawarkan beberapa mapel umum hanya pada kelas 10/11).
function pickKelas(subj, kelasArr) {
  const topics = {};
  kelasArr.forEach((k) => {
    if (subj.topics[k]) topics[k] = subj.topics[k];
  });
  return { ...subj, topics };
}

const SMK_SUBJECTS = [
  pickKelas(SMA_BY_MAPEL["Pendidikan Agama Islam dan Budi Pekerti"], [10, 11, 12]),
  pickKelas(SMA_BY_MAPEL["Pendidikan Pancasila"], [10, 11, 12]),
  pickKelas(SMA_BY_MAPEL["Bahasa Indonesia"], [10, 11, 12]),
  pickKelas(SMA_BY_MAPEL["Matematika"], [10, 11, 12]),
  pickKelas(SMA_BY_MAPEL["Bahasa Inggris"], [10, 11, 12]),
  pickKelas(SMA_BY_MAPEL["Pendidikan Jasmani, Olahraga, dan Kesehatan"], [10, 11]),
  pickKelas(SMA_BY_MAPEL["Sejarah"], [10]),
  pickKelas(SMA_BY_MAPEL["Seni Budaya"], [10]),
  pickKelas(SMA_BY_MAPEL["Informatika"], [10]),
  {
    mapel: "Projek Ilmu Pengetahuan Alam dan Sosial",
    elemen: [
      { nama: "Menjelaskan Fenomena secara Ilmiah", capaian: "Menjelaskan fenomena alam dan sosial di lingkup pekerjaan." },
      { nama: "Mendesain dan Mengevaluasi Penyelidikan", capaian: "Merancang dan mengevaluasi penyelidikan sederhana." },
      { nama: "Menerjemahkan Data dan Bukti", capaian: "Menerjemahkan data dan bukti untuk mengambil kesimpulan." },
    ],
    cp: {
      E: "Pada akhir Fase E, peserta didik mampu menjelaskan fenomena alam dan sosial secara ilmiah, merancang penyelidikan, serta menerjemahkan data dan bukti untuk memahami isu lingkungan, sosial, dan ekonomi dalam lingkup pekerjaan.",
    },
    know: "Menjelaskan fenomena tentang",
    doo: "Merancang penyelidikan tentang",
    topics: {
      10: { ganjil: ["makhluk hidup dan lingkungannya", "zat dan perubahannya"], genap: ["energi dan usaha dalam kehidupan", "interaksi sosial dan dinamika ekonomi"] },
    },
  },
  {
    mapel: "Dasar-dasar Program Keahlian",
    elemen: [
      { nama: "Proses Bisnis", capaian: "Memahami proses bisnis pada bidang keahlian." },
      { nama: "Perkembangan Teknologi", capaian: "Memahami perkembangan teknologi dan isu terkini bidang keahlian." },
      { nama: "Profesi dan Kewirausahaan", capaian: "Memahami profil profesi, peluang kerja, dan kewirausahaan." },
      { nama: "Teknik Dasar Proses Kerja", capaian: "Menerapkan teknik dasar dan keselamatan kerja." },
    ],
    cp: {
      E: "Pada akhir Fase E, peserta didik mampu memahami proses bisnis, perkembangan teknologi, profil profesi dan peluang kerja, serta teknik dasar proses kerja pada program keahliannya.",
    },
    know: "Memahami konsep",
    doo: "Menerapkan dasar-dasar",
    topics: {
      10: { ganjil: ["proses bisnis pada bidang keahlian", "perkembangan teknologi dan isu terkini bidang keahlian"], genap: ["profesi, peluang kerja, dan kewirausahaan", "teknik dasar dan keselamatan kerja (K3)"] },
    },
  },
  {
    mapel: "Konsentrasi Keahlian",
    elemen: [
      { nama: "Perencanaan Kerja", capaian: "Merencanakan pekerjaan sesuai standar dunia kerja." },
      { nama: "Pelaksanaan Kerja", capaian: "Melaksanakan pekerjaan teknis sesuai prosedur industri." },
      { nama: "Evaluasi dan Mutu", capaian: "Mengevaluasi hasil kerja dan menjaga mutu." },
    ],
    cp: {
      F: "Pada akhir Fase F, peserta didik mampu menguasai kompetensi teknis konsentrasi keahlian sesuai standar dunia kerja, meliputi perencanaan, pelaksanaan, dan evaluasi pekerjaan pada bidang keahliannya.",
    },
    know: "Menguasai kompetensi",
    doo: "Melaksanakan pekerjaan",
    topics: {
      11: { ganjil: ["kompetensi teknis dasar konsentrasi keahlian", "perencanaan dan prosedur kerja"], genap: ["pelaksanaan pekerjaan sesuai standar industri", "pengendalian mutu dan K3"] },
      12: { ganjil: ["kompetensi teknis lanjutan konsentrasi keahlian", "pemecahan masalah di dunia kerja"], genap: ["proyek kerja sesuai standar industri", "evaluasi dan sertifikasi kompetensi"] },
    },
  },
  {
    mapel: "Projek Kreatif dan Kewirausahaan",
    elemen: [
      { nama: "Ide dan Peluang", capaian: "Mengidentifikasi ide dan peluang usaha." },
      { nama: "Produksi", capaian: "Menghasilkan produk atau jasa kreatif." },
      { nama: "Pemasaran dan Keuangan", capaian: "Memasarkan produk dan mengelola keuangan usaha." },
    ],
    cp: {
      F: "Pada akhir Fase F, peserta didik mampu menghasilkan produk atau jasa kreatif melalui proses kewirausahaan, mulai dari ide, perencanaan, produksi, hingga pemasaran.",
    },
    know: "Memahami konsep",
    doo: "Menghasilkan dan memasarkan",
    topics: {
      11: { ganjil: ["ide dan peluang usaha", "perencanaan produk atau jasa kreatif"], genap: ["produksi produk atau jasa", "penghitungan biaya dan harga jual"] },
      12: { ganjil: ["pemasaran dan promosi produk", "manajemen usaha kecil"], genap: ["laporan keuangan sederhana", "evaluasi dan pengembangan usaha"] },
    },
  },
  {
    mapel: "Praktik Kerja Lapangan",
    elemen: [
      { nama: "Budaya Kerja", capaian: "Menginternalisasi budaya dan etos kerja industri." },
      { nama: "Penerapan Kompetensi", capaian: "Menerapkan kompetensi keahlian di dunia kerja nyata." },
    ],
    cp: {
      F: "Pada akhir Fase F, peserta didik mampu menerapkan kompetensi keahlian di dunia kerja nyata serta menginternalisasi budaya dan etos kerja industri.",
    },
    know: "Menerapkan kompetensi",
    doo: "Melaksanakan pekerjaan di dunia kerja pada",
    topics: {
      12: { ganjil: ["orientasi dunia kerja dan budaya industri", "penerapan kompetensi di tempat kerja"], genap: ["penyelesaian pekerjaan sesuai SOP industri", "penyusunan laporan dan refleksi PKL"] },
    },
  },
];

// Alokasi JP intrakurikuler (JP per minggu) — nilai wajar per jenjang.
const WEEKLY_JP = {
  SD: {
    "Pendidikan Agama Islam dan Budi Pekerti": 3,
    "Pendidikan Pancasila": 4,
    "Bahasa Indonesia": 6,
    "Matematika": 5,
    "Ilmu Pengetahuan Alam dan Sosial": 5,
    "Ilmu Pengetahuan Alam": 3,
    "Ilmu Pengetahuan Sosial": 3,
    "Bahasa Inggris": 2,
    "Seni Rupa": 3,
    "Pendidikan Jasmani, Olahraga, dan Kesehatan": 3,
  },
  SMA: {
    "Pendidikan Agama Islam dan Budi Pekerti": 3,
    "Pendidikan Pancasila": 2,
    "Bahasa Indonesia": 4,
    "Matematika": 4,
    "Bahasa Inggris": 3,
    "Sejarah": 2,
    "Pendidikan Jasmani, Olahraga, dan Kesehatan": 3,
    "Informatika": 2,
    "Seni Budaya": 2,
    "Fisika": 3,
    "Kimia": 3,
    "Biologi": 3,
    "Ekonomi": 3,
    "Geografi": 3,
    "Sosiologi": 3,
  },
  SMK: {
    "Pendidikan Agama Islam dan Budi Pekerti": 3,
    "Pendidikan Pancasila": 2,
    "Bahasa Indonesia": 3,
    "Matematika": 3,
    "Bahasa Inggris": 3,
    "Sejarah": 2,
    "Pendidikan Jasmani, Olahraga, dan Kesehatan": 2,
    "Seni Budaya": 2,
    "Informatika": 3,
    "Projek Ilmu Pengetahuan Alam dan Sosial": 4,
    "Dasar-dasar Program Keahlian": 12,
    "Konsentrasi Keahlian": 13,
    "Projek Kreatif dan Kewirausahaan": 5,
    "Praktik Kerja Lapangan": 12,
  },
};

// Bangun entri katalog Kurikulum Merdeka untuk satu jenjang.
//
// kelasCfg memetakan tiap kelas ke:
//   - store   : fase yang disimpan pada entri (penanda jenjang di aplikasi ini,
//               A/B/C = SD, D = SMP, E = SMA, F = SMK).
//   - content : fase resmi Kurikulum Merdeka sumber Capaian Pembelajaran
//               (SMA/SMK: kelas 10 = Fase E, kelas 11–12 = Fase F).
// rekelasCP: bila true, awalan "Pada akhir Fase X" pada CP ditulis ulang
//   menjadi "Pada akhir kelas N" agar selaras dengan penanda jenjang.
function buildJenjang(subjects, kelasCfg, jenjangKey, tema, rekelasCP, k13Opts) {
  const out = [];
  const weekly = WEEKLY_JP[jenjangKey] || {};
  // Tingkat terakhir jenjang memakai 16 minggu efektif/semester (kelas ujian),
  // tingkat lain 18 minggu (mengikuti pola alokasi pada seed SMP).
  const grades = Object.keys(kelasCfg).map(Number);
  const finalGrade = Math.max(...grades);
  const jpFor = (mapel, kelas, topicCount) => {
    const weeks = kelas === finalGrade ? 16 : 18;
    const total = (weekly[mapel] || 2) * weeks;
    return distributeJP(total, topicCount || 1);
  };

  // --- Kurikulum Merdeka ---
  for (const subj of subjects) {
    for (const kelas of grades) {
      const { store, content } = kelasCfg[kelas];
      const kelasTopics = subj.topics[kelas];
      let cp = subj.cp[content];
      if (!cp || !kelasTopics) continue;
      if (rekelasCP)
        cp = cp.replace(/^Pada akhir Fase [A-F],?\s*/i, `Pada akhir kelas ${kelas}, `);
      for (const semester of ["ganjil", "genap"]) {
        const topics = kelasTopics[semester] || [];
        const jpParts = jpFor(subj.mapel, kelas, topics.length);
        out.push({
          curriculumType: "merdeka",
          kelas,
          mapel: subj.mapel,
          semester,
          fase: store,
          capaianPembelajaran: cp,
          elemen: subj.elemen,
          materiPokok: topics.map((t, i) => makeMateri(t, jpParts[i])),
          tema,
          tujuanPembelajaran: topics.flatMap((t) => [
            cap(`${subj.know} ${t}.`),
            cap(`${subj.doo} ${t}.`),
          ]),
        });
      }
    }
  }

  // --- Kurikulum 2013 (K-13) ---
  if (k13Opts) {
    const { KI, nameMap = {}, skip = new Set(), extraSubjects = [] } = k13Opts;
    const k13Subjects = [
      ...subjects.filter((s) => !skip.has(s.mapel)),
      ...extraSubjects,
    ];
    for (const subj of k13Subjects) {
      const k13Name = nameMap[subj.mapel] || subj.mapel;
      for (const kelas of grades) {
        const { store } = kelasCfg[kelas];
        const kelasTopics = subj.topics[kelas];
        if (!kelasTopics) continue;
        for (const semester of ["ganjil", "genap"]) {
          const topics = kelasTopics[semester] || [];
          const jpParts = jpFor(subj.mapel, kelas, topics.length);
          out.push({
            curriculumType: "k13",
            kelas,
            mapel: k13Name,
            semester,
            fase: store,
            ...buildK13Fields(subj, topics, jpParts, KI),
          });
        }
      }
    }
  }
  return out;
}

// Seluruh entri Kurikulum Merdeka untuk SD (Fase A–C), SMA (Fase E), dan
// SMK (Fase F). Untuk SMA/SMK, isi CP diambil dari fase resmi (kelas 10 = E,
// kelas 11–12 = F) meski penanda jenjang aplikasi tetap E (SMA) atau F (SMK).
function buildCurriculumSeedExtra() {
  const sdCfg = {
    1: { store: "A", content: "A" },
    2: { store: "A", content: "A" },
    3: { store: "B", content: "B" },
    4: { store: "B", content: "B" },
    5: { store: "C", content: "C" },
    6: { store: "C", content: "C" },
  };
  const smaCfg = {
    10: { store: "E", content: "E" },
    11: { store: "E", content: "F" },
    12: { store: "E", content: "F" },
  };
  const smkCfg = {
    10: { store: "F", content: "E" },
    11: { store: "F", content: "F" },
    12: { store: "F", content: "F" },
  };
  return [
    ...buildJenjang(SD_SUBJECTS, sdCfg, "SD", P5_TEMA, false, {
      KI: K13_KI_SD,
      nameMap: K13_MAPEL_MAP,
      skip: K13_SKIP,
      extraSubjects: [IPA_SD_K13, IPS_SD_K13],
    }),
    ...buildJenjang(SMA_SUBJECTS, smaCfg, "SMA", P5_TEMA, true, {
      KI: K13_KI_SMA,
      nameMap: K13_MAPEL_MAP,
      skip: K13_SKIP,
    }),
    ...buildJenjang(SMK_SUBJECTS, smkCfg, "SMK", P5_TEMA_SMK, true, {
      KI: K13_KI_SMK,
      nameMap: K13_MAPEL_MAP,
      skip: K13_SKIP,
    }),
  ];
}

module.exports = { buildCurriculumSeedExtra };
