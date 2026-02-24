// PM screens + NEW supply/prod send screens
import { tgEdit } from "../lib/tg.ts";
import { db, type BotUser, getProjects, getProject, getTodayPlanFact, getInboxCount } from "../lib/db.ts";
import { sendOrEdit, progressBar, todayStr, SEP, APP_URL } from "../lib/ui.ts";

export async function screenPMMenu(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  const project = projectId ? await getProject(projectId) : (await getProjects())[0];
  const ctx: any = { project_id: project?.id, project_name: project?.name };
  let text = `📋 <b>${user.display_name}</b> · Руководитель проекта\n${SEP}\n`;
  if (project) {
    text += `🏗️ <b>${project.name}</b>\n\n`;
    const inboxCount = await getInboxCount(project.id, "pm");
    const { count: pendingSend } = await db.from("bot_documents")
      .select("*", { count: "exact", head: true })
      .eq("project_id", project.id).eq("status", "draft");
    const { count: overdueCount } = await db.from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("project_id", project.id).eq("is_resolved", false)
      .in("priority", ["critical", "high"]);
    text += `📥 Входящие: <b>${inboxCount} новых</b>\n`;
    text += `📤 Ожидают отправки: <b>${pendingSend || 0}</b>\n`;
    text += `⚠️ Просрочено: <b>${overdueCount || 0}</b>\n`;
    text += `\n📅 ${todayStr()}\n`;
    const pf = await getTodayPlanFact(project.id);
    if (pf.count > 0) text += `${progressBar(pf.pct)} <b>${pf.pct}%</b> сегодня\n`;
  }
  await sendOrEdit(chatId, session, user.user_id, text, [
    [{ text: `📥 Входящие${project ? ` (${await getInboxCount(project.id, "pm") || ""})` : ""}`, callback_data: "pm:inbox" }, { text: "📤 Отправить", callback_data: "pm:send" }],
    [{ text: "📊 Обзор проекта", callback_data: "pm:dash" }, { text: "🔔 Алерты", callback_data: "pm:alerts" }],
    [{ text: "⚡ Быстрые действия", callback_data: "pm:quick" }, { text: "📋 Задачи", callback_data: "pm:tasks" }],
    [{ text: "⚙️ Настройки", callback_data: "c:settings" }, { text: "📂 Проект", callback_data: "proj:list" }],
    [{ text: "🚀 Открыть приложение", web_app: { url: APP_URL } }],
  ], "IDLE", ctx);
}

export async function screenPMSend(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `📤 <b>РП · Отправить</b>\n${SEP}\nВыберите категорию:`, { inline_keyboard: [
    [{ text: "🚀 Запуск проекта", callback_data: "pm:s:launch" }],
    [{ text: "📐 Проектные работы", callback_data: "pm:s:design" }],
    [{ text: "📦 Снабжение", callback_data: "pm:s:supply" }],
    [{ text: "🏭 Производство", callback_data: "pm:s:prod" }],
    [{ text: "◀️ Назад", callback_data: "pm:menu" }],
  ] });
}

export async function screenPMSendLaunch(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `🚀 <b>Запуск проекта</b>\n${SEP}`, { inline_keyboard: [
    [{ text: "📋 Составить ГПР", callback_data: "pm:doc:gpr" }],
    [{ text: "📨 Разослать ГПР", callback_data: "pm:doc:gpr_send" }],
    [{ text: "👤 Назначить ответственных", callback_data: "pm:doc:assign" }],
    [{ text: "📄 Подготовить ИРД", callback_data: "pm:doc:ird" }],
    [{ text: "◀️ Назад", callback_data: "pm:send" }],
  ] });
}

export async function screenPMSendDesign(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `📐 <b>Проектные работы</b>\n${SEP}`, { inline_keyboard: [
    [{ text: "📄 Запрос документации", callback_data: "pm:doc:docreq" }],
    [{ text: "✅ Согласование образцов", callback_data: "pm:doc:samples" }],
    [{ text: "📏 Геодезическая съёмка", callback_data: "pm:doc:geodesy" }],
    [{ text: "◀️ Назад", callback_data: "pm:send" }],
  ] });
}

// NEW: PM → Supply send screen
export async function screenPMSendSupply(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `📦 <b>РП → Снабжение</b>\n${SEP}\nВыберите тип документа:`, { inline_keyboard: [
    [{ text: "📊 Запрос статуса закупки", callback_data: "pm:doc:supply_status" }],
    [{ text: "📋 Заявка на материалы", callback_data: "pm:doc:supply_request" }],
    [{ text: "🔴 Эскалация дефицита", callback_data: "pm:doc:supply_escalate" }],
    [{ text: "◀️ Назад", callback_data: "pm:send" }],
  ] });
}

// NEW: PM → Production send screen
export async function screenPMSendProd(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `🏭 <b>РП → Производство</b>\n${SEP}\nВыберите тип документа:`, { inline_keyboard: [
    [{ text: "📋 Запрос КП", callback_data: "pm:doc:prod_kp" }],
    [{ text: "📦 Готовность партии", callback_data: "pm:doc:prod_batch" }],
    [{ text: "🚚 Согласование отгрузки", callback_data: "pm:doc:prod_shipment" }],
    [{ text: "◀️ Назад", callback_data: "pm:send" }],
  ] });
}

export async function screenPMQuick(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `⚡ <b>Быстрые действия</b>\n${SEP}`, { inline_keyboard: [
    [{ text: "⏰ Напоминание отделу", callback_data: "pm:doc:remind" }],
    [{ text: "🔴 Эскалация", callback_data: "pm:doc:escalate" }],
    [{ text: "📸 Запросить фотоотчёт", callback_data: "pm:doc:photoreq" }],
    [{ text: "📊 Сводка для директора", callback_data: "pm:doc:summary" }],
    [{ text: "◀️ Назад", callback_data: "pm:menu" }],
  ] });
}
