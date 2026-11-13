import { supabase } from '@/shared/lib/supabase';
import { useAuthStore } from '@/app/store/authStore';
import { calculateDistanceMeters, isWithinRadius } from '@/shared/utils/geo';
import {
  getLocalRealisticProjects,
  getLocalRealisticReports,
  mergeWithRealisticReports,
  saveLocalRealisticProjects,
  saveLocalRealisticReports,
} from '@/shared/data/realisticFieldworkSeed';
import {
  ApplicationMethod,
  ContractType,
  DocumentationPhoto,
  PhotoTag,
  PhotoType,
  RiskEvent,
  RiskLevel,
  ServiceType,
  TreatmentRecord,
  WorkReport,
  WorkReportStatus,
} from '@/entities/types';

export interface EvidencePayload {
  photoBlob: Blob;
  capturedAt?: string;
  offlineReplay?: boolean;
  latitude: number;
  longitude: number;
  accuracy: number;
  notes?: string;
  photoTag?: PhotoTag;
  customerName?: string;
  customerPhone?: string;
  customerFeedback?: string;
  customerSignature?: string;
}

export interface TeamMemberEntry {
  id?: string;
  name: string;
  role?: string;
  isManual?: boolean;
}

export interface TreatmentInput {
  applicationMethod: ApplicationMethod;
  chemicalName: string;
  teamMembers?: TeamMemberEntry[];
  activeIngredient?: string;
  dosage: string;
  treatmentAreaSqm?: number;
  drillingPointsCount?: number;
  fumigantType?: string;
  gasConcentrationPpm?: number;
  sealingStartedAt?: string;
  aerationCompletedAt?: string;
  safetyNotes?: string;
  technicianNotes?: string;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function updateLocalReportItem(updated: WorkReport): WorkReport {
  const list = getLocalRealisticReports();
  const exists = list.some(r => r.id === updated.id);
  const next = exists ? list.map(r => (r.id === updated.id ? updated : r)) : [updated, ...list];
  saveLocalRealisticReports(next);
  return updated;
}

export function mapDbWorkReportFull(row: any): WorkReport {
  const proj = row.projects || {};
  const exec = row.users || {};
  const trRaw = Array.isArray(row.treatment_records) ? row.treatment_records[0] : row.treatment_records;
  const photosRaw: any[] = Array.isArray(row.documentation_photos) ? row.documentation_photos : [];
  const eventsRaw: any[] = Array.isArray(row.risk_events) ? row.risk_events : [];

  const treatmentRecord: TreatmentRecord | null = trRaw
    ? {
        applicationMethod: trRaw.application_method as ApplicationMethod,
        chemicalName: trRaw.chemical_name,
        activeIngredient: trRaw.active_ingredient ?? null,
        dosage: trRaw.dosage,
        treatmentAreaSqm: trRaw.treatment_area_sqm != null ? Number(trRaw.treatment_area_sqm) : null,
        drillingPointsCount: trRaw.drilling_points_count != null ? Number(trRaw.drilling_points_count) : null,
        fumigantType: trRaw.fumigant_type ?? null,
        gasConcentrationPpm: trRaw.gas_concentration_ppm != null ? Number(trRaw.gas_concentration_ppm) : null,
        sealingStartedAt: trRaw.sealing_started_at ?? null,
        aerationCompletedAt: trRaw.aeration_completed_at ?? null,
        safetyNotes: trRaw.safety_notes ?? null,
        technicianNotes: trRaw.technician_notes ?? null,
      }
    : null;

  const photos: DocumentationPhoto[] = photosRaw
    .filter(p => !p.purged_at)
    .map(p => ({
      id: p.id,
      photoType: p.photo_type as PhotoType,
      photoTag: (p.photo_tag as PhotoTag) ?? null,
      latitude: Number(p.latitude ?? 0),
      longitude: Number(p.longitude ?? 0),
      accuracy: Number(p.accuracy ?? 0),
      distanceToProject: Number(p.distance_to_project ?? 0),
      isWithinRadius: Boolean(p.is_within_radius),
      capturedAt: p.captured_at || p.created_at,
      metadata: p.metadata || {},
      purgedAt: p.purged_at ?? null,
      url:
        typeof p.storage_path === 'string' && p.storage_path.startsWith('data:')
          ? p.storage_path
          : `/api/photos/${p.id}/file`,
    }));

  const riskEvents: RiskEvent[] = eventsRaw.map(ev => ({
    id: ev.id,
    eventType: ev.event_type,
    points: Number(ev.points ?? 0),
    severity: (ev.severity || 'LOW') as RiskEvent['severity'],
    title: ev.title || '',
    description: ev.description || '',
    expectedValue: ev.expected_value ?? null,
    actualValue: ev.actual_value ?? null,
    createdAt: ev.created_at,
  }));

  return {
    id: row.id,
    projectId: row.project_id,
    projectName: proj.project_name || 'Proyek Lapangan',
    clientName: proj.client_name || row.customer_name || '',
    projectAddress: proj.address || '',
    projectLatitude: Number(proj.latitude ?? 0),
    projectLongitude: Number(proj.longitude ?? 0),
    projectRadius: Number(proj.radius ?? 100),
    scheduledStartTime: typeof proj.scheduled_start_time === 'string' ? proj.scheduled_start_time.slice(0, 5) : '08:00',
    serviceType: (proj.service_type || 'GENERAL_PEST_CONTROL') as ServiceType,
    focusTarget: proj.focus_target ?? null,
    targetFocus: Array.isArray(proj.target_focus) ? proj.target_focus : [],
    buildingAreaSqm: proj.building_area_sqm != null ? Number(proj.building_area_sqm) : null,
    contractType: (proj.contract_type || 'ONE_TIME') as ContractType,
    warrantyMonths: Number(proj.warranty_months ?? 0),
    nextServiceDate: proj.work_date || proj.next_service_date || null,
    executorId: row.executor_id || '',
    executorName: exec.name || 'Budi Santoso',
    executorEmail: exec.email || 'teknisi@gucimaspratama.co.id',
    status: (row.status || 'READY') as WorkReportStatus,
    checkInAt: row.check_in_at ?? null,
    checkInLatitude: row.check_in_latitude != null ? Number(row.check_in_latitude) : null,
    checkInLongitude: row.check_in_longitude != null ? Number(row.check_in_longitude) : null,
    checkInAccuracy: row.check_in_accuracy != null ? Number(row.check_in_accuracy) : null,
    checkInDistance: row.check_in_distance != null ? Number(row.check_in_distance) : null,
    checkInValid: row.check_in_valid ?? null,
    checkOutAt: row.check_out_at ?? null,
    checkOutLatitude: row.check_out_latitude != null ? Number(row.check_out_latitude) : null,
    checkOutLongitude: row.check_out_longitude != null ? Number(row.check_out_longitude) : null,
    checkOutAccuracy: row.check_out_accuracy != null ? Number(row.check_out_accuracy) : null,
    checkOutDistance: row.check_out_distance != null ? Number(row.check_out_distance) : null,
    checkOutValid: row.check_out_valid ?? null,
    durationSeconds: row.duration_seconds != null ? Number(row.duration_seconds) : null,
    riskScore: Number(row.risk_score ?? 0),
    riskLevel: (row.risk_level || 'NORMAL') as RiskLevel,
    riskEvents,
    treatmentRecord,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ?? null,
    reviewNotes: row.review_notes ?? null,
    customerName: row.customer_name ?? null,
    customerPhone: row.customer_phone ?? null,
    customerFeedback: row.customer_feedback ?? null,
    customerSignature: row.customer_signature ?? null,
    notes: row.notes ?? null,
    teamMembers: Array.isArray(row.team_members) ? row.team_members : [],
    photos,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

const REPORT_SELECT_FULL = `
  *,
  projects(*),
  users!work_reports_executor_id_fkey(id, name, email),
  treatment_records(*),
  documentation_photos(*),
  risk_events(*)
`;

export async function fetchMyWorkReports(): Promise<WorkReport[]> {
  try {
    const st = useAuthStore.getState();
    const uid = st.user?.uid;
    const companyId = st.user?.companyId;

    let q = supabase
      .from('work_reports')
      .select(REPORT_SELECT_FULL)
      .order('created_at', { ascending: false });

    if (companyId) {
      q = q.eq('company_id', companyId);
    }
    const { data, error } = await q;
    if (!error && data && data.length > 0) {
      const all = data.map(mapDbWorkReportFull);
      const mine = uid ? all.filter(r => r.executorId === uid) : all;
      const base = mine.length > 0 ? mine : all;
      return mergeWithRealisticReports(base);
    }
  } catch {
    // Fallback to realistic store
  }
  return getLocalRealisticReports();
}

export async function fetchWorkReport(id: string): Promise<WorkReport> {
  try {
    const { data, error } = await supabase
      .from('work_reports')
      .select(REPORT_SELECT_FULL)
      .eq('id', id)
      .single();

    if (!error && data) {
      const mapped = mapDbWorkReportFull(data);
      return updateLocalReportItem(mapped);
    }
  } catch {
    // Fallback to local realistic report
  }

  const localFound = getLocalRealisticReports().find(r => r.id === id);
  if (localFound) return localFound;
  throw new Error('Laporan kerja tidak ditemukan.');
}

export async function checkIn(reportId: string, evidence: EvidencePayload): Promise<WorkReport> {
  const current = await fetchWorkReport(reportId);

  // Periksa apakah proyek sudah memiliki titik jangkar koordinat valid
  const hasProjectAnchor = Boolean(
    current.projectLatitude &&
    current.projectLongitude &&
    !(current.projectLatitude === 0 && current.projectLongitude === 0)
  );

  let dist = 0;
  let valid = true;

  if (hasProjectAnchor) {
    dist = Math.round(
      calculateDistanceMeters(evidence.latitude, evidence.longitude, current.projectLatitude, current.projectLongitude)
    );
    valid = isWithinRadius(
      evidence.latitude,
      evidence.longitude,
      current.projectLatitude,
      current.projectLongitude,
      current.projectRadius,
      evidence.accuracy
    );
  } else {
    dist = 0;
    valid = true;
    if (current.projectId) {
      try {
        await supabase
          .from('projects')
          .update({
            latitude: evidence.latitude,
            longitude: evidence.longitude,
            updated_at: new Date().toISOString(),
          })
          .eq('id', current.projectId);
      } catch {
        // ignore if offline/demo
      }
      const projs = getLocalRealisticProjects();
      saveLocalRealisticProjects(
        projs.map(p =>
          p.id === current.projectId ? { ...p, latitude: evidence.latitude, longitude: evidence.longitude } : p
        )
      );
    }
  }

  const nowIso = evidence.capturedAt || new Date().toISOString();
  const dataUrl = await blobToDataUrl(evidence.photoBlob);

  try {
    const { error: upErr } = await supabase
      .from('work_reports')
      .update({
        status: 'WORKING',
        check_in_at: current.checkInAt || nowIso,
        check_in_latitude: evidence.latitude,
        check_in_longitude: evidence.longitude,
        check_in_accuracy: evidence.accuracy,
        check_in_distance: dist,
        check_in_valid: valid,
        notes: evidence.notes || current.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    if (!upErr) {
      const existingCheckInPhotos = current.photos.filter(p => p.photoType === 'CHECK_IN');
      if (existingCheckInPhotos.length > 0) {
        const primaryCinId = existingCheckInPhotos[0].id;
        await supabase
          .from('documentation_photos')
          .update({
            storage_path: dataUrl,
            latitude: evidence.latitude,
            longitude: evidence.longitude,
            accuracy: evidence.accuracy,
            distance_to_project: dist,
            is_within_radius: valid,
            captured_at: nowIso,
            metadata: { projectName: current.projectName, executorName: current.executorName },
          })
          .eq('id', primaryCinId);
      } else {
        await supabase.from('documentation_photos').insert({
          work_report_id: reportId,
          photo_type: 'CHECK_IN',
          photo_tag: evidence.photoTag ?? null,
          storage_path: dataUrl,
          latitude: evidence.latitude,
          longitude: evidence.longitude,
          accuracy: evidence.accuracy,
          distance_to_project: dist,
          is_within_radius: valid,
          captured_at: nowIso,
          metadata: { projectName: current.projectName, executorName: current.executorName },
        });
      }
    }
  } catch {
    // Fallback to local state update below
  }

  const newPhoto: DocumentationPhoto = {
    id: `ph-cin-${Date.now()}`,
    photoType: 'CHECK_IN',
    photoTag: evidence.photoTag ?? null,
    latitude: evidence.latitude,
    longitude: evidence.longitude,
    accuracy: evidence.accuracy,
    distanceToProject: dist,
    isWithinRadius: valid,
    capturedAt: nowIso,
    metadata: { projectName: current.projectName, executorName: current.executorName },
    purgedAt: null,
    url: dataUrl,
  };

  const updatedLocal: WorkReport = {
    ...current,
    status: 'WORKING',
    projectLatitude: hasProjectAnchor ? current.projectLatitude : evidence.latitude,
    projectLongitude: hasProjectAnchor ? current.projectLongitude : evidence.longitude,
    checkInAt: current.checkInAt || nowIso,
    checkInLatitude: evidence.latitude,
    checkInLongitude: evidence.longitude,
    checkInAccuracy: evidence.accuracy,
    checkInDistance: dist,
    checkInValid: valid,
    notes: evidence.notes || current.notes,
    photos: [...current.photos.filter(p => p.photoType !== 'CHECK_IN'), newPhoto],
    updatedAt: nowIso,
  };
  return updateLocalReportItem(updatedLocal);
}

export async function addProgressPhoto(reportId: string, evidence: EvidencePayload): Promise<WorkReport> {
  const current = await fetchWorkReport(reportId);
  const hasAnchor = Boolean(
    current.projectLatitude &&
    current.projectLongitude &&
    !(current.projectLatitude === 0 && current.projectLongitude === 0)
  );
  const targetLat = hasAnchor ? current.projectLatitude : (current.checkInLatitude ?? evidence.latitude);
  const targetLng = hasAnchor ? current.projectLongitude : (current.checkInLongitude ?? evidence.longitude);

  const dist = Math.round(
    calculateDistanceMeters(evidence.latitude, evidence.longitude, targetLat, targetLng)
  );
  const valid = isWithinRadius(
    evidence.latitude,
    evidence.longitude,
    targetLat,
    targetLng,
    current.projectRadius,
    evidence.accuracy
  );
  const nowIso = evidence.capturedAt || new Date().toISOString();
  const dataUrl = await blobToDataUrl(evidence.photoBlob);

  try {
    await supabase.from('documentation_photos').insert({
      work_report_id: reportId,
      photo_type: 'PROGRESS',
      photo_tag: evidence.photoTag ?? 'BEFORE',
      storage_path: dataUrl,
      latitude: evidence.latitude,
      longitude: evidence.longitude,
      accuracy: evidence.accuracy,
      distance_to_project: dist,
      is_within_radius: valid,
      captured_at: nowIso,
      metadata: { projectName: current.projectName, executorName: current.executorName, caption: evidence.notes ?? null },
    });
  } catch {
    // Fallback to local state update below
  }

  const newPhoto: DocumentationPhoto = {
    id: `ph-prog-${Date.now()}`,
    photoType: 'PROGRESS',
    photoTag: evidence.photoTag ?? 'BEFORE',
    latitude: evidence.latitude,
    longitude: evidence.longitude,
    accuracy: evidence.accuracy,
    distanceToProject: dist,
    isWithinRadius: valid,
    capturedAt: nowIso,
    metadata: { projectName: current.projectName, executorName: current.executorName, caption: evidence.notes ?? null },
    purgedAt: null,
    url: dataUrl,
  };

  return updateLocalReportItem({
    ...current,
    photos: [...current.photos, newPhoto],
    updatedAt: nowIso,
  });
}

export async function checkOut(reportId: string, evidence: EvidencePayload): Promise<WorkReport> {
  const current = await fetchWorkReport(reportId);
  const hasAnchor = Boolean(
    current.projectLatitude &&
    current.projectLongitude &&
    !(current.projectLatitude === 0 && current.projectLongitude === 0)
  );
  const targetLat = hasAnchor ? current.projectLatitude : (current.checkInLatitude ?? evidence.latitude);
  const targetLng = hasAnchor ? current.projectLongitude : (current.checkInLongitude ?? evidence.longitude);

  const dist = Math.round(
    calculateDistanceMeters(evidence.latitude, evidence.longitude, targetLat, targetLng)
  );
  const valid = isWithinRadius(
    evidence.latitude,
    evidence.longitude,
    targetLat,
    targetLng,
    current.projectRadius,
    evidence.accuracy
  );
  const nowIso = evidence.capturedAt || new Date().toISOString();
  const checkInMs = current.checkInAt ? new Date(current.checkInAt).getTime() : Date.now() - 3600_000;
  const durationSeconds = Math.max(60, Math.round((new Date(nowIso).getTime() - checkInMs) / 1000));
  const dataUrl = await blobToDataUrl(evidence.photoBlob);

  let riskScore = current.riskScore || 0;
  if (current.checkInValid === false) riskScore = Math.max(riskScore, 30);
  if (!valid) riskScore += 30;
  if (!current.treatmentRecord) riskScore += 20;
  const riskLevel: RiskLevel =
    riskScore >= 60 ? 'HIGH_RISK' : riskScore >= 40 ? 'REVIEW' : riskScore >= 20 ? 'LOW_RISK' : 'NORMAL';
  const nextStatus: WorkReportStatus = riskScore >= 40 ? 'FLAGGED' : 'COMPLETED';

  try {
    await supabase.from('documentation_photos').insert({
      work_report_id: reportId,
      photo_type: 'CHECK_OUT',
      photo_tag: evidence.photoTag ?? 'AFTER',
      storage_path: dataUrl,
      latitude: evidence.latitude,
      longitude: evidence.longitude,
      accuracy: evidence.accuracy,
      distance_to_project: dist,
      is_within_radius: valid,
      captured_at: nowIso,
      metadata: { projectName: current.projectName, executorName: current.executorName },
    });

    await supabase
      .from('work_reports')
      .update({
        status: nextStatus,
        check_out_at: nowIso,
        check_out_latitude: evidence.latitude,
        check_out_longitude: evidence.longitude,
        check_out_accuracy: evidence.accuracy,
        check_out_distance: dist,
        check_out_valid: valid,
        duration_seconds: durationSeconds,
        risk_score: riskScore,
        risk_level: riskLevel,
        customer_name: evidence.customerName ?? current.customerName,
        customer_phone: evidence.customerPhone ?? current.customerPhone,
        customer_feedback: evidence.customerFeedback ?? current.customerFeedback,
        customer_signature: evidence.customerSignature ?? current.customerSignature,
        notes: evidence.notes ?? current.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId);
  } catch {
    // Fallback to local state update below
  }

  const outPhoto: DocumentationPhoto = {
    id: `ph-cout-${Date.now()}`,
    photoType: 'CHECK_OUT',
    photoTag: evidence.photoTag ?? 'AFTER',
    latitude: evidence.latitude,
    longitude: evidence.longitude,
    accuracy: evidence.accuracy,
    distanceToProject: dist,
    isWithinRadius: valid,
    capturedAt: nowIso,
    metadata: { projectName: current.projectName, executorName: current.executorName },
    purgedAt: null,
    url: dataUrl,
  };

  return updateLocalReportItem({
    ...current,
    status: nextStatus,
    checkOutAt: nowIso,
    checkOutLatitude: evidence.latitude,
    checkOutLongitude: evidence.longitude,
    checkOutAccuracy: evidence.accuracy,
    checkOutDistance: dist,
    checkOutValid: valid,
    durationSeconds,
    riskScore,
    riskLevel,
    customerName: evidence.customerName ?? current.customerName,
    customerPhone: evidence.customerPhone ?? current.customerPhone,
    customerFeedback: evidence.customerFeedback ?? current.customerFeedback,
    customerSignature: evidence.customerSignature ?? current.customerSignature,
    notes: evidence.notes ?? current.notes,
    photos: [...current.photos, outPhoto],
    updatedAt: nowIso,
  });
}

export async function submitTreatment(reportId: string, input: TreatmentInput): Promise<WorkReport> {
  const current = await fetchWorkReport(reportId);
  const payload = {
    work_report_id: reportId,
    application_method: input.applicationMethod,
    chemical_name: input.chemicalName,
    active_ingredient: input.activeIngredient ?? null,
    dosage: input.dosage,
    treatment_area_sqm: input.treatmentAreaSqm ?? null,
    drilling_points_count: input.drillingPointsCount ?? null,
    fumigant_type: input.fumigantType ?? null,
    gas_concentration_ppm: input.gasConcentrationPpm ?? null,
    sealing_started_at: input.sealingStartedAt ?? null,
    aeration_completed_at: input.aerationCompletedAt ?? null,
    safety_notes: input.safetyNotes ?? null,
    technician_notes: input.technicianNotes ?? null,
    updated_at: new Date().toISOString(),
  };

  try {
    await supabase.from('treatment_records').upsert(payload, { onConflict: 'work_report_id' });
    if (input.teamMembers) {
      await supabase
        .from('work_reports')
        .update({ team_members: input.teamMembers, updated_at: new Date().toISOString() })
        .eq('id', reportId);
    }
  } catch {
    // Fallback to local state update below
  }

  const trRecord: TreatmentRecord = {
    applicationMethod: input.applicationMethod,
    chemicalName: input.chemicalName,
    activeIngredient: input.activeIngredient ?? null,
    dosage: input.dosage,
    treatmentAreaSqm: input.treatmentAreaSqm ?? null,
    drillingPointsCount: input.drillingPointsCount ?? null,
    fumigantType: input.fumigantType ?? null,
    gasConcentrationPpm: input.gasConcentrationPpm ?? null,
    sealingStartedAt: input.sealingStartedAt ?? null,
    aerationCompletedAt: input.aerationCompletedAt ?? null,
    safetyNotes: input.safetyNotes ?? null,
    technicianNotes: input.technicianNotes ?? null,
  };

  return updateLocalReportItem({
    ...current,
    treatmentRecord: trRecord,
    teamMembers: input.teamMembers ?? current.teamMembers,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateWorkReportTeam(reportId: string, teamMembers: TeamMemberEntry[]): Promise<WorkReport> {
  const current = await fetchWorkReport(reportId);
  try {
    await supabase
      .from('work_reports')
      .update({ team_members: teamMembers, updated_at: new Date().toISOString() })
      .eq('id', reportId);
  } catch {
    // ignore if offline
  }
  return updateLocalReportItem({
    ...current,
    teamMembers,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Menyimpan laporan kendala lapangan teknisi langsung ke database (risk_events + work_reports)
 * sehingga terikat penuh dengan database dan otomatis muncul di antrean "Perlu tindakan" & "Hasil & Verifikasi" Admin.
 */
export async function reportFieldIssueToDb(
  reportId: string,
  issueType: string,
  note: string
): Promise<WorkReport> {
  const current = await fetchWorkReport(reportId);
  const nowIso = new Date().toISOString();
  const nextScore = Math.max(45, (current.riskScore || 0) + 25);
  const issueNoteLine = `[KENDALA LAPANGAN: ${issueType} — ${note.trim() || 'Membutuhkan tindak lanjut Admin'}]`;
  const mergedNotes = current.notes ? `${issueNoteLine} ${current.notes}` : issueNoteLine;

  const newEvent: RiskEvent = {
    id: `re-issue-${Date.now()}`,
    eventType: 'FIELD_ISSUE',
    points: 25,
    severity: 'HIGH',
    title: `Kendala Lapangan: ${issueType}`,
    description: note.trim() || 'Dilaporkan langsung oleh teknisi dari lokasi proyek.',
    expectedValue: 'Operasional Normal',
    actualValue: issueType,
    createdAt: nowIso,
  };

  try {
    await supabase.from('risk_events').insert({
      work_report_id: reportId,
      event_type: 'FIELD_ISSUE',
      points: 25,
      severity: 'HIGH',
      title: newEvent.title,
      description: newEvent.description,
      expected_value: newEvent.expectedValue,
      actual_value: newEvent.actualValue,
      created_at: nowIso,
    });

    await supabase
      .from('work_reports')
      .update({
        status: 'FLAGGED',
        risk_score: nextScore,
        risk_level: 'MEDIUM',
        notes: mergedNotes,
        updated_at: nowIso,
      })
      .eq('id', reportId);
  } catch {
    // Fallback to local state update below
  }

  return updateLocalReportItem({
    ...current,
    status: 'FLAGGED',
    riskScore: nextScore,
    riskLevel: 'MEDIUM',
    notes: mergedNotes,
    riskEvents: [newEvent, ...(current.riskEvents || [])],
    updatedAt: nowIso,
  });
}

export type { TreatmentRecord };
