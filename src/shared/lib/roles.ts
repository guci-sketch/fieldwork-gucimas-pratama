import type { UserRole } from '@/entities/types';

/** Fokus 2 Role Utama: Admin Operasional (ADMIN) & Teknisi Lapangan (TEKNISI_LAPANGAN) dengan kompatibilitas DB penuh. */
export const DB_ROLES = [
    'ADMIN',
    'TEKNISI_LAPANGAN',
    'SUPERADMIN',
    'MARKETING',
    'INVENTORY',
    'MASTER_SUPER_ADMIN',
] as const;

export function isUserRole(value: unknown): value is UserRole {
    return typeof value === 'string' && (DB_ROLES as readonly string[]).includes(value);
}

/** Dalam versi minimalis 2-Role, konsol SaaS terpisah dinonaktifkan dan disatukan ke Admin Operasional. */
export function isMasterSuperAdmin(_role?: UserRole | string | null): boolean {
    return false;
}

/** Seluruh akses manajerial disatukan ke Admin Operasional. */
export function isSuperOrMaster(role?: UserRole | string | null): boolean {
    return role !== 'TEKNISI_LAPANGAN' && Boolean(role);
}

/** Admin Operasional memiliki akses penuh terhadap seluruh modul manajemen & operasional. */
export function isAdminOrAbove(role?: UserRole | string | null): boolean {
    return role !== 'TEKNISI_LAPANGAN' && Boolean(role);
}

/** Admin Operasional memiliki otoritas penuh di konsol manajemen. */
export function isDirectorUser(user?: { role?: string; email?: string } | null): boolean {
    if (!user) return false;
    return user.role !== 'TEKNISI_LAPANGAN';
}

export function formatRoleLabel(role?: UserRole | string | null): string {
    return role === 'TEKNISI_LAPANGAN' ? 'Teknisi Lapangan' : 'Admin Operasional';
}

export function mapDbRole(role: unknown): UserRole {
    if (role === 'TEKNISI_LAPANGAN') return 'TEKNISI_LAPANGAN';
    if (isUserRole(role)) return 'ADMIN';
    return 'TEKNISI_LAPANGAN';
}

/** Kolom profil yang aman dimuat ke browser (TANPA password_hash). */
export const USER_PROFILE_COLUMNS = 'id, company_id, name, email, nip, role, phone, is_active';
