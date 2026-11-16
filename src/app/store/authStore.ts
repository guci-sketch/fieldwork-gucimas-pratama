import { create } from "zustand";
import type { AppUser } from '@/entities/types';

const ACTIVE_COMPANY_KEY = 'fw_active_company_v1';
const REMEMBERED_SESSION_KEY = 'fw_remembered_session_v1';
const REMEMBERED_EMAIL_KEY = 'fw_remembered_email_v1';
const REMEMBER_ME_FLAG_KEY = 'fw_remember_me_v1';
const DEFAULT_GUCI_COMPANY_ID = '00000000-0000-4000-a000-000000000001';

function readActiveCompany(): string | null {
    try {
        return localStorage.getItem(ACTIVE_COMPANY_KEY) || DEFAULT_GUCI_COMPANY_ID;
    } catch {
        return DEFAULT_GUCI_COMPANY_ID;
    }
}

export function readRememberMeFlag(): boolean {
    try {
        const raw = localStorage.getItem(REMEMBER_ME_FLAG_KEY);
        if (raw === null) return true;
        return raw === 'true';
    } catch {
        return true;
    }
}

export function readRememberedEmail(): string {
    try {
        return localStorage.getItem(REMEMBERED_EMAIL_KEY) || '';
    } catch {
        return '';
    }
}

export function readPersistedUser(): AppUser | null {
    try {
        const localRaw = localStorage.getItem(REMEMBERED_SESSION_KEY);
        if (localRaw) {
            const parsed = JSON.parse(localRaw) as AppUser;
            if (parsed && parsed.uid && parsed.email && parsed.role) {
                return parsed;
            }
        }
        const sessionRaw = sessionStorage.getItem(REMEMBERED_SESSION_KEY);
        if (sessionRaw) {
            const parsed = JSON.parse(sessionRaw) as AppUser;
            if (parsed && parsed.uid && parsed.email && parsed.role) {
                return parsed;
            }
        }
    } catch {
        /* abaikan */
    }
    return null;
}

export function persistUserSession(user: AppUser | null, rememberMe?: boolean): void {
    try {
        if (!user) {
            localStorage.removeItem(REMEMBERED_SESSION_KEY);
            sessionStorage.removeItem(REMEMBERED_SESSION_KEY);
            return;
        }
        const shouldRemember = rememberMe ?? readRememberMeFlag();
        localStorage.setItem(REMEMBER_ME_FLAG_KEY, String(shouldRemember));
        const serialized = JSON.stringify(user);
        if (shouldRemember) {
            localStorage.setItem(REMEMBERED_SESSION_KEY, serialized);
            localStorage.setItem(REMEMBERED_EMAIL_KEY, user.email);
            sessionStorage.removeItem(REMEMBERED_SESSION_KEY);
        } else {
            sessionStorage.setItem(REMEMBERED_SESSION_KEY, serialized);
            localStorage.removeItem(REMEMBERED_SESSION_KEY);
            localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        }
    } catch {
        /* abaikan */
    }
}

export function clearAuthSession(): void {
    try {
        localStorage.removeItem(REMEMBERED_SESSION_KEY);
        sessionStorage.removeItem(REMEMBERED_SESSION_KEY);
        // Bersihkan juga token sesi Supabase yang tersimpan di storage browser
        for (const key of Object.keys(localStorage)) {
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                localStorage.removeItem(key);
            }
        }
        for (const key of Object.keys(sessionStorage)) {
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                sessionStorage.removeItem(key);
            }
        }
    } catch {
        /* abaikan */
    }
}

interface AuthState {
    user: AppUser | null;
    loading: boolean;
    activeCompanyId: string | null;
    setUser: (user: AppUser | null, rememberMe?: boolean) => void;
    setLoading: (loading: boolean) => void;
    setActiveCompanyId: (id: string | null) => void;
    clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: readPersistedUser(),
    loading: true,
    activeCompanyId: readActiveCompany(),
    setUser: (user, rememberMe) => {
        const currentActive = get().activeCompanyId;
        const resolvedCompanyId =
            user?.companyId || currentActive || DEFAULT_GUCI_COMPANY_ID;
        try {
            if (resolvedCompanyId) {
                localStorage.setItem(ACTIVE_COMPANY_KEY, resolvedCompanyId);
            }
        } catch {
            /* abaikan */
        }
        persistUserSession(user, rememberMe);
        set({ user, activeCompanyId: resolvedCompanyId });
    },
    setLoading: (loading) => set({ loading }),
    setActiveCompanyId: (id) => {
        try {
            id
                ? localStorage.setItem(ACTIVE_COMPANY_KEY, id)
                : localStorage.removeItem(ACTIVE_COMPANY_KEY);
        } catch {
            /* abaikan */
        }
        set({ activeCompanyId: id });
    },
    clearSession: () => {
        clearAuthSession();
        set({ user: null, loading: false });
    },
}));

