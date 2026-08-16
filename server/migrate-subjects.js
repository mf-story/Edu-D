/* =====================================================================
 * migrate-subjects.js — Migrasi satu kali dari model lama (konten per
 * kelas) ke model baru (konten per mata pelajaran).
 *
 * Untuk tiap kelas yang masih memiliki `teacherIds` (model lama), skrip
 * membuat satu mata pelajaran bernama sama dengan kelas, memindahkan
 * pengajar ke mapel tersebut, lalu menautkan semua konten (materi, tugas,
 * kuis, diskusi, kehadiran) yang ber-classId itu ke subjectId baru.
 * Aman dijalankan berulang: konten yang sudah punya subjectId dilewati.
 *
 * Jalankan: node migrate-subjects.js
 * ===================================================================== */
"use strict";

const db = require("./db");

const CONTENT = ["materials", "assignments", "quizzes", "discussions", "attendance"];

let migratedClasses = 0;
let touched = 0;

db.all("classes").forEach((cls) => {
  const oldTeacherIds = Array.isArray(cls.teacherIds) ? cls.teacherIds : [];

  // Cari/ buat mata pelajaran untuk menampung konten lama kelas ini.
  let subject = db.findOne(
    "subjects",
    (s) => s.classId === cls.id && s._migratedFrom === cls.id
  );
  if (!subject) {
    subject = db.insert("subjects", {
      classId: cls.id,
      name: cls.name,
      description: cls.description || "",
      teacherIds: oldTeacherIds,
      _migratedFrom: cls.id,
    });
    migratedClasses++;
    console.log(`+ Mapel migrasi dibuat untuk kelas "${cls.name}"`);
  }

  // Tautkan konten lama (yang belum punya subjectId) ke mapel ini.
  CONTENT.forEach((coll) => {
    db.find(coll, (x) => x.classId === cls.id && !x.subjectId).forEach((x) => {
      db.update(coll, x.id, { subjectId: subject.id });
      touched++;
    });
  });
});

console.log(
  `Migrasi selesai. ${migratedClasses} mapel dibuat, ${touched} konten ditautkan.`
);
