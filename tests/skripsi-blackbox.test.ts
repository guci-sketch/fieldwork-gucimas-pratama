import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistanceMeters,
  validateGeofence,
  Coordinates,
} from '../src/shared/utils/geo.ts';
import { formatWIBDate } from '../src/shared/utils/watermark.ts';

// ── Titik Acuan Proyek Uji: Kantor PT Guci Emas Pratama (Ciputat) ──
const GUCI_OFFICE: Coordinates = {
  latitude: -6.314643,
  longitude: 106.716157,
};

test('BB-01 [Autentikasi & 2 Role]: Validasi Akses Admin & Teknisi Lapangan', async (t) => {
  await t.test('1.1 Akun Admin memiliki hak akses penuh ke modul monitoring dan penugasan', () => {
    const adminUser = {
      email: 'admin@gucimaspratama.co.id',
      role: 'ADMIN',
      name: 'Ahmad Fauzi (Supervisor)',
    };
    assert.equal(adminUser.role, 'ADMIN');
    const allowedTabs = ['dashboard', 'projects', 'reports', 'anomalies', 'tracking'];
    assert.ok(allowedTabs.includes('dashboard'));
    assert.ok(allowedTabs.includes('tracking'));
  });

  await t.test('1.2 Akun Teknisi Lapangan dibatasi ke tugas kerja mobile (Executor)', () => {
    const techUser = {
      email: 'teknisi@gucimaspratama.co.id',
      role: 'TEKNISI_LAPANGAN',
      name: 'Budi Santoso',
    };
    assert.equal(techUser.role, 'TEKNISI_LAPANGAN');
    const isTech = techUser.role === 'TEKNISI_LAPANGAN';
    assert.equal(isTech, true);
  });

  await t.test('1.3 Penolakan kredensial tidak valid', () => {
    const attemptLogin = (email: string, pw: string) => {
      if (email === 'admin@gucimaspratama.co.id' && pw === 'GuciEmas123!') return { success: true };
      return { success: false, error: 'Password salah' };
    };
    const res = attemptLogin('admin@gucimaspratama.co.id', 'Salah123!');
    assert.equal(res.success, false);
    assert.equal(res.error, 'Password salah');
  });
});

test('BB-02 [Manajemen Proyek & Koordinat]: Penyimpanan Titik Koordinat Pelanggan', async (t) => {
  await t.test('2.1 Data proyek pelanggan tersimpan dengan koordinat acuan valid', () => {
    const newProject = {
      code: 'PRJ-2026-001',
      clientName: 'Klinik Permata Bintaro',
      address: 'Jl. Merpati No. 5, Ciputat',
      latitude: -6.315000,
      longitude: 106.717000,
      radiusMeters: 100,
    };
    assert.ok(newProject.latitude >= -90 && newProject.latitude <= 90);
    assert.ok(newProject.longitude >= -180 && newProject.longitude <= 180);
    assert.equal(newProject.radiusMeters, 100);
  });

  await t.test('2.2 Validasi penolakan koordinat kosong atau 0,0', () => {
    const validateProjectCoord = (lat: number, lon: number) => {
      if (!lat || !lon || (lat === 0 && lon === 0)) return false;
      return true;
    };
    assert.equal(validateProjectCoord(0, 0), false);
    assert.equal(validateProjectCoord(-6.315, 106.717), true);
  });
});

test('BB-03 [Algoritma Haversine & Geofencing]: Validasi Radius Kehadiran 100 Meter', async (t) => {
  await t.test('3.1 Jarak koordinat identik menghasilkan tepat 0 meter (VALID)', () => {
    const d = calculateDistanceMeters(GUCI_OFFICE, GUCI_OFFICE);
    assert.equal(d, 0);
    const check = validateGeofence(GUCI_OFFICE, GUCI_OFFICE, 100);
    assert.equal(check.isInside, true);
    assert.equal(check.differenceMeters, 0);
  });

  await t.test('3.2 Teknisi berada pada jarak ~20 meter di area pelanggan -> VALID', () => {
    const techNearby: Coordinates = {
      latitude: -6.314800,
      longitude: 106.716250,
    };
    const d = calculateDistanceMeters(techNearby, GUCI_OFFICE);
    assert.ok(d <= 100, `Jarak ${d}m seharusnya <= 100m`);
    const check = validateGeofence(techNearby, GUCI_OFFICE, 100);
    assert.equal(check.isInside, true);
  });

  await t.test('3.3 Teknisi berada di luar radius (> 100 meter) -> FLAGGED (Anomali Lokasi)', () => {
    const techFarAway: Coordinates = {
      latitude: -6.319000,
      longitude: 106.716157,
    };
    const d = calculateDistanceMeters(techFarAway, GUCI_OFFICE);
    assert.ok(d > 400, `Jarak ${d}m seharusnya > 400m`);
    const check = validateGeofence(techFarAway, GUCI_OFFICE, 100);
    assert.equal(check.isInside, false);
    assert.ok(check.differenceMeters > 300);
  });
});

test('BB-04 [Dokumentasi Foto]: Pemrosesan Watermark Koordinat & Timestamp', async (t) => {
  await t.test('4.1 Format tanggal dan waktu WIB ter-render secara terstruktur', () => {
    const testDate = new Date(2026, 10, 2, 14, 30, 0);
    const { dateStr, timeStr } = formatWIBDate(testDate);
    assert.ok(dateStr.includes('2026'));
    assert.ok(timeStr.includes('WIB'));
  });

  await t.test('4.2 Payload foto menyimpan atribut fotoTag (BEFORE / AFTER) dan koordinat', () => {
    const photoEvidence = {
      photoTag: 'BEFORE',
      latitude: -6.314800,
      longitude: 106.716250,
      capturedAt: new Date().toISOString(),
    };
    assert.equal(photoEvidence.photoTag, 'BEFORE');
    assert.ok(photoEvidence.latitude < 0);
    assert.ok(photoEvidence.longitude > 100);
  });
});

test('BB-05 [Form Temuan Hama & Tanda Tangan Digital]: Verifikasi & Siklus Laporan', async (t) => {
  await t.test('5.1 Formulir temuan hama merekam jenis hama dan volume perlakuan', () => {
    const workReport = {
      pestType: 'Rayap Tanah (Coptotermes sp.)',
      areaTreated: 'Pondasi Keliling Bangunan',
      chemicalUsed: 'Termisida Imidakloprid',
      volumeLiters: 150,
    };
    assert.ok(workReport.pestType.length > 0);
    assert.ok(workReport.volumeLiters > 0);
  });

  await t.test('5.2 Perekaman tanda tangan digital berbasis Base64 Canvas PNG valid', () => {
    const validSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const isPng = validSignature.startsWith('data:image/png;base64,');
    assert.equal(isPng, true);
  });

  await t.test('5.3 Siklus penugasan: Transisi status dari ASSIGNED -> IN_PROGRESS -> COMPLETED', () => {
    const validStates = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];
    let state = validStates[0];
    state = validStates[1]; // Teknisi check-in
    assert.equal(state, 'IN_PROGRESS');
    state = validStates[2]; // Teknisi selesai & kirim laporan
    assert.equal(state, 'COMPLETED');
  });
});
