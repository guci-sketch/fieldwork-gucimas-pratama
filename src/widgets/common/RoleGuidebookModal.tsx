import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/shared/hooks/useAuth';

interface RoleGuidebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: string;
}

type GuideRoleKey = 'ADMIN' | 'TEKNISI_LAPANGAN';

interface RoleGuideSection {
  title: string;
  items: string[];
}

interface RoleGuideData {
  key: GuideRoleKey;
  title: string;
  subtitle: string;
  badgeColor: string;
  summary: string;
  menus: string[];
  workflows: RoleGuideSection[];
  restrictions: string[];
}

const ROLE_GUIDES: RoleGuideData[] = [
  {
    key: 'ADMIN',
    title: 'Admin Operasional',
    subtitle: 'Kendali Laporan Kerja Digital, Data Pelanggan, Penugasan Lokasi & Verifikasi PDF',
    badgeColor: 'bg-emerald-600 text-white border-emerald-500',
    summary:
      'Mengelola operasional Laporan Kerja Digital dan Data Pelanggan: memantau dashboard efisiensi kerja, mengelola direktori pelanggan & garansi rayap, menjadwalkan penugasan lokasi proyek (SPK), memantau posisi GPS teknisi, serta memverifikasi dan mengunduh PDF Laporan Kerja Digital.',
    menus: [
      'Dashboard Laporan Kerja (Operation Center, Live Map, Performance Team, Pelanggan & Kontrak)',
      'Laporan Kerja Digital (Verifikasi, Filter Anomali GPS & Ekspor PDF)',
      'Penugasan & Lokasi Proyek (Jadwal SPK & Titik Koordinat GPS)',
      'Data Pelanggan & Garansi (Direktori Klien & Pemantauan Kontrak)',
      'Lacak Peta & GPS Teknisi (Posisi Aktif & Riwayat Rute Perjalanan)',
      'Manajemen Tim & Akun (Admin Operasional & Teknisi Lapangan)',
      'Pengaturan Kop PDF & Audit (Kop Surat, TTD Direktur & Aturan Poin Risiko)',
    ],
    workflows: [
      {
        title: '1. Data Pelanggan & Penugasan Lokasi Proyek',
        items: [
          'Daftarkan data pelanggan beserta titik koordinat GPS lokasi proyek dan masa berlaku kontrak/garansi.',
          'Jadwalkan penugasan kerja (SPK) untuk Teknisi Lapangan lengkap dengan target layanan dan radius geofence lokasi klien.',
        ],
      },
      {
        title: '2. Pemantauan Lapangan & Verifikasi Laporan Kerja Digital',
        items: [
          'Pantau kehadiran, efisiensi waktu mulai/selesai, dan posisi GPS teknisi secara langsung di Dashboard dan Lacak Peta.',
          'Periksa Laporan Kerja Digital yang selesai atau memerlukan peninjauan (Flagged), lalu berikan catatan verifikasi dan unduh PDF Laporan Kunjungan.',
        ],
      },
      {
        title: '3. Manajemen Akun Tim & Pengaturan Kop PDF',
        items: [
          'Kelola akun Admin Operasional dan Teknisi Lapangan atau bagikan tautan undangan mandiri pada menu Manajemen Tim & Akun.',
          'Sesuaikan tampilan kop surat perusahaan, tanda tangan direktur, dan batas toleransi radius GPS pada menu Pengaturan Kop PDF & Audit.',
        ],
      },
    ],
    restrictions: [
      'Pastikan titik koordinat GPS lokasi pelanggan sudah akurat sebelum menugaskan Teknisi Lapangan.',
      'Setiap perubahan konfigurasi poin risiko dan verifikasi laporan tercatat otomatis pada Riwayat Audit Sistem.',
    ],
  },
  {
    key: 'TEKNISI_LAPANGAN',
    title: 'Teknisi Lapangan',
    subtitle: 'Pembuatan Laporan Kerja Digital (Check-In GPS, Foto, Treatment, TTD & Riwayat)',
    badgeColor: 'bg-teal-600 text-white border-teal-500',
    summary:
      'Melaksanakan pekerjaan pengendalian hama dan anti rayap di lokasi pelanggan serta menyusun Laporan Kerja Digital: melakukan Check-In GPS di lokasi, mendokumentasikan foto ber-watermark, mencatat treatment/tindakan lapangan, meminta tanda tangan klien, dan menyelesaikan Check-Out.',
    menus: [
      'Daftar Penugasan Lokasi Pelanggan Hari Ini',
      'Check-In / Check-Out GPS dengan Validasi Radius Haversine',
      'Kamera Dokumentasi Ber-watermark Otomatis (Before, Progress, After)',
      'Input Formulir Treatment & Dosis Pemakaian Bahan Aktif',
      'Tanda Tangan Digital Pelanggan & Teknisi di Layar',
      'Riwayat Laporan Kerja Digital & Sinkronisasi Offline-First',
    ],
    workflows: [
      {
        title: '1. Check-In GPS di Lokasi Pelanggan',
        items: [
          'Pilih lokasi pelanggan yang ditugaskan pada layar utama Teknisi Lapangan dan tekan mulai pekerjaan saat berada di lokasi.',
          'Sistem memvalidasi jarak koordinat GPS terhadap titik lokasi pelanggan dan mengambil foto dokumentasi awal.',
        ],
      },
      {
        title: '2. Foto Dokumentasi & Input Treatment',
        items: [
          'Ambil foto kondisi awal dan progres tindakan langsung dari kamera aplikasi (otomatis dilengkapi watermark waktu dan koordinat GPS).',
          'Isi metode aplikasi, nama bahan kimia, bahan aktif, dosis pemakaian, dan catatan teknis pada formulir treatment.',
        ],
      },
      {
        title: '3. Tanda Tangan Pelanggan & Penyelesaian Laporan Digital',
        items: [
          'Ambil foto selesai pekerjaan, mintakan ulasan serta tanda tangan digital perwakilan pelanggan pada layar, lalu kirim Laporan Kerja Digital.',
          'Jika sinyal internet lemah, Laporan Kerja Digital tersimpan aman di perangkat dan otomatis terkirim saat koneksi kembali stabil.',
        ],
      },
    ],
    restrictions: [
      'Check-In di luar radius lokasi pelanggan atau durasi pengerjaan yang tidak wajar akan otomatis ditandai untuk ditinjau Admin Operasional.',
    ],
  },
];

export const RoleGuidebookModal: React.FC<RoleGuidebookModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  const defaultRoleKey = (): GuideRoleKey => {
    if (user?.role === 'TEKNISI_LAPANGAN') return 'TEKNISI_LAPANGAN';
    return 'ADMIN';
  };

  const [selectedRole, setSelectedRole] = useState<GuideRoleKey>(defaultRoleKey);

  if (!isOpen) return null;

  const activeGuide = ROLE_GUIDES.find(g => g.key === selectedRole) ?? ROLE_GUIDES[0];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Panduan Penggunaan Sistem"
    >
      <div
        className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[var(--text-primary)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-primary)] shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
              Panduan Penggunaan Sistem
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Alur kerja standar untuk 2 peran utama: Admin Operasional dan Teknisi Lapangan
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panduan"
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Role Selector Tabs */}
        <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex flex-wrap items-center gap-2 shrink-0">
          {ROLE_GUIDES.map(guide => {
            const isSelected = guide.key === selectedRole;
            const isCurrentUserRole =
              (user?.role === 'TEKNISI_LAPANGAN' && guide.key === 'TEKNISI_LAPANGAN') ||
              (user?.role !== 'TEKNISI_LAPANGAN' && guide.key === 'ADMIN');

            return (
              <button
                key={guide.key}
                type="button"
                onClick={() => setSelectedRole(guide.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  isSelected
                    ? `${guide.badgeColor} shadow-xs`
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <span>{guide.title}</span>
                {isCurrentUserRole && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isSelected ? 'bg-black/20 text-white' : 'bg-emerald-500/15 text-emerald-600'
                    }`}
                  >
                    Peran Anda
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                {activeGuide.title}
              </h3>
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                {activeGuide.subtitle}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              {activeGuide.summary}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Cakupan Modul &amp; Menu Utama
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeGuide.menus.map((menu, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)]"
                >
                  {menu}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Alur Kerja Standar (SOP)
            </h4>
            <div className="grid grid-cols-1 gap-3">
              {activeGuide.workflows.map((wf, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] space-y-2"
                >
                  <h5 className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                    {wf.title}
                  </h5>
                  <ul className="space-y-1.5 text-xs text-[var(--text-secondary)] list-disc pl-4">
                    {wf.items.map((item, j) => (
                      <li key={j} className="leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Catatan Operasional
            </h4>
            <ul className="space-y-1 text-xs text-[var(--text-secondary)] list-disc pl-4">
              {activeGuide.restrictions.map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-primary)] flex items-center justify-between shrink-0">
          <span className="text-xs text-[var(--text-muted)]">
            PT Guci Emas Pratama · Sistem Operasional Fieldwork
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Mengerti &amp; Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
