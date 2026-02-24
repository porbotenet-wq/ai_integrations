// Daily log creation FSM
import { tgEdit } from "../lib/tg.ts";
import { db, type BotUser } from "../lib/db.ts";
import { saveSession, clearSession } from "../lib/session.ts";
import { SEP } from "../lib/ui.ts";
import { audit } from "../lib/audit.ts";

export async function screenLogZone(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `📝 <b>Новая запись</b>\n${SEP}\nВведите название зоны / участка:`,
    { inline_keyboard: [[{ text: "✕ Отмена", callback_data: "f:menu" }]] });
  await saveSession(chatId, user.user_id, "LOG_ZONE", session.context, session.message_id);
}

export async function screenLogWorks(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `📝 <b>Журнал · ${session.context.log_zone || ""}</b>\n${SEP}\n✏️ Опишите выполненные работы:`,
    { inline_keyboard: [[{ text: "✕ Отмена", callback_data: "f:menu" }]] });
  await saveSession(chatId, user.user_id, "LOG_WORKS", session.context, session.message_id);
}

export async function screenLogWorkers(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `📝 <b>Журнал</b>\n${SEP}\n👷 Количество рабочих?`, { inline_keyboard: [
    [3,5,8,10].map(n => ({ text: String(n), callback_data: `log:w:${n}` })),
    [15,20,25,30].map(n => ({ text: String(n), callback_data: `log:w:${n}` })),
    [{ text: "✕ Отмена", callback_data: "f:menu" }],
  ] });
  await saveSession(chatId, user.user_id, "LOG_WORKERS", session.context, session.message_id);
}

export async function saveLogEntry(chatId: number, user: BotUser, session: any, workers: number) {
  const ctx = session.context;
  await db.from("daily_logs").insert({ project_id: ctx.project_id, zone_name: ctx.log_zone || null, works_description: ctx.log_works, workers_count: workers, submitted_by: user.user_id, status: "submitted" });
  await audit(chatId, user.user_id, "daily_log:submit", { zone: ctx.log_zone, workers });
  await tgEdit(chatId, session.message_id, `✅ <b>Запись сохранена</b>\n${SEP}\n📍 ${ctx.log_zone || "—"}\n📝 ${ctx.log_works?.slice(0, 80)}\n👷 ${workers} чел.`,
    { inline_keyboard: [[{ text: "📋 Журналы", callback_data: `f:logs` }], [{ text: "◀️ Меню", callback_data: "f:menu" }]] });
  await clearSession(chatId);
}
