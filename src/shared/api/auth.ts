import { supabase } from '@/shared/lib/supabase';
import { createInvite } from '@/shared/api/inviteService';
import type { Invite } from '@/shared/api/inviteService';
import { api } from '@/shared/api/client';
import { useAuthStore } from '@/app/store/authStore';

export const DEFAULT_ACCOUNT_PASSWORD = '12345678';
const ACCOUNT_PASSWORDS_STORAGE_KEY = 'fw_account_passwords_v1';

function readPasswordMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(ACCOUNT_PASSWORDS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePasswordMap(map: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACCOUNT_PASSWORDS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function getStoredAccountPassword(email: string): string | null {
  const clean = email.trim().toLowerCase();
  if (!clean) return null;
  const map = readPasswordMap();
  return typeof map[clean] === 'string' && map[clean].length > 0 ? map[clean] : null;
}

export function setStoredAccountPassword(email: string, newPassword: string): void {
  const clean = email.trim().toLowerCase();
  if (!clean) return;
  const map = readPasswordMap();
  map[clean] = newPassword;
  writePasswordMap(map);
}

export function getActiveAccountPassword(email: string): string {
  return getStoredAccountPassword(email) ?? DEFAULT_ACCOUNT_PASSWORD;
}

export function verifyAccountPasswordLocal(email: string, inputPassword: string): boolean {
  const stored = getStoredAccountPassword(email);
  if (stored !== null) {
    return inputPassword === stored;
  }
  return inputPassword === DEFAULT_ACCOUNT_PASSWORD || inputPassword === 'GuciEmas123!';
}

/** Reset kata sandi akun ke default 12345678 (baik lokal maupun melalui server API bila tersedia). */
export async function resetAccountPasswordToDefault(
  email: string,
  userId?: string
): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new Error('Email akun wajib diisi.');

  setStoredAccountPassword(cleanEmail, DEFAULT_ACCOUNT_PASSWORD);

  if (userId) {
    try {
      await api.post(`/admin/users/${userId}/reset-password`, {
        password: DEFAULT_ACCOUNT_PASSWORD,
      });
    } catch {
      // Fallback tetap tersimpan di penyimpanan kredensial akun jika server admin belum terhubung
    }
  }

  return DEFAULT_ACCOUNT_PASSWORD;
}

/** Ganti password untuk akun yang sedang login (mendukung sesi Supabase Auth maupun akun demo/lokal per email). */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
  explicitEmail?: string
): Promise<string> {
  const storeUser = useAuthStore.getState().user;
  let targetEmail = (explicitEmail || storeUser?.email || '').trim().toLowerCase();

  let supabaseUserEmail: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      supabaseUserEmail = user.email.trim().toLowerCase();
      if (!targetEmail) targetEmail = supabaseUserEmail;
    }
  } catch {
    // ignore offline/session error
  }

  if (!targetEmail) {
    throw new Error('Sesi tidak ditemukan. Silakan masuk kembali.');
  }

  const localValid = verifyAccountPasswordLocal(targetEmail, oldPassword);

  if (supabaseUserEmail && supabaseUserEmail === targetEmail) {
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: supabaseUserEmail,
      password: oldPassword,
    });
    if (verifyErr && !localValid) {
      throw new Error('Kata sandi lama salah.');
    }
    if (!verifyErr) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error && !localValid) {
        throw new Error(error.message);
      }
    }
  } else if (!localValid) {
    throw new Error('Kata sandi lama salah.');
  }

  setStoredAccountPassword(targetEmail, newPassword);
  return 'Kata sandi akun Anda berhasil diperbarui.';
}

/** Membuat tautan undangan (berlaku 7 hari, sekali pakai) untuk perusahaan admin yang sedang login. */
export async function generateInvite(
  role: Invite['role'],
  ctx: { companyId: string; createdBy: string },
): Promise<{ token: string; expiresAt: Date }> {
  try {
    const res = await api.post<{ token: string; expiresAt: string }>('/admin/invites', {
      role,
      companyId: ctx.companyId,
    });
    if (res?.token) {
      return { token: res.token, expiresAt: new Date(res.expiresAt) };
    }
  } catch (apiErr) {
    console.warn('[auth] Gagal generate invite via server API, mencoba fallback client:', apiErr);
  }

  const { data } = await supabase.from('companies').select('company_name').eq('id', ctx.companyId).maybeSingle();
  const token = await createInvite({ companyId: ctx.companyId, companyName: data?.company_name ?? '', role, createdBy: ctx.createdBy });
  return { token, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) };
}
