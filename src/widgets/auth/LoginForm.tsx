import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from '@/shared/lib/supabase';
import {
    useAuthStore,
    readRememberMeFlag,
    readRememberedEmail,
} from '@/app/store/authStore';
import {
    Loader2,
    Eye,
    EyeOff,
    KeyRound,
    X,
    CheckCircle2,
} from "lucide-react";
import type { AppUser } from '@/entities/types';
import { fetchAppUser } from '@/shared/api/authProfile';
import { readPendingInvite, repairPendingInviteUser } from '@/shared/api/inviteService';
import {
    DEFAULT_ACCOUNT_PASSWORD,
    getActiveAccountPassword,
    getStoredAccountPassword,
    verifyAccountPasswordLocal,
    resetAccountPasswordToDefault,
} from '@/shared/api/auth';

const QUICK_DEMO_ACCOUNTS = [
    {
        label: "Admin Operasional",
        roleBadge: "ADMIN",
        email: "admin@gucimaspratama.co.id",
    },
    {
        label: "Teknisi Lapangan",
        roleBadge: "TEKNISI",
        email: "teknisi@gucimaspratama.co.id",
    },
];

const DEMO_FALLBACK_USERS: Record<string, AppUser> = {
    "admin@gucimaspratama.co.id": {
        uid: "00000000-0000-4000-a000-000000000012",
        email: "admin@gucimaspratama.co.id",
        name: "Siti Rahmawati",
        role: "ADMIN",
        companyId: "00000000-0000-4000-a000-000000000001",
        isActive: true,
        nip: "GEP-ADM-001",
    },
    "direktur@gucimaspratama.co.id": {
        uid: "00000000-0000-4000-a000-000000000011",
        email: "direktur@gucimaspratama.co.id",
        name: "Budi Santoso",
        role: "ADMIN",
        companyId: "00000000-0000-4000-a000-000000000001",
        isActive: true,
        nip: "GEP-DIR-001",
    },
    "teknisi@gucimaspratama.co.id": {
        uid: "00000000-0000-4000-a000-000000000014",
        email: "teknisi@gucimaspratama.co.id",
        name: "Rizky Pratama",
        role: "TEKNISI_LAPANGAN",
        companyId: "00000000-0000-4000-a000-000000000001",
        isActive: true,
        nip: "GEP-TEK-001",
    },
};

export function LoginPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { setUser } = useAuthStore();
    const initialEmail = readRememberedEmail() || "admin@gucimaspratama.co.id";
    const [email, setEmail] = useState(initialEmail);
    const [password, setPassword] = useState(() => getActiveAccountPassword(initialEmail));
    const [rememberMe, setRememberMe] = useState<boolean>(() => readRememberMeFlag());
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Forgot Password Modal state
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [recoveryEmail, setRecoveryEmail] = useState("");
    const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);
    const [recoveryLoading, setRecoveryLoading] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const hashStr = window.location.hash.startsWith("#") ? window.location.hash.substring(1) : "";
        const hashParams = new URLSearchParams(hashStr);
        const errCode = hashParams.get("error_code") || searchParams.get("error_code");
        const errDesc = hashParams.get("error_description") || searchParams.get("error_description") || searchParams.get("error");
        if (errCode || errDesc) {
            window.history.replaceState(null, "", window.location.pathname);
            if (errCode === "otp_expired" || (errDesc && errDesc.toLowerCase().includes("expired"))) {
                setError("Tautan email telah kedaluwarsa atau sudah pernah diklik. Silakan langsung login dengan email dan password akun Anda di bawah ini.");
            } else {
                setError(decodeURIComponent(errDesc?.replace(/\+/g, " ") || "Terjadi kendala pada tautan verifikasi email."));
            }
        }
    }, [searchParams]);

    useEffect(() => {
        const inv = searchParams.get("invite") || searchParams.get("token");
        if (inv) {
            navigate(`/signup?invite=${encodeURIComponent(inv)}`, { replace: true });
        }
    }, [searchParams, navigate]);

    const performSignIn = async (loginEmail: string, loginPassword: string) => {
        setError("");
        setLoading(true);
        const cleanEmail = loginEmail.trim().toLowerCase();
        const storedCustomPw = getStoredAccountPassword(cleanEmail);
        const isLocalPwMatch = verifyAccountPasswordLocal(cleanEmail, loginPassword);

        try {
            // Jika akun memiliki kata sandi yang sudah diubah/direset secara spesifik dan input tidak cocok, tolak lebih awal
            if (storedCustomPw !== null && !isLocalPwMatch) {
                throw new Error("Email atau kata sandi salah. Pastikan kata sandi sesuai dengan akun Anda.");
            }

            let { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password: loginPassword,
            });

            if (authErr) {
                const pending = readPendingInvite();
                const repairedViaRpc = await repairPendingInviteUser(
                    cleanEmail,
                    pending?.token,
                    pending?.name
                );

                let repairedViaApi = false;
                if (!repairedViaRpc) {
                    try {
                        const confirmRes = await fetch("/api/auth/auto-confirm-email", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                email: cleanEmail,
                                token: pending?.token,
                                name: pending?.name,
                            }),
                        });
                        const rawText = await confirmRes.text();
                        const confirmData = rawText ? JSON.parse(rawText) : null;
                        repairedViaApi = Boolean(confirmData?.success);
                    } catch {
                        /* abaikan jika API backend tidak aktif */
                    }
                }

                if (repairedViaRpc || repairedViaApi) {
                    const retry = await supabase.auth.signInWithPassword({
                        email: cleanEmail,
                        password: loginPassword,
                    });
                    authData = retry.data;
                    authErr = retry.error;
                }
            }

            if (authErr || !authData.user) {
                const fallbackDemo = DEMO_FALLBACK_USERS[cleanEmail];
                if (fallbackDemo && isLocalPwMatch) {
                    setUser(fallbackDemo, rememberMe);
                    navigate("/");
                    return;
                }
                if (authErr) {
                    const errLower = authErr.message.toLowerCase();
                    if (errLower.includes("not confirmed") || errLower.includes("unconfirmed")) {
                        throw new Error(
                            "Email akun Anda belum terkonfirmasi di Supabase. Jalankan file SQL `06_fix_invite_auth_and_autoconfirm.sql` di Supabase SQL Editor untuk mengaktifkan seluruh akun undangan secara otomatis."
                        );
                    }
                    if (errLower.includes("invalid login credentials")) {
                        throw new Error(
                            "Email atau kata sandi salah. Pastikan kredensial sesuai."
                        );
                    }
                    throw authErr;
                }
                throw new Error("Login gagal. Silakan coba lagi.");
            }

            const res = await fetchAppUser(authData.user.id);
            if (!res.user) {
                const fallbackDemo = DEMO_FALLBACK_USERS[cleanEmail];
                if (fallbackDemo && isLocalPwMatch) {
                    setUser(fallbackDemo, rememberMe);
                    navigate("/");
                    return;
                }
                await supabase.auth.signOut();
                setError(res.message ?? "Akun tidak dapat digunakan.");
                return;
            }
            const appUser: AppUser = res.user;
            setUser(appUser, rememberMe);
            navigate("/");
        } catch (err: any) {
            const fallbackDemo = DEMO_FALLBACK_USERS[cleanEmail];
            if (fallbackDemo && isLocalPwMatch) {
                setUser(fallbackDemo, rememberMe);
                navigate("/");
                return;
            }
            setError(err.message || "Email atau kata sandi salah. Silakan periksa kembali.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        await performSignIn(email, password);
    };

    const handleQuickLogin = async (accEmail: string) => {
        const activePw = getActiveAccountPassword(accEmail);
        setEmail(accEmail);
        setPassword(activePw);
        await performSignIn(accEmail, activePw);
    };

    const handleOpenForgotModal = () => {
        setRecoveryEmail(email.trim() || "admin@gucimaspratama.co.id");
        setRecoverySuccess(null);
        setShowForgotModal(true);
    };

    const handleResetToDefaultPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        const target = recoveryEmail.trim().toLowerCase();
        if (!target) return;
        setRecoveryLoading(true);
        try {
            const defaultPw = await resetAccountPasswordToDefault(target);
            setEmail(target);
            setPassword(defaultPw);
            setError("");
            setRecoverySuccess(
                `Kata sandi untuk ${target} telah direset menjadi default: ${defaultPw}. Silakan masuk dan ubah kata sandi Anda melalui menu Profil.`
            );
        } finally {
            setRecoveryLoading(false);
        }
    };

    return (
        <main className="min-h-screen grid grid-cols-1 lg:grid-cols-[minmax(420px,0.95fr)_minmax(480px,1.05fr)] bg-white">
            {/* Left Aside — Minimalist Brand & Concise Statement */}
            <section className="hidden lg:flex flex-col justify-between bg-[#245c45] text-white p-12 xl:p-14 relative overflow-hidden">
                <div className="flex items-center gap-3 relative z-10">
                    <div className="brand-mark">
                        <span />
                        <span />
                        <span />
                    </div>
                    <div>
                        <strong className="block text-base leading-tight font-bold text-white">Fieldwork</strong>
                        <small className="block text-[11px] text-white/75 mt-0.5">PT Guci Emas Pratama</small>
                    </div>
                </div>

                <div className="max-w-md relative z-10 my-auto">
                    <h1 className="text-3xl xl:text-4xl font-bold leading-tight tracking-[-0.03em] text-white mb-3">
                        Laporan Kerja Digital.
                    </h1>
                    <p className="text-sm xl:text-base leading-relaxed text-[#dbe8df]">
                        Kelola penugasan dan dokumentasi pekerjaan lapangan dalam satu tempat.
                    </p>
                </div>

                <div className="text-xs text-white/60 relative z-10">
                    PT Guci Emas Pratama
                </div>

                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute w-[420px] h-[420px] rounded-full border border-white/12 -right-[180px] -bottom-[150px] shadow-[0_0_0_70px_rgba(255,255,255,0.03),0_0_0_140px_rgba(255,255,255,0.025)]"
                />
            </section>

            {/* Right Login Panel — Direct & On-Point */}
            <section className="flex items-center justify-center p-6 sm:p-12 bg-[#fbfcfb]">
                <div className="w-full max-w-[380px]">
                    {/* Mobile Brand Header */}
                    <div className="flex lg:hidden items-center gap-3 mb-8">
                        <div className="brand-mark emerald-bg">
                            <span />
                            <span />
                            <span />
                        </div>
                        <div>
                            <strong className="block text-base leading-tight font-bold text-[#17231c]">Fieldwork</strong>
                            <small className="block text-[11px] text-[#66736b] mt-0.5">PT Guci Emas Pratama</small>
                        </div>
                    </div>

                    <h2 className="text-2xl sm:text-[28px] font-bold tracking-[-0.025em] text-[#17231c] mb-1.5">
                        Masuk
                    </h2>
                    <p className="text-sm text-[#66736b] mb-6">
                        Gunakan akun Anda untuk melanjutkan.
                    </p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#435047]">
                            <span>Email</span>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="nama@gucimaspratama.co.id"
                                required
                                className="w-full min-h-[44px] px-3 py-2.5 rounded-[10px] border border-[#d8e0da] bg-white text-[#17231c] text-sm font-normal focus:border-[#245c45] focus:outline-none focus:ring-3 focus:ring-[#245c45]/10 transition-all"
                            />
                        </label>

                        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#435047]">
                            <span>Kata sandi</span>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Masukkan kata sandi"
                                    required
                                    className="w-full min-h-[44px] pl-3 pr-11 py-2.5 rounded-[10px] border border-[#d8e0da] bg-white text-[#17231c] text-sm font-normal focus:border-[#245c45] focus:outline-none focus:ring-3 focus:ring-[#245c45]/10 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
                                    title={showPassword ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
                                    className="absolute right-1 top-1 w-9 h-9 rounded-lg flex items-center justify-center text-[#66736b] hover:text-[#17231c] cursor-pointer"
                                >
                                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                </button>
                            </div>
                        </label>

                        {/* Remember Me Checkbox & Forgot Password Link */}
                        <div className="flex items-center justify-between pt-0.5">
                            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={e => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded border-[#d8e0da] text-[#245c45] focus:ring-[#245c45]/20 accent-[#245c45] cursor-pointer"
                                />
                                <span className="text-xs font-medium text-[#435047]">
                                    Ingat saya
                                </span>
                            </label>

                            <button
                                type="button"
                                onClick={handleOpenForgotModal}
                                className="text-xs font-semibold text-[#245c45] hover:text-[#1a4533] hover:underline cursor-pointer"
                            >
                                Lupa kata sandi?
                            </button>
                        </div>

                        {error && (
                            <div className="text-[#943838] bg-[#fcecec] border border-[#f5c2c2] rounded-[10px] p-3 text-xs font-medium leading-relaxed">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full min-h-[46px] px-4 rounded-[10px] bg-[#245c45] hover:bg-[#1d4b38] text-white text-[13px] font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-60 mt-1"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" /> Memproses...
                                </>
                            ) : (
                                <span>Masuk</span>
                            )}
                        </button>
                    </form>

                    {/* 1-Click Demo Staff Accounts (2 Peran Utama) */}
                    <div className="mt-5 pt-4 border-t border-[#e1e8e2] space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-[#66736b]">
                                Akses Cepat Akun Demo (1-Klik)
                            </span>
                            <span className="text-[10px] text-[#87928b]">2 Peran Utama</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {QUICK_DEMO_ACCOUNTS.map(acc => (
                                <button
                                    key={acc.email}
                                    type="button"
                                    disabled={loading}
                                    onClick={() => handleQuickLogin(acc.email)}
                                    className={`flex flex-col items-start justify-between p-2.5 rounded-[10px] border text-left transition-all cursor-pointer ${
                                        email === acc.email
                                            ? "border-[#245c45] bg-[#e8f1eb]/60"
                                            : "border-[#e1e8e2] bg-white hover:bg-[#f6f8f6]"
                                    }`}
                                >
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#eff3f0] text-[#245c45] mb-1">
                                        {acc.roleBadge}
                                    </span>
                                    <div className="font-semibold text-xs text-[#17231c] truncate w-full">{acc.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Forgot Password / Account Recovery Modal */}
            {showForgotModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
                    onClick={() => setShowForgotModal(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Lupa Kata Sandi"
                >
                    <div
                        className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#e1e8e2]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-[#e1e8e2] flex items-center justify-between bg-[#f8faf8]">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#e8f1eb] text-[#245c45] flex items-center justify-center">
                                    <KeyRound size={16} />
                                </div>
                                <h3 className="font-bold text-[#17231c] text-sm">
                                    Pemulihan Kata Sandi
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowForgotModal(false)}
                                className="p-1.5 text-[#66736b] hover:text-[#17231c] hover:bg-[#eff3f0] rounded-full transition-colors cursor-pointer"
                            >
                                <X size={17} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <p className="text-xs text-[#435047] leading-relaxed">
                                Silakan hubungi <strong>Admin Operasional</strong> untuk pemulihan akun Anda, atau reset kata sandi akun Anda menjadi default <strong className="font-mono text-[#245c45]">{DEFAULT_ACCOUNT_PASSWORD}</strong> di bawah ini.
                            </p>

                            {recoverySuccess ? (
                                <div className="space-y-4">
                                    <div className="p-3.5 rounded-xl bg-[#e8f1eb] border border-[#c3d9cb] text-[#173f30] text-xs leading-relaxed flex items-start gap-2.5">
                                        <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-[#245c45]" />
                                        <span>{recoverySuccess}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowForgotModal(false)}
                                        className="w-full min-h-[42px] rounded-[10px] bg-[#245c45] hover:bg-[#1d4b38] text-white text-xs font-semibold transition-colors cursor-pointer"
                                    >
                                        Gunakan Kata Sandi Default Sekarang
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleResetToDefaultPassword} className="space-y-3.5">
                                    <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#435047]">
                                        <span>Email Akun</span>
                                        <input
                                            type="email"
                                            required
                                            value={recoveryEmail}
                                            onChange={e => setRecoveryEmail(e.target.value)}
                                            placeholder="nama@gucimaspratama.co.id"
                                            className="w-full min-h-[40px] px-3 py-2 rounded-[10px] border border-[#d8e0da] bg-white text-[#17231c] text-xs font-normal focus:border-[#245c45] focus:outline-none"
                                        />
                                    </label>

                                    <div className="p-3 rounded-[10px] bg-[#f6f8f6] border border-[#e1e8e2] text-[11px] text-[#435047] flex items-center justify-between">
                                        <span>Kata Sandi Default Reset:</span>
                                        <code className="font-mono font-bold text-xs text-[#245c45] bg-white px-2 py-0.5 rounded border border-[#d8e0da]">
                                            {DEFAULT_ACCOUNT_PASSWORD}
                                        </code>
                                    </div>

                                    <div className="flex items-center gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setShowForgotModal(false)}
                                            className="flex-1 min-h-[40px] rounded-[10px] border border-[#d8e0da] text-[#435047] text-xs font-semibold hover:bg-[#f6f8f6] transition-colors cursor-pointer"
                                        >
                                            Tutup
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={recoveryLoading}
                                            className="flex-1 min-h-[40px] px-3 rounded-[10px] bg-[#245c45] hover:bg-[#1d4b38] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                                        >
                                            {recoveryLoading ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                                <span>Reset ke {DEFAULT_ACCOUNT_PASSWORD}</span>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}


