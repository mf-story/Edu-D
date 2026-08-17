# Edu-D — Aplikasi Belajar Mengajar

Aplikasi belajar mengajar dengan **3 peran**:

| Peran | Fungsi utama |
|-------|--------------|
| **Admin** | Membuat & mengelola pengguna, kelas, **mata pelajaran** (per kelas, dengan pengajar masing-masing), dan jadwal; mendaftarkan pelajar ke kelas; menerbitkan **pengumuman** untuk semua peran. |
| **Pengajar** | Mengelola **mata pelajaran yang diampu**: membagikan materi (teks, gambar, video, presentasi, dokumen, tautan), membuat tugas (**dengan tenggat**), memberi nilai, membuat **kuis pilihan ganda** (dengan **batas waktu**), mencatat **kehadiran**, melihat **rekap nilai** & **statistik**, dan **mengekspor nilai ke CSV**. |
| **Pelajar** | Memilih **kelas → mata pelajaran**, melihat materi, mengumpulkan tugas (**penanda terlambat** bila lewat tenggat), mengerjakan **kuis** (dengan **hitung mundur** & kirim otomatis saat waktu habis, dinilai otomatis), melihat **riwayat kehadiran** & jadwal kelas, dan melihat nilai/umpan balik. |

Semua peran dapat mengubah **profil** (nama & kata sandi) sendiri lewat tombol nama di kanan atas.
Sebuah **kelas** adalah rombongan belajar berisi beberapa **mata pelajaran**; setiap mata pelajaran memiliki pengajar serta materi, tugas, kuis, diskusi, dan kehadirannya sendiri. **Jadwal** dikelola di tingkat kelas.
Setiap mata pelajaran memiliki **forum diskusi** tempat pengajar & pelajar bertanya-jawab.
Pelajar juga menerima **notifikasi** (ikon lonceng di kanan atas) saat ada tugas, kuis, atau diskusi baru.

Tampilan menggunakan tema **modern & colorful** (gradien indigo–ungu–merah muda, font Inter/Poppins) dengan kartu statistik berwarna dan grafik kehadiran.

## Teknologi
- **Frontend:** React + Vite (`client/`)
- **Backend:** Node.js + Express, penyimpanan file JSON (`server/`) — tanpa database eksternal.
- **Autentikasi:** login username/password, kata sandi di-hash (scrypt), token sesi bertanda tangan (HMAC).

## Struktur
```
Edu-D/
  server/     API + penyimpanan JSON (folder data/ & uploads/ dibuat otomatis)
  client/     Aplikasi React (Vite)
```

## Menjalankan (pengembangan)

Karena kebijakan eksekusi PowerShell, jalankan perintah npm lewat `npm.cmd`
atau aktifkan bypass untuk sesi terminal:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
```

### 1. Backend (port 4000)
```powershell
cd server
npm install       # sekali saja
npm run seed      # sekali saja: membuat akun & kelas contoh
npm start
```

> Catatan: server menyimpan data di memori dan menulis ke `data/*.json`.
> Jalankan `npm run seed` **sebelum** `npm start`. Jika perlu seed ulang saat
> server sedang berjalan, hentikan dulu server lalu jalankan seed, baru start
> kembali (agar data di disk dan di memori tidak berbeda).

### 2. Frontend (port 5173)
Di terminal terpisah:
```powershell
cd client
npm install       # sekali saja
npm run dev
```
Buka http://localhost:5173

> Vite mem-proxy `/api` dan `/uploads` ke backend `http://localhost:4000`,
> jadi cukup membuka alamat frontend.

### Cara cepat
Jalankan kedua server sekaligus:
```powershell
powershell -ExecutionPolicy Bypass -File .\start-dev.ps1
```

## Akun demo (dari `npm run seed`)
| Peran | Username | Password |
|-------|----------|----------|
| Admin | `admin` | `admin123` |
| Pengajar | `guru` | `guru123` |
| Pelajar | `siswa` | `siswa123` |

> Ganti kata sandi setelah login pertama. Untuk produksi, atur variabel
> lingkungan `EDUMUH_SECRET` (kunci tanda tangan token) pada server.

## Build produksi frontend
```powershell
cd client
npm run build     # hasil di client/dist
```
