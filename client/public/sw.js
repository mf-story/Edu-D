// Service worker EduMuh — mendukung PWA (installable) & offline dasar.
// Strategi: network-first untuk navigasi (agar selalu versi terbaru),
// cache-first untuk aset statis. API & uploads TIDAK di-cache.
const CACHE = "edumuh-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Jangan cache API & berkas unggahan (selalu ambil dari jaringan).
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/"))
    return;

  // Navigasi halaman: network-first, fallback ke index.html saat offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Aset statis: cache-first, lalu isi cache saat berhasil dari jaringan.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
    )
  );
});
