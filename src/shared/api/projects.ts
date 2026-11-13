import { supabase } from '@/shared/lib/supabase';
import { useAuthStore } from '@/app/store/authStore';
import { ContractType, Project, ServiceType, WorkReport } from '@/entities/types';
import {
  DEMO_TEKNISI_ID,
  getLocalRealisticProjects,
  getLocalRealisticReports,
  mergeWithRealisticProjects,
  saveLocalRealisticProjects,
  saveLocalRealisticReports,
} from '@/shared/data/realisticFieldworkSeed';

export interface CreateProjectInput {
  projectName: string;
  clientName?: string;
  address: string;
  latitude: number;
  longitude: number;
  radius?: number;
  workDate: string;
  workType?: string;
  serviceType: ServiceType;
  targetFocus?: string[];
  focusTarget?: string;
  buildingAreaSqm?: number;
  contractType: ContractType;
  warrantyMonths: number;
  nextServiceDate?: string;
  scheduledStartTime?: string;
  notes?: string;
}

function toLocalYmd(input?: string | Date | null): string {
  if (!input) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function resolveActiveCompanyId(): string | null {
  const st = useAuthStore.getState();
  if (st.user?.role === 'MASTER_SUPER_ADMIN' || st.user?.role === 'SUPERADMIN') {
    return st.activeCompanyId || st.user.companyId || null;
  }
  return st.user?.companyId || null;
}

export function mapDbProject(row: any): Project {
  const rawWorkDate =
    (typeof row.work_date === 'string' && row.work_date.trim() ? row.work_date.slice(0, 10) : null) ||
    (typeof row.next_service_date === 'string' && row.next_service_date.trim() ? row.next_service_date.slice(0, 10) : null) ||
    toLocalYmd(row.created_at);

  return {
    id: row.id,
    projectName: row.project_name || '',
    clientName: row.client_name || '',
    address: row.address || '',
    latitude: Number(row.latitude ?? 0),
    longitude: Number(row.longitude ?? 0),
    radius: Number(row.radius ?? 100),
    workDate: rawWorkDate,
    workType: row.work_type || '',
    serviceType: (row.service_type || 'GENERAL_PEST_CONTROL') as ServiceType,
    focusTarget: row.focus_target ?? null,
    targetFocus: Array.isArray(row.target_focus) ? row.target_focus : [],
    buildingAreaSqm: row.building_area_sqm != null ? Number(row.building_area_sqm) : null,
    contractType: (row.contract_type || 'ONE_TIME') as ContractType,
    warrantyMonths: Number(row.warranty_months ?? 0),
    nextServiceDate: row.next_service_date ?? null,
    scheduledStartTime: typeof row.scheduled_start_time === 'string' ? row.scheduled_start_time.slice(0, 5) : '08:00',
    notes: row.notes ?? null,
    createdBy: row.created_by || '',
    createdByName: row.users?.name ?? undefined,
    createdAt: row.created_at || new Date().toISOString(),
    lockedAt: row.locked_at ?? null,
  };
}

export async function createProject(input: CreateProjectInput): Promise<{ project: Project; workReportId: string }> {
  const st = useAuthStore.getState();
  const companyId = resolveActiveCompanyId();
  const effectiveWorkDate = input.workDate || toLocalYmd(new Date());

  try {
    if (companyId && st.user) {
      const { data: projRow, error: projErr } = await supabase
        .from('projects')
        .insert({
          company_id: companyId,
          project_name: input.projectName,
          client_name: input.clientName || null,
          address: input.address,
          latitude: input.latitude,
          longitude: input.longitude,
          radius: input.radius ?? 100,
          work_date: effectiveWorkDate,
          work_type: input.workType || null,
          service_type: input.serviceType,
          focus_target: input.focusTarget || null,
          target_focus: input.targetFocus || [],
          building_area_sqm: input.buildingAreaSqm ?? null,
          contract_type: input.contractType,
          warrantyMonths: input.warrantyMonths,
          warranty_months: input.warrantyMonths,
          next_service_date: input.nextServiceDate || effectiveWorkDate,
          scheduled_start_time: input.scheduledStartTime || '08:00',
          notes: input.notes || null,
          created_by: st.user.uid,
        })
        .select('*')
        .single();

      if (!projErr && projRow) {
        const { data: wrRow } = await supabase
          .from('work_reports')
          .insert({
            company_id: companyId,
            project_id: projRow.id,
            executor_id: st.user.uid,
            status: 'READY',
            risk_score: 0,
            risk_level: 'NORMAL',
            work_notes: input.notes || null,
          })
          .select('id')
          .single();

        const mappedProj = mapDbProject(projRow);
        const wrId = wrRow?.id || `wr-${Date.now()}`;
        syncNewProjectToLocalStore(mappedProj, wrId, st.user?.uid, st.user?.name, st.user?.email);
        return { project: mappedProj, workReportId: wrId };
      }
    }
  } catch {
    // Fallback to local store below if Supabase connection/schema is offline
  }

  const fallbackProj: Project = {
    id: `proj-${Date.now()}`,
    projectName: input.projectName,
    clientName: input.clientName || '',
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    radius: input.radius ?? 100,
    workDate: effectiveWorkDate,
    workType: input.workType || '',
    serviceType: input.serviceType,
    focusTarget: input.focusTarget ?? null,
    targetFocus: input.targetFocus ?? [],
    buildingAreaSqm: input.buildingAreaSqm ?? null,
    contractType: input.contractType,
    warrantyMonths: input.warrantyMonths,
    nextServiceDate: input.nextServiceDate || effectiveWorkDate,
    scheduledStartTime: input.scheduledStartTime || '08:00',
    notes: input.notes ?? null,
    createdBy: st.user?.uid || DEMO_TEKNISI_ID,
    createdByName: st.user?.name || 'Budi Santoso',
    createdAt: new Date().toISOString(),
    lockedAt: null,
  };
  const fallbackWrId = `wr-${Date.now()}`;
  syncNewProjectToLocalStore(fallbackProj, fallbackWrId, st.user?.uid, st.user?.name, st.user?.email);

  return { project: fallbackProj, workReportId: fallbackWrId };
}

function syncNewProjectToLocalStore(
  proj: Project,
  wrId: string,
  uid?: string,
  userName?: string,
  userEmail?: string
) {
  const existingProjs = getLocalRealisticProjects();
  saveLocalRealisticProjects([proj, ...existingProjs.filter(p => p.id !== proj.id)]);

  const newReport: WorkReport = {
    id: wrId,
    projectId: proj.id,
    projectName: proj.projectName,
    clientName: proj.clientName,
    projectAddress: proj.address,
    projectLatitude: proj.latitude,
    projectLongitude: proj.longitude,
    projectRadius: proj.radius,
    scheduledStartTime: proj.scheduledStartTime,
    serviceType: proj.serviceType,
    focusTarget: proj.focusTarget ?? null,
    targetFocus: proj.targetFocus ?? [],
    buildingAreaSqm: proj.buildingAreaSqm ?? null,
    contractType: proj.contractType,
    warrantyMonths: proj.warrantyMonths,
    nextServiceDate: proj.workDate,
    executorId: uid || DEMO_TEKNISI_ID,
    executorName: userName || 'Budi Santoso',
    executorEmail: userEmail || 'teknisi@gucimaspratama.co.id',
    status: 'READY',
    checkInAt: null,
    checkInLatitude: null,
    checkInLongitude: null,
    checkInAccuracy: null,
    checkInDistance: null,
    checkInValid: null,
    checkOutAt: null,
    checkOutLatitude: null,
    checkOutLongitude: null,
    checkOutAccuracy: null,
    checkOutDistance: null,
    checkOutValid: null,
    durationSeconds: null,
    riskScore: 0,
    riskLevel: 'NORMAL',
    riskEvents: [],
    treatmentRecord: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    customerName: proj.clientName || null,
    customerPhone: null,
    customerFeedback: null,
    customerSignature: null,
    notes: proj.notes ?? null,
    teamMembers: [{ id: uid || DEMO_TEKNISI_ID, name: userName || 'Budi Santoso', role: 'Ketua Tim', isManual: false }],
    photos: [],
    createdAt: proj.createdAt,
    updatedAt: proj.createdAt,
  };
  const existingReps = getLocalRealisticReports();
  saveLocalRealisticReports([newReport, ...existingReps.filter(r => r.id !== wrId)]);
}

export async function fetchMyProjects(): Promise<Project[]> {
  try {
    const companyId = resolveActiveCompanyId();
    let q = supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(50);
    if (companyId) {
      q = q.eq('company_id', companyId);
    }
    const { data, error } = await q;
    if (!error && data) {
      const dbProjects = data.map(mapDbProject);
      return mergeWithRealisticProjects(dbProjects);
    }
  } catch {
    // Fallback to realistic store
  }
  return getLocalRealisticProjects();
}
