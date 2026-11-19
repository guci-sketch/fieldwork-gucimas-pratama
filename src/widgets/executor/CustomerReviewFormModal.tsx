import React, { useRef, useState, useEffect } from 'react';
import { X, Eraser, Star, Lock, ArrowRight, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CustomerReviewFormModalProps {
  initialName?: string;
  initialRole?: string;
  initialPhone?: string;
  onClose: () => void;
  onSubmit: (data: {
    customerName: string;
    customerPhone: string;
    customerFeedback: string;
    customerSignature: string;
  }) => void;
}

const QUICK_REVIEW_TAGS = [
  'Petugas Ramah',
  'Pekerjaan Rapi',
  'Tepat Waktu',
  'Penjelasan Jelas',
];

const RATING_LABELS: Record<number, string> = {
  0: 'Ketuk bintang untuk menilai layanan hari ini',
  1: 'Perlu Banyak Perbaikan',
  2: 'Kurang Memuaskan',
  3: 'Cukup Baik',
  4: 'Puas & Rapi',
  5: 'Sangat Puas, Cepat & Bersih',
};

export const CustomerReviewFormModal: React.FC<CustomerReviewFormModalProps> = ({
  initialName = '',
  initialRole = 'PIC Utama',
  initialPhone = '',
  onClose,
  onSubmit,
}) => {
  const [step, setStep] = useState<'SIGN_STAGE' | 'STRICT_BLIND_EVAL_STAGE'>('SIGN_STAGE');
  const [name, setName] = useState(initialName);
  const [roleTitle, setRoleTitle] = useState(initialRole);
  const [phone, setPhone] = useState(initialPhone);
  const [lockedSignatureBase64, setLockedSignatureBase64] = useState('');

  // Confidential evaluation state (starts at 0 — wiped immediately on submit)
  const [rating, setRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (step !== 'SIGN_STAGE') return;
    const canvas = canvasRef.current;
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
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = '#16241C';
  }, [step]);

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasSignature(true);

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasSignature(false);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
  };

  const handleProceedToStrictEval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama penerima / PIC wajib diisi.');
      return;
    }
    if (!hasSignature) {
      setError('Silakan bubuhkan tanda tangan klien terlebih dahulu.');
      return;
    }
    const sigData = canvasRef.current?.toDataURL('image/png') || '';
    setLockedSignatureBase64(sigData);
    setError('');
    setStep('STRICT_BLIND_EVAL_STAGE');
  };

  const handleFinalStrictSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setError('Silakan pilih 1 hingga 5 bintang kepuasan.');
      return;
    }

    const compiledFeedback = [
      `[STRICT_BLIND_PIC_REVIEW]`,
      `[Rating: ${rating}/5]`,
      roleTitle.trim() ? `[Jabatan: ${roleTitle.trim()}]` : '',
      selectedTags.length > 0 ? `[Penilaian: ${selectedTags.join(', ')}]` : '',
      feedback.trim() ? `[Catatan PIC: ${feedback.trim()}]` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const finalPayload = {
      customerName: name.trim(),
      customerPhone: phone.trim(),
      customerFeedback: compiledFeedback,
      customerSignature: lockedSignatureBase64,
    };

    // Immediately wipe confidential rating state from technician device memory
    setRating(0);
    setSelectedTags([]);
    setFeedback('');

    onSubmit(finalPayload);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="bg-[var(--bg-card)] rounded-t-3xl sm:rounded-3xl w-full max-w-[430px] overflow-hidden flex flex-col max-h-[94dvh] shadow-2xl border border-[var(--border)]"
      >
        {/* Clean Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0 bg-[#1B4332] text-white">
          <div>
            <span className="text-[11px] font-medium text-emerald-200 block">
              {step === 'SIGN_STAGE' ? 'Tanda Tangan Penerima' : 'Penilaian Rahasia Klien'}
            </span>
            <h2 className="text-base font-bold mt-0.5">
              {step === 'SIGN_STAGE' ? 'Pengesahan Berita Acara' : 'Bagaimana layanan hari ini?'}
            </h2>
          </div>
          {step === 'SIGN_STAGE' && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="w-9 h-9 rounded-xl text-emerald-100 hover:text-white hover:bg-white/10 flex items-center justify-center cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {step === 'SIGN_STAGE' ? (
            <motion.form
              key="sign-stage"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.16 }}
              onSubmit={handleProceedToStrictEval}
              className="overflow-y-auto p-5 space-y-4 pb-7"
            >
              {error && (
                <div className="px-3.5 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                  {error}
                </div>
              )}

              {/* Compact Pre-filled Recipient Info */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Nama Penerima
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Nama PIC"
                    className="w-full h-11 px-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Jabatan / Peran
                  </label>
                  <input
                    type="text"
                    value={roleTitle}
                    onChange={e => setRoleTitle(e.target.value)}
                    placeholder="PIC / GA / Satpam"
                    className="w-full h-11 px-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              {/* Spacious Full-Width Client Signature Canvas */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">
                    Tanda Tangan Klien
                  </label>
                  {hasSignature && (
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-xs font-semibold text-rose-600 flex items-center gap-1 cursor-pointer"
                    >
                      <Eraser size={13} /> Ulang
                    </button>
                  )}
                </div>
                <div className="border border-slate-300 rounded-2xl bg-white overflow-hidden touch-none h-52 relative">
                  {!hasSignature && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 pointer-events-none text-xs font-medium">
                      Silakan tanda tangan di area ini
                    </div>
                  )}
                  <canvas
                    ref={canvasRef}
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerOut={stopDrawing}
                    className="w-full h-full cursor-crosshair relative z-10"
                    style={{ touchAction: 'none' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full min-h-[50px] bg-[#1B4332] hover:bg-[#13462A] text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Lanjut ke Penilaian Klien</span>
                <ArrowRight size={16} />
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="strict-eval-stage"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.16 }}
              onSubmit={handleFinalStrictSubmit}
              className="overflow-y-auto p-5 space-y-5 pb-7"
            >
              {/* Calm Privacy Assurance */}
              <div className="px-3.5 py-2.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center gap-2.5 text-xs text-[var(--text-secondary)]">
                <EyeOff size={16} className="text-[var(--accent)] shrink-0" />
                <span>Penilaian bersifat rahasia dan tidak ditampilkan di HP teknisi.</span>
              </div>

              {error && (
                <div className="px-3.5 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                  {error}
                </div>
              )}

              {/* Consumer-Grade Interactive 5 Stars */}
              <div className="py-2 text-center space-y-3">
                <div className="flex items-center justify-center gap-2.5">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => {
                        setError('');
                        setRating(star);
                      }}
                      aria-label={`${star} bintang`}
                      className="w-12 h-12 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
                    >
                      <Star
                        size={28}
                        className={
                          star <= rating
                            ? 'fill-amber-400 text-amber-400 transition-colors'
                            : 'text-slate-300 dark:text-slate-600'
                        }
                      />
                    </button>
                  ))}
                </div>
                <p
                  className={`text-sm font-bold ${
                    rating >= 4
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : rating > 0
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-[var(--text-muted)] font-medium text-xs'
                  }`}
                >
                  {RATING_LABELS[rating]}
                </p>
              </div>

              {/* 4 Quick Positive Tags */}
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_REVIEW_TAGS.map(tag => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] cursor-pointer ${
                        active
                          ? 'bg-[#1B4332] text-white border-[#1B4332]'
                          : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border)]'
                      }`}
                    >
                      {active ? '✓ ' : ''}{tag}
                    </button>
                  );
                })}
              </div>

              {/* Optional Short Note */}
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                rows={2}
                placeholder="Tulis masukan singkat untuk manajemen (opsional)..."
                className="w-full p-3.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl text-xs text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--accent)]"
              />

              <button
                type="submit"
                className="w-full min-h-[50px] bg-[#1B4332] hover:bg-[#13462A] text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Lock size={15} />
                <span>Kirim Penilaian &amp; Selesai</span>
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
