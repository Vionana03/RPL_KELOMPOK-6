# SkinMatch

Aplikasi web rekomendasi skincare berbasis **Rule-Based Engine** dan **Ingredient Conflict Detector**.
Proyek kelompok 6 – Rekayasa Perangkat Lunak, Teknik Informatika, Universitas Tadulako.

## Menjalankan aplikasi
Buka `index.html` di browser (atau gunakan ekstensi Live Server). Data awal ada di `js/data.js`.
Akun uji: `admin@skinmatch.id / admin123`, `sari@mail.com / sari123`, `dewi@mail.com / dewi123`.

## Menjalankan CI secara lokal
Prasyarat: Node.js 20 atau lebih baru.

```bash
npm ci          # pasang dependensi sesuai package-lock.json
npm run lint    # cek sintaks & pola kode bermasalah
npm run build   # validasi berkas yang dirujuk index.html, hasil ke dist/
npm test        # 15 unit test (rule engine, conflict detector, integritas data)
```

## CI di GitHub Actions
Workflow: `.github/workflows/ci.yml`. Berjalan otomatis pada **push** ke `main` dan setiap **pull request**.
Urutan: checkout → setup Node 20 → `npm ci` → `npm run lint` → `npm run build` → `npm test`.
Hasil run dapat dilihat di tab **Actions** pada repository.

## Jika pipeline gagal
| Gejala | Periksa |
|---|---|
| `npm ci` gagal (EUSAGE) | pastikan `package-lock.json` ikut di-commit |
| Test gagal | baca bagian `not ok` pada log, cari assertion yang gagal |
| Build gagal | berkas yang dirujuk `index.html` (css/js) belum ada |

## Struktur
```
index.html  css/  js/ (app.js, data.js, html5-qrcode.min.js)  images/
tests/skinmatch.test.js   scripts/ (lint.js, build.js)   .github/workflows/ci.yml
```
