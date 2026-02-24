// KMD screens
import { tgEdit } from "../lib/tg.ts";
import { type BotUser, getProjects, getProject, getInboxCount } from "../lib/db.ts";
import { sendOrEdit, SEP, APP_URL } from "../lib/ui.ts";

export async function screenKMDMenu(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  const project = projectId ? await getProject(projectId) : (await getProjects())[0];
  const ctx: any = { project_id: project?.id, project_name: project?.name };
  const inboxCount = project ? await getInboxCount(project.id, "project_kmd") : 0;
  let text = `✏️ <b>${user.display_name}</b> · КМД\n${SEP}\n`;
  if (project) { text += `📍 ${project.name}\n`; if (inboxCount > 0) text += `📥 Входящих: <b>${inboxCount}</b>\n`; }
  await sendOrEdit(chatId, session, user.user_id, text, [
    [{ text: `📥 Входящие${inboxCount ? ` (${inboxCount})` : ""}`, callback_data: "kmd:inbox" }],
    [{ text: "📤 Отправить", callback_data: "kmd:send" }],
    [{ text: "📊 Мой прогресс", callback_data: "kmd:progress" }],
    [{ text: "📂 Сменить проект", callback_data: "proj:list" }],
    [{ text: "🚀 Открыть приложение", web_app: { url: APP_URL } }],
  ], "IDLE", ctx);
}

export async function screenKMDSend(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `📤 <b>КМД · Документация</b>\n${SEP}`, { inline_keyboard: [
    [{ text: "📐 Наложение геодезии", callback_data: "kmd:doc:geo" }],
    [{ text: "🔩 Чертежи кронштейнов", callback_data: "kmd:doc:brackets" }],
    [{ text: "📋 КМД → Производство", callback_data: "kmd:doc:kmd" }],
    [{ text: "🪟 Заявка на заполнения", callback_data: "kmd:doc:glass" }],
    [{ text: "◀️ Назад", callback_data: "kmd:menu" }],
  ] });
}
