// Document FSM (30+ types + 6 new PM types)
import { tgEdit } from "../lib/tg.ts";
import { db, type BotUser } from "../lib/db.ts";
import { saveSession, clearSession } from "../lib/session.ts";
import { rp, detectPrimaryRole } from "../lib/roles.ts";
import { SEP } from "../lib/ui.ts";
import { audit } from "../lib/audit.ts";

export const DOC_FSM_MAP: Record<string, { label: string; recipients: string[] }> = {
  "pm:doc:gpr": { label: "ГПР", recipients: ["project_opr", "project_km", "project_kmd", "supply", "production", "foreman1", "pto"] },
  "pm:doc:gpr_send": { label: "Рассылка ГПР", recipients: ["project_opr", "project_km", "project_kmd", "supply", "production"] },
  "pm:doc:assign": { label: "Назначение ответственных", recipients: ["director"] },
  "pm:doc:ird": { label: "ИРД", recipients: ["director", "pto"] },
  "pm:doc:docreq": { label: "Запрос документации", recipients: ["project_opr", "project_km", "project_kmd"] },
  "pm:doc:samples": { label: "Согласование образцов", recipients: ["supply", "production"] },
  "pm:doc:geodesy": { label: "Геодезическая съёмка", recipients: ["project_kmd"] },
  "pm:doc:remind": { label: "Напоминание отделу", recipients: ["project_opr", "project_km", "project_kmd", "supply", "production"] },
  "pm:doc:escalate": { label: "Эскалация", recipients: ["director"] },
  "pm:doc:photoreq": { label: "Запрос фотоотчёта", recipients: ["foreman1", "foreman2", "foreman3"] },
  "pm:doc:summary": { label: "Сводка для директора", recipients: ["director"] },
  // NEW PM → Supply
  "pm:doc:supply_status": { label: "Запрос статуса закупки", recipients: ["supply"] },
  "pm:doc:supply_request": { label: "Заявка на материалы", recipients: ["supply"] },
  "pm:doc:supply_escalate": { label: "Эскалация дефицита", recipients: ["supply", "director"] },
  // NEW PM → Production
  "pm:doc:prod_kp": { label: "Запрос КП", recipients: ["production"] },
  "pm:doc:prod_batch": { label: "Готовность партии", recipients: ["production"] },
  "pm:doc:prod_shipment": { label: "Согласование отгрузки", recipients: ["production", "supply"] },
  // OPR
  "opr:doc:system": { label: "Определение системы", recipients: ["pm"] },
  "opr:doc:calc": { label: "Расчёты", recipients: ["pm"] },
  "opr:doc:nodes": { label: "Узловые решения", recipients: ["pm", "production"] },
  "opr:doc:facades": { label: "Фасады и планы", recipients: ["pm", "project_km"] },
  // KM
  "km:doc:detail": { label: "Деталировка фасадов", recipients: ["pm", "project_kmd"] },
  "km:doc:spec": { label: "Спецификации", recipients: ["supply", "pm"] },
  "km:doc:vor": { label: "ВОР", recipients: ["pm"] },
  "km:doc:tz": { label: "ТЗ на сопутствующие", recipients: ["supply", "pm"] },
  // KMD
  "kmd:doc:geo": { label: "Наложение геодезии", recipients: ["pm"] },
  "kmd:doc:brackets": { label: "Чертежи кронштейнов", recipients: ["production", "pm"] },
  "kmd:doc:kmd": { label: "КМД", recipients: ["production", "pm"] },
  "kmd:doc:glass": { label: "Заявка на заполнения", recipients: ["supply", "pm"] },
  // Supply
  "sup:doc:status": { label: "Статус закупки", recipients: ["pm"] },
  "sup:doc:shipment": { label: "Уведомление об отгрузке", recipients: ["production", "pm"] },
  "sup:doc:mismatch": { label: "Отчёт о несхождениях", recipients: ["pm"] },
  "sup:doc:transport": { label: "Заявка на транспорт", recipients: ["pm", "production"] },
  // Production
  "prod:doc:kp": { label: "КП + ГПР", recipients: ["pm", "supply"] },
  "prod:doc:accept": { label: "Подтверждение приёмки", recipients: ["supply", "pm"] },
  "prod:doc:waybill": { label: "Мягкая накладная", recipients: ["pm"] },
  "prod:doc:stock": { label: "Отчёт об остатках", recipients: ["pm", "supply"] },
  // Foreman
  "f:doc:tool": { label: "Заявка на инструмент", recipients: ["pm", "supply"] },
  "f:doc:daily": { label: "Фотоотчёт ежедневный", recipients: ["pm"] },
  "f:doc:hidden": { label: "Акт скрытых работ", recipients: ["pto", "pm"] },
  "f:doc:issue": { label: "Проблема на площадке", recipients: ["pm"] },
  "f:doc:stage_br": { label: "Этапный: кронштейны", recipients: ["pm", "pto"] },
  "f:doc:stage_fr": { label: "Этапный: каркас", recipients: ["pm", "pto"] },
  "f:doc:stage_gl": { label: "Этапный: заполнение", recipients: ["pm", "pto"] },
  // PTO
  "pto:doc:brackets": { label: "АОСР Кронштейны", recipients: ["pm", "foreman1", "foreman2", "foreman3"] },
  "pto:doc:frame": { label: "АОСР Каркас", recipients: ["pm", "foreman1", "foreman2", "foreman3"] },
  "pto:doc:glass": { label: "АОСР Заполнение", recipients: ["pm", "foreman1", "foreman2", "foreman3"] },
  "pto:doc:schemes": { label: "Исполнительные схемы", recipients: ["pm"] },
  // Inspector
  "insp:doc:quality": { label: "Замечание по качеству", recipients: ["pm", "foreman1", "foreman2", "foreman3"] },
  "insp:doc:stop": { label: "Остановка работ", recipients: ["pm", "director", "foreman1", "foreman2", "foreman3"] },
  "insp:doc:photo": { label: "Фотофиксация нарушения", recipients: ["pm"] },
};

export async function startDocFSM(chatId: number, user: BotUser, session: any, docType: string, docLabel: string, recipients: string[]) {
  const ctx = { ...session.context, doc_type: docType, doc_label: docLabel, doc_recipients: recipients };
  await tgEdit(chatId, session.message_id,
    `📤 <b>${docLabel}</b>\n${SEP}\n📎 Отправьте файл (документ или фото):`,
    { inline_keyboard: [[{ text: "✕ Отмена", callback_data: `${rp(user.roles)}:send` }]] });
  await saveSession(chatId, user.user_id, "DOC_UPLOAD", ctx, session.message_id);
}

export async function handleDocFile(chatId: number, user: BotUser, session: any, fileUrl: string) {
  const ctx = { ...session.context, doc_file_url: fileUrl };
  await tgEdit(chatId, session.message_id,
    `📤 <b>${ctx.doc_label}</b>\n${SEP}\n📎 Файл получен\n\n💬 Добавьте комментарий или отправьте «—» для пропуска:`,
    { inline_keyboard: [[{ text: "— Без комментария", callback_data: "doc:nocomment" }], [{ text: "✕ Отмена", callback_data: `${rp(user.roles)}:send` }]] });
  await saveSession(chatId, user.user_id, "DOC_COMMENT", ctx, session.message_id);
}

export async function handleDocComment(chatId: number, user: BotUser, session: any, comment: string) {
  const ctx = { ...session.context, doc_comment: comment === "—" ? null : comment };
  const recipients = (ctx.doc_recipients || []).join(", ");
  await tgEdit(chatId, session.message_id,
    `📤 <b>Подтверждение</b>\n${SEP}\nТип: ${ctx.doc_label}\nПолучатели: ${recipients}\n📎 Файл: прикреплён\n${ctx.doc_comment ? `💬 ${ctx.doc_comment}` : ""}\n\nОтправить?`,
    { inline_keyboard: [
      [{ text: "✅ Отправить", callback_data: "doc:confirm" }],
      [{ text: "✕ Отмена", callback_data: `${rp(user.roles)}:send` }],
    ] });
  await saveSession(chatId, user.user_id, "DOC_CONFIRM", ctx, session.message_id);
}

export async function handleDocConfirm(chatId: number, user: BotUser, session: any) {
  const ctx = session.context;
  await db.from("bot_documents").insert({
    project_id: ctx.project_id, sender_id: user.user_id,
    doc_type: ctx.doc_type, file_url: ctx.doc_file_url || null,
    comment: ctx.doc_comment || null, recipients: ctx.doc_recipients || [],
    status: "sent",
  });
  for (const role of (ctx.doc_recipients || [])) {
    await db.from("bot_inbox").insert({
      project_id: ctx.project_id, from_user_id: user.user_id,
      from_role: detectPrimaryRole(user.roles), to_roles: [role],
      type: "document", title: ctx.doc_label,
      description: ctx.doc_comment || null, file_url: ctx.doc_file_url || null,
      status: "new",
    });
  }
  await db.from("bot_event_queue").insert({
    event_type: "document.sent", target_roles: ctx.doc_recipients || [],
    project_id: ctx.project_id, priority: "normal",
    payload: { doc_type: ctx.doc_type, label: ctx.doc_label, sender: user.display_name, comment: ctx.doc_comment },
    scheduled_at: new Date().toISOString(),
  });
  await audit(chatId, user.user_id, "doc:sent", { doc_type: ctx.doc_type, recipients: ctx.doc_recipients });
  const prefix = rp(user.roles);
  await tgEdit(chatId, session.message_id, `✅ <b>Документ отправлен</b>\n${SEP}\n${ctx.doc_label}\nПолучатели: ${(ctx.doc_recipients || []).join(", ")}`,
    { inline_keyboard: [[{ text: "📤 Ещё", callback_data: `${prefix}:send` }], [{ text: "◀️ Меню", callback_data: `${prefix}:menu` }]] });
  await clearSession(chatId);
}
