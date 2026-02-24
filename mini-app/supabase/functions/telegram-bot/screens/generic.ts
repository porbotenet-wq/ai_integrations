// Generic fallback screen
import { type BotUser, getProjects, getProject } from "../lib/db.ts";
import { sendOrEdit, todayStr, SEP, APP_URL } from "../lib/ui.ts";

export async function screenGenericMenu(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  const project = projectId ? await getProject(projectId) : (await getProjects())[0];
  const ctx: any = { project_id: project?.id, project_name: project?.name };
  let text = `👤 <b>${user.display_name}</b> · ${user.roles.join(", ") || "Сотрудник"}\n${SEP}\n📅 ${todayStr()}\n\n`;
  if (project) text += `🏗️ ${project.name}\n`;
  await sendOrEdit(chatId, session, user.user_id, text, [
    [{ text: "📊 Дашборд", callback_data: "g:dash" }, { text: "🔔 Алерты", callback_data: "g:alerts" }],
    [{ text: "📋 Задачи", callback_data: "g:tasks" }, { text: "📋 Журналы", callback_data: "g:logs" }],
    [{ text: "📂 Проект", callback_data: "proj:list" }, { text: "⚙️ Настройки", callback_data: "c:settings" }],
    [{ text: "🚀 Открыть приложение", web_app: { url: APP_URL } }],
  ], "IDLE", ctx);
}
