// Director screens
import { tgEdit } from "../lib/tg.ts";
import { type BotUser, getProjects, getProject, getOpenAlerts, getDeficitMaterials, getTodayPlanFact, getInboxCount } from "../lib/db.ts";
import { sendOrEdit, progressBar, todayStr, SEP, APP_URL, pe } from "../lib/ui.ts";
import { screenInbox } from "./shared.ts";

export async function screenDirectorMenu(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  const project = projectId ? await getProject(projectId) : (await getProjects())[0];
  let text = `👔 <b>${user.display_name}</b> · Директор\n${SEP}\n📅 ${todayStr()}\n\n`;
  const ctx: any = { project_id: project?.id, project_name: project?.name };
  if (project) {
    const pf = await getTodayPlanFact(project.id);
    const alerts = await getOpenAlerts(project.id);
    const inboxCount = await getInboxCount(project.id, "director");
    text += `🏗️ <b>${project.name}</b>\n`;
    text += pf.count > 0 ? `${progressBar(pf.pct)} <b>${pf.pct}%</b> сегодня\n` : `📊 Отчётов сегодня нет\n`;
    if (alerts.counts.total > 0) { text += `🔔 Алертов: <b>${alerts.counts.total}</b>`; if (alerts.counts.critical > 0) text += ` 🔴 крит: <b>${alerts.counts.critical}</b>`; text += "\n"; }
    if (inboxCount > 0) text += `📥 Входящих: <b>${inboxCount}</b>\n`;
  }
  await sendOrEdit(chatId, session, user.user_id, text, [
    [{ text: "📊 Портфель", callback_data: "d:portfolio" }, { text: "📈 KPI", callback_data: "d:kpi" }],
    [{ text: "🔴 Критические", callback_data: "d:critical" }, { text: "💰 Финансы", callback_data: "d:finance" }],
    [{ text: "🔔 Алерты", callback_data: "d:alerts" }, { text: "📝 Согласования", callback_data: "d:approvals" }],
    [{ text: `📥 Входящие`, callback_data: "d:inbox" }],
    [{ text: "📂 Сменить проект", callback_data: "proj:list" }, { text: "⚙️ Настройки", callback_data: "c:settings" }],
    [{ text: "🚀 Открыть приложение", web_app: { url: APP_URL } }],
  ], "IDLE", ctx);
}

export async function screenPortfolio(chatId: number, user: BotUser, session: any) {
  const projects = await getProjects();
  let text = `📊 <b>Портфель проектов</b>\n${SEP}\n`;
  for (const p of projects) {
    const pf = await getTodayPlanFact(p.id);
    const alerts = await getOpenAlerts(p.id);
    text += `🏗️ <b>${p.name}</b>\n${progressBar(pf.pct)} ${pf.pct}%`;
    if (alerts.counts.critical > 0) text += ` ⚠️`;
    text += `\n\n`;
  }
  text += `Всего: ${projects.length} активных`;
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
    [{ text: "📉 Отклонения от ГПР", callback_data: "d:critical" }],
    [{ text: "◀️ Назад", callback_data: "d:menu" }],
  ] });
}

export async function screenKPI(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  let text = `📈 <b>KPI по отделам</b>\n${SEP}\n`;
  if (projectId) {
    const deficit = await getDeficitMaterials(projectId);
    const alerts = await getOpenAlerts(projectId);
    const pf = await getTodayPlanFact(projectId);
    text += `📐 Проектный: ${alerts.counts.total === 0 ? "✅ без замечаний" : `⚠️ ${alerts.counts.total} алертов`}\n`;
    text += `📦 Снабжение: ${deficit.length > 0 ? `⚠️ ${deficit.length} позиций с дефицитом` : "✅ в норме"}\n`;
    text += `🏗️ Монтаж: ${pf.count > 0 ? `${pf.pct}% выполнения` : "нет данных"}\n`;
  } else { text += "Выберите проект для просмотра KPI"; }
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
    [{ text: "📦 Снабжение", callback_data: "d:supply" }],
    [{ text: "◀️ Назад", callback_data: "d:menu" }],
  ] });
}

export async function screenCritical(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  if (!projectId) return screenDirectorMenu(chatId, user, session);
  const { list } = await getOpenAlerts(projectId, 5);
  const critical = list.filter((a: any) => a.priority === "critical" || a.priority === "high");
  let text = `🔴 <b>Критические отклонения</b>\n${SEP}\n`;
  if (critical.length === 0) { text += "✅ Нет критических отклонений"; }
  else {
    for (const a of critical) {
      text += `${pe[a.priority]} ${a.title}\n`;
      if (a.floor_number) text += `   Этаж ${a.floor_number}\n`;
      text += "\n";
    }
  }
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
    [{ text: "🔔 Все алерты", callback_data: "d:alerts" }],
    [{ text: "◀️ Назад", callback_data: "d:menu" }],
  ] });
}

export async function screenFinance(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  const project = projectId ? await getProject(projectId) : null;
  let text = `💰 <b>Финансовый обзор</b>\n${SEP}\n`;
  if (project) {
    const pf = await getTodayPlanFact(project.id);
    text += `🏗️ ${project.name}\n📊 Прогресс: ${pf.pct}%\n\n<i>Детальная финансовая аналитика доступна в приложении</i>`;
  } else { text += "Выберите проект"; }
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
    [{ text: "📊 В приложении", web_app: { url: APP_URL } }],
    [{ text: "◀️ Назад", callback_data: "d:menu" }],
  ] });
}
