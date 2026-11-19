# Product Requirement Document (PRD) & Project Brief
## Aplikasi Lapangan: GuciMas Pratama (Field Technician Lite)

---

### 1. Ringkasan Eksekutif & Konsep Produk (Project Overview)
**GuciMas Pratama Fieldwork Lite** adalah aplikasi seluler operasional lapangan (*field service execution mobile app*) yang dirancang khusus untuk teknisi pest control dan termite management (pengendalian hama & anti rayap). Aplikasi ini menggantikan pencatatan manual/kertas menjadi alur digital terpadu, menjamin kecepatan input di lapangan dengan kondisi minim sinyal, serta memfasilitasi transparansi pelaporan ke pelanggan melalui WhatsApp dan dokumen PDF Berita Acara yang rapi dan profesional.

#### Nilai Inti & Filosofi Desain
1. **Show what matters, reveal what is needed (Progressive Disclosure)**: Antarmuka bersih, menghindari beban kognitif di lapangan terbuka maupun ruangan gelap (basement/plafon).
2. **Offline-First & Auto-Queue**: Operasional lapangan tidak boleh terhenti saat konektivitas hilang; data disimpan lokal dan siap disinkronkan.
3. **Pemisahan Tegas & Khusus**: Layanan **Anti Rayap** dan **Pest Control Umum** memiliki karakteristik temuan, metode penanganan, dan format laporan tersendiri.
4. **Kejujuran Evaluasi (Confidential Client Feedback)**: Evaluasi & rating klien bersifat rahasia dan independen melalui modal pop-up khusus yang tidak dapat diintip atau diedit oleh teknisi di lapangan.

---

### 2. Sasaran Pengguna & Persona (Target Users)
* **Teknisi Lapangan (Primary Persona - Agus Riyadi)**:
  - Lingkungan kerja: Dari area luar ruangan di bawah terik matahari hingga area minim cahaya (basement pilar fondasi, ruang arsip sempit, loteng).
  - Kebutuhan: Input cepat dengan sekali ketuk, formulir tanpa birokrasi rumit, tombol besar yang mudah ditekan, dukungan mode gelap (*Dark Mode*).
* **Klien / Customer / Pengelola Gedung (Secondary User)**:
  - Peran: Penerima hasil kerja, menandatangani Berita Acara di perangkat teknisi, dan memberikan skor/ulasan kepuasan secara rahasia.
  - Kebutuhan: Menerima ringkasan formal via WhatsApp dan file PDF resmi tanpa instalasi aplikasi tambahan.
* **Manajemen & Koordinator Operasional**:
  - Kebutuhan: Rekap data pekerjaan, status sinkronisasi, dan hasil feedback klien yang transparan dan akurat.

---

### 3. Fitur Utama & Kebutuhan Fungsional (Functional Requirements)

#### Modul 1: Beranda & Manajemen Tugas Harian (Task Management)
* **Konektivitas Ringkas**: Indikator sederhana status *Online* / *Offline* di area header (dekat profil), bebas dari badge teknis berlebihan (seperti GPS optimal/tersinkron).
* **Tampilan Tugas**:
  - State Terbuka (*Expanded*): Rincian tugas aktif, jam pengerjaan, lokasi instansi/klien, serta aksi cepat menuju lembar kerja.
  - State Tertutup (*Collapsed*): Ringkasan ringkas jumlah tugas hari ini untuk teknisi yang menginginkan tampilan ekstra minimalis.
* **Klasifikasi Pekerjaan**: Tag label yang konsisten membedakan **Anti Rayap** vs **Pest Control**.

#### Modul 2: Lembar Kerja & Formulir Input Laporan (Inspection & Execution)
* **Alur Input 5-Tahap Terpadu**:
  1. **Detail Temuan Per Hama**:
     - *Anti Rayap*: Pilihan spesies (*Rayap Kayu Kering*, *Rayap Tanah*, opsi kustom), penanda sarang/mud tube, estimasi keparahan (*Ringan*, *Sedang*, *Kritis*), dan estimasi populasi koloni.
     - *Pest Control*: Pilihan hama umum (Kecoa, Tikus, Nyamuk, Semut) dengan hitung jumlah temuan ekor/titik.
  2. **Tindakan Treatment / Metode**:
     - Checkbox metode baku (Injeksi Termitisida Cair, Umpan Rayap, Pengasapan Fogging, Mist Blower, Dusting, Cold Fogging) serta opsi tindakan kustom.
  3. **Area Tindakan & Perlindungan**:
     - Multi-pilihan lokasi (Basement, Ruang Arsip, Plafon, Pantry, Perimeter Luar Gedung) dengan penanda prioritas.
  4. **Saran & Rekomendasi Teknisi**:
     - Catatan langsung untuk perbaikan sanitasi/kelembaban klien dilengkapi chip rekomendasi instan (*Sirkulasi Udara*, *Jadwal 14 Hari*, dll.).
  5. **Pengesahan Lapangan Dua Tahap**:
     - Tahap 1: Validasi tanda tangan digital teknisi penanggung jawab.
     - Tahap 2: Input nama perwakilan klien (termasuk status jika diwakilkan seperti Supervisor GA, Satpam, atau PIC), jabatan, dan tombol pembuka tanda tangan layar penuh.

#### Modul 3: Modal Rahasia Feedback Klien (Confidential Client Feedback)
* **Mekanisme Otomatis**: Muncul sesaat setelah tanda tangan klien dibubuhkan.
* **Rating Bintang Interaktif**: Penilaian 1 hingga 5 bintang bergaya familiar (seperti aplikasi consumer modern) dengan penanda kepuasan langsung (*Sangat Puas, Cepat & Bersih*).
* **Tag Kategori Penilaian Cepat**: Chip ulasan (*Petugas Ramah*, *Pekerjaan Rapi*, *Tepat Waktu*, *Penjelasan Jelas*).
* **Privasi Penuh**: Data rating langsung terenkripsi dan disimpan tanpa dimunculkan di riwayat teknisi di lapangan.

#### Modul 4: Pratinjau Dokumen PDF & Pengiriman WhatsApp
* **Pemisahan Dokumen Berita Acara**:
  - Dokumen khusus Anti Rayap (menyoroti denah injeksi, bahan aktif termitisida, masa garansi/inspeksi).
  - Dokumen khusus Pest Control (menyoroti jenis hama, metode sanitasi, catatan sanitasi gedung).
* **Integrasi WhatsApp**:
  - Pesan formal, ringkas, santun, dan hangat dengan format draf instan menuju nomor PIC/penerima tanpa teks birokrasi berbelit.
* **Handling Status Offline & Antrean (Outbox Queue)**:
  - Tombol *"Simpan di Antrean"* jika pengiriman jaringan seluler gagal, dengan notifikasi pengingat untuk kirim ulang saat sinyal pulih.

#### Modul 5: Riwayat Pekerjaan (Job Archive & History)
* **Pencarian & Filter Periode**: Filter berbasis rentang tanggal (*Dari Tanggal - Sampai Tanggal*) dan bilah pencarian nama gedung/klien.
* **Kartu Terpadu**: Tombol aksi tunggal konsisten *"Lihat Detail"* yang menggabungkan seluruh bukti foto (min. 6 foto sebelum-sesudah) dan berkas laporan.

#### Modul 6: Profil Teknisi & Personalisasi Tema
* **Profil Sederhana**: Menampilkan foto, nama lengkap, NIP, nomor kontak pribadi teknisi, dan status lugas *"Teknisi"*.
* **Metrik Kinerja**: Ringkasan tugas bulanan, persentase keterkiriman laporan, dan skor kepuasan rata-rata.
* **Manajemen Penyimpanan**: Pembersihan cache foto dan pemantauan berkas antrean offline.
* **Theme Switcher**: Dukungan beralih instan antara **Mode Terang (Light Mode)** dan **Mode Gelap (Dark Mode)** untuk kenyamanan kerja di area minim cahaya.

#### Modul 7: Pusat Notifikasi Interaktif
* Filter notifikasi (*Semua*, *Tugas*, *Sistem & Offline*).
* Tautan dalam langsung (*deep-links*) ke detail tugas baru, antrean sinkronisasi offline, dan arsip terkirim.

---

### 4. Spesifikasi Desain & Visual (Design System Tokens)
* **Design System**: *Field Technician Lite*
* **Warna Primer**: Deep Forest Green (`#1b4332`) — mencerminkan sanitasi, ketenangan lingkungan, dan profesionalitas.
* **Warna Permukaan & Latar**:
  - Light Mode: Latar dingin lembut (`#f8f9ff`), kartu permukaan kontainer (`#ffffff` / `#eff4ff`).
  - Dark Mode: Slate gelap arang (`#0B0F17` / `#161E2E`), kontras tinggi bebas silau.
* **Tipografi**: Inter (Sistem font sans-serif modern, hierarki tegas, mudah dibaca pada layar perangkat bergerak).
* **Corner Radius**: Rounded-4 (sudut membulat 12px - 16px untuk kartu sentuh yang ramah jari).
* **Gaya Ikonografi**: Minimalis fungsional, tanpa ikon dekoratif yang tidak memberikan nilai operasional.

---

### 5. Roadmap & Tahapan Rilis (Milestones)
1. **Fase 1 (MVP Rilis Cepat)**: Form input 5 tahap, tanda tangan digital, modal feedback rahasia klien, dan preview PDF Anti Rayap & Pest Control.
2. **Fase 2 (Offline Reliability & WA Bridge)**: Antrean sinkronisasi lokal saat offline, integrasi pesan WhatsApp otomatis, dan Dark Mode penuh.
3. **Fase 3 (Pusat Notifikasi & Dashboard Kinerja)**: Integrasi notifikasi push tugas baru dan rekap performa bulanan teknisi.
