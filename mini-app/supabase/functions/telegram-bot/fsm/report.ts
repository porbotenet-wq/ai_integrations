// Foreman report flow
import { tgEdit } from "../lib/tg.ts";
import { db, type BotUser, getFacades } from "../lib/db.ts";
import { saveSession, clearSession } from "../lib/session.ts";
import { progressBar, SEP } from "../lib/ui.ts";
import { audit } from "../lib/audit.ts";
import { screenForemanMenu } from "../screens/foreman.ts";

export async function screenForemanReportFacade(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  if (!projectId) return screenForemanMenu(chatId, user, session);
  const facades = await getFacades(projectId);
  const buttons = facades.map((f: any) => [{ text: `${f.name} (${f.total_modules} мод.)`, callback_data: `f:rf:${f.id}` }]);
  buttons.push([{ text: "✕ Отмена", callback_data: "f:menu" }]);
  await tgEdit(chatId, session.message_id, `📋 <b>Отчёт — выбор фасада</b>\n${SEP}\nВыберите фасад:`, { inline_keyboard: buttons });
  await saveSession(chatId, user.user_id, "REPORT_FACADE", { project_id: projectId }, session.message_id);
}

export async function screenForemanReportFloor(chatId: number, user: BotUser, session: any, facadeId: string) {
  const { data: facade } = await db.from("facades").select("name").eq("id", facadeId).maybeSingle();
  const { data: floors } = await db.from("floors").select("id, floor_number, modules_plan, modules_fact, status")
    .eq("facade_id", facadeId).order("floor_number", { ascending: false }).limit(20);
  const rows: any[][] = [];
  for (let i = 0; i < (floors || []).length; i += 4) {
    rows.push((floors || []).slice(i, i + 4).map((fl: any) => {
      const icon = fl.status === "done" ? "✅" : fl.status === "in_progress" ? "🔄" : "⬜";
      return { text: `${icon}${fl.floor_number}`, callback_data: `f:rfl:${fl.id}` };
    }));
  }
  rows.push([{ text: "◀️ Назад", callback_data: "f:report" }]);
  await tgEdit(chatId, session.message_id, `📋 <b>Отчёт · ${facade?.name}</b>\n${SEP}\nВыберите этаж:`, { inline_keyboard: rows });
  await saveSession(chatId, user.user_id, "REPORT_FLOOR", { ...session.context, facade_id: facadeId, facade_name: facade?.name }, session.message_id);
}

export async function screenForemanReportInput(chatId: number, user: BotUser, session: any, floorId: string) {
  const { data: floor } = await db.from("floors").select("floor_number, modules_plan, modules_fact").eq("id", floorId).maybeSingle();
  if (!floor) return;
  const remaining = Math.max(0, (floor.modules_plan || 0) - (floor.modules_fact || 0));
  await tgEdit(chatId, session.message_id,
    `📋 <b>Ввод факта</b>\n${SEP}\nФасад: ${session.context.facade_name}\nЭтаж: <b>${floor.floor_number}</b>\n\nПлан: ${floor.modules_plan}\nФакт: ${floor.modules_fact}\nОсталось: <b>${remaining}</b>\n\n✏️ Кол-во модулей за сегодня:`,
    { inline_keyboard: [
      [5,10,15,20].map(n => ({ text: String(n), callback_data: `f:rv:${n}` })),
      [25,30,40,50].map(n => ({ text: String(n), callback_data: `f:rv:${n}` })),
      [{ text: "✕ Отмена", callback_data: "f:menu" }],
    ] });
  await saveSession(chatId, user.user_id, "REPORT_INPUT", {
    ...session.context, floor_id: floorId, floor_number: floor.floor_number,
    modules_plan: floor.modules_plan, modules_fact: floor.modules_fact,
  }, session.message_id);
}

export async function screenForemanReportConfirm(chatId: number, user: BotUser, session: any, value: number) {
  const ctx = session.context;
  await tgEdit(chatId, session.message_id, `📋 <b>Подтверждение</b>\n${SEP}\nФасад: ${ctx.facade_name}\nЭтаж: <b>${ctx.floor_number}</b>\nФакт: <b>${value} мод.</b>\n\nСохранить?`,
    { inline_keyboard: [
      [{ text: "✅ Сохранить", callback_data: `f:rs:${value}` }, { text: "✏️ Изменить", callback_data: `f:rf:${ctx.facade_id}` }],
      [{ text: "✕ Отмена", callback_data: "f:menu" }],
    ] });
}

export async function saveForemanReport(chatId: number, user: BotUser, session: any, value: number) {
  const ctx = session.context;
  const today = new Date().toISOString().split("T")[0];
  const weekNum = Math.ceil(new Date().getDate() / 7);
  await db.from("plan_fact").insert({
    project_id: ctx.project_id, facade_id: ctx.facade_id, floor_id: ctx.floor_id,
    week_number: weekNum, date: today, plan_value: 0, fact_value: value,
    reported_by: user.user_id, input_type: "bot",
  });
  const newFact = (ctx.modules_fact || 0) + value;
  const newStatus = newFact >= (ctx.modules_plan || 0) ? "done" : "in_progress";
  await db.from("floors").update({ modules_fact: newFact, status: newStatus }).eq("id", ctx.floor_id);
  await audit(chatId, user.user_id, "report:submit", { floor_id: ctx.floor_id, value });
  const pct = ctx.modules_plan > 0 ? Math.round((newFact / ctx.modules_plan) * 100) : 0;
  let text = `✅ <b>Отчёт сохранён</b>\n${SEP}\nФасад: ${ctx.facade_name}\nЭтаж ${ctx.floor_number}: +<b>${value}</b> мод.\n${progressBar(pct)} ${pct}%\n`;
  if (newStatus === "done") text += "\n✅ <b>Этаж завершён!</b>";
  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
    [{ text: "📋 Ещё этаж", callback_data: "f:report" }],
    [{ text: "◀️ Меню", callback_data: "f:menu" }],
  ] });
  await clearSession(chatId);
  if (ctx.project_id) {
    await db.from("bot_event_queue").insert({
      event_type: "report.submitted", target_roles: ["pm", "director"], project_id: ctx.project_id, priority: "normal",
      payload: { reporter_name: user.display_name, floor_number: ctx.floor_number, facade_name: ctx.facade_name, value, pct },
      scheduled_at: new Date().toISOString(),
    });
  }
}
