/* =====================================================================
 * seed.js — Membuat data awal jika koleksi masih kosong.
 * Akun default:
 *   admin   / admin123    (Administrator)
 *   guru    / guru123     (Pengajar)
 *   siswa   / siswa123    (Pelajar)
 * Ubah kata sandi setelah login pertama.
 * ===================================================================== */
"use strict";

const db = require("./db");
const auth = require("./auth");

function createUser(username, password, name, role) {
  if (db.findOne("users", (u) => u.username === username)) {
    console.log(`- Lewati (sudah ada): ${username}`);
    return db.findOne("users", (u) => u.username === username);
  }
  const { salt, hash } = auth.hashPassword(password);
  const u = db.insert("users", { username, name, role, salt, passwordHash: hash });
  console.log(`+ Dibuat: ${username} (${role})`);
  return u;
}

const admin = createUser("admin", "admin123", "Administrator", "admin");
const guru = createUser("guru", "guru123", "Budi Pengajar", "teacher");
const siswa = createUser("siswa", "siswa123", "Ani Pelajar", "student");

if (db.all("classes").length === 0) {
  const cls = db.insert("classes", {
    name: "Kelas 7A",
    description: "Rombongan belajar contoh untuk demonstrasi EduMuh.",
    studentIds: [siswa.id],
  });
  db.insert("schedules", {
    classId: cls.id,
    title: "Upacara & Wali Kelas",
    day: "Senin",
    startTime: "07:00",
    endTime: "08:00",
    note: "Lapangan / Ruang 7A",
  });

  // Beberapa mata pelajaran dalam kelas, diampu pengajar contoh.
  const subjMat = db.insert("subjects", {
    classId: cls.id,
    name: "Matematika",
    description: "Aljabar & aritmetika dasar.",
    teacherIds: [guru.id],
  });
  db.insert("subjects", {
    classId: cls.id,
    name: "IPA",
    description: "Ilmu Pengetahuan Alam.",
    teacherIds: [guru.id],
  });
  console.log(
    `+ Kelas contoh dibuat: ${cls.name} (mapel: Matematika, IPA) [${subjMat.id ? "ok" : ""}]`
  );
}

console.log("Seed selesai.");
