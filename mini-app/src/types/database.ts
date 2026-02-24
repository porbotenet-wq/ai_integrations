// Базовые типы БД — замена any по всему проекту

export type ProjectStatus = "draft" | "active" | "paused" | "completed" | "archived";
export type AlertPriority = "critical" | "high" | "normal" | "medium" | "low" | "info";
export type PlanFactStatus = "draft" | "submitted" | "approved";
export type WorkType = "nvf" | "spk" | "both";
export type EventType = "deadline" | "delivery" | "visit" | "payment" | "inspection" | "milestone" | "other";
export type EventPriority = "low" | "medium" | "high" | "critical";

export interface Project {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  status: ProjectStatus;
  work_type: WorkType;
  start_date: string | null;
  end_date: string | null;
  client_name: string | null;
  client_inn: string | null;
  client_director: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_legal_address: string | null;
  client_actual_address: string | null;
  client_bank: string | null;
  client_account: string | null;
  contacts: ContactInfo[];
  created_at: string;
  updated_at?: string;
}

export interface ContactInfo {
  role: string;
  name: string;
  phone: string;
  email: string;
}

export interface Alert {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  priority: AlertPriority;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  photo_urls: string[];
  created_at: string;
}

export interface Crew {
  id: string;
  project_id: string;
  name: string;
  specialization: string | null;
  headcount: number;
  foreman_name: string | null;
  is_active: boolean;
}

export interface Facade {
  id: string;
  project_id: string;
  name: string;
  code: string | null;
  total_modules: number;
}

export interface Floor {
  id: string;
  facade_id: string;
  floor_number: number;
  status: "done" | "in_progress" | "pending" | "blocked";
  modules_plan: number;
  modules_fact: number;
  brackets_plan: number;
  brackets_fact: number;
  sealant_plan: number;
  sealant_fact: number;
  photo_urls: string[];
}

export interface Material {
  id: string;
  project_id: string;
  name: string;
  unit: string;
  quantity_plan: number;
  quantity_fact: number;
  deficit: number;
  status: string;
}

export interface PlanFactRecord {
  id: string;
  project_id: string;
  date: string;
  week_number: number;
  plan_value: number;
  fact_value: number;
  photo_urls: string[];
}

export interface WorkTypeRecord {
  id: string;
  project_id: string;
  name: string;
  section: string;
  subsection: string;
  unit: string;
  sort_number: number;
  volume: number | null;
  duration_days: number | null;
  start_date: string | null;
  end_date: string | null;
  workers_count: number | null;
}

export interface DocumentFolder {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  department: string;
  sort_order: number;
}

export interface Document {
  id: string;
  project_id: string;
  folder_id: string | null;
  name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  ai_summary: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  project_id: string;
  title: string;
  date: string;
  end_date?: string;
  type: EventType;
  description?: string;
  is_done: boolean;
  priority?: EventPriority;
  ref_1c?: string;
  doc_type_1c?: string;
  created_at?: string;
}

export interface Profile {
  user_id: string;
  display_name: string | null;
  role: string;
  telegram_chat_id: string | null;
}
