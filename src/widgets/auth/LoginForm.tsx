import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from '@/shared/lib/supabase';
import { useAuthStore } from '@/app/store/authStore';
import { SEED_DEMO_USERS } from '@/app/providers/AuthContext';
import { useTheme } from '@/shared/hooks/useTheme';
import {
    AlertCircle,
    Loader2,
    LockKeyhole,
    EyeOff,
    ShieldCheck,
    ArrowRight,
    UserCheck,
    KeyRound,
    Building2,
    Smartphone,
    Sun,
    Moon,
} from "lucide-react";
import type { AppUser } from '@/entities/types';
import { fetchAppUser } from '@/shared/api/authProfile';
import { readPendingInvite, repairPendingInviteUser } from '@/shared/api/inviteService';

const QUICK_DEMO_ACCOUNTS = [
    {
        label: "Admin Operasional",
        roleBadge: "ADMIN",
        group: "admin" as const,
        email: "admin@gucimaspratama.co.id",
        pw: "GuciEmas123!",
    },
    {
        label: "Teknisi Lapangan",
        roleBadge: "TEKNISI",
        group: "technician" as const,
        email: "teknisi@gucimaspratama.co.id",
        pw: "GuciEmas123!",
    },
];

export function LoginPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { setUser } = useAuthStore();
    const { resolvedTheme, setTheme } = useTheme();
    const [roleMode, setRoleMode] = useState<"admin" | "technician">("admin");
    const [email, setEmail] = useState("admin@gucimaspratama.co.id");
    const [password, setPassword] = useState("GuciEmas123!");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

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

    const handleSwitchRoleMode = (nextMode: "admin" | "technician") => {
        setRoleMode(nextMode);
        if (nextMode === "technician") {
            setEmail("teknisi@gucimaspratama.co.id");
            setPassword("GuciEmas123!");
        } else {
            setEmail("admin@gucimaspratama.co.id");
            setPassword("GuciEmas123!");
        }
    };

    const performSignIn = async (loginEmail: string, loginPassword: string) => {
        setError("");
        setLoading(true);
        const cleanEmail = loginEmail.trim().toLowerCase();

        try {
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

            if (!authErr && authData?.user) {
                const res = await fetchAppUser(authData.user.id);
                if (res.user) {
                    const appUser: AppUser = res.user;
                    setUser(appUser);
                    navigate("/");
                    return;
                }
            }

            // Fallback ke akun Seed 2-Role PT Guci Emas Pratama apabila Supabase belum dikonfigurasi
            const seedUser = SEED_DEMO_USERS[cleanEmail];
            if (seedUser && loginPassword === "GuciEmas123!") {
                setUser(seedUser);
                navigate("/");
                return;
            }

            if (authErr) {
                const errLower = authErr.message.toLowerCase();
                if (errLower.includes("not confirmed") || errLower.includes("unconfirmed")) {
                    throw new Error(
                        "Email akun Anda belum terkonfirmasi di Supabase. Jalankan file SQL `supabase/guci_emas_2role_database_setup.sql` di Supabase SQL Editor untuk mengaktifkan seluruh akun secara otomatis."
                    );
                }
                if (errLower.includes("invalid login credentials")) {
                    throw new Error(
                        "Email atau password salah. Gunakan tombol Akses Cepat 2-Role di bawah untuk masuk sebagai Admin atau Teknisi."
                    );
                }
                throw authErr;
            }
            throw new Error("Login gagal. Silakan coba lagi.");
        } catch (err: any) {
            const seedUser = SEED_DEMO_USERS[cleanEmail];
            if (seedUser && loginPassword === "GuciEmas123!") {
                setUser(seedUser);
                navigate("/");
                return;
            }
            setError(err.message || "Email atau password salah. Silakan periksa kembali.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        await performSignIn(email, password);
    };

    const handleQuickLogin = async (accEmail: string, accPw: string, accGroup: "admin" | "technician") => {
        setRoleMode(accGroup);
        setEmail(accEmail);
        setPassword(accPw);
        await performSignIn(accEmail, accPw);
    };

    return (
        <main className="min-h-screen grid grid-cols-1 lg:grid-cols-[minmax(420px,0.95fr)_minmax(480px,1.05fr)] bg-[var(--bg-card)] text-[var(--text-primary)]">
            {/* Left Aside — RedesignFieldworkGuciMasLite Split Hero */}
            <section className="hidden lg:flex flex-col justify-between bg-[#1A5C38] text-white p-12 xl:p-14 relative overflow-hidden">
                <div className="flex items-center gap-3 relative z-10">
                    <div className="brand-mark">
                        <span />
                        <span />
                        <span />
                    </div>
                    <div>
                        <strong className="block text-base leading-tight font-bold">Fieldwork</strong>
                        <small className="block text-[11px] text-white/75 mt-0.5">PT Guci Emas Pratama</small>
                    </div>
                </div>

                <div className="max-w-xl relative z-10 my-auto">
                    <span className="text-xs font-bold tracking-[0.12em] text-[#cfe0d5] uppercase block">
                        EDISI FOKUS 2-ROLE • HAVERSINE &amp; DIGITAL REPORT
                    </span>
                    <h1 className="text-4xl xl:text-[42px] font-bold leading-[1.15] tracking-[-0.035em] my-4 text-white">
                        Validasi Geolocation Haversine &amp; Laporan Hasil Pekerjaan Digital.
                    </h1>
                    <p className="text-base leading-[1.7] text-[#dbe8df] max-w-[530px]">
                        Dirancang khusus untuk 2 peran utama (Admin Operasional &amp; Teknisi Lapangan): presensi GPS Haversine akurat, dokumentasi foto ber-watermark, evaluasi rahasia PIC (Strict Blind), dan verifikasi Digital Report.
                    </p>
                </div>

                <div className="flex items-center gap-3 text-xs text-[#dbe8df] relative z-10">
                    <ShieldCheck size={20} className="shrink-0 text-[#cfe0d5]" />
                    <div>
                        <strong className="block text-white mb-0.5">Sistem Operasional 2-Role Terintegrasi Database</strong>
                        <span>Presensi GPS Haversine, Dokumentasi Foto Ber-watermark, &amp; Laporan Hasil Pekerjaan (LHP).</span>
                    </div>
                </div>

                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute w-[420px] h-[420px] rounded-full border border-white/12 -right-[180px] -bottom-[150px] shadow-[0_0_0_70px_rgba(255,255,255,0.03),0_0_0_140px_rgba(255,255,255,0.025)]"
                />
            </section>

            {/* Right Login Panel */}
            <section className="flex items-center justify-center p-6 sm:p-12 bg-[var(--bg-primary)] relative">
                {/* Tombol Toggle Tema Terang / Gelap */}
                <button
                    type="button"
                    onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                    className="absolute top-5 right-5 px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                    {resolvedTheme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                    <span>{resolvedTheme === "dark" ? "Mode Terang" : "Mode Gelap"}</span>
                </button>

                <div className="w-full max-w-[420px]">
                    {/* Mobile Brand Header */}
                    <div className="flex lg:hidden items-center gap-3 mb-7">
                        <div className="brand-mark emerald-bg">
                            <span />
                            <span />
                            <span />
                        </div>
                        <div>
                            <strong className="block text-base leading-tight font-bold text-[var(--text-primary)]">Fieldwork</strong>
                            <small className="block text-[11px] text-[var(--text-secondary)] mt-0.5">PT Guci Emas Pratama</small>
                        </div>
                    </div>

                    <span className="inline-flex items-center h-6 px-2.5 rounded-md bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-[11px] font-semibold">
                        Sistem Fokus 2-Role (Admin &amp; Teknisi)
                    </span>

                    <h2 className="text-2xl sm:text-[30px] font-bold tracking-[-0.025em] text-[var(--text-primary)] mt-4 mb-1.5">
                        Selamat datang
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)] mb-6">
                        Pilih peran Admin Operasional atau Teknisi Lapangan untuk masuk.
                    </p>

                    {/* Role Switcher (Admin vs Teknisi) */}
                    <div className="grid grid-cols-2 p-1 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl mb-5" role="group" aria-label="Pilih peran">
                        <button
                            type="button"
                            onClick={() => handleSwitchRoleMode("admin")}
                            className={`min-h-[42px] rounded-lg flex items-center justify-center gap-2 text-[13px] font-semibold transition-all cursor-pointer ${
                                roleMode === "admin"
                                    ? "bg-[var(--bg-card)] text-[var(--accent)] shadow-[0_1px_3px_rgba(23,35,28,0.09)]"
                                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            }`}
                        >
                            <Building2 size={17} />
                            Admin Operasional
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSwitchRoleMode("technician")}
                            className={`min-h-[42px] rounded-lg flex items-center justify-center gap-2 text-[13px] font-semibold transition-all cursor-pointer ${
                                roleMode === "technician"
                                    ? "bg-[var(--bg-card)] text-[var(--accent)] shadow-[0_1px_3px_rgba(23,35,28,0.09)]"
                                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            }`}
                        >
                            <Smartphone size={17} />
                            Teknisi Lapangan
                        </button>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[var(--text-secondary)]">
                            <span>Email</span>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="nama@gucimaspratama.co.id"
                                required
                                className="w-full min-h-[44px] px-3 py-2.5 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] text-sm font-normal focus:border-[var(--accent)] focus:outline-none focus:ring-3 focus:ring-[var(--accent-glow)] transition-all"
                            />
                        </label>

                        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[var(--text-secondary)]">
                            <span>Kata sandi</span>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Masukkan kata sandi"
                                    required
                                    className="w-full min-h-[44px] pl-3 pr-11 py-2.5 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] text-sm font-normal focus:border-[var(--accent)] focus:outline-none focus:ring-3 focus:ring-[var(--accent-glow)] transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label="Tampilkan kata sandi"
                                    className="absolute right-1 top-1 w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={17} /> : <LockKeyhole size={17} />}
                                </button>
                            </div>
                        </label>

                        {error && (
                            <div className="flex items-start gap-2 text-[var(--status-flagged-text)] bg-[var(--status-flagged-bg)] border border-[var(--status-flagged-border)] rounded-[10px] p-3 text-xs font-medium leading-relaxed">
                                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full min-h-[48px] px-4 rounded-[10px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-60"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" /> Memeriksa Akun...
                                </>
                            ) : (
                                <>
                                    Masuk sebagai {roleMode === "admin" ? "Admin Operasional" : "Teknisi Lapangan"}
                                    <ArrowRight size={17} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Tautan Registrasi via Token Undangan */}
                    <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                        <span className="text-[var(--text-secondary)]">Punya Token Undangan?</span>
                        <Link
                            to="/signup"
                            className="inline-flex items-center gap-1 font-semibold text-[var(--accent-text)] hover:underline"
                        >
                            <KeyRound size={13} /> Aktivasi via Token
                        </Link>
                    </div>

                    {/* 1-Click 2-Role Accounts */}
                    <div className="mt-4 pt-3.5 border-t border-[var(--border-subtle)] space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                                Akses Cepat 2-Role PT Guci Emas Pratama (1-Klik)
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">2 Peran Inti</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {QUICK_DEMO_ACCOUNTS.map(acc => (
                                <button
                                    key={acc.email}
                                    type="button"
                                    disabled={loading}
                                    onClick={() => handleQuickLogin(acc.email, acc.pw, acc.group)}
                                    className={`flex flex-col items-start justify-between p-2.5 rounded-[10px] border text-left transition-all cursor-pointer ${
                                        email === acc.email
                                            ? "border-[var(--accent)] bg-[var(--accent-glow)]"
                                            : "border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)]"
                                    }`}
                                >
                                    <div className="flex items-center justify-between w-full gap-1 mb-0.5">
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--bg-secondary)] text-[var(--accent-text)]">
                                            {acc.roleBadge}
                                        </span>
                                        <UserCheck size={11} className="text-[var(--text-muted)]" />
                                    </div>
                                    <div className="font-semibold text-[11px] text-[var(--text-primary)] truncate w-full">{acc.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <p className="text-center text-xs text-[var(--text-secondary)] mt-5">
                        Akses bermasalah? Hubungi Admin Operasional PT Guci Emas Pratama.
                    </p>
                </div>
            </section>
        </main>
    );
}
