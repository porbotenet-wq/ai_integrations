// KM screens
import { tgEdit } from "../lib/tg.ts";
import { type BotUser, getProjects, getProject, getInboxCount } from "../lib/db.ts";
import { sendOrEdit, SEP, APP_URL } from "../lib/ui.ts";

export async function screenKMMenu(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  const project = projectId ? await getProject(projectId) : (await getProjects())[0];
  const ctx: any = { project_id: project?.id, project_name: project?.name };
  const inboxCount = project ? await getInboxCount(project.id, "project_km") : 0;
  let text = `📏 <b>${user.display_name}</b> · КМ\n${SEP}\n`;
  if (project) { text += `📍 ${project.name}\n`; if (inboxCount > 0) text += `📥 Входящих: <b>${inboxCount}</b>\n`; }
  await sendOrEdit(chatId, session, user.user_id, text, [
    [{ text: `📥 Входящие${inboxCount ? ` (${inboxCount})` : ""}`, callback_data: "km:inbox" }],
    [{ text: "📤 Отправить", callback_data: "km:send" }],
    [{ text: "📊 Мой прогресс", callback_data: "km:progress" }],
    [{ text: "📂 Сменить проект", callback_data: "proj:list" }],
    [{ text: "🚀 Открыть приложение", web_app: { url: APP_URL } }],
  ], "IDLE", ctx);
}

export async function screenKMSend(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `📤 <b>КМ · Документация</b>\n${SEP}`, { inline_keyboard: [
    [{ text: "📋 Деталировка фасадов", callback_data: "km:doc:detail" }],
    [{ text: "📦 Спецификации → Снабж.", callback_data: "km:doc:spec" }],
    [{ text: "📊 ВОР → РП", callback_data: "km:doc:vor" }],
    [{ text: "🔩 ТЗ на сопутствующие", callback_data: "km:doc:tz" }],
    [{ text: "◀️ Назад", callback_data: "km:menu" }],
  ] });
}
