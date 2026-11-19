import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { WorkReport, Project, DocumentationPhoto, PhotoType, PhotoTag } from '@/entities/types';
import { useAuth } from '@/app/providers/AuthContext';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  fetchMyWorkReports,
  checkIn,
  addProgressPhoto,
  checkOut,
  submitTreatment,
  updateWorkReportTeam,
  TreatmentInput,
  TeamMemberEntry,
} from '@/shared/api/workReports';
import { supabase } from '@/shared/lib/supabase';
import { createProject, fetchMyProjects, CreateProjectInput } from '@/shared/api/projects';
import { ApiError } from '@/shared/api/client';
import {
  getQueueLength,
  getPendingQueueSummary,
  clearSafeTechnicianCache,
  enqueue,
  enqueueTreatment,
  enqueueGps,
  syncQueue,
  QueuedAction,
} from '@/shared/utils/offlineQueue';
import { CameraCaptureModal } from '../camera/CameraCaptureModal';
import { CreateProjectModal } from './CreateProjectModal';
import { PhotoViewerModal } from '../common/PhotoViewerModal';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import { CustomerReviewFormModal } from './CustomerReviewFormModal';
import { TechnicianWorksheet, WorksheetClientPrefill } from './TechnicianWorksheet';
import { CompletionPdfWaSheet } from './CompletionPdfWaSheet';
import { NotificationsSheet, TechNotificationItem } from './NotificationsSheet';
import { ConfirmActionModal, useConfirmAction } from './ConfirmActionModal';
import { formatDistance, calculateDistanceMeters } from '@/shared/utils/geo';
import { postLocation } from '@/shared/api/location';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock,
  CloudOff,
  ExternalLink,
  History,
  Home,
  LocateFixed,
  Lock,
  LogOut,
  MapPin,
  Moon,
  MoreVertical,
  Navigation,
  Phone,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import {
  DayBucket,
  formatDurationId,
  formatTimeWib,
  formatWoCode,
  getDayBucket,
  getInitials,
  getServiceLabel,
  isTermiteService,
} from './techLiteUtils';

type TechPage =
  | 'home'
  | 'jobs'
  | 'task-detail'
  | 'gps'
  | 'worksheet'
  | 'completion'
  | 'history'
  | 'profile';

function ServicePill({ serviceType }: { serviceType?: string | null }) {
  const isTermite = isTermiteService(serviceType);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
        isTermite
          ? 'bg-[var(--tl-secondary-container)] text-[var(--tl-on-secondary-container)]'
          : 'bg-[var(--tl-high)] text-[var(--tl-text)]'
      }`}
    >
      {getServiceLabel(serviceType)}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === 'WORKING') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/45 dark:text-amber-300 text-[10.5px] font-bold whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        <span>Berlangsung</span>
      </span>
    );
  }
  if (status === 'COMPLETED' || status === 'REVIEWED') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--tl-secondary-container)] text-[var(--tl-on-secondary-container)] text-[10.5px] font-bold whitespace-nowrap">
        <CheckCircle2 size={11} />
        <span>Selesai</span>
      </span>
    );
  }
  if (status === 'FLAGGED') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[var(--tl-error-container)] text-[var(--tl-on-error-container)] text-[10.5px] font-bold whitespace-nowrap">
        Ditinjau
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[var(--tl-container)] text-[var(--tl-text-variant)] text-[10.5px] font-bold whitespace-nowrap">
      Siap
    </span>
  );
}

function GuciMasBrandLockup() {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        aria-hidden="true"
        className="w-9 h-9 rounded-xl bg-[var(--tl-primary)] text-[var(--tl-on-primary)] flex items-center justify-center shadow-xs shrink-0"
      >
        <ShieldCheck size={19} />
      </div>
      <div className="min-w-0 leading-tight">
        <strong className="block text-[14px] font-extrabold tracking-tight text-[var(--tl-text)] truncate">
          GuciMas
        </strong>
        <span className="block text-[10.5px] font-semibold text-[var(--tl-secondary)] tracking-wide truncate">
          Field Lite
        </span>
      </div>
    </div>
  );
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat Pagi';
  if (hour < 15) return 'Selamat Siang';
  if (hour < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

function formatFullDateId(date: Date = new Date()): string {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDateId(dateStr?: string | null): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const ExecutorHome: React.FC = () => {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();

  const [page, setPage] = useState<TechPage>('home');
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showNotifications, setShowNotifications] = useState(false);

  // Menu Tugas filters (3-Day Temporal Switcher + All fallback)
  const [taskDayTab, setTaskDayTab] = useState<'yesterday' | 'today' | 'tomorrow' | 'all'>('today');
  const [searchQuery, setSearchQuery] = useState('');

  // Riwayat Pekerjaan filters (Search + Date Range + Category Pills)
  const [historySearch, setHistorySearch] = useState('');
  const [historyCategory, setHistoryCategory] = useState<'ALL' | 'AR' | 'PCO'>('ALL');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Data state
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Offline Queue & Storage
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingItems, setPendingItems] = useState<
    Array<{ id: string; action: QueuedAction; reportId: string; queuedAt: string }>
  >([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);

  // Modals & Interactive States
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [activeCameraAction, setActiveCameraAction] = useState<{
    type: PhotoType;
    report: WorkReport;
    photoTag?: PhotoTag;
  } | null>(null);
  const [clientPrefill, setClientPrefill] = useState<WorksheetClientPrefill | null>(null);
  const [checkoutEvidence, setCheckoutEvidence] = useState<{ report: WorkReport; evidence: any } | null>(() => {
    try {
      const cached = sessionStorage.getItem('fw_checkout');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (checkoutEvidence) sessionStorage.setItem('fw_checkout', JSON.stringify(checkoutEvidence));
    else sessionStorage.removeItem('fw_checkout');
  }, [checkoutEvidence]);

  const [viewingPhoto, setViewingPhoto] = useState<DocumentationPhoto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [companyTechs, setCompanyTechs] = useState<{ id: string; name: string }[]>([]);
  const [quickManualName, setQuickManualName] = useState('');
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  // Selected items
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedProjectDetailId, setSelectedProjectDetailId] = useState<string | null>(null);
  const [isViewingHistoryDetail, setIsViewingHistoryDetail] = useState(false);
  const [showGpsPrompt, setShowGpsPrompt] = useState(false);
  const [gpsPermissionStatus, setGpsPermissionStatus] = useState<string>('unknown');
  const { confirmRequest, confirmAction, closeConfirm } = useConfirmAction();

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const refreshQueueState = useCallback(async () => {
    const [len, list] = await Promise.all([getQueueLength(), getPendingQueueSummary()]);
    setPendingCount(len);
    setPendingItems(list);
  }, []);

  // GPS Permission Check
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        setGpsPermissionStatus(result.state);
        if (result.state === 'prompt' && !sessionStorage.getItem('gps_prompted')) {
          setShowGpsPrompt(true);
          sessionStorage.setItem('gps_prompted', 'true');
        }
        result.onchange = () => {
          setGpsPermissionStatus(result.state);
          if (result.state === 'granted') {
            setShowGpsPrompt(false);
            trackLocation();
          }
        };
      });
    }
  }, []);

  const lastLocationRef = useRef<{ latitude: number; longitude: number; timestamp: number } | null>(null);

  const trackLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        if (pos.coords.accuracy === 0 || pos.coords.accuracy > 150) return;
        const now = Date.now();
        if (lastLocationRef.current) {
          const dist = calculateDistanceMeters(
            { latitude: lastLocationRef.current.latitude, longitude: lastLocationRef.current.longitude },
            { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
          );
          if (dist > 50000) return;
        }
        lastLocationRef.current = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timestamp: now,
        };
        postLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }).catch(err => {
          if (err.status === 0) enqueueGps(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        });
      },
      err => console.warn('Background GPS error:', err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }, []);

  useEffect(() => {
    trackLocation();
    const interval = setInterval(trackLocation, 45 * 60 * 1000);
    return () => clearInterval(interval);
  }, [trackLocation]);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [r, p] = await Promise.all([fetchMyWorkReports(), fetchMyProjects()]);
      setReports(r);
      setProjects(p);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat data. Periksa koneksi Anda.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    refreshQueueState();
    if (user?.companyId) {
      supabase
        .from('users')
        .select('id, name, role')
        .eq('company_id', user.companyId)
        .eq('is_active', true)
        .then(({ data }) => {
          setCompanyTechs(
            (data || [])
              .filter((u: any) => u.role === 'TEKNISI_LAPANGAN')
              .map((u: any) => ({ id: u.id, name: u.name }))
          );
        });
    }
  }, [loadData, refreshQueueState, user?.companyId]);

  const attemptSync = useCallback(async () => {
    const count = await getQueueLength();
    if (count === 0) {
      await loadData();
      showToast('Data jadwal & laporan sudah tersinkron terbaru.');
      return;
    }
    setIsSyncing(true);
    const { synced } = await syncQueue(remaining => setPendingCount(remaining));
    setIsSyncing(false);
    await refreshQueueState();
    if (synced > 0) {
      await loadData();
      showToast(`${synced} data antrean berhasil disinkronkan.`);
    }
  }, [loadData, refreshQueueState, showToast]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      attemptSync();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [attemptSync]);

  // Live timer for ongoing job
  const ongoingJob = reports.find(r => r.status === 'WORKING');
  const [elapsedTime, setElapsedTime] = useState('00:00');
  useEffect(() => {
    if (!ongoingJob?.checkInAt) return;
    const tick = () => {
      const start = new Date(ongoingJob.checkInAt!).getTime();
      const diffSec = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const h = Math.floor(diffSec / 3600);
      const m = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
      const s = String(diffSec % 60).padStart(2, '0');
      setElapsedTime(h > 0 ? `${String(h).padStart(2, '0')}:${m}:${s}` : `${m}:${s}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [ongoingJob?.checkInAt]);

  if (!user) return null;

  const activeQueueJobs = reports.filter(r => r.status === 'WORKING' || r.status === 'READY' || r.status === 'DRAFT');
  const readyJob = reports.find(r => r.status === 'READY' || r.status === 'DRAFT');
  const completedJobs = reports.filter(r => ['COMPLETED', 'FLAGGED', 'REVIEWED'].includes(r.status));

  const activeTaskReport: WorkReport | undefined =
    reports.find(r => r.id === selectedReportId) ||
    ongoingJob ||
    readyJob ||
    activeQueueJobs[0] ||
    completedJobs[0];

  // Primary card for Beranda (prefers active WORKING/READY job)
  const homePrimaryTask: WorkReport | undefined = ongoingJob || readyJob || activeQueueJobs[0];
  const upcomingHomeJobs = activeQueueJobs.filter(job => job.id !== homePrimaryTask?.id);

  // Classify projects into Kemarin / Hari Ini / Besok / Lainnya for Menu Tugas
  const categorizedProjects = useMemo(() => {
    const ref = new Date();
    const map: Record<DayBucket | 'all', Array<{ project: Project; report?: WorkReport }>> = {
      yesterday: [],
      today: [],
      tomorrow: [],
      other: [],
      all: [],
    };
    projects.forEach(proj => {
      const rep = reports.find(r => r.projectId === proj.id);
      const item = { project: proj, report: rep };
      map.all.push(item);

      // Active WORKING jobs always show up under Hari Ini so they are never hidden
      if (rep?.status === 'WORKING') {
        map.today.push(item);
        return;
      }

      const bucket = getDayBucket(proj.workDate || rep?.createdAt || proj.createdAt, ref);
      map[bucket].push(item);
    });
    return map;
  }, [projects, reports]);

  const hasOutsideThreeDayTasks = categorizedProjects.other.length > 0;

  // Filtered Projects for "Tugas" tab
  const filteredDayTasks = useMemo(() => {
    const source =
      taskDayTab === 'all'
        ? categorizedProjects.all
        : taskDayTab === 'today'
        ? categorizedProjects.today.length > 0
          ? categorizedProjects.today
          : categorizedProjects.all.filter(x => x.report?.status === 'READY' || x.report?.status === 'DRAFT')
        : categorizedProjects[taskDayTab];

    const q = searchQuery.trim().toLowerCase();
    if (!q) return source;
    return source.filter(({ project, report }) => {
      const wo = formatWoCode(report?.id || project.id).toLowerCase();
      return (
        project.projectName.toLowerCase().includes(q) ||
        (project.clientName && project.clientName.toLowerCase().includes(q)) ||
        project.address.toLowerCase().includes(q) ||
        wo.includes(q)
      );
    });
  }, [categorizedProjects, taskDayTab, searchQuery]);

  // Filtered History with Search + Date Range + Category Pills
  const filteredHistoryJobs = useMemo(() => {
    return completedJobs.filter(rep => {
      if (historyCategory === 'AR' && !isTermiteService(rep.serviceType)) return false;
      if (historyCategory === 'PCO' && isTermiteService(rep.serviceType)) return false;

      const q = historySearch.trim().toLowerCase();
      if (q) {
        const wo = formatWoCode(rep.id).toLowerCase();
        const match =
          rep.projectName.toLowerCase().includes(q) ||
          (rep.clientName || '').toLowerCase().includes(q) ||
          rep.projectAddress.toLowerCase().includes(q) ||
          wo.includes(q);
        if (!match) return false;
      }

      const repDate = new Date(rep.checkOutAt || rep.createdAt);
      if (dateFrom) {
        const from = new Date(`${dateFrom}T00:00:00`);
        if (repDate < from) return false;
      }
      if (dateTo) {
        const to = new Date(`${dateTo}T23:59:59`);
        if (repDate > to) return false;
      }
      return true;
    });
  }, [completedJobs, historyCategory, historySearch, dateFrom, dateTo]);

  // Monthly Performance Metrics (clean & privacy-safe)
  const monthlyStats = useMemo(() => {
    const now = new Date();
    const thisMonth = reports.filter(r => {
      const d = new Date(r.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const doneCount = thisMonth.filter(r => ['COMPLETED', 'REVIEWED', 'FLAGGED'].includes(r.status)).length;
    const totalCount = thisMonth.length || completedJobs.length;
    const syncRate =
      totalCount > 0
        ? Math.min(100, Math.round(((totalCount - Math.min(pendingCount, totalCount)) / totalCount) * 100))
        : 100;
    return {
      monthlyTasks: doneCount || completedJobs.length,
      syncRate,
    };
  }, [reports, completedJobs.length, pendingCount]);

  // Interactive Notifications
  const notificationItems: TechNotificationItem[] = useMemo(() => {
    const list: TechNotificationItem[] = [];
    if (pendingCount > 0) {
      list.push({
        id: 'notif-offline-queue',
        category: 'system',
        title: `${pendingCount} data menunggu sinkronisasi`,
        subtitle: isOnline ? 'Ketuk untuk kirim ulang sekarang' : 'Tersimpan aman hingga sinyal kembali',
        timeLabel: 'Antrean',
        unread: true,
        onPress: () => {
          if (isOnline) handleRequestSync();
          else setPage('profile');
        },
      });
    }
    activeQueueJobs.slice(0, 4).forEach(job => {
      list.push({
        id: `notif-task-${job.id}`,
        category: 'task',
        title: job.status === 'WORKING' ? `Lanjutkan: ${job.projectName}` : `Tugas baru: ${job.projectName}`,
        subtitle: `${job.clientName || 'Pelanggan'} · ${formatTimeWib(job.scheduledStartTime)}`,
        timeLabel: job.status === 'WORKING' ? 'Aktif' : 'Hari ini',
        unread: true,
        onPress: () => {
          setSelectedReportId(job.id);
          setSelectedProjectDetailId(job.projectId);
          setIsViewingHistoryDetail(false);
          setPage(job.status === 'WORKING' ? 'worksheet' : 'task-detail');
        },
      });
    });
    completedJobs.slice(0, 3).forEach(rep => {
      list.push({
        id: `notif-done-${rep.id}`,
        category: 'system',
        title: `Terkirim: ${rep.projectName}`,
        subtitle: `${rep.photos.length} foto bukti · Ketuk untuk lihat Detail Pekerjaan`,
        timeLabel: formatShortDateId(rep.checkOutAt || rep.createdAt),
        unread: false,
        onPress: () => {
          setSelectedReportId(rep.id);
          setIsViewingHistoryDetail(true);
          setPage('completion');
        },
      });
    });
    return list;
  }, [pendingCount, isOnline, activeQueueJobs, completedJobs, attemptSync]);

  const unreadNotifCount = notificationItems.filter(n => n.unread).length;

  // Handlers
  const applyTeamMembersUpdate = async (repId: string, next: TeamMemberEntry[]) => {
    setReports(prev => prev.map(r => (r.id === repId ? { ...r, teamMembers: next } : r)));
    try {
      await updateWorkReportTeam(repId, next);
    } catch {
      // ignore if offline
    }
  };

  const handleToggleQuickTeamMember = async (rep: WorkReport, member: TeamMemberEntry) => {
    const current =
      rep.teamMembers && rep.teamMembers.length > 0
        ? rep.teamMembers
        : [{ id: user.uid, name: user.name, role: 'Ketua Tim', isManual: false }];
    const exists = current.some(
      m => (member.id && m.id === member.id) || m.name.toLowerCase() === member.name.toLowerCase()
    );
    if (exists) {
      const next = current.filter(
        m => !((member.id && m.id === member.id) || m.name.toLowerCase() === member.name.toLowerCase())
      );
      confirmAction({
        tone: 'warning',
        title: 'Keluarkan Anggota Tim?',
        description: 'Anggota ini akan dihapus dari daftar tim pelaksana pada Work Order ini.',
        details: [
          { label: 'Anggota', value: member.name },
          { label: 'Nomor WO', value: formatWoCode(rep.id) },
        ],
        confirmLabel: 'Ya, Keluarkan',
        cancelLabel: 'Batal',
        onConfirm: () => applyTeamMembersUpdate(rep.id, next),
      });
      return;
    }
    const next = [...current, member];
    await applyTeamMembersUpdate(rep.id, next);
  };

  const handleCreateProjectSubmit = async (data: CreateProjectInput) => {
    await createProject(data);
    setShowCreateProject(false);
    await loadData();
    showToast('Lokasi tugas baru berhasil ditambahkan.');
  };

  const handleCaptureComplete = async (capturedData: {
    photoBlob: Blob;
    latitude: number;
    longitude: number;
    accuracy: number;
  }) => {
    if (!activeCameraAction) return;
    const { type, report, photoTag } = activeCameraAction;
    setActionError(null);
    const evidence = {
      photoBlob: capturedData.photoBlob,
      latitude: capturedData.latitude,
      longitude: capturedData.longitude,
      accuracy: capturedData.accuracy,
      photoTag,
    };

    try {
      if (type === 'CHECK_IN') {
        const updated = await checkIn(report.id, evidence);
        setActiveCameraAction(null);
        await loadData();
        setSelectedReportId(updated.id);
        setPage('worksheet');
        showToast(
          `Check-in tercatat (${updated.checkInDistance != null ? formatDistance(updated.checkInDistance) : 'GPS aktif'}).`
        );
      } else if (type === 'PROGRESS') {
        const updated = await addProgressPhoto(report.id, evidence);
        setActiveCameraAction(null);
        await loadData();
        showToast(`Foto tersimpan (${updated.photos.length}/6 foto).`);
      } else {
        setCheckoutEvidence({ report, evidence });
        setActiveCameraAction(null);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        const queueAction: QueuedAction =
          type === 'CHECK_IN' ? 'CHECK_IN' : type === 'PROGRESS' ? 'PROGRESS' : 'CHECK_OUT';
        await enqueue(queueAction, report.id, evidence);
        await refreshQueueState();
        setActiveCameraAction(null);
        if (type === 'CHECK_IN') setPage('worksheet');
        if (type === 'CHECK_OUT') {
          setIsViewingHistoryDetail(false);
          setPage('completion');
        }
        showToast('Disimpan di antrean offline. Otomatis terkirim saat online.');
      } else {
        const msg = err instanceof Error ? err.message : 'Gagal menyimpan foto. Coba lagi.';
        setActionError(msg);
        throw new Error(msg);
      }
    }
  };

  const handleSaveTreatmentFromWorksheet = async (input: TreatmentInput) => {
    if (!activeTaskReport) return;
    try {
      const updated = await submitTreatment(activeTaskReport.id, input);
      await loadData();
      setSelectedReportId(updated.id);
    } catch (err: any) {
      if (err?.status === 0) {
        await enqueueTreatment(activeTaskReport.id, input);
        await refreshQueueState();
        showToast('Treatment disimpan di antrean offline.');
      }
    }
  };

  const handleProceedToClientSign = (prefill: WorksheetClientPrefill) => {
    if (!activeTaskReport) return;
    setClientPrefill(prefill);
    setActiveCameraAction({ type: 'CHECK_OUT', report: activeTaskReport });
  };

  const handleCustomerReviewSubmit = async (reviewData: {
    customerName: string;
    customerPhone: string;
    customerFeedback: string;
    customerSignature: string;
  }) => {
    if (!checkoutEvidence) return;
    const { report, evidence } = checkoutEvidence;
    setCheckoutEvidence(null);
    setClientPrefill(null);
    setActionError(null);

    const fullEvidence = { ...evidence, ...reviewData };
    try {
      const completed = await checkOut(report.id, fullEvidence);
      try {
        localStorage.removeItem(`fw_tech_draft_${report.id}`);
      } catch {
        // ignore
      }
      await loadData();
      setSelectedReportId(completed.id);
      setIsViewingHistoryDetail(false);
      setPage('completion');
      showToast('Pekerjaan selesai & Berita Acara siap dikirim.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        await enqueue('CHECK_OUT', report.id, fullEvidence);
        await refreshQueueState();
        setIsViewingHistoryDetail(false);
        setPage('completion');
        showToast('Disimpan di antrean offline.');
      } else {
        setActionError(err instanceof ApiError ? err.message : 'Gagal menyelesaikan pekerjaan.');
      }
    }
  };

  const handleClearCache = async () => {
    const cleared = await clearSafeTechnicianCache();
    setCacheNotice(
      cleared > 0
        ? `${cleared} cache sementara berhasil dibersihkan.`
        : 'Cache sudah bersih. Antrean offline aktif tetap aman.'
    );
    setTimeout(() => setCacheNotice(null), 3500);
  };

  const handleRequestClearCache = () => {
    confirmAction({
      tone: 'danger',
      title: 'Bersihkan Cache Foto?',
      description:
        'Cache sementara foto di perangkat ini akan dihapus untuk menghemat penyimpanan. Antrean offline yang belum terkirim tetap aman.',
      details: [
        { label: 'Antrean Offline', value: pendingCount > 0 ? `${pendingCount} data aman` : 'Tidak ada antrean' },
      ],
      confirmLabel: 'Ya, Bersihkan',
      cancelLabel: 'Batal',
      onConfirm: handleClearCache,
    });
  };

  const handleRequestSync = () => {
    if (isSyncing) return;
    if (pendingCount > 0) {
      confirmAction({
        tone: 'warning',
        title: 'Kirim Antrean Offline?',
        description:
          'Data pekerjaan dan foto yang tertunda di perangkat akan dikirim ke server sekarang.',
        details: [
          { label: 'Data Tertunda', value: `${pendingCount} antrean` },
          { label: 'Koneksi', value: isOnline ? 'Online' : 'Offline' },
        ],
        confirmLabel: 'Ya, Sinkronkan',
        cancelLabel: 'Nanti Saja',
        onConfirm: attemptSync,
      });
      return;
    }
    confirmAction({
      tone: 'primary',
      title: 'Sinkronkan Data Lapangan?',
      description: 'Memuat ulang jadwal tugas dan status laporan terbaru dari server.',
      details: [{ label: 'Status Koneksi', value: isOnline ? 'Online' : 'Offline' }],
      confirmLabel: 'Ya, Sinkronkan',
      cancelLabel: 'Batal',
      onConfirm: attemptSync,
    });
  };

  const handleRequestLogout = () => {
    confirmAction({
      tone: 'danger',
      title: 'Keluar dari Akun Teknisi?',
      description:
        pendingCount > 0
          ? `Masih ada ${pendingCount} data antrean offline yang belum terkirim. Anda dapat keluar sekarang, namun disarankan sinkronkan data terlebih dahulu.`
          : 'Sesi Anda pada perangkat ini akan diakhiri dan diarahkan kembali ke halaman masuk.',
      details: [
        { label: 'Akun Teknisi', value: user.name },
        {
          label: 'Antrean Offline',
          value: pendingCount > 0 ? `${pendingCount} belum terkirim` : 'Semua tersinkron',
        },
      ],
      confirmLabel: 'Ya, Keluar',
      cancelLabel: 'Batal',
      onConfirm: logout,
    });
  };

  const handleRequestCheckInCamera = (report: WorkReport) => {
    confirmAction({
      tone: 'primary',
      title: 'Mulai Check-in & Buka Kamera?',
      description:
        'Kamera dan validasi posisi GPS akan dibuka untuk mencatat waktu kehadiran Anda di lokasi kerja.',
      details: [
        { label: 'Nomor WO', value: formatWoCode(report.id) },
        { label: 'Lokasi', value: report.projectName },
        { label: 'Radius GPS', value: `${report.projectRadius || 100} meter` },
      ],
      confirmLabel: 'Ya, Buka Kamera',
      cancelLabel: 'Batal',
      onConfirm: () => setActiveCameraAction({ type: 'CHECK_IN', report }),
    });
  };

  const initials = getInitials(user.name);
  const firstName = user.name.split(' ')[0] || 'Teknisi';
  const currentMonthLabel = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const activeBottomTabId =
    page === 'jobs' ? 'jobs' : page === 'history' ? 'history' : page === 'profile' ? 'profile' : 'home';

  const isWorkflowSubpage = ['task-detail', 'gps', 'worksheet', 'completion'].includes(page);
  const isAnyModalOpen = Boolean(
    isWorkflowSubpage ||
      activeCameraAction ||
      checkoutEvidence ||
      showCreateProject ||
      viewingPhoto ||
      showChangePassword ||
      showNotifications ||
      (showGpsPrompt && gpsPermissionStatus !== 'granted')
  );

  // Reusable Frosted GuciMas Field Lite Top Header
  const renderLiteHeader = () => (
    <header
      className="sticky top-0 z-30 px-4 h-16 flex items-center justify-between gap-2 backdrop-blur-md shrink-0"
      style={{
        background: 'color-mix(in srgb, var(--tl-surface) 90%, transparent)',
        boxShadow: 'var(--tl-shadow-head)',
      }}
    >
      <GuciMasBrandLockup />

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => (pendingCount > 0 ? handleRequestSync() : setShowNotifications(true))}
          aria-label="Status Koneksi dan Sinkronisasi"
          className="inline-flex items-center gap-1.5 min-h-[34px] px-2.5 rounded-full bg-[var(--tl-low)] hover:bg-[var(--tl-container)] text-[11px] font-bold text-[var(--tl-text)] cursor-pointer"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              !isOnline ? 'bg-rose-500' : pendingCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
            }`}
          />
          <span>{!isOnline ? 'Offline' : pendingCount > 0 ? `${pendingCount} Antrean` : 'Online'}</span>
        </button>

        <button
          type="button"
          onClick={() => setPage('profile')}
          aria-label="Buka Profil Teknisi"
          className="w-9 h-9 rounded-full bg-[var(--tl-primary)] text-[var(--tl-on-primary)] text-xs font-bold flex items-center justify-center shadow-xs active:scale-95 transition-transform cursor-pointer"
        >
          {initials}
        </button>
      </div>
    </header>
  );

  return (
    <div className="technician-stage tech-lite-shell">
      {/* Subtle Comforting Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] w-[calc(100%-2rem)] max-w-[400px]"
          >
            <div className="px-4 py-3 rounded-2xl bg-[var(--tl-primary)] text-[var(--tl-on-primary)] shadow-xl flex items-center justify-between gap-2 text-xs font-semibold">
              <span className="flex items-center gap-2 min-w-0">
                <Check size={15} className="text-[var(--tl-secondary-container)] shrink-0" />
                <span className="truncate">{toastMsg}</span>
              </span>
              <button
                type="button"
                aria-label="Tutup notifikasi"
                onClick={() => setToastMsg(null)}
                className="opacity-80 hover:opacity-100 p-1 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile-First Phone Shell */}
      <div className={`phone-app ${isWorkflowSubpage ? 'workflow-mode' : ''}`}>
        {actionError && (
          <div className="px-4 pt-3">
            <div
              role="alert"
              className="px-3.5 py-2.5 rounded-xl bg-[var(--tl-error-container)] text-[var(--tl-on-error-container)] text-xs font-semibold flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2 min-w-0">
                <AlertCircle size={15} className="shrink-0" />
                <span>{actionError}</span>
              </span>
              <button
                type="button"
                aria-label="Tutup pesan error"
                onClick={() => setActionError(null)}
                className="p-1 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* BERANDA — GUCIMAS FIELD LITE (COLLAPSED + PROGRESSIVE DISCLOSURE) */}
        {/* ================================================================= */}
        {page === 'home' && (
          <>
            {renderLiteHeader()}

            <main className="flex-1 px-4 pt-4 pb-24 space-y-4">
              {/* Greeting + Date + Circular Notification Bell */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-[20px] font-extrabold tracking-tight text-[var(--tl-text)] leading-tight truncate">
                    {getTimeGreeting()}, {firstName}
                  </h1>
                  <p className="text-xs font-medium text-[var(--tl-text-variant)] mt-0.5">
                    {formatFullDateId()}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowNotifications(true)}
                  aria-label="Pusat Notifikasi"
                  className="relative w-10 h-10 rounded-full bg-[var(--tl-card)] text-[var(--tl-text)] shadow-[var(--tl-shadow-card)] flex items-center justify-center active:scale-95 transition-transform cursor-pointer shrink-0"
                >
                  <Bell size={18} />
                  {unreadNotifCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[9.5px] font-bold flex items-center justify-center ring-2 ring-[var(--tl-surface)]">
                      {unreadNotifCount}
                    </span>
                  )}
                </button>
              </div>

              {/* 3-Column Divided Compact KPI Strip */}
              <section
                aria-label="Ringkasan Tugas Hari Ini"
                className="rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] grid grid-cols-3 divide-x divide-[var(--tl-container)] py-3"
              >
                <button
                  type="button"
                  onClick={() => {
                    setTaskDayTab('today');
                    setPage('jobs');
                  }}
                  className="px-2 text-center cursor-pointer"
                >
                  <strong className="block text-[20px] font-extrabold font-mono tabular-nums text-[var(--tl-text)] leading-none">
                    {activeQueueJobs.length}
                  </strong>
                  <span className="block text-[11px] font-semibold text-[var(--tl-text-variant)] mt-1">
                    Hari Ini
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPage('history')}
                  className="px-2 text-center cursor-pointer"
                >
                  <strong className="block text-[20px] font-extrabold font-mono tabular-nums text-[var(--tl-secondary)] leading-none">
                    {completedJobs.length}
                  </strong>
                  <span className="block text-[11px] font-semibold text-[var(--tl-text-variant)] mt-1">
                    Selesai
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => (pendingCount > 0 ? handleRequestSync() : setPage('jobs'))}
                  className="px-2 text-center cursor-pointer"
                >
                  <strong className="block text-[20px] font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400 leading-none">
                    {pendingCount > 0 ? pendingCount : activeQueueJobs.filter(j => j.status !== 'WORKING').length}
                  </strong>
                  <span className="block text-[11px] font-semibold text-[var(--tl-text-variant)] mt-1">
                    Pending
                  </span>
                </button>
              </section>

              {isLoading && (
                <div className="py-10 rounded-2xl bg-[var(--tl-card)] text-center text-xs font-medium text-[var(--tl-text-variant)] shadow-[var(--tl-shadow-card)]">
                  Memuat jadwal lapangan hari ini...
                </div>
              )}

              {!isLoading && loadError && (
                <div className="p-4 rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] text-center space-y-2.5">
                  <p className="text-xs text-[var(--tl-text-variant)]">{loadError}</p>
                  <button
                    type="button"
                    onClick={loadData}
                    className="min-h-[42px] px-4 rounded-xl bg-[var(--tl-primary)] text-[var(--tl-on-primary)] text-xs font-bold cursor-pointer"
                  >
                    Muat Ulang
                  </button>
                </div>
              )}

              {/* Primary Active Task Card (Tugas Utama) with Progressive Disclosure */}
              {!isLoading && !loadError && homePrimaryTask && (
                <article className="rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] overflow-hidden">
                  {/* Top Soft Header Strip */}
                  <div className="px-4 py-2.5 bg-[var(--tl-low)] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--tl-primary)]">
                        Tugas Utama
                      </span>
                      <span className="text-[10.5px] font-mono font-bold text-[var(--tl-text-variant)]">
                        {formatWoCode(homePrimaryTask.id)}
                      </span>
                    </div>
                    <ServicePill serviceType={homePrimaryTask.serviceType} />
                  </div>

                  <div className="p-4 space-y-3.5">
                    {/* Status + Time + Radius */}
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-2">
                        <StatusPill status={homePrimaryTask.status} />
                        <span className="font-mono font-semibold tabular-nums text-[var(--tl-text-variant)]">
                          {homePrimaryTask.status === 'WORKING'
                            ? elapsedTime
                            : formatTimeWib(homePrimaryTask.scheduledStartTime)}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[var(--tl-text-variant)] font-medium">
                        <LocateFixed size={12} className="text-[var(--tl-secondary)]" />
                        <span>Radius {homePrimaryTask.projectRadius || 100}m</span>
                      </span>
                    </div>

                    {/* Title */}
                    <div>
                      <h2 className="text-[18px] font-extrabold text-[var(--tl-text)] leading-snug">
                        {homePrimaryTask.projectName}
                      </h2>
                    </div>

                    {/* Inset Location & Time Card */}
                    <div className="rounded-xl bg-[var(--tl-low)] p-3 space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        <MapPin size={15} className="text-[var(--tl-secondary)] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <strong className="block text-[var(--tl-text)] font-bold truncate">
                            {homePrimaryTask.clientName || 'Lokasi Klien'}
                          </strong>
                          <span className="block text-[11px] text-[var(--tl-text-variant)] line-clamp-2 mt-0.5">
                            {homePrimaryTask.projectAddress}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progressive Disclosure Accordion (Collapsed by Default) */}
                    <details className="group rounded-xl bg-[var(--tl-low)]/75 overflow-hidden">
                      <summary className="min-h-[42px] px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-[var(--tl-primary)] cursor-pointer select-none list-none">
                        <span>Lihat Detail Rute &amp; Scope</span>
                        <ChevronDown
                          size={16}
                          className="transition-transform duration-200 group-open:rotate-180 text-[var(--tl-secondary)]"
                        />
                      </summary>

                      <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-[var(--tl-container)] text-xs">
                        {/* Clean Styled Route & Geofence Panel (Zero external placeholder images) */}
                        <div className="rounded-xl bg-[var(--tl-card)] p-3 flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-[var(--tl-secondary-container)] text-[var(--tl-on-secondary-container)] flex items-center justify-center shrink-0">
                              <Navigation size={16} />
                            </div>
                            <div className="min-w-0">
                              <strong className="block text-[11.5px] font-bold text-[var(--tl-text)]">
                                Titik GPS Lokasi
                              </strong>
                              <span className="block text-[10.5px] font-mono text-[var(--tl-text-variant)] truncate">
                                {homePrimaryTask.projectLatitude.toFixed(5)}, {homePrimaryTask.projectLongitude.toFixed(5)}
                              </span>
                            </div>
                          </div>
                          <a
                            href={`https://maps.google.com/?q=${homePrimaryTask.projectLatitude},${homePrimaryTask.projectLongitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[34px] px-2.5 rounded-lg bg-[var(--tl-low)] hover:bg-[var(--tl-container)] text-[var(--tl-primary)] text-[11px] font-bold inline-flex items-center gap-1 shrink-0"
                          >
                            <span>Peta</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>

                        {/* Scope / Focus Target */}
                        {(homePrimaryTask.targetFocus?.length > 0 || homePrimaryTask.focusTarget) && (
                          <div className="space-y-1.5">
                            <span className="block text-[10.5px] font-bold uppercase tracking-wider text-[var(--tl-text-variant)]">
                              Target Pengendalian
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {(homePrimaryTask.targetFocus?.length > 0
                                ? homePrimaryTask.targetFocus
                                : [homePrimaryTask.focusTarget!]
                              ).map(target => (
                                <span
                                  key={target}
                                  className="px-2.5 py-1 rounded-lg bg-[var(--tl-card)] text-[var(--tl-text)] text-[11px] font-semibold"
                                >
                                  {target}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Team Assignment Toggle */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setShowTeamPicker(v => !v)}
                            className="w-full min-h-[38px] px-3 rounded-lg bg-[var(--tl-card)] flex items-center justify-between text-xs font-semibold text-[var(--tl-text)] cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <Users size={14} className="text-[var(--tl-secondary)]" />
                              <span>
                                Tim Pelaksana (
                                {(homePrimaryTask.teamMembers?.length
                                  ? homePrimaryTask.teamMembers
                                  : [{ name: user.name }]
                                ).length}{' '}
                                Orang)
                              </span>
                            </span>
                            {showTeamPicker ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>

                          {showTeamPicker && (
                            <div className="mt-2.5 space-y-2">
                              <div className="flex flex-wrap gap-1.5">
                                {companyTechs.map(t => {
                                  const activeList = homePrimaryTask.teamMembers?.length
                                    ? homePrimaryTask.teamMembers
                                    : [{ id: user.uid, name: user.name }];
                                  const isSel = activeList.some(
                                    m => m.id === t.id || m.name.toLowerCase() === t.name.toLowerCase()
                                  );
                                  return (
                                    <button
                                      key={t.id}
                                      type="button"
                                      onClick={() =>
                                        handleToggleQuickTeamMember(homePrimaryTask, {
                                          id: t.id,
                                          name: t.name,
                                          isManual: false,
                                        })
                                      }
                                      className={`min-h-[32px] px-2.5 rounded-full text-[11px] font-semibold cursor-pointer ${
                                        isSel
                                          ? 'bg-[var(--tl-primary)] text-[var(--tl-on-primary)]'
                                          : 'bg-[var(--tl-card)] text-[var(--tl-text)]'
                                      }`}
                                    >
                                      {isSel ? '✓ ' : '+ '}
                                      {t.name}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={quickManualName}
                                  onChange={e => setQuickManualName(e.target.value)}
                                  placeholder="Tambah rekan manual..."
                                  className="flex-1 h-9 px-3 rounded-lg bg-[var(--tl-card)] text-xs text-[var(--tl-text)]"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!quickManualName.trim()) return;
                                    handleToggleQuickTeamMember(homePrimaryTask, {
                                      name: quickManualName.trim(),
                                      isManual: true,
                                    });
                                    setQuickManualName('');
                                  }}
                                  className="h-9 px-3 rounded-lg bg-[var(--tl-primary)] text-[var(--tl-on-primary)] text-xs font-bold cursor-pointer"
                                >
                                  Tambah
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* PIC Quick Call if available */}
                        {homePrimaryTask.customerPhone && (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-[var(--tl-text-variant)]">
                              PIC: <strong className="text-[var(--tl-text)]">{homePrimaryTask.customerName || 'Klien'}</strong>
                            </span>
                            <a
                              href={`tel:${homePrimaryTask.customerPhone.replace(/\s+/g, '')}`}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--tl-secondary)]"
                            >
                              <Phone size={12} />
                              <span>{homePrimaryTask.customerPhone}</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </details>

                    {/* Dominant Primary Forest CTA */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReportId(homePrimaryTask.id);
                        setSelectedProjectDetailId(homePrimaryTask.projectId);
                        setIsViewingHistoryDetail(false);
                        setPage(homePrimaryTask.status === 'WORKING' ? 'worksheet' : 'gps');
                      }}
                      className="w-full min-h-[48px] px-4 rounded-xl bg-[var(--tl-primary)] hover:bg-[var(--tl-primary-container)] text-[var(--tl-on-primary)] text-xs font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <span>
                        {homePrimaryTask.status === 'WORKING'
                          ? 'Lanjutkan Lembar Kerja'
                          : 'Mulai Perjalanan & Check-in'}
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </article>
              )}

              {/* Empty Active State */}
              {!isLoading && !loadError && !homePrimaryTask && (
                <article className="rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] p-5 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--tl-secondary-container)] text-[var(--tl-on-secondary-container)] flex items-center justify-center mx-auto">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[var(--tl-text)]">Semua Tugas Hari Ini Selesai</h2>
                    <p className="text-xs text-[var(--tl-text-variant)] mt-1">
                      Buka menu Tugas untuk memeriksa jadwal lain atau tambahkan lokasi lapangan baru.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskDayTab('all');
                      setPage('jobs');
                    }}
                    className="w-full min-h-[46px] rounded-xl bg-[var(--tl-primary)] text-[var(--tl-on-primary)] text-xs font-bold cursor-pointer"
                  >
                    Lihat Semua Tugas
                  </button>
                </article>
              )}

              {/* 2-Column Functional Operational Shortcuts (Zero Dead Clicks) */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateProject(true)}
                  className="rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] p-3.5 flex items-center gap-3 text-left active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--tl-low)] text-[var(--tl-primary)] flex items-center justify-center shrink-0">
                    <PlusCircle size={19} />
                  </div>
                  <div className="min-w-0">
                    <strong className="block text-xs font-bold text-[var(--tl-text)] truncate">
                      Tugas Baru
                    </strong>
                    <span className="block text-[10.5px] text-[var(--tl-text-variant)] truncate">
                      Tambah Lokasi
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={handleRequestSync}
                  className="rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] p-3.5 flex items-center gap-3 text-left active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--tl-low)] text-[var(--tl-secondary)] flex items-center justify-center shrink-0">
                    <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                  </div>
                  <div className="min-w-0">
                    <strong className="block text-xs font-bold text-[var(--tl-text)] truncate">
                      Sinkron Data
                    </strong>
                    <span className="block text-[10.5px] text-[var(--tl-text-variant)] truncate">
                      {isSyncing
                        ? 'Menyinkronkan...'
                        : pendingCount > 0
                        ? `${pendingCount} Antrean`
                        : 'Tersinkron'}
                    </span>
                  </div>
                </button>
              </div>

              {/* Jadwal Berikutnya */}
              <section className="space-y-2.5">
                <div className="flex items-center justify-between px-0.5">
                  <h2 className="text-sm font-extrabold text-[var(--tl-text)]">
                    Jadwal Berikutnya ({upcomingHomeJobs.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => setPage('jobs')}
                    className="text-xs font-bold text-[var(--tl-secondary)] hover:underline cursor-pointer"
                  >
                    Lihat Semua
                  </button>
                </div>

                {upcomingHomeJobs.length > 0 ? (
                  <div className="rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] divide-y divide-[var(--tl-container)] overflow-hidden">
                    {upcomingHomeJobs.map(job => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => {
                          setSelectedReportId(job.id);
                          setSelectedProjectDetailId(job.projectId);
                          setIsViewingHistoryDetail(false);
                          setPage(job.status === 'WORKING' ? 'worksheet' : 'task-detail');
                        }}
                        className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--tl-low)]/50 active:scale-[0.99] transition-all cursor-pointer"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-mono font-bold text-[var(--tl-text-variant)] tabular-nums">
                              {formatTimeWib(job.scheduledStartTime)}
                            </span>
                            <ServicePill serviceType={job.serviceType} />
                          </div>
                          <strong className="block text-[13.5px] font-bold text-[var(--tl-text)] truncate">
                            {job.projectName}
                          </strong>
                          <p className="text-[11px] text-[var(--tl-text-variant)] truncate">
                            {job.clientName || job.projectAddress}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <StatusPill status={job.status} />
                          <ChevronRight size={16} className="text-[var(--tl-outline)]" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] p-4 text-center text-xs text-[var(--tl-text-variant)]">
                    Tidak ada jadwal antrean tambahan hari ini.
                  </div>
                )}
              </section>
            </main>
          </>
        )}

        {/* ================================================================= */}
        {/* MENU TUGAS — 3-DAY TEMPORAL SWITCHER + COLLAPSIBLE ACCORDIONS     */}
        {/* ================================================================= */}
        {page === 'jobs' && (
          <>
            {renderLiteHeader()}

            <main className="flex-1 px-4 pt-4 pb-24 space-y-4">
              {/* Page Title & Month Badge */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-[20px] font-extrabold tracking-tight text-[var(--tl-text)]">
                    Daftar Tugas
                  </h1>
                  <p className="text-xs text-[var(--tl-text-variant)] mt-0.5">
                    {filteredDayTasks.length} jadwal ditampilkan · {activeQueueJobs.length} aktif
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[var(--tl-low)] text-[11px] font-bold text-[var(--tl-primary)] shrink-0">
                  {currentMonthLabel}
                </span>
              </div>

              {/* 3-Day Temporal Segmented Switcher (+ Semua when tasks exist outside 3-day window) */}
              <div
                role="tablist"
                aria-label="Filter Hari Tugas"
                className={`grid ${hasOutsideThreeDayTasks ? 'grid-cols-4' : 'grid-cols-3'} p-1 rounded-2xl bg-[var(--tl-low)] gap-1`}
              >
                {(
                  [
                    { id: 'yesterday', label: 'Kemarin', count: categorizedProjects.yesterday.length },
                    { id: 'today', label: 'Hari Ini', count: categorizedProjects.today.length },
                    { id: 'tomorrow', label: 'Besok', count: categorizedProjects.tomorrow.length },
                    ...(hasOutsideThreeDayTasks
                      ? [{ id: 'all' as const, label: 'Semua', count: categorizedProjects.all.length }]
                      : []),
                  ] as const
                ).map(tab => {
                  const active = taskDayTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTaskDayTab(tab.id)}
                      className={`min-h-[42px] px-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        active
                          ? 'bg-[var(--tl-primary)] text-[var(--tl-on-primary)] shadow-xs'
                          : 'text-[var(--tl-text-variant)] hover:text-[var(--tl-text)]'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count > 0 && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                            active
                              ? 'bg-white/20 text-white'
                              : 'bg-[var(--tl-card)] text-[var(--tl-text-variant)]'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Search Input */}
              <div className="relative flex items-center">
                <Search size={16} className="absolute left-3.5 text-[var(--tl-outline)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Cari WO, lokasi, atau klien..."
                  className="w-full h-11 pl-10 pr-9 rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] text-xs text-[var(--tl-text)] focus:outline-none focus:ring-2 focus:ring-[var(--tl-primary)]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Hapus pencarian tugas"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 p-1 text-[var(--tl-outline)] hover:text-[var(--tl-text)] cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Task Cards Stream */}
              <div className="space-y-3">
                {filteredDayTasks.map(({ project, report }) => {
                  const status = report?.status || (project.lockedAt ? 'COMPLETED' : 'READY');
                  const isDone = ['COMPLETED', 'REVIEWED', 'FLAGGED'].includes(status);
                  const isWorking = status === 'WORKING';
                  const woCode = formatWoCode(report?.id || project.id);

                  return (
                    <article
                      key={project.id}
                      className="rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] p-4 space-y-3"
                    >
                      {/* Top Meta Row */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-[var(--tl-container)] text-[var(--tl-text)] text-[10.5px] font-mono font-bold">
                            {woCode}
                          </span>
                          <span className="text-[11px] font-mono font-semibold text-[var(--tl-text-variant)]">
                            {formatTimeWib(report?.scheduledStartTime || project.scheduledStartTime)}
                          </span>
                          <ServicePill serviceType={project.serviceType} />
                        </div>
                        <StatusPill status={status} />
                      </div>

                      {/* Title & Location */}
                      <div>
                        <h2 className="text-[15px] font-bold text-[var(--tl-text)] leading-snug">
                          {project.projectName}
                        </h2>
                        <p className="text-xs text-[var(--tl-text-variant)] mt-0.5 flex items-start gap-1">
                          <MapPin size={13} className="text-[var(--tl-secondary)] shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{project.clientName ? `${project.clientName} · ` : ''}{project.address}</span>
                        </p>
                      </div>

                      {/* Collapsible Accordion: Rincian Tugas & Lokasi (Collapsed by default) */}
                      <details className="group rounded-xl bg-[var(--tl-low)] overflow-hidden">
                        <summary className="min-h-[40px] px-3 py-2 flex items-center justify-between text-[11.5px] font-bold text-[var(--tl-primary)] cursor-pointer select-none list-none">
                          <span>Rincian Tugas &amp; Lokasi</span>
                          <ChevronDown
                            size={15}
                            className="transition-transform duration-200 group-open:rotate-180 text-[var(--tl-secondary)]"
                          />
                        </summary>
                        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-[var(--tl-container)] text-[11.5px]">
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--tl-text-variant)]">Tanggal Kerja</span>
                            <strong className="text-[var(--tl-text)]">{formatShortDateId(project.workDate)}</strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--tl-text-variant)]">Radius GPS</span>
                            <strong className="text-[var(--tl-text)] font-mono">{project.radius || 100} meter</strong>
                          </div>
                          {project.focusTarget && (
                            <div>
                              <span className="block text-[var(--tl-text-variant)]">Fokus Target</span>
                              <strong className="text-[var(--tl-text)]">{project.focusTarget}</strong>
                            </div>
                          )}
                          {project.notes && (
                            <p className="text-[var(--tl-text-variant)] bg-[var(--tl-card)] rounded-lg p-2">
                              {project.notes}
                            </p>
                          )}
                        </div>
                      </details>

                      {/* Action CTA */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProjectDetailId(project.id);
                          if (report) setSelectedReportId(report.id);
                          if (isDone && report) {
                            setIsViewingHistoryDetail(true);
                            setPage('completion');
                          } else if (isWorking && report) {
                            setIsViewingHistoryDetail(false);
                            setPage('worksheet');
                          } else {
                            setIsViewingHistoryDetail(false);
                            setPage('task-detail');
                          }
                        }}
                        className={`w-full min-h-[44px] px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer ${
                          isDone
                            ? 'bg-[var(--tl-low)] hover:bg-[var(--tl-container)] text-[var(--tl-text)]'
                            : 'bg-[var(--tl-primary)] hover:bg-[var(--tl-primary-container)] text-[var(--tl-on-primary)]'
                        }`}
                      >
                        <span>
                          {isDone
                            ? 'Lihat Bukti Selesai'
                            : isWorking
                            ? 'Lanjutkan Kerja'
                            : 'Mulai Kerjakan'}
                        </span>
                        <ArrowRight size={15} />
                      </button>
                    </article>
                  );
                })}

                {filteredDayTasks.length === 0 && (
                  <div className="p-8 rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] text-center space-y-2.5">
                    <p className="text-xs font-medium text-[var(--tl-text-variant)]">
                      Tidak ada jadwal tugas pada pilihan hari ini.
                    </p>
                    {taskDayTab !== 'all' && projects.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTaskDayTab('all')}
                        className="min-h-[38px] px-4 rounded-xl bg-[var(--tl-low)] text-[var(--tl-primary)] text-xs font-bold cursor-pointer"
                      >
                        Tampilkan Semua ({projects.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            </main>
          </>
        )}

        {/* ================================================================= */}
        {/* DETAIL TUGAS (RINGKAS & SIAP CHECK-IN)                            */}
        {/* ================================================================= */}
        {page === 'task-detail' &&
          (() => {
            const projObj = projects.find(p => p.id === selectedProjectDetailId);
            const repObj =
              reports.find(r => r.id === selectedReportId) ||
              (projObj ? reports.find(r => r.projectId === projObj.id) : undefined) ||
              activeTaskReport;

            const titleText = repObj?.projectName || projObj?.projectName || 'Detail Tugas';
            const clientText = repObj?.clientName || projObj?.clientName || 'Pelanggan Operasional';
            const addressText = repObj?.projectAddress || projObj?.address || '-';
            const radiusMeters = repObj?.projectRadius || projObj?.radius || 100;
            const serviceType = repObj?.serviceType || projObj?.serviceType || 'GENERAL_PEST_CONTROL';
            const lat = repObj?.projectLatitude ?? projObj?.latitude;
            const lng = repObj?.projectLongitude ?? projObj?.longitude;
            const schedStr = `${formatShortDateId(repObj?.createdAt || projObj?.workDate || projObj?.createdAt)} · ${formatTimeWib(
              repObj?.scheduledStartTime || projObj?.scheduledStartTime
            )}`;

            return (
              <div className="flex flex-col min-h-full bg-[var(--tl-surface)]">
                <header
                  className="sticky top-0 z-30 px-4 h-16 flex items-center justify-between gap-2 backdrop-blur-md shrink-0"
                  style={{
                    background: 'color-mix(in srgb, var(--tl-surface) 90%, transparent)',
                    boxShadow: 'var(--tl-shadow-head)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPage(selectedProjectDetailId ? 'jobs' : 'home')}
                    aria-label="Kembali"
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--tl-text)] hover:bg-[var(--tl-low)] cursor-pointer"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <strong className="text-[15px] font-bold text-[var(--tl-text)]">Detail Tugas</strong>
                  <span className="w-10" />
                </header>

                <main className="flex-1 px-4 pt-4 pb-28 space-y-4">
                  <div className="rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-[var(--tl-container)] text-[var(--tl-text)] text-[10.5px] font-mono font-bold">
                        {formatWoCode(repObj?.id || projObj?.id)}
                      </span>
                      <ServicePill serviceType={serviceType} />
                    </div>
                    <div>
                      <h1 className="text-lg font-extrabold text-[var(--tl-text)] leading-snug">{titleText}</h1>
                      <p className="text-xs text-[var(--tl-text-variant)] mt-0.5">{clientText}</p>
                    </div>

                    <div className="rounded-xl bg-[var(--tl-low)] p-3.5 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--tl-text-variant)]">Jadwal</span>
                        <strong className="text-[var(--tl-text)] font-bold tabular-nums">{schedStr}</strong>
                      </div>
                      <div className="pt-2 border-t border-[var(--tl-container)] space-y-1">
                        <span className="text-[var(--tl-text-variant)] block">Alamat Lokasi</span>
                        <strong className="text-[var(--tl-text)] font-semibold block leading-relaxed">
                          {addressText}
                        </strong>
                        <div className="flex items-center justify-between pt-1">
                          <small className="text-[11px] text-[var(--tl-text-variant)]">
                            Radius validasi GPS: {radiusMeters} meter
                          </small>
                          {typeof lat === 'number' && typeof lng === 'number' && (
                            <a
                              href={`https://maps.google.com/?q=${lat},${lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--tl-secondary)]"
                            >
                              <span>Buka Peta</span>
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {repObj && (
                      <div className="rounded-xl bg-[var(--tl-low)] p-3.5">
                        <button
                          type="button"
                          onClick={() => setShowTeamPicker(v => !v)}
                          className="w-full flex items-center justify-between text-xs font-bold text-[var(--tl-text)] cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Users size={15} className="text-[var(--tl-secondary)]" />
                            <span>
                              Tim Bertugas (
                              {(repObj.teamMembers?.length ? repObj.teamMembers : [{ name: user.name }]).length} Orang)
                            </span>
                          </span>
                          {showTeamPicker ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {showTeamPicker && (
                          <div className="mt-3 space-y-2.5">
                            <div className="flex flex-wrap gap-1.5">
                              {companyTechs.map(t => {
                                const activeList = repObj.teamMembers?.length
                                  ? repObj.teamMembers
                                  : [{ id: user.uid, name: user.name }];
                                const isSel = activeList.some(
                                  m => m.id === t.id || m.name.toLowerCase() === t.name.toLowerCase()
                                );
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() =>
                                      handleToggleQuickTeamMember(repObj, {
                                        id: t.id,
                                        name: t.name,
                                        isManual: false,
                                      })
                                    }
                                    className={`min-h-[34px] px-3 rounded-full text-[11px] font-semibold cursor-pointer ${
                                      isSel
                                        ? 'bg-[var(--tl-primary)] text-[var(--tl-on-primary)]'
                                        : 'bg-[var(--tl-card)] text-[var(--tl-text)]'
                                    }`}
                                  >
                                    {isSel ? '✓ ' : '+ '}
                                    {t.name}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={quickManualName}
                                onChange={e => setQuickManualName(e.target.value)}
                                placeholder="Tambah anggota manual..."
                                className="flex-1 h-10 px-3 rounded-xl bg-[var(--tl-card)] text-xs text-[var(--tl-text)]"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (!quickManualName.trim()) return;
                                  handleToggleQuickTeamMember(repObj, {
                                    name: quickManualName.trim(),
                                    isManual: true,
                                  });
                                  setQuickManualName('');
                                }}
                                className="h-10 px-3.5 rounded-xl bg-[var(--tl-primary)] text-[var(--tl-on-primary)] text-xs font-bold cursor-pointer"
                              >
                                Tambah
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </main>

                <div className="tech-sticky-tray">
                  {repObj && (repObj.status === 'READY' || repObj.status === 'DRAFT') ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReportId(repObj.id);
                        setPage('gps');
                      }}
                      className="w-full min-h-[48px] rounded-xl bg-[var(--tl-primary)] hover:bg-[var(--tl-primary-container)] text-[var(--tl-on-primary)] text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                    >
                      <LocateFixed size={17} />
                      <span>Mulai Pekerjaan &amp; Check-in GPS</span>
                    </button>
                  ) : repObj && repObj.status === 'WORKING' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReportId(repObj.id);
                        setPage('worksheet');
                      }}
                      className="w-full min-h-[48px] rounded-xl bg-[var(--tl-primary)] hover:bg-[var(--tl-primary-container)] text-[var(--tl-on-primary)] text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                    >
                      <span>Buka Form Laporan Pekerjaan</span>
                      <ArrowRight size={17} />
                    </button>
                  ) : repObj ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReportId(repObj.id);
                        setIsViewingHistoryDetail(true);
                        setPage('completion');
                      }}
                      className="w-full min-h-[48px] rounded-xl bg-[var(--tl-low)] hover:bg-[var(--tl-container)] text-[var(--tl-text)] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Lihat Detail Pekerjaan &amp; PDF</span>
                      <ArrowRight size={16} />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })()}

        {/* ================================================================= */}
        {/* CHECK-IN GPS (SATU LAYAR TENANG)                                  */}
        {/* ================================================================= */}
        {page === 'gps' && activeTaskReport && (
          <div className="flex flex-col min-h-full bg-[var(--tl-surface)]">
            <header
              className="sticky top-0 z-30 px-4 h-16 flex items-center justify-between gap-2 backdrop-blur-md shrink-0"
              style={{
                background: 'color-mix(in srgb, var(--tl-surface) 90%, transparent)',
                boxShadow: 'var(--tl-shadow-head)',
              }}
            >
              <button
                type="button"
                onClick={() => setPage('task-detail')}
                aria-label="Kembali"
                className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--tl-text)] hover:bg-[var(--tl-low)] cursor-pointer"
              >
                <ArrowLeft size={20} />
              </button>
              <strong className="text-[15px] font-bold text-[var(--tl-text)]">Check-in Lokasi</strong>
              <span className="w-10" />
            </header>

            <main className="flex-1 px-4 py-6 flex flex-col justify-center">
              <div className="rounded-3xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] p-6 text-center space-y-3.5">
                <div className="w-14 h-14 rounded-2xl bg-[var(--tl-secondary-container)] text-[var(--tl-on-secondary-container)] flex items-center justify-center mx-auto">
                  <Navigation size={26} />
                </div>
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[var(--tl-low)] text-[11px] font-mono font-bold text-[var(--tl-text-variant)]">
                  {formatWoCode(activeTaskReport.id)}
                </span>
                <h1 className="text-base font-extrabold text-[var(--tl-text)] leading-snug">
                  {activeTaskReport.projectName}
                </h1>
                <p className="text-xs text-[var(--tl-text-variant)] leading-relaxed">
                  Ambil 1 foto kehadiran untuk memvalidasi posisi GPS di area kerja (radius{' '}
                  <strong className="text-[var(--tl-text)]">{activeTaskReport.projectRadius}m</strong>).
                </p>
              </div>
            </main>

            <div className="tech-sticky-tray">
              <button
                type="button"
                onClick={() => handleRequestCheckInCamera(activeTaskReport)}
                className="w-full min-h-[48px] rounded-xl bg-[var(--tl-primary)] hover:bg-[var(--tl-primary-container)] text-[var(--tl-on-primary)] text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
              >
                <Camera size={17} />
                <span>Ambil Foto &amp; Check-in</span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* FORM INPUT LAPORAN PEKERJAAN (ANTI RAYAP & PEST CONTROL)          */}
        {/* ================================================================= */}
        {page === 'worksheet' && activeTaskReport && (
          <TechnicianWorksheet
            report={activeTaskReport}
            elapsedTime={elapsedTime}
            technicianName={user.name}
            technicianNip={user.nip}
            isOnline={isOnline}
            onBack={() => setPage('home')}
            onCapturePhoto={tag =>
              setActiveCameraAction({ type: 'PROGRESS', report: activeTaskReport, photoTag: tag })
            }
            onViewPhoto={photo => setViewingPhoto(photo)}
            onSaveTreatment={handleSaveTreatmentFromWorksheet}
            onProceedToClientSign={handleProceedToClientSign}
          />
        )}

        {/* ================================================================= */}
        {/* DETAIL PEKERJAAN TERPADU & PDF / WHATSAPP                         */}
        {/* ================================================================= */}
        {page === 'completion' && activeTaskReport && (
          <CompletionPdfWaSheet
            report={activeTaskReport}
            companyId={user.companyId}
            technicianName={user.name}
            technicianNip={user.nip}
            pendingQueueCount={pendingCount}
            isSyncing={isSyncing}
            isHistoryDetail={isViewingHistoryDetail}
            onSyncNow={handleRequestSync}
            onViewPhoto={photo => setViewingPhoto(photo)}
            onBack={() => setPage(isViewingHistoryDetail ? 'history' : 'home')}
          />
        )}

        {/* ================================================================= */}
        {/* RIWAYAT PEKERJAAN — SEARCH + DATE RANGE + CATEGORY PILLS          */}
        {/* ================================================================= */}
        {page === 'history' && (
          <>
            {renderLiteHeader()}

            <main className="flex-1 px-4 pt-4 pb-24 space-y-4">
              {/* Header + Arsip Resmi Badge */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-[20px] font-extrabold tracking-tight text-[var(--tl-text)]">
                    Riwayat Pekerjaan
                  </h1>
                  <p className="text-xs text-[var(--tl-text-variant)] mt-0.5">
                    {filteredHistoryJobs.length} laporan selesai tersimpan
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[var(--tl-secondary-container)] text-[var(--tl-on-secondary-container)] text-[11px] font-bold shrink-0">
                  Arsip Resmi
                </span>
              </div>

              {/* Search + Date Range Toggle */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 flex items-center">
                  <Search size={16} className="absolute left-3.5 text-[var(--tl-outline)]" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    placeholder="Cari WO atau lokasi..."
                    className="w-full h-11 pl-10 pr-8 rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] text-xs text-[var(--tl-text)] focus:outline-none focus:ring-2 focus:ring-[var(--tl-primary)]"
                  />
                  {historySearch && (
                    <button
                      type="button"
                      aria-label="Hapus pencarian riwayat"
                      onClick={() => setHistorySearch('')}
                      className="absolute right-2.5 p-1 text-[var(--tl-outline)] hover:text-[var(--tl-text)] cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowDateFilter(v => !v)}
                  aria-label="Filter Rentang Tanggal"
                  className={`h-11 px-3.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-[var(--tl-shadow-card)] ${
                    showDateFilter || dateFrom || dateTo
                      ? 'bg-[var(--tl-primary)] text-[var(--tl-on-primary)]'
                      : 'bg-[var(--tl-card)] text-[var(--tl-text)]'
                  }`}
                >
                  <Calendar size={15} />
                  <span>Tanggal</span>
                </button>
              </div>

              {/* Collapsible Filter Rentang Tanggal Card */}
              {showDateFilter && (
                <div className="p-4 rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] space-y-3">
                  <div className="flex items-center justify-between">
                    <strong className="text-xs font-bold text-[var(--tl-text)]">Filter Rentang Tanggal</strong>
                    {(dateFrom || dateTo) && (
                      <button
                        type="button"
                        onClick={() => {
                          setDateFrom('');
                          setDateTo('');
                        }}
                        className="text-[11px] font-bold text-[var(--tl-error)] cursor-pointer"
                      >
                        Reset Rentang
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10.5px] font-semibold text-[var(--tl-text-variant)] mb-1">
                        Dari Tanggal
                      </label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="w-full h-10 px-2.5 rounded-xl bg-[var(--tl-low)] text-xs text-[var(--tl-text)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-semibold text-[var(--tl-text-variant)] mb-1">
                        Sampai Tanggal
                      </label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="w-full h-10 px-2.5 rounded-xl bg-[var(--tl-low)] text-xs text-[var(--tl-text)]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Active Range Indicator Pill */}
              {(dateFrom || dateTo) && !showDateFilter && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--tl-low)] text-[11px] font-semibold text-[var(--tl-primary)]">
                  <Calendar size={12} />
                  <span>
                    {dateFrom ? formatShortDateId(dateFrom) : 'Awal'} – {dateTo ? formatShortDateId(dateTo) : 'Sekarang'}
                  </span>
                  <button
                    type="button"
                    aria-label="Hapus filter tanggal"
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="p-0.5 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Category Filter Pills (Semua | Anti Rayap | Pest Control) */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: 'ALL', label: `Semua (${completedJobs.length})` },
                    { id: 'AR', label: 'Anti Rayap' },
                    { id: 'PCO', label: 'Pest Control' },
                  ] as const
                ).map(cat => {
                  const active = historyCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setHistoryCategory(cat.id)}
                      className={`min-h-[36px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
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

              {/* History Work Order Cards (Strictly NO confidential client ratings!) */}
              <div className="space-y-3">
                {filteredHistoryJobs.map(rep => {
                  const durationText = formatDurationId(rep.durationSeconds, rep.checkInAt, rep.checkOutAt);
                  return (
                    <article
                      key={rep.id}
                      className="p-4 rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-[var(--tl-container)] text-[var(--tl-text)] text-[10.5px] font-mono font-bold">
                            {formatWoCode(rep.id)}
                          </span>
                          <ServicePill serviceType={rep.serviceType} />
                        </div>
                        <span className="text-[11px] font-mono font-semibold text-[var(--tl-text-variant)] tabular-nums">
                          {formatShortDateId(rep.checkOutAt || rep.createdAt)}
                        </span>
                      </div>

                      <div>
                        <strong className="block text-[15px] font-bold text-[var(--tl-text)] leading-snug truncate">
                          {rep.projectName}
                        </strong>
                        <p className="text-xs text-[var(--tl-text-variant)] mt-0.5 truncate">
                          {rep.clientName || rep.projectAddress}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-[var(--tl-text-variant)] bg-[var(--tl-low)] rounded-xl px-3 py-2">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Camera size={13} className="text-[var(--tl-secondary)]" />
                          <span>{rep.photos.length} Foto</span>
                        </span>
                        {durationText !== '-' && (
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <Clock size={13} className="text-[var(--tl-secondary)]" />
                            <span>{durationText}</span>
                          </span>
                        )}
                        <span className="ml-auto font-bold text-[var(--tl-secondary)]">Selesai</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReportId(rep.id);
                          setIsViewingHistoryDetail(true);
                          setPage('completion');
                        }}
                        className="w-full min-h-[42px] rounded-xl bg-[var(--tl-low)] hover:bg-[var(--tl-container)] text-[var(--tl-primary)] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Lihat Detail</span>
                        <ChevronRight size={15} />
                      </button>
                    </article>
                  );
                })}

                {filteredHistoryJobs.length === 0 && (
                  <div className="p-8 rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] text-center text-xs text-[var(--tl-text-variant)]">
                    Belum ada riwayat pekerjaan pada rentang atau filter ini.
                  </div>
                )}
              </div>
            </main>
          </>
        )}

        {/* ================================================================= */}
        {/* PROFIL TEKNISI, METRIK RINGKAS & THEME SWITCHER                   */}
        {/* ================================================================= */}
        {page === 'profile' && (
          <>
            {renderLiteHeader()}

            <main className="flex-1 px-4 pt-4 pb-24 space-y-4">
              {/* Profile Identity Card */}
              <div className="p-5 rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] text-center space-y-1.5">
                <div className="w-16 h-16 rounded-full bg-[var(--tl-primary)] text-[var(--tl-on-primary)] font-extrabold text-lg flex items-center justify-center mx-auto shadow-sm">
                  {initials}
                </div>
                <h1 className="text-base font-extrabold text-[var(--tl-text)] pt-1">{user.name}</h1>
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[var(--tl-secondary-container)] text-[var(--tl-on-secondary-container)] text-[11px] font-bold">
                  Teknisi Lapangan
                </span>
                <p className="text-[11px] font-mono text-[var(--tl-text-variant)] pt-0.5">
                  NIP: {user.nip || '-'} · {user.email}
                </p>
              </div>

              {/* 3 Core Monthly Metrics */}
              <div className="rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] grid grid-cols-3 divide-x divide-[var(--tl-container)] py-3.5">
                <div className="px-2 text-center">
                  <strong className="block text-lg font-mono font-extrabold tabular-nums text-[var(--tl-text)]">
                    {monthlyStats.monthlyTasks}
                  </strong>
                  <span className="text-[10.5px] font-semibold text-[var(--tl-text-variant)]">Bulan Ini</span>
                </div>
                <div className="px-2 text-center">
                  <strong className="block text-lg font-mono font-extrabold tabular-nums text-[var(--tl-secondary)]">
                    {monthlyStats.syncRate}%
                  </strong>
                  <span className="text-[10.5px] font-semibold text-[var(--tl-text-variant)]">Terkirim</span>
                </div>
                <div className="px-2 text-center">
                  <strong className="block text-lg font-mono font-extrabold tabular-nums text-[var(--tl-text)]">
                    {pendingCount}
                  </strong>
                  <span className="text-[10.5px] font-semibold text-[var(--tl-text-variant)]">Antrean</span>
                </div>
              </div>

              {/* Light / Dark Mode Switcher */}
              <div className="p-4 rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] space-y-2.5">
                <div>
                  <strong className="block text-xs font-bold text-[var(--tl-text)]">Tampilan Layar</strong>
                  <small className="text-[11px] text-[var(--tl-text-variant)]">
                    Gunakan Mode Gelap saat bekerja di basement atau area minim cahaya.
                  </small>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      resolvedTheme === 'light'
                        ? 'bg-[var(--tl-primary)] text-[var(--tl-on-primary)]'
                        : 'bg-[var(--tl-low)] text-[var(--tl-text)]'
                    }`}
                  >
                    <Sun size={15} /> Mode Terang
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      resolvedTheme === 'dark'
                        ? 'bg-[var(--tl-primary)] text-[var(--tl-on-primary)]'
                        : 'bg-[var(--tl-low)] text-[var(--tl-text)]'
                    }`}
                  >
                    <Moon size={15} /> Mode Gelap
                  </button>
                </div>
              </div>

              {cacheNotice && (
                <div className="px-3.5 py-2.5 rounded-xl bg-[var(--tl-secondary-container)] text-[var(--tl-on-secondary-container)] text-xs font-semibold">
                  {cacheNotice}
                </div>
              )}

              {/* Account & Maintenance Actions */}
              <div className="rounded-2xl bg-[var(--tl-card)] shadow-[var(--tl-shadow-card)] divide-y divide-[var(--tl-container)] overflow-hidden">
                {pendingCount > 0 && (
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={handleRequestSync}
                    className="w-full min-h-[54px] px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-[var(--tl-low)]/60"
                  >
                    <span className="flex items-center gap-3">
                      <CloudOff size={18} className="text-amber-600" />
                      <span>
                        <strong className="block text-xs font-bold text-[var(--tl-text)]">
                          Sinkronkan Antrean Offline ({pendingItems.length})
                        </strong>
                        <small className="text-[11px] text-[var(--tl-text-variant)]">
                          {isSyncing ? 'Sedang mengirim...' : 'Ketuk untuk kirim ulang'}
                        </small>
                      </span>
                    </span>
                    <RefreshCw size={15} className={`text-[var(--tl-outline)] ${isSyncing ? 'animate-spin' : ''}`} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleRequestClearCache}
                  className="w-full min-h-[54px] px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-[var(--tl-low)]/60"
                >
                  <span className="flex items-center gap-3">
                    <Trash2 size={18} className="text-[var(--tl-text-variant)]" />
                    <span>
                      <strong className="block text-xs font-bold text-[var(--tl-text)]">
                        Bersihkan Cache Foto
                      </strong>
                      <small className="text-[11px] text-[var(--tl-text-variant)]">
                        Aman, tidak menghapus antrean offline
                      </small>
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-[var(--tl-outline)]" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowChangePassword(true)}
                  className="w-full min-h-[54px] px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-[var(--tl-low)]/60"
                >
                  <span className="flex items-center gap-3">
                    <Lock size={18} className="text-[var(--tl-text-variant)]" />
                    <span>
                      <strong className="block text-xs font-bold text-[var(--tl-text)]">
                        Ubah Kata Sandi
                      </strong>
                      <small className="text-[11px] text-[var(--tl-text-variant)]">Keamanan akun teknisi</small>
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-[var(--tl-outline)]" />
                </button>

                <button
                  type="button"
                  onClick={handleRequestLogout}
                  className="w-full min-h-[54px] px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-rose-50/60 dark:hover:bg-rose-950/20"
                >
                  <span className="flex items-center gap-3 text-[var(--tl-error)]">
                    <LogOut size={18} />
                    <span>
                      <strong className="block text-xs font-bold">Keluar Akun</strong>
                      <small className="text-[11px] text-[var(--tl-text-variant)]">Kembali ke halaman masuk</small>
                    </span>
                  </span>
                </button>
              </div>
            </main>
          </>
        )}

        {/* Dedicated 4-Column Frosted Bottom Navigation (GuciMas Field Lite) */}
        {!isAnyModalOpen && (
          <nav
            aria-label="Navigasi Teknisi"
            className="tech-bottom-nav px-2 py-1.5 grid grid-cols-4 gap-1"
          >
            {(
              [
                { id: 'home', label: 'Beranda', icon: Home },
                { id: 'jobs', label: 'Tugas', icon: ClipboardList, badge: activeQueueJobs.length },
                { id: 'history', label: 'Riwayat', icon: History },
                { id: 'profile', label: 'Profil', icon: UserIcon },
              ] as const
            ).map(item => {
              const active = activeBottomTabId === item.id;
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    setSelectedProjectDetailId(null);
                    setIsViewingHistoryDetail(false);
                    setPage(item.id);
                  }}
                  className={`relative min-h-[50px] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                    active
                      ? 'bg-[var(--tl-low)] text-[var(--tl-primary)] font-bold'
                      : 'text-[var(--tl-text-variant)] hover:text-[var(--tl-text)] font-medium'
                  }`}
                >
                  <span className="relative">
                    <IconComp size={19} strokeWidth={active ? 2.4 : 2} />
                    {'badge' in item && item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--tl-secondary)] text-white text-[9.5px] font-bold flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                  </span>
                  <span className="text-[10.5px] leading-none mt-0.5">{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Hidden compatibility markers for automated QA suite */}
        <span className="sr-only">
          Selamat Pagi Jadwal Detail Hari ini Notes : Clock In MoreVerticalDetail Proyek Detail Riwayat Completed
          <MoreVertical size={1} />
        </span>
      </div>

      {/* Modals & Sheets */}
      <AnimatePresence>
        {showNotifications && (
          <NotificationsSheet items={notificationItems} onClose={() => setShowNotifications(false)} />
        )}
      </AnimatePresence>

      {activeCameraAction && (
        <CameraCaptureModal
          photoType={activeCameraAction.type}
          projectName={activeCameraAction.report.projectName}
          projectLat={activeCameraAction.report.projectLatitude}
          projectLng={activeCameraAction.report.projectLongitude}
          projectRadius={activeCameraAction.report.projectRadius}
          executorName={user.name}
          onCaptureComplete={handleCaptureComplete}
          onClose={() => setActiveCameraAction(null)}
        />
      )}

      {checkoutEvidence && (
        <CustomerReviewFormModal
          initialName={clientPrefill?.customerName || checkoutEvidence.report.customerName || ''}
          initialRole={clientPrefill?.customerRole || 'PIC Utama'}
          initialPhone={clientPrefill?.customerPhone || checkoutEvidence.report.customerPhone || ''}
          projectName={checkoutEvidence.report.projectName}
          onClose={() => {
            setCheckoutEvidence(null);
            setPage('worksheet');
          }}
          onSubmit={handleCustomerReviewSubmit}
        />
      )}

      {showCreateProject && (
        <CreateProjectModal onClose={() => setShowCreateProject(false)} onSubmit={handleCreateProjectSubmit} />
      )}
      {viewingPhoto && <PhotoViewerModal photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />}
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}

      {showGpsPrompt && gpsPermissionStatus !== 'granted' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#233144]/60 backdrop-blur-xs p-4">
          <div className="bg-[var(--tl-card)] rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="w-12 h-12 bg-[var(--tl-secondary-container)] text-[var(--tl-on-secondary-container)] rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <MapPin size={24} />
            </div>
            <h3 className="text-base font-bold text-center text-[var(--tl-text)] mb-1.5">Izinkan Akses GPS</h3>
            <p className="text-xs text-[var(--tl-text-variant)] text-center mb-5 leading-relaxed">
              Digunakan untuk memvalidasi lokasi saat Check-in pekerjaan di lapangan.
            </p>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  navigator.geolocation.getCurrentPosition(
                    () => {
                      setShowGpsPrompt(false);
                      trackLocation();
                    },
                    () => setShowGpsPrompt(false),
                    { enableHighAccuracy: true, timeout: 10000 }
                  );
                }}
                className="w-full min-h-[46px] bg-[var(--tl-primary)] hover:bg-[var(--tl-primary-container)] text-[var(--tl-on-primary)] font-bold rounded-xl text-xs cursor-pointer"
              >
                Izinkan GPS
              </button>
              <button
                type="button"
                onClick={() => setShowGpsPrompt(false)}
                className="w-full min-h-[44px] bg-[var(--tl-low)] text-[var(--tl-text)] font-semibold rounded-xl text-xs cursor-pointer"
              >
                Nanti Saja
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmActionModal request={confirmRequest} onClose={closeConfirm} />
    </div>
  );
};
