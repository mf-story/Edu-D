/* =====================================================================
 * simulate.js — Isi data SIMULASI proses belajar-mengajar.
 * Rentang: 2024/2025 Ganjil s.d. 2025/2026 Genap (4 periode).
 *
 * Aturan penempatan (naik kelas):
 *   - Angkatan 2023 : Kelas 8A (2024/2025) -> Kelas 9A (2025/2026)
 *   - Angkatan 2024 : Kelas 7A (2024/2025) -> Kelas 8A (2025/2026)
 *
 * Melengkapi: mata pelajaran + pengajar, tugas + nilai, kuis + hasil,
 * dan absensi (~1 bulan hari kerja) tiap mapel per periode.
 *
 * JALANKAN SAAT SERVER MATI:  node simulate.js
 * (db.js membaca disk hanya saat start; menulis tiap perubahan.)
 * Idempoten: menghapus dulu data simulasi lama (bertanda _sim=true).
 * ===================================================================== */
"use strict";

const db = require("./db");

/* ---------------- Referensi tetap ---------------- */
const YEAR = {
  "2024/2025": "e2662c98-2d01-40b1-9260-99c2d7e2bbab",
  "2025/2026": "c590aa58-f009-4193-8fd5-e09dfb10522d",
};

// Guru (teacherIds)
const T = {
  Budi: "ffc8c6b2-0457-443b-9700-2d83daef963c",
  Beckham: "43dcecfc-e860-41d2-8589-eeeda996ca65",
  Ronaldo: "23a55f52-20ef-4a3f-a843-dc464de44690",
  Messi: "1d1c0534-e17f-4bec-abac-d0b758588c61",
};
const teacherName = (id) =>
  Object.keys(T).find((k) => T[k] === id) || "Pengajar";

// Siswa per angkatan (tahun masuk)
const COHORT_2023 = [
  "bdfb6a8d-e841-4168-91e7-912648b9bc85", // Muhammad Fakhrul
  "1bcd2b2c-d493-452a-9e37-f49b91d364e3", // Anwar
  "083b54d6-3427-4b49-8597-08793139551d", // Buffon
];
const COHORT_2024 = [
  "097be20c-0f5a-45a8-aebc-ffcca950bcd4", // Hilya Almahyra
  "6180960f-bf87-43d9-86c3-2505c9a511ea", // Yasri
  "3feeea1f-b899-4068-a7e3-6e4bbe1e439c", // Maldini
];

// Definisi 4 periode + rombel tiap angkatan.
// class8 = kelas angkatan 2023, class7 = kelas angkatan 2024.
const PERIODS = [
  { yearId: YEAR["2024/2025"], semester: "ganjil", c23: "Kelas 8A", c24: "Kelas 7A", monthYear: 2024, month: 8 }, // Sep 2024
  { yearId: YEAR["2024/2025"], semester: "genap", c23: "Kelas 8A", c24: "Kelas 7A", monthYear: 2025, month: 1 }, // Feb 2025
  { yearId: YEAR["2025/2026"], semester: "ganjil", c23: "Kelas 9A", c24: "Kelas 8A", monthYear: 2025, month: 8 }, // Sep 2025
  { yearId: YEAR["2025/2026"], semester: "genap", c23: "Kelas 9A", c24: "Kelas 8A", monthYear: 2026, month: 1 }, // Feb 2026
];

// Mata pelajaran (nama -> pengajar). Wali kelas ditentukan terpisah.
const SUBJECTS = [
  { name: "Matematika", teacherId: T.Budi },
  { name: "IPA", teacherId: T.Beckham },
  { name: "Bahasa Indonesia", teacherId: T.Ronaldo },
];

// Wali kelas: Budi mengawal angkatan 2023, Beckham angkatan 2024.
const WALI_2023 = T.Budi;
const WALI_2024 = T.Beckham;

/* ---------------- Util ---------------- */
// PRNG deterministik agar hasil dapat diulang.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20242025);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const pad2 = (n) => String(n).padStart(2, "0");

// 20 tanggal hari kerja mulai dari (year, month0) tanggal 1.
function weekdays(year, month0, count) {
  const out = [];
  const d = new Date(Date.UTC(year, month0, 1));
  while (out.length < count) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6)
      out.push(
        `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
          d.getUTCDate()
        )}`
      );
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/* ---------------- Bersihkan data simulasi lama ---------------- */
function purge() {
  const simClasses = db.find("classes", (c) => c._sim);
  simClasses.forEach((c) => {
    db.find("subjects", (s) => s.classId === c.id).forEach((s) => {
      db.find("assignments", (a) => a.subjectId === s.id).forEach((a) => {
        db.find("submissions", (x) => x.assignmentId === a.id).forEach((x) =>
          db.remove("submissions", x.id)
        );
        db.remove("assignments", a.id);
      });
      db.find("quizzes", (q) => q.subjectId === s.id).forEach((q) => {
        db.find("quizResults", (r) => r.quizId === q.id).forEach((r) =>
          db.remove("quizResults", r.id)
        );
        db.remove("quizzes", q.id);
      });
      db.find("attendance", (t) => t.subjectId === s.id).forEach((t) =>
        db.remove("attendance", t.id)
      );
      db.remove("subjects", s.id);
    });
    db.remove("classes", c.id);
  });
  console.log(`Dibersihkan: ${simClasses.length} rombel simulasi lama.`);
}

/* ---------------- Buat data ---------------- */
function makeQuestions(subjectName, n) {
  const qs = [];
  for (let i = 1; i <= n; i++) {
    const correct = Math.floor(rnd() * 4);
    qs.push({
      id: db.id(),
      text: `${subjectName} — Soal ${i}: Pilih jawaban yang benar.`,
      options: ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"],
      correctIndex: correct,
    });
  }
  return qs;
}

function run() {
  purge();

  // Selaraskan Master Kelas untuk PERIODE AKTIF (2025/2026 Ganjil):
  //   9A = angkatan 2023, 8A = angkatan 2024, 7A dikosongkan.
  const setMaster = (name, ids) => {
    const opt = db.findOne(
      "classNameOptions",
      (o) => (o.name || "").toLowerCase() === name.toLowerCase()
    );
    if (opt) db.update("classNameOptions", opt.id, { studentIds: ids });
    else db.insert("classNameOptions", { name, studentIds: ids });
  };
  setMaster("Kelas 9A", COHORT_2023);
  setMaster("Kelas 8A", COHORT_2024);
  setMaster("Kelas 7A", []);
  setMaster("Kelas 7B", []);

  // Hapus rombel non-simulasi pada periode aktif yang bentrok nama (mis. Kelas 7A uji lama).
  db.find(
    "classes",
    (c) =>
      !c._sim &&
      c.academicYearId === YEAR["2025/2026"] &&
      c.semester === "ganjil"
  ).forEach((c) => {
    db.find("subjects", (s) => s.classId === c.id).forEach((s) =>
      db.remove("subjects", s.id)
    );
    db.remove("classes", c.id);
    console.log(`Hapus rombel uji lama: ${c.name} (aktif).`);
  });

  let counts = {
    classes: 0,
    subjects: 0,
    assignments: 0,
    submissions: 0,
    quizzes: 0,
    quizResults: 0,
    attendance: 0,
  };

  for (const p of PERIODS) {
    const rombels = [
      { name: p.c23, students: COHORT_2023, wali: WALI_2023 },
      { name: p.c24, students: COHORT_2024, wali: WALI_2024 },
    ];

    for (const r of rombels) {
      const cls = db.insert("classes", {
        _sim: true,
        name: r.name,
        description: `Rombel simulasi ${r.name}`,
        studentIds: r.students.slice(),
        academicYearId: p.yearId,
        semester: p.semester,
        waliKelasId: r.wali,
      });
      counts.classes++;

      const dates = weekdays(p.monthYear, p.month, 20);

      for (const subDef of SUBJECTS) {
        const subject = db.insert("subjects", {
          _sim: true,
          classId: cls.id,
          name: subDef.name,
          description: `${subDef.name} untuk ${r.name}`,
          teacherIds: [subDef.teacherId],
        });
        counts.subjects++;

        // 3 tugas per mapel.
        for (let ai = 1; ai <= 3; ai++) {
          const due = dates[Math.min(dates.length - 1, ai * 5)];
          const assignment = db.insert("assignments", {
            _sim: true,
            subjectId: subject.id,
            classId: cls.id,
            teacherId: subDef.teacherId,
            teacherName: teacherName(subDef.teacherId),
            title: `Tugas ${ai} — ${subDef.name}`,
            description: `Kerjakan Tugas ${ai} mata pelajaran ${subDef.name}.`,
            dueDate: due,
          });
          counts.assignments++;

          // Pengumpulan + nilai tiap siswa.
          for (const sid of r.students) {
            const grade = 70 + Math.floor(rnd() * 26); // 70..95
            db.insert("submissions", {
              _sim: true,
              assignmentId: assignment.id,
              studentId: sid,
              text: `Jawaban tugas ${ai} ${subDef.name}.`,
              submittedAt: new Date(
                Date.UTC(p.monthYear, p.month, 3 + ai)
              ).toISOString(),
              grade,
              feedback: grade >= 85 ? "Bagus!" : "Tingkatkan lagi.",
              gradedAt: new Date(
                Date.UTC(p.monthYear, p.month, 5 + ai)
              ).toISOString(),
              gradedBy: teacherName(subDef.teacherId),
            });
            counts.submissions++;
          }
        }

        // 2 kuis per mapel.
        for (let qi = 1; qi <= 2; qi++) {
          const questions = makeQuestions(subDef.name, 5);
          const quiz = db.insert("quizzes", {
            _sim: true,
            subjectId: subject.id,
            classId: cls.id,
            teacherId: subDef.teacherId,
            teacherName: teacherName(subDef.teacherId),
            title: `Kuis ${qi} — ${subDef.name}`,
            description: `Kuis ${qi} mata pelajaran ${subDef.name}.`,
            durationMinutes: 30,
            questions,
          });
          counts.quizzes++;

          for (const sid of r.students) {
            // Jawaban: sebagian benar (skor 3..5 dari 5).
            const answers = questions.map((q) =>
              rnd() < 0.75 ? q.correctIndex : (q.correctIndex + 1) % 4
            );
            let score = 0;
            questions.forEach((q, i) => {
              if (answers[i] === q.correctIndex) score++;
            });
            db.insert("quizResults", {
              _sim: true,
              quizId: quiz.id,
              studentId: sid,
              answers,
              score,
              total: questions.length,
              submittedAt: new Date(
                Date.UTC(p.monthYear, p.month, 10 + qi)
              ).toISOString(),
            });
            counts.quizResults++;
          }
        }

        // Absensi ~1 bulan (20 hari kerja) untuk tiap mapel.
        for (const date of dates) {
          for (const sid of r.students) {
            const roll = rnd();
            let status = "hadir";
            if (roll > 0.97) status = "alfa";
            else if (roll > 0.93) status = "sakit";
            else if (roll > 0.88) status = "izin";
            db.insert("attendance", {
              _sim: true,
              subjectId: subject.id,
              classId: cls.id,
              date,
              studentId: sid,
              status,
              note: "",
              markedBy: subDef.teacherId,
            });
            counts.attendance++;
          }
        }
      }
    }
  }

  console.log("Selesai. Ringkasan data simulasi:");
  console.log(JSON.stringify(counts, null, 2));
}

run();
