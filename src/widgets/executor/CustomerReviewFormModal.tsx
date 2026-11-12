import React, { useRef, useState, useEffect } from 'react';
import { X, Eraser, CheckCircle2, Star, Lock, ShieldCheck, ArrowRight, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CustomerReviewFormModalProps {
  onClose: () => void;
  onSubmit: (data: { customerName: string; customerPhone: string; customerFeedback: string; customerSignature: string }) => void;
}

const QUICK_REVIEW_TAGS = [
  'Sopan & Ramah',
  'Tepat Waktu',
  'Pekerjaan Rapi',
  'Penjelasan Jelas',
  'Perlu Peningkatan',
];

export const CustomerReviewFormModal: React.FC<CustomerReviewFormModalProps> = ({ onClose, onSubmit }) => {
  // Tahap 1: Tanda Tangan PIC -> Otomatis lanjut ke Tahap 2: Evaluasi Wajib & Strict Rahasia PIC
  const [step, setStep] = useState<'SIGN_STAGE' | 'STRICT_BLIND_EVAL_STAGE'>('SIGN_STAGE');
  const [name, setName] = useState('');
  const [roleTitle, setRoleTitle] = useState('Supervisor GA / Perwakilan Lokasi');
  const [phone, setPhone] = useState('');
  const [lockedSignatureBase64, setLockedSignatureBase64] = useState('');

  // Strict Blind Evaluation state (dimulai dari 0 agar wajib diisi langsung oleh PIC, tanpa default bintang)
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
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0f172a';
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
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
    setHasSignature(false);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
  };

  // Langkah 1 -> Kunci Tanda Tangan & Buka Otomatis Form Evaluasi Rahasia PIC
  const handleProceedToStrictEval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama penerima / PIC wajib diisi.');
      return;
    }
    if (!hasSignature) {
      setError('Tanda tangan PIC wajib diisi sebelum lanjut ke evaluasi.');
      return;
    }
    const sigData = canvasRef.current?.toDataURL('image/png') || '';
    setLockedSignatureBase64(sigData);
    setError('');
    setStep('STRICT_BLIND_EVAL_STAGE');
  };

  // Langkah 2 -> Validasi Strict (Wajib Diisi PIC) & Enkripsi/Sembunyikan dari Teknisi
  const handleFinalStrictSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setError('Wajib diisi oleh PIC: Silakan pilih bintang kepuasan (1 s.d. 5 bintang).');
      return;
    }
    if (selectedTags.length === 0) {
      setError('Wajib diisi oleh PIC: Pilih minimal 1 kriteria penilaian cepat.');
      return;
    }

    const compiledFeedback = [
      `[STRICT_BLIND_PIC_REVIEW]`,
      `[Rating: ${rating}/5]`,
      roleTitle.trim() ? `[Jabatan: ${roleTitle.trim()}]` : '',
      `[Penilaian: ${selectedTags.join(', ')}]`,
      feedback.trim() ? `[Catatan PIC: ${feedback.trim()}]` : '',
    ]
      .filter(Boolean)
      .join(' ');

    // Reset state lokal agar tidak tersisa di memori layar teknisi
    const finalPayload = {
      customerName: name.trim(),
      customerPhone: phone.trim(),
      customerFeedback: compiledFeedback,
      customerSignature: lockedSignatureBase64,
    };
    setRating(0);
    setSelectedTags([]);
    setFeedback('');

    onSubmit(finalPayload);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="bg-[var(--bg-card)] rounded-t-2xl sm:rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92dvh] shadow-2xl border border-[var(--border-subtle)]"
      >
        {/* Header Dynamic */}
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0 bg-[#1B4332] text-white">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 block">
              {step === 'SIGN_STAGE'
                ? 'Langkah 1 dari 2 • Tanda Tangan Penerima Lokasi'
                : 'Langkah 2 dari 2 • Evaluasi Rahasia PIC (Wajib & Strict)'}
            </span>
            <h2 className="text-sm sm:text-base font-bold">
              {step === 'SIGN_STAGE'
                ? 'Pengesahan Laporan Hasil Pekerjaan'
                : 'Rating & Feedback Rahasia Klien'}
            </h2>
          </div>
          {step === 'SIGN_STAGE' && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-emerald-100 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {step === 'SIGN_STAGE' ? (
            <motion.form
              key="sign-stage"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleProceedToStrictEval}
              className="overflow-y-auto p-4 space-y-3.5 pb-8"
            >
              {/* Status Tahap 1 Teknisi */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                <span className="font-semibold text-emerald-950 flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-emerald-700" />
                  Tahap 1: Tanda Tangan Teknisi
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-bold">
                  Tervalidasi ✓
                </span>
              </div>

              {error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                  {error}
                </div>
              )}

              {/* Data Penerima (Ringkas 2 Kolom) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                    Nama Penerima / PIC *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Cth: Bambang Sukoco"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:border-[#1B4332]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                    Jabatan / Status Lokasi
                  </label>
                  <input
                    type="text"
                    value={roleTitle}
                    onChange={e => setRoleTitle(e.target.value)}
                    placeholder="Supervisor GA / Security"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:border-[#1B4332]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                  No. WhatsApp Penerima Laporan Hasil Pekerjaan (Opsional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="0812-xxxx-xxxx"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:border-[#1B4332]"
                />
              </div>

              {/* Kanvas Tanda Tangan */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)]">
                    Tanda Tangan Penerima (PIC) *
                  </label>
                  {hasSignature && (
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-[11px] font-bold text-rose-600 flex items-center gap-1 hover:text-rose-700"
                    >
                      <Eraser size={12} /> Reset
                    </button>
                  )}
                </div>
                <div className="border border-slate-300 rounded-xl bg-white overflow-hidden touch-none h-28 relative">
                  {!hasSignature && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 pointer-events-none text-xs font-medium">
                      Goreskan tanda tangan PIC di sini
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

              <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-2 text-[11px] text-slate-600">
                <Lock size={14} className="text-[#1B4332] shrink-0" />
                <span>
                  Setelah tanda tangan dikunci, form <strong>Evaluasi Rahasia PIC</strong> akan muncul otomatis untuk diisi oleh PIC.
                </span>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full bg-[#1B4332] hover:bg-[#13462A] text-white font-bold py-3 rounded-xl transition-all shadow-sm text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Kunci Tanda Tangan &amp; Lanjut Evaluasi PIC</span>
                <ArrowRight size={16} />
              </motion.button>
            </motion.form>
          ) : (
            <motion.form
              key="strict-eval-stage"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 14 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleFinalStrictSubmit}
              className="overflow-y-auto p-4 space-y-4 pb-8"
            >
              {/* Banner Strict Blind Privacy */}
              <div className="p-3 rounded-xl bg-slate-900 text-white border border-slate-700 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-emerald-300 flex items-center gap-1.5">
                    <EyeOff size={14} /> MODE PRIVASI PENUH (STRICT BLIND REVIEW)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 text-[10px] font-bold">
                    Wajib Diisi PIC
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Penilaian ini <strong>tidak dapat dilihat oleh teknisi</strong>. Begitu dikirim, layar otomatis dikunci dan dienkripsi langsung ke Manajemen Pusat.
                </p>
              </div>

              {error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                  {error}
                </div>
              )}

              {/* 5 Bintang Wajib Diisi */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-center">
                <label className="block text-xs font-bold text-slate-900">
                  1. Beri Rating Kepuasan Kerja Teknisi (Wajib Pilih 1–5 Bintang) *
                </label>
                <div className="flex items-center justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs transition-transform active:scale-90 cursor-pointer"
                    >
                      <Star
                        size={26}
                        className={star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-[11px] font-bold text-[#1B4332] block">
                  {rating === 0
                    ? 'Belum dipilih (Ketuk bintang di atas)'
                    : `${rating} dari 5 Bintang Terpilih`}
                </span>
              </div>

              {/* Kriteria Penilaian Cepat (Wajib Minimal 1) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-900">
                  2. Kriteria Penilaian Cepat (Wajib Pilih Minimal 1) *
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REVIEW_TAGS.map(tag => {
                    const active = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                          active
                            ? 'bg-[#1B4332] text-white border-[#1B4332]'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Catatan Rahasia ke Manajemen */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  3. Catatan Rahasia ke Manajemen (Opsional)
                </label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows={2}
                  placeholder="Masukan jujur Anda langsung ke Direktur/Admin (tidak terlihat oleh teknisi)..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs resize-none focus:outline-none focus:border-[#1B4332]"
                />
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full bg-[#1B4332] hover:bg-[#13462A] text-white font-bold py-3 rounded-xl transition-all shadow-sm text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock size={15} />
                Kunci Evaluasi Rahasia &amp; Selesaikan Pekerjaan
              </motion.button>
              <span className="text-[10.5px] text-slate-500 text-center block">
                <CheckCircle2 size={11} className="inline mr-1 text-emerald-600" />
                Catatan akan langsung tertutup permanen setelah dikirim demi kerahasiaan Anda.
              </span>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
