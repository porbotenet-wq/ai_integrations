// Foreman screens
import { tgEdit } from "../lib/tg.ts";
import { type BotUser, getProjects, getProject, getTodayPlanFact, getInboxCount, getFacades, getFacadeStats } from "../lib/db.ts";
import { sendOrEdit, progressBar, todayStr, SEP, APP_URL } from "../lib/ui.ts";

export async function screenForemanMenu(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  const project = projectId ? await getProject(projectId) : (await getProjects())[0];
  let text = `🏗️ <b>${user.display_name}</b> · Прораб\n${SEP}\n📅 ${todayStr()}\n\n`;
  const ctx: any = { project_id: project?.id, project_name: project?.name };
  if (project) {
    text += `🏗️ ${project.name}\n`;
    const pf = await getTodayPlanFact(project.id);
    const inboxCount = await getInboxCount(project.id, ["foreman", "foreman1", "foreman2", "foreman3"]);
    text += pf.count > 0 ? `${progressBar(pf.pct)} <b>${pf.pct}%</b> сегодня\n` : `⚠️ <b>Отчёт за сегодня не подан</b>\n`;
    if (inboxCount > 0) text += `📥 Входящих: <b>${inboxCount}</b>\n`;
  }
  await sendOrEdit(chatId, session, user.user_id, text, [
    [{ text: "📥 Входящие", callback_data: "f:inbox" }, { text: "📤 Отправить", callback_data: "f:send" }],
    [{ text: "📋 Подать отчёт", callback_data: "f:report" }],
    [{ text: "📸 Фотоотчёт", callback_data: "f:photo" }, { text: "📊 Прогресс", callback_data: "f:progress" }],
    [{ text: "📂 Проект", callback_data: "proj:list" }, { text: "⚙️ Настройки", callback_data: "c:settings" }],
    [{ text: "🚀 Открыть приложение", web_app: { url: APP_URL } }],
  ], "IDLE", ctx);
}

export async function screenForemanSend(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `📤 <b>Прораб · Отчёты</b>\n${SEP}`, { inline_keyboard: [
    [{ text: "🔧 Заявка на инструмент", callback_data: "f:doc:tool" }],
    [{ text: "📸 Фотоотчёт ежедневный", callback_data: "f:doc:daily" }],
    [{ text: "📄 Акт скрытых работ", callback_data: "f:doc:hidden" }],
    [{ text: "⚠️ Проблема на площадке", callback_data: "f:doc:issue" }],
    [{ text: "◀️ Назад", callback_data: "f:menu" }],
  ] });
}

export async function screenForemanPhoto(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `📸 <b>Фотоотчёт</b>\n${SEP}\nВыберите тип:`, { inline_keyboard: [
    [{ text: "📷 Ежедневный", callback_data: "f:pt:daily" }],
    [{ text: "📷 Кронштейны", callback_data: "f:pt:brackets" }],
    [{ text: "📷 Каркас", callback_data: "f:pt:frame" }],
    [{ text: "📷 Заполнение", callback_data: "f:pt:glass" }],
    [{ text: "◀️ Назад", callback_data: "f:menu" }],
  ] });
}

export async function screenForemanProgress(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  if (!projectId) return screenForemanMenu(chatId, user, session);
  const facades = await getFacades(projectId);
  let text = `📊 <b>Прогресс</b>\n${SEP}\n📅 ${todayStr()}\n\n`;
  for (const f of facades) {
    const s = await getFacadeStats(f.id);
    text += `<b>${f.name}</b>: ${progressBar(s.pct)} ${s.pct}%\n  ${s.totalFact}/${s.totalPlan} мод.\n\n`;
  }
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [[{ text: "◀️ Меню", callback_data: "f:menu" }]] });
}
