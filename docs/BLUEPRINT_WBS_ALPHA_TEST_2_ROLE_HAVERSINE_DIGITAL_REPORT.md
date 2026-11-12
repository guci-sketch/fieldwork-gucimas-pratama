# Blueprint Arsitektur, WBS Planning, & Laporan Alpha Testing — Sistem 2 Role (Admin & Teknisi) Berfokus pada Geolocation Haversine & Digital Report

Dokumen ini disusun secara kolaboratif oleh **Ayling** (System Architect & Project Manager), **Izumi** (Human-Centered UX Microcopy & Cognitive Load Specialist, dengan alur pemodelan **Diara**), dan **Kei** (QA/QC Test Architect). Seluruh cakupan sistem pada dokumen ini difokuskan secara murni pada **2 Role (`ADMIN` dan `TEKNISI_LAPANGAN`)** dengan dua pilar inti: **Validasi Geolocation berbasis Rumus Haversine** dan **Digital Report (`Laporan Hasil Pekerjaan`)**, tanpa modul SPK, Penawaran (Quotation), Gudang (Inventory), maupun Keuangan.

## 1. Ruang Lingkup 2 Role & Prinsip Reduksi Beban Kognitif (Ayling & Izumi)

Sistem dirancang khusus untuk menyederhanakan koordinasi antara **Teknisi di lapangan (Mobile PWA)** dan **Admin Verifikasi di kantor (Web Desktop/Tablet)** dengan meminimalkan beban kognitif (*Miller's Law* & *Hick's Law*).

| Peran (Role) | Fokus Utama dalam Sistem | Hak Akses & Batasan Visibilitas (RBAC) | 
| ----- | ----- | ----- | 
| **1. `TEKNISI_LAPANGAN` (Mobile-First PWA)** | Eksekusi kunjungan lapangan, validasi kehadiran GPS Haversine, foto bukti ber-watermark, pengisian **Laporan Hasil Pekerjaan** (Anti Rayap / Pest Control), tanda tangan digital 2 tahap, pratinjau PDF, & kirim WhatsApp | Menggunakan **Floating Bottom Pill** (`Beranda`, `Tugas`, `Riwayat`, `Profil`), tampilan permukaan maksimal 4 sinyal inti (*Progressive Disclosure* *on-click*), **tanpa fitur QR**, dan **tidak dapat melihat isi Evaluasi Rahasia PIC (*Strict Blind Review*)** | 
| **2. `ADMIN` (Operational & Verification Dashboard)** | Penetapan titik koordinat & radius lokasi proyek, pemantauan jarak Haversine & anomali radius, verifikasi **Laporan Hasil Pekerjaan**, tindak lanjut eskalasi **Lapor Kendala**, serta pembacaan hasil **Evaluasi Rahasia PIC** | Memiliki akses penuh ke antrian **Perlu Tindakan**, rincian jarak check-in/out Haversine, galeri foto watermark GPS, dokumen PDF **Laporan Hasil Pekerjaan**, serta nilai bintang & ulasan rahasia dari PIC Klien | 

### 1.1 Prinsip Desain UI/UX Teknisi (`Stitch Redesign` + Sistem Sebelumnya)

| Dimensi UI/UX | Spesifikasi Implementasi pada Sistem 2 Role | 
| ----- | ----- | 
| **Navigasi Bawah (*Floating Bottom Pill*)** | Menggantikan bar statis bawah dengan kapsul melayang (`TabContainer`: `hideTopBar={true}`, `floatingOnAllScreens={true}`) yang otomatis tersembunyi (`showFloatingBottom={!isAnyModalOpen}`) saat kamera, tanda tangan, atau sub-alur kerja terbuka | 
| **Animasi & Touch Gestures** | Menggunakan `framer-motion` dari sistem sebelumnya: transisi layar `AnimatePresence mode="wait"`, *horizontal swipe gesture* (`drag="x"`) pada perpindahan tab hari (`Kemarin / Hari Ini / Besok`), akordion halus, dan umpan balik sentuh `whileTap={{ scale: 0.98 }}` | 
| **Progressive Disclosure & Microcopy Ringkas** | Kartu tugas hanya menampilkan 4 informasi utama di permukaan (ID/Jam, Judul Lokasi, Nama Klien, 1 Tombol Aksi). Rincian alamat, peta rute, cakupan kerja, dan parameter teknis hanya terbuka saat diklik (*on-click*) | 
| **Standarisasi Dokumen & Evaluasi Strict Blind** | Seluruh dokumen menggunakan istilah **Laporan Hasil Pekerjaan** (tanpa Berita Acara dan tanpa QR). Sesudah PIC menandatangani layar, form **Evaluasi Rahasia PIC** otomatis terbuka, wajib diisi oleh PIC, dan langsung dikunci/dienkripsi ke Admin tanpa bisa dilihat oleh Teknisi | 

## 2. Blueprint Arsitektur Geolocation Haversine & Digital Report (Diara & Ayling)

### 2.1 Spesifikasi Matematis & Algoritma Geolocation Haversine (`src/shared/utils/geo.ts`)

Untuk memastikan validitas kehadiran teknisi di titik lokasi pelanggan tanpa bergantung pada layanan berbayar pihak ketiga, sistem menghitung jarak bola bumi (*great-circle distance*) antara koordinat proyek $(\phi_1, \lambda_1)$ dan koordinat perangkat teknisi saat *Check-In* / *Check-Out* $(\phi_2, \lambda_2)$ menggunakan **Rumus Haversine**:

$$
\Delta\phi = \text{rad}(\phi_2 - \phi_1), \quad \Delta\lambda = \text{rad}(\lambda_2 - \lambda_1)
$$

$$
a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cdot\cos(\phi_2)\cdot\sin^2\left(\frac{\Delta\lambda}{2}\right)
$$

$$
c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1 - a}\right), \quad d = R \cdot c
$$

dengan $R = 6.371.000\text{ meter}$ (jari-jari rata-rata bumi) dan keputusan validasi geofence:

$$
\text{checkInValid} = \begin{cases} \text{true}, & \text{jika } d \le R_{\text{radius}} \text{ (default } 100\text{ m)} \\ \text{false (FLAGGED)}, & \text{jika } d > R_{\text{radius}} \end{cases}
$$

| Komponen / Fungsi Geolocation | Lokasi File Kode | Peran dalam Alur Validasi Haversine | 
| ----- | ----- | ----- | 
| `calculateDistanceMeters(point1, point2)` | `src/shared/utils/geo.ts` | Menghitung jarak $d$ (meter) secara presisi menggunakan rumus Haversine antara titik pusat lokasi klien dan koordinat GPS teknisi | 
| `isWithinRadius(userLoc, targetLoc, radiusMeters)` | `src/shared/utils/geo.ts` | Menentukan apakah posisi teknisi berada di dalam batas radius lokasi proyek ($d \le R_{\text{radius}}$) | 
| `hasProjectAnchor` (*Geofence Auto-Anchor*) | `src/shared/api/workReports.ts` & `CameraCaptureModal.tsx` | Jika lokasi pelanggan baru belum memiliki titik koordinat $(0,0)$, sistem otomatis mengunci koordinat *Check-In* pertama teknisi sebagai titik jangkar (*anchor*) proyek | 
| `applyWatermark(photoBlob, metadata)` | `src/shared/utils/watermark.ts` | Membubuhkan *watermark* permanen di atas kanvas foto berisi nama proyek, nama teknisi, waktu lokal, koordinat $(\phi_2, \lambda_2)$, dan jarak Haversine ($d\text{ meter}$) | 

### 2.2 Diagram Alur End-to-End 2 Role: Haversine Geolocation & Digital Report

```
flowchart TD
    subgraph TEKNISI ["ROLE 1: TEKNISI LAPANGAN (Mobile PWA)"]
        T1[Beranda Teknisi: 3-Metric Strip + Tugas Aktif] -->|On-Click Detail Rute & Scope| T2(Akordion Ringkas: Alamat, Rute & Kontak PIC)
        T1 -->|Klik Lapor Kendala| T3(Input Kendala Lapangan: Akses Terkunci / PIC Absen)
        T1 -->|Klik Mulai & Check-in| T4[Langkah 1: Akuisisi GPS & Hitung Jarak Haversine d]
        T4 -->|Ambil Foto Check-In Ber-Watermark GPS| T5[Langkah 2: Dokumentasi Foto Kondisi Awal & Hasil]
        T5 -->|Klik Lanjut Form Laporan| T6[Langkah 3: Input Digital Report Dual-Mode]
        T6 -->|Mode Anti Rayap| T6A[Chip Keparahan + Estimasi Koloni + Metode Injeksi/Baiting]
        T6 -->|Mode Pest Control| T6B[Chip Jumlah 1-5 / 6-15 / >20 + Kondisi Hama + Metode PCO]
        T6A --> T7[Langkah 4: Check-Out GPS Haversine & Tanda Tangan Teknisi]
        T6B --> T7
        T7 -->|Serahkan HP ke PIC Klien| T8[Langkah 5A: Tanda Tangan Digital PIC Lokasi]
        T8 -->|Otomatis Terbuka Sesudah TTD| T9[Langkah 5B: Evaluasi Rahasia PIC - Wajib Diisi 1-5 Bintang]
        T9 -->|Strict Blind Lock| T10[Langkah 6: Layar Bersih Teknisi + Pratinjau PDF A-E + Kirim WA]
    end

    subgraph ADMIN ["ROLE 2: ADMIN (Verification & Geolocation Dashboard)"]
        A1[Panel Perlu Tindakan Admin]
        A2[Verifikasi Digital Report & Audit Geolocation Haversine]
        A3[Rekap Evaluasi Rahasia PIC & Arsip PDF Laporan Hasil Pekerjaan]
    end

    T3 -->|Eskalasi Langsung fw_field_issues_v1| A1
    T4 -->|Jika d > Radius: Status FLAGGED| A1
    T10 -->|Sinkronisasi Online / Antrean IndexedDB| A2
    T9 -->|Dienkripsi Khusus Admin - Tertutup dari Teknisi| A3

```

### 2.3 Pemetaan Modul Digital Report & Geolocation pada Codebase

| Modul Fungsional (2 Role) | File Komponen Utama | Handler, State, & Mekanisme Data | 
| ----- | ----- | ----- | 
| **Beranda & Daftar Tugas Teknisi (*Progressive Disclosure*)** | `src/widgets/executor/ExecutorHome.tsx` (`page === 'home'`, `page === 'jobs'`) | `homeScopeExpanded`, `expandedTaskCardId`, `dayHorizon` (`YESTERDAY / TODAY / TOMORROW` dengan *swipe gesture* `drag="x"`), `TabContainer` (*Floating Bottom Pill*) | 
| **Akuisisi Kamera, GPS & Kalkulasi Haversine** | `src/widgets/camera/CameraCaptureModal.tsx` & `src/shared/utils/geo.ts` | `navigator.geolocation.getCurrentPosition`, `calculateDistanceMeters()`, `isWithinRadius()`, `checkIn()`, `checkOut()` | 
| **Form Digital Report Dual-Mode (`Anti Rayap` vs `Pest Control`)** | `src/widgets/executor/TreatmentFormModal.tsx` | `modeOverride` (`AR` vs `PCO`), `severityLevel` (`Ringan/Sedang/Kritis`), `colonyEstimate` (`< 500`, `1rb - 3rb`, `> 5.000`), `pestCondition`, akordion `showAdvancedTechDetails` & `showTeamSection` | 
| **Pengesahan 2 Tahap & Evaluasi Rahasia PIC (*Strict Blind*)** | `src/widgets/executor/CustomerReviewFormModal.tsx` | `step` (`SIGN_STAGE` -> otomatis `STRICT_BLIND_EVAL_STAGE`), `rating` (awal `0`, wajib dipilih PIC), `selectedTags` (wajib $\ge 1$), mengenkripsi tag `[STRICT_BLIND_PIC_REVIEW]` dan mengosongkan state lokal agar teknisi tidak bisa melihat | 
| **Pratinjau PDF `Laporan Hasil Pekerjaan` & Kirim WhatsApp** | `src/widgets/executor/ExecutorHome.tsx` & `src/shared/lib/visitReportPdf.ts` | `pdfPreviewReport` (Seksi `A` s.d. `E` *collapsible*), `waShareReport` (format pesan otomatis **Laporan Hasil Pekerjaan** & kirim langsung ke nomor WA PIC) | 
| **Antrean Offline & Sinkronisasi Otomatis** | `src/shared/utils/offlineQueue.ts` & `src/lib/indexedDB.ts` | `enqueue()`, `enqueueTreatment()`, `enqueueGps()`, `syncQueue()` saat koneksi internet pulih (`window.addEventListener('online')`) | 
| **Dashboard Verifikasi Admin & Eskalasi Kendala** | `src/widgets/admin/AdminDashboard.tsx` & `OperationsAnalyticsBento.tsx` | Panel **Perlu tindakan** membaca `fw_field_issues_v1` (kendala lapangan teknisi) dan laporan berstatus `FLAGGED` (check-in di luar radius Haversine) untuk diverifikasi Admin | 

## 3. Work Breakdown Structure (WBS) Planning — Fokus 2 Role (Ayling)

| Kode WBS | Paket Pekerjaan (Work Package) | Rincian Deliverable Teknis (2 Role: Admin & Teknisi) | PIC Agen | Status | 
| ----- | ----- | ----- | ----- | ----- | 
| **WBS-1.0** | **Arsitektur Geolocation Haversine & Geofence Engine** | Implementasi rumus Haversine, validasi radius, *auto-anchor*, & *watermark* foto bukti | Ayling & Kei | **SELESAI (100%)** | 
| **WBS-1.1** | Kalkulator Jarak Haversine & Evaluasi Radius (`geo.ts`) | Fungsi `calculateDistanceMeters`, `isWithinRadius`, dan `formatDistance` dengan akurasi meter | Ayling | **SELESAI (100%)** | 
| **WBS-1.2** | Kamera Bukti Lapangan & *Geofence Auto-Anchor* (`CameraCaptureModal.tsx`) | Perekaman koordinat $(\phi, \lambda)$, filter akurasi GPS ($\le 150\text{ m}$), penguncian titik pertama untuk lokasi baru, dan *watermark* otomatis | Ayling | **SELESAI (100%)** | 
| **WBS-2.0** | **Redesain UI/UX Teknisi Berbasis Kognitif, Animasi, & Floating Pill** | Integrasi desain Stitch (tanpa QR) + *Floating Bottom Pill* + *Framer Motion Gesture* | Ayling & Izumi | **SELESAI (100%)** | 
| **WBS-2.1** | *Progressive Disclosure* & Reduksi Microcopy (`ExecutorHome.tsx`) | Kartu ringkas maksimal 4 sinyal utama di permukaan; rincian rute, cakupan, dan parameter teknis dibuka *on-click* | Izumi | **SELESAI (100%)** | 
| **WBS-2.2** | Navigasi *Floating Bottom Pill* & Transisi/Swipe Gesture | `TabContainer` (`hideTopBar={true}`, `floatingOnAllScreens={true}`, auto-hide saat modal aktif) + `drag="x"` pada tab hari | Ayling | **SELESAI (100%)** | 
| **WBS-3.0** | **Digital Report (`Laporan Hasil Pekerjaan`) & Strict Blind Review PIC** | Form Dual-Mode AR/PCO, TTD 2 Tahap, Evaluasi Rahasia PIC, PDF Seksi A–E, & Kirim WA | Ayling & Izumi | **SELESAI (100%)** | 
| **WBS-3.1** | Form Digital Report Dual-Mode (`TreatmentFormModal.tsx`) | Mode Anti Rayap (keparahan & estimasi koloni) vs Mode Pest Control (rentang jumlah `1-5`, `6-15`, `>20` & kondisi hama) | Ayling | **SELESAI (100%)** | 
| **WBS-3.2** | Alur 2 Tahap Tanda Tangan & *Strict Blind Evaluation* PIC (`CustomerReviewFormModal.tsx`) | Sesudah PIC tanda tangan (`SIGN_STAGE`), form evaluasi (`STRICT_BLIND_EVAL_STAGE`) otomatis muncul, wajib diisi, dan tertutup rapat dari teknisi | Ayling & Izumi | **SELESAI (100%)** | 
| **WBS-3.3** | Generator PDF **Laporan Hasil Pekerjaan** (Bagian A–E) & Kirim WhatsApp | Pratinjau PDF *collapsible* Bagian A–E, unduh PDF resmi, dan kirim pesan otomatis ke WhatsApp PIC | Ayling | **SELESAI (100%)** | 
| **WBS-4.0** | **Dashboard Verifikasi Admin & Eskalasi Kendala Lapangan** | Pemantauan hasil kerja, audit jarak Haversine, eskalasi kendala, & pembacaan rating PIC | Ayling & Kei | **SELESAI (100%)** | 
| **WBS-4.1** | Integrasi `Lapor Kendala` Teknisi ke Panel **Perlu Tindakan** Admin | Sinkronisasi kendala lapangan (`fw_field_issues_v1`) dan anomali radius Haversine (`FLAGGED`) langsung ke antrian prioritas Admin | Ayling | **SELESAI (100%)** | 
| **WBS-5.0** | **Alpha Testing Menyeluruh Fokus 2 Role (Kei QA/QC)** | Pengujian Whitebox Haversine, Integrasi Digital Report, Offline Sync, & Strict Blind Privacy | Kei QA/QC | **SELESAI (100%)** | 

## 4. Laporan Alpha Testing — Fokus 2 Role: Haversine Geolocation & Digital Report (Kei QA/QC)

### 4.1 Matriks Risiko & Verifikasi Pengujian (Risk-Based Testing)

| ID Risiko | Skenario Risiko pada Alur 2 Role (Admin & Teknisi) | Dampak | Mitigasi Teknis & Bukti Verifikasi | Status Gate | 
| ----- | ----- | ----- | ----- | ----- | 
| **RSK-GEO-01** | Teknisi melakukan *Check-In* di luar radius lokasi proyek ($d > R_{\text{radius}}$) | Kritis | Rumus Haversine pada `geo.ts` menghitung selisih jarak secara riil; jika di luar radius, laporan otomatis diberi status `FLAGGED` dan masuk ke antrian **Perlu Tindakan** Admin | **PASS** | 
| **RSK-GEO-02** | Lokasi pelanggan baru belum memiliki titik koordinat di database $(0,0)$ sehingga memicu *false alarm* ribuan kilometer | Kritis | Guard `hasProjectAnchor` pada `workReports.ts` & `CameraCaptureModal.tsx` otomatis mengunci koordinat *Check-In* pertama sebagai titik acuan (*anchor*) proyek | **PASS** | 
| **RSK-REP-01** | Teknisi mengetahui nilai bintang/kritik yang diberikan oleh PIC Klien saat serah terima perangkat | Kritis | `CustomerReviewFormModal.tsx` menjalankan 2 tahap berurutan (`SIGN_STAGE` $\rightarrow$ `STRICT_BLIND_EVAL_STAGE` wajib diisi dengan bintang awal `0`), lalu menghapus state lokal dan hanya menampilkan `Evaluasi PIC Klien: Terkunci & Rahasia` di layar Teknisi | **PASS** | 
| **RSK-REP-02** | Kehilangan data foto dan **Laporan Hasil Pekerjaan** saat teknisi bertugas di area tanpa sinyal (*basement*) | Kritis | `offlineQueue.ts` menyimpan transaksi `CHECK_IN`, `PROGRESS`, `TREATMENT`, dan `CHECK_OUT` di `IndexedDB` dengan label jujur `Laporan Tersimpan di Antrean` hingga tersinkron ke server | **PASS** | 
| **RSK-UX-01** | Beban informasi berlebih di layar HP teknisi atau navigasi bawah menutupi tombol simpan | Tinggi | *Progressive Disclosure* menyembunyikan detail di balik akordion *on-click*, fitur QR telah dihapus, dan *Floating Bottom Pill* otomatis tersembunyi (`showFloatingBottom={!isAnyModalOpen}`) saat modal/kamera aktif | **PASS** | 

### 4.2 Daftar Test Case & Bukti Eksekusi Alpha Testing (Fokus Haversine & Digital Report)

| ID Test Case | Kategori Uji | Skenario Pengujian (Admin & Teknisi) | Kriteria Lulus (Expected Result) | Hasil Eksekusi | 
| ----- | ----- | ----- | ----- | ----- | 
| **ALPHA-GEO-01** (`WB-04`) | Whitebox Unit | Uji akurasi rumus Haversine (`calculateDistanceMeters` & `isWithinRadius`) pada `src/shared/utils/geo.ts` | Menghitung jarak bola bumi dalam satuan meter secara presisi dan memvalidasi apakah jarak $\le$ radius proyek | **PASS** | 
| **ALPHA-GEO-02** (`BB-13`) | Integration | Uji *Geofence Auto-Anchor* pada lokasi baru tanpa koordinat awal $(0,0)$ dan filter akurasi GPS perangkat | Check-in pertama mengunci titik jangkar baru tanpa *false-alarm* jarak jauh; sinyal GPS tidak akurat ($>150\text{ m}$) ditolak | **PASS** | 
| **ALPHA-REP-01** (`KEI-15/16`) | System / Functional | Uji pemisahan Digital Report **Laporan Hasil Pekerjaan** antara mode **Anti Rayap** vs **Pest Control** | Menampilkan chip keparahan & estimasi koloni pada Anti Rayap, serta stepper jumlah (`1-5`, `6-15`, `>20`) & kondisi hama pada Pest Control | **PASS** | 
| **ALPHA-REP-02** (`KEI-26`) | Security & Privacy | Uji alur **Strict Blind Evaluation PIC** sesudah tanda tangan (`SIGN_STAGE` $\rightarrow$ `STRICT_BLIND_EVAL_STAGE`) | Muncul otomatis sesudah tanda tangan PIC, menolak pengiriman jika bintang $= 0$, dan menyembunyikan hasil evaluasi dari seluruh layar Teknisi | **PASS** | 
| **ALPHA-REP-03** (`KEI-25`) | Usability & Document | Uji Pratinjau PDF **Laporan Hasil Pekerjaan** (Bagian A–E *collapsible*), Kirim WhatsApp, dan ketiadaan fitur QR / Berita Acara | Seluruh istilah menggunakan **Laporan Hasil Pekerjaan**, seksi A–E dapat dibuka/tutup per bagian, draf WA terisi otomatis, dan bebas dari tombol QR | **PASS** | 
| **ALPHA-ADM-01** (`KEI-07/25`) | Role Integration | Uji eskalasi **Lapor Kendala** teknisi (`fw_field_issues_v1`) dan laporan `FLAGGED` ke Dashboard Admin | Kendala lapangan dari teknisi dan anomali radius Haversine langsung tampil di panel **Perlu tindakan** pada Dashboard Admin (`OperationsAnalyticsBento.tsx`) | **PASS** | 
| **ALPHA-UX-01** (`KEI-20/22`) | UI/UX & Gesture | Uji *Floating Bottom Pill* (`TabContainer`), transisi halaman `AnimatePresence`, dan *swipe gesture* `drag="x"` pada tab hari | Navigasi bawah melayang tanpa bar ganda di atas, otomatis sembunyi saat kamera/modal aktif, dan tab hari merespons geseran jari secara mulus | **PASS** | 

**Keputusan Akhir Alpha Testing (Kei QA/QC):** **`PASS (100% Verified)`** — Arsitektur 2 Role (`ADMIN` & `TEKNISI_LAPANGAN`) dengan fokus **Geolocation Haversine** dan **Digital Report (`Laporan Hasil Pekerjaan`)** siap digunakan untuk pengujian lapangan dan dokumentasi proyek.