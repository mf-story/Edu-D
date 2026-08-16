/* =====================================================================
 * server.js — API EduMuh (Express).
 * Peran: admin, teacher (pengajar), student (pelajar).
 *
 * Menjalankan:  npm install && npm run seed && npm start
 * Port default: 4000  (ubah dengan variabel PORT)
 * ===================================================================== */
"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const db = require("./db");
const auth = require("./auth");
const {
  buildCurriculumSeed,
  P5_TEMA,
  makeMateri,
  buildSubmateri,
  distributeJP,
  DEFAULT_MATERI_JP,
} = require("./curriculumSeed");
const { buildCurriculumSeedExtra } = require("./curriculumSeedExtra");
const { buildBahanAjarHTML } = require("./bahanAjarSD");

// Normalisasi satu submateri menjadi objek { nama, jp }.
// Menerima bentuk lama (string) maupun objek { nama, jp }.
function normalizeSub(s) {
  if (s && typeof s === "object") {
    const nama = String(s.nama || "").trim();
    if (!nama) return null;
    const jp = Number.isFinite(Number(s.jp)) ? Math.max(0, parseInt(s.jp, 10) || 0) : 0;
    const out = { nama, jp };
    // Pertahankan bahan ajar (materi bacaan) bila sudah ada.
    if (s.bahanAjar) out.bahanAjar = String(s.bahanAjar);
    return out;
  }
  const nama = String(s || "").trim();
  if (!nama) return null;
  return { nama, jp: 0 };
}

// Normalisasi satu materi pokok menjadi objek { nama, jp, submateri:[{nama,jp}] }.
// Menerima bentuk lama (string) maupun bentuk objek.
function normalizeMateri(m) {
  if (m && typeof m === "object") {
    const nama = String(m.nama || "").trim();
    if (!nama) return null;
    let submateri = Array.isArray(m.submateri)
      ? m.submateri.map(normalizeSub).filter(Boolean)
      : [];
    let jp;
    if (Number.isFinite(Number(m.jp))) {
      jp = Math.max(0, parseInt(m.jp, 10) || 0);
    } else if (submateri.length) {
      jp = submateri.reduce((a, s) => a + s.jp, 0);
    } else {
      jp = DEFAULT_MATERI_JP;
    }
    // Bila submateri ada tetapi seluruh JP masih 0 sedang materi punya JP,
    // bagikan JP materi ke submateri agar konsisten.
    if (submateri.length && jp > 0 && submateri.every((s) => !s.jp)) {
      const parts = distributeJP(jp, submateri.length);
      submateri = submateri.map((s, i) => ({ ...s, jp: parts[i] }));
    }
    if (!submateri.length) submateri = buildSubmateri(nama, jp);
    return { nama, jp, submateri };
  }
  const nama = String(m || "").trim();
  if (!nama) return null;
  return makeMateri(nama);
}

const PORT = parseInt(process.env.PORT || "4000", 10);
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.disable("x-powered-by");

/* ---------------- Keamanan: CORS allowlist ---------------- */
// Origin yang diizinkan. Selain env EDUMUH_ORIGINS (dipisah koma), otomatis
// mengizinkan localhost & jaringan lokal (LAN) — memblokir origin internet acak.
const ORIGIN_ALLOWLIST = (process.env.EDUMUH_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isPrivateHost(host) {
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

function isAllowedOrigin(origin) {
  if (!origin) return true; // permintaan same-origin / non-browser (curl, mobile)
  if (ORIGIN_ALLOWLIST.includes(origin)) return true;
  try {
    return isPrivateHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}

app.use(
  cors((req, callback) => {
    const origin = req.header("Origin");
    let allowed = isAllowedOrigin(origin);
    // Izinkan permintaan same-origin (Origin sama dengan Host server) — mis.
    // aset build modern yang memakai atribut crossorigin pada IP/domain publik.
    if (!allowed && origin) {
      const host = req.header("Host");
      try {
        allowed = !!host && new URL(origin).host === host;
      } catch {
        allowed = false;
      }
    }
    // Jangan lempar error: cukup tidak menambahkan header CORS bila tak diizinkan
    // (browser yang akan memblokir; permintaan same-origin tetap jalan).
    callback(null, { origin: allowed });
  })
);

/* ---------------- Keamanan: HTTP security headers ---------------- */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=()"
  );
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "connect-src 'self'",
      "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://drive.google.com",
    ].join("; ")
  );
  // HSTS hanya bila diakses lewat HTTPS (diabaikan browser jika HTTP).
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=15552000; includeSubDomains"
    );
  }
  next();
});

app.use(express.json({ limit: "2mb" }));

/* ---------------- Unggah berkas ---------------- */

// Ekstensi berbahaya yang bisa dieksekusi/menyisipkan skrip bila dibuka di
// browser (mencegah stored XSS & unggahan berkas berbahaya).
const BLOCKED_UPLOAD_EXT = new Set([
  ".html", ".htm", ".xhtml", ".shtml", ".svg", ".xml", ".xht",
  ".js", ".mjs", ".cjs", ".php", ".phtml", ".php3", ".php4", ".php5",
  ".asp", ".aspx", ".jsp", ".cgi", ".pl", ".py", ".rb", ".sh", ".bash",
  ".exe", ".msi", ".bat", ".cmd", ".com", ".scr", ".jar", ".vbs", ".ps1",
  ".htaccess",
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 12);
    const safeExt = /^\.[a-z0-9]+$/.test(ext) ? ext : "";
    const base = db.id();
    cb(null, `${base}${safeExt}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_UPLOAD_EXT.has(ext)) {
      return cb(new Error("Jenis berkas tidak diizinkan"));
    }
    cb(null, true);
  },
});

// Sajikan berkas unggahan dengan header aman: cegah MIME sniffing & eksekusi.
app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    },
  })
);


// Kelompokkan media berdasarkan MIME: image | video | audio | file.
function mediaKind(mimetype = "") {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  return "file";
}

/* ---------------- Util ---------------- */

// Status murid yang diperbolehkan.
const STUDENT_STATUSES = [
  "aktif",
  "tidak aktif",
  "pindah",
  "keluar",
  "meninggal",
  "lulus",
];

// Field profil murid tambahan (tidak ditampilkan di tabel, hanya di detail).
// Sub-bagian alamat sesuai penulisan alamat di Indonesia.
const ALAMAT_PARTS = ["Jalan", "Desa", "Kecamatan", "Kabupaten", "Provinsi"];
const alamatKeys = (base) => ALAMAT_PARTS.map((p) => base + p);
const STUDENT_PROFILE_FIELDS = [
  ...alamatKeys("alamat"),
  "namaAyah",
  ...alamatKeys("alamatAyah"),
  "pekerjaanAyah",
  "hpAyah",
  "namaIbu",
  ...alamatKeys("alamatIbu"),
  "pekerjaanIbu",
  "hpIbu",
  "namaWali",
  ...alamatKeys("alamatWali"),
  "pekerjaanWali",
  "hpWali",
];

function sanitizeUser(u) {
  if (!u) return null;
  const { passwordHash, salt, ...rest } = u;
  return rest;
}

function ok(res, data) {
  return res.json(data);
}
function bad(res, code, message) {
  return res.status(code).json({ error: message });
}

/* ---------------- Middleware auth & peran ---------------- */

// Rentang waktu (ms) untuk menganggap pengguna sedang online.
const ONLINE_WINDOW_MS = 3 * 60 * 1000; // 3 menit
// Throttle penulisan lastSeenAt agar tidak menulis file tiap request.
const LASTSEEN_THROTTLE_MS = 20 * 1000; // 20 detik

function touchLastSeen(user, force) {
  const now = Date.now();
  const last = user.lastSeenAt ? new Date(user.lastSeenAt).getTime() : 0;
  if (force || now - last > LASTSEEN_THROTTLE_MS) {
    const iso = new Date(now).toISOString();
    db.update("users", user.id, { lastSeenAt: iso });
    user.lastSeenAt = iso;
  }
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = auth.verifyToken(token);
  if (!payload) return bad(res, 401, "Tidak terautentikasi");
  const user = db.getById("users", payload.sub);
  if (!user) return bad(res, 401, "Pengguna tidak ditemukan");
  req.user = user;
  touchLastSeen(user);
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role))
      return bad(res, 403, "Akses ditolak untuk peran Anda");
    next();
  };
}

// ---- Tahun Akademik & Semester ----
const DEFAULT_ACADEMIC_YEAR = "2025/2026";
const SEMESTERS = ["ganjil", "genap"];
const DEFAULT_SEMESTER = "genap";

// Pastikan minimal ada satu tahun akademik & kelas lama terisi tahun + semester.
function ensureAcademicYears() {
  let years = db.all("academicYears");
  if (years.length === 0) {
    const y = db.insert("academicYears", {
      name: DEFAULT_ACADEMIC_YEAR,
      active: true,
    });
    years = [y];
  }
  const activeId = (years.find((y) => y.active) || years[0]).id;
  // Backfill kelas yang belum punya tahun akademik / semester.
  db.find("classes", (c) => !c.academicYearId).forEach((c) =>
    db.update("classes", c.id, { academicYearId: activeId })
  );
  db.find("classes", (c) => !c.semester).forEach((c) =>
    db.update("classes", c.id, { semester: DEFAULT_SEMESTER })
  );
  // Backfill/selaraskan fase kelas dengan namanya (perbaiki juga data lama).
  db.all("classes").forEach((c) => {
    const f = inferFase(c.name);
    if (f && c.fase !== f) db.update("classes", c.id, { fase: f });
  });
  return activeId;
}

function getActiveYearId() {
  const active = db.findOne("academicYears", (y) => y.active);
  return active ? active.id : null;
}

// Semester aktif disimpan pada koleksi "settings" (satu dokumen).
function getActiveSemester() {
  let doc = db.findOne("settings", (s) => s.key === "activeSemester");
  if (!doc)
    doc = db.insert("settings", {
      key: "activeSemester",
      value: DEFAULT_SEMESTER,
    });
  return doc.value;
}

function setActiveSemester(value) {
  let doc = db.findOne("settings", (s) => s.key === "activeSemester");
  if (doc) return db.update("settings", doc.id, { value });
  return db.insert("settings", { key: "activeSemester", value });
}

// Kelas dianggap "aktif" bila tahun akademik & semesternya sesuai periode aktif.
function isClassPeriodActive(cls) {
  if (!cls) return false;
  ensureAcademicYears();
  return (
    cls.academicYearId === getActiveYearId() &&
    cls.semester === getActiveSemester()
  );
}

// Cek apakah pengguna terhubung dengan sebuah kelas.
function isMemberOfClass(user, cls) {
  if (!cls) return false;
  if (user.role === "admin" || user.role === "pimpinan") return true;
  if (user.role === "teacher")
    return db
      .find("subjects", (s) => s.classId === cls.id)
      .some((s) => (s.teacherIds || []).includes(user.id));
  if (user.role === "student")
    // Siswa tetap dianggap anggota kelas lamanya (riwayat) agar bisa melihat
    // materi/nilai periode sebelumnya, bukan hanya periode aktif.
    return (cls.studentIds || []).includes(user.id);
  return false;
}
// 1 siswa hanya boleh berada di 1 kelas: keluarkan siswa dari kelas lain.
function enforceSingleClass(keepClassId, studentIds) {
  if (!Array.isArray(studentIds) || studentIds.length === 0) return;
  const set = new Set(studentIds);
  db.find("classes", (c) => c.id !== keepClassId).forEach((c) => {
    const current = c.studentIds || [];
    const filtered = current.filter((id) => !set.has(id));
    if (filtered.length !== current.length)
      db.update("classes", c.id, { studentIds: filtered });
  });
}

// 1 siswa hanya boleh berada di 1 Master Kelas (classNameOptions):
// keluarkan siswa tsb dari roster master lain.
function enforceSingleMaster(keepOptionId, studentIds) {
  if (!Array.isArray(studentIds) || studentIds.length === 0) return;
  const set = new Set(studentIds);
  db.find("classNameOptions", (o) => o.id !== keepOptionId).forEach((o) => {
    const current = o.studentIds || [];
    const filtered = current.filter((id) => !set.has(id));
    if (filtered.length !== current.length)
      db.update("classNameOptions", o.id, { studentIds: filtered });
  });
}

// Ambil roster siswa (studentIds) dari Master Kelas berdasarkan nama.
function masterRosterByName(name) {
  const key = String(name || "").trim().toLowerCase();
  const opt = db
    .find("classNameOptions", (o) => o.name.toLowerCase() === key)
    .find(Boolean);
  return opt && Array.isArray(opt.studentIds) ? opt.studentIds.slice() : [];
}

// ---- Fase / Jenjang -------------------------------------------------
// Pembagian jenjang sekolah menjadi fase. Catatan penting: angka kelas SMA
// (Fase E) dan SMK (Fase F) sama-sama 10–12, sehingga fase HARUS disimpan
// secara eksplisit pada kelas — tidak cukup ditebak dari angka tingkat saja.
const FASE = {
  A: { label: "SD/MI", jenjang: "SD", grades: [1, 2], prefix: "" },
  B: { label: "SD/MI", jenjang: "SD", grades: [3, 4], prefix: "" },
  C: { label: "SD/MI", jenjang: "SD", grades: [5, 6], prefix: "" },
  D: { label: "SMP/MTs", jenjang: "SMP", grades: [7, 8, 9], prefix: "" },
  E: { label: "SMA/MA", jenjang: "SMA", grades: [10, 11, 12], prefix: "SMA " },
  F: { label: "SMK/MAK", jenjang: "SMK", grades: [10, 11, 12], prefix: "SMK " },
};
const FASE_KEYS = ["A", "B", "C", "D", "E", "F"];
const ROMBEL_OPTS = ["A", "B", "C"];

// Rentang tingkat per jenjang (untuk kenaikan kelas yang boleh lintas fase,
// mis. SD: kelas 2 (Fase A) → kelas 3 (Fase B)).
const JENJANG_GRADES = {};
FASE_KEYS.forEach((k) => {
  const j = FASE[k].jenjang;
  JENJANG_GRADES[j] = Array.from(
    new Set([...(JENJANG_GRADES[j] || []), ...FASE[k].grades])
  ).sort((a, b) => a - b);
});
// Fase mana yang menaungi sebuah tingkat pada jenjang tertentu.
function faseOfGradeInJenjang(jenjang, grade) {
  return (
    FASE_KEYS.find(
      (k) => FASE[k].jenjang === jenjang && FASE[k].grades.includes(grade)
    ) || ""
  );
}

// ---- Kenaikan kelas (promosi) --------------------------------------

// Ambil tingkat (angka) & rombel (huruf) dari nama kelas, mis. "Kelas 7 A"
// atau "SMA Kelas 10 A".
function parseClassGrade(name) {
  const s = String(name || "").trim();
  const gm = s.match(/(\d+)/);
  const grade = gm ? parseInt(gm[1], 10) : null;
  const rm = s.match(/\d+\s*([A-Za-z]+)\s*$/);
  const rombel = rm ? rm[1].toUpperCase() : "";
  return { grade, rombel };
}

// Tebak fase dari nama kelas (dipakai sebagai cadangan bila field fase kosong).
function inferFase(name) {
  const s = String(name || "").trim();
  if (/^SMK\b/i.test(s)) return "F";
  if (/^SMA\b/i.test(s)) return "E";
  const { grade } = parseClassGrade(s);
  if (grade == null) return "";
  if (grade <= 2) return "A"; // SD kelas 1–2
  if (grade <= 4) return "B"; // SD kelas 3–4
  if (grade <= 6) return "C"; // SD kelas 5–6
  if (grade <= 9) return "D"; // SMP kelas 7–9
  return "E"; // 10–12 tanpa penanda → dianggap SMA
}

// Bangun nama kelas kanonik dari fase, tingkat, dan rombel.
function buildClassName(fase, grade, rombel) {
  const prefix = (FASE[fase] && FASE[fase].prefix) || "";
  const r = String(rombel || "").trim().toUpperCase();
  return `${prefix}Kelas ${grade}${r ? " " + r : ""}`;
}
function buildTingkat(fase, grade) {
  const prefix = (FASE[fase] && FASE[fase].prefix) || "";
  return `${prefix}Kelas ${grade}`;
}

// Nama kelas tingkat berikutnya (rombel dipertahankan; kenaikan boleh lintas
// fase dalam satu jenjang). "" bila sudah tingkat tertinggi jenjangnya.
function nextGradeClassName(name, fase) {
  const f = FASE[fase] ? fase : inferFase(name);
  const jenjang = FASE[f] ? FASE[f].jenjang : "";
  const grades = JENJANG_GRADES[jenjang] || [];
  const { grade, rombel } = parseClassGrade(name);
  const idx = grades.indexOf(grade);
  if (idx < 0 || idx === grades.length - 1) return "";
  const nextGrade = grades[idx + 1];
  const nextFase = faseOfGradeInJenjang(jenjang, nextGrade) || f;
  return buildClassName(nextFase, nextGrade, rombel);
}

// Apakah kelas berada di tingkat tertinggi jenjangnya (mis. kelas 6, 9, 12)?
// Untuk kelas seperti ini wali kelas tidak menetapkan kenaikan kelas —
// status yang dibutuhkan adalah kelulusan, yang ditentukan oleh admin.
function isGraduatingClass(name, fase) {
  const f = FASE[fase] ? fase : inferFase(name);
  const jenjang = FASE[f] ? FASE[f].jenjang : "";
  const grades = JENJANG_GRADES[jenjang] || [];
  const { grade } = parseClassGrade(name);
  const idx = grades.indexOf(grade);
  return idx >= 0 && idx === grades.length - 1;
}

// Cari Master Kelas berdasarkan nama; buat bila belum ada.
function findOrCreateMasterOption(name, fase) {
  const clean = String(name || "").trim();
  const key = clean.toLowerCase();
  const opt = db
    .find("classNameOptions", (o) => o.name.toLowerCase() === key)
    .find(Boolean);
  if (opt) return opt;
  const { grade, rombel } = parseClassGrade(clean);
  const f = FASE[fase] ? fase : inferFase(clean);
  return db.insert("classNameOptions", {
    name: clean,
    fase: f,
    tingkat: grade != null ? buildTingkat(f, grade) : clean,
    rombel,
    studentIds: [],
  });
}

// Terapkan keputusan kenaikan yang belum diterapkan: pindahkan siswa yang
// dinyatakan "naik" ke Master Kelas tingkat berikutnya. Dipanggil saat
// periode aktif berpindah ke semester ganjil (tahun ajaran baru).
function applyPendingPromotions() {
  const recs = db.find(
    "promotions",
    (p) => p.decision === "naik" && !p.applied && p.nextClassName
  );
  recs.forEach((rec) => {
    const opt = findOrCreateMasterOption(rec.nextClassName, rec.fase);
    // Keluarkan siswa dari master lain, lalu tambahkan ke master tujuan.
    enforceSingleMaster(opt.id, [rec.studentId]);
    const fresh = db.getById("classNameOptions", opt.id);
    const cur = (fresh && fresh.studentIds) || [];
    if (!cur.includes(rec.studentId))
      db.update("classNameOptions", opt.id, {
        studentIds: [...cur, rec.studentId],
      });
    db.update("promotions", rec.id, {
      applied: true,
      appliedAt: new Date().toISOString(),
    });
  });
  return recs.length;
}

// Buat notifikasi untuk semua pelajar di sebuah kelas.
function notifyClassStudents(cls, text, classId) {
  (cls.studentIds || []).forEach((studentId) => {
    db.insert("notifications", {
      userId: studentId,
      text,
      classId: classId || cls.id,
      read: false,
    });
  });
}

// Cek keanggotaan pada sebuah mata pelajaran (subject).
function isMemberOfSubject(user, subject) {
  if (!subject) return false;
  if (user.role === "admin" || user.role === "pimpinan") return true;
  if (user.role === "teacher") return (subject.teacherIds || []).includes(user.id);
  if (user.role === "student") {
    const cls = db.getById("classes", subject.classId);
    // Termasuk kelas periode lama (riwayat), bukan hanya periode aktif.
    return !!cls && (cls.studentIds || []).includes(user.id);
  }
  return false;
}

// Beri tahu semua pelajar pada kelas yang menaungi sebuah mata pelajaran.
function notifySubjectStudents(subject, text) {
  const cls = db.getById("classes", subject.classId);
  if (!cls) return;
  (cls.studentIds || []).forEach((studentId) => {
    db.insert("notifications", {
      userId: studentId,
      text,
      classId: subject.classId,
      subjectId: subject.id,
      read: false,
    });
  });
}

// Ambil subject beserta pemeriksaan; kembalikan null bila tidak ada.
function getSubjectOr404(req, res, id) {
  const subject = db.getById("subjects", id);
  if (!subject) {
    bad(res, 404, "Mata pelajaran tidak ditemukan");
    return null;
  }
  if (!isMemberOfSubject(req.user, subject)) {
    bad(res, 403, "Bukan anggota mata pelajaran ini");
    return null;
  }
  return subject;
}

/* ---------------- Obrolan / Chat ---------------- */
// Kumpulan userId anggota sebuah kelas (siswa + semua pengajar mapel + wali kelas).
function chatClassMemberIds(cls) {
  const ids = new Set(cls.studentIds || []);
  db.find("subjects", (s) => s.classId === cls.id).forEach((s) =>
    (s.teacherIds || []).forEach((t) => ids.add(t))
  );
  if (cls.waliKelasId) ids.add(cls.waliKelasId);
  return ids;
}
// Apakah dua pengguna berada di kelas yang sama (sebagai anggota obrolan).
function usersShareClass(aId, bId) {
  return db
    .all("classes")
    .some((c) => {
      const ids = chatClassMemberIds(c);
      return ids.has(aId) && ids.has(bId);
    });
}
// Apakah userA boleh mengirim pesan pribadi ke peer.
function canDM(userA, peer) {
  if (!peer || userA.id === peer.id) return false;
  if (userA.role === "admin" || peer.role === "admin") return true; // admin bebas
  if (userA.role === "teacher" && peer.role === "teacher") return true; // guru<->guru
  return usersShareClass(userA.id, peer.id); // sekelas/se-mapel
}
// Kunci percakapan pribadi (stabil terhadap urutan pengirim/penerima).
function dmKey(aId, bId) {
  return [aId, bId].sort().join("__");
}

/* =====================================================================
 * AUTENTIKASI
 * ===================================================================== */

// Proteksi brute-force login. Dihitung per (IP + username) agar kegagalan satu
// akun tidak mengunci akun lain di jaringan yang sama (mis. lab komputer).
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 menit
const loginAttempts = new Map(); // key -> { count, first }

function loginKey(req, username) {
  const ip = req.ip || req.socket.remoteAddress || "?";
  return `${ip}|${String(username || "").toLowerCase()}`;
}
function loginBlocked(key) {
  const rec = loginAttempts.get(key);
  if (!rec) return 0;
  if (Date.now() - rec.first > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return 0;
  }
  if (rec.count >= LOGIN_MAX_ATTEMPTS) {
    return Math.ceil((rec.first + LOGIN_WINDOW_MS - Date.now()) / 1000);
  }
  return 0;
}
function loginFail(key) {
  const rec = loginAttempts.get(key);
  if (!rec || Date.now() - rec.first > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, first: Date.now() });
  } else {
    rec.count += 1;
  }
}
// Bersihkan entri kedaluwarsa secara berkala agar tidak menumpuk di memori.
setInterval(() => {
  const now = Date.now();
  for (const [k, rec] of loginAttempts) {
    if (now - rec.first > LOGIN_WINDOW_MS) loginAttempts.delete(k);
  }
}, LOGIN_WINDOW_MS).unref();

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return bad(res, 400, "Username & password wajib diisi");
  const key = loginKey(req, username);
  const retry = loginBlocked(key);
  if (retry) {
    return bad(
      res,
      429,
      `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(
        retry / 60
      )} menit.`
    );
  }
  const user = db.findOne("users", (u) => u.username === username);
  if (!user || !auth.verifyPassword(password, user.salt, user.passwordHash)) {
    loginFail(key);
    return bad(res, 401, "Username atau password salah");
  }
  loginAttempts.delete(key); // reset saat berhasil
  const token = auth.createToken(user);
  ok(res, { token, user: sanitizeUser(user) });
});

app.get("/api/auth/me", authenticate, (req, res) => {
  ok(res, { user: sanitizeUser(req.user) });
});

// Denyut (heartbeat) — dipanggil berkala oleh klien untuk menandai online.
app.post("/api/auth/heartbeat", authenticate, (req, res) => {
  touchLastSeen(req.user, true);
  ok(res, { ok: true, lastSeenAt: req.user.lastSeenAt });
});

// Pengguna memperbarui profilnya sendiri (biodata & kata sandi).
app.put("/api/auth/me", authenticate, upload.single("photo"), (req, res) => {
  const { name, password, currentPassword } = req.body || {};
  const patch = {};
  const role = req.user.role;
  // Nama lengkap: hanya admin yang boleh mengubah namanya sendiri.
  if (name && role === "admin") patch.name = name;
  // Field biodata yang boleh diubah sendiri per peran.
  let editable = [];
  if (role === "teacher") editable = ["nip", "nuptk", "email", "phone"];
  else if (role === "student")
    editable = ["email", "phone", ...STUDENT_PROFILE_FIELDS];
  else if (role === "admin" || role === "pimpinan") editable = ["email", "phone"];
  editable.forEach((k) => {
    if (req.body[k] !== undefined) patch[k] = String(req.body[k]).trim();
  });
  if (req.file) patch.photoUrl = `/uploads/${req.file.filename}`;
  if (password) {
    if (
      !currentPassword ||
      !auth.verifyPassword(currentPassword, req.user.salt, req.user.passwordHash)
    )
      return bad(res, 400, "Kata sandi saat ini salah");
    if (String(password).length < 4)
      return bad(res, 400, "Kata sandi baru minimal 4 karakter");
    const { salt, hash } = auth.hashPassword(password);
    patch.salt = salt;
    patch.passwordHash = hash;
  }
  const updated = db.update("users", req.user.id, patch);
  ok(res, { user: sanitizeUser(updated) });
});

/* =====================================================================
 * PENGGUNA (khusus admin)
 * ===================================================================== */

// Normalisasi daftar mapel yang diampu pengajar menjadi array string.
function parseMapel(raw) {
  let m = raw;
  if (typeof m === "string") {
    try {
      m = JSON.parse(m);
    } catch {
      m = m.trim() ? [m] : [];
    }
  }
  if (!Array.isArray(m)) return [];
  return [...new Set(m.map((x) => String(x).trim()).filter(Boolean))];
}

app.get("/api/users", authenticate, requireRole("admin", "pimpinan"), (req, res) => {
  const role = req.query.role;
  let list = db.all("users");
  if (role) list = list.filter((u) => u.role === role);
  ok(res, list.map(sanitizeUser));
});

app.post("/api/users", authenticate, requireRole("admin"), upload.single("photo"), (req, res) => {
  const { username, password, name, role, nip, nuptk, nisn, tahunMasuk, email, phone } =
    req.body || {};
  if (!username || !password || !name || !role)
    return bad(res, 400, "username, password, name, role wajib diisi");
  if (!["admin", "pimpinan", "teacher", "student"].includes(role))
    return bad(res, 400, "Peran tidak valid");
  if (db.findOne("users", (u) => u.username === username))
    return bad(res, 409, "Username sudah dipakai");
  const { salt, hash } = auth.hashPassword(password);
  const doc = {
    username,
    name,
    role,
    salt,
    passwordHash: hash,
  };
  // Field opsional (pengajar & pelajar).
  if (nip) doc.nip = String(nip).trim();
  if (nuptk) doc.nuptk = String(nuptk).trim();
  if (nisn) doc.nisn = String(nisn).trim();
  if (tahunMasuk) doc.tahunMasuk = String(tahunMasuk).trim();
  if (role === "teacher") {
    doc.mapel = parseMapel(req.body.mapel);
    if (req.body.jenisGuru !== undefined)
      doc.jenisGuru = String(req.body.jenisGuru).trim();
    if (req.body.statusKepegawaian !== undefined)
      doc.statusKepegawaian = String(req.body.statusKepegawaian).trim();
    if (req.body.alamat !== undefined)
      doc.alamat = String(req.body.alamat).trim();
  }
  if (email) doc.email = String(email).trim();
  if (phone) doc.phone = String(phone).trim();
  if (req.file) doc.photoUrl = `/uploads/${req.file.filename}`;
  if (role === "student") {
    const st = String(req.body.status || "").trim().toLowerCase();
    doc.status = STUDENT_STATUSES.includes(st) ? st : "aktif";
    STUDENT_PROFILE_FIELDS.forEach((k) => {
      if (req.body[k]) doc[k] = String(req.body[k]).trim();
    });
  }
  const user = db.insert("users", doc);
  ok(res, sanitizeUser(user));
});

app.put("/api/users/:id", authenticate, requireRole("admin"), upload.single("photo"), (req, res) => {
  const target = db.getById("users", req.params.id);
  if (!target) return bad(res, 404, "Pengguna tidak ditemukan");
  const { name, role, password, username, nip, nuptk, nisn, tahunMasuk, email, phone } =
    req.body || {};
  const patch = {};
  if (name) patch.name = name;
  if (role && ["admin", "pimpinan", "teacher", "student"].includes(role)) patch.role = role;
  if (username && username !== target.username) {
    if (db.findOne("users", (u) => u.username === username))
      return bad(res, 409, "Username sudah dipakai");
    patch.username = username;
  }
  if (password) {
    const { salt, hash } = auth.hashPassword(password);
    patch.salt = salt;
    patch.passwordHash = hash;
  }
  if (nip !== undefined) patch.nip = String(nip).trim();
  if (nuptk !== undefined) patch.nuptk = String(nuptk).trim();
  if (nisn !== undefined) patch.nisn = String(nisn).trim();
  if (tahunMasuk !== undefined) patch.tahunMasuk = String(tahunMasuk).trim();
  if (req.body.mapel !== undefined) patch.mapel = parseMapel(req.body.mapel);
  if (req.body.jenisGuru !== undefined)
    patch.jenisGuru = String(req.body.jenisGuru).trim();
  if (req.body.statusKepegawaian !== undefined)
    patch.statusKepegawaian = String(req.body.statusKepegawaian).trim();
  if (req.body.alamat !== undefined)
    patch.alamat = String(req.body.alamat).trim();
  if (email !== undefined) patch.email = String(email).trim();
  if (phone !== undefined) patch.phone = String(phone).trim();
  if (req.body.status !== undefined) {
    const st = String(req.body.status).trim().toLowerCase();
    if (!STUDENT_STATUSES.includes(st))
      return bad(res, 400, "Status murid tidak valid");
    patch.status = st;
    if (st === "lulus") {
      // Gunakan tahun lulus yang dipilih admin bila ada; jika tidak, pertahankan
      // nilai lama atau default ke waktu sekarang.
      const yr = parseInt(req.body.tahunLulus, 10);
      if (yr >= 1900 && yr <= 3000) {
        patch.lulusAt = new Date(Date.UTC(yr, 6, 1)).toISOString();
      } else {
        patch.lulusAt = target.lulusAt || new Date().toISOString();
      }
    } else {
      patch.lulusAt = "";
    }
  }
  if (req.file) patch.photoUrl = `/uploads/${req.file.filename}`;
  STUDENT_PROFILE_FIELDS.forEach((k) => {
    if (req.body[k] !== undefined) patch[k] = String(req.body[k]).trim();
  });
  const updated = db.update("users", req.params.id, patch);
  ok(res, sanitizeUser(updated));
});

app.delete("/api/users/:id", authenticate, requireRole("admin"), (req, res) => {
  if (req.params.id === req.user.id)
    return bad(res, 400, "Tidak dapat menghapus akun sendiri");
  const removed = db.remove("users", req.params.id);
  if (!removed) return bad(res, 404, "Pengguna tidak ditemukan");
  // Bersihkan keanggotaan kelas.
  db.all("classes").forEach((c) => {
    const teacherIds = (c.teacherIds || []).filter((x) => x !== req.params.id);
    const studentIds = (c.studentIds || []).filter((x) => x !== req.params.id);
    db.update("classes", c.id, { teacherIds, studentIds });
  });
  ok(res, { success: true });
});

/* =====================================================================
 * TRANSKRIP NILAI & LAPORAN HASIL BELAJAR (per siswa, khusus admin)
 * ===================================================================== */

app.get(
  "/api/users/:id/transcript",
  authenticate,
  requireRole("admin", "pimpinan"),
  (req, res) => {
    const student = db.getById("users", req.params.id);
    if (!student || student.role !== "student")
      return bad(res, 404, "Siswa tidak ditemukan");

    const years = db.all("academicYears");
    const yearNameOf = (yid) =>
      (years.find((y) => y.id === yid) || {}).name || "—";
    const users = db.all("users");
    const nameOf = (uid) => (users.find((u) => u.id === uid) || {}).name || "?";

    // Semua kelas yang memuat siswa ini.
    const allClasses = db.all("classes").filter((c) =>
      (c.studentIds || []).includes(student.id)
    );

    // Periode yang tersedia (untuk opsi filter di klien).
    const seen = new Set();
    const availablePeriods = [];
    allClasses.forEach((c) => {
      const key = `${c.academicYearId}|${c.semester}`;
      if (!seen.has(key)) {
        seen.add(key);
        availablePeriods.push({
          academicYearId: c.academicYearId,
          academicYearName: yearNameOf(c.academicYearId),
          semester: c.semester,
        });
      }
    });

    // Penyaringan opsional.
    let classes = allClasses;
    if (req.query.academicYearId)
      classes = classes.filter(
        (c) => c.academicYearId === req.query.academicYearId
      );
    if (req.query.semester)
      classes = classes.filter((c) => c.semester === req.query.semester);

    const subjectsAll = db.all("subjects");
    const assignmentsAll = db.all("assignments");
    const quizzesAll = db.all("quizzes");
    const subs = db.all("submissions");
    const results = db.all("quizResults");

    const avg = (arr) =>
      arr.length
        ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
        : null;

    const overallScores = [];
    const classesOut = classes.map((c) => {
      const classScores = [];
      const subjects = subjectsAll
        .filter((s) => s.classId === c.id)
        .map((s) => {
          const items = [];
          const scores = [];
          // Tugas.
          assignmentsAll
            .filter((a) => a.subjectId === s.id)
            .forEach((a) => {
              const sub = subs.find(
                (x) => x.assignmentId === a.id && x.studentId === student.id
              );
              const g =
                sub && sub.grade !== undefined && sub.grade !== ""
                  ? Number(sub.grade)
                  : null;
              const val = g !== null && !Number.isNaN(g) ? g : null;
              if (val !== null) scores.push(val);
              items.push({
                kind: "assignment",
                title: a.title,
                score: val,
                max: 100,
                display: val !== null ? String(val) : "—",
              });
            });
          // Kuis.
          quizzesAll
            .filter((q) => q.subjectId === s.id)
            .forEach((q) => {
              const r = results.find(
                (x) => x.quizId === q.id && x.studentId === student.id
              );
              const total = (q.questions || []).length || (r ? r.total : 0);
              const pct =
                r && total
                  ? Math.round((r.score / total) * 1000) / 10
                  : null;
              if (pct !== null) scores.push(pct);
              items.push({
                kind: "quiz",
                title: q.title,
                score: pct,
                max: 100,
                display: r ? `${r.score}/${total}` : "—",
              });
            });
          const average = avg(scores);
          if (average !== null) classScores.push(average);
          return {
            subjectId: s.id,
            subjectName: s.name,
            teacherNames: (s.teacherIds || []).map(nameOf).join(", "),
            items,
            average,
          };
        });
      const classAverage = avg(classScores);
      if (classAverage !== null) overallScores.push(classAverage);
      return {
        classId: c.id,
        className: c.name,
        academicYearId: c.academicYearId,
        academicYearName: yearNameOf(c.academicYearId),
        semester: c.semester,
        subjects,
        classAverage,
      };
    });

    ok(res, {
      student: sanitizeUser(student),
      availablePeriods,
      classes: classesOut,
      overallAverage: avg(overallScores),
    });
  }
);

/* =====================================================================
 * WALI KELAS (perwalian / homeroom)
 * ===================================================================== */

// Hitung nilai satu siswa untuk satu mata pelajaran (tugas + kuis).
function computeSubjectGrade(subject, studentId, ctx) {
  const { assignmentsAll, quizzesAll, subs, results } = ctx;
  const items = [];
  const scores = [];
  assignmentsAll
    .filter((a) => a.subjectId === subject.id)
    .forEach((a) => {
      const sub = subs.find(
        (x) => x.assignmentId === a.id && x.studentId === studentId
      );
      const g =
        sub && sub.grade !== undefined && sub.grade !== ""
          ? Number(sub.grade)
          : null;
      const val = g !== null && !Number.isNaN(g) ? g : null;
      if (val !== null) scores.push(val);
      items.push({
        kind: "assignment",
        title: a.title,
        score: val,
        display: val !== null ? String(val) : "—",
      });
    });
  quizzesAll
    .filter((q) => q.subjectId === subject.id)
    .forEach((q) => {
      const r = results.find(
        (x) => x.quizId === q.id && x.studentId === studentId
      );
      const total = (q.questions || []).length || (r ? r.total : 0);
      const pct = r && total ? Math.round((r.score / total) * 1000) / 10 : null;
      if (pct !== null) scores.push(pct);
      items.push({
        kind: "quiz",
        title: q.title,
        score: pct,
        display: r ? `${r.score}/${total}` : "—",
      });
    });
  const average = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null;
  return { items, average };
}

const avgOf = (arr) =>
  arr.length
    ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
    : null;

// Kelas-kelas yang menjadi tanggung jawab wali kelas (teacher) / semua (admin).
function homeroomClassesFor(user) {
  let classes = db.all("classes").filter((c) => c.waliKelasId);
  if (user.role === "teacher")
    classes = classes.filter((c) => c.waliKelasId === user.id);
  return classes;
}

function buildGradeContext() {
  return {
    assignmentsAll: db.all("assignments"),
    quizzesAll: db.all("quizzes"),
    subs: db.all("submissions"),
    results: db.all("quizResults"),
  };
}

// Daftar kelas perwalian beserta murid, rangkuman nilai & kehadiran, dan
// statistik untuk grafik.
app.get(
  "/api/homeroom",
  authenticate,
  requireRole("teacher", "admin", "pimpinan"),
  (req, res) => {
    const classes = homeroomClassesFor(req.user);
    const users = db.all("users");
    const userById = (uid) => users.find((u) => u.id === uid);
    const subjectsAll = db.all("subjects");
    const attAll = db.all("attendance");
    const ctx = buildGradeContext();
    const years = db.all("academicYears");
    const activeYearId = getActiveYearId();
    const activeSemester = getActiveSemester();
    const yearNameOf = (yid) =>
      (years.find((y) => y.id === yid) || {}).name || "\u2014";

    const out = classes.map((c) => {
      const classSubjects = subjectsAll.filter((s) => s.classId === c.id);
      const studentIds = c.studentIds || [];
      const attClass = attAll.filter((a) => a.classId === c.id);
      const isGraduating = isGraduatingClass(c.name, c.fase);
      const canPromote = (c.semester || "") === "genap" && !isGraduating;
      const nextClassName = nextGradeClassName(c.name);
      const promoByStudent = {};
      db.find("promotions", (p) => p.classId === c.id).forEach((p) => {
        promoByStudent[p.studentId] = p;
      });

      const students = studentIds.map((sid) => {
        const u = userById(sid);
        const subjectGrades = {};
        classSubjects.forEach((s) => {
          subjectGrades[s.id] = computeSubjectGrade(s, sid, ctx).average;
        });
        const avgGrade = avgOf(
          Object.values(subjectGrades).filter((v) => v !== null)
        );
        const attendance = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
        attClass
          .filter((a) => a.studentId === sid)
          .forEach((a) => {
            if (attendance[a.status] !== undefined) attendance[a.status]++;
          });
        const promo = promoByStudent[sid];
        return {
          id: sid,
          name: u ? u.name : "?",
          photoUrl: u ? u.photoUrl || "" : "",
          nisn: u ? u.nisn || "" : "",
          avgGrade,
          subjectGrades,
          attendance,
          promotion: promo ? promo.decision : "",
          promotionApplied: promo ? !!promo.applied : false,
        };
      });

      const attendanceTotals = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
      attClass.forEach((a) => {
        if (attendanceTotals[a.status] !== undefined)
          attendanceTotals[a.status]++;
      });

      const subjectAverages = classSubjects.map((s) => {
        const avgs = studentIds
          .map((sid) => computeSubjectGrade(s, sid, ctx).average)
          .filter((v) => v !== null);
        return { subjectId: s.id, subjectName: s.name, average: avgOf(avgs) };
      });

      const gradeBuckets = [
        { label: "0–59", min: 0, max: 59, count: 0 },
        { label: "60–69", min: 60, max: 69, count: 0 },
        { label: "70–79", min: 70, max: 79, count: 0 },
        { label: "80–89", min: 80, max: 89, count: 0 },
        { label: "90–100", min: 90, max: 100, count: 0 },
      ];
      students.forEach((st) => {
        if (st.avgGrade === null) return;
        const b = gradeBuckets.find(
          (x) => st.avgGrade >= x.min && st.avgGrade <= x.max
        );
        if (b) b.count++;
      });

      const classAvgGrade = avgOf(
        students.map((s) => s.avgGrade).filter((v) => v !== null)
      );

      return {
        classId: c.id,
        className: c.name,
        academicYearId: c.academicYearId || "",
        academicYearName: yearNameOf(c.academicYearId),
        semester: c.semester || "",
        periodActive:
          c.academicYearId === activeYearId && c.semester === activeSemester,
        isGraduating,
        canPromote,
        nextClassName,
        studentCount: studentIds.length,
        students,
        stats: {
          attendanceTotals,
          subjectAverages,
          gradeBuckets,
          classAvgGrade,
        },
      };
    });

    ok(res, out);
  }
);

// Detail nilai satu siswa (lintas mapel kelas perwalian) + kehadiran.
app.get(
  "/api/homeroom/students/:studentId",
  authenticate,
  requireRole("teacher", "admin", "pimpinan"),
  (req, res) => {
    const classes = homeroomClassesFor(req.user);
    const student = db.getById("users", req.params.studentId);
    if (!student || student.role !== "student")
      return bad(res, 404, "Siswa tidak ditemukan");
    const cls = classes.find((c) =>
      (c.studentIds || []).includes(student.id)
    );
    if (!cls)
      return bad(res, 403, "Siswa bukan anggota kelas perwalian Anda");

    const users = db.all("users");
    const nameOf = (uid) => (users.find((u) => u.id === uid) || {}).name || "?";
    const subjectsAll = db.all("subjects");
    const ctx = buildGradeContext();
    const classSubjects = subjectsAll.filter((s) => s.classId === cls.id);

    const subjects = classSubjects.map((s) => {
      const g = computeSubjectGrade(s, student.id, ctx);
      return {
        subjectId: s.id,
        subjectName: s.name,
        teacherNames: (s.teacherIds || []).map(nameOf).join(", "),
        items: g.items,
        average: g.average,
      };
    });
    const overallAverage = avgOf(
      subjects.map((s) => s.average).filter((v) => v !== null)
    );

    const attendance = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
    db.all("attendance")
      .filter((a) => a.classId === cls.id && a.studentId === student.id)
      .forEach((a) => {
        if (attendance[a.status] !== undefined) attendance[a.status]++;
      });

    ok(res, {
      student: sanitizeUser(student),
      className: cls.name,
      subjects,
      overallAverage,
      attendance,
    });
  }
);

// Keputusan kenaikan kelas oleh wali kelas (hanya semester genap).
// Disimpan; diterapkan otomatis saat tahun ajaran baru (ganjil) diaktifkan.
app.put(
  "/api/homeroom/:classId/promotion",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const cls = db.getById("classes", req.params.classId);
    if (!cls) return bad(res, 404, "Kelas tidak ditemukan.");
    if (req.user.role === "teacher" && cls.waliKelasId !== req.user.id)
      return bad(res, 403, "Anda bukan wali kelas kelas ini.");
    if ((cls.semester || "") !== "genap")
      return bad(
        res,
        400,
        "Kenaikan kelas hanya dapat ditentukan pada semester genap."
      );
    if (isGraduatingClass(cls.name, cls.fase))
      return bad(
        res,
        400,
        "Kelas ini adalah tingkat akhir jenjang. Kelulusan siswa ditentukan oleh admin, bukan kenaikan kelas."
      );
    const studentId = String(req.body.studentId || "");
    const decision = String(req.body.decision || "").toLowerCase();
    if (!["naik", "tinggal", ""].includes(decision))
      return bad(res, 400, "Keputusan tidak valid.");
    if (!(cls.studentIds || []).includes(studentId))
      return bad(res, 400, "Siswa bukan anggota kelas ini.");

    const existing = db
      .find("promotions", (p) => p.classId === cls.id && p.studentId === studentId)
      .find(Boolean);
    if (existing && existing.applied)
      return bad(
        res,
        400,
        "Keputusan sudah diterapkan dan tidak dapat diubah."
      );

    // Keputusan kosong = hapus catatan (kembali "belum ditentukan").
    if (decision === "") {
      if (existing) db.remove("promotions", existing.id);
      return ok(res, { cleared: true, studentId });
    }

    const nextClassName =
      decision === "naik" ? nextGradeClassName(cls.name, cls.fase) : "";
    const payload = {
      classId: cls.id,
      className: cls.name,
      studentId,
      academicYearId: cls.academicYearId || "",
      semester: cls.semester || "",
      fase: cls.fase || inferFase(cls.name),
      decision,
      nextClassName,
      decidedBy: req.user.id,
      decidedByName: req.user.name,
      decidedAt: new Date().toISOString(),
      applied: false,
    };
    const rec = existing
      ? db.update("promotions", existing.id, payload)
      : db.insert("promotions", payload);
    ok(res, rec);
  }
);



const DEFAULT_CLASS_NAME_OPTIONS = FASE_KEYS.flatMap((fk) =>
  FASE[fk].grades.flatMap((grade) =>
    ROMBEL_OPTS.map((sec) => ({
      name: buildClassName(fk, grade, sec),
      fase: fk,
      tingkat: buildTingkat(fk, grade),
      rombel: sec,
    }))
  )
);

let classNameOptionsEnsured = false;
function ensureClassNameOptions() {
  if (classNameOptionsEnsured) return;
  classNameOptionsEnsured = true;
  const existing = new Set(
    db.all("classNameOptions").map((o) => String(o.name).toLowerCase())
  );
  // Lengkapi opsi default yang belum ada (mencakup semua fase C/D/E/F).
  DEFAULT_CLASS_NAME_OPTIONS.forEach((d) => {
    if (!existing.has(d.name.toLowerCase()))
      db.insert("classNameOptions", { ...d, studentIds: [] });
  });
  // Batasi rombel hanya A/B/C: hapus opsi rombel di luar daftar yang masih
  // kosong (tanpa siswa) agar tidak menghapus data yang sudah terisi.
  const allowedRombel = new Set(ROMBEL_OPTS);
  db.all("classNameOptions").forEach((o) => {
    const r = String(o.rombel || "").toUpperCase();
    const empty = (o.studentIds || []).length === 0;
    if (r && !allowedRombel.has(r) && empty)
      db.remove("classNameOptions", o.id);
  });
  // Selaraskan fase tiap opsi dengan namanya (inferFase bersifat otoritatif:
  // nama kelas sudah memuat penanda jenjang/tingkat). Ini juga memperbaiki
  // data lama yang sempat diberi fase C untuk seluruh SD.
  db.all("classNameOptions").forEach((o) => {
    const f = inferFase(o.name);
    if (f && o.fase !== f) db.update("classNameOptions", o.id, { fase: f });
  });
}

// Daftar pilihan nama kelas / Master Kelas (semua peran boleh melihat).
app.get("/api/class-name-options", authenticate, (req, res) => {
  ensureClassNameOptions();
  const nameOf = (id) => (db.getById("users", id) || {}).name || "?";
  const list = db
    .all("classNameOptions")
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "id", { numeric: true }))
    .map((o) => {
      const ids = Array.isArray(o.studentIds) ? o.studentIds : [];
      return {
        ...o,
        studentIds: ids,
        fase: o.fase || inferFase(o.name),
        tingkat: o.tingkat || o.name,
        rombel: o.rombel || "",
        students: ids.map((id) => ({ id, name: nameOf(id) })),
      };
    });
  ok(res, list);
});

// Tambah pilihan nama kelas.
app.post(
  "/api/class-name-options",
  authenticate,
  requireRole("admin"),
  (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) return bad(res, 400, "Nama kelas wajib diisi.");
    const exists = db
      .find("classNameOptions", (o) => o.name.toLowerCase() === name.toLowerCase());
    if (exists.length) return bad(res, 409, "Nama kelas sudah ada.");
    const ids = Array.isArray(req.body.studentIds) ? req.body.studentIds : [];
    const tingkat = String(req.body.tingkat || "").trim() || name;
    const rombel = String(req.body.rombel || "").trim();
    const fase = FASE[req.body.fase] ? req.body.fase : inferFase(name);
    const created = db.insert("classNameOptions", {
      name,
      fase,
      tingkat,
      rombel,
      studentIds: ids,
    });
    enforceSingleMaster(created.id, ids);
    ok(res, created);
  }
);

// Ubah pilihan nama kelas (nama dan/atau roster siswa Master Kelas).
app.put(
  "/api/class-name-options/:id",
  authenticate,
  requireRole("admin"),
  (req, res) => {
    const opt = db.getById("classNameOptions", req.params.id);
    if (!opt) return bad(res, 404, "Pilihan tidak ditemukan.");
    const patch = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (!name) return bad(res, 400, "Nama kelas wajib diisi.");
      const exists = db.find(
        "classNameOptions",
        (o) => o.id !== opt.id && o.name.toLowerCase() === name.toLowerCase()
      );
      if (exists.length) return bad(res, 409, "Nama kelas sudah ada.");
      patch.name = name;
    }
    if (req.body.tingkat !== undefined)
      patch.tingkat = String(req.body.tingkat || "").trim();
    if (req.body.rombel !== undefined)
      patch.rombel = String(req.body.rombel || "").trim();
    if (req.body.fase !== undefined)
      patch.fase = FASE[req.body.fase]
        ? req.body.fase
        : inferFase(patch.name || opt.name);
    if (Array.isArray(req.body.studentIds)) patch.studentIds = req.body.studentIds;
    const updated = db.update("classNameOptions", opt.id, patch);
    if (Array.isArray(req.body.studentIds))
      enforceSingleMaster(opt.id, req.body.studentIds);
    ok(res, updated);
  }
);

// Hapus pilihan nama kelas.
app.delete(
  "/api/class-name-options/:id",
  authenticate,
  requireRole("admin"),
  (req, res) => {
    db.remove("classNameOptions", req.params.id);
    ok(res, { success: true });
  }
);

/* =====================================================================
 * PILIHAN NAMA MATA PELAJARAN (dapat dikelola admin)
 * ===================================================================== */

const DEFAULT_SUBJECT_NAME_OPTIONS = [
  // Fase A (SD/MI kelas 1–2)
  { fase: "A", name: "Pendidikan Agama Islam dan Budi Pekerti" },
  { fase: "A", name: "Pendidikan Pancasila" },
  { fase: "A", name: "Bahasa Indonesia" },
  { fase: "A", name: "Matematika" },
  { fase: "A", name: "Seni Rupa" },
  { fase: "A", name: "Pendidikan Jasmani, Olahraga, dan Kesehatan" },
  { fase: "A", name: "Bahasa Inggris" },
  // Fase B (SD/MI kelas 3–4)
  { fase: "B", name: "Pendidikan Agama Islam dan Budi Pekerti" },
  { fase: "B", name: "Pendidikan Pancasila" },
  { fase: "B", name: "Bahasa Indonesia" },
  { fase: "B", name: "Matematika" },
  { fase: "B", name: "Ilmu Pengetahuan Alam dan Sosial" },
  { fase: "B", name: "Seni Rupa" },
  { fase: "B", name: "Pendidikan Jasmani, Olahraga, dan Kesehatan" },
  { fase: "B", name: "Bahasa Inggris" },
  // Fase C (SD/MI kelas 5–6)
  { fase: "C", name: "Pendidikan Agama Islam dan Budi Pekerti" },
  { fase: "C", name: "Pendidikan Pancasila" },
  { fase: "C", name: "Bahasa Indonesia" },
  { fase: "C", name: "Matematika" },
  { fase: "C", name: "Ilmu Pengetahuan Alam dan Sosial" },
  { fase: "C", name: "Seni Rupa" },
  { fase: "C", name: "Pendidikan Jasmani, Olahraga, dan Kesehatan" },
  { fase: "C", name: "Bahasa Inggris" },
  // Fase D (SMP/MTs kelas 7–9)
  { fase: "D", name: "Pendidikan Agama Islam dan Budi Pekerti" },
  { fase: "D", name: "Pendidikan Pancasila" },
  { fase: "D", name: "Bahasa Indonesia" },
  { fase: "D", name: "Matematika" },
  { fase: "D", name: "Ilmu Pengetahuan Alam" },
  { fase: "D", name: "Ilmu Pengetahuan Sosial" },
  { fase: "D", name: "Bahasa Inggris" },
  { fase: "D", name: "Seni Budaya" },
  { fase: "D", name: "Pendidikan Jasmani, Olahraga, dan Kesehatan" },
  { fase: "D", name: "Informatika" },
  // Fase E (SMA/MA kelas 10–12)
  { fase: "E", name: "Pendidikan Agama Islam dan Budi Pekerti" },
  { fase: "E", name: "Pendidikan Pancasila" },
  { fase: "E", name: "Bahasa Indonesia" },
  { fase: "E", name: "Matematika" },
  { fase: "E", name: "Bahasa Inggris" },
  { fase: "E", name: "Sejarah" },
  { fase: "E", name: "Pendidikan Jasmani, Olahraga, dan Kesehatan" },
  { fase: "E", name: "Seni Budaya" },
  { fase: "E", name: "Informatika" },
  { fase: "E", name: "Fisika" },
  { fase: "E", name: "Kimia" },
  { fase: "E", name: "Biologi" },
  { fase: "E", name: "Ekonomi" },
  { fase: "E", name: "Geografi" },
  { fase: "E", name: "Sosiologi" },
  // Fase F (SMK/MAK kelas 10–12)
  { fase: "F", name: "Pendidikan Agama Islam dan Budi Pekerti" },
  { fase: "F", name: "Pendidikan Pancasila" },
  { fase: "F", name: "Bahasa Indonesia" },
  { fase: "F", name: "Matematika" },
  { fase: "F", name: "Bahasa Inggris" },
  { fase: "F", name: "Sejarah" },
  { fase: "F", name: "Pendidikan Jasmani, Olahraga, dan Kesehatan" },
  { fase: "F", name: "Seni Budaya" },
  { fase: "F", name: "Informatika" },
  { fase: "F", name: "Projek Ilmu Pengetahuan Alam dan Sosial" },
  { fase: "F", name: "Dasar-dasar Program Keahlian" },
  { fase: "F", name: "Konsentrasi Keahlian" },
  { fase: "F", name: "Projek Kreatif dan Kewirausahaan" },
  { fase: "F", name: "Praktik Kerja Lapangan" },
];

const FASE_ORDER = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };

function ensureSubjectNameOptions() {
  const all = db.all("subjectNameOptions");
  // Reset ke daftar baku per fase bila kosong atau masih memakai format lama
  // (tanpa field fase) — daftar mapel dikelompokkan per fase.
  const needsReset = all.length === 0 || all.some((o) => !o.fase);
  if (needsReset) {
    all.slice().forEach((o) => db.remove("subjectNameOptions", o.id));
    DEFAULT_SUBJECT_NAME_OPTIONS.forEach((o) =>
      db.insert("subjectNameOptions", { fase: o.fase, name: o.name })
    );
  }
}

// Daftar pilihan nama mata pelajaran (semua peran boleh melihat).
app.get("/api/subject-name-options", authenticate, (req, res) => {
  ensureSubjectNameOptions();
  const list = db
    .all("subjectNameOptions")
    .slice()
    .sort(
      (a, b) =>
        (FASE_ORDER[a.fase] ?? 99) - (FASE_ORDER[b.fase] ?? 99) ||
        a.name.localeCompare(b.name, "id", { numeric: true })
    );
  ok(res, list);
});

// Tambah pilihan nama mata pelajaran.
app.post(
  "/api/subject-name-options",
  authenticate,
  requireRole("admin"),
  (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) return bad(res, 400, "Nama mata pelajaran wajib diisi.");
    const fase = FASE[req.body.fase] ? req.body.fase : "D";
    const exists = db.find(
      "subjectNameOptions",
      (o) => o.fase === fase && o.name.toLowerCase() === name.toLowerCase()
    );
    if (exists.length)
      return bad(res, 409, "Nama mata pelajaran sudah ada pada fase ini.");
    const created = db.insert("subjectNameOptions", { fase, name });
    ok(res, created);
  }
);

// Ubah pilihan nama mata pelajaran.
app.put(
  "/api/subject-name-options/:id",
  authenticate,
  requireRole("admin"),
  (req, res) => {
    const opt = db.getById("subjectNameOptions", req.params.id);
    if (!opt) return bad(res, 404, "Pilihan tidak ditemukan.");
    const name = String(req.body.name || "").trim();
    if (!name) return bad(res, 400, "Nama mata pelajaran wajib diisi.");
    const fase = FASE[req.body.fase] ? req.body.fase : opt.fase || "D";
    const exists = db.find(
      "subjectNameOptions",
      (o) =>
        o.id !== opt.id &&
        o.fase === fase &&
        o.name.toLowerCase() === name.toLowerCase()
    );
    if (exists.length)
      return bad(res, 409, "Nama mata pelajaran sudah ada pada fase ini.");
    const updated = db.update("subjectNameOptions", opt.id, { fase, name });
    ok(res, updated);
  }
);

// Hapus pilihan nama mata pelajaran.
app.delete(
  "/api/subject-name-options/:id",
  authenticate,
  requireRole("admin"),
  (req, res) => {
    db.remove("subjectNameOptions", req.params.id);
    ok(res, { success: true });
  }
);

/* =====================================================================
 * KATALOG KURIKULUM (SMP: Kurikulum Merdeka / K-13 / KTSP 2006)
 * Dikelola admin. Dikelompokkan per jenis kurikulum, kelas, dan mapel.
 * Struktur konten menyesuaikan tiap jenis kurikulum:
 *  - merdeka  : Fase, Capaian Pembelajaran (CP), Elemen, Tujuan Pembelajaran
 *  - k13      : Kompetensi Inti (KI-1..4), Kompetensi Dasar (KD)
 *  - ktsp2006 : Standar Kompetensi (SK) -> Kompetensi Dasar (KD)
 * ===================================================================== */

const CURRICULUM_TYPES = ["merdeka", "k13", "ktsp2006"];
const SMP_KELAS = [7, 8, 9];

// Susun & bersihkan dokumen katalog sesuai struktur jenis kurikulumnya.
function buildCatalogDoc(body) {
  const curriculumType = CURRICULUM_TYPES.includes(body.curriculumType)
    ? body.curriculumType
    : null;
  const fase = FASE[body.fase] ? body.fase : "D";
  const kelas = parseInt(body.kelas, 10);
  const mapel = String(body.mapel || "").trim();
  const semester = SEMESTERS.includes(body.semester) ? body.semester : "ganjil";
  if (!curriculumType) return { error: "Jenis kurikulum tidak valid." };
  if (!FASE[fase].grades.includes(kelas))
    return {
      error: `Kelas ${body.kelas} tidak sesuai untuk Fase ${fase} (${FASE[fase].jenjang}).`,
    };
  if (!mapel) return { error: "Mata pelajaran wajib diisi." };

  const doc = {
    curriculumType,
    fase,
    jenjang: FASE[fase].jenjang,
    kelas,
    mapel,
    semester,
    catatan: String(body.catatan || "").trim(),
  };

  const str = (v) => String(v || "").trim();
  if (curriculumType === "merdeka") {
    doc.capaianPembelajaran = str(body.capaianPembelajaran);
    doc.elemen = Array.isArray(body.elemen)
      ? body.elemen
          .map((e) => ({ nama: str(e.nama), capaian: str(e.capaian) }))
          .filter((e) => e.nama || e.capaian)
      : [];
    doc.tema = Array.isArray(body.tema)
      ? body.tema.map(str).filter(Boolean)
      : [];
    doc.materiPokok = Array.isArray(body.materiPokok)
      ? body.materiPokok.map(normalizeMateri).filter(Boolean)
      : [];
    doc.tujuanPembelajaran = Array.isArray(body.tujuanPembelajaran)
      ? body.tujuanPembelajaran.map(str).filter(Boolean)
      : [];
  } else if (curriculumType === "k13") {
    const jpOf = (v) => Math.max(0, parseInt(v, 10) || 0);
    doc.kompetensiInti = Array.isArray(body.kompetensiInti)
      ? body.kompetensiInti
          .map((k) => ({ kode: str(k.kode), deskripsi: str(k.deskripsi) }))
          .filter((k) => k.kode || k.deskripsi)
      : [];
    doc.kompetensiDasar = Array.isArray(body.kompetensiDasar)
      ? body.kompetensiDasar
          .map((k) => ({
            kode: str(k.kode),
            deskripsi: str(k.deskripsi),
            jp: jpOf(k.jp),
          }))
          .filter((k) => k.kode || k.deskripsi)
      : [];
    // Indikator Pencapaian Kompetensi (IPK) dan Tujuan Pembelajaran — disusun
    // guru di RPP, diturunkan dari KD.
    doc.indikator = Array.isArray(body.indikator)
      ? body.indikator
          .map((k) => ({ kode: str(k.kode), deskripsi: str(k.deskripsi) }))
          .filter((k) => k.kode || k.deskripsi)
      : [];
    doc.tujuanPembelajaran = Array.isArray(body.tujuanPembelajaran)
      ? body.tujuanPembelajaran.map(str).filter(Boolean)
      : [];
  } else if (curriculumType === "ktsp2006") {
    doc.standarKompetensi = Array.isArray(body.standarKompetensi)
      ? body.standarKompetensi
          .map((sk) => ({
            kode: str(sk.kode),
            deskripsi: str(sk.deskripsi),
            kompetensiDasar: Array.isArray(sk.kompetensiDasar)
              ? sk.kompetensiDasar
                  .map((kd) => ({ kode: str(kd.kode), deskripsi: str(kd.deskripsi) }))
                  .filter((kd) => kd.kode || kd.deskripsi)
              : [],
          }))
          .filter((sk) => sk.kode || sk.deskripsi || sk.kompetensiDasar.length)
      : [];
  }
  return { doc };
}

// Contoh isi katalog (struktur benar per jenis) untuk memandu admin.
// Versi seed katalog — naikkan bila struktur/nama mapel seed berubah agar
// katalog referensi di-generate ulang (reset) satu kali secara otomatis.
const CATALOG_SEED_VERSION = 2;
let curriculumCatalogEnsured = false;
function ensureCurriculumCatalog() {
  if (curriculumCatalogEnsured) return;
  curriculumCatalogEnsured = true;
  // Reset katalog bila versi seed berubah (nama mapel per kurikulum diperbarui).
  // Katalog adalah data referensi yang di-generate; entri lama dengan nama mapel
  // usang dihapus agar tidak menimbulkan duplikat.
  const verDoc = db.findOne("settings", (s) => s.key === "curriculumSeedVersion");
  const ver = verDoc ? Number(verDoc.value) : 0;
  if (ver < CATALOG_SEED_VERSION) {
    db.all("curriculumCatalog")
      .slice()
      .forEach((e) => db.remove("curriculumCatalog", e.id));
    if (verDoc) db.update("settings", verDoc.id, { value: CATALOG_SEED_VERSION });
    else db.insert("settings", { key: "curriculumSeedVersion", value: CATALOG_SEED_VERSION });
  }
  const seed = [
    // ---- Kurikulum Merdeka (Fase D) ----
    {
      curriculumType: "merdeka",
      kelas: 7,
      mapel: "Bahasa Indonesia",
      semester: "ganjil",
      fase: "D",
      capaianPembelajaran:
        "Pada akhir Fase D, peserta didik mampu memahami, mengolah, dan menyajikan informasi dari teks lisan, tulis, dan visual untuk berbagai tujuan secara kritis dan kreatif.",
      elemen: [
        {
          nama: "Menyimak",
          capaian:
            "Peserta didik mampu menganalisis dan mengevaluasi informasi berupa gagasan, pikiran, dan pesan dari teks yang didengar.",
        },
        {
          nama: "Membaca dan Memirsa",
          capaian:
            "Peserta didik memahami informasi eksplisit dan implisit dari teks deskripsi, narasi, dan eksposisi.",
        },
        {
          nama: "Berbicara dan Mempresentasikan",
          capaian:
            "Peserta didik menyampaikan gagasan secara runtut dan santun dalam diskusi maupun presentasi.",
        },
        {
          nama: "Menulis",
          capaian:
            "Peserta didik menulis teks deskripsi dan narasi dengan struktur dan kaidah kebahasaan yang tepat.",
        },
      ],
      tujuanPembelajaran: [
        "Menganalisis gagasan pokok pada teks deskripsi yang disimak.",
        "Menyusun teks deskripsi sederhana tentang objek di lingkungan sekitar.",
        "Mempresentasikan hasil tulisan dengan percaya diri.",
      ],
      materiPokok: [
        makeMateri("Teks deskripsi", 30),
        makeMateri("Teks narasi (cerita fantasi)", 30),
        makeMateri("Teks prosedur", 30),
      ],
      tema: P5_TEMA,
    },
    {
      curriculumType: "merdeka",
      kelas: 7,
      mapel: "Matematika",
      semester: "ganjil",
      fase: "D",
      capaianPembelajaran:
        "Pada akhir Fase D, peserta didik dapat menyelesaikan masalah kontekstual yang berkaitan dengan bilangan, aljabar, pengukuran, geometri, serta analisis data dan peluang.",
      elemen: [
        {
          nama: "Bilangan",
          capaian:
            "Membaca, menulis, dan membandingkan bilangan bulat, pecahan, serta melakukan operasi hitungnya.",
        },
        {
          nama: "Aljabar",
          capaian:
            "Mengenal bentuk aljabar dan menyelesaikan persamaan linear satu variabel.",
        },
        {
          nama: "Pengukuran",
          capaian: "Menyelesaikan masalah pengukuran keliling dan luas bangun datar.",
        },
      ],
      tujuanPembelajaran: [
        "Melakukan operasi hitung bilangan bulat dan pecahan.",
        "Menyelesaikan persamaan linear satu variabel.",
      ],
      materiPokok: [
        makeMateri("Bilangan bulat dan pecahan", 24),
        makeMateri("Bentuk aljabar", 24),
        makeMateri("Persamaan linear satu variabel", 24),
      ],
      tema: P5_TEMA,
    },
    // ---- Kurikulum 2013 (K-13) ----
    {
      curriculumType: "k13",
      kelas: 7,
      mapel: "Bahasa Indonesia",
      semester: "ganjil",
      kompetensiInti: [
        {
          kode: "KI-1",
          deskripsi:
            "Menghargai dan menghayati ajaran agama yang dianutnya.",
        },
        {
          kode: "KI-2",
          deskripsi:
            "Menghargai dan menghayati perilaku jujur, disiplin, tanggung jawab, peduli, santun, dan percaya diri.",
        },
        {
          kode: "KI-3",
          deskripsi:
            "Memahami pengetahuan (faktual, konseptual, dan prosedural) berdasarkan rasa ingin tahunya.",
        },
        {
          kode: "KI-4",
          deskripsi:
            "Mencoba, mengolah, dan menyaji dalam ranah konkret dan abstrak sesuai yang dipelajari di sekolah.",
        },
      ],
      kompetensiDasar: [
        {
          kode: "3.1",
          deskripsi:
            "Mengidentifikasi informasi dalam teks deskripsi tentang objek yang didengar dan dibaca.",
        },
        {
          kode: "4.1",
          deskripsi:
            "Menentukan isi teks deskripsi objek secara lisan dan tulis.",
        },
        {
          kode: "3.2",
          deskripsi:
            "Menelaah struktur dan kaidah kebahasaan teks deskripsi.",
        },
        {
          kode: "4.2",
          deskripsi:
            "Menyajikan data dan gagasan dalam bentuk teks deskripsi.",
        },
      ],
    },
    // ---- KTSP 2006 ----
    {
      curriculumType: "ktsp2006",
      kelas: 7,
      mapel: "Bahasa Indonesia",
      semester: "ganjil",
      standarKompetensi: [
        {
          kode: "1",
          deskripsi:
            "Mendengarkan: Memahami wacana lisan melalui kegiatan mendengarkan berita.",
          kompetensiDasar: [
            { kode: "1.1", deskripsi: "Menyimpulkan isi berita yang dibacakan dalam beberapa kalimat." },
            { kode: "1.2", deskripsi: "Menuliskan kembali berita yang dibacakan ke dalam beberapa kalimat." },
          ],
        },
        {
          kode: "2",
          deskripsi:
            "Berbicara: Mengungkapkan pengalaman dan informasi melalui kegiatan bercerita dan menyampaikan pengumuman.",
          kompetensiDasar: [
            { kode: "2.1", deskripsi: "Menceritakan pengalaman yang paling mengesankan dengan pilihan kata yang tepat." },
            { kode: "2.2", deskripsi: "Menyampaikan pengumuman dengan intonasi yang tepat." },
          ],
        },
      ],
    },
  ];
  // Gabungkan contoh manual (lebih kaya) dengan katalog lengkap hasil generator,
  // lalu sisipkan hanya entri yang belum ada agar tidak menimpa data admin.
  const keyOf = (e) =>
    `${e.curriculumType}|${e.fase || ""}|${e.kelas}|${String(e.mapel).trim().toLowerCase()}|${e.semester}`;
  // Backfill: entri lama (mis. K-13/KTSP) mungkin belum memiliki field fase.
  // Isi berdasarkan tingkat kelas agar kunci dedup konsisten dan tidak ganda.
  const faseFromKelas = (k) => {
    const g = parseInt(k, 10);
    if (g <= 2) return "A";
    if (g <= 4) return "B";
    if (g <= 6) return "C";
    if (g <= 9) return "D";
    return "E";
  };
  for (const e of db.all("curriculumCatalog")) {
    if (!FASE[e.fase]) {
      const f = faseFromKelas(e.kelas);
      db.update("curriculumCatalog", e.id, { fase: f, jenjang: FASE[f].jenjang });
    }
  }
  const existing = new Set(db.all("curriculumCatalog").map(keyOf));
  const all = seed
    .concat(buildCurriculumSeed())
    .concat(buildCurriculumSeedExtra());
  const seedByKey = new Map();
  for (const s of all) {
    const { doc } = buildCatalogDoc(s);
    if (!doc) continue;
    const key = keyOf(doc);
    // Simpan versi paling lengkap sebagai rujukan migrasi (mis. K-13 dari
    // generator yang sudah memuat IPK/TP/JP mengungguli contoh manual lama).
    const richness = (d) =>
      (Array.isArray(d.indikator) ? d.indikator.length : 0) +
      (Array.isArray(d.tujuanPembelajaran) ? d.tujuanPembelajaran.length : 0) +
      (Array.isArray(d.materiPokok) ? d.materiPokok.length : 0);
    const prev = seedByKey.get(key);
    if (!prev || richness(doc) > richness(prev)) seedByKey.set(key, doc);
    if (existing.has(key)) continue;
    existing.add(key);
    db.insert("curriculumCatalog", doc);
  }
  // Migrasi: lengkapi/upgrade entri Merdeka lama.
  // - Isi tema bila belum ada.
  // - Ubah materiPokok bentuk lama (daftar teks) menjadi objek lengkap
  //   { nama, jp, submateri:[{nama,jp}] } dengan alokasi JP resmi dari seed.
  const needsMateriUpgrade = (mp) =>
    !Array.isArray(mp) ||
    mp.some(
      (m) =>
        !m ||
        typeof m !== "object" ||
        m.jp === undefined ||
        !Array.isArray(m.submateri) ||
        m.submateri.some((s) => !s || typeof s !== "object")
    );
  for (const e of db.all("curriculumCatalog")) {
    if (e.curriculumType !== "merdeka") continue;
    const seedDoc = seedByKey.get(keyOf(e));
    const patch = {};
    if (!Array.isArray(e.tema))
      patch.tema = (seedDoc && seedDoc.tema) || P5_TEMA.slice();
    if (needsMateriUpgrade(e.materiPokok)) {
      if (seedDoc && Array.isArray(seedDoc.materiPokok) && seedDoc.materiPokok.length) {
        // Utamakan alokasi JP resmi dari seed.
        patch.materiPokok = seedDoc.materiPokok;
      } else if (Array.isArray(e.materiPokok)) {
        patch.materiPokok = e.materiPokok.map(normalizeMateri).filter(Boolean);
      } else {
        patch.materiPokok = [];
      }
    }
    if (Object.keys(patch).length) db.update("curriculumCatalog", e.id, patch);
  }
  // Migrasi: lengkapi entri K-13 lama dengan Indikator Pencapaian Kompetensi
  // (IPK), Tujuan Pembelajaran, dan alokasi JP per KD dari seed.
  for (const e of db.all("curriculumCatalog")) {
    if (e.curriculumType !== "k13") continue;
    const seedDoc = seedByKey.get(keyOf(e));
    if (!seedDoc) continue;
    const patch = {};
    const kdMissingJp =
      !Array.isArray(e.kompetensiDasar) ||
      e.kompetensiDasar.some((k) => !k || k.jp === undefined);
    if (
      kdMissingJp &&
      Array.isArray(seedDoc.kompetensiDasar) &&
      seedDoc.kompetensiDasar.length
    )
      patch.kompetensiDasar = seedDoc.kompetensiDasar;
    if (
      (!Array.isArray(e.indikator) || e.indikator.length === 0) &&
      Array.isArray(seedDoc.indikator) &&
      seedDoc.indikator.length
    )
      patch.indikator = seedDoc.indikator;
    if (
      (!Array.isArray(e.tujuanPembelajaran) || e.tujuanPembelajaran.length === 0) &&
      Array.isArray(seedDoc.tujuanPembelajaran) &&
      seedDoc.tujuanPembelajaran.length
    )
      patch.tujuanPembelajaran = seedDoc.tujuanPembelajaran;
    if (Object.keys(patch).length) db.update("curriculumCatalog", e.id, patch);
  }
  ensureBahanAjarSD();
}

// Versi bahan ajar SD Merdeka — naikkan bila template/isi generator berubah
// agar bahan ajar di-generate ulang untuk semua submateri.
const BAHAN_AJAR_SD_VERSION = 1;
// Lengkapi setiap submateri pada katalog SD Merdeka (Fase A–C) dengan bahan
// ajar (materi bacaan HTML). Idempoten: submateri yang sudah punya bahan ajar
// dilewati, kecuali versi generator dinaikkan (regenerasi menyeluruh).
function ensureBahanAjarSD() {
  const verDoc = db.findOne("settings", (s) => s.key === "bahanAjarSDVersion");
  const ver = verDoc ? Number(verDoc.value) : 0;
  const regen = ver < BAHAN_AJAR_SD_VERSION;
  const SD_FASE = new Set(["A", "B", "C"]);
  for (const e of db.all("curriculumCatalog")) {
    if (e.curriculumType !== "merdeka") continue;
    if (!SD_FASE.has(e.fase)) continue;
    if (!Array.isArray(e.materiPokok) || !e.materiPokok.length) continue;
    let changed = false;
    const materiPokok = e.materiPokok.map((m) => {
      if (!m || typeof m !== "object") return m;
      const subs = Array.isArray(m.submateri) ? m.submateri : [];
      const submateri = subs.map((s) => {
        if (!s || typeof s !== "object") return s;
        if (s.bahanAjar && !regen) return s;
        const bahanAjar = buildBahanAjarHTML({
          mapel: e.mapel,
          kelas: e.kelas,
          semester: e.semester,
          fase: e.fase,
          topik: m.nama,
          submateriName: s.nama,
        });
        changed = true;
        return { ...s, bahanAjar };
      });
      return { ...m, submateri };
    });
    if (changed) db.update("curriculumCatalog", e.id, { materiPokok });
  }
  if (regen) {
    if (verDoc) db.update("settings", verDoc.id, { value: BAHAN_AJAR_SD_VERSION });
    else db.insert("settings", { key: "bahanAjarSDVersion", value: BAHAN_AJAR_SD_VERSION });
  }
}

// Daftar katalog kurikulum (semua peran boleh melihat).
app.get("/api/curriculum-catalog", authenticate, (req, res) => {
  ensureCurriculumCatalog();
  let list = db.all("curriculumCatalog").slice();
  if (req.query.curriculumType)
    list = list.filter((e) => e.curriculumType === req.query.curriculumType);
  if (req.query.kelas)
    list = list.filter((e) => String(e.kelas) === String(req.query.kelas));
  if (req.query.mapel) list = list.filter((e) => e.mapel === req.query.mapel);
  if (req.query.semester)
    list = list.filter((e) => e.semester === req.query.semester);
  list.sort(
    (a, b) =>
      a.curriculumType.localeCompare(b.curriculumType) ||
      a.kelas - b.kelas ||
      a.mapel.localeCompare(b.mapel, "id", { numeric: true }) ||
      a.semester.localeCompare(b.semester)
  );
  ok(res, list);
});

// Tambah entri katalog kurikulum (admin).
app.post(
  "/api/curriculum-catalog",
  authenticate,
  requireRole("admin"),
  (req, res) => {
    const { doc, error } = buildCatalogDoc(req.body || {});
    if (error) return bad(res, 400, error);
    const created = db.insert("curriculumCatalog", doc);
    ok(res, created);
  }
);

// Ubah entri katalog kurikulum (admin).
app.put(
  "/api/curriculum-catalog/:id",
  authenticate,
  requireRole("admin"),
  (req, res) => {
    const entry = db.getById("curriculumCatalog", req.params.id);
    if (!entry) return bad(res, 404, "Entri kurikulum tidak ditemukan.");
    const { doc, error } = buildCatalogDoc(req.body || {});
    if (error) return bad(res, 400, error);
    const updated = db.update("curriculumCatalog", entry.id, doc);
    ok(res, updated);
  }
);

// Hapus entri katalog kurikulum (admin).
app.delete(
  "/api/curriculum-catalog/:id",
  authenticate,
  requireRole("admin"),
  (req, res) => {
    db.remove("curriculumCatalog", req.params.id);
    ok(res, { success: true });
  }
);

// Unggah media (gambar/video/berkas) untuk disisipkan ke konten kaya
// (bahan ajar, materi, dll). Mengembalikan URL untuk dipakai di <img>/<video>.
app.post(
  "/api/uploads",
  authenticate,
  requireRole("teacher", "admin"),
  upload.single("file"),
  (req, res) => {
    if (!req.file) return bad(res, 400, "Berkas wajib diunggah");
    ok(res, {
      url: `/uploads/${req.file.filename}`,
      name: req.file.originalname,
      size: req.file.size,
      kind: mediaKind(req.file.mimetype),
    });
  }
);

/* =====================================================================
 * MASTER RUANGAN (dikelola admin, dipakai saat membuat jadwal)
 * ===================================================================== */

// Daftar ruangan (semua peran boleh melihat untuk tampilan jadwal).
app.get("/api/rooms", authenticate, (req, res) => {
  const list = db
    .all("rooms")
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "id", { numeric: true }));
  ok(res, list);
});

// Tambah ruangan.
app.post("/api/rooms", authenticate, requireRole("admin"), (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return bad(res, 400, "Nama ruangan wajib diisi.");
  const exists = db.find(
    "rooms",
    (r) => r.name.toLowerCase() === name.toLowerCase()
  );
  if (exists.length) return bad(res, 409, "Nama ruangan sudah ada.");
  const doc = { name };
  if (req.body.location !== undefined)
    doc.location = String(req.body.location).trim();
  if (req.body.capacity !== undefined && req.body.capacity !== "")
    doc.capacity = parseInt(req.body.capacity, 10) || 0;
  ok(res, db.insert("rooms", doc));
});

// Ubah ruangan.
app.put("/api/rooms/:id", authenticate, requireRole("admin"), (req, res) => {
  const room = db.getById("rooms", req.params.id);
  if (!room) return bad(res, 404, "Ruangan tidak ditemukan.");
  const patch = {};
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return bad(res, 400, "Nama ruangan wajib diisi.");
    const exists = db.find(
      "rooms",
      (r) => r.id !== room.id && r.name.toLowerCase() === name.toLowerCase()
    );
    if (exists.length) return bad(res, 409, "Nama ruangan sudah ada.");
    patch.name = name;
  }
  if (req.body.location !== undefined)
    patch.location = String(req.body.location).trim();
  if (req.body.capacity !== undefined)
    patch.capacity =
      req.body.capacity === "" ? 0 : parseInt(req.body.capacity, 10) || 0;
  ok(res, db.update("rooms", room.id, patch));
});

// Hapus ruangan (dilarang bila masih dipakai jadwal).
app.delete("/api/rooms/:id", authenticate, requireRole("admin"), (req, res) => {
  const used = db.find("schedules", (s) => s.roomId === req.params.id);
  if (used.length)
    return bad(
      res,
      409,
      `Tidak bisa dihapus: masih dipakai ${used.length} jadwal.`
    );
  db.remove("rooms", req.params.id);
  ok(res, { success: true });
});

/* =====================================================================
 * TAHUN AKADEMIK (dikelola admin, hanya 1 yang aktif)
 * ===================================================================== */

// Semester aktif (ganjil/genap) — bagian dari periode aktif.
app.get("/api/active-semester", authenticate, (req, res) => {
  ok(res, { semester: getActiveSemester(), options: SEMESTERS });
});

app.put(
  "/api/active-semester",
  authenticate,
  requireRole("admin"),
  (req, res) => {
    const semester = String(req.body.semester || "").toLowerCase();
    if (!SEMESTERS.includes(semester))
      return bad(res, 400, "Semester harus 'ganjil' atau 'genap'.");
    setActiveSemester(semester);
    ok(res, { semester });
  }
);

// Periode aktif = tahun akademik + semester dalam satu langkah.
app.get("/api/active-period", authenticate, (req, res) => {
  ensureAcademicYears();
  ok(res, {
    academicYearId: getActiveYearId(),
    semester: getActiveSemester(),
    options: SEMESTERS,
  });
});

app.put(
  "/api/active-period",
  authenticate,
  requireRole("admin"),
  (req, res) => {
    ensureAcademicYears();
    const yearId = String(req.body.academicYearId || "");
    const semester = String(req.body.semester || "").toLowerCase();
    const year = db.getById("academicYears", yearId);
    if (!year) return bad(res, 404, "Tahun akademik tidak ditemukan.");
    if (!SEMESTERS.includes(semester))
      return bad(res, 400, "Semester harus 'ganjil' atau 'genap'.");
    // Hanya satu tahun aktif.
    db.find("academicYears", (y) => y.id !== year.id && y.active).forEach((y) =>
      db.update("academicYears", y.id, { active: false })
    );
    if (!year.active) db.update("academicYears", year.id, { active: true });
    setActiveSemester(semester);
    // Saat tahun ajaran baru (semester ganjil) diaktifkan, terapkan keputusan
    // kenaikan kelas yang tertunda: siswa yang naik pindah ke tingkat berikutnya.
    let promoted = 0;
    if (semester === "ganjil") promoted = applyPendingPromotions();
    ok(res, { academicYearId: year.id, semester, promoted });
  }
);

// Daftar tahun akademik (semua peran boleh melihat untuk penyaringan tampilan).
app.get("/api/academic-years", authenticate, (req, res) => {
  ensureAcademicYears();
  const list = db
    .all("academicYears")
    .slice()
    .sort((a, b) => b.name.localeCompare(a.name, "id", { numeric: true }));
  ok(res, list);
});

// Tambah tahun akademik.
app.post(
  "/api/academic-years",
  authenticate,
  requireRole("admin"),
  (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) return bad(res, 400, "Nama tahun akademik wajib diisi.");
    const exists = db.find(
      "academicYears",
      (y) => y.name.toLowerCase() === name.toLowerCase()
    );
    if (exists.length) return bad(res, 409, "Tahun akademik sudah ada.");
    const makeActive = req.body.active === true;
    if (makeActive)
      db.find("academicYears", (y) => y.active).forEach((y) =>
        db.update("academicYears", y.id, { active: false })
      );
    ok(res, db.insert("academicYears", { name, active: makeActive }));
  }
);

// Ubah nama / status aktif tahun akademik (hanya 1 aktif dalam satu waktu).
app.put(
  "/api/academic-years/:id",
  authenticate,
  requireRole("admin"),
  (req, res) => {
    const year = db.getById("academicYears", req.params.id);
    if (!year) return bad(res, 404, "Tahun akademik tidak ditemukan.");
    const patch = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return bad(res, 400, "Nama tahun akademik wajib diisi.");
      const dup = db.find(
        "academicYears",
        (y) => y.id !== year.id && y.name.toLowerCase() === name.toLowerCase()
      );
      if (dup.length) return bad(res, 409, "Tahun akademik sudah ada.");
      patch.name = name;
    }
    if (req.body.active !== undefined) {
      const active = req.body.active === true;
      if (active) {
        // Nonaktifkan tahun lain agar hanya 1 yang aktif.
        db.find("academicYears", (y) => y.id !== year.id && y.active).forEach(
          (y) => db.update("academicYears", y.id, { active: false })
        );
      }
      patch.active = active;
    }
    ok(res, db.update("academicYears", year.id, patch));
  }
);

// Hapus tahun akademik (dilarang bila masih ada kelas yang memakainya).
app.delete(
  "/api/academic-years/:id",
  authenticate,
  requireRole("admin"),
  (req, res) => {
    const used = db.find(
      "classes",
      (c) => c.academicYearId === req.params.id
    );
    if (used.length)
      return bad(
        res,
        409,
        `Tidak bisa dihapus: masih ada ${used.length} kelas pada tahun ini.`
      );
    db.remove("academicYears", req.params.id);
    ok(res, { success: true });
  }
);

/* =====================================================================
 * KELAS
 * ===================================================================== */

// Daftar kelas sesuai peran.
app.get("/api/classes", authenticate, (req, res) => {
  ensureAcademicYears();
  const activeYearId = getActiveYearId();
  const activeSemester = getActiveSemester();
  // Master Kelas menjadi sumber roster HANYA untuk periode AKTIF.
  // Rombel periode lain (arsip/riwayat) menyimpan daftar siswanya sendiri.
  db.all("classes").forEach((c) => {
    if (!(c.academicYearId === activeYearId && c.semester === activeSemester))
      return;
    const masterIds = masterRosterByName(c.name);
    const current = c.studentIds || [];
    if (
      masterIds.length !== current.length ||
      masterIds.some((id, i) => id !== current[i])
    )
      db.update("classes", c.id, { studentIds: masterIds });
  });
  let list = db.all("classes");
  if (req.user.role === "teacher") {
    // Kelas yang memuat minimal satu mata pelajaran yang diampu pengajar.
    const myClassIds = new Set(
      db
        .find("subjects", (s) => (s.teacherIds || []).includes(req.user.id))
        .map((s) => s.classId)
    );
    list = list.filter((c) => myClassIds.has(c.id));
  } else if (req.user.role === "student")
    // Siswa melihat semua kelas tempat ia terdaftar (lintas periode);
    // penyaringan periode dilakukan lewat query opsional di bawah.
    list = list.filter((c) => (c.studentIds || []).includes(req.user.id));
  // Penyaringan opsional berdasarkan tahun akademik / semester (admin/guru).
  if (req.query.academicYearId)
    list = list.filter((c) => c.academicYearId === req.query.academicYearId);
  if (req.query.semester)
    list = list.filter((c) => c.semester === req.query.semester);
  // Sertakan nama anggota untuk tampilan.
  const users = db.all("users");
  const nameOf = (uid) => (users.find((u) => u.id === uid) || {}).name || "?";
  const subjects = db.all("subjects");
  const years = db.all("academicYears");
  const yearNameOf = (yid) =>
    (years.find((y) => y.id === yid) || {}).name || "—";
  const enriched = list.map((c) => ({
    ...c,
    students: (c.studentIds || []).map((id) => ({ id, name: nameOf(id) })),
    subjectCount: subjects.filter((s) => s.classId === c.id).length,
    academicYearName: yearNameOf(c.academicYearId),
    academicYearActive: c.academicYearId === activeYearId,
    periodActive:
      c.academicYearId === activeYearId && c.semester === activeSemester,
    waliKelasName: c.waliKelasId ? nameOf(c.waliKelasId) : "",
    curriculumType: c.curriculumType || "",
  }));
  ok(res, enriched);
});

app.get("/api/classes/:id", authenticate, (req, res) => {
  const cls = db.getById("classes", req.params.id);
  if (!cls) return bad(res, 404, "Kelas tidak ditemukan");
  if (!isMemberOfClass(req.user, cls)) return bad(res, 403, "Bukan anggota kelas");
  ok(res, cls);
});

app.post("/api/classes", authenticate, requireRole("admin"), (req, res) => {
  const { name, description, academicYearId, semester } = req.body || {};
  if (!name) return bad(res, 400, "Nama kelas wajib diisi");
  const yearId =
    academicYearId && db.getById("academicYears", academicYearId)
      ? academicYearId
      : ensureAcademicYears();
  const sem = SEMESTERS.includes(semester) ? semester : getActiveSemester();
  // Nama kelas unik per periode (tahun + semester); antar-periode datanya terpisah.
  const dup = db.find(
    "classes",
    (c) =>
      c.name === name && c.academicYearId === yearId && c.semester === sem
  );
  if (dup.length)
    return bad(res, 409, "Kelas dengan nama itu sudah ada pada periode ini.");
  // Periode aktif: siswa diambil OTOMATIS dari Master Kelas (classNameOptions).
  // Periode non-aktif (arsip): terima daftar siswa eksplisit dari body.
  const isActivePeriod =
    yearId === getActiveYearId() && sem === getActiveSemester();
  const ids = isActivePeriod
    ? masterRosterByName(name)
    : Array.isArray(req.body.studentIds)
    ? req.body.studentIds.filter((x) => db.getById("users", x))
    : [];
  // Wali kelas (opsional) harus guru bila diisi.
  let waliKelasId = "";
  if (req.body.waliKelasId) {
    const wid = String(req.body.waliKelasId).trim();
    if (wid) {
      const t = db.getById("users", wid);
      if (!t || t.role !== "teacher")
        return bad(res, 400, "Wali kelas harus dipilih dari daftar guru");
      waliKelasId = wid;
    }
  }
  const cls = db.insert("classes", {
    name,
    description: description || "",
    studentIds: ids,
    academicYearId: yearId,
    semester: sem,
    waliKelasId,
    fase: FASE[req.body.fase] ? req.body.fase : inferFase(name),
    curriculumType: CURRICULUM_TYPES.includes(req.body.curriculumType)
      ? req.body.curriculumType
      : "",
  });
  ok(res, cls);
});

app.put("/api/classes/:id", authenticate, requireRole("admin"), (req, res) => {
  const cls = db.getById("classes", req.params.id);
  if (!cls) return bad(res, 404, "Kelas tidak ditemukan");
  const { name, description, academicYearId, semester } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description;
  if (academicYearId !== undefined && db.getById("academicYears", academicYearId))
    patch.academicYearId = academicYearId;
  if (SEMESTERS.includes(semester)) patch.semester = semester;
  if (req.body.waliKelasId !== undefined) {
    const wid = String(req.body.waliKelasId).trim();
    if (wid) {
      const t = db.getById("users", wid);
      if (!t || t.role !== "teacher")
        return bad(res, 400, "Wali kelas harus dipilih dari daftar guru");
      patch.waliKelasId = wid;
    } else {
      patch.waliKelasId = "";
    }
  }
  // Penetapan kurikulum yang dipakai kelas (opsional).
  if (req.body.curriculumType !== undefined)
    patch.curriculumType = CURRICULUM_TYPES.includes(req.body.curriculumType)
      ? req.body.curriculumType
      : "";
  // Fase/jenjang: ikut nilai eksplisit, atau ditebak ulang bila nama berubah.
  if (req.body.fase !== undefined && FASE[req.body.fase]) patch.fase = req.body.fase;
  else if (patch.name !== undefined) patch.fase = inferFase(patch.name);
  // Roster eksplisit hanya untuk periode non-aktif (arsip); periode aktif
  // dikelola oleh Master Kelas dan akan disinkronkan otomatis saat GET.
  if (Array.isArray(req.body.studentIds)) {
    const yr = patch.academicYearId || cls.academicYearId;
    const sm = patch.semester || cls.semester;
    if (!(yr === getActiveYearId() && sm === getActiveSemester()))
      patch.studentIds = req.body.studentIds.filter((x) =>
        db.getById("users", x)
      );
  }
  const updated = db.update("classes", req.params.id, patch);
  ok(res, updated);
});

app.delete("/api/classes/:id", authenticate, requireRole("admin"), (req, res) => {
  const removed = db.remove("classes", req.params.id);
  if (!removed) return bad(res, 404, "Kelas tidak ditemukan");
  // Hapus jadwal kelas.
  db.find("schedules", (s) => s.classId === req.params.id).forEach((s) =>
    db.remove("schedules", s.id)
  );
  // Hapus semua mata pelajaran kelas beserta kontennya.
  db.find("subjects", (s) => s.classId === req.params.id).forEach((s) =>
    cascadeDeleteSubject(s.id)
  );
  ok(res, { success: true });
});

/* =====================================================================
 * MATA PELAJARAN (subject) — dibuat/dikelola admin, diampu pengajar
 * ===================================================================== */

// Hapus sebuah mata pelajaran beserta seluruh kontennya.
function cascadeDeleteSubject(subjectId) {
  db.remove("subjects", subjectId);
  db.find("materials", (m) => m.subjectId === subjectId).forEach((m) =>
    db.remove("materials", m.id)
  );
  db.find("curriculum", (c) => c.subjectId === subjectId).forEach((c) =>
    db.remove("curriculum", c.id)
  );
  db.find("lessonStates", (s) => s.subjectId === subjectId).forEach((s) =>
    db.remove("lessonStates", s.id)
  );
  db.find("assignments", (a) => a.subjectId === subjectId).forEach((a) => {
    db.find("submissions", (s) => s.assignmentId === a.id).forEach((s) =>
      db.remove("submissions", s.id)
    );
    db.remove("assignments", a.id);
  });
  db.find("quizzes", (q) => q.subjectId === subjectId).forEach((q) => {
    db.find("quizResults", (r) => r.quizId === q.id).forEach((r) =>
      db.remove("quizResults", r.id)
    );
    db.remove("quizzes", q.id);
  });
  db.find("discussions", (d) => d.subjectId === subjectId).forEach((d) =>
    db.remove("discussions", d.id)
  );
  db.find("attendance", (a) => a.subjectId === subjectId).forEach((a) =>
    db.remove("attendance", a.id)
  );
  db.find("comments", (c) => c.subjectId === subjectId).forEach((c) =>
    db.remove("comments", c.id)
  );
}

app.get("/api/subjects", authenticate, (req, res) => {
  const { classId } = req.query;
  let list = db.all("subjects");
  if (classId) list = list.filter((s) => s.classId === classId);
  if (req.user.role === "teacher")
    list = list.filter((s) => (s.teacherIds || []).includes(req.user.id));
  else if (req.user.role === "student") {
    // Semua kelas tempat siswa terdaftar (lintas periode); penyaringan
    // periode dilakukan lewat query opsional di bawah.
    const myClassIds = new Set(
      db
        .find("classes", (c) => (c.studentIds || []).includes(req.user.id))
        .map((c) => c.id)
    );
    list = list.filter((s) => myClassIds.has(s.classId));
  }
  const classes = db.all("classes");
  const classById = new Map(classes.map((c) => [c.id, c]));
  // Penyaringan opsional berdasarkan periode (tahun akademik / semester).
  if (req.query.academicYearId || req.query.semester) {
    list = list.filter((s) => {
      const c = classById.get(s.classId);
      if (!c) return false;
      if (
        req.query.academicYearId &&
        c.academicYearId !== req.query.academicYearId
      )
        return false;
      if (req.query.semester && c.semester !== req.query.semester) return false;
      return true;
    });
  }
  const users = db.all("users");
  const years = db.all("academicYears");
  const activeYearId = getActiveYearId();
  const activeSemester = getActiveSemester();
  const yearNameOf = (yid) =>
    (years.find((y) => y.id === yid) || {}).name || "\u2014";
  const nameOf = (uid) => (users.find((u) => u.id === uid) || {}).name || "?";
  const enriched = list
    .map((s) => {
      const c = classById.get(s.classId) || {};
      return {
        ...s,
        className: c.name || "?",
        academicYearId: c.academicYearId || "",
        academicYearName: yearNameOf(c.academicYearId),
        semester: c.semester || "",
        periodActive:
          c.academicYearId === activeYearId && c.semester === activeSemester,
        teachers: (s.teacherIds || []).map((id) => ({ id, name: nameOf(id) })),
      };
    })
    .sort((a, b) => (a.className + a.name).localeCompare(b.className + b.name));
  ok(res, enriched);
});

app.get("/api/subjects/:id", authenticate, (req, res) => {
  const subject = getSubjectOr404(req, res, req.params.id);
  if (!subject) return;
  const cls = db.getById("classes", subject.classId);
  const users = db.all("users");
  const nameOf = (uid) => (users.find((u) => u.id === uid) || {}).name || "?";
  ok(res, {
    ...subject,
    className: cls ? cls.name : "?",
    teachers: (subject.teacherIds || []).map((id) => ({ id, name: nameOf(id) })),
    students: cls
      ? (cls.studentIds || []).map((id) => ({ id, name: nameOf(id) }))
      : [],
  });
});

app.post("/api/subjects", authenticate, requireRole("admin"), (req, res) => {
  const { classId, name, description, teacherIds } = req.body || {};
  if (!classId || !name) return bad(res, 400, "classId dan nama wajib diisi");
  if (!db.getById("classes", classId))
    return bad(res, 404, "Kelas tidak ditemukan");
  const subject = db.insert("subjects", {
    classId,
    name,
    description: description || "",
    teacherIds: Array.isArray(teacherIds) ? teacherIds : [],
  });
  ok(res, subject);
});

app.put("/api/subjects/:id", authenticate, requireRole("admin"), (req, res) => {
  const subject = db.getById("subjects", req.params.id);
  if (!subject) return bad(res, 404, "Mata pelajaran tidak ditemukan");
  const { name, description, teacherIds, classId } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description;
  if (Array.isArray(teacherIds)) patch.teacherIds = teacherIds;
  if (classId !== undefined && db.getById("classes", classId))
    patch.classId = classId;
  ok(res, db.update("subjects", req.params.id, patch));
});

app.delete("/api/subjects/:id", authenticate, requireRole("admin"), (req, res) => {
  const subject = db.getById("subjects", req.params.id);
  if (!subject) return bad(res, 404, "Mata pelajaran tidak ditemukan");
  cascadeDeleteSubject(req.params.id);
  ok(res, { success: true });
});

/* =====================================================================
 * JADWAL
 * ===================================================================== */

app.get("/api/schedules", authenticate, (req, res) => {
  const { classId } = req.query;
  let list = db.all("schedules");
  if (classId) list = list.filter((s) => s.classId === classId);
  // Batasi ke kelas yang boleh diakses pengguna.
  const classes = db.all("classes");
  list = list.filter((s) => {
    const cls = classes.find((c) => c.id === s.classId);
    return isMemberOfClass(req.user, cls);
  });
  const nameOf = (id) => (classes.find((c) => c.id === id) || {}).name || "?";
  const rooms = db.all("rooms");
  const roomOf = (id) => (rooms.find((r) => r.id === id) || {}).name || "";
  const subjects = db.all("subjects");
  const subjectOf = (id) =>
    (subjects.find((s) => s.id === id) || {}).name || "";
  const users = db.all("users");
  const userName = (id) => (users.find((u) => u.id === id) || {}).name || "";
  const teacherNamesOf = (subjectId) => {
    const subj = subjects.find((s) => s.id === subjectId);
    if (!subj) return "";
    return (subj.teacherIds || []).map(userName).filter(Boolean).join(", ");
  };
  ok(
    res,
    list.map((s) => ({
      ...s,
      className: nameOf(s.classId),
      roomName: roomOf(s.roomId),
      subjectName: subjectOf(s.subjectId),
      teacherNames: teacherNamesOf(s.subjectId),
    }))
  );
});

app.post("/api/schedules", authenticate, requireRole("admin"), (req, res) => {
  const { classId, title, day, startTime, endTime, note, roomId, subjectId } =
    req.body || {};
  if (!classId || !title || !day)
    return bad(res, 400, "classId, title, day wajib diisi");
  if (!db.getById("classes", classId)) return bad(res, 404, "Kelas tidak ditemukan");
  if (roomId && !db.getById("rooms", roomId))
    return bad(res, 404, "Ruangan tidak ditemukan");
  if (subjectId) {
    const subject = db.getById("subjects", subjectId);
    if (!subject) return bad(res, 404, "Mata pelajaran tidak ditemukan");
    if (subject.classId !== classId)
      return bad(res, 400, "Mata pelajaran bukan milik kelas ini");
  }
  const s = db.insert("schedules", {
    classId,
    title,
    day,
    startTime: startTime || "",
    endTime: endTime || "",
    note: note || "",
    roomId: roomId || "",
    subjectId: subjectId || "",
  });
  ok(res, s);
});

app.put("/api/schedules/:id", authenticate, requireRole("admin"), (req, res) => {
  const s = db.getById("schedules", req.params.id);
  if (!s) return bad(res, 404, "Jadwal tidak ditemukan");
  const patch = {};
  ["title", "day", "startTime", "endTime", "note", "roomId", "subjectId"].forEach(
    (k) => {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }
  );
  ok(res, db.update("schedules", req.params.id, patch));
});

app.delete("/api/schedules/:id", authenticate, requireRole("admin"), (req, res) => {
  const removed = db.remove("schedules", req.params.id);
  if (!removed) return bad(res, 404, "Jadwal tidak ditemukan");
  ok(res, { success: true });
});

/* =====================================================================
 * MATERI (pengajar unggah, semua anggota kelas melihat)
 * ===================================================================== */

// Kumpulan nomor pembelajaran yang DINONAKTIFKAN pada suatu mata pelajaran.
// Default: semua aktif (hanya yang bernilai active===false yang disembunyikan).
function inactiveLessonSet(subjectId) {
  const set = new Set();
  db.find(
    "lessonStates",
    (s) => s.subjectId === subjectId && s.active === false
  ).forEach((s) => set.add(Number(s.pertemuan)));
  return set;
}

app.get("/api/materials", authenticate, (req, res) => {
  const { subjectId } = req.query;
  if (!subjectId) return bad(res, 400, "subjectId wajib diisi");
  const subject = getSubjectOr404(req, res, subjectId);
  if (!subject) return;
  let list = db
    .find("materials", (m) => m.subjectId === subjectId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  // Siswa tidak melihat materi dari pembelajaran yang dinonaktifkan,
  // maupun materi yang dinonaktifkan secara individual (active===false).
  if (req.user.role === "student") {
    const inactive = inactiveLessonSet(subjectId);
    list = list.filter(
      (m) =>
        m.active !== false &&
        !inactive.has(Math.max(1, parseInt(m.pertemuan, 10) || 1))
    );
    // Sisipkan status pemahaman siswa: soal cek (tanpa kunci jawaban),
    // serta rekam hasil (skor & refleksi) miliknya sendiri.
    const myReads = db.find(
      "materialReads",
      (r) => r.studentId === req.user.id
    );
    list = list.map((m) => {
      const rec = myReads.find((r) => r.materialId === m.id);
      const cq = Array.isArray(m.checkQuestions)
        ? m.checkQuestions.map((q) => ({
            question: q.question,
            options: q.options,
          }))
        : [];
      return {
        ...m,
        checkQuestions: cq,
        hasCheck: cq.length > 0,
        askReflection: !!m.askReflection,
        reflectionPrompt: m.reflectionPrompt || "",
        read: !!(rec && rec.passed !== false),
        myComprehension: rec
          ? {
              score: rec.score || 0,
              total: rec.total || 0,
              passed: rec.passed !== false,
              reflection: rec.reflection || "",
              answers: Array.isArray(rec.answers) ? rec.answers : [],
              rating: rec.rating || "",
              ratingLabel: comprehensionRatingLabel(rec.rating || ""),
            }
          : null,
      };
    });
  }
  ok(res, list);
});

// Parse array dari field FormData (multipart) yang dikirim sbg JSON string
// atau nilai tunggal; mengembalikan array string bersih.
function parseFormArr(v) {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    try {
      const a = JSON.parse(v);
      if (Array.isArray(a))
        return a.map((s) => String(s).trim()).filter(Boolean);
    } catch {
      /* bukan JSON, perlakukan sbg nilai tunggal */
    }
    return [v.trim()];
  }
  return [];
}

// Ambang lulus cek pemahaman belajar mandiri (proporsi jawaban benar).
const COMPREHENSION_PASS_RATIO = 0.7;

// Penilaian pemahaman oleh guru (kualitatif).
const COMPREHENSION_RATINGS = ["sangat", "paham", "belum"];
function comprehensionRatingLabel(v) {
  return v === "sangat"
    ? "Sangat Paham"
    : v === "paham"
    ? "Paham"
    : v === "belum"
    ? "Belum Paham"
    : "";
}

// Bersihkan daftar soal "Cek Pemahaman" yang dikirim guru (JSON string / array).
// Format tersimpan: [{ question, options[], correct }].
function parseCheckQuestions(v) {
  let arr = [];
  if (Array.isArray(v)) arr = v;
  else if (typeof v === "string" && v.trim()) {
    try {
      const a = JSON.parse(v);
      if (Array.isArray(a)) arr = a;
    } catch {
      /* abaikan */
    }
  }
  return arr
    .map((q) => {
      const question = String((q && (q.question ?? q.q)) || "").trim();
      const options = Array.isArray(q && q.options)
        ? q.options.map((o) => String(o).trim()).filter(Boolean)
        : [];
      let correct = parseInt(q && q.correct, 10);
      if (!Number.isInteger(correct) || correct < 0 || correct >= options.length)
        correct = 0;
      return { question, options, correct };
    })
    .filter((q) => q.question && q.options.length >= 2)
    .slice(0, 10);
}

app.post(
  "/api/materials",
  authenticate,
  requireRole("teacher", "admin"),
  upload.single("file"),
  (req, res) => {
    const { subjectId, title, type, content, pertemuan } = req.body || {};
    if (!subjectId || !title || !type)
      return bad(res, 400, "subjectId, title, type wajib diisi");
    const subject = db.getById("subjects", subjectId);
    if (!subject) return bad(res, 404, "Mata pelajaran tidak ditemukan");
    if (!isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Anda bukan pengajar mata pelajaran ini");
    const material = {
      subjectId,
      classId: subject.classId,
      teacherId: req.user.id,
      teacherName: req.user.name,
      title,
      type, // text | image | video | presentation | document | link
      content: content || "",
      pertemuan: Math.max(1, parseInt(pertemuan, 10) || 1),
      submateri: parseFormArr(req.body.submateri),
      // Materi baru belum dibagikan; guru menekan "Bagikan" agar terlihat siswa.
      active: false,
    };
    if (req.body.checkQuestions !== undefined)
      material.checkQuestions = parseCheckQuestions(req.body.checkQuestions);
    if (req.body.askReflection !== undefined)
      material.askReflection =
        req.body.askReflection === "true" || req.body.askReflection === true;
    if (req.body.reflectionPrompt !== undefined)
      material.reflectionPrompt = String(req.body.reflectionPrompt).trim();
    if (req.file) {
      material.fileName = req.file.originalname;
      material.fileUrl = `/uploads/${req.file.filename}`;
      material.fileSize = req.file.size;
    }
    ok(res, db.insert("materials", material));
  }
);

app.put(
  "/api/materials/:id",
  authenticate,
  requireRole("teacher", "admin"),
  upload.single("file"),
  (req, res) => {
    const m = db.getById("materials", req.params.id);
    if (!m) return bad(res, 404, "Materi tidak ditemukan");
    if (req.user.role === "teacher" && m.teacherId !== req.user.id)
      return bad(res, 403, "Hanya pengajar pembuat yang dapat mengubah");
    const { title, type, content, pertemuan } = req.body || {};
    const patch = {};
    if (title !== undefined) patch.title = title;
    if (type !== undefined) patch.type = type;
    if (content !== undefined) patch.content = content;
    if (pertemuan !== undefined)
      patch.pertemuan = Math.max(1, parseInt(pertemuan, 10) || 1);
    if (req.body.submateri !== undefined)
      patch.submateri = parseFormArr(req.body.submateri);
    if (req.body.checkQuestions !== undefined)
      patch.checkQuestions = parseCheckQuestions(req.body.checkQuestions);
    if (req.body.askReflection !== undefined)
      patch.askReflection =
        req.body.askReflection === "true" || req.body.askReflection === true;
    if (req.body.reflectionPrompt !== undefined)
      patch.reflectionPrompt = String(req.body.reflectionPrompt).trim();
    if (req.file) {
      patch.fileName = req.file.originalname;
      patch.fileUrl = `/uploads/${req.file.filename}`;
      patch.fileSize = req.file.size;
    }
    ok(res, db.update("materials", req.params.id, patch));
  }
);

app.delete(
  "/api/materials/:id",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const m = db.getById("materials", req.params.id);
    if (!m) return bad(res, 404, "Materi tidak ditemukan");
    if (req.user.role === "teacher" && m.teacherId !== req.user.id)
      return bad(res, 403, "Hanya pengajar pembuat yang dapat menghapus");
    db.remove("materials", req.params.id);
    removeCommentsFor("material", req.params.id);
    ok(res, { success: true });
  }
);

/* =====================================================================
 * KURIKULUM — acuan per pertemuan (topik/kompetensi) per mata pelajaran.
 * Mengacu pada mata pelajaran (yang sudah membawa tahun akademik & semester).
 * Menjadi rujukan pembuatan materi, tugas, dan kuis.
 * ===================================================================== */
app.get("/api/curriculum", authenticate, (req, res) => {
  const { subjectId } = req.query;
  if (!subjectId) return bad(res, 400, "subjectId wajib diisi");
  const subject = getSubjectOr404(req, res, subjectId);
  if (!subject) return;
  const list = db
    .find("curriculum", (c) => c.subjectId === subjectId)
    .sort((a, b) => (a.pertemuan || 0) - (b.pertemuan || 0));
  ok(res, list);
});

// Kurikulum aktif (dari katalog) sesuai jenis kurikulum yang dipasang di kelas.
// Mengembalikan daftar indikator yang bisa dipetakan guru ke tiap pertemuan.
const CURRICULUM_LABELS = {
  merdeka: "Kurikulum Merdeka",
  k13: "Kurikulum 2013",
  ktsp2006: "KTSP 2006",
};
function extractIndicators(entry) {
  if (!entry) return [];
  const out = [];
  const clean = (v) => String(v || "").trim();
  if (entry.curriculumType === "merdeka") {
    (entry.tujuanPembelajaran || []).forEach((t) => {
      const label = clean(t);
      if (label) out.push({ group: "Tujuan Pembelajaran", label });
    });
    (entry.elemen || []).forEach((el) => {
      const label = clean(el.capaian);
      if (label)
        out.push({ group: `Elemen: ${clean(el.nama) || "Umum"}`, label });
    });
  } else if (entry.curriculumType === "k13") {
    (entry.kompetensiDasar || []).forEach((k) => {
      const label = `${k.kode ? clean(k.kode) + " " : ""}${clean(
        k.deskripsi
      )}`.trim();
      if (label) out.push({ group: "Kompetensi Dasar", label });
    });
  } else if (entry.curriculumType === "ktsp2006") {
    (entry.standarKompetensi || []).forEach((sk) => {
      (sk.kompetensiDasar || []).forEach((kd) => {
        const label = `${kd.kode ? clean(kd.kode) + " " : ""}${clean(
          kd.deskripsi
        )}`.trim();
        if (label)
          out.push({
            group: `SK ${clean(sk.kode)}`.trim() || "Kompetensi Dasar",
            label,
          });
      });
    });
  }
  return out;
}

app.get("/api/subjects/:id/active-curriculum", authenticate, (req, res) => {
  const subject = getSubjectOr404(req, res, req.params.id);
  if (!subject) return;
  const cls = db.getById("classes", subject.classId);
  const curriculumType = cls && cls.curriculumType ? cls.curriculumType : "";
  const semester = cls && cls.semester ? cls.semester : "";
  const kelasMatch = cls && cls.name ? String(cls.name).match(/\d+/) : null;
  const kelas = kelasMatch ? parseInt(kelasMatch[0], 10) : null;
  const mapel = subject.name || "";
  let entry = null;
  if (curriculumType) {
    ensureCurriculumCatalog();
    entry =
      db.findOne(
        "curriculumCatalog",
        (e) =>
          e.curriculumType === curriculumType &&
          String(e.kelas) === String(kelas) &&
          String(e.mapel).trim().toLowerCase() ===
            mapel.trim().toLowerCase() &&
          e.semester === semester
      ) || null;
  }
  const indicators = extractIndicators(entry).filter((i) => i.label);
  const clean = (v) => String(v || "").trim();
  const materiPokok = entry
    ? (entry.materiPokok || [])
        .map((m) => (m && typeof m === "object" ? clean(m.nama) : clean(m)))
        .filter(Boolean)
    : [];
  const tema = entry ? (entry.tema || []).map(clean).filter(Boolean) : [];
  // Rincian materi pokok lengkap (nama + JP + submateri) untuk sisi guru,
  // agar pembuatan materi dapat menyesuaikan struktur kurikulum.
  const materiDetail = entry
    ? (entry.materiPokok || [])
        .filter((m) => m && typeof m === "object" && clean(m.nama))
        .map((m) => ({
          nama: clean(m.nama),
          jp: Number(m.jp) || 0,
          submateri: (m.submateri || [])
            .map((s) =>
              s && typeof s === "object"
                ? {
                    nama: clean(s.nama),
                    jp: Number(s.jp) || 0,
                    bahanAjar: s.bahanAjar ? String(s.bahanAjar) : "",
                  }
                : { nama: clean(s), jp: 0, bahanAjar: "" }
            )
            .filter((s) => s.nama),
        }))
    : [];
  ok(res, {
    curriculumType,
    curriculumLabel: CURRICULUM_LABELS[curriculumType] || "",
    kelas,
    mapel,
    semester,
    matched: !!entry,
    indicators,
    materiPokok,
    materiDetail,
    tema,
  });
});

app.post(
  "/api/curriculum",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const { subjectId, pertemuan, topic, description, indicators, materiPokok, submateri, tema } =
      req.body || {};
    if (!subjectId || !topic)
      return bad(res, 400, "subjectId dan topik wajib diisi");
    const subject = db.getById("subjects", subjectId);
    if (!subject) return bad(res, 404, "Mata pelajaran tidak ditemukan");
    if (!isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Anda bukan pengajar mata pelajaran ini");
    const cleanArr = (v) =>
      Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : [];
    const item = {
      subjectId,
      classId: subject.classId,
      pertemuan: Math.max(1, parseInt(pertemuan, 10) || 1),
      topic,
      description: description || "",
      indicators: cleanArr(indicators),
      materiPokok: cleanArr(materiPokok),
      submateri: cleanArr(submateri),
      tema: cleanArr(tema),
    };
    ok(res, db.insert("curriculum", item));
  }
);

app.put(
  "/api/curriculum/:id",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const item = db.getById("curriculum", req.params.id);
    if (!item) return bad(res, 404, "Kurikulum tidak ditemukan");
    const subject = db.getById("subjects", item.subjectId);
    if (!subject || !isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Anda bukan pengajar mata pelajaran ini");
    const { pertemuan, topic, description, indicators, materiPokok, submateri, tema } =
      req.body || {};
    const cleanArr = (v) =>
      Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : [];
    const patch = {};
    if (pertemuan !== undefined)
      patch.pertemuan = Math.max(1, parseInt(pertemuan, 10) || 1);
    if (topic !== undefined) patch.topic = topic;
    if (description !== undefined) patch.description = description;
    if (indicators !== undefined) patch.indicators = cleanArr(indicators);
    if (materiPokok !== undefined) patch.materiPokok = cleanArr(materiPokok);
    if (submateri !== undefined) patch.submateri = cleanArr(submateri);
    if (tema !== undefined) patch.tema = cleanArr(tema);
    ok(res, db.update("curriculum", req.params.id, patch));
  }
);

app.delete(
  "/api/curriculum/:id",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const item = db.getById("curriculum", req.params.id);
    if (!item) return bad(res, 404, "Kurikulum tidak ditemukan");
    const subject = db.getById("subjects", item.subjectId);
    if (subject && req.user.role === "teacher" && !isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Anda bukan pengajar mata pelajaran ini");
    db.remove("curriculum", req.params.id);
    ok(res, { success: true });
  }
);

/* =====================================================================
 * PEMBELAJARAN — status aktif/nonaktif per nomor pembelajaran.
 * Bila dinonaktifkan, materi pembelajaran itu disembunyikan dari siswa.
 * Default (tanpa catatan) = aktif.
 * ===================================================================== */
app.get("/api/lesson-states", authenticate, (req, res) => {
  const { subjectId } = req.query;
  if (!subjectId) return bad(res, 400, "subjectId wajib diisi");
  const subject = getSubjectOr404(req, res, subjectId);
  if (!subject) return;
  const list = db
    .find("lessonStates", (s) => s.subjectId === subjectId)
    .sort((a, b) => (a.pertemuan || 0) - (b.pertemuan || 0));
  ok(res, list);
});

app.put(
  "/api/lesson-states",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const { subjectId, pertemuan, active } = req.body || {};
    if (!subjectId) return bad(res, 400, "subjectId wajib diisi");
    const subject = db.getById("subjects", subjectId);
    if (!subject) return bad(res, 404, "Mata pelajaran tidak ditemukan");
    if (!isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Anda bukan pengajar mata pelajaran ini");
    const p = Math.max(1, parseInt(pertemuan, 10) || 1);
    const nextActive = active !== false && active !== "false";
    const existing = db.find(
      "lessonStates",
      (s) => s.subjectId === subjectId && Number(s.pertemuan) === p
    )[0];
    const wasActive = existing ? existing.active !== false : true;
    let result;
    if (existing) {
      result = db.update("lessonStates", existing.id, { active: nextActive });
    } else {
      result = db.insert("lessonStates", {
        subjectId,
        classId: subject.classId,
        pertemuan: p,
        active: nextActive,
      });
    }
    // Kirim notifikasi ke siswa hanya saat pembelajaran DIAKTIFKAN (dari nonaktif).
    if (nextActive && !wasActive) {
      notifySubjectStudents(
        subject,
        `Pembelajaran ${p} pada ${subject.name} telah diaktifkan.`
      );
    }
    ok(res, result);
  }
);

/* =====================================================================
 * SELESAI MATERI — pengajar menandai sebuah materi "telah selesai".
 * Ditandai pada materi (bukan per-siswa); siswa hanya melihat status.
 * ===================================================================== */
app.put(
  "/api/materials/:id/complete",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const material = db.getById("materials", req.params.id);
    if (!material) return bad(res, 404, "Materi tidak ditemukan");
    const subject = db.getById("subjects", material.subjectId);
    if (!subject || !isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Bukan anggota mata pelajaran ini");
    const { done } = req.body || {};
    const nextDone = done !== false && done !== "false";
    ok(
      res,
      db.update("materials", req.params.id, {
        completed: nextDone,
        completedAt: nextDone ? new Date().toISOString() : "",
      })
    );
  }
);

// Pengajar mengaktifkan / menonaktifkan sebuah materi secara individual.
// Materi yang nonaktif (active===false) tidak terlihat oleh siswa.
app.put(
  "/api/materials/:id/active",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const material = db.getById("materials", req.params.id);
    if (!material) return bad(res, 404, "Materi tidak ditemukan");
    const subject = db.getById("subjects", material.subjectId);
    if (!subject || !isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Bukan anggota mata pelajaran ini");
    const { active } = req.body || {};
    const nextActive = active !== false && active !== "false";
    ok(res, db.update("materials", req.params.id, { active: nextActive }));
  }
);

// Tampilkan / sembunyikan materi khusus di menu Belajar Mandiri siswa.
// Berbeda dari 'active': materi tetap tampil di tab Materi biasa.
app.put(
  "/api/materials/:id/self-learn",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const material = db.getById("materials", req.params.id);
    if (!material) return bad(res, 404, "Materi tidak ditemukan");
    const subject = db.getById("subjects", material.subjectId);
    if (!subject || !isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Bukan anggota mata pelajaran ini");
    const { selfLearn } = req.body || {};
    const next = selfLearn !== false && selfLearn !== "false";
    ok(res, db.update("materials", req.params.id, { selfLearn: next }));
  }
);

// Siswa menandai (atau membatalkan) "sudah saya pahami" sebuah materi.
// Ini adalah progres belajar mandiri milik tiap siswa (bukan tanda dari guru).
app.put(
  "/api/materials/:id/read",
  authenticate,
  requireRole("student"),
  (req, res) => {
    const material = db.getById("materials", req.params.id);
    if (!material) return bad(res, 404, "Materi tidak ditemukan");
    const subject = db.getById("subjects", material.subjectId);
    if (!subject || !isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Bukan anggota mata pelajaran ini");
    const { done } = req.body || {};
    const nextDone = done !== false && done !== "false";
    const existing = db.findOne(
      "materialReads",
      (r) => r.studentId === req.user.id && r.materialId === material.id
    );
    if (nextDone && !existing) {
      db.insert("materialReads", {
        studentId: req.user.id,
        materialId: material.id,
        subjectId: material.subjectId,
        classId: material.classId || subject.classId,
        score: 0,
        total: 0,
        passed: true,
      });
    } else if (nextDone && existing) {
      db.update("materialReads", existing.id, { passed: true });
    } else if (!nextDone && existing) {
      db.remove("materialReads", existing.id);
    }
    ok(res, { materialId: material.id, read: nextDone });
  }
);

// Siswa mengirim jawaban "Cek Pemahaman" (kuis mini) + refleksi singkat.
// Skor otomatis mengukur pemahaman; materi dianggap dipahami bila lulus ambang.
app.put(
  "/api/materials/:id/comprehension",
  authenticate,
  requireRole("student"),
  (req, res) => {
    const material = db.getById("materials", req.params.id);
    if (!material) return bad(res, 404, "Materi tidak ditemukan");
    const subject = db.getById("subjects", material.subjectId);
    if (!subject || !isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Bukan anggota mata pelajaran ini");

    const questions = Array.isArray(material.checkQuestions)
      ? material.checkQuestions
      : [];
    let answers = req.body && req.body.answers;
    if (typeof answers === "string") {
      try {
        answers = JSON.parse(answers);
      } catch {
        answers = [];
      }
    }
    if (!Array.isArray(answers)) answers = [];
    const reflection = String((req.body && req.body.reflection) || "").trim();

    const total = questions.length;
    let score = 0;
    questions.forEach((q, i) => {
      if (parseInt(answers[i], 10) === q.correct) score += 1;
    });

    // Lulus bila: skor kuis memenuhi ambang; bila tanpa kuis, cukup refleksi.
    const passed =
      total > 0
        ? score / total >= COMPREHENSION_PASS_RATIO
        : reflection.length > 0;

    if (material.askReflection && reflection.length === 0)
      return bad(res, 400, "Refleksi wajib diisi");
    if (total > 0 && answers.length < total)
      return bad(res, 400, "Semua soal wajib dijawab");

    const existing = db.findOne(
      "materialReads",
      (r) => r.studentId === req.user.id && r.materialId === material.id
    );
    const payload = {
      studentId: req.user.id,
      materialId: material.id,
      subjectId: material.subjectId,
      classId: material.classId || subject.classId,
      score,
      total,
      passed,
      reflection,
      answers: answers.map((a) => parseInt(a, 10)),
      submittedAt: new Date().toISOString(),
    };
    if (existing) db.update("materialReads", existing.id, payload);
    else db.insert("materialReads", payload);

    ok(res, {
      materialId: material.id,
      score,
      total,
      passed,
      percent: total > 0 ? Math.round((score / total) * 100) : null,
    });
  }
);

// Pengajar menilai pemahaman siswa (Sangat Paham / Paham / Belum Paham)
// atas tes pemahaman belajar mandiri sebuah materi.
app.put(
  "/api/materials/:id/comprehension-rating",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const material = db.getById("materials", req.params.id);
    if (!material) return bad(res, 404, "Materi tidak ditemukan");
    const subject = db.getById("subjects", material.subjectId);
    if (req.user.role === "teacher" && !isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Anda bukan pengajar mata pelajaran ini");
    const { studentId } = req.body || {};
    if (!studentId) return bad(res, 400, "studentId wajib diisi");
    const rating = String((req.body && req.body.rating) || "").trim();
    if (rating !== "" && !COMPREHENSION_RATINGS.includes(rating))
      return bad(res, 400, "Nilai pemahaman tidak valid");
    const rec = db.findOne(
      "materialReads",
      (r) => r.studentId === studentId && r.materialId === material.id
    );
    if (!rec)
      return bad(res, 404, "Siswa belum mengerjakan tes pemahaman ini");
    const saved = db.update("materialReads", rec.id, {
      rating,
      ratedBy: rating ? req.user.name : "",
      ratedAt: rating ? new Date().toISOString() : "",
    });
    if (rating)
      db.insert("notifications", {
        userId: studentId,
        text: `Pemahaman Anda pada "${material.title}" dinilai: ${comprehensionRatingLabel(
          rating
        )}`,
        classId: material.classId || (subject && subject.classId),
        subjectId: material.subjectId,
        read: false,
      });
    ok(res, {
      materialId: material.id,
      studentId,
      rating: saved.rating || "",
      ratingLabel: comprehensionRatingLabel(saved.rating || ""),
    });
  }
);

/* =====================================================================
 * KOMENTAR — pada materi, tugas, dan kuis.
 * ===================================================================== */
const COMMENT_TARGETS = {
  material: "materials",
  assignment: "assignments",
  quiz: "quizzes",
};

function removeCommentsFor(targetType, targetId) {
  db.find(
    "comments",
    (c) => c.targetType === targetType && c.targetId === targetId
  ).forEach((c) => db.remove("comments", c.id));
}

app.get("/api/comments", authenticate, (req, res) => {
  const { targetType, targetId } = req.query;
  const col = COMMENT_TARGETS[targetType];
  if (!col || !targetId)
    return bad(res, 400, "targetType & targetId wajib diisi");
  const target = db.getById(col, targetId);
  if (!target) return bad(res, 404, "Konten tidak ditemukan");
  const subject = getSubjectOr404(req, res, target.subjectId);
  if (!subject) return;
  const list = db
    .find(
      "comments",
      (c) => c.targetType === targetType && c.targetId === targetId
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  ok(res, list);
});

app.post("/api/comments", authenticate, (req, res) => {
  const { targetType, targetId, text } = req.body || {};
  const col = COMMENT_TARGETS[targetType];
  if (!col || !targetId || !text || !String(text).trim())
    return bad(res, 400, "targetType, targetId, text wajib diisi");
  const target = db.getById(col, targetId);
  if (!target) return bad(res, 404, "Konten tidak ditemukan");
  const subject = db.getById("subjects", target.subjectId);
  if (!isMemberOfSubject(req.user, subject))
    return bad(res, 403, "Bukan anggota mata pelajaran");
  const created = db.insert("comments", {
    targetType,
    targetId,
    subjectId: target.subjectId,
    classId: subject.classId,
    authorId: req.user.id,
    authorName: req.user.name,
    authorRole: req.user.role,
    text: String(text).trim(),
  });
  ok(res, created);
});

app.delete("/api/comments/:id", authenticate, (req, res) => {
  const c = db.getById("comments", req.params.id);
  if (!c) return bad(res, 404, "Komentar tidak ditemukan");
  const subject = db.getById("subjects", c.subjectId);
  const isTeacher =
    req.user.role === "teacher" && isMemberOfSubject(req.user, subject);
  if (c.authorId !== req.user.id && req.user.role !== "admin" && !isTeacher)
    return bad(res, 403, "Tidak boleh menghapus komentar ini");
  db.remove("comments", req.params.id);
  ok(res, { success: true });
});

/* =====================================================================
 * TUGAS & PENILAIAN
 * ===================================================================== */

app.get("/api/assignments", authenticate, (req, res) => {
  const { subjectId } = req.query;
  if (!subjectId) return bad(res, 400, "subjectId wajib diisi");
  const subject = getSubjectOr404(req, res, subjectId);
  if (!subject) return;
  const hide = req.user.role === "student";
  const list = db
    .find("assignments", (a) => a.subjectId === subjectId)
    .filter((a) => !hide || a.active !== false)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  ok(res, list);
});

// Normalisasi daftar tahapan proyek menjadi array {id,title,description}.
function normalizeStages(raw) {
  let arr = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      arr = [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => ({
      id: s && s.id ? String(s.id) : db.id(),
      title: String((s && s.title) || "").trim(),
      description: String((s && s.description) || "").trim(),
    }))
    .filter((s) => s.title);
}

app.post(
  "/api/assignments",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const { subjectId, title, description, dueDate, pertemuan, type, stages, materialId } = req.body || {};
    if (!subjectId || !title) return bad(res, 400, "subjectId & title wajib diisi");
    const subject = db.getById("subjects", subjectId);
    if (!subject) return bad(res, 404, "Mata pelajaran tidak ditemukan");
    if (!isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Anda bukan pengajar mata pelajaran ini");
    const created = db.insert("assignments", {
      subjectId,
      classId: subject.classId,
      teacherId: req.user.id,
      teacherName: req.user.name,
      title,
      type: type || "",
      description: description || "",
      dueDate: dueDate || "",
      materialId: materialId || "",
      stages: normalizeStages(stages),
      pertemuan: Math.max(1, parseInt(pertemuan, 10) || 1),
      // Tugas baru belum dibagikan; guru menekan 'Bagikan' agar terlihat siswa.
      active: false,
      completed: false,
    });
    notifySubjectStudents(
      subject,
      `Tugas baru: "${title}" pada ${subject.name}`
    );
    ok(res, created);
  }
);

app.put(
  "/api/assignments/:id",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const a = db.getById("assignments", req.params.id);
    if (!a) return bad(res, 404, "Tugas tidak ditemukan");
    if (req.user.role === "teacher" && a.teacherId !== req.user.id)
      return bad(res, 403, "Hanya pengajar pembuat yang dapat mengubah");
    const { title, description, dueDate, pertemuan, type, stages, materialId } = req.body || {};
    const patch = {};
    if (title !== undefined) patch.title = title;
    if (type !== undefined) patch.type = type;
    if (description !== undefined) patch.description = description;
    if (dueDate !== undefined) patch.dueDate = dueDate;
    if (materialId !== undefined) patch.materialId = materialId;
    if (stages !== undefined) patch.stages = normalizeStages(stages);
    if (pertemuan !== undefined)
      patch.pertemuan = Math.max(1, parseInt(pertemuan, 10) || 1);
    ok(res, db.update("assignments", req.params.id, patch));
  }
);

app.delete(
  "/api/assignments/:id",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const a = db.getById("assignments", req.params.id);
    if (!a) return bad(res, 404, "Tugas tidak ditemukan");
    if (req.user.role === "teacher" && a.teacherId !== req.user.id)
      return bad(res, 403, "Hanya pengajar pembuat yang dapat menghapus");
    db.find("submissions", (s) => s.assignmentId === a.id).forEach((s) =>
      db.remove("submissions", s.id)
    );
    db.remove("assignments", req.params.id);
    removeCommentsFor("assignment", req.params.id);
    ok(res, { success: true });
  }
);

// Pengajar membagikan / menyembunyikan sebuah tugas dari siswa.
// Tugas nonaktif (active===false) tidak terlihat oleh siswa.
app.put(
  "/api/assignments/:id/active",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const a = db.getById("assignments", req.params.id);
    if (!a) return bad(res, 404, "Tugas tidak ditemukan");
    if (req.user.role === "teacher" && a.teacherId !== req.user.id)
      return bad(res, 403, "Hanya pengajar pembuat yang dapat mengubah");
    const { active } = req.body || {};
    const nextActive = active !== false && active !== "false";
    ok(res, db.update("assignments", req.params.id, { active: nextActive }));
  }
);

// Pengajar menandai (atau membatalkan) sebuah tugas "telah selesai".
app.put(
  "/api/assignments/:id/complete",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const a = db.getById("assignments", req.params.id);
    if (!a) return bad(res, 404, "Tugas tidak ditemukan");
    if (req.user.role === "teacher" && a.teacherId !== req.user.id)
      return bad(res, 403, "Hanya pengajar pembuat yang dapat mengubah");
    const { done } = req.body || {};
    const nextDone = done !== false && done !== "false";
    ok(
      res,
      db.update("assignments", req.params.id, {
        completed: nextDone,
        completedAt: nextDone ? new Date().toISOString() : "",
      })
    );
  }
);

// Daftar pengumpulan sebuah tugas (pengajar melihat semua, pelajar melihat miliknya).
app.get("/api/submissions", authenticate, (req, res) => {
  const { assignmentId } = req.query;
  if (!assignmentId) return bad(res, 400, "assignmentId wajib diisi");
  const assignment = db.getById("assignments", assignmentId);
  if (!assignment) return bad(res, 404, "Tugas tidak ditemukan");
  const subject = db.getById("subjects", assignment.subjectId);
  if (!isMemberOfSubject(req.user, subject))
    return bad(res, 403, "Bukan anggota mata pelajaran");
  let list = db.find("submissions", (s) => s.assignmentId === assignmentId);
  if (req.user.role === "student")
    list = list.filter((s) => s.studentId === req.user.id);
  const users = db.all("users");
  const nameOf = (id) => (users.find((u) => u.id === id) || {}).name || "?";
  ok(res, list.map((s) => ({ ...s, studentName: nameOf(s.studentId) })));
});

// Pelajar mengumpulkan tugas.
app.post(
  "/api/submissions",
  authenticate,
  requireRole("student"),
  upload.any(),
  (req, res) => {
    const { assignmentId, text } = req.body || {};
    if (!assignmentId) return bad(res, 400, "assignmentId wajib diisi");
    const assignment = db.getById("assignments", assignmentId);
    if (!assignment) return bad(res, 404, "Tugas tidak ditemukan");
    const subject = db.getById("subjects", assignment.subjectId);
    if (!isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Anda tidak terdaftar di mata pelajaran ini");
    // Tolak bila batas waktu pengumpulan telah lewat (akhir hari batas).
    if (assignment.dueDate) {
      const deadline = new Date(assignment.dueDate + "T23:59:59");
      if (!isNaN(deadline.getTime()) && deadline < new Date())
        return bad(res, 403, "Batas waktu pengumpulan telah lewat");
    }
    // Satu pelajar satu pengumpilan (perbarui bila sudah ada).
    const existing = db.findOne(
      "submissions",
      (s) => s.assignmentId === assignmentId && s.studentId === req.user.id
    );
    // Tahapan proyek yang telah diselesaikan siswa (dikirim sebagai JSON).
    let stagesDone = [];
    try {
      stagesDone = JSON.parse(req.body.stagesDone || "[]");
    } catch {
      stagesDone = [];
    }
    if (!Array.isArray(stagesDone)) stagesDone = [];
    stagesDone = stagesDone.map(String);
    // Verifikasi bertahap: siswa hanya boleh menandai sebuah tahapan selesai
    // bila SEMUA tahapan sebelumnya telah diverifikasi oleh guru.
    if (
      assignment.type === "Proyek" &&
      Array.isArray(assignment.stages) &&
      assignment.stages.length
    ) {
      const verify = (existing && existing.stageVerify) || {};
      const sList = assignment.stages;
      for (let i = 0; i < sList.length; i++) {
        const id = String(sList[i].id);
        if (stagesDone.includes(id)) {
          for (let j = 0; j < i; j++) {
            if (!verify[String(sList[j].id)])
              return bad(
                res,
                400,
                "Tahapan sebelumnya belum diverifikasi guru"
              );
          }
        }
      }
    }
    // Bila tugas proyek memiliki materi terkait, materi wajib dipahami dulu.
    if (assignment.type === "Proyek" && assignment.materialId) {
      if (!stagesDone.includes("__material__"))
        return bad(
          res,
          400,
          "Pahami materi terlebih dahulu sebelum mengumpulkan"
        );
    }
    const data = {
      assignmentId,
      studentId: req.user.id,
      text: text || "",
      stagesDone,
      submittedAt: new Date().toISOString(),
    };
    // Pertahankan status verifikasi tahapan (dikontrol oleh guru).
    if (existing && existing.stageVerify) data.stageVerify = existing.stageVerify;
    const files = Array.isArray(req.files) ? req.files : [];
    const mainFile = files.find((f) => f.fieldname === "file");
    if (mainFile) {
      data.fileName = mainFile.originalname;
      data.fileUrl = `/uploads/${mainFile.filename}`;
    } else if (existing && existing.fileUrl) {
      // Pertahankan berkas utama sebelumnya bila tidak diunggah ulang.
      data.fileName = existing.fileName;
      data.fileUrl = existing.fileUrl;
    }
    // Catatan per tahapan (teks + foto/video). Digabung dengan data lama.
    let stageNotes = {};
    try {
      stageNotes = JSON.parse(req.body.stageNotes || "{}");
    } catch {
      stageNotes = {};
    }
    if (Array.isArray(assignment.stages) && assignment.stages.length) {
      const prev = (existing && existing.stageData) || {};
      const stageData = {};
      for (const st of assignment.stages) {
        const id = String(st.id);
        const p = prev[id] || {};
        const entry = {
          text:
            typeof stageNotes[id] === "string" ? stageNotes[id] : p.text || "",
          fileName: p.fileName || "",
          fileUrl: p.fileUrl || "",
        };
        const sf = files.find((f) => f.fieldname === `stagefile_${id}`);
        if (sf) {
          entry.fileName = sf.originalname;
          entry.fileUrl = `/uploads/${sf.filename}`;
        }
        stageData[id] = entry;
      }
      data.stageData = stageData;
    }
    if (existing) {
      ok(res, db.update("submissions", existing.id, data));
    } else {
      ok(res, db.insert("submissions", data));
    }
  }
);

// Pengajar memberi nilai.
app.put(
  "/api/submissions/:id/grade",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const sub = db.getById("submissions", req.params.id);
    if (!sub) return bad(res, 404, "Pengumpulan tidak ditemukan");
    const assignment = db.getById("assignments", sub.assignmentId);
    const subject = db.getById("subjects", assignment ? assignment.subjectId : null);
    if (req.user.role === "teacher" && !isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Anda bukan pengajar mata pelajaran ini");
    const { grade, feedback } = req.body || {};
    ok(
      res,
      db.update("submissions", req.params.id, {
        grade: grade !== undefined ? grade : sub.grade,
        feedback: feedback !== undefined ? feedback : sub.feedback,
        gradedAt: new Date().toISOString(),
        gradedBy: req.user.name,
      })
    );
  }
);

// Pengajar memverifikasi (atau membatalkan) sebuah tahapan proyek.
app.put(
  "/api/submissions/:id/stage-verify",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const sub = db.getById("submissions", req.params.id);
    if (!sub) return bad(res, 404, "Pengumpulan tidak ditemukan");
    const assignment = db.getById("assignments", sub.assignmentId);
    const subject = db.getById(
      "subjects",
      assignment ? assignment.subjectId : null
    );
    if (req.user.role === "teacher" && !isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Anda bukan pengajar mata pelajaran ini");
    const { stageId, verified } = req.body || {};
    if (!stageId) return bad(res, 400, "stageId wajib diisi");
    const stageVerify = { ...(sub.stageVerify || {}) };
    if (verified) {
      stageVerify[String(stageId)] = {
        verifiedAt: new Date().toISOString(),
        verifiedBy: req.user.name,
      };
    } else {
      delete stageVerify[String(stageId)];
    }
    ok(res, db.update("submissions", req.params.id, { stageVerify }));
  }
);

/* =====================================================================
 * REKAP NILAI (gradebook) per mata pelajaran
 * ===================================================================== */

app.get(
  "/api/subjects/:id/gradebook",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const subject = db.getById("subjects", req.params.id);
    if (!subject) return bad(res, 404, "Mata pelajaran tidak ditemukan");
    if (!isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Anda bukan pengajar mata pelajaran ini");
    const cls = db.getById("classes", subject.classId);

    const users = db.all("users");
    const nameOf = (id) => (users.find((u) => u.id === id) || {}).name || "?";
    const students = ((cls && cls.studentIds) || []).map((id) => ({
      id,
      name: nameOf(id),
    }));

    const assignments = db
      .find("assignments", (a) => a.subjectId === subject.id)
      .map((a) => ({ id: a.id, title: a.title, kind: "assignment" }));
    const quizzes = db
      .find("quizzes", (q) => q.subjectId === subject.id)
      .map((q) => ({
        id: q.id,
        title: q.title,
        kind: "quiz",
        total: (q.questions || []).length,
      }));

    // Nilai tugas.
    const subs = db.all("submissions");
    const results = db.all("quizResults");
    const assessments = db.all("assessments");

    const rows = students.map((s) => {
      const cells = {};
      let asgSum = 0;
      let asgN = 0;
      assignments.forEach((a) => {
        const sub = subs.find(
          (x) => x.assignmentId === a.id && x.studentId === s.id
        );
        const raw =
          sub && sub.grade !== undefined && sub.grade !== "" ? sub.grade : null;
        cells[a.id] = raw !== null ? String(raw) : sub ? "—" : "";
        const num = raw !== null ? Number(raw) : NaN;
        if (Number.isFinite(num)) {
          asgSum += num;
          asgN++;
        }
      });
      let quizSum = 0;
      let quizN = 0;
      quizzes.forEach((q) => {
        const r = results.find(
          (x) => x.quizId === q.id && x.studentId === s.id
        );
        cells[q.id] = r ? `${r.score}/${r.total}` : "";
        if (r && r.total > 0) {
          quizSum += (r.score / r.total) * 100;
          quizN++;
        }
      });
      const avgAssignment = asgN ? Math.round((asgSum / asgN) * 10) / 10 : null;
      const avgQuiz = quizN ? Math.round((quizSum / quizN) * 10) / 10 : null;
      const asmt =
        assessments.find(
          (x) => x.subjectId === subject.id && x.studentId === s.id
        ) || {};
      return {
        studentId: s.id,
        name: s.name,
        cells,
        avgAssignment,
        avgQuiz,
        sikap: asmt.sikap || "",
        lulus: asmt.lulus || "",
      };
    });

    ok(res, { columns: [...assignments, ...quizzes], rows });
  }
);

/* =====================================================================
 * PANTAU BELAJAR MANDIRI — untuk pengajar.
 * Menampilkan materi mana yang sudah "dipahami" tiap siswa (materialReads),
 * sehingga guru tahu keaktifan belajar mandiri siswa.
 * ===================================================================== */
app.get(
  "/api/subjects/:id/learning-progress",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const subject = db.getById("subjects", req.params.id);
    if (!subject) return bad(res, 404, "Mata pelajaran tidak ditemukan");
    if (req.user.role === "teacher" && !isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Anda bukan pengajar mata pelajaran ini");
    const cls = db.getById("classes", subject.classId);

    const users = db.all("users");
    const nameOf = (id) => (users.find((u) => u.id === id) || {}).name || "?";
    const studentIds = (cls && cls.studentIds) || [];

    // Materi yang terlihat siswa (aktif + pembelajaran aktif) — konsisten
    // dengan dasbor belajar mandiri siswa.
    const inactive = inactiveLessonSet(subject.id);
    const materials = db
      .find("materials", (m) => m.subjectId === subject.id)
      .filter(
        (m) =>
          m.active !== false &&
          !inactive.has(Math.max(1, parseInt(m.pertemuan, 10) || 1))
      )
      .sort((a, b) => {
        const pa = parseInt(a.pertemuan, 10) || 0;
        const pb = parseInt(b.pertemuan, 10) || 0;
        if (pa !== pb) return pa - pb;
        return a.createdAt < b.createdAt ? -1 : 1;
      });

    const reads = db.find(
      "materialReads",
      (r) => r.subjectId === subject.id
    );
    // Anggap "dipahami" hanya bila lulus (passed !== false). Rekam legacy
    // tanpa field passed diperlakukan sbg lulus.
    const isPassed = (r) => r.passed !== false;
    // Peta: materialId -> Set(studentId), dan studentId -> {count, lastAt}.
    const readByMaterial = new Map();
    const readByStudent = new Map();
    reads.forEach((r) => {
      if (!isPassed(r)) return;
      if (!readByMaterial.has(r.materialId))
        readByMaterial.set(r.materialId, new Set());
      readByMaterial.get(r.materialId).add(r.studentId);
      const cur = readByStudent.get(r.studentId) || { count: 0, lastAt: "" };
      cur.count += 1;
      const at = r.submittedAt || r.createdAt || "";
      if (at > cur.lastAt) cur.lastAt = at;
      readByStudent.set(r.studentId, cur);
    });

    // Rata-rata skor kuis per materi (hanya dari siswa yang mengerjakan kuis).
    const materialCols = materials.map((m) => {
      const attempts = reads.filter(
        (r) => r.materialId === m.id && (r.total || 0) > 0
      );
      const avgScorePct = attempts.length
        ? Math.round(
            (attempts.reduce((s, r) => s + (r.score || 0) / r.total, 0) /
              attempts.length) *
              100
          )
        : null;
      return {
        id: m.id,
        title: m.title,
        pertemuan: Math.max(1, parseInt(m.pertemuan, 10) || 1),
        readCount: (readByMaterial.get(m.id) || new Set()).size,
        hasCheck: Array.isArray(m.checkQuestions) && m.checkQuestions.length > 0,
        avgScorePct,
      };
    });

    const total = materials.length;
    const students = studentIds
      .map((id) => {
        const myReads = reads.filter((r) => r.studentId === id);
        const passedSet = new Set(
          myReads.filter(isPassed).map((r) => r.materialId)
        );
        // Hanya hitung materi yang masih terlihat.
        const done = materials.filter((m) => passedSet.has(m.id)).length;
        const info = readByStudent.get(id) || { lastAt: "" };
        // Rincian per materi terlihat: status + skor + refleksi (bila ada).
        const records = materials
          .map((m) => {
            const rec = myReads.find((r) => r.materialId === m.id);
            if (!rec) return null;
            return {
              materialId: m.id,
              title: m.title,
              pertemuan: Math.max(1, parseInt(m.pertemuan, 10) || 1),
              passed: isPassed(rec),
              score: rec.score || 0,
              total: rec.total || 0,
              reflection: rec.reflection || "",
              rating: rec.rating || "",
              ratingLabel: comprehensionRatingLabel(rec.rating || ""),
            };
          })
          .filter(Boolean);
        return {
          studentId: id,
          name: nameOf(id),
          done,
          total,
          percent: total > 0 ? Math.round((done / total) * 100) : 0,
          lastReadAt: info.lastAt || "",
          readMaterialIds: materials
            .filter((m) => passedSet.has(m.id))
            .map((m) => m.id),
          records,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "id", { numeric: true }));

    ok(res, {
      subjectId: subject.id,
      subjectName: subject.name,
      className: cls ? cls.name : "",
      materialsTotal: total,
      materials: materialCols,
      students,
    });
  }
);

app.put(
  "/api/subjects/:id/assessment",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const subject = db.getById("subjects", req.params.id);
    if (!subject) return bad(res, 404, "Mata pelajaran tidak ditemukan");
    if (req.user.role === "teacher" && !isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Anda bukan pengajar mata pelajaran ini");
    const { studentId, sikap, lulus } = req.body || {};
    if (!studentId) return bad(res, 400, "studentId wajib diisi");
    const SIKAP = ["", "A", "B", "C", "D"];
    const LULUS = ["", "lulus", "tidak"];
    const patch = { updatedBy: req.user.name, updatedAt: new Date().toISOString() };
    if (sikap !== undefined) patch.sikap = SIKAP.includes(sikap) ? sikap : "";
    if (lulus !== undefined) patch.lulus = LULUS.includes(lulus) ? lulus : "";
    const existing = db.findOne(
      "assessments",
      (x) => x.subjectId === subject.id && x.studentId === studentId
    );
    const saved = existing
      ? db.update("assessments", existing.id, patch)
      : db.insert("assessments", {
          subjectId: subject.id,
          studentId,
          sikap: patch.sikap || "",
          lulus: patch.lulus || "",
          updatedBy: patch.updatedBy,
          updatedAt: patch.updatedAt,
        });
    ok(res, saved);
  }
);


/* =====================================================================
 * RAPOR NILAI PELAJAR (rekap nilai milik siswa yang login)
 * Mengumpulkan nilai tugas & kuis di seluruh kelas/periode.
 * ===================================================================== */

app.get(
  "/api/my-grades",
  authenticate,
  requireRole("student"),
  (req, res) => {
    const activeYearId = getActiveYearId();
    const activeSemester = getActiveSemester();
    const years = db.all("academicYears");
    const users = db.all("users");
    const yearNameOf = (yid) =>
      (years.find((y) => y.id === yid) || {}).name || "\u2014";
    const nameOf = (uid) => (users.find((u) => u.id === uid) || {}).name || "?";

    // Kelas tempat siswa terdaftar (lintas periode).
    const myClasses = db.find("classes", (c) =>
      (c.studentIds || []).includes(req.user.id)
    );
    const classIds = new Set(myClasses.map((c) => c.id));
    const classById = new Map(myClasses.map((c) => [c.id, c]));

    const subjects = db.all("subjects").filter((s) => classIds.has(s.classId));
    const submissions = db.all("submissions");
    const quizResults = db.all("quizResults");

    const rows = subjects.map((s) => {
      const c = classById.get(s.classId) || {};

      // Nilai tugas milik siswa pada mapel ini.
      const asgItems = db
        .find("assignments", (a) => a.subjectId === s.id)
        .map((a) => {
          const sub = submissions.find(
            (x) => x.assignmentId === a.id && x.studentId === req.user.id
          );
          const rawGrade =
            sub && sub.grade !== undefined && sub.grade !== ""
              ? sub.grade
              : null;
          const num = rawGrade !== null ? Number(rawGrade) : NaN;
          return {
            kind: "assignment",
            title: a.title,
            submitted: !!sub,
            display:
              rawGrade !== null
                ? String(rawGrade)
                : sub
                ? "Belum dinilai"
                : "Belum kumpul",
            score: Number.isFinite(num) ? num : null,
          };
        });

      // Nilai kuis (dinilai otomatis) milik siswa pada mapel ini.
      const quizItems = db
        .find("quizzes", (q) => q.subjectId === s.id)
        .map((q) => {
          const r = quizResults.find(
            (x) => x.quizId === q.id && x.studentId === req.user.id
          );
          const total = r ? r.total : (q.questions || []).length;
          const percent =
            r && total > 0 ? Math.round((r.score / total) * 100) : null;
          return {
            kind: "quiz",
            title: q.title,
            submitted: !!r,
            display: r ? `${r.score}/${total}` : "Belum dikerjakan",
            score: percent,
          };
        });

      const items = [...asgItems, ...quizItems];
      const scored = items.filter((it) => it.score !== null);
      const average = scored.length
        ? Math.round(
            (scored.reduce((sum, it) => sum + it.score, 0) / scored.length) * 10
          ) / 10
        : null;

      return {
        subjectId: s.id,
        subjectName: s.name,
        classId: s.classId,
        className: c.name || "?",
        academicYearId: c.academicYearId || "",
        academicYearName: yearNameOf(c.academicYearId),
        semester: c.semester || "",
        periodActive:
          c.academicYearId === activeYearId && c.semester === activeSemester,
        teacherNames: (s.teacherIds || []).map(nameOf).join(", "),
        items,
        average,
        gradedCount: scored.length,
        itemCount: items.length,
      };
    });

    rows.sort(
      (a, b) =>
        (b.academicYearName || "").localeCompare(a.academicYearName || "") ||
        (a.semester || "").localeCompare(b.semester || "") ||
        (a.className + a.subjectName).localeCompare(b.className + b.subjectName)
    );

    ok(res, {
      student: { id: req.user.id, name: req.user.name },
      activePeriod: {
        academicYearId: activeYearId,
        academicYearName: yearNameOf(activeYearId),
        semester: activeSemester,
      },
      subjects: rows,
    });
  }
);

/* =====================================================================
 * BELAJAR MANDIRI — ringkasan progres siswa pada periode aktif.
 * Menghitung keterlibatan siswa (materi dipahami, tugas dikumpulkan, kuis
 * dikerjakan) per mata pelajaran + rekomendasi "lanjutkan belajar".
 * ===================================================================== */
app.get(
  "/api/my-learning",
  authenticate,
  requireRole("student"),
  (req, res) => {
    const activeYearId = getActiveYearId();
    const activeSemester = getActiveSemester();
    // scope=all: hitung seluruh materi aktif (Beranda), bukan hanya Belajar Mandiri.
    const scopeAll = req.query.scope === "all";
    const years = db.all("academicYears");
    const yearNameOf = (yid) =>
      (years.find((y) => y.id === yid) || {}).name || "\u2014";

    // Hanya kelas siswa pada PERIODE AKTIF (fokus belajar saat ini).
    const myClasses = db.find(
      "classes",
      (c) =>
        (c.studentIds || []).includes(req.user.id) &&
        c.academicYearId === activeYearId &&
        c.semester === activeSemester
    );
    const classById = new Map(myClasses.map((c) => [c.id, c]));
    const classIds = new Set(myClasses.map((c) => c.id));
    const subjects = db.all("subjects").filter((s) => classIds.has(s.classId));

    const submissions = db.all("submissions");
    const quizResults = db.all("quizResults");
    const readSet = new Set(
      db
        .find(
          "materialReads",
          (r) => r.studentId === req.user.id && r.passed !== false
        )
        .map((r) => r.materialId)
    );

    const next = [];
    const subjectRows = subjects.map((s) => {
      const c = classById.get(s.classId) || {};
      const inactive = inactiveLessonSet(s.id);
      // Materi yang terlihat siswa (aktif + pembelajaran aktif + Belajar Mandiri).
      const materials = db
        .find("materials", (m) => m.subjectId === s.id)
        .filter(
          (m) =>
            m.active !== false &&
            (scopeAll || m.selfLearn !== false) &&
            !inactive.has(Math.max(1, parseInt(m.pertemuan, 10) || 1))
        )
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      const matDone = materials.filter((m) => readSet.has(m.id)).length;

      const assignments = db.find(
        "assignments",
        (a) => a.subjectId === s.id && a.active !== false
      );
      const asgDone = assignments.filter((a) =>
        submissions.some(
          (x) => x.assignmentId === a.id && x.studentId === req.user.id
        )
      ).length;

      const quizzes = db.find(
        "quizzes",
        (q) => q.subjectId === s.id && q.active !== false
      );
      const quizDone = quizzes.filter((q) =>
        quizResults.some(
          (x) => x.quizId === q.id && x.studentId === req.user.id
        )
      ).length;

      const total = materials.length + assignments.length + quizzes.length;
      const done = matDone + asgDone + quizDone;
      const percent = total > 0 ? Math.round((done / total) * 100) : 0;

      // Kumpulkan kandidat "lanjutkan belajar" (belum tuntas).
      const base = {
        subjectId: s.id,
        subjectName: s.name,
        classId: s.classId,
        className: c.name || "?",
      };
      materials
        .filter((m) => !readSet.has(m.id))
        .forEach((m) =>
          next.push({ ...base, type: "material", id: m.id, title: m.title })
        );
      quizzes
        .filter(
          (q) =>
            !quizResults.some(
              (x) => x.quizId === q.id && x.studentId === req.user.id
            )
        )
        .forEach((q) =>
          next.push({ ...base, type: "quiz", id: q.id, title: q.title })
        );
      assignments
        .filter(
          (a) =>
            !submissions.some(
              (x) => x.assignmentId === a.id && x.studentId === req.user.id
            )
        )
        .forEach((a) =>
          next.push({
            ...base,
            type: "assignment",
            id: a.id,
            title: a.title,
            dueDate: a.dueDate || "",
          })
        );

      return {
        ...base,
        materials: { total: materials.length, done: matDone },
        assignments: { total: assignments.length, done: asgDone },
        quizzes: { total: quizzes.length, done: quizDone },
        total,
        done,
        percent,
      };
    });

    subjectRows.sort((a, b) =>
      (a.className + a.subjectName).localeCompare(
        b.className + b.subjectName,
        "id",
        { numeric: true }
      )
    );

    const sum = (key) =>
      subjectRows.reduce((acc, r) => acc + r[key].total, 0);
    const sumDone = (key) =>
      subjectRows.reduce((acc, r) => acc + r[key].done, 0);
    const grandTotal = subjectRows.reduce((acc, r) => acc + r.total, 0);
    const grandDone = subjectRows.reduce((acc, r) => acc + r.done, 0);

    // Prioritas rekomendasi: materi dulu, lalu kuis, lalu tugas.
    const orderRank = { material: 0, quiz: 1, assignment: 2 };
    next.sort((a, b) => orderRank[a.type] - orderRank[b.type]);

    ok(res, {
      student: { id: req.user.id, name: req.user.name },
      activePeriod: {
        academicYearId: activeYearId,
        academicYearName: yearNameOf(activeYearId),
        semester: activeSemester,
      },
      overall: {
        percent: grandTotal > 0 ? Math.round((grandDone / grandTotal) * 100) : 0,
        materials: { total: sum("materials"), done: sumDone("materials") },
        assignments: { total: sum("assignments"), done: sumDone("assignments") },
        quizzes: { total: sum("quizzes"), done: sumDone("quizzes") },
      },
      subjects: subjectRows,
      next: next.slice(0, 6),
    });
  }
);

/* =====================================================================
 * DASBOR ORANG TUA (tanpa login)
 * Cukup cocokkan NAMA + NISN siswa untuk melihat laporan hasil belajar.
 * ===================================================================== */
app.post("/api/parent/report", (req, res) => {
  const name = String((req.body && req.body.name) || "").trim();
  const nisn = String((req.body && req.body.nisn) || "").trim();
  if (!name || !nisn) return bad(res, 400, "Nama dan NISN wajib diisi.");

  // Wajib cocok NAMA dan NISN sekaligus (mengurangi penelusuran acak).
  const student = db.all("users").find(
    (u) =>
      u.role === "student" &&
      String(u.nisn || "").trim() === nisn &&
      String(u.name || "").trim().toLowerCase() === name.toLowerCase()
  );
  if (!student)
    return bad(
      res,
      404,
      "Data tidak ditemukan. Periksa kembali nama dan NISN siswa."
    );

  const activeYearId = getActiveYearId();
  const activeSemester = getActiveSemester();
  const years = db.all("academicYears");
  const users = db.all("users");
  const yearNameOf = (yid) =>
    (years.find((y) => y.id === yid) || {}).name || "\u2014";
  const nameOf = (uid) => (users.find((u) => u.id === uid) || {}).name || "?";

  const myClasses = db.find("classes", (c) =>
    (c.studentIds || []).includes(student.id)
  );
  const classIds = new Set(myClasses.map((c) => c.id));
  const classById = new Map(myClasses.map((c) => [c.id, c]));

  const subjects = db.all("subjects").filter((s) => classIds.has(s.classId));
  const submissions = db.all("submissions");
  const quizResults = db.all("quizResults");
  const attendanceAll = db.all("attendance");
  const assessments = db.all("assessments");

  const rows = subjects.map((s) => {
    const c = classById.get(s.classId) || {};

    const asgItems = db
      .find("assignments", (a) => a.subjectId === s.id)
      .map((a) => {
        const sub = submissions.find(
          (x) => x.assignmentId === a.id && x.studentId === student.id
        );
        const rawGrade =
          sub && sub.grade !== undefined && sub.grade !== ""
            ? sub.grade
            : null;
        const num = rawGrade !== null ? Number(rawGrade) : NaN;
        return {
          kind: "assignment",
          title: a.title,
          submitted: !!sub,
          display:
            rawGrade !== null
              ? String(rawGrade)
              : sub
              ? "Belum dinilai"
              : "Belum kumpul",
          score: Number.isFinite(num) ? num : null,
        };
      });

    const quizItems = db
      .find("quizzes", (q) => q.subjectId === s.id)
      .map((q) => {
        const r = quizResults.find(
          (x) => x.quizId === q.id && x.studentId === student.id
        );
        const total = r ? r.total : (q.questions || []).length;
        const percent =
          r && total > 0 ? Math.round((r.score / total) * 100) : null;
        return {
          kind: "quiz",
          title: q.title,
          submitted: !!r,
          display: r ? `${r.score}/${total}` : "Belum dikerjakan",
          score: percent,
        };
      });

    const items = [...asgItems, ...quizItems];
    const scored = items.filter((it) => it.score !== null);
    const average = scored.length
      ? Math.round(
          (scored.reduce((sum, it) => sum + it.score, 0) / scored.length) * 10
        ) / 10
      : null;

    const attendance = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
    attendanceAll
      .filter((a) => a.subjectId === s.id && a.studentId === student.id)
      .forEach((a) => {
        if (attendance[a.status] !== undefined) attendance[a.status]++;
      });

    const asmt =
      assessments.find(
        (a) => a.subjectId === s.id && a.studentId === student.id
      ) || {};

    return {
      subjectId: s.id,
      subjectName: s.name,
      classId: s.classId,
      className: c.name || "?",
      academicYearId: c.academicYearId || "",
      academicYearName: yearNameOf(c.academicYearId),
      semester: c.semester || "",
      periodActive:
        c.academicYearId === activeYearId && c.semester === activeSemester,
      teacherNames: (s.teacherIds || []).map(nameOf).join(", "),
      items,
      average,
      gradedCount: scored.length,
      itemCount: items.length,
      attendance,
      sikap: asmt.sikap || "",
      lulus: asmt.lulus || "",
    };
  });

  rows.sort(
    (a, b) =>
      (b.academicYearName || "").localeCompare(a.academicYearName || "") ||
      (a.semester || "").localeCompare(b.semester || "") ||
      (a.className + a.subjectName).localeCompare(b.className + b.subjectName)
  );

  // Rangkuman kehadiran keseluruhan (seluruh mapel siswa).
  const attendanceTotal = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
  attendanceAll
    .filter((a) => a.studentId === student.id)
    .forEach((a) => {
      if (attendanceTotal[a.status] !== undefined) attendanceTotal[a.status]++;
    });

  // Kelas pada periode aktif (untuk identitas).
  const activeClass =
    myClasses.find(
      (c) => c.academicYearId === activeYearId && c.semester === activeSemester
    ) || null;

  ok(res, {
    student: {
      id: student.id,
      name: student.name,
      nisn: student.nisn || "",
      photoUrl: student.photoUrl || "",
      status: student.status || "",
    },
    activePeriod: {
      academicYearId: activeYearId,
      academicYearName: yearNameOf(activeYearId),
      semester: activeSemester,
    },
    currentClass: activeClass
      ? {
          name: activeClass.name,
          waliKelasName: nameOf(activeClass.waliKelasId),
        }
      : null,
    attendanceTotal,
    subjects: rows,
  });
});

/* =====================================================================
 * KUIS PILIHAN GANDA
 * ===================================================================== */

// Sembunyikan kunci jawaban untuk pelajar.
function publicQuiz(q, hideAnswers) {
  const questions = (q.questions || []).map((qq) => ({
    id: qq.id,
    text: qq.text,
    options: qq.options,
    ...(hideAnswers ? {} : { correctIndex: qq.correctIndex }),
  }));
  return { ...q, questions };
}

app.get("/api/quizzes", authenticate, (req, res) => {
  const { subjectId } = req.query;
  if (!subjectId) return bad(res, 400, "subjectId wajib diisi");
  const subject = getSubjectOr404(req, res, subjectId);
  if (!subject) return;
  const hide = req.user.role === "student";
  const list = db
    .find("quizzes", (q) => q.subjectId === subjectId)
    .filter((q) => !hide || q.active !== false)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((q) => publicQuiz(q, hide));
  ok(res, list);
});

app.get("/api/quizzes/:id", authenticate, (req, res) => {
  const q = db.getById("quizzes", req.params.id);
  if (!q) return bad(res, 404, "Kuis tidak ditemukan");
  const subject = db.getById("subjects", q.subjectId);
  if (!isMemberOfSubject(req.user, subject))
    return bad(res, 403, "Bukan anggota mata pelajaran");
  ok(res, publicQuiz(q, req.user.role === "student"));
});

app.post(
  "/api/quizzes",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const { subjectId, title, description, questions } = req.body || {};
    if (!subjectId || !title) return bad(res, 400, "subjectId & title wajib diisi");
    if (!Array.isArray(questions) || questions.length === 0)
      return bad(res, 400, "Minimal satu pertanyaan");
    const subject = db.getById("subjects", subjectId);
    if (!subject) return bad(res, 404, "Mata pelajaran tidak ditemukan");
    if (!isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Anda bukan pengajar mata pelajaran ini");
    // Validasi & normalisasi pertanyaan.
    const clean = [];
    for (const q of questions) {
      const options = (q.options || []).map((o) => String(o).trim()).filter(Boolean);
      if (!q.text || options.length < 2)
        return bad(res, 400, "Setiap pertanyaan butuh teks & minimal 2 pilihan");
      const correctIndex = Number(q.correctIndex);
      if (!(correctIndex >= 0 && correctIndex < options.length))
        return bad(res, 400, "Indeks jawaban benar tidak valid");
      clean.push({ id: db.id(), text: String(q.text), options, correctIndex });
    }
    const durationMinutes = Math.max(0, Number(req.body.durationMinutes) || 0);
    const created = db.insert("quizzes", {
      subjectId,
      classId: subject.classId,
      teacherId: req.user.id,
      teacherName: req.user.name,
      title,
      description: description || "",
      durationMinutes,
      pertemuan: Math.max(1, parseInt(req.body.pertemuan, 10) || 1),
      questions: clean,
      // Kuis baru belum dibagikan; guru menekan 'Bagikan' agar terlihat siswa.
      active: false,
      completed: false,
    });
    notifySubjectStudents(subject, `Kuis baru: "${title}" pada ${subject.name}`);
    ok(res, created);
  }
);

app.put(
  "/api/quizzes/:id",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const q = db.getById("quizzes", req.params.id);
    if (!q) return bad(res, 404, "Kuis tidak ditemukan");
    if (req.user.role === "teacher" && q.teacherId !== req.user.id)
      return bad(res, 403, "Hanya pengajar pembuat yang dapat mengubah");
    const { title, description, questions } = req.body || {};
    const patch = {};
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (req.body.durationMinutes !== undefined)
      patch.durationMinutes = Math.max(0, Number(req.body.durationMinutes) || 0);
    if (req.body.pertemuan !== undefined)
      patch.pertemuan = Math.max(1, parseInt(req.body.pertemuan, 10) || 1);
    if (questions !== undefined) {
      if (!Array.isArray(questions) || questions.length === 0)
        return bad(res, 400, "Minimal satu pertanyaan");
      const clean = [];
      for (const item of questions) {
        const options = (item.options || [])
          .map((o) => String(o).trim())
          .filter(Boolean);
        if (!item.text || options.length < 2)
          return bad(res, 400, "Setiap pertanyaan butuh teks & minimal 2 pilihan");
        const correctIndex = Number(item.correctIndex);
        if (!(correctIndex >= 0 && correctIndex < options.length))
          return bad(res, 400, "Indeks jawaban benar tidak valid");
        clean.push({
          id: item.id || db.id(),
          text: String(item.text),
          options,
          correctIndex,
        });
      }
      patch.questions = clean;
    }
    ok(res, db.update("quizzes", req.params.id, patch));
  }
);

app.delete(
  "/api/quizzes/:id",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const q = db.getById("quizzes", req.params.id);
    if (!q) return bad(res, 404, "Kuis tidak ditemukan");
    if (req.user.role === "teacher" && q.teacherId !== req.user.id)
      return bad(res, 403, "Hanya pengajar pembuat yang dapat menghapus");
    db.find("quizResults", (r) => r.quizId === q.id).forEach((r) =>
      db.remove("quizResults", r.id)
    );
    db.remove("quizzes", req.params.id);
    removeCommentsFor("quiz", req.params.id);
    ok(res, { success: true });
  }
);

// Pengajar membagikan / menyembunyikan sebuah kuis dari siswa.
// Kuis nonaktif (active===false) tidak terlihat oleh siswa.
app.put(
  "/api/quizzes/:id/active",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const q = db.getById("quizzes", req.params.id);
    if (!q) return bad(res, 404, "Kuis tidak ditemukan");
    if (req.user.role === "teacher" && q.teacherId !== req.user.id)
      return bad(res, 403, "Hanya pengajar pembuat yang dapat mengubah");
    const { active } = req.body || {};
    const nextActive = active !== false && active !== "false";
    ok(res, db.update("quizzes", req.params.id, { active: nextActive }));
  }
);

// Pengajar menandai (atau membatalkan) sebuah kuis "telah selesai".
app.put(
  "/api/quizzes/:id/complete",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const q = db.getById("quizzes", req.params.id);
    if (!q) return bad(res, 404, "Kuis tidak ditemukan");
    if (req.user.role === "teacher" && q.teacherId !== req.user.id)
      return bad(res, 403, "Hanya pengajar pembuat yang dapat mengubah");
    const { done } = req.body || {};
    const nextDone = done !== false && done !== "false";
    ok(
      res,
      db.update("quizzes", req.params.id, {
        completed: nextDone,
        completedAt: nextDone ? new Date().toISOString() : "",
      })
    );
  }
);

// Pelajar mengerjakan kuis (dinilai otomatis).
app.post(
  "/api/quiz-results",
  authenticate,
  requireRole("student"),
  (req, res) => {
    const { quizId, answers } = req.body || {};
    const quiz = db.getById("quizzes", quizId);
    if (!quiz) return bad(res, 404, "Kuis tidak ditemukan");
    const subject = db.getById("subjects", quiz.subjectId);
    if (!isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Anda tidak terdaftar di mata pelajaran ini");
    if (!Array.isArray(answers))
      return bad(res, 400, "answers harus berupa array");
    const existing = db.findOne(
      "quizResults",
      (r) => r.quizId === quizId && r.studentId === req.user.id
    );
    // Kuis yang sudah dikerjakan terkunci; hanya bisa diulang bila guru mengizinkan.
    if (existing && !existing.retakeAllowed)
      return bad(
        res,
        409,
        "Kuis sudah dikerjakan. Minta izin pengajar untuk mengerjakan ulang."
      );
    let score = 0;
    quiz.questions.forEach((q, i) => {
      if (Number(answers[i]) === q.correctIndex) score++;
    });
    const total = quiz.questions.length;
    const data = {
      quizId,
      studentId: req.user.id,
      answers: answers.map((a) => Number(a)),
      score,
      total,
      submittedAt: new Date().toISOString(),
      // Izin ulang habis terpakai setelah dikerjakan lagi.
      retakeAllowed: false,
    };
    const saved = existing
      ? db.update("quizResults", existing.id, data)
      : db.insert("quizResults", data);
    ok(res, saved);
  }
);

// Daftar hasil kuis (pengajar melihat semua, pelajar melihat miliknya).
app.get("/api/quiz-results", authenticate, (req, res) => {
  const { quizId } = req.query;
  if (!quizId) return bad(res, 400, "quizId wajib diisi");
  const quiz = db.getById("quizzes", quizId);
  if (!quiz) return bad(res, 404, "Kuis tidak ditemukan");
  const subject = db.getById("subjects", quiz.subjectId);
  if (!isMemberOfSubject(req.user, subject))
    return bad(res, 403, "Bukan anggota mata pelajaran");
  let list = db.find("quizResults", (r) => r.quizId === quizId);
  if (req.user.role === "student")
    list = list.filter((r) => r.studentId === req.user.id);
  const users = db.all("users");
  const nameOf = (id) => (users.find((u) => u.id === id) || {}).name || "?";
  ok(res, list.map((r) => ({ ...r, studentName: nameOf(r.studentId) })));
});

// Pengajar mengizinkan seorang siswa mengerjakan ulang kuis (membuka kunci).
app.post(
  "/api/quizzes/:id/allow-retake",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const quiz = db.getById("quizzes", req.params.id);
    if (!quiz) return bad(res, 404, "Kuis tidak ditemukan");
    if (req.user.role === "teacher" && quiz.teacherId !== req.user.id)
      return bad(res, 403, "Hanya pengajar pembuat yang dapat mengubah");
    const { studentId } = req.body || {};
    if (!studentId) return bad(res, 400, "studentId wajib diisi");
    const result = db.findOne(
      "quizResults",
      (r) => r.quizId === quiz.id && r.studentId === studentId
    );
    if (!result) return bad(res, 404, "Siswa belum mengerjakan kuis ini");
    const saved = db.update("quizResults", result.id, { retakeAllowed: true });
    db.insert("notifications", {
      userId: studentId,
      text: `Anda diizinkan mengerjakan ulang kuis: "${quiz.title}"`,
      classId: quiz.classId,
      subjectId: quiz.subjectId,
      read: false,
    });
    ok(res, saved);
  }
);

/* =====================================================================
 * NOTIFIKASI
 * ===================================================================== */

app.get("/api/notifications", authenticate, (req, res) => {
  const list = db
    .find("notifications", (n) => n.userId === req.user.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 50);
  ok(res, list);
});

app.put("/api/notifications/:id/read", authenticate, (req, res) => {
  const n = db.getById("notifications", req.params.id);
  if (!n || n.userId !== req.user.id)
    return bad(res, 404, "Notifikasi tidak ditemukan");
  ok(res, db.update("notifications", req.params.id, { read: true }));
});

app.post("/api/notifications/read-all", authenticate, (req, res) => {
  db.find("notifications", (n) => n.userId === req.user.id && !n.read).forEach(
    (n) => db.update("notifications", n.id, { read: true })
  );
  ok(res, { success: true });
});

/* =====================================================================
 * FORUM DISKUSI (per mata pelajaran)
 * ===================================================================== */

app.get("/api/discussions", authenticate, (req, res) => {
  const { subjectId } = req.query;
  if (!subjectId) return bad(res, 400, "subjectId wajib diisi");
  const subject = getSubjectOr404(req, res, subjectId);
  if (!subject) return;
  const list = db
    .find("discussions", (d) => d.subjectId === subjectId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  ok(res, list);
});

app.post("/api/discussions", authenticate, (req, res) => {
  const { subjectId, text } = req.body || {};
  if (!subjectId || !text || !String(text).trim())
    return bad(res, 400, "subjectId & text wajib diisi");
  const subject = db.getById("subjects", subjectId);
  if (!isMemberOfSubject(req.user, subject))
    return bad(res, 403, "Bukan anggota mata pelajaran");
  const cls = db.getById("classes", subject.classId);
  const created = db.insert("discussions", {
    subjectId,
    classId: subject.classId,
    authorId: req.user.id,
    authorName: req.user.name,
    authorRole: req.user.role,
    text: String(text).trim(),
  });
  // Beri tahu pelajar lain (bukan penulis) tentang diskusi baru.
  ((cls && cls.studentIds) || [])
    .filter((sid) => sid !== req.user.id)
    .forEach((sid) =>
      db.insert("notifications", {
        userId: sid,
        text: `Diskusi baru dari ${req.user.name} pada ${subject.name}`,
        classId: subject.classId,
        subjectId,
        read: false,
      })
    );
  ok(res, created);
});

app.delete("/api/discussions/:id", authenticate, (req, res) => {
  const d = db.getById("discussions", req.params.id);
  if (!d) return bad(res, 404, "Pesan tidak ditemukan");
  // Penulis, pengajar mapel, atau admin boleh menghapus.
  const subject = db.getById("subjects", d.subjectId);
  const isTeacher = req.user.role === "teacher" && isMemberOfSubject(req.user, subject);
  if (d.authorId !== req.user.id && req.user.role !== "admin" && !isTeacher)
    return bad(res, 403, "Tidak boleh menghapus pesan ini");
  db.remove("discussions", req.params.id);
  ok(res, { success: true });
});

/* =====================================================================
 * OBROLAN / CHAT (kelas, mata pelajaran, & pesan pribadi)
 * ===================================================================== */

const ROLE_ORDER = { teacher: 0, student: 1, admin: 2 };

// Daftar kontak & konteks percakapan untuk sebuah mata pelajaran.
app.get("/api/chat/contacts", authenticate, (req, res) => {
  const { subjectId } = req.query;
  if (!subjectId) return bad(res, 400, "subjectId wajib diisi");
  const subject = getSubjectOr404(req, res, subjectId);
  if (!subject) return;
  const cls = db.getById("classes", subject.classId);

  // Kumpulkan id kontak sesuai peran.
  const contactIds = new Set();
  if (req.user.role === "admin") {
    db.all("users").forEach((u) => contactIds.add(u.id));
  } else {
    if (cls) chatClassMemberIds(cls).forEach((id) => contactIds.add(id));
    // Guru boleh mengobrol dengan sesama guru.
    if (req.user.role === "teacher")
      db.find("users", (u) => u.role === "teacher").forEach((u) =>
        contactIds.add(u.id)
      );
  }
  contactIds.delete(req.user.id);

  const contacts = [...contactIds]
    .map((id) => db.getById("users", id))
    .filter(Boolean)
    .map((u) => ({ id: u.id, name: u.name, role: u.role }))
    .sort((a, b) => {
      const r = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
      return r !== 0 ? r : a.name.localeCompare(b.name, "id");
    });

  ok(res, {
    class: cls ? { id: cls.id, name: cls.name } : null,
    subject: { id: subject.id, name: subject.name },
    contacts,
  });
});

// Daftar percakapan pribadi (inbox) pengguna: lawan bicara + pesan terakhir.
app.get("/api/chat/threads", authenticate, (req, res) => {
  const uid = req.user.id;
  const dms = db.find(
    "messages",
    (m) =>
      m.scope === "dm" &&
      ((Array.isArray(m.peerIds) && m.peerIds.includes(uid)) ||
        (m.dmKey && m.dmKey.split("__").includes(uid)))
  );
  const byPeer = new Map();
  dms.forEach((m) => {
    let peerId = null;
    if (Array.isArray(m.peerIds)) peerId = m.peerIds.find((x) => x !== uid);
    else if (m.dmKey) peerId = m.dmKey.split("__").find((x) => x !== uid);
    if (!peerId) return;
    const prev = byPeer.get(peerId);
    if (!prev || prev.lastAt < m.createdAt)
      byPeer.set(peerId, {
        lastText: m.text,
        lastAt: m.createdAt,
        fromMe: m.authorId === uid,
      });
  });
  const threads = [...byPeer.entries()]
    .map(([peerId, info]) => {
      const u = db.getById("users", peerId);
      if (!u) return null;
      return { peerId, peerName: u.name, peerRole: u.role, ...info };
    })
    .filter(Boolean)
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  ok(res, threads);
});

// Ambil pesan sebuah percakapan (scope: class | subject | dm).
app.get("/api/messages", authenticate, (req, res) => {
  const { scope, classId, subjectId, peerId } = req.query;
  let filter;
  if (scope === "class") {
    const cls = db.getById("classes", classId);
    if (!cls) return bad(res, 404, "Kelas tidak ditemukan");
    if (!isMemberOfClass(req.user, cls))
      return bad(res, 403, "Bukan anggota kelas ini");
    filter = (m) => m.scope === "class" && m.classId === classId;
  } else if (scope === "subject") {
    const subject = db.getById("subjects", subjectId);
    if (!subject) return bad(res, 404, "Mata pelajaran tidak ditemukan");
    if (!isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Bukan anggota mata pelajaran ini");
    filter = (m) => m.scope === "subject" && m.subjectId === subjectId;
  } else if (scope === "dm") {
    const peer = db.getById("users", peerId);
    if (!peer) return bad(res, 404, "Pengguna tidak ditemukan");
    if (!canDM(req.user, peer))
      return bad(res, 403, "Tidak boleh mengobrol dengan pengguna ini");
    const key = dmKey(req.user.id, peer.id);
    filter = (m) => m.scope === "dm" && m.dmKey === key;
  } else {
    return bad(res, 400, "scope tidak valid");
  }
  const list = db
    .find("messages", filter)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  ok(res, list);
});

// Kirim pesan.
app.post("/api/messages", authenticate, (req, res) => {
  const { scope, classId, subjectId, peerId, text } = req.body || {};
  const body = String(text || "").trim();
  if (!body) return bad(res, 400, "Pesan tidak boleh kosong");
  const base = {
    authorId: req.user.id,
    authorName: req.user.name,
    authorRole: req.user.role,
    text: body,
  };

  if (scope === "class") {
    const cls = db.getById("classes", classId);
    if (!cls) return bad(res, 404, "Kelas tidak ditemukan");
    if (!isMemberOfClass(req.user, cls))
      return bad(res, 403, "Bukan anggota kelas ini");
    const created = db.insert("messages", { ...base, scope: "class", classId });
    [...chatClassMemberIds(cls)]
      .filter((uid) => uid !== req.user.id)
      .forEach((uid) =>
        db.insert("notifications", {
          userId: uid,
          text: `Pesan kelas ${cls.name} dari ${req.user.name}`,
          classId,
          read: false,
        })
      );
    return ok(res, created);
  }

  if (scope === "subject") {
    const subject = db.getById("subjects", subjectId);
    if (!subject) return bad(res, 404, "Mata pelajaran tidak ditemukan");
    if (!isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Bukan anggota mata pelajaran ini");
    const created = db.insert("messages", {
      ...base,
      scope: "subject",
      subjectId,
      classId: subject.classId,
    });
    const cls = db.getById("classes", subject.classId);
    const recipients = new Set([
      ...((cls && cls.studentIds) || []),
      ...(subject.teacherIds || []),
    ]);
    [...recipients]
      .filter((uid) => uid !== req.user.id)
      .forEach((uid) =>
        db.insert("notifications", {
          userId: uid,
          text: `Pesan mapel ${subject.name} dari ${req.user.name}`,
          classId: subject.classId,
          subjectId,
          read: false,
        })
      );
    return ok(res, created);
  }

  if (scope === "dm") {
    const peer = db.getById("users", peerId);
    if (!peer) return bad(res, 404, "Pengguna tidak ditemukan");
    if (!canDM(req.user, peer))
      return bad(res, 403, "Tidak boleh mengobrol dengan pengguna ini");
    const created = db.insert("messages", {
      ...base,
      scope: "dm",
      dmKey: dmKey(req.user.id, peer.id),
      peerIds: [req.user.id, peer.id],
    });
    db.insert("notifications", {
      userId: peer.id,
      text: `Pesan pribadi dari ${req.user.name}`,
      read: false,
    });
    return ok(res, created);
  }

  return bad(res, 400, "scope tidak valid");
});

// Hapus pesan (penulis, admin, atau pengajar anggota kelas/mapel terkait).
app.delete("/api/messages/:id", authenticate, (req, res) => {
  const m = db.getById("messages", req.params.id);
  if (!m) return bad(res, 404, "Pesan tidak ditemukan");
  let allowed = m.authorId === req.user.id || req.user.role === "admin";
  if (!allowed && req.user.role === "teacher") {
    if (m.scope === "subject")
      allowed = isMemberOfSubject(req.user, db.getById("subjects", m.subjectId));
    else if (m.scope === "class")
      allowed = isMemberOfClass(req.user, db.getById("classes", m.classId));
  }
  if (!allowed) return bad(res, 403, "Tidak boleh menghapus pesan ini");
  db.remove("messages", req.params.id);
  ok(res, { success: true });
});

/* =====================================================================
 * ABSENSI / KEHADIRAN (per mata pelajaran & tanggal)
 * ===================================================================== */

const ATTENDANCE_STATUS = ["hadir", "izin", "sakit", "alfa"];

// Pengajar/admin: rekap satu tanggal. Pelajar: riwayat kehadiran sendiri.
app.get("/api/attendance", authenticate, (req, res) => {
  const { subjectId, date } = req.query;
  if (!subjectId) return bad(res, 400, "subjectId wajib diisi");
  const subject = getSubjectOr404(req, res, subjectId);
  if (!subject) return;
  let list = db.find("attendance", (a) => a.subjectId === subjectId);
  if (req.user.role === "student") {
    list = list.filter((a) => a.studentId === req.user.id);
  } else if (date) {
    list = list.filter((a) => a.date === date);
  }
  list.sort((a, b) => (a.date < b.date ? 1 : -1));
  ok(res, list);
});

// Pengajar/admin: simpan kehadiran satu tanggal (upsert per pelajar).
app.post(
  "/api/attendance",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const { subjectId, date, entries } = req.body || {};
    if (!subjectId || !date) return bad(res, 400, "subjectId & date wajib diisi");
    if (!Array.isArray(entries))
      return bad(res, 400, "entries harus berupa array");
    const subject = db.getById("subjects", subjectId);
    if (!subject) return bad(res, 404, "Mata pelajaran tidak ditemukan");
    if (!isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Anda bukan pengajar mata pelajaran ini");
    const cls = db.getById("classes", subject.classId);
    const saved = [];
    entries.forEach((e) => {
      const studentId = e.studentId;
      if (!((cls && cls.studentIds) || []).includes(studentId)) return;
      const status = ATTENDANCE_STATUS.includes(e.status) ? e.status : "alfa";
      const note = e.note ? String(e.note) : "";
      const existing = db.findOne(
        "attendance",
        (a) =>
          a.subjectId === subjectId && a.date === date && a.studentId === studentId
      );
      const data = {
        subjectId,
        classId: subject.classId,
        date,
        studentId,
        status,
        note,
        markedBy: req.user.id,
      };
      saved.push(
        existing
          ? db.update("attendance", existing.id, data)
          : db.insert("attendance", data)
      );
    });
    ok(res, saved);
  }
);

/* =====================================================================
 * STATISTIK mata pelajaran (pengajar/admin)
 * ===================================================================== */

app.get(
  "/api/subjects/:id/stats",
  authenticate,
  requireRole("teacher", "admin"),
  (req, res) => {
    const subject = db.getById("subjects", req.params.id);
    if (!subject) return bad(res, 404, "Mata pelajaran tidak ditemukan");
    if (!isMemberOfSubject(req.user, subject))
      return bad(res, 403, "Anda bukan pengajar mata pelajaran ini");
    const cls = db.getById("classes", subject.classId);

    const studentIds = (cls && cls.studentIds) || [];
    const studentCount = studentIds.length;
    const assignments = db.find("assignments", (a) => a.subjectId === subject.id);
    const quizzes = db.find("quizzes", (q) => q.subjectId === subject.id);
    const subs = db.all("submissions");
    const results = db.all("quizResults");

    // Tingkat pengumpulan tugas.
    let expected = assignments.length * studentCount;
    let submitted = 0;
    assignments.forEach((a) => {
      studentIds.forEach((sid) => {
        if (subs.find((s) => s.assignmentId === a.id && s.studentId === sid))
          submitted++;
      });
    });
    const submissionRate = expected ? Math.round((submitted / expected) * 100) : 0;

    // Rata-rata nilai tugas yang sudah dinilai.
    const grades = subs
      .filter(
        (s) =>
          assignments.some((a) => a.id === s.assignmentId) &&
          s.grade !== undefined &&
          s.grade !== "" &&
          !isNaN(Number(s.grade))
      )
      .map((s) => Number(s.grade));
    const avgGrade = grades.length
      ? Math.round((grades.reduce((x, y) => x + y, 0) / grades.length) * 10) / 10
      : null;

    // Rata-rata persen skor kuis.
    const quizIds = quizzes.map((q) => q.id);
    const quizPercents = results
      .filter((r) => quizIds.includes(r.quizId) && r.total > 0)
      .map((r) => (r.score / r.total) * 100);
    const avgQuizPercent = quizPercents.length
      ? Math.round(quizPercents.reduce((x, y) => x + y, 0) / quizPercents.length)
      : null;

    // Ringkasan kehadiran.
    const att = db.find("attendance", (a) => a.subjectId === subject.id);
    const attendance = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
    att.forEach((a) => {
      if (attendance[a.status] !== undefined) attendance[a.status]++;
    });
    const attendanceDays = new Set(att.map((a) => a.date)).size;

    // Daftar murid dengan nilai & kehadiran untuk mata pelajaran ini.
    const users = db.all("users");
    const userById = (uid) => users.find((u) => u.id === uid);
    const ctx = {
      assignmentsAll: assignments,
      quizzesAll: quizzes,
      subs,
      results,
    };
    const students = studentIds.map((sid) => {
      const u = userById(sid);
      const g = computeSubjectGrade(subject, sid, ctx);
      const sAtt = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
      att
        .filter((a) => a.studentId === sid)
        .forEach((a) => {
          if (sAtt[a.status] !== undefined) sAtt[a.status]++;
        });
      return {
        id: sid,
        name: u ? u.name : "?",
        photoUrl: u ? u.photoUrl || "" : "",
        nisn: u ? u.nisn || "" : "",
        average: g.average,
        items: g.items,
        attendance: sAtt,
      };
    });

    ok(res, {
      studentCount,
      assignmentCount: assignments.length,
      quizCount: quizzes.length,
      submissionRate,
      avgGrade,
      avgQuizPercent,
      attendance,
      attendanceDays,
      students,
    });
  }
);

/* =====================================================================
 * PENGUMUMAN (admin -> semua peran)
 * ===================================================================== */

app.get("/api/announcements", authenticate, (req, res) => {
  const list = db
    .all("announcements")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  ok(res, list);
});

app.post(
  "/api/announcements",
  authenticate,
  requireRole("admin"),
  upload.single("media"),
  (req, res) => {
    const { title, text } = req.body || {};
    if (!title || !text || !String(text).trim())
      return bad(res, 400, "title & text wajib diisi");
    const doc = {
      title: String(title).trim(),
      text: String(text).trim(),
      authorId: req.user.id,
      authorName: req.user.name,
    };
    if (req.file) {
      doc.mediaUrl = `/uploads/${req.file.filename}`;
      doc.mediaType = mediaKind(req.file.mimetype);
      doc.mediaName = req.file.originalname;
    }
    const created = db.insert("announcements", doc);
    // Beri tahu semua pelajar.
    db.find("users", (u) => u.role === "student").forEach((u) =>
      db.insert("notifications", {
        userId: u.id,
        text: `Pengumuman: ${created.title}`,
        classId: null,
        read: false,
      })
    );
    ok(res, created);
  }
);

app.delete(
  "/api/announcements/:id",
  authenticate,
  requireRole("admin"),
  (req, res) => {
    const removed = db.remove("announcements", req.params.id);
    if (!removed) return bad(res, 404, "Pengumuman tidak ditemukan");
    ok(res, { success: true });
  }
);

app.put(
  "/api/announcements/:id",
  authenticate,
  requireRole("admin"),
  upload.single("media"),
  (req, res) => {
    const target = db.getById("announcements", req.params.id);
    if (!target) return bad(res, 404, "Pengumuman tidak ditemukan");
    const { title, text, removeMedia } = req.body || {};
    const patch = {};
    if (title !== undefined) {
      if (!String(title).trim()) return bad(res, 400, "Judul wajib diisi");
      patch.title = String(title).trim();
    }
    if (text !== undefined) {
      if (!String(text).trim()) return bad(res, 400, "Isi wajib diisi");
      patch.text = String(text).trim();
    }
    if (req.file) {
      patch.mediaUrl = `/uploads/${req.file.filename}`;
      patch.mediaType = mediaKind(req.file.mimetype);
      patch.mediaName = req.file.originalname;
    } else if (removeMedia === "true" || removeMedia === true) {
      patch.mediaUrl = "";
      patch.mediaType = "";
      patch.mediaName = "";
    }
    ok(res, db.update("announcements", req.params.id, patch));
  }
);

/* =====================================================================
 * STATISTIK (dasbor admin)
 * ===================================================================== */

app.get("/api/stats", authenticate, requireRole("admin", "pimpinan"), (req, res) => {
  ensureAcademicYears();
  const activeYearId = getActiveYearId();
  const activeSemester = getActiveSemester();
  const users = db.all("users");
  const now = Date.now();

  const byRole = { admin: 0, teacher: 0, student: 0 };
  users.forEach((u) => {
    if (byRole[u.role] != null) byRole[u.role] += 1;
  });

  // Sebaran status murid.
  const studentStatus = {};
  users
    .filter((u) => u.role === "student")
    .forEach((u) => {
      const s = (u.status || "aktif").toLowerCase();
      studentStatus[s] = (studentStatus[s] || 0) + 1;
    });

  // Pengguna yang online (lastSeenAt dalam ONLINE_WINDOW_MS).
  const onlineUsers = users
    .filter(
      (u) =>
        u.lastSeenAt &&
        now - new Date(u.lastSeenAt).getTime() <= ONLINE_WINDOW_MS
    )
    .map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      lastSeenAt: u.lastSeenAt,
    }))
    .sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));
  const onlineByRole = { admin: 0, teacher: 0, student: 0 };
  onlineUsers.forEach((u) => {
    if (onlineByRole[u.role] != null) onlineByRole[u.role] += 1;
  });

  // Jumlah murid per kelas pada periode aktif.
  const classes = db.all("classes");
  const activeClasses = classes.filter(
    (c) => c.academicYearId === activeYearId && c.semester === activeSemester
  );
  const studentsPerClass = activeClasses
    .map((c) => ({ name: c.name, count: (c.studentIds || []).length }))
    .sort((a, b) => b.count - a.count);

  // Siswa berprestasi: rata-rata nilai (tugas + kuis) tertinggi pada
  // kelas periode aktif, lintas mata pelajaran.
  const gradeCtx = buildGradeContext();
  const subjectsAll = db.all("subjects");
  const topStudents = [];
  const activeSubjectAverages = []; // semua rata2 mapel pada periode aktif
  users
    .filter((u) => u.role === "student")
    .forEach((u) => {
      const myClasses = activeClasses.filter((c) =>
        (c.studentIds || []).includes(u.id)
      );
      if (!myClasses.length) return;
      const subjAverages = [];
      myClasses.forEach((c) => {
        subjectsAll
          .filter((s) => s.classId === c.id)
          .forEach((s) => {
            const g = computeSubjectGrade(s, u.id, gradeCtx).average;
            if (g !== null) subjAverages.push(g);
          });
      });
      activeSubjectAverages.push(...subjAverages);
      const overall = avgOf(subjAverages);
      if (overall !== null)
        topStudents.push({
          id: u.id,
          name: u.name,
          className: myClasses.map((c) => c.name).join(", "),
          average: overall,
        });
    });
  topStudents.sort((a, b) => b.average - a.average);

  // Rata-rata nilai keseluruhan (semua kelas & seluruh periode).
  const overallSubjectAverages = [];
  classes.forEach((c) => {
    const clsSubjects = subjectsAll.filter((s) => s.classId === c.id);
    (c.studentIds || []).forEach((sid) => {
      clsSubjects.forEach((s) => {
        const g = computeSubjectGrade(s, sid, gradeCtx).average;
        if (g !== null) overallSubjectAverages.push(g);
      });
    });
  });

  const alumniCount = users.filter(
    (u) => u.role === "student" && (u.status || "").toLowerCase() === "lulus"
  ).length;

  const stats = {
    generatedAt: new Date(now).toISOString(),
    onlineWindowMinutes: Math.round(ONLINE_WINDOW_MS / 60000),
    users: {
      total: users.length,
      admin: byRole.admin,
      teacher: byRole.teacher,
      student: byRole.student,
      alumni: alumniCount,
    },
    grades: {
      activeAverage: avgOf(activeSubjectAverages),
      overallAverage: avgOf(overallSubjectAverages),
    },
    online: {
      total: onlineUsers.length,
      byRole: onlineByRole,
      users: onlineUsers.slice(0, 50),
    },
    studentStatus,
    studentsPerClass,
    topStudents: topStudents.slice(0, 10),
    content: {
      classes: classes.length,
      activeClasses: activeClasses.length,
      subjects: db.all("subjects").length,
      schedules: db.all("schedules").length,
      rooms: db.all("rooms").length,
      materials: db.all("materials").length,
      assignments: db.all("assignments").length,
      quizzes: db.all("quizzes").length,
      submissions: db.all("submissions").length,
      announcements: db.all("announcements").length,
      academicYears: db.all("academicYears").length,
    },
  };
  ok(res, stats);
});

/* ---------------- Sajikan build produksi (client/dist) ---------------- */
// Berguna untuk perangkat dengan browser lama (mis. Smart TV): satu origin,
// tanpa dev server. Jalankan `npm run build` di folder client lebih dulu.
const DIST_DIR = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  // SPA fallback: semua rute non-API kembalikan index.html.
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

app.use((err, req, res, next) => {
  // Berkas terlalu besar / error multer lain.
  if (err && err.name === "MulterError") {
    const msg =
      err.code === "LIMIT_FILE_SIZE"
        ? "Ukuran berkas melebihi batas (maks 200 MB)"
        : "Gagal mengunggah berkas";
    return bad(res, 400, msg);
  }
  // Jenis berkas ditolak / origin CORS ditolak.
  if (err && /tidak diizinkan/i.test(err.message || "")) {
    return bad(res, 400, err.message);
  }
  console.error(err);
  bad(res, 500, err.message || "Kesalahan server");
});

app.listen(PORT, () => {
  console.log(`EduMuh API berjalan di http://localhost:${PORT}`);
});
