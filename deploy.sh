#!/usr/bin/env bash
# =====================================================================
# deploy.sh — Deploy EduMuh ke VPS Linux (Ubuntu/Debian).
# Jalankan sebagai root dari dalam folder repo:
#     bash deploy.sh
# Jalankan ulang perintah yang sama setiap kali ingin memperbarui.
# =====================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-80}"

echo "==> [1/6] Memastikan Node.js & pm2 terpasang"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

echo "==> [2/6] Menyiapkan kunci rahasia token (dibuat sekali, disimpan lokal)"
if [ ! -f "$ROOT_DIR/.edumuh_secret" ]; then
  (openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n') > "$ROOT_DIR/.edumuh_secret"
  chmod 600 "$ROOT_DIR/.edumuh_secret"
fi
EDUMUH_SECRET="$(cat "$ROOT_DIR/.edumuh_secret")"

echo "==> [3/6] Backend: memasang dependensi"
( cd server && npm install --omit=dev )

echo "==> [4/6] Frontend: memasang dependensi & build produksi"
( cd client && npm install && npm run build )

echo "==> [5/6] Seed data awal (hanya bila belum ada)"
if [ ! -d "server/data" ] || [ -z "$(ls -A server/data 2>/dev/null)" ]; then
  ( cd server && npm run seed )
else
  echo "    (server/data sudah ada — seed dilewati agar data tidak tertimpa)"
fi

echo "==> [6/6] Menjalankan/merestart lewat pm2 di port $PORT"
cd "$ROOT_DIR/server"
pm2 delete edumuh >/dev/null 2>&1 || true
PORT="$PORT" EDUMUH_SECRET="$EDUMUH_SECRET" pm2 start server.js --name edumuh --update-env
pm2 save

# Buka firewall bila ufw aktif.
if command -v ufw >/dev/null 2>&1; then
  ufw allow "$PORT"/tcp >/dev/null 2>&1 || true
  ufw allow 22/tcp >/dev/null 2>&1 || true
fi

IP="$(curl -fsS https://api.ipify.org 2>/dev/null || echo 'IP-VPS-ANDA')"
echo ""
echo "====================================================================="
echo " EduMuh berjalan.  Buka:  http://$IP:${PORT}/"
echo " Login awal: admin / admin123  (segera ganti kata sandi)"
echo ""
echo " Agar otomatis nyala setelah reboot, jalankan sekali perintah dari:"
echo "     pm2 startup"
echo "====================================================================="
