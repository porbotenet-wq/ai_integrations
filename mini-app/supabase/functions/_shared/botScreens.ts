import { inlineKeyboard, buildCallback } from "./botUtils.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);
const WEBAPP_URL = Deno.env.get("WEBAPP_URL") || "https://your-app.lovable.app";

export function homeScreen(userName: string, role: string, alertsCount: number) {
  const text =
    `🏗️ <b>STSphera</b>\n\n` +
    `Привет, <b>${userName}</b>!\n` +
    `Роль: ${role}\n` +
    (alertsCount > 0 ? `⚠️ Активных алертов: <b>${alertsCount}</b>\n` : "") +
    `\nВыберите действие:`;

  const keyboard = inlineKeyboard([
    [{ text: "📋 Мои проекты", callback_data: buildCallback("list", "projects") }],
    [{ text: "📝 Дневной отчёт", callback_data: buildCallback("select", "report") }],
    [{ text: `⚠️ Алерты${alertsCount > 0 ? ` (${alertsCount})` : ""}`, callback_data: buildCallback("list", "alerts") }],
    [{ text: "📋 Мои задачи", callback_data: buildCallback("list", "tasks") }],
    [{ text: "📊 Открыть Mini App", web_app: { url: WEBAPP_URL } }],
    [{ text: "⚙️ Настройки", callback_data: buildCallback("show", "settings") }],
  ]);

  return { text, keyboard };
}

export async function projectListScreen(telegramId: number, page = 0) {
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, city, status")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(page * 5, page * 5 + 4);

  if (!projects || projects.length === 0) {
    return {
      text: "📋 <b>Проекты</b>\n\nНет активных проектов.",
      keyboard: inlineKeyboard([[{ text: "◀️ Назад", callback_data: buildCallback("home") }]]),
    };
  }

  const buttons = projects.map((p) => [
    { text: `${p.name}${p.city ? ` · ${p.city}` : ""}`, callback_data: buildCallback("show", "project", p.id) },
  ]);

  const nav: { text: string; callback_data: string }[] = [];
  if (page > 0) nav.push({ text: "◀️", callback_data: buildCallback("list", "projects", String(page - 1)) });
  nav.push({ text: "🏠 Домой", callback_data: buildCallback("home") });
  if (projects.length === 5) nav.push({ text: "▶️", callback_data: buildCallback("list", "projects", String(page + 1)) });
  buttons.push(nav);

  return { text: `📋 <b>Ваши проекты:</b>`, keyboard: inlineKeyboard(buttons) };
}

export async function projectDetailScreen(projectId: string) {
  const { data: p } = await supabase.from("projects").select("*").eq("id", projectId).single();
  if (!p) {
    return {
      text: "❌ Проект не найден",
      keyboard: inlineKeyboard([[{ text: "◀️ Назад", callback_data: buildCallback("list", "projects") }]]),
    };
  }

  const { count: alertsCount } = await supabase
    .from("alerts").select("id", { count: "exact", head: true })
    .eq("project_id", projectId).eq("is_resolved", false);

  const { data: pfData } = await supabase
    .from("plan_fact").select("plan_value, fact_value").eq("project_id", projectId);

  const totalPlan = (pfData || []).reduce((s: number, r: { plan_value: number }) => s + Number(r.plan_value || 0), 0);
  const totalFact = (pfData || []).reduce((s: number, r: { fact_value: number }) => s + Number(r.fact_value || 0), 0);
  const progress = totalPlan > 0 ? Math.round((totalFact / totalPlan) * 100) : 0;

  const text =
    `📋 <b>${p.name}</b>\n` +
    (p.address ? `📍 ${p.address}\n` : "") +
    (p.start_date && p.end_date ? `📅 ${p.start_date} — ${p.end_date}\n` : "") +
    `📊 Прогресс: <b>${progress}%</b>\n` +
    (alertsCount ? `⚠️ Алертов: <b>${alertsCount}</b>\n` : "");

  const keyboard = inlineKeyboard([
    [{ text: "📝 Создать отчёт", callback_data: buildCallback("report", "start", projectId) }],
    [{ text: `⚠️ Алерты (${alertsCount || 0})`, callback_data: buildCallback("list", "alerts", projectId) }],
    [{ text: "📝 Согласования", callback_data: buildCallback("list", "approvals", projectId) }],
    [{ text: "📊 Аналитика", web_app: { url: `${WEBAPP_URL}/?project=${projectId}&tab=dash` } }],
    [{ text: "◀️ Назад", callback_data: buildCallback("list", "projects") }],
  ]);

  return { text, keyboard };
}

export async function alertsListScreen(projectId?: string) {
  let query = supabase
    .from("alerts")
    .select("id, title, priority, is_resolved, created_at, project_id")
    .eq("is_resolved", false)
    .order("created_at", { ascending: false })
    .limit(5);

  if (projectId) query = query.eq("project_id", projectId);
  const { data: alerts } = await query;

  if (!alerts || alerts.length === 0) {
    return {
      text: "✅ <b>Нет активных алертов</b>\n\nВсё спокойно!",
      keyboard: inlineKeyboard([[{ text: "◀️ Назад", callback_data: projectId ? buildCallback("show", "project", projectId) : buildCallback("home") }]]),
    };
  }

  const icons: Record<string, string> = { critical: "🔴", high: "🔴", normal: "⚠️", medium: "⚠️", low: "ℹ️", info: "ℹ️" };
  const text =
    `⚠️ <b>Активные алерты (${alerts.length}):</b>\n\n` +
    alerts.map((a: { priority: string; title: string }, i: number) => `${icons[a.priority] || "ℹ️"} ${i + 1}. ${a.title}`).join("\n");

  const buttons = alerts.map((a: { id: string; priority: string; title: string }) => [
    { text: `${icons[a.priority] || "ℹ️"} ${a.title.slice(0, 30)}`, callback_data: buildCallback("alert", "detail", a.id) },
  ]);
  buttons.push([{ text: "◀️ Назад", callback_data: projectId ? buildCallback("show", "project", projectId) : buildCallback("home") }]);

  return { text, keyboard: inlineKeyboard(buttons) };
}

export async function alertDetailScreen(alertId: string) {
  const { data: a } = await supabase.from("alerts").select("*").eq("id", alertId).single();
  if (!a) {
    return {
      text: "❌ Алерт не найден",
      keyboard: inlineKeyboard([[{ text: "◀️ Назад", callback_data: buildCallback("list", "alerts") }]]),
    };
  }

  const icons: Record<string, string> = { critical: "🔴", high: "🔴", normal: "⚠️", medium: "⚠️", low: "ℹ️", info: "ℹ️" };
  const text =
    `${icons[a.priority] || "ℹ️"} <b>${a.title}</b>\n\n` +
    (a.description ? `${a.description}\n\n` : "") +
    `📅 ${new Date(a.created_at).toLocaleString("ru-RU")}\n` +
    `Статус: ${a.is_resolved ? "✅ Закрыт" : "🔓 Открыт"}`;

  const keyboard = inlineKeyboard([
    ...(!a.is_resolved ? [[{ text: "✅ Закрыть алерт", callback_data: buildCallback("alert", "resolve", a.id) }]] : []),
    [{ text: "◀️ Назад", callback_data: buildCallback("list", "alerts", a.project_id) }],
  ]);

  return { text, keyboard };
}

export function settingsScreen(displayName: string) {
  const text =
    `⚙️ <b>Настройки</b>\n\n` +
    `👤 ${displayName}\n` +
    `🔔 Уведомления: вкл\n` +
    `🌐 Язык: Русский`;

  const keyboard = inlineKeyboard([
    [{ text: "📊 Открыть Mini App", web_app: { url: WEBAPP_URL } }],
    [{ text: "◀️ Назад", callback_data: buildCallback("home") }],
  ]);

  return { text, keyboard };
}

// ─── APPROVALS ───────────────────────────────────────
export async function approvalsListScreen(projectId?: string) {
  let query = supabase
    .from("approvals")
    .select("id, title, type, status, level, created_at, project_id")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(5);

  if (projectId) query = query.eq("project_id", projectId);
  const { data: approvals } = await query;

  if (!approvals || approvals.length === 0) {
    return {
      text: "✅ <b>Нет ожидающих согласований</b>",
      keyboard: inlineKeyboard([[{ text: "◀️ Назад", callback_data: projectId ? buildCallback("show", "project", projectId) : buildCallback("home") }]]),
    };
  }

  const typeIcons: Record<string, string> = { daily_log: "📋", material_request: "📦", task_completion: "✔️", budget: "💰", other: "📌" };

  const text =
    `📝 <b>Согласования (${approvals.length} ожидают):</b>\n\n` +
    approvals.map((a: { type: string; title: string; level: number; created_at: string }, i: number) => `${typeIcons[a.type] || "📌"} ${i + 1}. ${a.title}\n   Уровень ${a.level} · ${new Date(a.created_at).toLocaleDateString("ru-RU")}`).join("\n\n");

  const buttons = approvals.map((a: { id: string; title: string }) => [
    { text: `✅ ${a.title.slice(0, 20)}`, callback_data: buildCallback("approve", "yes", a.id) },
    { text: `❌`, callback_data: buildCallback("approve", "no", a.id) },
  ]);
  buttons.push([{ text: "◀️ Назад", callback_data: projectId ? buildCallback("show", "project", projectId) : buildCallback("home") }]);

  return { text, keyboard: inlineKeyboard(buttons) };
}

export async function approvalDetailScreen(approvalId: string) {
  const { data: a } = await supabase.from("approvals").select("*").eq("id", approvalId).single();
  if (!a) {
    return {
      text: "❌ Согласование не найдено",
      keyboard: inlineKeyboard([[{ text: "◀️ Назад", callback_data: buildCallback("list", "approvals") }]]),
    };
  }

  const typeLabels: Record<string, string> = { daily_log: "Дневной отчёт", material_request: "Заявка на материалы", task_completion: "Завершение задачи", budget: "Бюджет", other: "Прочее" };

  const text =
    `📝 <b>${a.title}</b>\n\n` +
    `Тип: ${typeLabels[a.type] || a.type}\n` +
    `Уровень: ${a.level}\n` +
    `Статус: ${a.status === "pending" ? "⏳ Ожидает" : a.status === "approved" ? "✅ Согласовано" : "❌ Отклонено"}\n` +
    (a.description ? `\n${a.description}\n` : "") +
    `\n📅 ${new Date(a.created_at).toLocaleString("ru-RU")}`;

  const buttons: { text: string; callback_data: string }[][] = [];
  if (a.status === "pending") {
    buttons.push([
      { text: "✅ Согласовать", callback_data: buildCallback("approve", "yes", a.id) },
      { text: "❌ Отклонить", callback_data: buildCallback("approve", "no", a.id) },
    ]);
  }
  buttons.push([{ text: "◀️ Назад", callback_data: buildCallback("list", "approvals") }]);

  return { text, keyboard: inlineKeyboard(buttons) };
}
