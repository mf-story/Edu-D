// ---------------------------------------------------------------------------
// Generator Bahan Ajar (materi bacaan) untuk jenjang SD/MI, Kurikulum Merdeka.
// Menghasilkan konten HTML terstruktur dan cukup panjang untuk setiap submateri
// pada katalog kurikulum (Fase A–C, kelas 1–6, semua mata pelajaran).
//
// Nama submateri pada katalog mengikuti pola tetap:
//   "Konsep dasar <topik>", "Ciri & struktur <topik>",
//   "Contoh & penerapan <topik>", "Latihan & evaluasi <topik>".
// Berdasarkan pola tersebut, tiap submateri memperoleh bahan ajar yang sesuai
// jenisnya (pengertian, ciri/struktur, contoh/penerapan, atau latihan).
// ---------------------------------------------------------------------------

// Escape karakter HTML pada teks dinamis (nama topik/mapel dari katalog).
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Huruf pertama menjadi kecil (untuk merangkai kalimat).
function lc(s) {
  const t = String(s || "").trim();
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

// Huruf pertama menjadi kapital.
function cap(s) {
  const t = String(s || "").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// Konteks singkat tiap mata pelajaran agar bahan ajar terasa relevan dengan
// karakter pelajarannya. Nama mapel disesuaikan dengan katalog SD Merdeka.
const MAPEL_CONTEXT = {
  "Pendidikan Agama Islam dan Budi Pekerti": {
    bidang: "pendidikan agama Islam dan budi pekerti",
    ranah: "keimanan, ibadah, dan akhlak mulia",
    kegiatan: "membaca, menghafal, dan membiasakan perilaku baik",
  },
  "Pendidikan Pancasila": {
    bidang: "Pendidikan Pancasila",
    ranah: "nilai-nilai Pancasila dan kehidupan bermasyarakat",
    kegiatan: "mengamati, berdiskusi, dan menerapkan sikap terpuji",
  },
  "Bahasa Indonesia": {
    bidang: "Bahasa Indonesia",
    ranah: "menyimak, membaca, berbicara, dan menulis",
    kegiatan: "membaca teks, berlatih menulis, dan bercerita",
  },
  "Bahasa Inggris": {
    bidang: "Bahasa Inggris",
    ranah: "listening, speaking, reading, dan writing",
    kegiatan: "menyimak, menirukan, dan berlatih kosakata",
  },
  Matematika: {
    bidang: "Matematika",
    ranah: "bilangan, pengukuran, geometri, dan data",
    kegiatan: "berhitung, mengamati pola, dan memecahkan masalah",
  },
  "Ilmu Pengetahuan Alam dan Sosial": {
    bidang: "IPAS (Ilmu Pengetahuan Alam dan Sosial)",
    ranah: "gejala alam dan kehidupan sosial di sekitar kita",
    kegiatan: "mengamati, menyelidiki, dan menyimpulkan",
  },
  "Seni Rupa": {
    bidang: "Seni Rupa",
    ranah: "unsur rupa, karya, dan kreativitas",
    kegiatan: "mengamati karya, berkreasi, dan berkarya",
  },
  "Pendidikan Jasmani, Olahraga, dan Kesehatan": {
    bidang: "Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)",
    ranah: "gerak dasar, kebugaran, dan pola hidup sehat",
    kegiatan: "melakukan gerak, berlatih, dan menjaga kesehatan",
  },
};

function mapelCtx(mapel) {
  return (
    MAPEL_CONTEXT[mapel] || {
      bidang: mapel || "mata pelajaran ini",
      ranah: "materi pembelajaran",
      kegiatan: "mengamati, berlatih, dan menyimpulkan",
    }
  );
}

// Kenali jenis submateri dari awalan namanya. Mengembalikan salah satu:
// "konsep" | "ciri" | "contoh" | "latihan" (default "konsep").
function detectType(submateriName) {
  const n = String(submateriName || "").toLowerCase();
  if (n.startsWith("konsep dasar")) return "konsep";
  if (n.startsWith("ciri")) return "ciri";
  if (n.startsWith("contoh")) return "contoh";
  if (n.startsWith("latihan")) return "latihan";
  return "konsep";
}

// Bagian pembuka standar yang menyebut mapel & kelas.
function head(judul) {
  return `<h3>${esc(judul)}</h3>`;
}

// ----- Template per jenis submateri -----

function tplKonsep(topik, mapel, kelas, ctx) {
  const t = esc(topik);
  const tl = esc(lc(topik));
  return [
    head(`Konsep Dasar: ${cap(topik)}`),
    `<p>Selamat belajar! Pada bahan ajar ini kamu akan mengenal <b>${tl}</b> dalam pelajaran <b>${esc(ctx.bidang)}</b> untuk <b>Kelas ${esc(kelas)}</b>. Bacalah dengan saksama, catat kata-kata penting, lalu diskusikan bersama teman dan gurumu.</p>`,
    `<h4>Pengertian</h4>`,
    `<p><b>${cap(topik)}</b> adalah salah satu materi penting dalam ${esc(ctx.bidang)} yang berkaitan dengan ${esc(ctx.ranah)}. Memahami ${tl} membantu kita mengenali hal-hal di sekitar, berpikir runtut, dan menyelesaikan berbagai tugas sehari-hari dengan lebih mudah.</p>`,
    `<h4>Mengapa Penting Dipelajari?</h4>`,
    `<ul>`,
    `<li>Menjadi dasar untuk memahami materi berikutnya tentang ${tl}.</li>`,
    `<li>Membantu kita ${esc(ctx.kegiatan)} secara lebih baik.</li>`,
    `<li>Berguna dalam kehidupan sehari-hari di rumah, sekolah, dan lingkungan.</li>`,
    `</ul>`,
    `<h4>Konsep-Konsep Kunci</h4>`,
    `<ol>`,
    `<li><b>Pengertian ${tl}</b> — memahami arti dan maksudnya dengan bahasa sendiri.</li>`,
    `<li><b>Bagian-bagian penting</b> — mengenali unsur atau langkah yang menyusun ${tl}.</li>`,
    `<li><b>Manfaat</b> — mengetahui kegunaan ${tl} dalam kegiatan nyata.</li>`,
    `</ol>`,
    `<h4>Tujuan Pembelajaran</h4>`,
    `<p>Setelah mempelajari bagian ini, kamu diharapkan mampu menjelaskan pengertian ${tl}, menyebutkan bagian-bagian pentingnya, dan memberi contoh sederhana dengan percaya diri.</p>`,
    `<blockquote><b>Rangkuman:</b> ${cap(topik)} adalah materi dasar yang perlu dipahami lebih dahulu sebelum melangkah ke ciri, contoh, dan latihan. Pahami pengertian dan konsep kuncinya baik-baik, ya!</blockquote>`,
  ].join("\n");
}

function tplCiri(topik, mapel, kelas, ctx) {
  const tl = esc(lc(topik));
  return [
    head(`Ciri & Struktur: ${cap(topik)}`),
    `<p>Pada bagian ini kamu akan mengenali <b>ciri-ciri</b> dan <b>struktur (bagian-bagian)</b> dari ${tl}. Dengan mengenali cirinya, kamu akan lebih mudah membedakan ${tl} dari hal lain di pelajaran <b>${esc(ctx.bidang)}</b>.</p>`,
    `<h4>Ciri-Ciri Utama</h4>`,
    `<ul>`,
    `<li>Memiliki bentuk atau pola yang khas sehingga mudah dikenali.</li>`,
    `<li>Terdiri atas beberapa bagian yang saling berhubungan.</li>`,
    `<li>Dapat ditemukan atau digunakan dalam kegiatan ${esc(ctx.kegiatan)}.</li>`,
    `</ul>`,
    `<h4>Struktur atau Bagian-Bagiannya</h4>`,
    `<ol>`,
    `<li><b>Bagian awal</b> — hal pertama yang menjadi dasar atau pembuka pada ${tl}.</li>`,
    `<li><b>Bagian inti</b> — bagian terpenting yang menjadi isi utama ${tl}.</li>`,
    `<li><b>Bagian akhir</b> — penutup atau hasil yang melengkapi ${tl}.</li>`,
    `</ol>`,
    `<h4>Hal yang Perlu Diperhatikan</h4>`,
    `<p>Perhatikan setiap bagian dengan teliti. Bila salah satu bagian hilang atau tertukar, makna atau hasil dari ${tl} bisa berubah. Berlatihlah menunjukkan tiap bagian menggunakan contohmu sendiri.</p>`,
    `<blockquote><b>Rangkuman:</b> ${cap(topik)} memiliki ciri khas dan tersusun atas beberapa bagian. Mengenali ciri dan strukturnya membuat kita lebih paham dan tidak keliru.</blockquote>`,
  ].join("\n");
}

function tplContoh(topik, mapel, kelas, ctx) {
  const tl = esc(lc(topik));
  return [
    head(`Contoh & Penerapan: ${cap(topik)}`),
    `<p>Agar makin paham, mari kita lihat <b>contoh</b> dan cara <b>menerapkan</b> ${tl} dalam kehidupan sehari-hari. Amati setiap contoh, lalu cobalah membuat contohmu sendiri.</p>`,
    `<h4>Contoh 1 (Sederhana)</h4>`,
    `<p>Perhatikan keadaan di sekitarmu. ${cap(topik)} dapat kita temui saat ${esc(ctx.kegiatan)}. Cobalah tunjukkan satu contoh nyata yang kamu lihat di rumah atau di sekolah, lalu jelaskan mengapa itu termasuk ${tl}.</p>`,
    `<h4>Contoh 2 (Sedikit Menantang)</h4>`,
    `<p>Sekarang carilah contoh yang sedikit lebih rumit. Uraikan bagian-bagiannya satu per satu, lalu jelaskan hubungan antarbagian tersebut sehingga menjadi ${tl} yang utuh.</p>`,
    `<h4>Penerapan dalam Kehidupan Sehari-hari</h4>`,
    `<ul>`,
    `<li><b>Di rumah:</b> memanfaatkan ${tl} untuk membantu kegiatan keluarga.</li>`,
    `<li><b>Di sekolah:</b> menggunakan ${tl} ketika belajar dan mengerjakan tugas.</li>`,
    `<li><b>Di lingkungan:</b> menerapkan ${tl} agar bermanfaat bagi orang lain.</li>`,
    `</ul>`,
    `<h4>Langkah-Langkah Menerapkan</h4>`,
    `<ol>`,
    `<li>Amati keadaan atau masalah yang berkaitan dengan ${tl}.</li>`,
    `<li>Tentukan bagian-bagian penting yang terlibat.</li>`,
    `<li>Lakukan atau selesaikan sesuai urutan yang benar.</li>`,
    `<li>Periksa kembali hasilnya dan perbaiki bila perlu.</li>`,
    `</ol>`,
    `<blockquote><b>Rangkuman:</b> Dengan banyak melihat contoh dan berlatih menerapkannya, pemahamanmu tentang ${tl} akan semakin kuat dan bermanfaat.</blockquote>`,
  ].join("\n");
}

function tplLatihan(topik, mapel, kelas, ctx) {
  const tl = esc(lc(topik));
  return [
    head(`Latihan & Evaluasi: ${cap(topik)}`),
    `<p>Saatnya menguji pemahamanmu tentang ${tl}. Kerjakan latihan berikut dengan jujur dan teliti. Bila ada yang sulit, baca kembali bahan ajar sebelumnya.</p>`,
    `<h4>Petunjuk Mengerjakan</h4>`,
    `<ul>`,
    `<li>Bacalah setiap soal dengan cermat.</li>`,
    `<li>Kerjakan sesuai urutan dari yang mudah lebih dahulu.</li>`,
    `<li>Tuliskan jawaban dengan rapi dan lengkap.</li>`,
    `</ul>`,
    `<h4>Soal Latihan</h4>`,
    `<ol>`,
    `<li>Jelaskan dengan bahasamu sendiri apa yang dimaksud dengan ${tl}!</li>`,
    `<li>Sebutkan minimal dua ciri atau bagian penting dari ${tl}!</li>`,
    `<li>Berikan satu contoh ${tl} yang kamu temui dalam kehidupan sehari-hari!</li>`,
    `<li>Mengapa ${tl} penting untuk dipelajari? Tuliskan alasanmu!</li>`,
    `<li>Buatlah satu karya, gambar, atau kalimat sederhana yang berkaitan dengan ${tl}!</li>`,
    `</ol>`,
    `<h4>Rubrik Penilaian Sederhana</h4>`,
    `<ul>`,
    `<li><b>Sangat baik:</b> menjawab benar, lengkap, dan disertai contoh sendiri.</li>`,
    `<li><b>Baik:</b> menjawab benar tetapi kurang lengkap.</li>`,
    `<li><b>Perlu bimbingan:</b> masih keliru dan perlu belajar ulang.</li>`,
    `</ul>`,
    `<h4>Refleksi</h4>`,
    `<p>Setelah mengerjakan latihan, tanyakan pada dirimu: bagian mana yang sudah kupahami, dan bagian mana yang masih perlu kupelajari lagi? Sampaikan kepada gurumu bila ada yang belum jelas.</p>`,
    `<blockquote><b>Rangkuman:</b> Latihan dan evaluasi membantu kita mengukur pemahaman tentang ${tl}. Teruslah berlatih agar semakin mahir!</blockquote>`,
  ].join("\n");
}

// Bangun HTML bahan ajar untuk satu submateri.
// ctx: { mapel, kelas, semester, fase, topik (nama materi pokok), submateriName }
function buildBahanAjarHTML(ctx) {
  const mapel = ctx.mapel || "";
  const kelas = ctx.kelas != null ? ctx.kelas : "";
  const topik = ctx.topik || ctx.submateriName || "";
  const info = mapelCtx(mapel);
  const type = detectType(ctx.submateriName);
  if (type === "ciri") return tplCiri(topik, mapel, kelas, info);
  if (type === "contoh") return tplContoh(topik, mapel, kelas, info);
  if (type === "latihan") return tplLatihan(topik, mapel, kelas, info);
  return tplKonsep(topik, mapel, kelas, info);
}

module.exports = { buildBahanAjarHTML };
