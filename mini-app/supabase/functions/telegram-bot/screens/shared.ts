// Shared screens used by multiple roles
import { tgEdit } from "../lib/tg.ts";
import { db, type BotUser, getProjects, getProject, getFacades, getFacadeStats, getOpenAlerts, getDeficitMaterials, getMyTasks, getTodayPlanFact, getPendingApprovals, getDailyLogs, getInboxItems } from "../lib/db.ts";
import { saveSession, clearSession } from "../lib/session.ts";
import { rp, roleLabel, isForeman, isManager, ROLE_LABELS } from "../lib/roles.ts";
import { sendOrEdit, progressBar, todayStr, SEP, APP_URL, pe, typeIcons } from "../lib/ui.ts";
import { audit } from "../lib/audit.ts";

// Forward declaration — will be set by dispatcher
let _routeToMenu: (chatId: number, user: BotUser, session: any) => Promise<any>;
export function setRouteToMenu(fn: typeof _routeToMenu) { _routeToMenu = fn; }
function routeToMenu(chatId: number, user: BotUser, session: any) { return _routeToMenu(chatId, user, session); }

export async function screenProjectsList(chatId: number, user: BotUser, session: any) {
  const projects = await getProjects();
  let text = `📋 <b>Ваши проекты</b>\n${SEP}\n`;
  if (projects.length === 0) {
    text += "Нет активных проектов";
    await sendOrEdit(chatId, session, user.user_id, text, [[{ text: "🚀 Открыть приложение", web_app: { url: APP_URL } }]]);
    return;
  }
  for (const p of projects) { text += `\n🏗️ <b>${p.name}</b>${p.city ? ` · ${p.city}` : ""}${p.code ? ` (${p.code})` : ""}\n`; }
  const buttons = projects.map((p: any) => [{ text: `🏗️ ${p.name}`, callback_data: `proj:sel:${p.id}` }]);
  buttons.push([{ text: "◀️ Назад", callback_data: `${rp(user.roles)}:menu` }]);
  await sendOrEdit(chatId, session, user.user_id, text, buttons);
}

export async function selectProject(chatId: number, user: BotUser, session: any, projectId: string) {
  const project = await getProject(projectId);
  if (!project) return;
  const ctx = { ...session?.context, project_id: projectId, project_name: project.name };
  await saveSession(chatId, user.user_id, "IDLE", ctx, session?.message_id ?? undefined);
  return routeToMenu(chatId, user, { ...session, context: ctx });
}

export async function screenAlerts(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  if (!projectId) return routeToMenu(chatId, user, session);
  const { list, counts } = await getOpenAlerts(projectId, 8);
  let text = `🔔 <b>Алерты</b>\n${SEP}\n`;
  if (counts.total === 0) { text += "✅ Нет открытых алертов"; }
  else {
    text += `Открытых: <b>${counts.total}</b>`; if (counts.critical > 0) text += ` 🔴 крит: <b>${counts.critical}</b>`; text += `\n\n`;
    for (const a of list) {
      const age = Math.round((Date.now() - new Date(a.created_at).getTime()) / 3600000);
      text += `${pe[a.priority] || "⚪"} ${a.title}\n`;
      if (a.floor_number) text += `   Этаж ${a.floor_number}`;
      text += `   <i>${age}ч назад</i>\n`;
    }
    if (counts.total > list.length) text += `\n<i>...ещё ${counts.total - list.length}</i>`;
  }
  const prefix = rp(user.roles);
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
    ...(isManager(user.roles) ? [[{ text: "✏️ Создать алерт", callback_data: `${prefix}:alert_new` }]] : []),
    [{ text: "◀️ Меню", callback_data: `${prefix}:menu` }],
  ] });
}

export async function screenSupply(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  if (!projectId) return routeToMenu(chatId, user, session);
  const deficit = await getDeficitMaterials(projectId);
  let text = `📦 <b>Снабжение</b>\n${SEP}\n`;
  if (deficit.length === 0) { text += "✅ Дефицита нет"; }
  else {
    text += `⚠️ Дефицит по <b>${deficit.length}</b> позициям:\n\n`;
    for (const m of deficit) {
      const etaStr = m.eta ? ` · ETA ${new Date(m.eta).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}` : "";
      text += `📌 ${m.name}\n   Нужно: ${m.total_required} ${m.unit} · На объекте: ${m.on_site}${etaStr}\n   ⚠️ Дефицит: <b>${m.deficit} ${m.unit}</b>\n\n`;
    }
  }
  const prefix = rp(user.roles);
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
    [{ text: "🚀 Снабжение в приложении", web_app: { url: APP_URL } }],
    [{ text: "◀️ Меню", callback_data: `${prefix}:menu` }],
  ] });
}

export async function screenDashboard(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  const project = projectId ? await getProject(projectId) : (await getProjects())[0];
  if (!project) { await tgEdit(chatId, session.message_id, "❌ Нет активных проектов.", { inline_keyboard: [[{ text: "◀️ Назад", callback_data: `${rp(user.roles)}:menu` }]] }); return; }
  const facades = await getFacades(project.id);
  const alerts = await getOpenAlerts(project.id);
  let totalPlan = 0, totalFact = 0;
  for (const f of facades) { const s = await getFacadeStats(f.id); totalPlan += s.totalPlan; totalFact += s.totalFact; }
  const totalPct = totalPlan > 0 ? Math.round((totalFact / totalPlan) * 100) : 0;
  const daysLeft = project.end_date ? Math.ceil((new Date(project.end_date).getTime() - Date.now()) / 86400000) : null;
  let text = `📊 <b>Дашборд</b>\n${SEP}\n🏗️ ${project.name}\n📅 ${todayStr()}\n\n${progressBar(totalPct)} <b>${totalPct}%</b>\nМодули: ${totalFact} / ${totalPlan} шт.\n\n`;
  if (daysLeft !== null) text += daysLeft < 0 ? `🔴 Просрочка: <b>${Math.abs(daysLeft)} дн.</b>\n` : `📅 До сдачи: <b>${daysLeft} дн.</b>\n`;
  if (facades.length > 0) { text += `\n<b>По фасадам:</b>\n`; for (const f of facades) { const s = await getFacadeStats(f.id); text += `${f.name}: ${progressBar(s.pct)} ${s.pct}%\n`; } }
  if (alerts.counts.total > 0) { text += `\n🔔 Алертов: ${alerts.counts.total}`; if (alerts.counts.critical > 0) text += ` 🔴 крит: ${alerts.counts.critical}`; text += "\n"; }
  const prefix = rp(user.roles);
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
    [{ text: "🔔 Алерты", callback_data: `${prefix}:alerts` }, { text: "📦 Снабжение", callback_data: `${prefix}:supply` }],
    [{ text: "◀️ Меню", callback_data: `${prefix}:menu` }],
  ] });
}

export async function screenFacades(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  if (!projectId) return routeToMenu(chatId, user, session);
  const facades = await getFacades(projectId);
  let text = `🏗️ <b>Фасады</b>\n${SEP}\n`;
  for (const f of facades) {
    const s = await getFacadeStats(f.id);
    text += `<b>${f.name}</b> ${f.code ? `(${f.code})` : ""}\n${progressBar(s.pct)} ${s.pct}%  ${s.totalFact}/${s.totalPlan} мод.\n\n`;
  }
  const prefix = rp(user.roles);
  const buttons = facades.map((f: any) => [{ text: `📋 ${f.name}`, callback_data: `${prefix}:fcd:${f.id}` }]);
  buttons.push([{ text: "◀️ Меню", callback_data: `${prefix}:menu` }]);
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: buttons });
}

export async function screenFacadeDetail(chatId: number, user: BotUser, session: any, facadeId: string) {
  const { data: facade } = await db.from("facades").select("name, code, total_modules, floors_count").eq("id", facadeId).maybeSingle();
  if (!facade) return;
  const stats = await getFacadeStats(facadeId);
  let text = `🏗️ <b>${facade.name}</b>\n${SEP}\n${progressBar(stats.pct)} <b>${stats.pct}%</b>\nМодули: ${stats.totalFact} / ${stats.totalPlan}\n\n`;
  if (stats.floors.length > 0) {
    text += `<b>По этажам:</b>\n`;
    const sorted = [...stats.floors].sort((a: any, b: any) => b.floor_number - a.floor_number);
    for (const fl of sorted.slice(0, 8)) {
      const flPct = fl.modules_plan > 0 ? Math.round((fl.modules_fact / fl.modules_plan) * 100) : 0;
      const icon = fl.status === "done" ? "✅" : fl.status === "in_progress" ? "🔄" : "⬜";
      text += `${icon} Эт.${fl.floor_number}: ${fl.modules_fact}/${fl.modules_plan} (${flPct}%)\n`;
    }
  }
  const prefix = rp(user.roles);
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
    [{ text: "◀️ Фасады", callback_data: `${prefix}:facades` }],
    [{ text: "◀️ Меню", callback_data: `${prefix}:menu` }],
  ] });
}

export async function screenApprovals(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  if (!projectId) return routeToMenu(chatId, user, session);
  const approvals = await getPendingApprovals(projectId);
  let text = `📝 <b>Согласования</b>\n${SEP}\n`;
  if (approvals.length === 0) { text += "✅ Нет ожидающих"; }
  else {
    text += `Ожидают: <b>${approvals.length}</b>\n\n`;
    for (const a of approvals) {
      text += `${typeIcons[a.type] || "📌"} <b>${a.title}</b>\n   Ур.${a.level} · ${new Date(a.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}\n\n`;
    }
  }
  const prefix = rp(user.roles);
  const buttons: any[][] = [];
  for (const a of approvals.slice(0, 3)) {
    buttons.push([
      { text: `✅ ${a.title.slice(0, 18)}`, callback_data: `appr:yes:${a.id}` },
      { text: `❌`, callback_data: `appr:no:${a.id}` },
    ]);
  }
  buttons.push([{ text: "◀️ Меню", callback_data: `${prefix}:menu` }]);
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: buttons });
}

export async function handleApproval(chatId: number, user: BotUser, session: any, approvalId: string, decision: "approved" | "rejected") {
  const { data: approval } = await db.from("approvals").select("title, status").eq("id", approvalId).maybeSingle();
  if (!approval || approval.status !== "pending") return screenApprovals(chatId, user, session);
  await db.from("approvals").update({ status: decision, assigned_to: user.user_id, decided_at: new Date().toISOString() }).eq("id", approvalId);
  const icon = decision === "approved" ? "✅" : "❌";
  await audit(chatId, user.user_id, `approval:${decision}`, { approval_id: approvalId });
  const prefix = rp(user.roles);
  await tgEdit(chatId, session.message_id, `${icon} <b>${approval.title}</b>\nРешение: ${decision === "approved" ? "согласовано" : "отклонено"}`,
    { inline_keyboard: [[{ text: "📝 Согласования", callback_data: `${prefix}:approvals` }], [{ text: "◀️ Меню", callback_data: `${prefix}:menu` }]] });
}

export async function screenTasks(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  if (!projectId) return routeToMenu(chatId, user, session);
  const tasks = await getMyTasks(user.user_id, projectId);
  let text = `📋 <b>Мои задачи</b>\n${SEP}\n`;
  if (tasks.length === 0) { text += "✅ Нет активных задач"; }
  else {
    const si: Record<string, string> = { "В работе": "🔄", "Ожидание": "⏳", "Выполнено": "✅" };
    for (const t of tasks) {
      text += `${pe[t.priority] || "⚪"} ${si[t.status] || "⏳"} <b>[${t.code}]</b> ${t.name}\n`;
      if (t.planned_date) text += `   📅 ${new Date(t.planned_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}\n`;
      text += "\n";
    }
  }
  const prefix = rp(user.roles);
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
    [{ text: "🚀 Задачи в приложении", web_app: { url: APP_URL } }],
    [{ text: "◀️ Меню", callback_data: `${prefix}:menu` }],
  ] });
}

export async function screenSettings(chatId: number, user: BotUser, session: any) {
  const { data: profile } = await db.from("profiles").select("notification_preferences, telegram_chat_id").eq("user_id", user.user_id).maybeSingle();
  const prefs = (profile?.notification_preferences || {}) as Record<string, any>;
  let text = `⚙️ <b>Настройки</b>\n${SEP}\n👤 ${user.display_name}\n${roleLabel(user.roles)}\n📱 Chat ID: ${profile?.telegram_chat_id || "—"}\n\n`;
  text += `<b>Уведомления:</b>\n`;
  text += `${prefs.alert_created !== false ? "✅" : "❌"} Новые алерты\n`;
  text += `${prefs.daily_report_missing !== false ? "✅" : "❌"} Напоминание об отчёте\n`;
  text += `${prefs.project_summary !== false ? "✅" : "❌"} Дайджест проекта\n`;
  text += `${prefs.supply_overdue !== false ? "✅" : "❌"} Дефицит материалов\n`;
  text += `\n🌙 Не беспокоить: ${prefs.do_not_disturb_from || "23:00"} — ${prefs.do_not_disturb_to || "07:00"}\n`;
  const prefix = rp(user.roles);
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
    [{ text: `${prefs.alert_created !== false ? "🔕" : "🔔"} Алерты`, callback_data: "set:t:alert_created" }],
    [{ text: `${prefs.daily_report_missing !== false ? "🔕" : "🔔"} Напоминания`, callback_data: "set:t:daily_report_missing" }],
    [{ text: `${prefs.project_summary !== false ? "🔕" : "🔔"} Дайджест`, callback_data: "set:t:project_summary" }],
    [{ text: "◀️ Меню", callback_data: `${prefix}:menu` }],
  ] });
}

export async function toggleNotification(chatId: number, user: BotUser, session: any, key: string) {
  const { data: profile } = await db.from("profiles").select("notification_preferences").eq("user_id", user.user_id).maybeSingle();
  const prefs = { ...(profile?.notification_preferences || {}) } as Record<string, any>;
  prefs[key] = prefs[key] === false ? true : false;
  await db.from("profiles").update({ notification_preferences: prefs }).eq("user_id", user.user_id);
  return screenSettings(chatId, user, session);
}

export async function screenDailyLogs(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  if (!projectId) return routeToMenu(chatId, user, session);
  const logs = await getDailyLogs(projectId);
  let text = `📋 <b>Дневные журналы</b>\n${SEP}\n`;
  if (logs.length === 0) { text += "Нет записей"; }
  else {
    for (const log of logs) {
      const date = new Date(log.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
      const statusIcon = log.status === "approved" ? "✅" : log.status === "submitted" ? "📤" : "📝";
      text += `${statusIcon} <b>${date}</b>${log.zone_name ? ` · ${log.zone_name}` : ""}\n   ${log.works_description.slice(0, 60)}\n\n`;
    }
  }
  const prefix = rp(user.roles);
  const buttons: any[][] = [];
  if (isForeman(user.roles)) buttons.push([{ text: "📝 Новая запись", callback_data: "log:new" }]);
  buttons.push([{ text: "🚀 В приложении", web_app: { url: APP_URL } }]);
  buttons.push([{ text: "◀️ Меню", callback_data: `${prefix}:menu` }]);
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: buttons });
}

export async function screenInbox(chatId: number, user: BotUser, session: any, role: string | string[], prefix: string) {
  const projectId = session?.context?.project_id;
  if (!projectId) return routeToMenu(chatId, user, session);
  const items = await getInboxItems(projectId, role);
  const label = Array.isArray(role) ? ROLE_LABELS[role[0]] || role[0] : (ROLE_LABELS[role] || role);
  let text = `📥 <b>Входящие · ${label}</b>\n${SEP}\n`;
  if (items.length === 0) {
    text += "✅ Нет новых входящих";
  } else {
    const fromIcons: Record<string, string> = { pm: "📋", supply: "📦", production: "🏭", project_opr: "📐", project_km: "📏", project_kmd: "✏️", foreman: "🏗️", pto: "📁", inspector: "🔍", director: "👔" };
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const icon = fromIcons[item.from_role] || "📌";
      const age = Math.round((Date.now() - new Date(item.created_at).getTime()) / 3600000);
      text += `${i + 1}. ${icon} <b>${item.title}</b>\n   от: ${item.from_role} · ${age}ч назад\n`;
      if (item.description) text += `   <i>${item.description.slice(0, 50)}</i>\n`;
      text += "\n";
    }
  }
  const buttons: any[][] = items.slice(0, 4).map((item: any, i: number) => [
    { text: `${i + 1}. ${item.title.slice(0, 28)}`, callback_data: `inbox:view:${item.id}` },
  ]);
  buttons.push([{ text: "◀️ Назад", callback_data: `${prefix}:menu` }]);
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: buttons });
}

export async function screenInboxDetail(chatId: number, user: BotUser, session: any, itemId: string) {
  const { data: item } = await db.from("bot_inbox").select("*").eq("id", itemId).maybeSingle();
  if (!item) return;
  if (item.status === "new") {
    await db.from("bot_inbox").update({ status: "read" }).eq("id", itemId);
  }
  let text = `📥 <b>${item.title}</b>\n${SEP}\n`;
  text += `От: ${item.from_role}\nТип: ${item.type}\n`;
  if (item.description) text += `\n${item.description}\n`;
  if (item.file_url) text += `\n📎 <a href="${item.file_url}">Файл</a>\n`;
  text += `\n📅 ${new Date(item.created_at).toLocaleString("ru-RU")}`;
  const prefix = rp(user.roles);
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
    [{ text: "✅ Обработано", callback_data: `inbox:done:${itemId}` }],
    [{ text: "◀️ Входящие", callback_data: `${prefix}:inbox` }],
  ] });
}

export async function handleInboxDone(chatId: number, user: BotUser, session: any, itemId: string) {
  await db.from("bot_inbox").update({ status: "processed" }).eq("id", itemId);
  await audit(chatId, user.user_id, "inbox:processed", { item_id: itemId });
  const prefix = rp(user.roles);
  await tgEdit(chatId, session.message_id, "✅ Отмечено как обработанное", { inline_keyboard: [
    [{ text: "📥 Входящие", callback_data: `${prefix}:inbox` }],
    [{ text: "◀️ Меню", callback_data: `${prefix}:menu` }],
  ] });
}

export async function screenProgress(chatId: number, user: BotUser, session: any, prefix: string) {
  const projectId = session?.context?.project_id;
  if (!projectId) return routeToMenu(chatId, user, session);
  const tasks = await getMyTasks(user.user_id, projectId, 10);
  let text = `📊 <b>Мой прогресс</b>\n${SEP}\n`;
  if (tasks.length === 0) { text += "✅ Нет активных задач"; }
  else {
    const done = tasks.filter((t: any) => t.status === "Выполнено").length;
    text += `Задач: ${tasks.length} · Выполнено: ${done}\n\n`;
    for (const t of tasks.slice(0, 5)) {
      const si: Record<string, string> = { "В работе": "🔄", "Ожидание": "⏳" };
      text += `${si[t.status] || "⏳"} [${t.code}] ${t.name}\n`;
    }
  }
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
    [{ text: "🚀 В приложении", web_app: { url: APP_URL } }],
    [{ text: "◀️ Меню", callback_data: `${prefix}:menu` }],
  ] });
}
