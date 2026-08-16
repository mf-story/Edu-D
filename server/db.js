/* =====================================================================
 * db.js — Penyimpanan data sederhana berbasis file JSON.
 * Setiap "koleksi" disimpan sebagai satu file .json di folder ./data.
 * Tidak memerlukan database eksternal.
 * ===================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const COLLECTIONS = [
  "users",
  "classes",
  "subjects",
  "schedules",
  "materials",
  "curriculum",
  "curriculumCatalog",
  "lessonStates",
  "materialReads",
  "assignments",
  "submissions",
  "quizzes",
  "quizResults",
  "assessments",
  "notifications",
  "discussions",
  "messages",
  "comments",
  "attendance",
  "announcements",
  "classNameOptions",
  "subjectNameOptions",
  "academicYears",
  "settings",
  "rooms",
  "promotions",
];

// Cache di memori supaya cepat; ditulis ke disk setiap perubahan.
const cache = {};

function fileOf(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function load(name) {
  if (cache[name]) return cache[name];
  const f = fileOf(name);
  if (fs.existsSync(f)) {
    try {
      cache[name] = JSON.parse(fs.readFileSync(f, "utf8"));
    } catch {
      cache[name] = [];
    }
  } else {
    cache[name] = [];
  }
  return cache[name];
}

function persist(name) {
  fs.writeFileSync(fileOf(name), JSON.stringify(cache[name], null, 2), "utf8");
}

// Inisialisasi semua koleksi.
COLLECTIONS.forEach(load);

function id() {
  return crypto.randomUUID();
}

/* ---------------- API koleksi ---------------- */

function all(name) {
  return load(name).slice();
}

function find(name, predicate) {
  return load(name).filter(predicate);
}

function findOne(name, predicate) {
  return load(name).find(predicate) || null;
}

function getById(name, itemId) {
  return load(name).find((x) => x.id === itemId) || null;
}

function insert(name, obj) {
  const list = load(name);
  const record = { id: id(), createdAt: new Date().toISOString(), ...obj };
  if (!record.id) record.id = id();
  list.push(record);
  persist(name);
  return record;
}

function update(name, itemId, patch) {
  const list = load(name);
  const idx = list.findIndex((x) => x.id === itemId);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch, id: itemId };
  persist(name);
  return list[idx];
}

function remove(name, itemId) {
  const list = load(name);
  const idx = list.findIndex((x) => x.id === itemId);
  if (idx === -1) return false;
  list.splice(idx, 1);
  persist(name);
  return true;
}

module.exports = {
  DATA_DIR,
  id,
  all,
  find,
  findOne,
  getById,
  insert,
  update,
  remove,
  persist,
  _cache: cache,
};
