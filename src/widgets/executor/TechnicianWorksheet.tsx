import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eraser,
  Minus,
  PenLine,
  Plus,
  Star,
} from 'lucide-react';
import {
  ApplicationMethod,
  DocumentationPhoto,
  PhotoTag,
  WorkReport,
} from '@/entities/types';
import { TreatmentInput, MAX_PHOTOS_PER_REPORT } from '@/shared/api/workReports';
import { serializePestFindingsToNotes, parsePestFindingsFromNotes } from '@/shared/lib/permenkesRecapEngine';
import { AuthedImage } from '../common/AuthedImage';

export interface WorksheetClientPrefill {
  customerName: string;
  customerRole: string;
  customerPhone: string;
  technicianSignature: string;
}

interface TechnicianWorksheetProps {
  report: WorkReport;
  elapsedTime: string;
  technicianName: string;
  onBack: () => void;
  onCapturePhoto: (tag: PhotoTag) => void;
  onViewPhoto: (photo: DocumentationPhoto) => void;
  onSaveTreatment: (input: TreatmentInput) => Promise<void>;
  onProceedToClientSign: (prefill: WorksheetClientPrefill) => void;
}

interface WorksheetDraft {
  step: 1 | 2 | 3 | 4 | 5;
  serviceMode: 'AR' | 'PCO';
  // Step 1 — Anti Rayap
  termiteSpecies: string[];
  customSpecies: string;
  hasMudTube: boolean;
  severity: 'Ringan' | 'Sedang' | 'Kritis';
  colonyEstimate: '< 500' | '1rb – 3rb' | '> 5.000';
  // Step 1 — Pest Control
  pestCounts: Record<string, number>;
  // Step 2 — Metode
  methods: string[];
  customMethod: string;
  chemicalName: string;
  dosage: string;
  treatmentAreaSqm: string;
  // Step 3 — Area
  selectedAreas: string[];
  priorityAreas: string[];
  customArea: string;
  // Step 4 — Saran
  recommendations: string;
  // Step 5 — Pengesahan
  technicianSignature: string;
  clientName: string;
  clientRole: string;
  clientCustomRole: string;
  clientPhone: string;
}

const TERMITE_SPECIES = ['Rayap Kayu Kering', 'Rayap Tanah', 'Rayap Coptotermes'];
const COMMON_PESTS = ['Kecoa', 'Tikus', 'Nyamuk', 'Semut', 'Lalat'];

const TREATMENT_METHODS: Array<{ label: string; apiMethod: ApplicationMethod; mode: 'AR' | 'PCO' | 'BOTH' }> = [
  { label: 'Injeksi Termitisida Cair', apiMethod: 'DRILLING', mode: 'AR' },
  { label: 'Umpan Rayap (Baiting)', apiMethod: 'BAITING', mode: 'AR' },
  { label: 'Spraying Residual', apiMethod: 'SPRAYING', mode: 'BOTH' },
  { label: 'Pengasapan Fogging', apiMethod: 'FOGGING', mode: 'PCO' },
  { label: 'Mist Blower', apiMethod: 'MISTING', mode: 'PCO' },
  { label: 'Dusting', apiMethod: 'DUSTING', mode: 'BOTH' },
  { label: 'Cold Fogging (ULV)', apiMethod: 'MISTING', mode: 'PCO' },
];

const AREA_OPTIONS = [
  'Basement',
  'Ruang Arsip',
  'Plafon',
  'Pantry / Dapur',
  'Perimeter Luar',
  'Area Lobi & Koridor',
];

const RECOMMENDATION_CHIPS_AR = [
  'Perbaiki Sirkulasi Udara',
  'Jadwal Kontrol 14 Hari',
  'Jauhkan Kardus/Kayu Lembap',
  'Periksa Kebocoran Pipa',
];

const RECOMMENDATION_CHIPS_PCO = [
  'Jaga Sanitasi Area Pangan',
  'Tutup Celah Pipa & Saluran',
  'Jadwal Kontrol 14 Hari',
  'Kelola Tempat Sampah Tertutup',
];

const CLIENT_ROLES = ['PIC Utama', 'Supervisor GA', 'Satpam / Security', 'Pengelola Gedung'];

const STEP_LABELS = ['Temuan', 'Metode', 'Area', 'Saran & Foto', 'Pengesahan'] as const;

function buildDefaultDraft(report: WorkReport): WorksheetDraft {
  const isTermite = report.serviceType === 'TERMITE_CONTROL';
  const parsed = parsePestFindingsFromNotes(report.treatmentRecord?.technicianNotes);

  const defaultCounts: Record<string, number> = {
    Kecoa: 0,
    Tikus: 0,
    Nyamuk: 0,
    Semut: 0,
    Lalat: 0,
  };
  if (!isTermite && parsed.findings.length > 0) {
    parsed.findings.forEach(f => {
      const match = COMMON_PESTS.find(p => f.pestName.toLowerCase().includes(p.toLowerCase()));
      if (match) defaultCounts[match] = (defaultCounts[match] || 0) + (f.quantity || 1);
    });
  }

  return {
    step: 1,
    serviceMode: isTermite ? 'AR' : 'PCO',
    termiteSpecies: isTermite ? ['Rayap Tanah'] : [],
    customSpecies: '',
    hasMudTube: isTermite,
    severity: 'Sedang',
    colonyEstimate: '1rb – 3rb',
    pestCounts: defaultCounts,
    methods: isTermite ? ['Injeksi Termitisida Cair'] : ['Spraying Residual'],
    customMethod: '',
    chemicalName: report.treatmentRecord?.chemicalName || (isTermite ? 'Premise 200 SL' : 'Cypergard 100 EC'),
    dosage: report.treatmentRecord?.dosage || (isTermite ? '2.5 ml / L Air' : '10 ml / L Air'),
    treatmentAreaSqm: report.treatmentRecord?.treatmentAreaSqm ? String(report.treatmentRecord.treatmentAreaSqm) : '120',
    selectedAreas: isTermite ? ['Basement', 'Ruang Arsip'] : ['Pantry / Dapur', 'Perimeter Luar'],
    priorityAreas: [],
    customArea: '',
    recommendations: parsed.cleanNotes || '',
    technicianSignature: '',
    clientName: report.customerName || '',
    clientRole: 'PIC Utama',
    clientCustomRole: '',
    clientPhone: report.customerPhone || '',
  };
}

export const TechnicianWorksheet: React.FC<TechnicianWorksheetProps> = ({
  report,
  elapsedTime,
  technicianName,
  onBack,
  onCapturePhoto,
  onViewPhoto,
  onSaveTreatment,
  onProceedToClientSign,
}) => {
  const draftKey = `fw_tech_draft_${report.id}`;

  const [draft, setDraft] = useState<WorksheetDraft>(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        return { ...buildDefaultDraft(report), ...JSON.parse(saved) };
      }
    } catch {
      // ignore storage errors
    }
    return buildDefaultDraft(report);
  });

  const [showTechDetails, setShowTechDetails] = useState(false);
  const [newAreaInput, setNewAreaInput] = useState('');
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  // Technician Signature Canvas (Step 5A)
  const techCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingTech, setIsDrawingTech] = useState(false);

  // Auto-save draft locally for offline resilience
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // ignore quota errors
    }
  }, [draft, draftKey]);

  // Setup technician signature canvas when entering step 5
  useEffect(() => {
    if (draft.step !== 5) return;
    const canvas = techCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#16241C';

    if (draft.technicianSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = draft.technicianSignature;
    }
  }, [draft.step]);

  const isTermite = draft.serviceMode === 'AR';
  const progressPhotos = report.photos.filter(p => p.photoType === 'PROGRESS');
  const totalPhotos = report.photos.length;
  const canTakeMoreProgress = totalPhotos < MAX_PHOTOS_PER_REPORT && progressPhotos.length < 4;

  const updateDraft = <K extends keyof WorksheetDraft>(key: K, value: WorksheetDraft[K]) => {
    setValidationMsg(null);
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const toggleItem = (list: string[], item: string): string[] =>
    list.includes(item) ? list.filter(x => x !== item) : [...list, item];

  // Canvas Pointer Handlers for Technician Signature
  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = techCanvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startTechSign = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = techCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    setIsDrawingTech(true);
    const { x, y } = getCanvasPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const drawTechSign = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingTech) return;
    const ctx = techCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endTechSign = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingTech) return;
    setIsDrawingTech(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const sigUrl = techCanvasRef.current?.toDataURL('image/png') || '';
    if (sigUrl) updateDraft('technicianSignature', sigUrl);
  };

  const clearTechSign = () => {
    const canvas = techCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    updateDraft('technicianSignature', '');
  };

  // Compile structured TreatmentInput compatible with Permenkes Recap & PDF Berita Acara
  const buildTreatmentPayload = (): TreatmentInput => {
    const allMethods = [...draft.methods, ...(draft.customMethod.trim() ? [draft.customMethod.trim()] : [])];
    const primaryMethodConfig = TREATMENT_METHODS.find(m => allMethods.includes(m.label));
    const apiMethod: ApplicationMethod = primaryMethodConfig?.apiMethod || (isTermite ? 'DRILLING' : 'SPRAYING');

    const areaList = [
      ...draft.selectedAreas.map(a => (draft.priorityAreas.includes(a) ? `${a} (Prioritas)` : a)),
      ...(draft.customArea.trim() ? [draft.customArea.trim()] : []),
    ];
    const areaSummary = areaList.join(', ') || (isTermite ? 'Area Pondasi & Kusen' : 'Area Operasional');

    const findings = isTermite
      ? [
          ...(draft.termiteSpecies.length > 0 ? draft.termiteSpecies : ['Rayap Tanah']),
          ...(draft.customSpecies.trim() ? [draft.customSpecies.trim()] : []),
        ].map(sp => ({
          pestName: sp,
          quantity: 1,
          treatmentMethod: allMethods.join(', ') || 'Injeksi Termitisida',
          location: areaSummary,
          notes: `[Keparahan: ${draft.severity} | Koloni: ${draft.colonyEstimate}${draft.hasMudTube ? ' | Sarang/Mud Tube' : ''}]`,
        }))
      : Object.entries(draft.pestCounts)
          .filter(([, count]) => count > 0)
          .map(([pest, count]) => ({
            pestName: pest,
            quantity: count,
            treatmentMethod: allMethods.join(', ') || 'Spraying Residual',
            location: areaSummary,
            notes: `Ditemukan ${count} titik/ekor`,
          }));

    const safeFindings =
      findings.length > 0
        ? findings
        : [
            {
              pestName: isTermite ? 'Inspeksi Pencegahan Rayap' : 'Monitoring Hama Umum',
              quantity: 1,
              treatmentMethod: allMethods.join(', ') || 'Preventif',
              location: areaSummary,
              notes: 'Kondisi terkendali / preventif',
            },
          ];

    const compiledNotes = [
      `Area: ${areaSummary}.`,
      allMethods.length > 0 ? `Metode: ${allMethods.join(', ')}.` : '',
      draft.recommendations.trim() ? `Saran: ${draft.recommendations.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    return {
      applicationMethod: apiMethod,
      chemicalName: draft.chemicalName.trim() || (isTermite ? 'Premise 200 SL' : 'Cypergard 100 EC'),
      dosage: draft.dosage.trim() || (isTermite ? '2.5 ml / L Air' : '10 ml / L Air'),
      treatmentAreaSqm: Number(draft.treatmentAreaSqm) || 120,
      technicianNotes: serializePestFindingsToNotes(compiledNotes, safeFindings),
    };
  };

  const handleNextStep = async () => {
    setValidationMsg(null);
    if (draft.step === 1 && isTermite && draft.termiteSpecies.length === 0 && !draft.customSpecies.trim()) {
      setValidationMsg('Pilih minimal 1 spesies rayap atau isi kolom kustom.');
      return;
    }
    if (draft.step === 2 && draft.methods.length === 0 && !draft.customMethod.trim()) {
      setValidationMsg('Pilih minimal 1 tindakan treatment.');
      return;
    }
    if (draft.step === 3 && draft.selectedAreas.length === 0 && !draft.customArea.trim()) {
      setValidationMsg('Pilih minimal 1 area pengerjaan.');
      return;
    }

    if (draft.step === 4) {
      // Save treatment record cleanly before entering final approval stage
      setIsSavingStep(true);
      try {
        await onSaveTreatment(buildTreatmentPayload());
      } catch {
        // Offline queue handled upstream; allow moving smoothly to Step 5
      } finally {
        setIsSavingStep(false);
      }
      updateDraft('step', 5);
      return;
    }

    if (draft.step < 5) {
      updateDraft('step', (draft.step + 1) as WorksheetDraft['step']);
      return;
    }

    // Step 5 -> Validate technician sign & client name, then open fullscreen client signature + confidential feedback
    if (!draft.technicianSignature) {
      setValidationMsg('Bubuhkan tanda tangan teknisi terlebih dahulu pada kotak Tahap 5A.');
      return;
    }
    if (!draft.clientName.trim()) {
      setValidationMsg('Isi nama perwakilan klien / PIC terlebih dahulu.');
      return;
    }

    setIsSavingStep(true);
    try {
      await onSaveTreatment(buildTreatmentPayload());
    } catch {
      // handled upstream
    } finally {
      setIsSavingStep(false);
    }

    const finalRole = draft.clientCustomRole.trim() || draft.clientRole;
    onProceedToClientSign({
      customerName: draft.clientName.trim(),
      customerRole: finalRole,
      customerPhone: draft.clientPhone.trim(),
      technicianSignature: draft.technicianSignature,
    });
  };

  const handlePrevStep = () => {
    setValidationMsg(null);
    if (draft.step > 1) {
      updateDraft('step', (draft.step - 1) as WorksheetDraft['step']);
    } else {
      onBack();
    }
  };

  const photoSlots: Array<{ label: string; tag: PhotoTag; hint: string }> = [
    { label: 'Kondisi Awal', tag: 'BEFORE', hint: 'Sebelum treatment' },
    { label: 'Proses 1', tag: null, hint: 'Saat penanganan' },
    { label: 'Proses 2', tag: null, hint: 'Titik tambahan' },
    { label: 'Hasil Akhir', tag: 'AFTER', hint: 'Setelah selesai' },
  ];

  const availableMethods = TREATMENT_METHODS.filter(m => m.mode === 'BOTH' || m.mode === draft.serviceMode);
  const suggestionChips = isTermite ? RECOMMENDATION_CHIPS_AR : RECOMMENDATION_CHIPS_PCO;

  return (
    <div className="flex flex-col min-h-full">
      {/* Compact Sticky Header */}
      <header className="tech-header">
        <button type="button" onClick={handlePrevStep} aria-label="Kembali">
          <ArrowLeft size={20} />
        </button>
        <div className="text-center min-w-0">
          <strong className="block text-[14px] font-bold text-[var(--text-primary)] truncate">
            {report.projectName}
          </strong>
          <span className="block text-[10.5px] font-mono tabular-nums text-[var(--text-secondary)]">
            Tahap {draft.step}/5 · {STEP_LABELS[draft.step - 1]} · {elapsedTime}
          </span>
        </div>
        <span className="justify-end">
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap ${
              isTermite
                ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
                : 'bg-sky-50 text-sky-800 border border-sky-200/80'
            }`}
          >
            {isTermite ? 'Rayap' : 'Pest'}
          </span>
        </span>
      </header>

      {/* Calm 5-Step Progress Bar */}
      <div className="px-4 pt-3 pb-2 bg-[var(--bg-card)] border-b border-[var(--border)]">
        <div className="grid grid-cols-5 gap-1.5">
          {STEP_LABELS.map((lbl, idx) => {
            const num = (idx + 1) as WorksheetDraft['step'];
            const active = draft.step === num;
            const completed = draft.step > num;
            return (
              <button
                key={lbl}
                type="button"
                onClick={() => updateDraft('step', num)}
                className="text-left group cursor-pointer focus:outline-none"
              >
                <div
                  className={`h-1.5 rounded-full transition-colors duration-200 ${
                    completed
                      ? 'bg-[var(--accent)]'
                      : active
                      ? isTermite
                        ? 'bg-amber-500'
                        : 'bg-sky-600'
                      : 'bg-[var(--border)]'
                  }`}
                />
                <span
                  className={`block mt-1 text-[10px] truncate transition-colors ${
                    active
                      ? 'font-bold text-[var(--text-primary)]'
                      : completed
                      ? 'font-semibold text-[var(--accent-text)]'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  {num}. {lbl}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Step Viewport — One Calm Focus Per Screen */}
      <main className="tech-content with-action flex-1">
        {validationMsg && (
          <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {validationMsg}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ============================================================== */}
          {/* TAHAP 1: DETAIL TEMUAN PER HAMA                                */}
          {/* ============================================================== */}
          {draft.step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.16 }}
              className="space-y-5"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Temuan di Lapangan</h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Ketuk kategori temuan yang terlihat di lokasi.
                  </p>
                </div>
                {/* Segmented Service Mode Switch */}
                <div className="flex items-center p-0.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] shrink-0">
                  <button
                    type="button"
                    onClick={() => updateDraft('serviceMode', 'AR')}
                    className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      isTermite ? 'bg-amber-600 text-white shadow-2xs' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    Anti Rayap
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDraft('serviceMode', 'PCO')}
                    className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      !isTermite ? 'bg-sky-600 text-white shadow-2xs' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    Pest Control
                  </button>
                </div>
              </div>

              {isTermite ? (
                <>
                  {/* Spesies Rayap */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">Spesies Rayap</label>
                    <div className="flex flex-wrap gap-2">
                      {TERMITE_SPECIES.map(sp => {
                        const selected = draft.termiteSpecies.includes(sp);
                        return (
                          <button
                            key={sp}
                            type="button"
                            onClick={() => updateDraft('termiteSpecies', toggleItem(draft.termiteSpecies, sp))}
                            className={`min-h-[44px] px-3.5 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] cursor-pointer ${
                              selected
                                ? 'bg-amber-50 text-amber-900 border-amber-400'
                                : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border)]'
                            }`}
                          >
                            {selected ? '✓ ' : ''}{sp}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="text"
                      value={draft.customSpecies}
                      onChange={e => updateDraft('customSpecies', e.target.value)}
                      placeholder="Spesies lain (opsional)..."
                      className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>

                  {/* Sakelar Sarang / Mud Tube */}
                  <button
                    type="button"
                    onClick={() => updateDraft('hasMudTube', !draft.hasMudTube)}
                    className="w-full min-h-[52px] px-4 py-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <span className="text-left">
                      <strong className="block text-xs font-semibold text-[var(--text-primary)]">
                        Ditemukan Sarang / Jalur Tanah (Mud Tube)
                      </strong>
                      <small className="text-[11px] text-[var(--text-secondary)]">
                        {draft.hasMudTube ? 'Ya, terlihat jalur aktif' : 'Tidak ditemukan jalur tanah'}
                      </small>
                    </span>
                    <span
                      className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center ${
                        draft.hasMudTube ? 'bg-[var(--accent)] justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                    </span>
                  </button>

                  {/* Tingkat Keparahan */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">Tingkat Keparahan</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Ringan', 'Sedang', 'Kritis'] as const).map(level => {
                        const active = draft.severity === level;
                        const activeStyle =
                          level === 'Kritis'
                            ? 'bg-rose-50 text-rose-800 border-rose-400'
                            : level === 'Sedang'
                            ? 'bg-amber-50 text-amber-900 border-amber-400'
                            : 'bg-emerald-50 text-emerald-900 border-emerald-400';
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() => updateDraft('severity', level)}
                            className={`min-h-[44px] rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] cursor-pointer ${
                              active ? activeStyle : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border)]'
                            }`}
                          >
                            {level}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Estimasi Populasi Koloni */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">Estimasi Koloni</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['< 500', '1rb – 3rb', '> 5.000'] as const).map(est => (
                        <button
                          key={est}
                          type="button"
                          onClick={() => updateDraft('colonyEstimate', est)}
                          className={`min-h-[44px] rounded-xl text-xs font-mono font-semibold border transition-all active:scale-[0.98] cursor-pointer ${
                            draft.colonyEstimate === est
                              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                              : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border)]'
                          }`}
                        >
                          {est}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                /* Pest Control Counter Cards */
                <div className="space-y-2.5">
                  {COMMON_PESTS.map(pest => {
                    const count = draft.pestCounts[pest] || 0;
                    return (
                      <div
                        key={pest}
                        className={`px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                          count > 0
                            ? 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-300 dark:border-sky-700'
                            : 'bg-[var(--bg-card)] border-[var(--border)]'
                        }`}
                      >
                        <div>
                          <strong className="block text-sm font-semibold text-[var(--text-primary)]">{pest}</strong>
                          <small className="text-[11px] text-[var(--text-secondary)]">
                            {count > 0 ? `${count} ekor / titik ditemukan` : 'Tidak ada temuan'}
                          </small>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft('pestCounts', { ...draft.pestCounts, [pest]: Math.max(0, count - 1) })
                            }
                            aria-label={`Kurangi ${pest}`}
                            className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)] active:scale-95 cursor-pointer"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="w-8 text-center font-mono font-bold text-sm tabular-nums text-[var(--text-primary)]">
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft('pestCounts', { ...draft.pestCounts, [pest]: count + 1 })
                            }
                            aria-label={`Tambah ${pest}`}
                            className="w-10 h-10 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center active:scale-95 cursor-pointer"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* TAHAP 2: TINDAKAN TREATMENT / METODE                           */}
          {/* ============================================================== */}
          {draft.step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.16 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Tindakan Treatment</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Pilih metode penanganan yang dikerjakan hari ini.
                </p>
              </div>

              <div className="space-y-2">
                {availableMethods.map(m => {
                  const selected = draft.methods.includes(m.label);
                  return (
                    <button
                      key={m.label}
                      type="button"
                      onClick={() => updateDraft('methods', toggleItem(draft.methods, m.label))}
                      className={`w-full min-h-[50px] px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all active:scale-[0.99] cursor-pointer ${
                        selected
                          ? 'bg-[var(--green-soft)] border-[var(--accent)] text-[var(--text-primary)]'
                          : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]'
                      }`}
                    >
                      <span className="text-xs font-semibold">{m.label}</span>
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                          selected
                            ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                            : 'border-[var(--border)] bg-[var(--bg-secondary)]'
                        }`}
                      >
                        {selected && <Check size={13} />}
                      </span>
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={draft.customMethod}
                onChange={e => updateDraft('customMethod', e.target.value)}
                placeholder="Tindakan kustom lainnya (opsional)..."
                className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />

              {/* Progressive Disclosure: Detail Obat & Dosis */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowTechDetails(v => !v)}
                  className="w-full min-h-[48px] px-4 py-3 flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
                >
                  <span>Detail Obat &amp; Dosis (Opsional)</span>
                  {showTechDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {showTechDetails && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-[var(--border)]">
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                        Nama Bahan / Termitisida
                      </label>
                      <input
                        type="text"
                        value={draft.chemicalName}
                        onChange={e => updateDraft('chemicalName', e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                          Dosis Campuran
                        </label>
                        <input
                          type="text"
                          value={draft.dosage}
                          onChange={e => updateDraft('dosage', e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                          Estimasi Luas (m²)
                        </label>
                        <input
                          type="number"
                          value={draft.treatmentAreaSqm}
                          onChange={e => updateDraft('treatmentAreaSqm', e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs font-mono text-[var(--text-primary)]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* TAHAP 3: AREA TINDAKAN & PERLINDUNGAN                          */}
          {/* ============================================================== */}
          {draft.step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.16 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Area Tindakan</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Ketuk area yang ditangani. Ketuk bintang untuk menandai prioritas.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {Array.from(new Set([...AREA_OPTIONS, ...draft.selectedAreas])).map(area => {
                  const selected = draft.selectedAreas.includes(area);
                  const isPriority = draft.priorityAreas.includes(area);
                  return (
                    <div
                      key={area}
                      className={`rounded-2xl border p-3 flex flex-col justify-between min-h-[74px] transition-all ${
                        selected
                          ? 'bg-[var(--green-soft)] border-[var(--accent)]'
                          : 'bg-[var(--bg-card)] border-[var(--border)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const nextAreas = toggleItem(draft.selectedAreas, area);
                          updateDraft('selectedAreas', nextAreas);
                          if (!nextAreas.includes(area) && isPriority) {
                            updateDraft('priorityAreas', draft.priorityAreas.filter(p => p !== area));
                          }
                        }}
                        className="text-left flex-1 cursor-pointer"
                      >
                        <strong className="block text-xs font-semibold text-[var(--text-primary)] leading-snug">
                          {area}
                        </strong>
                      </button>

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10.5px] text-[var(--text-secondary)]">
                          {selected ? (isPriority ? 'Prioritas' : 'Dipilih') : 'Ketuk pilih'}
                        </span>
                        {selected && (
                          <button
                            type="button"
                            onClick={() => updateDraft('priorityAreas', toggleItem(draft.priorityAreas, area))}
                            aria-label={`Tandai prioritas ${area}`}
                            className={`p-1 rounded-lg cursor-pointer ${
                              isPriority ? 'text-amber-500' : 'text-[var(--text-muted)]'
                            }`}
                          >
                            <Star size={15} className={isPriority ? 'fill-amber-400' : ''} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newAreaInput}
                  onChange={e => setNewAreaInput(e.target.value)}
                  placeholder="Tambah area lain (cth: Gudang Lt. 3)..."
                  className="flex-1 h-11 px-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const clean = newAreaInput.trim();
                    if (!clean) return;
                    if (!draft.selectedAreas.includes(clean)) {
                      updateDraft('selectedAreas', [...draft.selectedAreas, clean]);
                    }
                    setNewAreaInput('');
                  }}
                  className="h-11 px-4 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold shrink-0 cursor-pointer"
                >
                  Tambah
                </button>
              </div>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* TAHAP 4: SARAN REKOMENDASI & DOKUMENTASI FOTO (MAKS 6 FOTO)    */}
          {/* ============================================================== */}
          {draft.step === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.16 }}
              className="space-y-5"
            >
              {/* Saran Instan */}
              <div className="space-y-2.5">
                <div>
                  <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Saran &amp; Dokumentasi</h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Tambahkan rekomendasi singkat dan foto bukti lapangan.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {suggestionChips.map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        const cur = draft.recommendations.trim();
                        if (cur.includes(chip)) return;
                        updateDraft('recommendations', cur ? `${cur}. ${chip}` : chip);
                      }}
                      className="min-h-[38px] px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[11.5px] font-medium text-[var(--text-primary)] active:scale-[0.98] cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={draft.recommendations}
                  onChange={e => updateDraft('recommendations', e.target.value)}
                  placeholder="Catatan perbaikan sanitasi / kelembaban untuk klien..."
                  className="w-full p-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              {/* Dokumentasi Foto (Maks 6 Foto Terkompresi 40–60 KB) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    Dokumentasi Foto ({totalPhotos}/{MAX_PHOTOS_PER_REPORT})
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">Kompresi 40–60 KB</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {photoSlots.map((slot, idx) => {
                    const matchedPhoto =
                      slot.tag === 'BEFORE'
                        ? progressPhotos.find(p => p.photoTag === 'BEFORE')
                        : slot.tag === 'AFTER'
                        ? progressPhotos.find(p => p.photoTag === 'AFTER')
                        : progressPhotos.filter(p => !p.photoTag)[idx === 1 ? 0 : 1];

                    return (
                      <div
                        key={slot.label}
                        className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-2.5 flex flex-col gap-2"
                      >
                        {matchedPhoto ? (
                          <button
                            type="button"
                            onClick={() => onViewPhoto(matchedPhoto)}
                            className="relative w-full h-24 rounded-xl overflow-hidden border border-[var(--border)] cursor-pointer"
                          >
                            <AuthedImage
                              path={matchedPhoto.url}
                              alt={slot.label}
                              purged={!!matchedPhoto.purgedAt}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                              <Check size={13} />
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!canTakeMoreProgress}
                            onClick={() => onCapturePhoto(slot.tag)}
                            className="w-full h-24 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col items-center justify-center gap-1.5 text-[var(--text-secondary)] disabled:opacity-45 active:scale-[0.98] cursor-pointer"
                          >
                            <Camera size={20} className="text-[var(--accent)]" />
                            <span className="text-[11px] font-semibold">Ambil Foto</span>
                          </button>
                        )}
                        <div className="px-0.5">
                          <strong className="block text-[11.5px] font-semibold text-[var(--text-primary)]">
                            {slot.label}
                          </strong>
                          <small className="text-[10px] text-[var(--text-muted)]">{slot.hint}</small>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {report.photos.length > 0 && (
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Termasuk foto Check-In otomatis; foto Check-Out diambil pada langkah akhir.
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* TAHAP 5: PENGESAHAN LAPANGAN DUA TAHAP                         */}
          {/* ============================================================== */}
          {draft.step === 5 && (
            <motion.div
              key="step-5"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.16 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Pengesahan Lapangan</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Tanda tangan teknisi dulu, lalu serahkan HP ke perwakilan klien.
                </p>
              </div>

              {/* 5A: Tanda Tangan Teknisi */}
              <div className="p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    {draft.technicianSignature ? (
                      <CheckCircle2 size={15} className="text-emerald-600" />
                    ) : (
                      <PenLine size={15} className="text-[var(--accent)]" />
                    )}
                    1. Tanda Tangan Teknisi ({technicianName.split(' ')[0]})
                  </span>
                  {draft.technicianSignature && (
                    <button
                      type="button"
                      onClick={clearTechSign}
                      className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 cursor-pointer"
                    >
                      <Eraser size={12} /> Ulang
                    </button>
                  )}
                </div>
                <div className="relative h-28 rounded-xl bg-white border border-slate-200 overflow-hidden touch-none">
                  {!draft.technicianSignature && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 pointer-events-none">
                      Goreskan tanda tangan teknisi di sini
                    </span>
                  )}
                  <canvas
                    ref={techCanvasRef}
                    onPointerDown={startTechSign}
                    onPointerMove={drawTechSign}
                    onPointerUp={endTechSign}
                    onPointerOut={endTechSign}
                    className="w-full h-full relative z-10 cursor-crosshair"
                    style={{ touchAction: 'none' }}
                  />
                </div>
              </div>

              {/* 5B: Data Perwakilan Klien */}
              <div className="p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-3">
                <span className="block text-xs font-semibold text-[var(--text-primary)]">
                  2. Penerima / Perwakilan Klien
                </span>

                <input
                  type="text"
                  value={draft.clientName}
                  onChange={e => updateDraft('clientName', e.target.value)}
                  placeholder="Nama penerima (cth: Pak Bambang)"
                  className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />

                <div className="flex flex-wrap gap-1.5">
                  {CLIENT_ROLES.map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => updateDraft('clientRole', role)}
                      className={`min-h-[36px] px-3 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
                        draft.clientRole === role
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)]'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>

                <input
                  type="tel"
                  value={draft.clientPhone}
                  onChange={e => updateDraft('clientPhone', e.target.value)}
                  placeholder="Nomor WhatsApp PIC (untuk kirim Berita Acara)"
                  className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Thumb-Zone Sticky Bottom Action Bar */}
      <div className="sticky-action flex items-center gap-2.5">
        <button
          type="button"
          onClick={handlePrevStep}
          className="min-h-[48px] px-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] shrink-0 cursor-pointer"
        >
          {draft.step === 1 ? 'Tutup' : 'Kembali'}
        </button>
        <button
          type="button"
          disabled={isSavingStep}
          onClick={handleNextStep}
          className="flex-1 min-h-[48px] px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all cursor-pointer"
        >
          <span>
            {isSavingStep
              ? 'Menyimpan...'
              : draft.step < 5
              ? `Lanjut: ${STEP_LABELS[draft.step as 1 | 2 | 3 | 4]}`
              : 'Tanda Tangan Klien (Layar Penuh)'}
          </span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
