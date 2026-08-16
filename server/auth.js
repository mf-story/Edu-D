/* =====================================================================
 * auth.js — Hashing kata sandi (scrypt) & token sesi (HMAC).
 * Tidak memakai pustaka eksternal; hanya modul crypto bawaan Node.
 * ===================================================================== */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Kunci rahasia untuk menandatangani token.
// Prioritas: variabel lingkungan EDUMUH_SECRET > berkas .secret (dibuat
// otomatis & persisten) > nilai acak sementara. Ini menghindari kunci default
// lemah yang bisa ditebak untuk memalsukan token.
function loadSecret() {
  const fromEnv = process.env.EDUMUH_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  const secretFile = path.join(__dirname, ".secret");
  try {
    if (fs.existsSync(secretFile)) {
      const saved = fs.readFileSync(secretFile, "utf8").trim();
      if (saved.length >= 32) return saved;
    }
    const generated = crypto.randomBytes(48).toString("hex");
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    return generated;
  } catch {
    // Fallback terakhir bila file system tidak bisa ditulis.
    return crypto.randomBytes(48).toString("hex");
  }
}

const SECRET = loadSecret();

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

/* ---------------- Kata sandi ---------------- */

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const stored = Buffer.from(hash, "hex");
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

/* ---------------- Token ---------------- */

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64url(input) {
  input = input.replace(/-/g, "+").replace(/_/g, "/");
  while (input.length % 4) input += "=";
  return Buffer.from(input, "base64").toString("utf8");
}

function sign(data) {
  return base64url(
    crypto.createHmac("sha256", SECRET).update(data).digest()
  );
}

function createToken(user) {
  const payload = {
    sub: user.id,
    role: user.role,
    name: user.name,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const body = base64url(JSON.stringify(payload));
  const sig = sign(body);
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = sign(body);
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(fromBase64url(body));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
};
