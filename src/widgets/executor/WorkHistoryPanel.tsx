import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Camera,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  History,
  MapPin,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { WorkReport } from '@/entities/types';
import {
  formatDurationId,
  formatTimeWib,
  formatWoCode,
  getServiceLabel,
  isSampleCompleteReport,
  isTermiteService,
} from './techLiteUtils';
import {
  buildHistorySummaryStats,
  filterHistoryReports,
  groupHistoryReportsByDate,
  HistoryCategoryFilter,
  HistoryDatePreset,
} from './workHistoryUtils';
import { isValidCoordinate, loadWorkPointLocation } from './workPointLocationUtils';

interface WorkHistoryPanelProps {
  completedJobs: WorkReport[];
  downloadingPdfId: string | null;
  onOpenDetail: (report: WorkReport) => void;
  onRequestDownloadPdf: (report: WorkReport) => void;
}

function formatShortDateLabel(isoOrYmd: string): string {
  const parts = isoOrYmd.split('-').map(Number);
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }
  const parsed = new Date(isoOrYmd);
  if (Number.isNaN(parsed.getTime())) return isoOrYmd;
  return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const WorkHistoryPanel: React.FC<WorkHistoryPanelProps> = ({
  completedJobs,
  downloadingPdfId,
  onOpenDetail,
  onRequestDownloadPdf,
}) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<HistoryCategoryFilter>('ALL');
  const [datePreset, setDatePreset] = useState<HistoryDatePreset>('ALL');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  const filteredReports = useMemo(
    () =>
      filterHistoryReports(completedJobs, {
        category,
        search,
        preset: datePreset,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    [completedJobs, category, search, datePreset, dateFrom, dateTo]
  );

  const dateGroups = useMemo(
    () => groupHistoryReportsByDate(filteredReports),
    [filteredReports]
  );

  const summary = useMemo(() => buildHistorySummaryStats(dateGroups), [dateGroups]);

  const hasActiveFilter =
    Boolean(search.trim()) ||
    category !== 'ALL' ||
    datePreset !== 'ALL' ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const handleResetFilters = () => {
    setSearch('');
    setCategory('ALL');
    setDatePreset('ALL');
    setDateFrom('');
    setDateTo('');
    setShowDateFilter(false);
  };

  const toggleDateCollapse = (dateKey: string) => {
    setCollapsedDates(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  return (
    <main
      data-testid="work-history-panel"
      className="flex-1 px-4 pt-3.5 pb-24 space-y-3.5"
    >
      {/* Header + Quiet Summary */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-[17px] font-bold tracking-tight text-[var(--tl-text)]">
            Riwayat Pekerjaan
          </h1>
          <p className="text-[11.5px] text-[var(--tl-text-variant)] mt-0.5">
            {summary.totalReports} laporan selesai · {summary.totalDays} tanggal tercatat
          </p>
        </div>
        <span className="text-[11px] font-semibold text-[var(--tl-secondary)] pt-1 shrink-0">
          Arsip Resmi
        </span>
      </div>

      {/* Search + Custom Date Range Toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 flex items-center">
          <Search size={15} className="absolute left-3.5 text-[var(--tl-outline)]" />
          <input
            type="text"
            data-testid="history-search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari WO, proyek, klien..."
            className="w-full h-10 pl-9 pr-8 rounded-xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] text-xs text-[var(--tl-text)] focus:outline-none focus:ring-2 focus:ring-[var(--tl-primary)]"
          />
          {search && (
            <button
              type="button"
              aria-label="Hapus pencarian riwayat"
              onClick={() => setSearch('')}
              className="absolute right-2.5 p-1 text-[var(--tl-outline)] hover:text-[var(--tl-text)] cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          type="button"
          data-testid="history-date-range-toggle"
          onClick={() => setShowDateFilter(v => !v)}
          aria-label="Filter Rentang Tanggal"
          className={`h-10 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-[var(--tl-shadow-card)] transition-colors ${
            showDateFilter || dateFrom || dateTo
              ? 'bg-[var(--tl-primary)] text-[var(--tl-on-primary)]'
              : 'bg-[var(--tl-card)] text-[var(--tl-text)]'
          }`}
        >
          <Calendar size={14} />
          <span>Tanggal</span>
        </button>
      </div>

      {/* Collapsible Custom Date Range Card */}
      {showDateFilter && (
        <div className="p-3.5 rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] space-y-2.5">
          <div className="flex items-center justify-between">
            <strong className="text-xs font-bold text-[var(--tl-text)]">
              Filter Rentang Tanggal
            </strong>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                className="text-[11px] font-semibold text-[var(--tl-error)] cursor-pointer"
              >
                Reset Rentang
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10.5px] font-medium text-[var(--tl-text-variant)] mb-1">
                Dari Tanggal
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full h-9 px-2.5 rounded-xl bg-[var(--tl-low)] text-xs text-[var(--tl-text)]"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-medium text-[var(--tl-text-variant)] mb-1">
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full h-9 px-2.5 rounded-xl bg-[var(--tl-low)] text-xs text-[var(--tl-text)]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Active Custom Range Readout */}
      {(dateFrom || dateTo) && !showDateFilter && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--tl-low)] text-[11px] font-semibold text-[var(--tl-primary)]">
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={12} />
            <span>
              {dateFrom ? formatShortDateLabel(dateFrom) : 'Awal'} –{' '}
              {dateTo ? formatShortDateLabel(dateTo) : 'Sekarang'}
            </span>
          </span>
          <button
            type="button"
            aria-label="Hapus filter tanggal"
            onClick={() => {
              setDateFrom('');
              setDateTo('');
            }}
            className="p-0.5 cursor-pointer hover:opacity-75"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Quick Date Period Bar (Disabled visually when custom range active) */}
      <div
        role="tablist"
        aria-label="Filter Periode Riwayat"
        className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[var(--tl-low)]"
      >
        {(
          [
            { id: 'ALL', label: 'Semua' },
            { id: 'TODAY', label: 'Hari Ini' },
            { id: 'WEEK', label: '7 Hari' },
            { id: 'MONTH', label: '30 Hari' },
          ] as const
        ).map(item => {
          const active = !dateFrom && !dateTo && datePreset === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`history-preset-${item.id.toLowerCase()}`}
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setDatePreset(item.id);
              }}
              className={`min-h-[32px] rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-[var(--tl-card)] text-[var(--tl-primary)] shadow-sm'
                  : 'text-[var(--tl-text-variant)] hover:text-[var(--tl-text)]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Service Type Filter Bar */}
      <div className="flex items-center justify-between gap-2 text-[11.5px]">
        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'ALL', label: `Semua (${completedJobs.length})` },
              { id: 'AR', label: 'Anti Rayap' },
              { id: 'PCO', label: 'Pest Control' },
            ] as const
          ).map(cat => {
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                data-testid={`history-cat-${cat.id.toLowerCase()}`}
                onClick={() => setCategory(cat.id)}
                className={`min-h-[30px] px-2.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[var(--tl-primary)] text-[var(--tl-on-primary)]'
                    : 'bg-[var(--tl-card)] text-[var(--tl-text-variant)] shadow-[var(--tl-shadow-card)]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-[11px] font-semibold text-[var(--tl-secondary)] inline-flex items-center gap-1 cursor-pointer shrink-0"
          >
            <RotateCcw size={11} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Date-Categorized History Sections */}
      {dateGroups.length > 0 ? (
        <div className="space-y-4">
          {dateGroups.map(group => {
            const isCollapsed = Boolean(collapsedDates[group.dateKey]);
            return (
              <section
                key={group.dateKey}
                data-testid="history-date-group"
                data-date-key={group.dateKey}
                aria-label={`Riwayat tanggal ${group.title}`}
                className="space-y-2.5"
              >
                {/* Date Category Header */}
                <button
                  type="button"
                  data-testid="history-date-header"
                  onClick={() => toggleDateCollapse(group.dateKey)}
                  aria-expanded={!isCollapsed}
                  className="w-full px-1 py-1 flex items-center justify-between gap-2 text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-[var(--tl-secondary)] shrink-0" />
                    <div className="min-w-0">
                      <h2 className="text-[12.5px] font-bold text-[var(--tl-text)] leading-tight truncate">
                        {group.title}
                      </h2>
                      {group.subtitle && (
                        <span className="block text-[10.5px] text-[var(--tl-text-variant)]">
                          {group.subtitle}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-semibold text-[var(--tl-text-variant)]">
                    <span className="font-mono tabular-nums text-[var(--tl-secondary)]">
                      {group.count} Laporan
                    </span>
                    {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </div>
                </button>

                {/* Reports inside this date category */}
                {!isCollapsed && (
                  <div className="space-y-2.5 pl-2.5 border-l-2 border-[var(--tl-container)]">
                    {group.reports.map(rep => {
                      const durationText = formatDurationId(
                        rep.durationSeconds,
                        rep.checkInAt,
                        rep.checkOutAt
                      );
                      const isSample = isSampleCompleteReport(rep.id);
                      const isTermite = isTermiteService(rep.serviceType);
                      const completedTime = formatTimeWib(rep.checkOutAt || rep.createdAt);
                      const hasGpsTag =
                        Boolean(loadWorkPointLocation(rep.id)) ||
                        isValidCoordinate(rep.checkInLatitude, rep.checkInLongitude);

                      return (
                        <article
                          key={rep.id}
                          data-testid="history-report-card"
                          className="p-3.5 rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-[10.5px] min-w-0">
                              <span className="font-mono font-semibold text-[var(--tl-text)]">
                                {formatWoCode(rep.id)}
                              </span>
                              <span className="text-[var(--tl-outline)]">·</span>
                              <span
                                className={`font-semibold ${
                                  isTermite
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : 'text-[var(--tl-secondary)]'
                                }`}
                              >
                                {getServiceLabel(rep.serviceType)}
                              </span>
                              {isSample && (
                                <>
                                  <span className="text-[var(--tl-outline)]">·</span>
                                  <span className="font-semibold text-[var(--tl-primary)]">
                                    Contoh Lengkap
                                  </span>
                                </>
                              )}
                            </div>
                            <span className="text-[10.5px] font-mono font-medium text-[var(--tl-text-variant)] tabular-nums shrink-0">
                              {completedTime}
                            </span>
                          </div>

                          <div>
                            <strong className="block text-[13.5px] font-semibold text-[var(--tl-text)] leading-snug truncate">
                              {rep.projectName}
                            </strong>
                            <p className="text-[11px] text-[var(--tl-text-variant)] mt-0.5 truncate">
                              {[rep.clientName, rep.projectAddress].filter(Boolean).join(' · ') ||
                                'Lokasi lapangan'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2.5 flex-wrap text-[10.5px] text-[var(--tl-text-variant)] bg-[var(--tl-low)] rounded-xl px-2.5 py-1.5">
                            <span className="inline-flex items-center gap-1 font-medium">
                              <Camera size={11.5} className="text-[var(--tl-secondary)]" />
                              <span>{rep.photos.length} Foto</span>
                            </span>
                            {durationText !== '-' && (
                              <span className="inline-flex items-center gap-1 font-medium">
                                <Clock size={11.5} className="text-[var(--tl-secondary)]" />
                                <span>{durationText}</span>
                              </span>
                            )}
                            {hasGpsTag && (
                              <span className="inline-flex items-center gap-1 font-medium text-[var(--tl-primary)]">
                                <MapPin size={11.5} className="text-[var(--tl-secondary)]" />
                                <span>GPS</span>
                              </span>
                            )}
                            <span className="ml-auto font-semibold text-[var(--tl-secondary)]">
                              Selesai
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenDetail(rep)}
                              className="min-h-[38px] px-3 rounded-xl bg-[var(--tl-low)] hover:bg-[var(--tl-container)] text-[var(--tl-text)] text-[11.5px] font-semibold flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98] transition-transform"
                            >
                              <span>Lihat Detail</span>
                              <ChevronRight size={14} />
                            </button>
                            <button
                              type="button"
                              data-testid="history-download-pdf-btn"
                              disabled={downloadingPdfId === rep.id}
                              onClick={() => onRequestDownloadPdf(rep)}
                              className="min-h-[38px] px-3 rounded-xl bg-[var(--tl-primary)] hover:bg-[var(--tl-primary-container)] text-[var(--tl-on-primary)] text-[11.5px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-60"
                            >
                              <Download size={13.5} />
                              <span>
                                {downloadingPdfId === rep.id ? 'Menyiapkan...' : 'Unduh PDF'}
                              </span>
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="p-7 rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] text-center space-y-2.5">
          <div className="w-10 h-10 rounded-xl bg-[var(--tl-low)] text-[var(--tl-secondary)] flex items-center justify-center mx-auto">
            <History size={18} />
          </div>
          <div>
            <strong className="block text-xs font-bold text-[var(--tl-text)]">
              Belum ada riwayat pada filter ini
            </strong>
            <p className="text-[11px] text-[var(--tl-text-variant)] mt-0.5">
              Laporan yang sudah selesai akan otomatis terkelompok rapi berdasarkan tanggal pengerjaan.
            </p>
          </div>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="min-h-[36px] px-3.5 rounded-xl bg-[var(--tl-low)] hover:bg-[var(--tl-container)] text-[var(--tl-primary)] text-xs font-semibold cursor-pointer"
            >
              Tampilkan Semua Riwayat
            </button>
          )}
        </div>
      )}
    </main>
  );
};
