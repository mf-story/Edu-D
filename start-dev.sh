#!/usr/bin/env bash
# =====================================================================
# start-dev.sh - Menjalankan backend (port 4000) dan frontend (port 5173)
# untuk macOS / Linux.
# Jalankan:  bash start-dev.sh    (atau: chmod +x start-dev.sh && ./start-dev.sh)
# =====================================================================
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Backend (port 4000) ---
echo "Menyiapkan backend EduMuh (port 4000)..."
cd "$ROOT/server"
[ -d node_modules ] || npm install
[ -d data ] || npm run seed
npm start &
BACKEND_PID=$!

# Hentikan backend otomatis saat skrip ditutup (Ctrl+C)
trap 'echo "Menghentikan backend..."; kill $BACKEND_PID 2>/dev/null' EXIT

sleep 2

# --- Frontend (port 5173) ---
echo "Menjalankan frontend EduMuh (port 5173)..."
cd "$ROOT/client"
[ -d node_modules ] || npm install
echo ""
echo "Selesai. Buka http://localhost:5173 di peramban."
npm run dev
