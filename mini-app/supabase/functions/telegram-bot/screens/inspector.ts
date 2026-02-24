// Inspector screens — REAL acceptance screen
import { tgEdit } from "../lib/tg.ts";
import { db, type BotUser, getProjects, getProject, getInboxCount } from "../lib/db.ts";
import { sendOrEdit, SEP, APP_URL } from "../lib/ui.ts";
import { audit } from "../lib/audit.ts";

export async function screenInspectorMenu(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  const project = projectId ? await getProject(projectId) : (await getProjects())[0];
  const ctx: any = { project_id: project?.id, project_name: project?.name };
  const inboxCount = project ? await getInboxCount(project.id, "inspector") : 0;
  let text = `🔍 <b>${user.display_name}</b> · Технадзор\n${SEP}\n`;
  if (project) { text += `📍 ${project.name}\n`; if (inboxCount > 0) text += `📥 Входящих: <b>${inboxCount}</b>\n`; }
  await sendOrEdit(chatId, session, user.user_id, text, [
    [{ text: `📥 Входящие${inboxCount ? ` (${inboxCount})` : ""}`, callback_data: "insp:inbox" }],
    [{ text: "📤 Предписание", callback_data: "insp:send" }],
    [{ text: "✅ Приёмка этапа", callback_data: "insp:accept" }],
    [{ text: "📊 История проверок", callback_data: "insp:history" }],
    [{ text: "🚀 Открыть приложение", web_app: { url: APP_URL } }],
  ], "IDLE", ctx);
}

export async function screenInspectorSend(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `📤 <b>Предписание</b>\n${SEP}\nВыберите тип:`, { inline_keyboard: [
    [{ text: "⚠️ Замечание по качеству", callback_data: "insp:doc:quality" }],
    [{ text: "🛑 Остановка работ", callback_data: "insp:doc:stop" }],
    [{ text: "📸 Фотофиксация", callback_data: "insp:doc:photo" }],
    [{ text: "◀️ Назад", callback_data: "insp:menu" }],
  ] });
}

// REAL: Inspector acceptance from stage_acceptance
export async function screenInspectorAccept(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  if (!projectId) return screenInspectorMenu(chatId, user, session);

  const { data: stages } = await db.from("stage_acceptance")
    .select("id, stage, status, facade_id, floor_id, notes, created_at, facades(name), floors(floor_number)")
    .eq("project_id", projectId)
    .eq("status", "pending_inspector")
    .order("created_at", { ascending: false })
    .limit(10);

  let text = `✅ <b>Приёмка этапов</b>\n${SEP}\n`;
  if (!stages || stages.length === 0) {
    text += "✅ Нет этапов на приёмку";
    await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
      [{ text: "◀️ Меню", callback_data: "insp:menu" }],
    ] });
    return;
  }

  text += `Ожидают приёмки: <b>${stages.length}</b>\n\n`;
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i] as any;
    const facadeName = s.facades?.name || "—";
    const floorNum = s.floors?.floor_number || "—";
    text += `${i + 1}. <b>${s.stage}</b>\n   ${facadeName} · Этаж ${floorNum}\n`;
    if (s.notes) text += `   <i>${s.notes.slice(0, 40)}</i>\n`;
    text += "\n";
  }

  const buttons: any[][] = [];
  for (const s of (stages as any[]).slice(0, 4)) {
    buttons.push([
      { text: `✅ ${s.stage.slice(0, 16)}`, callback_data: `insp:acc:${s.id}` },
      { text: `❌`, callback_data: `insp:rej:${s.id}` },
    ]);
  }
  buttons.push([{ text: "◀️ Меню", callback_data: "insp:menu" }]);

  await tgEdit(chatId, session.message_id, text, { inline_keyboard: buttons });
}

// Handle accept/reject
export async function handleInspectorDecision(chatId: number, user: BotUser, session: any, stageId: string, decision: "accepted" | "rejected") {
  const update: any = {
    status: decision,
    inspector_id: user.user_id,
    inspected_at: new Date().toISOString(),
  };
  if (decision === "accepted") update.accepted_at = new Date().toISOString();

  await db.from("stage_acceptance").update(update).eq("id", stageId);
  await audit(chatId, user.user_id, `inspection:${decision}`, { stage_id: stageId });

  const icon = decision === "accepted" ? "✅" : "❌";
  const label = decision === "accepted" ? "принят" : "отклонён";
  await tgEdit(chatId, session.message_id, `${icon} Этап <b>${label}</b>`, { inline_keyboard: [
    [{ text: "✅ Приёмка", callback_data: "insp:accept" }],
    [{ text: "◀️ Меню", callback_data: "insp:menu" }],
  ] });
}

export async function screenInspectorHistory(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  let text = `📊 <b>История проверок</b>\n${SEP}\n`;
  if (projectId) {
    const { data } = await db.from("bot_documents").select("doc_type, comment, created_at")
      .eq("project_id", projectId).eq("sender_id", user.user_id).order("created_at", { ascending: false }).limit(10);
    if (!data || data.length === 0) { text += "Нет записей"; }
    else {
      for (const d of data) {
        text += `📋 ${d.doc_type} · ${new Date(d.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}\n`;
        if (d.comment) text += `   <i>${d.comment.slice(0, 50)}</i>\n`;
      }
    }
  } else { text += "Выберите проект"; }
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
    [{ text: "◀️ Назад", callback_data: "insp:menu" }],
  ] });
}
