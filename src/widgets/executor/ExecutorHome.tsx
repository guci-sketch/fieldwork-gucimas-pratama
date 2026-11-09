import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WorkReport, Project, DocumentationPhoto, PhotoType, PhotoTag } from '@/entities/types';
import { useAuth } from '@/app/providers/AuthContext';
import { fetchMyWorkReports, checkIn, addProgressPhoto, checkOut, submitTreatment, updateWorkReportTeam, TreatmentInput, TeamMemberEntry } from '@/shared/api/workReports';
import { supabase } from '@/shared/lib/supabase';
import { createProject, fetchMyProjects, CreateProjectInput } from '@/shared/api/projects';
import { ApiError } from '@/shared/api/client';
import { getQueueLength, enqueue, enqueueTreatment, enqueueGps, syncQueue } from '@/shared/utils/offlineQueue';
import { CameraCaptureModal } from '../camera/CameraCaptureModal';
import { CreateProjectModal } from './CreateProjectModal';
import { TreatmentFormModal } from './TreatmentFormModal';
import { PhotoViewerModal } from '../common/PhotoViewerModal';
import { AuthedImage } from '../common/AuthedImage';
import { RiskBadge } from '../common/RiskBadge';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import { getServiceTypeMeta } from '@/shared/utils/serviceMeta';
import { formatDistance, calculateDistanceMeters } from '@/shared/utils/geo';
import { Header } from '../common/Header';
import { TabContainer } from '@/shared/ui/TabContainer';
import {
  Plus, Camera, Clock, MapPin, Briefcase, History, User as UserIcon,
  Home, Check, Lock, Eye, LogOut, AlertCircle, ImagePlus, ShieldCheck, MoreVertical, Users,
} from 'lucide-react';

import { CustomerReviewFormModal } from './CustomerReviewFormModal';
import { postLocation } from '@/shared/api/location';

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat Pagi';
  if (hour < 15) return 'Selamat Siang';
  if (hour < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

function formatScheduleDateId(dateStr?: string | null): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatScheduleWindow(startTime?: string | null): string {
  if (!startTime) return '08.00 - 14.00';
  const normalized = startTime.replace(':', '.');
  if (normalized.includes('-')) return normalized;
  const startHour = parseInt(normalized.split('.')[0] || '8', 10);
  const endHour = Number.isNaN(startHour) ? 14 : Math.min(23, startHour + 6);
  return `${normalized} - ${String(endHour).padStart(2, '0')}.00`;
}

export const ExecutorHome: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'home' | 'jobs' | 'history' | 'profile'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [pendingCount, setPendingCount] = useState(0);
  const [serverTimeOffset] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [activeCameraAction, setActiveCameraAction] = useState<{ type: PhotoType; report: WorkReport; photoTag?: PhotoTag } | null>(null);
  const [treatmentFormReport, setTreatmentFormReport] = useState<WorkReport | null>(null);
  const [checkoutEvidence, setCheckoutEvidence] = useState<{ report: WorkReport; evidence: any } | null>(() => {
    try {
      const cached = sessionStorage.getItem('fw_checkout');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  useEffect(() => {
    if (checkoutEvidence) sessionStorage.setItem('fw_checkout', JSON.stringify(checkoutEvidence));
    else sessionStorage.removeItem('fw_checkout');
  }, [checkoutEvidence]);
  const [viewingPhoto, setViewingPhoto] = useState<DocumentationPhoto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<{ title: string; subtitle: string; stats?: string } | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [companyTechs, setCompanyTechs] = useState<{ id: string; name: string }[]>([]);
  const [quickManualName, setQuickManualName] = useState('');
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [selectedScheduleIdx, setSelectedScheduleIdx] = useState(0);
  const [showGpsPrompt, setShowGpsPrompt] = useState(false);
  const [gpsPermissionStatus, setGpsPermissionStatus] = useState<string>('unknown');

  // Auto-dismiss notifikasi sukses setelah 7 detik agar UI tetap bersih
  useEffect(() => {
    if (!successFeedback) return;
    const timer = window.setTimeout(() => setSuccessFeedback(null), 7000);
    return () => window.clearTimeout(timer);
  }, [successFeedback]);

  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        setGpsPermissionStatus(result.state);
        if (result.state === 'prompt') {
          if (!sessionStorage.getItem('gps_prompted')) {
            setShowGpsPrompt(true);
            sessionStorage.setItem('gps_prompted', 'true');
          }
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
        if (pos.coords.accuracy === 0) {
           console.warn('GPS rejected: Fake GPS detected (accuracy 0)');
           return;
        }

        if (pos.coords.accuracy > 150) {
          console.warn('GPS rejected: Accuracy too poor (', pos.coords.accuracy, 'm)');
          return;
        }

        const now = Date.now();
        if (lastLocationRef.current) {
          const dist = calculateDistanceMeters(
            { latitude: lastLocationRef.current.latitude, longitude: lastLocationRef.current.longitude },
            { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
          );
          
          if (dist > 50000) {
            console.warn('GPS rejected: Unreasonable distance jump detected (', dist, 'm)');
            return;
          }
        }

        lastLocationRef.current = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timestamp: now
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
    getQueueLength().then(setPendingCount);
    if (user?.companyId) {
      supabase
        .from('users')
        .select('id, name, role')
        .eq('company_id', user.companyId)
        .eq('is_active', true)
        .then(({ data }) => {
          setCompanyTechs(
            (data || []).filter((u: any) => u.role === 'TEKNISI_LAPANGAN').map((u: any) => ({ id: u.id, name: u.name }))
          );
        });
    }
  }, [loadData, user?.companyId]);

  const handleToggleQuickTeamMember = async (rep: WorkReport, member: TeamMemberEntry) => {
    const current = rep.teamMembers && rep.teamMembers.length > 0
      ? rep.teamMembers
      : user ? [{ id: user.uid, name: user.name, role: 'Ketua Tim', isManual: false }] : [];
    const exists = current.some(m => (member.id && m.id === member.id) || m.name.toLowerCase() === member.name.toLowerCase());
    const next = exists
      ? current.filter(m => !((member.id && m.id === member.id) || m.name.toLowerCase() === member.name.toLowerCase()))
      : [...current, member];
    setReports(prev => prev.map(r => r.id === rep.id ? { ...r, teamMembers: next } : r));
    try {
      await updateWorkReportTeam(rep.id, next);
    } catch {
      // ignore if offline
    }
  };

  const attemptSync = useCallback(async () => {
    if (await getQueueLength() === 0) return;
    setIsSyncing(true);
    const { synced } = await syncQueue(remaining => setPendingCount(remaining));
    setIsSyncing(false);
    if (synced > 0) await loadData();
  }, [loadData]);

  useEffect(() => {
    window.addEventListener('online', attemptSync);
    return () => window.removeEventListener('online', attemptSync);
  }, [attemptSync]);

  if (!user) return null;

  const filteredReports = reports.filter(r => 
    searchQuery === '' || 
    r.projectName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (r.clientName && r.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    r.projectAddress.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeQueueJobs = filteredReports.filter(r => r.status === 'WORKING' || r.status === 'READY' || r.status === 'DRAFT');
  const ongoingJob = filteredReports.find(r => r.status === 'WORKING');
  const readyJob = filteredReports.find(r => r.status === 'READY' || r.status === 'DRAFT');
  const completedJobs = filteredReports.filter(r => ['COMPLETED', 'FLAGGED', 'REVIEWED'].includes(r.status));

  // Tugas yang ditampilkan pada kartu "Detail Hari ini"
  const featuredJob: WorkReport | undefined =
    ongoingJob ||
    activeQueueJobs[selectedScheduleIdx] ||
    readyJob ||
    activeQueueJobs[0];

  const scheduleCardsList: WorkReport[] = activeQueueJobs.length > 0
    ? activeQueueJobs
    : completedJobs.slice(0, 2);

  const filteredProjects = projects.filter(p => 
    searchQuery === '' || 
    p.projectName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.clientName && p.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    p.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateProjectSubmit = async (data: CreateProjectInput) => {
    await createProject(data);
    setShowCreateProject(false);
    await loadData();
  };

  const handleCaptureComplete = async (capturedData: { photoBlob: Blob; latitude: number; longitude: number; accuracy: number }) => {
    if (!activeCameraAction) return;
    const { type, report, photoTag } = activeCameraAction;
    setActionError(null);
    const evidence = { photoBlob: capturedData.photoBlob, latitude: capturedData.latitude, longitude: capturedData.longitude, accuracy: capturedData.accuracy, photoTag };

    try {
      if (type === 'CHECK_IN') {
        const updated = await checkIn(report.id, evidence);
        setActiveCameraAction(null);
        await loadData();
        setSuccessFeedback({
          title: '✓ CLOCK-IN & FOTO BERHASIL DISIMPAN',
          subtitle: `Anda tercatat aktif bertugas di ${updated.projectName}.`,
          stats: `Jarak: ${updated.checkInDistance !== null && updated.checkInDistance !== undefined ? formatDistance(updated.checkInDistance) : '-'} • ${updated.checkInValid ? 'Sesuai radius' : 'Di luar radius'} • ${updated.photos.length} foto tercatat`,
        });
      } else if (type === 'PROGRESS') {
        const updated = await addProgressPhoto(report.id, evidence);
        setActiveCameraAction(null);
        await loadData();
        const tagLabel = photoTag === 'BEFORE' ? 'Kondisi Awal' : photoTag === 'AFTER' ? 'Hasil Perlakuan' : 'Progres Lapangan';
        setSuccessFeedback({
          title: `✓ FOTO ${tagLabel.toUpperCase()} BERHASIL DISIMPAN`,
          subtitle: `Dokumentasi foto pada ${updated.projectName} telah tercatat di sistem.`,
          stats: `Total dokumentasi saat ini: ${updated.photos.length} foto • Akurasi GPS ±${Math.round(capturedData.accuracy)}m`,
        });
      } else {
        // Defer checkout to CustomerReviewForm
        setCheckoutEvidence({ report, evidence });
        setActiveCameraAction(null);
        return;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        const queueAction = type === 'CHECK_IN' ? 'CHECK_IN' : type === 'PROGRESS' ? 'PROGRESS' : 'CHECK_OUT';
        await enqueue(queueAction, report.id, evidence);
        getQueueLength().then(setPendingCount);
        setActiveCameraAction(null);
        setSuccessFeedback({
          title: '📶 Disimpan Offline',
          subtitle: 'Tidak ada koneksi internet. Bukti akan otomatis terkirim saat perangkat kembali online.',
        });
      } else {
        const msg = err instanceof Error ? err.message : 'Gagal menyimpan dokumentasi. Coba lagi.';
        setActionError(msg);
        throw new Error(msg);
      }
    }
  };

  const handleTreatmentSubmit = async (input: TreatmentInput) => {
    if (!treatmentFormReport) return;
    try {
      const updated = await submitTreatment(treatmentFormReport.id, input);
      setTreatmentFormReport(null);
      setActiveCameraAction({ type: 'CHECK_OUT', report: updated });
      await loadData();
    } catch (err: any) {
      if (err.status === 0) {
        await enqueueTreatment(treatmentFormReport.id, input);
        getQueueLength().then(setPendingCount);
        setTreatmentFormReport(null);
        setActiveCameraAction({ type: 'CHECK_OUT', report: treatmentFormReport });
        setSuccessFeedback({ title: '📶 Disimpan Offline', subtitle: 'Data treatment masuk antrean. Lanjut check-out.' });
      } else {
        setActionError(err.message || 'Gagal menyimpan treatment.');
      }
    }
  };

  const handleCustomerReviewSubmit = async (reviewData: { customerName: string; customerPhone: string; customerFeedback: string; customerSignature: string }) => {
    if (!checkoutEvidence) return;
    const { report, evidence } = checkoutEvidence;
    setCheckoutEvidence(null);
    setActionError(null);

    const fullEvidence = { ...evidence, ...reviewData };

    try {
      const completed = await checkOut(report.id, fullEvidence);
      const durationMin = completed.durationSeconds ? Math.round(completed.durationSeconds / 60) : 0;
      setSuccessFeedback({
        title: completed.status === 'FLAGGED' ? '⚠ PEKERJAAN SELESAI — DITANDAI UNTUK DITINJAU' : '✓ PEKERJAAN SELESAI',
        subtitle: completed.projectName,
        stats: `Durasi: ${durationMin} menit • ${completed.photos.length} foto tersimpan`,
      });
      await loadData();
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        await enqueue('CHECK_OUT', report.id, fullEvidence);
        getQueueLength().then(setPendingCount);
        setSuccessFeedback({
          title: '📶 Disimpan Offline',
          subtitle: 'Tidak ada koneksi internet. Bukti dan ulasan akan otomatis terkirim saat perangkat kembali online.',
        });
      } else {
        setActionError(err instanceof ApiError ? err.message : 'Gagal menyimpan check-out.');
      }
    }
  };

  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  useEffect(() => {
    if (!ongoingJob?.checkInAt) return;
    const interval = setInterval(() => {
      const start = new Date(ongoingJob.checkInAt!).getTime();
      const diffSec = Math.max(0, Math.floor((Date.now() + serverTimeOffset - start) / 1000));
      const hours = String(Math.floor(diffSec / 3600)).padStart(2, '0');
      const minutes = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
      const seconds = String(diffSec % 60).padStart(2, '0');
      setElapsedTime(`${hours}:${minutes}:${seconds}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [ongoingJob, serverTimeOffset]);

  const initials = user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const greetingText = getTimeGreeting();

  const executorTabs = [
    { id: 'home', label: 'Tugas Hari Ini', shortLabel: 'Tugas', icon: <Home size={15} />, badge: (ongoingJob ? 1 : 0) + (readyJob ? 1 : 0) },
    { id: 'jobs', label: 'Daftar Proyek', shortLabel: 'Proyek', icon: <Briefcase size={15} />, badge: projects.length },
    { id: 'history', label: 'Riwayat Selesai', shortLabel: 'Riwayat', icon: <History size={15} />, badge: completedJobs.length },
    { id: 'profile', label: 'Profil Teknisi', shortLabel: 'Profil', icon: <UserIcon size={15} /> },
  ];
  const activeExecTabMeta = executorTabs.find(t => t.id === activeTab) ?? executorTabs[0];

  // Sembunyikan kapsul navigasi bawah otomatis saat modal/kamera sedang terbuka agar UI tidak menumpuk
  const isAnyModalOpen = Boolean(
    activeCameraAction ||
    treatmentFormReport ||
    checkoutEvidence ||
    showCreateProject ||
    viewingPhoto ||
    showChangePassword ||
    (showGpsPrompt && gpsPermissionStatus !== 'granted')
  );

  // Bangun daftar poin Notes : minimalis untuk kartu Detail Hari ini
  const buildFeaturedNotes = (job: WorkReport): string[] => {
    const notesList: string[] = [];
    if (job.workNotes && job.workNotes.trim()) {
      notesList.push(job.workNotes.trim());
    }
    if (job.targetFocus && job.targetFocus.length > 0) {
      notesList.push(`Fokus target: ${job.targetFocus.join(', ')}`);
    } else if (job.focusTarget && job.focusTarget.trim()) {
      notesList.push(`Fokus target: ${job.focusTarget.trim()}`);
    }
    if (job.projectAddress) {
      notesList.push(`Lokasi: ${job.projectAddress} (Radius GPS ${job.projectRadius || 100}m)`);
    }
    if (notesList.length === 0) {
      notesList.push('Pastikan area layanan diperiksa menyeluruh sesuai SOP dan dokumentasikan bukti foto.');
    }
    return notesList;
  };

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Header
        currentUser={user}
        onLogout={logout}
        pendingCount={pendingCount}
        onSync={attemptSync}
        isSyncing={isSyncing}
        hideMobileMenu={true}
        pageTitle={`Fieldwork Teknisi — ${activeExecTabMeta.label}`}
        onRefresh={loadData}
      />

      {/* Toast Mengambang Konfirmasi Foto / Clock-In agar langsung terlihat jelas setelah kamera tertutup */}
      <AnimatePresence>
        {successFeedback && !isAnyModalOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[90] w-[calc(100%-2rem)] max-w-md pointer-events-auto"
          >
            <div className="p-3.5 bg-emerald-950/95 text-white border border-emerald-500/60 rounded-2xl shadow-2xl flex items-start justify-between gap-3 backdrop-blur-md">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  <Check size={18} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs sm:text-sm text-emerald-300 tracking-wide">{successFeedback.title}</h4>
                  <p className="text-xs text-slate-100 mt-0.5">{successFeedback.subtitle}</p>
                  {successFeedback.stats && <p className="text-[11px] text-emerald-400/90 mt-1 font-mono">{successFeedback.stats}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSuccessFeedback(null)}
                className="text-slate-300 hover:text-white p-1 text-xs font-bold shrink-0"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="flex flex-1 overflow-hidden relative">
        <main className="flex-1 overflow-y-auto flex flex-col w-full relative pb-32">
          {/* Desktop / Tablet Top Sub-Menu + Mobile Floating Bottom Pill (TabContainer) */}
          <div className="hidden lg:block max-w-xl w-full mx-auto px-4 pt-4">
            <TabContainer
              tabs={executorTabs}
              activeTab={activeTab}
              onChange={(id) => setActiveTab(id as any)}
              showFloatingBottom={!isAnyModalOpen}
            />
          </div>
          <div className="lg:hidden">
            <TabContainer
              tabs={executorTabs}
              activeTab={activeTab}
              onChange={(id) => setActiveTab(id as any)}
              className="hidden"
              showFloatingBottom={!isAnyModalOpen}
            />
          </div>

          {actionError && (
            <div className="max-w-xl w-full mx-auto px-4 mt-3">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
                <button onClick={() => setActionError(null)} className="text-rose-700 hover:text-rose-900 font-bold">✕</button>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 1: HOME (DESAIN MINIMALIS FIGMA: SAPAAN + JADWAL + DETAIL)    */}
          {/* ================================================================= */}
          {activeTab === 'home' && (
            <div className="max-w-xl w-full mx-auto flex-1 flex flex-col">
              {/* Hero Header Warna Identitas (Selamat Pagi, User + Jadwal 2 Kartu) */}
              <div className="bg-[var(--accent)] text-white px-5 pt-5 pb-10 sm:rounded-b-3xl shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateProject(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Plus size={14} /> Tugas Baru
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className="relative w-10 h-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white font-bold text-xs cursor-pointer"
                    title="Profil Teknisi"
                  >
                    <span>{initials}</span>
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-500 border-2 border-[var(--accent)]" />
                  </button>
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  {greetingText}, {user.name.split(' ')[0] || 'User'}
                </h1>

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <h2 className="text-base sm:text-lg font-medium text-white/95">Jadwal</h2>
                    {scheduleCardsList.length > 2 && (
                      <span className="text-[11px] text-white/80">{scheduleCardsList.length} jadwal tersedia</span>
                    )}
                  </div>

                  {scheduleCardsList.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {scheduleCardsList.slice(0, 2).map((item, idx) => {
                        const isSelected = selectedScheduleIdx === idx;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedScheduleIdx(idx)}
                            className={`bg-white text-slate-900 rounded-2xl p-3.5 text-left shadow-md transition-all cursor-pointer border-2 ${
                              isSelected ? 'border-emerald-300 ring-2 ring-white/40' : 'border-transparent opacity-95 hover:opacity-100'
                            }`}
                          >
                            <p className="text-sm sm:text-base font-bold text-slate-900 leading-snug line-clamp-2">
                              {formatScheduleDateId(item.createdAt)}
                            </p>
                            <div className="flex items-center justify-between mt-3 pt-1">
                              <span className="text-xs sm:text-sm font-medium text-slate-700">
                                {formatScheduleWindow(item.scheduledStartTime)}
                              </span>
                              <MoreVertical size={16} className="text-slate-700 shrink-0" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/95 text-slate-900 rounded-2xl p-3.5 shadow-md">
                        <p className="text-sm font-bold text-slate-900 leading-snug">
                          {formatScheduleDateId(new Date().toISOString())}
                        </p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs font-medium text-slate-700">08.00 - 14.00</span>
                          <MoreVertical size={16} className="text-slate-700" />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCreateProject(true)}
                        className="bg-white/15 hover:bg-white/25 border border-dashed border-white/40 text-white rounded-2xl p-3.5 flex flex-col justify-between text-left cursor-pointer transition-colors"
                      >
                        <span className="text-xs font-bold">+ Buat Jadwal Baru</span>
                        <span className="text-[11px] text-white/80">Pest Control / Anti Rayap</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Lembar Bawah Melengkung (Rounded Bottom Sheet) */}
              <div className="bg-[var(--bg-primary)] rounded-t-[32px] -mt-5 pt-4 px-4 pb-6 flex-1 space-y-4">
                {/* Indikator Titik Carousel (• • • • •) */}
                <div className="flex items-center justify-center gap-2 py-1">
                  {[0, 1, 2, 3, 4].map(dotIdx => {
                    const isActiveDot = dotIdx === (selectedScheduleIdx % 5);
                    return (
                      <button
                        key={dotIdx}
                        type="button"
                        onClick={() => {
                          if (dotIdx < scheduleCardsList.length) setSelectedScheduleIdx(dotIdx);
                        }}
                        aria-label={`Slide jadwal ${dotIdx + 1}`}
                        className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                          isActiveDot ? 'bg-[var(--accent)] scale-110' : 'bg-slate-300 hover:bg-slate-400'
                        }`}
                      />
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-medium text-slate-800">Detail Hari ini</h2>
                  {featuredJob && (
                    <button
                      type="button"
                      onClick={() => setShowTeamPicker(prev => !prev)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                    >
                      <Users size={13} />
                      Tim ({(featuredJob.teamMembers?.length ? featuredJob.teamMembers : [{ name: user.name }]).length} Orang)
                    </button>
                  )}
                </div>

                {isLoading && (
                  <div className="py-12 text-center text-sm text-[var(--text-muted)]">Memuat jadwal hari ini...</div>
                )}

                {!isLoading && loadError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center">
                    <p className="text-sm text-rose-800 font-medium mb-2">{loadError}</p>
                    <button onClick={loadData} className="text-xs font-semibold bg-rose-600 text-white px-3 py-1.5 rounded-lg">Coba Lagi</button>
                  </div>
                )}

                {!isLoading && !loadError && featuredJob && (
                  <>
                    {/* Panel Pilih Tim Teknisi Ringkas (Hanya muncul saat diklik) */}
                    {showTeamPicker && (
                      <div className="p-3.5 rounded-2xl border border-emerald-200 bg-white shadow-xs space-y-2 text-xs">
                        <div className="font-bold text-slate-800 flex items-center justify-between">
                          <span>Pilih Rekan 1 Tim Lapangan:</span>
                          <button type="button" onClick={() => setShowTeamPicker(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {companyTechs.map(t => {
                            const activeList = featuredJob.teamMembers?.length ? featuredJob.teamMembers : [{ id: user.uid, name: user.name }];
                            const isSel = activeList.some(m => m.id === t.id || m.name.toLowerCase() === t.name.toLowerCase());
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => handleToggleQuickTeamMember(featuredJob, { id: t.id, name: t.name, isManual: false })}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                  isSel ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-slate-50 text-slate-700 border-slate-200'
                                }`}
                              >
                                {isSel ? '✓ ' : '+ '}{t.name}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={quickManualName}
                            onChange={e => setQuickManualName(e.target.value)}
                            placeholder="Ketik nama helper manual..."
                            className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!quickManualName.trim()) return;
                              handleToggleQuickTeamMember(featuredJob, { name: quickManualName.trim(), isManual: true });
                              setQuickManualName('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[var(--accent)] text-white text-[11px] font-bold shrink-0"
                          >
                            + Tambah
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Kartu Tugas Minimalis Terpisah (Atas: Tanggal + Lokasi/Layanan + Jam; Bawah: Notes :) */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-md overflow-hidden">
                      <div className="p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-2">
                          {(() => {
                            const meta = getServiceTypeMeta(featuredJob.serviceType);
                            return (
                              <span className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md border ${meta.badgeClass}`}>
                                {meta.shortLabel}
                              </span>
                            );
                          })()}
                          <p className="text-base sm:text-lg font-bold text-slate-900 text-right">
                            {formatScheduleDateId(featuredJob.createdAt)}
                          </p>
                        </div>

                        <div className="flex items-start justify-between gap-4 mt-3.5">
                          <div className="space-y-0.5 min-w-0">
                            <h3 className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                              {featuredJob.clientName || featuredJob.projectName}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-snug">
                              {featuredJob.projectName}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            {featuredJob.status === 'WORKING' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-xs font-bold">
                                <Clock size={12} /> {elapsedTime}
                              </span>
                            ) : (
                              <span className="text-xs sm:text-sm font-medium text-slate-800">
                                {formatScheduleWindow(featuredJob.scheduledStartTime)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Garis Pemisah Horizontal + Daftar Poin Notes : */}
                      <div className="border-t border-slate-300 px-4 sm:px-5 py-3.5 bg-white">
                        <p className="text-xs sm:text-sm font-medium text-slate-800 mb-1.5">Notes :</p>
                        <ul className="list-disc pl-5 text-xs sm:text-sm text-slate-700 space-y-1 leading-relaxed">
                          {buildFeaturedNotes(featuredJob).map((line, idx) => (
                            <li key={idx}>{line}</li>
                          ))}
                        </ul>

                        {featuredJob.photos.length > 0 && (
                          <div className="flex items-center gap-2 overflow-x-auto pt-3 mt-2.5 border-t border-slate-100">
                            {featuredJob.photos.map(photo => (
                              <button
                                key={photo.id}
                                type="button"
                                onClick={() => setViewingPhoto(photo)}
                                className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shrink-0"
                              >
                                <AuthedImage path={photo.url} alt="evidence" purged={!!photo.purgedAt} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tombol Aksi Utama Lebar Penuh (Clock In / Isi Laporan & Clock Out) */}
                    {featuredJob.status === 'WORKING' ? (
                      <div className="pt-2 space-y-2.5">
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setActiveCameraAction({ type: 'PROGRESS', report: featuredJob, photoTag: 'BEFORE' })}
                            className="py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-300 shadow-2xs transition-colors cursor-pointer"
                          >
                            <ImagePlus size={15} /> + Foto Awal
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveCameraAction({ type: 'PROGRESS', report: featuredJob, photoTag: 'AFTER' })}
                            className="py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-300 shadow-2xs transition-colors cursor-pointer"
                          >
                            <ImagePlus size={15} /> + Foto Hasil
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTreatmentFormReport(featuredJob)}
                          className="w-full py-3.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <LogOut size={16} /> Isi Laporan &amp; Clock Out
                        </button>
                      </div>
                    ) : (
                      <div className="pt-3">
                        <button
                          type="button"
                          onClick={() => setActiveCameraAction({ type: 'CHECK_IN', report: featuredJob })}
                          className="w-full py-3.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          Clock In
                        </button>
                      </div>
                    )}
                  </>
                )}

                {!isLoading && !loadError && !featuredJob && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-xs space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">Belum ada jadwal aktif hari ini</h3>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Tambahkan penugasan Pest Control atau Anti Rayap baru untuk memulai Clock In.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCreateProject(true)}
                      className="w-full py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold shadow-sm cursor-pointer"
                    >
                      + Buat Tugas Baru
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2, 3, 4: PROYEK, RIWAYAT, PROFIL (MINIMALIS & BERSIH)         */}
          {/* ================================================================= */}
          {activeTab !== 'home' && (
            <div className="flex-1 max-w-xl w-full mx-auto p-4 space-y-4">
              {activeTab !== 'profile' && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cari nama proyek, klien, atau lokasi..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-xs bg-white text-[var(--text-primary)] placeholder-[var(--text-muted)] shadow-2xs"
                  />
                </div>
              )}

              {!isLoading && !loadError && activeTab === 'jobs' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-[var(--text-primary)]">Daftar Proyek Lapangan</h2>
                    <button onClick={() => setShowCreateProject(true)} className="bg-[var(--accent)] text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer">
                      <Plus size={14} /> Tugas Baru
                    </button>
                  </div>

                  {filteredProjects.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)] text-center py-8">Belum ada proyek. Buat proyek pertama Anda.</p>
                  )}

                  {filteredProjects.map(proj => {
                    const report = reports.find(r => r.projectId === proj.id);
                    const meta = getServiceTypeMeta(proj.serviceType);
                    return (
                      <div key={proj.id} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border mb-1 ${meta.badgeClass}`}>
                                {meta.shortLabel}
                              </span>
                              <h3 className="font-bold text-sm text-slate-900">{proj.projectName}</h3>
                              {proj.clientName && <p className="text-xs text-slate-600">{proj.clientName}</p>}
                            </div>
                            <span className="text-xs font-medium text-slate-700 shrink-0">08.00 - 14.00</span>
                          </div>
                        </div>
                        <div className="border-t border-slate-200 px-4 py-3 bg-white space-y-2">
                          <p className="text-xs font-medium text-slate-800">Notes :</p>
                          <ul className="list-disc pl-4 text-xs text-slate-600 space-y-0.5">
                            <li>{proj.address} (Radius {proj.radius}m)</li>
                            {proj.warrantyMonths > 0 && (
                              <li>
                                <span className="text-emerald-700 font-semibold">Garansi aktif {proj.warrantyMonths} bulan</span>
                              </li>
                            )}
                          </ul>
                          {report && report.status === 'READY' && (
                            <button
                              onClick={() => { setActiveTab('home'); setActiveCameraAction({ type: 'CHECK_IN', report }); }}
                              className="w-full mt-2 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Camera size={14} /> Clock In
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!isLoading && !loadError && activeTab === 'history' && (
                <div className="space-y-3">
                  <h2 className="text-base font-bold text-[var(--text-primary)]">Riwayat Pekerjaan Selesai</h2>
                  {completedJobs.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">Belum ada riwayat pekerjaan selesai.</p>
                  ) : (
                    completedJobs.map(rep => {
                      const durationMin = rep.durationSeconds ? Math.round(rep.durationSeconds / 60) : 0;
                      return (
                        <div key={rep.id} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                          <div className="p-4">
                            <div className="flex items-center justify-between mb-1">
                              <RiskBadge level={rep.riskLevel} score={rep.riskScore} size="sm" />
                              <span className="text-xs font-bold text-slate-900">{formatScheduleDateId(rep.createdAt)}</span>
                            </div>
                            <div className="flex items-start justify-between gap-2 mt-2">
                              <div>
                                <h3 className="font-bold text-sm text-slate-900">{rep.projectName}</h3>
                                <p className="text-xs text-slate-500">{rep.projectAddress}</p>
                              </div>
                              <span className="text-xs font-mono text-slate-700 shrink-0">
                                {rep.checkInAt ? new Date(rep.checkInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'} -{' '}
                                {rep.checkOutAt ? new Date(rep.checkOutAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                              </span>
                            </div>
                          </div>
                          <div className="border-t border-slate-200 px-4 py-3 bg-white space-y-2">
                            <p className="text-xs font-medium text-slate-800">Notes :</p>
                            <ul className="list-disc pl-4 text-xs text-slate-600 space-y-0.5">
                              <li>Durasi kerja: {durationMin} menit • {rep.photos.length} foto bukti</li>
                              <li>Status GPS: {rep.checkInValid ? 'Sesuai radius' : 'Di luar radius'} ({rep.checkInDistance ?? 0}m)</li>
                            </ul>
                            {rep.photos.length > 0 && (
                              <div className="flex gap-2 overflow-x-auto pt-1">
                                {rep.photos.map(p => (
                                  <button key={p.id} type="button" onClick={() => setViewingPhoto(p)} className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shrink-0 relative group">
                                    <AuthedImage path={p.url} alt="evidence" purged={!!p.purgedAt} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                      <Eye size={13} className="text-white" />
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {!isLoading && !loadError && activeTab === 'profile' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xl">
                      {initials}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-[var(--text-primary)]">{user.name}</h3>
                      <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
                      <span className="inline-block mt-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Teknisi Lapangan
                      </span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-[var(--border-subtle)] text-xs space-y-2">
                    <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                      <span className="text-[var(--text-muted)]">NIP:</span>
                      <span className="font-semibold text-[var(--text-primary)]">{user.nip || '-'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                      <span className="text-[var(--text-muted)]">Total Pekerjaan:</span>
                      <span className="font-bold text-[var(--text-primary)]">{reports.length} Penugasan</span>
                    </div>
                  </div>
                  
                  <div className="pt-2 space-y-2.5">
                    <button onClick={() => setShowChangePassword(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors">
                      <Lock size={15} /> Ubah Kata Sandi
                    </button>
                    <button onClick={logout} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--bg-tertiary)] hover:bg-rose-50 hover:text-rose-700 text-[var(--text-secondary)] text-xs sm:text-sm font-semibold transition-colors">
                      <LogOut size={15} /> Keluar dari Akun
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

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

        {treatmentFormReport && (
          <TreatmentFormModal
            serviceType={treatmentFormReport.serviceType}
            existing={treatmentFormReport.treatmentRecord}
            initialTeamMembers={treatmentFormReport.teamMembers}
            onSubmit={handleTreatmentSubmit}
            onSkip={() => { setActiveCameraAction({ type: 'CHECK_OUT', report: treatmentFormReport }); setTreatmentFormReport(null); }}
            onClose={() => setTreatmentFormReport(null)}
          />
        )}

        {checkoutEvidence && (
          <CustomerReviewFormModal
            onClose={() => setCheckoutEvidence(null)}
            onSubmit={handleCustomerReviewSubmit}
          />
        )}

        {showCreateProject && <CreateProjectModal onClose={() => setShowCreateProject(false)} onSubmit={handleCreateProjectSubmit} />}
        {viewingPhoto && <PhotoViewerModal photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />}
        {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
        
        {showGpsPrompt && gpsPermissionStatus !== 'granted' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mb-4 mx-auto">
                <MapPin size={24} />
              </div>
              <h3 className="text-lg font-bold text-center mb-2">Izinkan Akses GPS</h3>
              <p className="text-sm text-[var(--text-secondary)] text-center mb-6 leading-relaxed">
                Fieldwork membutuhkan akses lokasi Anda untuk validasi kehadiran di area proyek (Clock-In).
              </p>

              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-6">
                <h4 className="text-xs font-bold text-rose-800 flex items-center gap-1 mb-1">
                   Tips Error Overlay
                </h4>
                <p className="text-[10px] text-rose-700 leading-relaxed">
                  Jika Anda melihat error <strong>"This site can't ask for your permission"</strong> di browser Anda, itu adalah fitur keamanan Android untuk mencegah penipuan klik. <br/><br/>
                  Silakan <strong>tutup terlebih dahulu semua gelembung melayang (seperti Chat Bubbles)</strong> atau aplikasi overlay layar lainnya, lalu tekan tombol izinkan di bawah.
                </p>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => {
                    navigator.geolocation.getCurrentPosition(
                      () => { setShowGpsPrompt(false); trackLocation(); },
                      (err) => { 
                        console.error("GPS Request Denied", err); 
                        if(err.code === err.PERMISSION_DENIED) {
                          alert("Izin GPS ditolak secara permanen. Mohon buka Setelan > Situs > Lokasi pada browser Anda, lalu izinkan aplikasi ini.");
                        }
                      },
                      { enableHighAccuracy: true, timeout: 10000 }
                    );
                  }}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                >
                  Izinkan Akses GPS
                </button>
                <button 
                  onClick={() => setShowGpsPrompt(false)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors text-sm"
                >
                  Nanti Saja
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
