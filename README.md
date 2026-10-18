# Vidora — Pemutar YouTube

Website statis responsif untuk memutar video melalui **YouTube IFrame Player API**. Tidak memerlukan server aplikasi, framework, API key YouTube Data API, atau dependensi npm.

## Audit dan struktur

Workspace awal tidak memiliki source code atau konfigurasi project. Implementasi karena itu dibuat sebagai aplikasi vanilla HTML/CSS/JavaScript, tanpa mengganti framework yang sudah ada.

```text
.
├── index.html                    # Markup halaman, player, input, mode, dan kontrol
├── styles.css                    # Tema gelap dan layout responsif desktop/mobile
├── app.js                        # Integrasi IFrame API, status, kontrol, penyimpanan lokal
├── youtube-url.js                # Parser/validasi URL YouTube (juga dapat diuji di Node)
├── playback-controller.js        # Kebijakan loop dan pembatalan restart tertunda
├── youtube-errors.js              # Pesan untuk error pemutar YouTube
└── tests/
    ├── youtube-url.test.cjs
    ├── playback-controller.test.cjs
    └── youtube-errors.test.cjs
```

## Menjalankan website

Jalankan server HTTP statis dari direktori project:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

Lalu buka `http://localhost:8000`. Website perlu koneksi internet untuk mengunduh YouTube IFrame Player API dan memutar embed. Mengaksesnya melalui HTTP/HTTPS juga membantu YouTube menerima origin/referrer player dengan benar.

## Menjalankan tes

Dengan Node.js yang mendukung `node:test`:

```bash
node --test tests/*.test.cjs
```

Tes memeriksa format URL yang didukung/ditolak, mode putar sekali dan manual, loop, pembatalan restart, pergantian mode ketika video sedang berjalan atau sudah selesai, serta pemetaan pesan error untuk video privat/tidak tersedia dan embed yang dibatasi.

## Catatan implementasi

- Player menggunakan embed resmi YouTube dan kontrol native YouTube tetap aktif; kontrol aplikasi untuk play/pause, volume, fullscreen, mulai dari awal, reset, dan putar ulang manual melengkapi kontrol tersebut.
- Pemutaran tidak dipaksa autoplay. Pengguna memulai video dengan tombol Putar.
- Loop ditangani melalui event `onStateChange` saat state `ENDED`; jadwal loop dibatalkan bila mode diubah, video diganti, atau pemutaran di-reset.
- URL terakhir dan mode tersimpan di `localStorage` jika browser mengizinkan. URL hanya dipulihkan ke kolom input—video tidak otomatis diputar saat halaman dibuka kembali.
- Video privat, dihapus, atau yang menonaktifkan embed bergantung pada respons/kebijakan YouTube; website menampilkan pesan sesuai kode error yang diterima.
