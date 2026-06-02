# TicketSniper — Panduan Penggunaan

## Persyaratan

- Node.js versi 18 ke atas
- npm
- Koneksi internet

---

## Langkah 1 — Install Dependencies

Jalankan sekali saat pertama kali setup:

```bash
npm install
npx playwright install chromium
cd dashboard && npm install && cd ..
```

---

## Langkah 2 — Buat File `.env`

Copy dari contoh lalu isi sesuai event:

```bash
cp .env.example .env
```

Edit file `.env`:

```env
# URL halaman event di tiket.com
TIKET_URL=https://www.tiket.com/konser/nama-event

# Tanggal dan jam sale dibuka (WIB)
TIKET_SALE_DATE=2026-05-10
TIKET_SALE_TIME=10:00:00

# Kategori tiket yang diinginkan (sesuai tulisan di web, huruf kapital)
TIKET_CATEGORY=CAT 1A
TIKET_CATEGORY_FALLBACK=CAT 2

# Jumlah tiket
TIKET_QTY=2

# Berapa detik sebelum sale bot mulai preload halaman
PRELOAD_SECONDS=15

# Interval polling tombol beli (ms), makin kecil makin agresif
POLL_INTERVAL_MS=50

# false = browser terlihat, true = headless (tak terlihat)
HEADLESS=false

# Metode pembayaran
PAYMENT_METHOD=mandiri_va
```

---

## Langkah 3 — Isi Data Profile

Edit file `profile.json` dengan data pemesan yang valid:

```json
{
  "pemesan": {
    "title": "Tuan",
    "nama": "Nama Lengkap Kamu",
    "phone": "08xxxxxxxxxx",
    "email": "email@kamu.com",
    "negara": "Indonesia"
  },
  "pengunjung": {
    "same_as_pemesan": true,
    "title": "Tuan",
    "nama": "Nama Lengkap Kamu",
    "phone": "08xxxxxxxxxx",
    "email": "email@kamu.com",
    "ktp": "nomor KTP 16 digit"
  },
  "payment": {
    "method": "mandiri_va"
  }
}
```

> Jika `same_as_pemesan: true`, data pengunjung akan otomatis diisi sama dengan pemesan.

---

## Langkah 4 — Login ke tiket.com (Wajib, Lakukan Sekali)

```bash
npm run login
```

- Browser akan terbuka
- Login manual menggunakan **email & password** (bukan Google)
- Setelah berhasil login, **tutup browser** — session tersimpan otomatis di folder `session/`
- Langkah ini hanya perlu dilakukan sekali. Session akan dipakai ulang di run berikutnya.

Untuk cek apakah session masih aktif:

```bash
npm run check-session
```

---

## Langkah 5 — Jalankan Backend & Dashboard

Buka **2 terminal terpisah**:

**Terminal 1 — Backend:**
```bash
npm run server
```

Output yang benar:
```
[OK   ] TicketSniper server running at http://localhost:3001
```

**Terminal 2 — Dashboard:**
```bash
cd dashboard && npm run dev
```

Output yang benar:
```
VITE v5.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

Lalu buka browser ke: **http://localhost:5173**

---

## Langkah 6 — Jalankan Bot

Ada 2 cara:

### Cara A — Via Dashboard (Direkomendasikan)

1. Buka http://localhost:5173
2. Pastikan konfigurasi sudah benar di panel kanan
3. Klik tombol **"Start Bot"**
4. Pantau log di terminal dan dashboard

### Cara B — Via Terminal Langsung

```bash
npm run bot
```

---

## Alur Otomatis Bot

Setelah dijalankan, bot akan:

1. **Menghitung mundur** sampai `PRELOAD_SECONDS` sebelum jam sale
2. **Membuka halaman event** dan siap menunggu
3. **Menekan tombol beli** secepat mungkin saat jam sale tiba
4. **Memilih kategori tiket** sesuai `.env` (`TIKET_CATEGORY`)
5. **Mengisi data pemesan & pengunjung** otomatis dari `profile.json`
6. **Memilih metode pembayaran** (`mandiri_va` atau lainnya)
7. **Menampilkan hasil** — kode VA atau instruksi pembayaran

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| `TIKET_URL is not set` | Pastikan file `.env` sudah dibuat dan URL diisi |
| Kategori tiket tidak ditemukan | Samakan persis tulisan kategori di web (contoh: `CAT 1A(STANDING) - GENERAL SALE`) |
| Session expired / bot tidak bisa lanjut | Jalankan ulang `npm run login` |
| Browser tidak terbuka | Pastikan `HEADLESS=false` di `.env` |
| Port 3001 sudah dipakai | Ganti `PORT=3002` di `.env` |
| Dashboard tidak connect ke backend | Pastikan backend berjalan dulu sebelum buka dashboard |

---

## Struktur File Penting

```
autobotticket/
├── .env                  ← konfigurasi event & timing (WAJIB DIISI)
├── profile.json          ← data pemesan & pengunjung (WAJIB DIISI)
├── session/              ← session login tersimpan di sini (auto)
├── bot.js                ← otak utama bot
├── server.js             ← backend API + WebSocket
├── checkout.js           ← logic isi form checkout
├── payment.js            ← logic pilih pembayaran
├── queue.js              ← logic polling & queue
├── session.js            ← management login session
└── dashboard/            ← UI monitoring (React + Vite)
```
