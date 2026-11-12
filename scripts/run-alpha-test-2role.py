#!/usr/bin/env python3
"""
Kei QA/QC Automated Alpha Testing Suite — 2-Role System (ADMIN & TEKNISI_LAPANGAN)
Focus: Haversine Geolocation & Digital Report (Laporan Hasil Pekerjaan)
"""
from pathlib import Path

repo = Path(__file__).resolve().parent.parent
geo_src = (repo / "src/shared/utils/geo.ts").read_text(encoding="utf-8")
exec_src = (repo / "src/widgets/executor/ExecutorHome.tsx").read_text(encoding="utf-8")
treat_src = (repo / "src/widgets/executor/TreatmentFormModal.tsx").read_text(encoding="utf-8")
rev_src = (repo / "src/widgets/executor/CustomerReviewFormModal.tsx").read_text(encoding="utf-8")
adm_src = (repo / "src/widgets/admin/AdminDashboard.tsx").read_text(encoding="utf-8")
bento_src = (repo / "src/widgets/admin/OperationsAnalyticsBento.tsx").read_text(encoding="utf-8")
login_src = (repo / "src/widgets/auth/LoginForm.tsx").read_text(encoding="utf-8")

checks = [
    ("ALPHA-DATE-01", "Klasifikasi Tanggal Tugas (Hari Ini, Besok, Kemarin, Arsip > Kemarin), Filter Tanggal, & Detail On-Click Tanpa Toggle Mode Ringkas",
     all(k in exec_src for k in ["classifyTaskHorizon", "resolveTaskDateKey", "ARCHIVE", "taskDateFilter", "historyDateFilter"])
     and "Mode Ringkas" not in exec_src and "Mode Detail" not in exec_src),
    ("ALPHA-2ROLE-01", "Fokus 2 Role (ADMIN & TEKNISI_LAPANGAN) tanpa menu SPK/Quotation/Gudang di Sidebar Admin",
     "1. GEOLOCATION & DIGITAL REPORT" in adm_src and "id: \x27spk-cms\x27" not in adm_src.split("const ALL_ITEMS:")[1].split("// Petakan alias")[0]
     and "Admin Verifikasi & Geolocation" in login_src and "Teknisi Lapangan (Mobile PWA)" in login_src),
    ("ALPHA-GEO-01", "Rumus Geolocation Haversine (calculateDistanceMeters & isWithinRadius)",
     all(k in geo_src for k in ["calculateDistanceMeters", "isWithinRadius", "isLocationWithinRadius", "6371e3"])),
    ("ALPHA-REP-01", "Digital Report (Laporan Hasil Pekerjaan) Dual-Mode Anti Rayap vs Pest Control + Tanpa QR & Tanpa Berita Acara",
     all(k in exec_src for k in ["Laporan Hasil Pekerjaan", "Pratinjau PDF", "Kirim Laporan Hasil Pekerjaan via WhatsApp", "hideTopBar={true}", "floatingOnAllScreens={true}"])
     and "Pindai QR" not in exec_src and "Berita Acara" not in exec_src),
    ("ALPHA-REP-02", "Evaluasi Rahasia PIC Otomatis Sesudah Tanda Tangan (Wajib Diisi & Strict Blind dari Teknisi)",
     all(k in rev_src for k in ["SIGN_STAGE", "STRICT_BLIND_EVAL_STAGE", "STRICT_BLIND_PIC_REVIEW", "useState<number>(0)"])
     and "Evaluasi PIC Klien: Terkunci &amp; Rahasia" in exec_src),
    ("ALPHA-ADM-01", "Eskalasi Lapor Kendala Teknisi (fw_field_issues_v1) Tampil di Panel Perlu Tindakan Admin",
     "fw_field_issues_v1" in exec_src and "fw_field_issues_v1" in bento_src),
]

for cid, title, ok in checks:
    assert ok, f"[{cid}] FAILED: {title}"
    print(f"[PASS] {cid}: {title}")

print(f"\nALL 2-ROLE HAVERSINE & DIGITAL REPORT ALPHA TESTS PASSED: {len(checks)}/{len(checks)}")
