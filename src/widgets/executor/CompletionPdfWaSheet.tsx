import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CloudOff,
  Copy,
  Download,
  Home,
  MessageCircle,
  RefreshCw,
} from 'lucide-react';
import { DocumentationPhoto, WorkReport } from '@/entities/types';
import { exportReportToPdf } from '@/shared/utils/pdfExport';
import { parsePestFindingsFromNotes } from '@/shared/lib/permenkesRecapEngine';
import { AuthedImage } from '../common/AuthedImage';

interface CompletionPdfWaSheetProps {
  report: WorkReport;
  companyId?: string | null;
  pendingQueueCount: number;
  isSyncing: boolean;
  isHistoryDetail?: boolean;
  onSyncNow: () => void;
  onViewPhoto: (photo: DocumentationPhoto) => void;
  onBack: () => void;
}

function normalizeWaPhone(raw?: string | null): string {
  const digits = String(raw || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

function buildFormalWaMessage(report: WorkReport): string {
  const isTermite = report.serviceType === 'TERMITE_CONTROL';
  const serviceLabel = isTermite ? 'Pengendalian Rayap (Anti Rayap)' : 'Pengendalian Hama (Pest Control)';
  const dateStr = new Date(report.checkOutAt || report.createdAt).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const parsed = parsePestFindingsFromNotes(report.treatmentRecord?.technicianNotes);
  const recipient = report.customerName ? `Bapak/Ibu ${report.customerName}` : 'Bapak/Ibu Pengelola Lokasi';
  const summaryNote = parsed.cleanNotes
    ? `\nCatatan lapangan: ${parsed.cleanNotes}`
    : '';

  return [
    `Selamat pagi/siang ${recipient},`,
    ``,
    `Terima kasih telah menerima kunjungan tim *PT Guci Emas Pratama*. Berikut ringkasan Berita Acara pekerjaan hari ini:`,
    ``,
    `• Lokasi: ${report.projectName}`,
    `• Layanan: ${serviceLabel}`,
    `• Tanggal: ${dateStr}`,
    `• Teknisi: ${report.executorName || 'Tim Lapangan'}`,
    `• Dokumentasi: ${report.photos.length} foto bukti tersimpan${summaryNote}`,
    ``,
    `Dokumen PDF Berita Acara resmi telah kami siapkan dan siap dilampirkan. Apabila ada pertanyaan, silakan balas pesan ini.`,
    ``,
    `Salam hangat,`,
    `*PT Guci Emas Pratama*`,
  ].join('\n');
}

export const CompletionPdfWaSheet: React.FC<CompletionPdfWaSheetProps> = ({
  report,
  companyId,
  pendingQueueCount,
  isSyncing,
  isHistoryDetail = false,
  onSyncNow,
  onViewPhoto,
  onBack,
}) => {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const [copiedWa, setCopiedWa] = useState(false);
  const [savedToOutboxNotice, setSavedToOutboxNotice] = useState(false);

  const isTermite = report.serviceType === 'TERMITE_CONTROL';
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const hasOutboxPending = pendingQueueCount > 0 || isOffline;

  const parsed = parsePestFindingsFromNotes(report.treatmentRecord?.technicianNotes);
  const waText = buildFormalWaMessage(report);
  const waPhone = normalizeWaPhone(report.customerPhone);
  const waHref = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}`
    : `https://wa.me/?text=${encodeURIComponent(waText)}`;

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    setPdfNotice(null);
    try {
      await exportReportToPdf(report, undefined, {
        companyId,
        createdBy: report.executorName || 'Teknisi Lapangan',
      });
      setPdfNotice('PDF Berita Acara berhasil diunduh.');
      setTimeout(() => setPdfNotice(null), 3500);
    } catch {
      setPdfNotice('PDF disimpan sementara. Coba lagi saat koneksi stabil.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleCopyWaDraft = async () => {
    try {
      await navigator.clipboard.writeText(waText);
      setCopiedWa(true);
      setTimeout(() => setCopiedWa(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  const workDateLabel = new Date(report.checkOutAt || report.createdAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col min-h-full">
      <header className="tech-header">
        <button type="button" onClick={onBack} aria-label="Kembali">
          <ArrowLeft size={20} />
        </button>
        <strong>{isHistoryDetail ? 'Detail Berita Acara' : 'Berita Acara Selesai'}</strong>
        <span />
      </header>

      <main className="tech-content with-action space-y-4">
        {/* Status Hero Minimalis */}
        {!isHistoryDetail && (
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                hasOutboxPending
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {hasOutboxPending ? <CloudOff size={22} /> : <CheckCircle2 size={22} />}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-[var(--text-primary)]">
                {hasOutboxPending ? 'Tersimpan di Antrean Offline' : 'Laporan Selesai & Tersinkron'}
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {hasOutboxPending
                  ? 'Data aman di HP. Kirim ulang otomatis saat sinyal kembali.'
                  : 'Siap dikirim ke PIC melalui WhatsApp atau PDF.'}
              </p>
            </div>
          </div>
        )}

        {/* Pratinjau Berita Acara (Terpisah: Anti Rayap vs Pest Control) */}
        <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
          <div
            className={`px-4 py-3 border-b border-[var(--border)] flex items-center justify-between ${
              isTermite
                ? 'bg-amber-50/70 dark:bg-amber-950/25'
                : 'bg-sky-50/70 dark:bg-sky-950/25'
            }`}
          >
            <span
              className={`text-xs font-bold ${
                isTermite ? 'text-amber-900 dark:text-amber-300' : 'text-sky-900 dark:text-sky-300'
              }`}
            >
              {isTermite ? 'Berita Acara Anti Rayap' : 'Berita Acara Pest Control'}
            </span>
            <span className="text-[11px] font-mono text-[var(--text-secondary)]">{workDateLabel}</span>
          </div>

          <div className="p-4 space-y-3 text-xs">
            <div>
              <strong className="block text-sm font-bold text-[var(--text-primary)]">
                {report.projectName}
              </strong>
              <span className="text-[var(--text-secondary)]">{report.clientName || report.projectAddress}</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[var(--border)]">
              <div>
                <span className="block text-[10.5px] text-[var(--text-muted)]">
                  {isTermite ? 'Bahan Aktif / Metode' : 'Metode Penanganan'}
                </span>
                <strong className="text-[var(--text-primary)] font-semibold">
                  {report.treatmentRecord?.chemicalName || report.treatmentRecord?.applicationMethod || 'Sesuai SOP'}
                </strong>
              </div>
              <div>
                <span className="block text-[10.5px] text-[var(--text-muted)]">Penerima / PIC</span>
                <strong className="text-[var(--text-primary)] font-semibold">
                  {report.customerName || 'Perwakilan Lokasi'}
                </strong>
              </div>
            </div>

            {parsed.findings.length > 0 && (
              <div className="pt-2 border-t border-[var(--border)]">
                <span className="block text-[10.5px] text-[var(--text-muted)] mb-1">
                  {isTermite ? 'Ringkasan Temuan & Garansi' : 'Ringkasan Hama & Sanitasi'}
                </span>
                <p className="text-[var(--text-primary)] leading-relaxed">
                  {parsed.findings.map(f => `${f.pestName} (${f.quantity})`).join(' · ')}
                </p>
              </div>
            )}

            {parsed.cleanNotes && (
              <p className="text-[11.5px] text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-xl p-2.5">
                {parsed.cleanNotes}
              </p>
            )}
          </div>
        </section>

        {/* Bukti Foto Terpadu (Hingga 6 Foto — Tidak Menampilkan Rating Rahasia Klien) */}
        {report.photos.length > 0 && (
          <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <strong className="text-xs font-bold text-[var(--text-primary)]">
                Bukti Foto ({report.photos.length})
              </strong>
              <span className="text-[11px] text-[var(--text-muted)]">Ketuk untuk perbesar</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {report.photos.map(photo => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onViewPhoto(photo)}
                  className="aspect-square rounded-xl overflow-hidden border border-[var(--border)] cursor-pointer"
                >
                  <AuthedImage
                    path={photo.url}
                    alt={photo.photoTag || photo.photoType}
                    purged={!!photo.purgedAt}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Kartu Antrean Offline jika sinyal terputus */}
        {hasOutboxPending && (
          <div className="rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <strong className="block text-xs font-bold text-amber-900 dark:text-amber-200">
                Antrean Offline ({Math.max(1, pendingQueueCount)})
              </strong>
              <small className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                {savedToOutboxNotice
                  ? 'Pengingat kirim ulang aktif saat sinyal pulih.'
                  : 'Kirim ulang sekarang jika sinyal sudah stabil.'}
              </small>
            </div>
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => {
                if (isOffline) {
                  setSavedToOutboxNotice(true);
                } else {
                  onSyncNow();
                }
              }}
              className="min-h-[40px] px-3 rounded-xl bg-amber-600 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              {isOffline ? 'Simpan Antrean' : isSyncing ? 'Mengirim...' : 'Kirim Ulang'}
            </button>
          </div>
        )}

        {pdfNotice && (
          <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <Check size={14} /> {pdfNotice}
          </div>
        )}

        {/* Aksi Utama: Kirim WhatsApp PIC & Unduh PDF */}
        <div className="space-y-2.5 pt-1">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[50px] px-4 rounded-2xl bg-[#1A5C38] hover:bg-[#13462A] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <MessageCircle size={17} />
            <span>
              Kirim Ringkasan via WhatsApp {waPhone ? `(${report.customerPhone})` : ''}
            </span>
          </a>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={downloadingPdf}
              onClick={handleDownloadPdf}
              className="min-h-[46px] px-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
            >
              <Download size={15} className="text-[var(--accent)]" />
              <span>{downloadingPdf ? 'Menyiapkan...' : 'Unduh PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyWaDraft}
              className="min-h-[46px] px-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
            >
              {copiedWa ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} className="text-[var(--text-secondary)]" />}
              <span>{copiedWa ? 'Teks Tersalin' : 'Salin Pesan WA'}</span>
            </button>
          </div>
        </div>
      </main>

      <div className="sticky-action">
        <button
          type="button"
          onClick={onBack}
          className="w-full min-h-[46px] rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] flex items-center justify-center gap-2 cursor-pointer"
        >
          {isHistoryDetail ? <ArrowLeft size={16} /> : <Home size={16} />}
          <span>{isHistoryDetail ? 'Kembali ke Riwayat' : 'Kembali ke Beranda'}</span>
        </button>
      </div>
    </div>
  );
};
