// OPR screens
import { tgEdit } from "../lib/tg.ts";
import { type BotUser, getProjects, getProject, getInboxCount } from "../lib/db.ts";
import { sendOrEdit, SEP, APP_URL } from "../lib/ui.ts";

export async function screenOPRMenu(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  const project = projectId ? await getProject(projectId) : (await getProjects())[0];
  const ctx: any = { project_id: project?.id, project_name: project?.name };
  const inboxCount = project ? await getInboxCount(project.id, "project_opr") : 0;
  let text = `📐 <b>${user.display_name}</b> · ОПР\n${SEP}\n`;
  if (project) { text += `📍 ${project.name}\n`; if (inboxCount > 0) text += `📥 Входящих: <b>${inboxCount}</b>\n`; }
  await sendOrEdit(chatId, session, user.user_id, text, [
    [{ text: `📥 Входящие${inboxCount ? ` (${inboxCount})` : ""}`, callback_data: "opr:inbox" }],
    [{ text: "📤 Отправить", callback_data: "opr:send" }],
    [{ text: "📊 Мой прогресс", callback_data: "opr:progress" }],
    [{ text: "📂 Сменить проект", callback_data: "proj:list" }],
    [{ text: "🚀 Открыть приложение", web_app: { url: APP_URL } }],
  ], "IDLE", ctx);
}

export async function screenOPRSend(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `📤 <b>ОПР · Документация</b>\n${SEP}`, { inline_keyboard: [
    [{ text: "🔧 Определение системы", callback_data: "opr:doc:system" }],
    [{ text: "📊 Расчёты", callback_data: "opr:doc:calc" }],
    [{ text: "🔩 Узловые решения", callback_data: "opr:doc:nodes" }],
    [{ text: "🏢 Фасады и планы", callback_data: "opr:doc:facades" }],
    [{ text: "◀️ Назад", callback_data: "opr:menu" }],
  ] });
}
