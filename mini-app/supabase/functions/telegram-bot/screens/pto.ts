// PTO screens — IMPROVED registry with real bot_documents
import { tgEdit } from "../lib/tg.ts";
import { db, type BotUser, getProjects, getProject, getInboxCount } from "../lib/db.ts";
import { sendOrEdit, SEP, APP_URL } from "../lib/ui.ts";

export async function screenPTOMenu(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  const project = projectId ? await getProject(projectId) : (await getProjects())[0];
  const ctx: any = { project_id: project?.id, project_name: project?.name };
  const inboxCount = project ? await getInboxCount(project.id, "pto") : 0;
  let text = `📁 <b>${user.display_name}</b> · ПТО\n${SEP}\n`;
  if (project) { text += `📍 ${project.name}\n`; if (inboxCount > 0) text += `📥 Входящих: <b>${inboxCount}</b>\n`; }
  await sendOrEdit(chatId, session, user.user_id, text, [
    [{ text: `📥 Входящие${inboxCount ? ` (${inboxCount})` : ""}`, callback_data: "pto:inbox" }],
    [{ text: "📤 Отправить АОСР", callback_data: "pto:send" }],
    [{ text: "📊 Реестр документов", callback_data: "pto:registry" }],
    [{ text: "📂 Сменить проект", callback_data: "proj:list" }],
    [{ text: "🚀 Открыть приложение", web_app: { url: APP_URL } }],
  ], "IDLE", ctx);
}

export async function screenPTOSend(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `📤 <b>ПТО · Исп. документация</b>\n${SEP}`, { inline_keyboard: [
    [{ text: "🔩 АОСР Кронштейны", callback_data: "pto:doc:brackets" }],
    [{ text: "🏗️ АОСР Каркас", callback_data: "pto:doc:frame" }],
    [{ text: "🪟 АОСР Заполнение", callback_data: "pto:doc:glass" }],
    [{ text: "📋 Исполнительные схемы", callback_data: "pto:doc:schemes" }],
    [{ text: "◀️ Назад", callback_data: "pto:menu" }],
  ] });
}

// IMPROVED: PTO Registry with last 5 bot_documents + total count
export async function screenPTORegistry(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  let text = `📊 <b>Реестр документов</b>\n${SEP}\n`;
  if (projectId) {
    // Total from documents table
    const { count: totalDocs } = await db.from("documents").select("*", { count: "exact", head: true }).eq("project_id", projectId);
    // Last 5 from bot_documents
    const { data: recentDocs } = await db.from("bot_documents")
      .select("doc_type, comment, created_at, status")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(5);

    text += `📁 Всего документов: <b>${totalDocs || 0}</b>\n\n`;

    if (recentDocs && recentDocs.length > 0) {
      text += `<b>Последние через бот:</b>\n`;
      for (const d of recentDocs) {
        const date = new Date(d.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
        const statusIcon = d.status === "sent" ? "✅" : "📝";
        text += `${statusIcon} ${d.doc_type} · ${date}\n`;
        if (d.comment) text += `   <i>${d.comment.slice(0, 40)}</i>\n`;
      }
    } else {
      text += `<i>Нет документов через бот</i>\n`;
    }
  } else { text += "Выберите проект"; }

  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
    [{ text: "🚀 В приложении", web_app: { url: APP_URL } }],
    [{ text: "◀️ Назад", callback_data: "pto:menu" }],
  ] });
}
