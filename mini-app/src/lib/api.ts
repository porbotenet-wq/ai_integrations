/**
 * API Client — подключение к FastAPI backend
 * Заменяет прямые вызовы Supabase на наш API
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://164.90.238.236:8000';

let sessionToken: string | null = localStorage.getItem('sfera_token');

export function setToken(token: string) {
  sessionToken = token;
  localStorage.setItem('sfera_token', token);
}

export function clearToken() {
  sessionToken = null;
  localStorage.removeItem('sfera_token');
}

export function getToken() {
  return sessionToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json();
}

// ─── AUTH ────────────────────────────────────────────────

export interface AuthResult {
  user: {
    id: number;
    telegram_id: number;
    full_name: string;
    username: string | null;
    role: string;
    roles: string[];
  };
  token: string;
}

export async function authTelegram(initData: string): Promise<AuthResult> {
  return request('/api/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ init_data: initData }),
  });
}

// ─── PRODUCTION ─────────────────────────────────────────

export interface Crew {
  id: number;
  code: string;
  name: string;
  foreman: string | null;
  phone: string | null;
  specialization: string | null;
  max_workers: number;
  status: string;
}

export interface WorkType {
  id: number;
  code: string;
  name: string;
  unit: string;
  category: string | null;
  sequence_order: number;
  requires_inspection: boolean;
}

export interface ProductionDashboard {
  object_name: string;
  period: string;
  total_modules: number;
  fact_modules: number;
  pct_modules: number;
  total_brackets: number;
  fact_brackets: number;
  facades: Array<{
    facade: string;
    plan: number;
    fact: number;
    pct: number;
    status: string;
  }>;
  kpi: Array<{
    name: string;
    unit: string;
    plan: number;
    fact: number;
    pct: number;
    remaining: number;
  }>;
}

export interface FloorVolume {
  floor: number;
  facade: string;
  work_code: string;
  work_name: string;
  plan_qty: number;
  fact_qty: number;
  pct: number;
  status: string;
  inspection_brackets: string;
  inspection_floor: string;
}

export interface PlanFactRow {
  id: number;
  date: string;
  day_number: number | null;
  floor: number | null;
  facade: string | null;
  work_name: string | null;
  work_code: string | null;
  sequence_order: number | null;
  plan: number | null;
  fact: number | null;
  deviation: number | null;
  pct: number | null;
  crew_code: string | null;
  workers: number | null;
  productivity: number | null;
  inspection_status: string | null;
  cumulative_plan: number | null;
  cumulative_fact: number | null;
}

export interface DailyProgress {
  date: string;
  day_number: number | null;
  week_code: string | null;
  modules_plan: number;
  modules_fact: number;
  brackets_plan: number;
  brackets_fact: number;
  sealant_plan: number;
  sealant_fact: number;
  hermetic_plan: number;
  hermetic_fact: number;
}

export interface ProjectSummary {
  object: { id: number; name: string; status: string };
  total_plan: number;
  total_fact: number;
  total_pct: number;
  lagging_floors: Array<{
    floor: number;
    facade: string;
    plan: number;
    fact: number;
    pct: number;
  }>;
}

// Production API
export const api = {
  // Crews
  getCrews: (objectId?: number) =>
    request<Crew[]>(`/api/production/crews${objectId ? `?object_id=${objectId}` : ''}`),

  // Work types
  getWorkTypes: () =>
    request<WorkType[]>('/api/production/work-types'),

  // Dashboard
  getDashboard: (objectId: number) =>
    request<ProductionDashboard>(`/api/production/${objectId}/dashboard`),

  // Floor volumes
  getFloorVolumes: (objectId: number, params?: { floor?: number; facade?: string; work_code?: string }) => {
    const qs = new URLSearchParams();
    if (params?.floor) qs.set('floor', String(params.floor));
    if (params?.facade) qs.set('facade', params.facade);
    if (params?.work_code) qs.set('work_code', params.work_code);
    const q = qs.toString();
    return request<FloorVolume[]>(`/api/production/${objectId}/floor-volumes${q ? `?${q}` : ''}`);
  },

  // Plan-fact
  getPlanFact: (objectId: number, params?: { date_from?: string; date_to?: string; work_code?: string; crew_code?: string; floor?: number }) => {
    const qs = new URLSearchParams();
    if (params?.date_from) qs.set('date_from', params.date_from);
    if (params?.date_to) qs.set('date_to', params.date_to);
    if (params?.work_code) qs.set('work_code', params.work_code);
    if (params?.crew_code) qs.set('crew_code', params.crew_code);
    if (params?.floor) qs.set('floor', String(params.floor));
    const q = qs.toString();
    return request<PlanFactRow[]>(`/api/production/${objectId}/plan-fact${q ? `?${q}` : ''}`);
  },

  // Daily progress
  getDailyProgress: (objectId: number, week?: string) =>
    request<DailyProgress[]>(`/api/production/${objectId}/daily-progress${week ? `?week=${week}` : ''}`),

  // GPR weekly
  getGPRWeekly: (objectId: number) =>
    request<any[]>(`/api/production/${objectId}/gpr-weekly`),

  // Analytics
  getSummary: (objectId: number) =>
    request<ProjectSummary>(`/api/analytics/${objectId}/summary`),

  askClaude: (question: string, objectId?: number) =>
    request<{ answer: string }>('/api/analytics/ask', {
      method: 'POST',
      body: JSON.stringify({ question, object_id: objectId }),
    }),

  // Excel
  exportExcel: (objectId: number) =>
    `${API_BASE}/api/excel/export/${objectId}`,

  // Objects
  getObjects: () =>
    request<any[]>('/api/objects'),

  getGPR: (objectId: number) =>
    request<any>(`/api/gpr/${objectId}`),

  getTasks: (objectId: number, department?: string) =>
    request<any[]>(`/api/objects/${objectId}/tasks${department ? `?department=${department}` : ''}`),

  getConstructionStages: (objectId: number) =>
    request<any[]>(`/api/objects/${objectId}/construction`),
};
