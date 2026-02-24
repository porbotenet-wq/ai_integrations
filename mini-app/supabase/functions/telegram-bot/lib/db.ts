// Supabase client + data fetchers
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const db = createClient(SB_URL, SB_KEY);

export interface BotUser {
  user_id: string;
  display_name: string;
  roles: string[];
}

export async function getUser(chatId: number): Promise<BotUser | null> {
  const { data } = await db.from("profiles").select("user_id, display_name").eq("telegram_chat_id", String(chatId)).maybeSingle();
  if (!data) return null;
  const { data: rolesData } = await db.from("user_roles").select("role").eq("user_id", data.user_id);
  return { user_id: data.user_id, display_name: data.display_name, roles: (rolesData || []).map((r: any) => r.role) };
}

export async function getProjects() {
  const { data } = await db.from("projects").select("id, name, code, city, status, end_date")
    .eq("status", "active").order("created_at", { ascending: false }).limit(10);
  return data || [];
}

export async function getProject(projectId: string) {
  const { data } = await db.from("projects").select("id, name, code, end_date").eq("id", projectId).maybeSingle();
  return data;
}

export async function getFacades(projectId: string) {
  const { data } = await db.from("facades").select("id, name, code, total_modules, floors_count").eq("project_id", projectId).order("name");
  return data || [];
}

export async function getFacadeStats(facadeId: string) {
  const { data: floors } = await db.from("floors").select("floor_number, modules_plan, modules_fact, brackets_plan, brackets_fact, status").eq("facade_id", facadeId).order("floor_number");
  const all = floors || [];
  const totalPlan = all.reduce((s: number, f: any) => s + (f.modules_plan || 0), 0);
  const totalFact = all.reduce((s: number, f: any) => s + (f.modules_fact || 0), 0);
  const pct = totalPlan > 0 ? Math.round((totalFact / totalPlan) * 100) : 0;
  return { floors: all, totalPlan, totalFact, pct, doneFloors: all.filter((f: any) => f.status === "done").length };
}

export async function getOpenAlerts(projectId: string, limit = 5) {
  const { data } = await db.from("alerts").select("id, title, priority, category, facade_id, floor_number, created_at")
    .eq("project_id", projectId).eq("is_resolved", false).order("priority", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
  const { count } = await db.from("alerts").select("*", { count: "exact", head: true }).eq("project_id", projectId).eq("is_resolved", false);
  const { count: critCount } = await db.from("alerts").select("*", { count: "exact", head: true }).eq("project_id", projectId).eq("is_resolved", false).eq("priority", "critical");
  return { list: data || [], counts: { total: count || 0, critical: critCount || 0 } };
}

export async function getDeficitMaterials(projectId: string, limit = 5) {
  const { data } = await db.from("materials").select("name, unit, total_required, on_site, deficit, status, eta")
    .eq("project_id", projectId).gt("deficit", 0).order("deficit", { ascending: false }).limit(limit);
  return data || [];
}

export async function getMyTasks(userId: string, projectId: string, limit = 5) {
  const { data } = await db.from("ecosystem_tasks").select("id, code, name, status, priority, planned_date, block")
    .eq("project_id", projectId).eq("assigned_to", userId).neq("status", "Выполнено").order("planned_date", { ascending: true }).limit(limit);
  return data || [];
}

export async function getTodayPlanFact(projectId: string) {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await db.from("plan_fact").select("plan_value, fact_value").eq("project_id", projectId).eq("date", today);
  const all = data || [];
  const plan = all.reduce((s: number, r: any) => s + Number(r.plan_value || 0), 0);
  const fact = all.reduce((s: number, r: any) => s + Number(r.fact_value || 0), 0);
  return { plan, fact, pct: plan > 0 ? Math.round((fact / plan) * 100) : 0, count: all.length };
}

export async function getPendingApprovals(projectId: string) {
  const { data } = await db.from("approvals").select("id, title, type, status, level, created_at, description")
    .eq("project_id", projectId).eq("status", "pending").order("created_at", { ascending: false }).limit(5);
  return data || [];
}

export async function getDailyLogs(projectId: string, limit = 5) {
  const { data } = await db.from("daily_logs").select("id, date, works_description, workers_count, status, zone_name, submitted_by")
    .eq("project_id", projectId).order("date", { ascending: false }).limit(limit);
  return data || [];
}

export async function getInboxCount(projectId: string, toRoles: string | string[]) {
  const roles = Array.isArray(toRoles) ? toRoles : [toRoles];
  const orFilter = roles.map(r => `to_roles.cs.{${r}}`).join(",");
  const { count } = await db.from("bot_inbox").select("*", { count: "exact", head: true })
    .eq("project_id", projectId).eq("status", "new").or(orFilter);
  return count || 0;
}

export async function getInboxItems(projectId: string, toRoles: string | string[], limit = 5) {
  const roles = Array.isArray(toRoles) ? toRoles : [toRoles];
  const orFilter = roles.map(r => `to_roles.cs.{${r}}`).join(",");
  const { data } = await db.from("bot_inbox").select("id, title, type, from_role, status, created_at, description, file_url")
    .eq("project_id", projectId).or(orFilter).order("created_at", { ascending: false }).limit(limit);
  return data || [];
}
