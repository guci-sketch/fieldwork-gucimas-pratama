# Pemfokusan Sistem pada Laporan Kerja Digital & Data Pelanggan

Rencana ini menyederhanakan sistem Fieldwork Guci Emas Pratama agar berfokus sepenuhnya pada pembuatan, eksekusi, dan verifikasi **Laporan Kerja Digital** beserta **Data Pelanggan & Lokasi Penugasan**, dengan menghapus seluruh modul komersial dan gudang (Penawaran Harga/PH, Gudang & Bahan Kimia, serta Keuangan/Tagihan/Cashflow).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Keputusan berikut telah dikonfirmasi melalui klarifikasi interaktif sebelumnya dan menjadi dasar perubahan sistem:

- **Confirmed Decision 1 (Ruang Lingkup Menu Admin Operasional)**: Mempertahankan hanya menu yang berkaitan langsung dengan operasional Laporan Kerja Digital dan Pelanggan:
  1. Dashboard Ringkasan & KPI Laporan Kerja
  2. Hasil & Verifikasi Laporan Kerja Digital (+ Ekspor PDF)
  3. Penugasan Kerja / Lokasi Proyek & Data Pelanggan
  4. Lacak Peta & Perjalanan GPS Teknisi
  5. Manajemen Akun Tim (Admin & Teknisi) + Pengaturan Kop PDF
- **Confirmed Decision 2 (Penghapusan Modul Komersial & Gudang)**: Menghapus seluruh fitur dan navigasi **Penawaran Harga (PH)**, **Gudang & Bahan Kimia**, serta **Keuangan, Tagihan & Performa MoM**, termasuk metrik/funnel Penawaran di Dashboard.
- **Confirmed Decision 3 (Alur Khusus Teknisi Lapangan)**: Tampilan Teknisi Lapangan difokuskan 100% pada eksekusi **Laporan Kerja Digital** (Check-in GPS, Foto Dokumentasi, Input Treatment, Tanda Tangan Klien, Check-out, dan Riwayat Laporan) tanpa tombol pembuatan proyek baru mandiri.

---

## A. Understanding (1. Overview & Core Concept)

- **What It Does**: Sistem manajemen operasional lapangan khusus **Laporan Kerja Digital** dan **Data Pelanggan** untuk 2 peran utama (**Admin Operasional** dan **Teknisi Lapangan**).
- **Target Audience / Persona**:
  - **Admin Operasional**: Mengelola data pelanggan & lokasi proyek, menjadwalkan penugasan kerja (SPK), memantau posisi GPS teknisi, memverifikasi hasil laporan kerja digital (termasuk temuan anomali GPS), mengunduh Berita Acara / Laporan Kerja PDF, serta mengelola akun tim dan kop surat PDF.
  - **Teknisi Lapangan**: Menerima daftar penugasan lokasi pelanggan dan mengeksekusi alur pembuatan Laporan Kerja Digital dari awal hingga selesai di lapangan.
- **Key Value**: Menghilangkan distraksi fitur ERP komersial (Penawaran PH, Gudang, Kas/Keuangan) sehingga antarmuka jauh lebih bersih, cepat, minimalis, dan terfokus pada kualitas pelaporan kerja lapangan.

---

## B. Current Analysis

Berdasarkan investigasi menyeluruh terhadap kondisi sistem saat ini:

1. **Navigasi & Halaman Admin Operasional**:
   - Saat ini sidebar Admin masih menampilkan 10 menu dalam 4 grup, termasuk **Penawaran Harga (PH)**, **Gudang & Bahan Kimia**, dan **Keuangan, Tagihan & Performa**.
   - Rute aplikasi masih menyediakan halaman pembuatan dan pengeditan Penawaran Harga secara langsung.
2. **Dashboard Analitik Operasional**:
   - Kartu KPI "Draft" saat ini masih menggabungkan jumlah draft Laporan Kerja dengan draft Surat Penawaran (PH), serta banner peringatan masih menghitung draft PH.
   - Sub-tab ke-4 pada Dashboard (`Bisnis`) masih menampilkan kartu **Ringkasan Leads (Funnel Penawaran PH)** dan grafik proporsi layanan masih menyertakan kategori **Survey Termite Control** dan **Survey Pest Control** dari data Penawaran.
3. **Antarmuka Teknisi Lapangan**:
   - Halaman beranda dan daftar tugas Teknisi Lapangan masih menampilkan tombol **"+ Baru"** dan **"+ Buat Penugasan Baru"** untuk membuat proyek baru dari sisi teknisi, padahal penugasan lokasi pelanggan seharusnya dikelola dari data proyek/pelanggan dan teknisi fokus mengisi Laporan Kerja Digital.
4. **Teks & Panduan Sistem**:
   - Halaman login, placeholder pencarian header, dan buku panduan peran masih mencantumkan referensi ke pembuatan Surat Penawaran (PH) dan pengelolaan Gudang.

---

## C. Root Cause / Key Findings

- Sistem ini awalnya diimpor dari basis kode CMS penuh yang menggabungkan modul Sales/Quotation, Inventory Gudang, Finance/Cashflow, dan Fieldwork dalam satu aplikasi.
- Karena aplikasi ini dikhususkan sebagai sistem **Laporan Kerja Digital & Pelanggan** dengan 2 role utama, keberadaan menu dan widget Penawaran (PH), Gudang, dan Keuangan menimbulkan ketidakfokuskan alur kerja dan membebani navigasi pengguna.

---

## D. Proposed Solution (2. User Experience & Visual Design)

### 1. Penyederhanaan Navigasi Admin Operasional
Menyusun ulang sidebar Admin Operasional menjadi **2 grup utama yang ringkas dan fokus**:
- **Grup 1 — Laporan Kerja & Pelanggan**:
  - **Dashboard Laporan Kerja**: Ringkasan KPI laporan kerja, efisiensi waktu operasional, tren laporan selesai, serta ringkasan pelanggan & kontrak garansi.
  - **Laporan Kerja Digital**: Daftar hasil laporan kerja lapangan, filter verifikasi anomali GPS, pratinjau foto & tanda tangan, serta unduh PDF.
  - **Penugasan & Lokasi Proyek**: Pengelolaan jadwal penugasan kerja (SPK) dan titik koordinat GPS lokasi proyek pelanggan.
  - **Data Pelanggan & Garansi**: Direktori pelanggan, riwayat pekerjaan per lokasi, dan masa berlaku garansi/kontrak.
  - **Lacak Peta & GPS Teknisi**: Pemantauan titik lokasi aktif dan rute perjalanan GPS teknisi di lapangan.
- **Grup 2 — Tim & Pengaturan**:
  - **Manajemen Tim & Akun**: Persetujuan dan pengelolaan akun Admin Operasional & Teknisi Lapangan.
  - **Pengaturan Kop PDF & Audit**: Kustomisasi template/kop dokumen PDF Laporan Kerja, batas toleransi radius GPS, dan log aktivitas.

### 2. Pembersihan Dashboard dari Elemen Penawaran (PH)
- Kartu KPI **Draft** hanya menghitung **Draft Laporan Kerja Digital** (tanpa mencampur draft Penawaran).
- Menghapus kartu **Ringkasan Leads (Funnel Penawaran)** dan mengganti sub-tab `Bisnis` menjadi **`Pelanggan & Kontrak`** yang berfokus pada pertumbuhan pelanggan aktif, jadwal perpanjangan garansi/kontrak, dan riwayat kunjungan layanan.
- Diagram **Proporsi Kategori Layanan** hanya menampilkan layanan dari **Laporan Kerja Digital** (`Work Report Termite`, `Fumigasi`, `Rodent Control`, `Work Report Pest Control`) tanpa irisan data survei penawaran.

### 3. Alur Murni Laporan Kerja Digital pada Teknisi Lapangan
- Menghapus tombol pembuatan proyek mandiri (`+ Baru` / `+ Buat Penugasan Baru`) dari layar Teknisi Lapangan.
- Menyajikan alur kerja bertahap yang fokus pada:
  1. Memilih lokasi pelanggan yang ditugaskan.
  2. **Check-in GPS** di lokasi pelanggan.
  3. Mengambil **Foto Dokumentasi** ber-watermark GPS & waktu.
  4. Mengisi **Form Treatment / Tindakan Lapangan**.
  5. Mengambil **Tanda Tangan Digital Pelanggan & Teknisi** serta **Check-out**.
  6. Melihat **Riwayat Laporan Kerja Digital** yang telah diselesaikan.

---

## E. Planned Changes (3. Key Product Decisions & Trade-Offs)

- **Decision 1: Menghapus Rute & Menu Modul Non-Laporan Kerja di Level UI & Router**
  - *Chosen Approach*: Menghapus rute pembuatan/edit Penawaran serta menghapus menu Penawaran Harga (PH), Gudang & Bahan Kimia, dan Keuangan/Tagihan dari daftar menu Admin Operasional.
  - *Why*: Memastikan pengguna tidak pernah tersesat ke fitur di luar ruang lingkup Laporan Kerja Digital & Pelanggan, sekaligus menjaga performa pemuatan halaman.
  - *Alternatives Considered*: Menyembunyikan menu dengan status "Coming Soon" — ditolak karena memenuhi sidebar dengan menu yang tidak relevan.
- **Decision 2: Mempertahankan Kompatibilitas Skema Database Bersama**
  - *Chosen Approach*: Tidak menghapus tabel database di backend agar tetap kompatibel dengan ekosistem database utama, namun mengisolasi aplikasi frontend ini agar 100% hanya mengoperasikan alur Laporan Kerja Digital, Pelanggan, Lokasi Proyek/Penugasan, dan Tim.
  - *Why*: Menjaga integritas data bersama tanpa risiko merusak struktur tabel yang ada.

---

## F. Technical Architecture & Data Strategy (4. Technical Reference)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                 SISTEM LAPORAN KERJA DIGITAL & PELANGGAN                 │
├────────────────────────────────────┬─────────────────────────────────────┤
│         ADMIN OPERASIONAL          │          TEKNISI LAPANGAN           │
│                                    │                                     │
│  ┌──────────────────────────────┐  │  ┌───────────────────────────────┐  │
│  │ 1. Dashboard Laporan Kerja   │  │  │ 1. Daftar Penugasan Lokasi    │  │
│  │    - KPI & Efisiensi Kerja   │  │  │    Pelanggan Hari Ini         │  │
│  │    - Tren & Kategori Layanan │  │  └───────────────┬───────────────┘  │
│  │    - Pelanggan & Garansi     │  │                  ▼                  │
│  ├──────────────────────────────┤  │  ┌───────────────────────────────┐  │
│  │ 2. Laporan Kerja Digital     │  │  │ 2. Eksekusi Laporan Digital   │  │
│  │    - Verifikasi & Anomali    │  │  │    - Check-in Koordinat GPS   │  │
│  │    - Ekspor Laporan PDF      │  │  │    - Foto Dokumentasi Kerja   │  │
│  ├──────────────────────────────┤  │  │    - Detail Treatment & Hama  │  │
│  │ 3. Penugasan & Lokasi Proyek │  │  │    - Tanda Tangan & Check-out │  │
│  ├──────────────────────────────┤  │  └───────────────┬───────────────┘  │
│  │ 4. Data Pelanggan & Garansi  │  │                  ▼                  │
│  ├──────────────────────────────┤  │  ┌───────────────────────────────┐  │
│  │ 5. Lacak Peta & GPS Teknisi  │  │  │ 3. Riwayat Laporan Kerja      │  │
│  ├──────────────────────────────┤  │  │    & Sinkronisasi Offline     │  │
│  │ 6. Manajemen Tim & Kop PDF   │  │  └───────────────────────────────┘  │
│  └──────────────────────────────┘  │                                     │
└────────────────────────────────────┴─────────────────────────────────────┘
```

### Interactive Component & State Mapping
- **Router & Navigasi Utama**: Hanya merender rute otentikasi, workspace utama (`AdminDashboard` untuk Admin Operasional, `FieldLayout` untuk Teknisi Lapangan), dan profil pengguna.
- **State Dashboard Admin**: Menghitung seluruh indikator KPI murni dari koleksi `WorkReport`, `Project`, `Customer`, dan `User` tanpa memanggil atau menggabungkan state `QuotationSummary`.
- **State Eksekusi Teknisi**: Berfokus pada transisi status sesi kunjungan aktif (`activeVisit`: Check-in -> Dokumentasi Foto -> Form Treatment -> Tanda Tangan -> Submit `WorkReport`).

---

## G. Risk & Impact Analysis

- **Potensi Risiko**: Penghapusan pemanggilan ringkasan penawaran (`quotationSummary`) pada komponen Bento Dashboard harus memastikan tidak ada properti yang menjadi `undefined` saat merender sub-tab laporan dan pelanggan.
- **Mitigasi**: Menyediakan nilai default yang bersih pada komponen analitik serta menghapus komponen funnel Penawaran dari tab pelanggan sehingga seluruh kartu menggunakan data `WorkReport` dan `Customer`.
- **Regresi Terhadap Fitur Eksisting**: Fitur pembuatan Laporan Kerja Digital, ekspor PDF Laporan Kerja, pemantauan anomali GPS, manajemen lokasi proyek/SPK, dan manajemen data pelanggan tetap berjalan utuh 100%.

---

## H. Validation Plan

1. **Verifikasi Kompilasi & Statik (`compile_applet` & `lint_applet`)**: Memastikan tidak ada error TypeScript, import yang tidak terpakai, atau referensi variabel yang hilang.
2. **Verifikasi Antarmuka Admin Operasional**:
   - Memastikan sidebar hanya menampilkan menu Laporan Kerja Digital, Penugasan & Lokasi Proyek, Data Pelanggan, Lacak Peta GPS, serta Manajemen Tim & Kop PDF (tanpa menu Penawaran PH, Gudang, dan Keuangan).
   - Memastikan Dashboard tidak lagi menampilkan Funnel Leads/Penawaran atau irisan Survey Penawaran.
3. **Verifikasi Antarmuka Teknisi Lapangan**:
   - Memastikan tampilan teknisi hanya menyajikan alur pengerjaan Laporan Kerja Digital (Check-in, Foto, Treatment, TTD, Riwayat) tanpa tombol pembuatan proyek baru.

---

## I. Approval Checkpoint

> **STATUS: WAITING FOR APPROVAL — Tidak ada perubahan yang akan dilakukan sebelum mendapatkan persetujuan eksplisit dari user.**
