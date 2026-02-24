// ─── User / Profile ─────────────────────────────────────
export interface UserProfile {
  id: number;
  telegram_id: number;
  username: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  role: string;
  role_name: string;
  department: string | null;
  department_name: string | null;
  position: string | null;
  access_level: string;
  is_active: boolean;
  zone_of_responsibility: string | null;
  permissions: string[];
  objects: ObjectBrief[];
}

export interface ObjectBrief {
  id: number;
  name: string;
  city: string | null;
  status: string;
  role: string;
}

// ─── Objects ────────────────────────────────────────────
export interface ObjectSummary {
  id: number;
  name: string;
  city: string | null;
  status: string;
  deadline_date: string | null;
  task_total: number;
  task_done: number;
  task_overdue: number;
  progress_pct: number;
}

export interface ObjectDetail {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  status: string;
  contract_number: string | null;
  contract_date: string | null;
  deadline_date: string | null;
  description: string | null;
  created_at: string;
}

// ─── GPR ────────────────────────────────────────────────
export interface GPRItem {
  id: number;
  department: string;
  department_name: string;
  title: string;
  unit: string | null;
  responsible: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_days: number | null;
  notes: string | null;
}

export interface GPRData {
  id: number;
  version: number;
  status: string;
  items: GPRItem[];
  signatures: GPRSignature[];
}

export interface GPRSignature {
  user: string;
  department: string;
  signed: boolean;
  signed_at: string | null;
}

// ─── Tasks ──────────────────────────────────────────────
export type TaskStatus = "new" | "assigned" | "in_progress" | "review" | "done" | "overdue" | "cancelled";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  department: string;
  status: TaskStatus;
  assignee: string | null;
  assignee_id: number | null;
  deadline: string | null;
  priority: number;
  comments_count: number;
  created_at: string;
}

export interface TaskComment {
  id: number;
  user_name: string;
  text: string;
  created_at: string;
}

// ─── Supply ─────────────────────────────────────────────
export interface SupplyOrder {
  id: number;
  material: string;
  quantity: number;
  unit: string;
  status: string;
  expected_date: string | null;
  actual_date: string | null;
  supplier: string | null;
}

// ─── Construction ───────────────────────────────────────
export interface ConstructionStage {
  id: number;
  name: string;
  status: string;
  sort_order: number;
  started_at: string | null;
  completed_at: string | null;
  checklist: ChecklistItem[];
}

export interface ChecklistItem {
  id: number;
  title: string;
  is_done: boolean;
}

// ─── Documents ──────────────────────────────────────────
export interface Document {
  id: number;
  title: string;
  category: string;
  file_url: string | null;
  uploaded_by: string | null;
  created_at: string;
}

// ─── Notifications ──────────────────────────────────────
export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  entity_type: string | null;
  entity_id: number | null;
  created_at: string;
}

export interface NotificationSummary {
  total_unread: number;
  by_type: Record<string, number>;
}

// ─── Dashboard ──────────────────────────────────────────
export interface DashboardData {
  active_objects: number;
  total_tasks: number;
  overdue_tasks: number;
  completed_tasks: number;
  delayed_supplies: number;
  objects: ObjectSummary[];
}

// ─── Activity ───────────────────────────────────────────
export interface ActivityLogEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  old_value: any;
  new_value: any;
  created_at: string;
}

// ─── Profile Tasks / Approvals ──────────────────────────
export interface ProfileTask {
  id: number;
  title: string;
  object_name: string;
  status: TaskStatus;
  deadline: string | null;
}

export interface ProfileApproval {
  id: number;
  title: string;
  type: string;
  status: string;
  created_at: string;
}

// ─── Org Structure ──────────────────────────────────────
export interface UserBrief {
  id: number;
  full_name: string;
  role: string;
  role_name: string;
  photo_url: string | null;
}

export type NotificationCategory = "tasks" | "gpr" | "supply" | "system";
