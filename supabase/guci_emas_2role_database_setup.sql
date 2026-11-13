-- ============================================================================
-- PT GUCI EMAS PRATAMA — 2-ROLE HAVERSINE GEOLOCATION & DIGITAL REPORT SETUP
-- ============================================================================
-- Fokus Utama:
--   1. Role ADMIN (Admin Operasional) & TEKNISI_LAPANGAN (Teknisi Lapangan)
--   2. Validasi Geolocation Haversine (Check-In, Check-Out, Radius, Drift, Telemetry)
--   3. Digital Report / Laporan Hasil Pekerjaan (LHP) + Strict Blind PIC Evaluation
--   4. Data Seed Realistis Terdistribusi:
--      - HARI INI (current_date): 3 Tugas (1 WORKING, 2 READY)
--      - BESOK (current_date + 1): 2 Tugas (2 READY)
--      - KEMARIN (current_date - 1): 2 Tugas (1 COMPLETED, 1 FLAGGED Luar Radius + Kendala)
--      - ARSIP (< Kemarin: current_date - 5 & current_date - 12): 2 Tugas (2 REVIEWED)
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. TABEL PERUSAHAAN & KONFIGURASI RISIKO HAVERSINE
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  status text not null default 'ACTIVE',
  address text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key,
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  email text not null unique,
  role text not null check (role in ('ADMIN', 'TEKNISI_LAPANGAN', 'SUPERADMIN', 'MARKETING', 'INVENTORY', 'MASTER_SUPER_ADMIN')),
  phone text,
  nip text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  project_name text not null,
  client_name text,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius integer not null default 100,
  service_type text not null default 'GENERAL_PEST_CONTROL',
  contract_type text not null default 'CONTRACT',
  pest_types text[] not null default '{}',
  treatment_types text[] not null default '{}',
  chemical_used text not null default 'Cypergard 250 EC',
  work_date date not null default current_date,
  scheduled_start_time text default '09:00',
  warranty_months integer not null default 12,
  next_service_date date,
  assigned_executor_id uuid references public.users(id) on delete set null,
  locked_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.work_reports (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  executor_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'READY' check (status in ('DRAFT', 'READY', 'WORKING', 'COMPLETED', 'FLAGGED', 'REVIEWED')),
  service_type text not null default 'GENERAL_PEST_CONTROL',
  check_in_at timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  check_in_acc double precision,
  check_in_dist double precision,
  check_in_valid boolean,
  check_out_at timestamptz,
  check_out_lat double precision,
  check_out_lng double precision,
  check_out_acc double precision,
  check_out_dist double precision,
  check_out_valid boolean,
  duration_seconds integer,
  risk_score integer not null default 0,
  risk_level text not null default 'LOW',
  admin_review_notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  scheduled_start_time text,
  work_notes text,
  target_focus text[] default '{}',
  next_service_date date,
  team_members jsonb default '[]'::jsonb,
  customer_name text,
  customer_phone text,
  customer_feedback text,
  customer_signature text,
  created_at timestamptz not null default now()
);

create table if not exists public.documentation_photos (
  id text primary key default gen_random_uuid()::text,
  work_report_id text not null references public.work_reports(id) on delete cascade,
  type text not null default 'PROGRESS',
  photo_tag text,
  url text not null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision not null default 10,
  distance_from_project double precision,
  is_within_radius boolean default true,
  captured_at timestamptz not null default now(),
  purged_at timestamptz
);

create table if not exists public.treatment_records (
  id text primary key default gen_random_uuid()::text,
  work_report_id text not null unique references public.work_reports(id) on delete cascade,
  service_type text not null,
  chemical_name text not null,
  dosage text not null,
  application_method text not null,
  target_area text not null,
  safety_notes text,
  pest_types text[] default '{}',
  infestation_level text,
  termite_species text,
  injection_points integer,
  barrier_length_meters numeric,
  warranty_period_months integer,
  technician_signature text,
  client_pic_name text,
  client_signature text,
  technician_notes text,
  submitted_at timestamptz not null default now()
);

create table if not exists public.risk_events (
  id text primary key default gen_random_uuid()::text,
  work_report_id text not null references public.work_reports(id) on delete cascade,
  rule_code text not null,
  description text not null,
  points integer not null default 20,
  created_at timestamptz not null default now()
);

create table if not exists public.user_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision not null default 10,
  recorded_at timestamptz not null default now()
);

create table if not exists public.risk_configs (
  company_id uuid primary key references public.companies(id) on delete cascade,
  short_duration_critical_minutes integer not null default 15,
  short_duration_warning_minutes integer not null default 30,
  location_drift_threshold_meters integer not null default 200,
  points_check_in_outside integer not null default 30,
  points_check_out_outside integer not null default 25,
  points_progress_outside integer not null default 15,
  points_short_duration_critical integer not null default 40,
  points_short_duration_warning integer not null default 20,
  points_location_drift integer not null default 20,
  points_no_progress_photos integer not null default 25,
  threshold_low_max integer not null default 19,
  threshold_medium_max integer not null default 49,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  action text not null,
  actor text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

-- 2. SEED PERUSAHAAN & PENGGUNA 2-ROLE (PT GUCI EMAS PRATAMA)
insert into public.companies (id, name, code, status, address, phone, email)
values (
  '11111111-1111-1111-1111-111111111101',
  'PT Guci Emas Pratama',
  'GUCI-EMAS',
  'ACTIVE',
  'Jl. Kesehatan Raya No. 28, Bintaro, Jakarta Selatan',
  '021-73889012',
  'operasional@gucimaspratama.co.id'
) on conflict (id) do update set status = 'ACTIVE';

insert into public.users (id, company_id, name, email, role, phone, nip, is_active)
values
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 'Rina Kusuma (Admin Operasional)', 'admin@gucimaspratama.co.id', 'ADMIN', '08119001102', 'GM-ADM-002', true),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111101', 'Agung Pratama', 'teknisi@gucimaspratama.co.id', 'TEKNISI_LAPANGAN', '081288001104', 'GM-TEK-004', true),
  ('22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111101', 'Dedi Kurniawan', 'dedi.teknisi@gucimaspratama.co.id', 'TEKNISI_LAPANGAN', '081288001106', 'GM-TEK-006', true)
on conflict (id) do update set is_active = true;

-- 3. SEED 9 PROYEK LINTAS HORIZON TANGGAL (HARI INI, BESOK, KEMARIN, ARSIP)
insert into public.projects (
  id, company_id, project_name, client_name, address, latitude, longitude, radius,
  service_type, contract_type, pest_types, treatment_types, chemical_used,
  work_date, scheduled_start_time, warranty_months, next_service_date, assigned_executor_id
) values
  -- HARI INI (3 Tugas)
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111101', 'Inspeksi & Injeksi Anti Rayap Gedung PLN Bulungan', 'PT PLN (Persero) UP3 Bulungan', 'Jl. Sisingamangaraja No. 1, Kebayoran Baru, Jakarta Selatan', -6.241580, 106.798250, 120, 'TERMITE_CONTROL', 'WARRANTY', array['Rayap Tanah (Coptotermes)'], array['Soil Injection', 'Wood Treatment'], 'Premise 200 SL', current_date, '08:30', 36, current_date + 14, '22222222-2222-2222-2222-222222222204'),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111101', 'General Pest Control & Rodent Baiting Menara Mandiri', 'PT Bank Mandiri (Persero) Tbk — Area Sudirman', 'Jl. Jend. Sudirman Kav. 54-55, Senayan, Jakarta Selatan', -6.224600, 106.809100, 150, 'GENERAL_PEST_CONTROL', 'CONTRACT', array['Kecoa Jerman', 'Tikus Atap', 'Nyamuk'], array['Residual Spraying', 'Gel Baiting', 'Rodent Bait Station'], 'Cypergard 250 EC & Racumin Wax', current_date, '13:30', 12, current_date + 14, '22222222-2222-2222-2222-222222222204'),
  ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111101', 'Sterilisasi Vektor & Pest Control RS Medika BSD', 'RS Medika BSD Tangerang Selatan', 'Jl. Letnan Sutopo Kav. Komersial IIIA No. 7, BSD City, Tangerang Selatan', -6.298400, 106.669800, 150, 'GENERAL_PEST_CONTROL', 'CONTRACT', array['Lalat', 'Kecoa', 'Semut'], array['Cold Fogging ULV', 'Gel Baiting'], 'K-Othrine 20 EW', current_date, '16:00', 12, current_date + 14, '22222222-2222-2222-2222-222222222204'),
  -- BESOK (2 Tugas)
  ('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111101', 'Pest Control Gudang Logistik & Dapur PT Oreka Solusi', 'PT Oreka Solusi Kreatif', 'Jl. RC Veteran Raya No. 18, Bintaro, Pesanggrahan, Jakarta Selatan', -6.271200, 106.764100, 100, 'GENERAL_PEST_CONTROL', 'CONTRACT', array['Tikus Got', 'Kecoa Amerika', 'Nyamuk Aedes'], array['Residual Spraying', 'Thermal Fogging', 'Rodent Control'], 'Icon 25 EC & Klerat Wax Block', current_date + 1, '09:00', 12, current_date + 15, '22222222-2222-2222-2222-222222222204'),
  ('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111101', 'Monitoring Baiting Anti Rayap Hotel Santika Premiere', 'Hotel Santika Premiere Bintaro', 'Jl. Prof. Dr. Satrio Blok B7/A3-01, CBD Bintaro Jaya, Tangerang Selatan', -6.276800, 106.724500, 120, 'TERMITE_CONTROL', 'WARRANTY', array['Rayap Tanah', 'Rayap Kayu Kering'], array['Termite Baiting Inspection', 'Spot Spraying'], 'Agenda 25 EC', current_date + 1, '14:00', 36, current_date + 30, '22222222-2222-2222-2222-222222222204'),
  -- KEMARIN (2 Tugas)
  ('33333333-3333-3333-3333-333333333306', '11111111-1111-1111-1111-111111111101', 'Treatment Anti Rayap & Barrier Bank Victoria Fatmawati', 'PT Bank Victoria International Tbk — KCP Fatmawati', 'Jl. RS Fatmawati Raya No. 39, Cilandak, Jakarta Selatan', -6.284500, 106.796400, 100, 'TERMITE_CONTROL', 'WARRANTY', array['Rayap Tanah (Coptotermes)'], array['Drilling & Injection', 'Perimeter Soil Barrier'], 'Premise 200 SL', current_date - 1, '09:00', 36, current_date + 29, '22222222-2222-2222-2222-222222222204'),
  ('33333333-3333-3333-3333-333333333307', '11111111-1111-1111-1111-111111111101', 'Inspeksi Hama Gudang Tepung PT Indofood CBP', 'PT Indofood CBP Sukses Makmur Tbk', 'Jl. Raya Cakung Cilincing KM 3.5, Semper Timur, Jakarta Utara', -6.142200, 106.924500, 100, 'GENERAL_PEST_CONTROL', 'CONTRACT', array['Kumbang Tepung', 'Tikus', 'Kecoa'], array['Misting', 'Pheromone Trap', 'Rodent Baiting'], 'Actellic 500 EC', current_date - 1, '13:30', 12, current_date + 13, '22222222-2222-2222-2222-222222222204'),
  -- ARSIP (< Kemarin: -5 hari & -12 hari)
  ('33333333-3333-3333-3333-333333333308', '11111111-1111-1111-1111-111111111101', 'General Pest Control Gedung Arsip BCA Serpong', 'PT Bank Central Asia Tbk — KCU Serpong', 'Jl. Raya Serpong KM 8, Pakulonan, Serpong Utara, Tangerang Selatan', -6.245100, 106.651200, 120, 'GENERAL_PEST_CONTROL', 'CONTRACT', array['Kecoa', 'Semut', 'Gegat (Silverfish)'], array['Residual Spraying', 'Gel Baiting'], 'Tenopa 60 SC', current_date - 5, '09:00', 12, current_date + 25, '22222222-2222-2222-2222-222222222204'),
  ('33333333-3333-3333-3333-333333333309', '11111111-1111-1111-1111-111111111101', 'Injeksi Anti Rayap Pondasi Apartemen Emerald Bintaro', 'PPPSRS Apartemen Emerald Bintaro', 'Jl. Jombang Raya, Parigi, Pondok Aren, Tangerang Selatan', -6.279900, 106.701100, 150, 'TERMITE_CONTROL', 'WARRANTY', array['Rayap Tanah (Macrotermes)'], array['Soil Injection', 'Trenching'], 'Premise 200 SL', current_date - 12, '08:30', 60, current_date + 18, '22222222-2222-2222-2222-222222222204')
on conflict (id) do update set
  work_date = excluded.work_date,
  scheduled_start_time = excluded.scheduled_start_time;
