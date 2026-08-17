# ============ Tahap build: pasang dependensi & build frontend ============
FROM node:22-alpine AS build
WORKDIR /app

# Dependensi frontend (layer cache)
COPY client/package*.json ./client/
RUN cd client && npm install

# Dependensi backend (layer cache)
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Salin sisa sumber lalu build frontend (hasil di client/dist)
COPY client/ ./client/
COPY server/ ./server/
RUN cd client && npm run build

# ============ Tahap run: image ramping berisi server + dist ============
FROM node:22-alpine
WORKDIR /app/server
ENV NODE_ENV=production
ENV PORT=4000

# Backend (termasuk node_modules) & hasil build frontend
COPY --from=build /app/server ./
COPY --from=build /app/client/dist ../client/dist

EXPOSE 4000

# Seed data awal bila folder data masih kosong, lalu jalankan server.
CMD ["sh", "-c", "[ -z \"$(ls -A data 2>/dev/null)\" ] && node seed.js; node server.js"]
