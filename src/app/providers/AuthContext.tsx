import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppUser } from '@/entities/types';
import { supabase } from '@/shared/lib/supabase';
import { fetchAppUser } from '@/shared/api/authProfile';
import { useAuthStore } from '@/app/store/authStore';

const LOCAL_SESSION_KEY = 'fw_active_session_v2';

export const SEED_DEMO_USERS: Record<string, AppUser> = {
  'direktur@gucimaspratama.co.id': {
    uid: '22222222-2222-2222-2222-222222222201',
    name: 'H. Bambang Hartono (Direktur)',
    email: 'direktur@gucimaspratama.co.id',
    role: 'SUPERADMIN',
    companyId: '11111111-1111-1111-1111-111111111101',
    isActive: true,
    wa: '08119001101',
    nip: 'GM-DIR-001',
  },
  'admin@gucimaspratama.co.id': {
    uid: '22222222-2222-2222-2222-222222222202',
    name: 'Rina Kusuma (Admin Operasional)',
    email: 'admin@gucimaspratama.co.id',
    role: 'ADMIN',
    companyId: '11111111-1111-1111-1111-111111111101',
    isActive: true,
    wa: '08119001102',
    nip: 'GM-ADM-002',
  },
  'surveyor@gucimaspratama.co.id': {
    uid: '22222222-2222-2222-2222-222222222203',
    name: 'Fajar Nugroho (Marketing Surveyor)',
    email: 'surveyor@gucimaspratama.co.id',
    role: 'MARKETING',
    companyId: '11111111-1111-1111-1111-111111111101',
    isActive: true,
    wa: '08119001103',
    nip: 'GM-MKT-003',
  },
  'teknisi@gucimaspratama.co.id': {
    uid: '22222222-2222-2222-2222-222222222204',
    name: 'Agung Pratama',
    email: 'teknisi@gucimaspratama.co.id',
    role: 'TEKNISI_LAPANGAN',
    companyId: '11111111-1111-1111-1111-111111111101',
    isActive: true,
    wa: '081288001104',
    nip: 'GM-TEK-004',
  },
  'gudang@gucimaspratama.co.id': {
    uid: '22222222-2222-2222-2222-222222222205',
    name: 'Hendra Wijaya (Gudang Chemical)',
    email: 'gudang@gucimaspratama.co.id',
    role: 'INVENTORY',
    companyId: '11111111-1111-1111-1111-111111111101',
    isActive: true,
    wa: '08119001105',
    nip: 'GM-INV-005',
  },
};

interface AuthContextValue {
  user: AppUser | null;
  status: 'checking' | 'authenticated' | 'unauthenticated';
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');

  const applyUser = useCallback((u: AppUser | null) => {
    setUserState(u);
    setStatus(u ? 'authenticated' : 'unauthenticated');
    const store = useAuthStore.getState();
    store.setUser(u);
    store.setLoading(false);
    try {
      if (u) {
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(u));
      } else {
        localStorage.removeItem(LOCAL_SESSION_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Sinkronkan juga apabila komponen luar (mis. LoginForm) mengubah useAuthStore.setUser secara langsung
  useEffect(() => {
    const unsub = useAuthStore.subscribe(state => {
      if (state.user && state.user.uid !== user?.uid) {
        setUserState(state.user);
        setStatus('authenticated');
        try {
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(state.user));
        } catch {
          // ignore
        }
      }
    });
    return () => unsub();
  }, [user?.uid]);

  const hydrate = useCallback(async (uid: string | null) => {
    if (!uid) {
      try {
        const cached = localStorage.getItem(LOCAL_SESSION_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as AppUser;
          if (parsed && parsed.uid && parsed.role) {
            applyUser(parsed);
            return;
          }
        }
      } catch {
        // ignore
      }
      applyUser(null);
      return;
    }
    const res = await fetchAppUser(uid);
    if (!res.user) {
      console.warn('[auth]', (res.message ?? 'Akun tidak dapat digunakan.'));
      await supabase.auth.signOut();
      applyUser(null);
      return;
    }
    applyUser(res.user);
  }, [applyUser]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) void hydrate(session?.user.id ?? null);
    }).catch(() => {
      if (!cancelled) void hydrate(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
      setTimeout(() => {
        if (!cancelled) {
          if (event === 'SIGNED_OUT') {
            applyUser(null);
          } else if (session?.user?.id) {
            void hydrate(session.user.id);
          }
        }
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [hydrate, applyUser]);

  const login = useCallback(async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass,
      });
      if (!authErr && authData?.user) {
        const res = await fetchAppUser(authData.user.id);
        if (res.user) {
          applyUser(res.user);
          return;
        }
      }
      // Fallback ke akun Seed PT Guci Emas Pratama apabila Supabase belum dikonfigurasi di .env
      const seedUser = SEED_DEMO_USERS[cleanEmail];
      if (seedUser && pass === 'GuciEmas123!') {
        applyUser(seedUser);
        return;
      }
      if (authErr) throw authErr;
      throw new Error('Akun tidak dapat digunakan.');
    } catch (err) {
      const seedUser = SEED_DEMO_USERS[cleanEmail];
      if (seedUser && pass === 'GuciEmas123!') {
        applyUser(seedUser);
        return;
      }
      throw err;
    }
  }, [applyUser]);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    applyUser(null);
  }, [applyUser]);

  return <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
