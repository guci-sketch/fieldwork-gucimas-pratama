import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCircle2, ChevronRight, ClipboardList, CloudOff, X } from 'lucide-react';

export interface TechNotificationItem {
  id: string;
  category: 'task' | 'system';
  title: string;
  subtitle: string;
  timeLabel: string;
  unread?: boolean;
  onPress: () => void;
}

interface NotificationsSheetProps {
  items: TechNotificationItem[];
  onClose: () => void;
}

export const NotificationsSheet: React.FC<NotificationsSheetProps> = ({ items, onClose }) => {
  const [tab, setTab] = useState<'all' | 'task' | 'system'>('all');

  const filtered = items.filter(item => {
    if (tab === 'task') return item.category === 'task';
    if (tab === 'system') return item.category === 'system';
    return true;
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="w-full max-w-[430px] max-h-[82dvh] rounded-t-3xl sm:rounded-3xl bg-[var(--bg-card)] border border-[var(--border)] flex flex-col overflow-hidden shadow-2xl"
      >
        <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-3 mb-1 sm:hidden" />

        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={17} className="text-[var(--accent)]" />
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Notifikasi</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup notifikasi"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 3 Filter Tabs */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-1.5">
          {([
            { id: 'all', label: 'Semua' },
            { id: 'task', label: 'Tugas' },
            { id: 'system', label: 'Sistem & Offline' },
          ] as const).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                tab === t.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Clean 2-Line List with Working Deep-Links */}
        <div className="flex-1 overflow-y-auto px-4 pb-5 pt-1 divide-y divide-[var(--border)]">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--text-muted)]">
              Belum ada notifikasi pada kategori ini.
            </div>
          ) : (
            filtered.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onClose();
                  item.onPress();
                }}
                className="w-full py-3.5 text-left flex items-center gap-3 active:scale-[0.99] transition-transform cursor-pointer"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    item.category === 'system'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  }`}
                >
                  {item.category === 'system' ? (
                    <CloudOff size={16} />
                  ) : item.unread ? (
                    <ClipboardList size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {item.title}
                    </strong>
                    <span className="text-[10px] text-[var(--text-muted)] shrink-0">{item.timeLabel}</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                    {item.subtitle}
                  </p>
                </div>
                <ChevronRight size={15} className="text-[var(--text-muted)] shrink-0" />
              </button>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};
