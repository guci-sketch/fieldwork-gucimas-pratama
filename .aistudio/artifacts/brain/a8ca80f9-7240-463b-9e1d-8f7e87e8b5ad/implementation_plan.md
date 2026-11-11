# Penyederhanaan Sistem 2 Peran, Perbaikan Kontras Brand & Konsistensi UI Minimalis

Rencana ini menyederhanakan aplikasi Fieldwork menjadi sistem operasional terfokus untuk dua peran utama (**Admin Operasional** dan **Teknisi Lapangan**), memperbaiki keterbacaan identitas **Fieldwork** pada sidebar hijau tua, menata keseimbangan grid kartu **Ringkasan Performa**, serta membersihkan simbol pagar (`#`), tanda garis pisah panjang (`—`), dan ikon dekoratif berlebih di seluruh antarmuka.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Seluruh preferensi telah dikonfirmasi pada tahap klarifikasi dan menjadi landasan utama eksekusi tanpa memutus kompatibilitas database yang berjalan.

- **Confirmed Decision 1 — Fokus Penuh pada 2 Role Utama (`Admin Operasional` & `Teknisi Lapangan`)**: Menghapus tampilan serta opsi peran lain (Direktur/Superadmin, Marketing, Inventory/Gudang, Master Super Admin) dari seluruh antarmuka, formulir pembuatan pengguna, undangan, panduan, dan filter. Akun di database yang sebelumnya memiliki label peran administratif atau divisi non-teknisi secara otomatis dipetakan menjadi **Admin Operasional** (`ADMIN`) agar tetap kompatibel dengan skema database bersama tanpa error.
- **Confirmed Decision 2 — Pembersihan Simbol Pagar (`#`) & Tanda Garis Pisah Panjang (`—`)**: Menghilangkan seluruh badge simbol `#`, penomoran `#1 / #2 / #3` pada peringkat atau daftar item, serta tanda pisah panjang (`—`) atau simbol dekoratif (`≡`, `⊞`, `⊡`, `•`) pada teks antarmuka, menggantinya dengan tata letak tipografi bersih.
- **Confirmed Decision 3 — Minimalisasi Ikon (Pertahankan Ikon Navigasi Sidebar Utama)**: Mempertahankan ikon fungsional hanya pada menu navigasi utama sidebar, serta menghapus ikon dekoratif pada kartu metrik, header panel, lencana status, dan tombol aksi agar tampilan terlihat rapi, tenang, dan profesional.
- **Confirmed Decision 4 — Perbaikan Keterbacaan Nama "Fieldwork" & Konsistensi Kartu "Ringkasan Performa"**: Mengubah warna teks utama wordmark **Fieldwork** di header sidebar menjadi putih bersih dengan aksen hijau muda lembut (`#a9c9b4`) sehingga kontras tajam di atas latar `#173f30`, serta menyelaraskan tinggi kartu, tipografi Title Case, dan struktur baris pada **Ringkasan Performa**.

---

## 1. Overview & Core Concept

- **What It Does**: Menyajikan platform operasional dan dokumentasi lapangan yang ringkas, cepat dipindai, dan bebas distraksi visual bagi tim kantor maupun pelaksana lapangan.
- **Target Audience / Persona**:
  1. **Admin Operasional**: Mengelola penjadwalan SPK & proyek, memantau kehadiran GPS, memverifikasi laporan kerja & anomali, serta memantau ringkasan performa tim dari satu konsol terpadu.
  2. **Teknisi Lapangan**: Menjalankan check-in GPS, mengambil dokumentasi foto ber-watermark, mengisi catatan treatment, dan melakukan check-out dari perangkat mobile.
- **Key Value**: Menghilangkan kerumitan multi-role dari versi CMS penuh dan menghapus ornamen visual berlebih (ikon bertumpuk, simbol `#`, garis pisah `—`), menghasilkan antarmuka kelas enterprise yang tegas dan mudah digunakan.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Alur Masuk & Pemilihan Akun Demo**: Pengguna melihat halaman masuk yang bersih tanpa lencana atau ikon dekoratif, dengan 2 pilihan akun demo instan: **Admin Operasional** dan **Teknisi Lapangan**.
  2. **Alur Navigasi Sidebar & Header**: Saat Admin Operasional membuka aplikasi, wordmark **Fieldwork** pada pojok kiri atas sidebar langsung terbaca jelas dengan kontras tinggi di atas latar hijau hutan (`#173f30`). Menu navigasi menampilkan modul-modul operasional yang relevan tanpa pemisahan hak akses Direktur/Marketing/Gudang.
  3. **Alur Evaluasi Ringkasan Performa**: Pada tab **Performance Team**, ke-6 kartu radial dan kartu **Efisiensi Operasional** tampil sejajar dengan tinggi seragam (`h-full`), ukuran teks proporsional, label yang konsisten (*Rata-rata Waktu Mulai*, *Rata-rata Waktu Selesai*, *Rata-rata Durasi Tugas*), dan ruang kosong yang seimbang pada kartu tanpa sub-teks tren.
  4. **Alur Manajemen Staf & Panduan**: Saat Admin menambahkan pengguna baru, membuat tautan undangan, atau membuka panduan penggunaan, pilihan peran hanya terdiri dari **Admin Operasional** dan **Teknisi Lapangan**.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Utilitarian Enterprise Minimalist — mengutamakan ketajaman tipografi, keseimbangan ruang putih, dan angka tabular tanpa dekorasi ikon atau simbol buatan.
  - *Color Palette & Mood*:
    - Kanvas Utama: Slate terang bersih (`--bg-primary: #f4f6f9`) dan permukaan kartu putih (`--bg-card: #ffffff`) dengan garis batas halus (`--border-subtle: #dde2eb`).
    - Sidebar Navigasi: Hijau hutan gelap (`#173f30`) dengan teks wordmark putih (`#ffffff`) dan aksen sekunder hijau sage terang (`#a9c9b4`) untuk kontras optimal (WCAG AAA).
    - Aksen Semantik: Biru operasional (`#2563eb`), Hijau selesai (`#10b981`), Kuning tunda (`#f59e0b`), dan Merah perhatian (`#ef4444`).
  - *Typography & Hierarchy*:
    - Menggunakan `Outfit` / `Inter` untuk judul dan navigasi dengan kontras bobot yang rapi (Regular 400 & Bold 700), dipadukan dengan `JetBrains Mono` (`tabular-nums`) untuk seluruh persentase, durasi, dan angka metrik.
    - Menghapus penggunaan huruf kecil semua (*all-lowercase*) pada label metrik efisiensi dan menyeragamkannya ke *Title Case* atau *Sentence Case* yang konsisten.
  - *Component Styling & Layout*:
    - Kartu metrik di dalam grid 12 kolom menggunakan `h-full flex flex-col justify-between` dengan tinggi minimum seragam sehingga kolom ke-1, ke-2, ke-3, dan kartu **Efisiensi Operasional** di kolom ke-4 sejajar sempurna di bagian atas maupun bawah.
    - Tombol aksi dan header seksi hanya menampilkan teks lugas tanpa imbuhan simbol `#`, `—`, `≡`, atau ikon di samping teks.

- **Interactive Feedback & Motion**:
  - Transisi antar-tab dan hover kartu berlangsung cepat ($\le 180\text{ms}$) menggunakan perubahan warna batas (`border-color`) dan latar halus tanpa animasi berlebih.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Pemetaan Otomatis Peran Database ke 2 Peran Inti**
  - *Chosen Approach*: Menyeragamkan seluruh logika otorisasi aplikasi ke dua peran: `ADMIN` (**Admin Operasional**) dan `TEKNISI_LAPANGAN` (**Teknisi Lapangan**). Apabila database mengembalikan nilai peran warisan dari CMS penuh (seperti `SUPERADMIN`, `MARKETING`, `INVENTORY`, atau `MASTER_SUPER_ADMIN`), lapisan pemetaan profil secara transparan memetakannya ke `ADMIN`.
  - *Why*: Menjamin kompatibilitas 100% dengan tabel dan enum PostgreSQL/Supabase yang sudah ada tanpa perlu mengubah isi tabel pengguna eksisting, sekaligus memastikan antarmuka murni hanya mengenal 2 peran.
  - *Alternatives Considered*: Mengubah enum PostgreSQL secara langsung — berisiko merusak kompatibilitas dengan aplikasi CMS utama yang berbagi database yang sama.

- **Decision 2: Grid Simetris pada Ringkasan Performa (Image 2)**
  - *Chosen Approach*: Menetapkan tinggi penuh (`flex-1 h-full min-h-[138px]`) pada setiap `JarivisRadialMetricCard` di dalam kolom vertikal serta menambahkan baris keterangan pembanding yang konsisten pada kartu **Rata-rata Tugas Ditugaskan per Anggota** dan **Rata-rata Tugas Selesai per Anggota**, sekaligus merapikan kartu **Efisiensi Operasional** (label *Title Case*, penghapusan garis dekoratif kosong di sisi kanan, dan format durasi yang jelas).
  - *Why*: Pada Image 2 terlihat kolom ke-3 tampak menggantung (lebih pendek dari kolom ke-1, ke-2, dan ke-4) karena dua kartu di kolom ke-3 tidak memiliki baris footer tren, dan kartu **Efisiensi Operasional** memiliki label huruf kecil semua serta garis kosong di kanan yang tampak seperti elemen belum selesai.

- **Decision 3: Disiplin Ikon Minimalis & Penghapusan Simbol Hash/Dash**
  - *Chosen Approach*: Mempertahankan ikon hanya pada item navigasi utama sidebar untuk orientasi spasial cepat, sementara seluruh tombol aksi (`Buat Akun`, `Salin Link`, `Muat Ulang`, `Export`, dll.), header seksi, kartu KPI, dan daftar peringkat menggunakan tipografi murni dan badge angka bersih (`1`, `2`, `3` tanpa `#`).
  - *Why*: Mengurangi kebisingan visual (*visual clutter*) sehingga perhatian pengguna langsung tertuju pada data operasional dan tindakan utama.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Database & Auth Session                           │
│   (Shared PostgreSQL / Supabase — Existing Enum & User Records Intact)   │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                 Role Normalization Layer (2-Role Mapper)                 │
│  • TEKNISI_LAPANGAN  ──► Teknisi Lapangan (Mobile Field Execution View)  │
│  • ADMIN / Legacy    ──► Admin Operasional (Unified Operations Console)  │
└───────────────┬──────────────────────────────────────────┬───────────────┘
                │                                          │
                ▼                                          ▼
┌───────────────────────────────────────┐  ┌───────────────────────────────┐
│      Admin Operasional Console        │  │    Teknisi Lapangan View      │
│  ┌─────────────────────────────────┐  │  │  • Tugas Aktif & Check-In GPS │
│  │ Sidebar (#173f30 Forest Green)  │  │  │  • Dokumentasi Foto & Dosis   │
│  │  • Wordmark: Fieldwork (Putih   │  │  │  • Tanda Tangan & Check-Out   │
│  │    & Sage #a9c9b4, Kontras 100%)│  │  │  • Teks Bersih Tanpa Hash/#   │
│  │  • Ikon Navigasi Menu Utama     │  │  └───────────────────────────────┘
│  └─────────────────────────────────┘  │
│  ┌─────────────────────────────────┐  │
│  │ Ringkasan Performa (Bento Grid) │  │
│  │  • 4 Kolom Sejajar (Equal H)    │  │
│  │  • 6 Kartu Radial + Footer Tren │  │
│  │  • Kartu Efisiensi Operasional  │  │
│  │    (Title Case & Layout Rapi)   │  │
│  └─────────────────────────────────┘  │
│  ┌─────────────────────────────────┐  │
│  │ Manajemen Staf & Panduan Role   │  │
│  │  • Hanya 2 Pilihan Role         │  │
│  │  • Tombol & Kartu Minim Ikon    │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
```

- **Data Model & State**:
  - **Normalisasi Peran (`UserRole`)**: Seluruh pengecekan hak akses di sisi klien disederhanakan menjadi `ADMIN` (Admin Operasional) dan `TEKNISI_LAPANGAN` (Teknisi Lapangan). Semua fitur operasional di konsol Admin terbuka penuh bagi `ADMIN` tanpa pemisahan `isDirector`, `isMarketingUser`, atau `INVENTORY`.
  - **Identitas Brand Sidebar**: Komponen header sidebar menggunakan kelas warna eksplisit `text-white` untuk kata `Field` dan `text-[#a9c9b4]` untuk kata `work`, serta memastikan aturan CSS container sidebar tidak menimpa kontras teks judul.

- **Interactive Component & State Mapping**:
  - **Halaman Login & Aktivasi Undangan**: Menampilkan 2 tombol akun demo (`Admin Operasional` & `Teknisi Lapangan`) tanpa ikon kilau/dekoratif, serta memformat teks tampilan peran undangan hanya ke 2 peran tersebut.
  - **Grid Ringkasan Performa**:
    - Menyusun 6 `JarivisRadialMetricCard` dengan tinggi penuh (`flex-1`) dan struktur 3 bagian yang konsisten (Judul, Ring + Angka Utama, dan Baris Sub-keterangan/Tren) sehingga tinggi kartu di kolom 1, 2, dan 3 identik dengan kartu `JarivisEfficiencyCard` di kolom 4.
    - Memperbarui `JarivisEfficiencyCard` agar menggunakan label *Rata-rata Waktu Mulai*, *Rata-rata Waktu Selesai*, dan *Rata-rata Total Durasi* dengan tata letak bersih tanpa garis placeholder kosong di sisi kanan.
  - **Pembersihan Simbol `#` dan `—` Menyeluruh**:
    - Menghapus lingkaran `#` pada header *Beban Kerja Saat Ini*.
    - Mengubah lencana peringkat `#1`, `#2`, `#3` pada *Leaderboard Anggota Terbaik* menjadi angka bersih `1`, `2`, `3`.
    - Mengubah label seperti `Item Pekerjaan #1` atau `DOKUMENTASI PROGRES #1` menjadi `Item Pekerjaan 1` dan `Dokumentasi Progres 1`.
    - Mengganti tanda pisah panjang (`—`) pada judul halaman, toast, log audit, dan keterangan menjadi pemisah spasi atau titik dua yang bersih.
    - Menghapus ikon dekoratif pada tombol dan header kartu di seluruh modul sambil tetap menjaga ikon menu utama di sidebar.
