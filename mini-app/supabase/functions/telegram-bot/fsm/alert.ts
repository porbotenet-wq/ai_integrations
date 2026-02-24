// Alert creation FSM
import { tgEdit } from "../lib/tg.ts";
import { db, type BotUser } from "../lib/db.ts";
import { saveSession, clearSession } from "../lib/session.ts";
import { rp } from "../lib/roles.ts";
import { SEP } from "../lib/ui.ts";
import { audit } from "../lib/audit.ts";

export async function screenAlertNew(chatId: number, user: BotUser, session: any) {
  const prefix = rp(user.roles);
  await tgEdit(chatId, session.message_id, `✏️ <b>Новый алерт</b>\n${SEP}\nВыберите приоритет:`, { inline_keyboard: [
    [{ text: "🔴 Критический", callback_data: `at:critical` }, { text: "🟠 Высокий", callback_data: `at:high` }],
    [{ text: "🟡 Обычный", callback_data: `at:normal` }, { text: "⚪ Низкий", callback_data: `at:low` }],
    [{ text: "✕ Отмена", callback_data: `${prefix}:alerts` }],
  ] });
  await saveSession(chatId, user.user_id, "ALERT_PRIORITY", session.context, session.message_id);
}

export async function screenAlertTitle(chatId: number, user: BotUser, session: any, priority: string) {
  const pl: Record<string, string> = { critical: "🔴 Критический", high: "🟠 Высокий", normal: "🟡 Обычный", low: "⚪ Низкий" };
  await tgEdit(chatId, session.message_id, `✏️ <b>Алерт: ${pl[priority] || priority}</b>\n${SEP}\n✉️ Введите заголовок:`,
    { inline_keyboard: [[{ text: "✕ Отмена", callback_data: `${rp(user.roles)}:menu` }]] });
  await saveSession(chatId, user.user_id, "ALERT_TITLE", { ...session.context, alert_priority: priority }, session.message_id);
}

export async function saveAlert(chatId: number, user: BotUser, session: any, title: string) {
  const ctx = session.context;
  const { error } = await db.from("alerts").insert({
    title, priority: ctx.alert_priority || "normal", type: ctx.alert_priority === "critical" ? "danger" : "warning",
    project_id: ctx.project_id, created_by: user.user_id, is_read: false, is_resolved: false,
  });
  const prefix = rp(user.roles);
  const text = error ? `❌ Ошибка: ${error.message}` : `✅ <b>Алерт создан</b>\n${SEP}\n"${title}"\nПриоритет: ${ctx.alert_priority}`;
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [[{ text: "◀️ Меню", callback_data: `${prefix}:menu` }]] });
  if (!error) {
    await audit(chatId, user.user_id, "alert:create", { title, priority: ctx.alert_priority });
    await db.from("bot_event_queue").insert({
      event_type: "alert.created", target_roles: ["director", "pm"], project_id: ctx.project_id,
      priority: ctx.alert_priority === "critical" ? "critical" : "high",
      payload: { title, priority: ctx.alert_priority, creator: user.display_name },
      scheduled_at: new Date().toISOString(),
    });
  }
  await clearSession(chatId);
}
