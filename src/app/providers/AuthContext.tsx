import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppUser } from '@/entities/types';
import { supabase } from '@/shared/lib/supabase';
import { fetchAppUser } from '@/shared/api/authProfile';
import { useAuthStore, readPersistedUser, persistUserSession, clearAuthSession } from '@/app/store/authStore';

interface AuthContextValue {
  user: AppUser | null;
  status: 'checking' | 'authenticated' | 'unauthenticated';
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const initialPersisted = readPersistedUser();
  const [user, setUserState] = useState<AppUser | null>(initialPersisted);
  const [status, setStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>(
    initialPersisted ? 'authenticated' : 'checking'
  );

  const applyUser = useCallback((u: AppUser | null, rememberMe?: boolean) => {
    setUserState(u);
    setStatus(u ? 'authenticated' : 'unauthenticated');
    const store = useAuthStore.getState();
    store.setUser(u, rememberMe);
    store.setLoading(false);
  }, []);

  // Sinkronkan jika komponen LoginForm mengubah user pada useAuthStore
  useEffect(() => {
    const unsub = useAuthStore.subscribe((state) => {
      setUserState(state.user);
      setStatus(state.user ? 'authenticated' : 'unauthenticated');
    });
    return () => unsub();
  }, []);

  const hydrate = useCallback(async (uid: string | null) => {
    if (!uid) {
      const remembered = readPersistedUser();
      if (remembered) {
        setUserState(remembered);
        setStatus('authenticated');
        useAuthStore.getState().setLoading(false);
        return;
      }
      applyUser(null);
      return;
    }
    const res = await fetchAppUser(uid);
    if (!res.user) {
      const remembered = readPersistedUser();
      if (remembered) {
        setUserState(remembered);
        setStatus('authenticated');
        useAuthStore.getState().setLoading(false);
        return;
      }
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
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
      if (event === 'SIGNED_OUT') {
        setTimeout(() => {
          if (!cancelled) {
            clearAuthSession();
            applyUser(null);
          }
        }, 0);
        return;
      }
      setTimeout(() => { if (!cancelled) void hydrate(session?.user.id ?? null); }, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [hydrate, applyUser]);

  const login = useCallback(async (email: string, pass: string) => {
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (authErr) throw authErr;
    const res = await fetchAppUser(authData.user.id);
    if (!res.user) {
      await supabase.auth.signOut();
      throw new Error((res.message ?? 'Akun tidak dapat digunakan.'));
    }
    applyUser(res.user);
  }, [applyUser]);

  const logout = useCallback(async () => {
    clearAuthSession();
    persistUserSession(null);
    useAuthStore.getState().clearSession();
    setUserState(null);
    setStatus('unauthenticated');
    await supabase.auth.signOut().catch(() => undefined);
    navigate('/login', { replace: true });
  }, [navigate]);

  return <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

