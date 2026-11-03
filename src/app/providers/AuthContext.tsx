import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppUser } from '@/entities/types';
import { supabase } from '@/shared/lib/supabase';
import { fetchAppUser } from '@/shared/api/authProfile';
import { useAuthStore } from '@/app/store/authStore';

interface AuthContextValue {
  user: AppUser | null;
  status: 'checking' | 'authenticated' | 'unauthenticated';
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  applyUser: (u: AppUser | null) => void;
}

const DEMO_USER_KEY = 'fw_demo_user_v1';

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
        localStorage.setItem(DEMO_USER_KEY, JSON.stringify(u));
      } else {
        localStorage.removeItem(DEMO_USER_KEY);
      }
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const hydrate = useCallback(async (uid: string | null) => {
    if (!uid) {
      try {
        const stored = localStorage.getItem(DEMO_USER_KEY);
        if (stored) {
          applyUser(JSON.parse(stored));
          return;
        }
      } catch {
        /* ignore */
      }
      applyUser(null);
      return;
    }
    try {
      const res = await fetchAppUser(uid);
      if (!res.user) {
        console.warn('[auth]', (res.message ?? 'Akun tidak dapat digunakan.'));
        await supabase.auth.signOut().catch(() => {});
        applyUser(null);
        return;
      }
      applyUser(res.user);
    } catch {
      applyUser(null);
    }
  }, [applyUser]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) void hydrate(session?.user?.id ?? null);
    }).catch(() => {
      if (!cancelled) void hydrate(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
      setTimeout(() => { if (!cancelled) void hydrate(event === 'SIGNED_OUT' ? null : session?.user?.id ?? null); }, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [hydrate]);

  const login = useCallback(async (email: string, pass: string) => {
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (authErr) throw authErr;
    const res = await fetchAppUser(authData.user.id);
    if (!res.user) {
      await supabase.auth.signOut().catch(() => {});
      throw new Error((res.message ?? 'Akun tidak dapat digunakan.'));
    }
    applyUser(res.user);
  }, [applyUser]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {});
    applyUser(null);
  }, [applyUser]);

  return <AuthContext.Provider value={{ user, status, login, logout, applyUser }}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
