// Production screens — REAL load screen
import { tgEdit } from "../lib/tg.ts";
import { type BotUser, getProjects, getProject, getInboxCount, getFacades, getFacadeStats } from "../lib/db.ts";
import { sendOrEdit, progressBar, SEP, APP_URL } from "../lib/ui.ts";

export async function screenProductionMenu(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  const project = projectId ? await getProject(projectId) : (await getProjects())[0];
  const ctx: any = { project_id: project?.id, project_name: project?.name };
  const inboxCount = project ? await getInboxCount(project.id, "production") : 0;
  let text = `🏭 <b>${user.display_name}</b> · Производство\n${SEP}\n`;
  if (project) { text += `📍 ${project.name}\n`; if (inboxCount > 0) text += `📥 Входящих: <b>${inboxCount}</b>\n`; }
  await sendOrEdit(chatId, session, user.user_id, text, [
    [{ text: `📥 Входящие${inboxCount ? ` (${inboxCount})` : ""}`, callback_data: "prod:inbox" }],
    [{ text: "📤 Отправить", callback_data: "prod:send" }],
    [{ text: "📊 Загрузка", callback_data: "prod:load" }],
    [{ text: "📂 Сменить проект", callback_data: "proj:list" }],
    [{ text: "🚀 Открыть приложение", web_app: { url: APP_URL } }],
  ], "IDLE", ctx);
}

export async function screenProductionSend(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `📤 <b>Производство · Отчёты</b>\n${SEP}`, { inline_keyboard: [
    [{ text: "🏭 КП + ГПР", callback_data: "prod:doc:kp" }],
    [{ text: "✅ Подтверждение приёмки", callback_data: "prod:doc:accept" }],
    [{ text: "📋 Мягкая накладная", callback_data: "prod:doc:waybill" }],
    [{ text: "📦 Отчёт об остатках", callback_data: "prod:doc:stock" }],
    [{ text: "◀️ Назад", callback_data: "prod:menu" }],
  ] });
}

// REAL: Production load — facade progress
export async function screenProductionLoad(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  if (!projectId) return screenProductionMenu(chatId, user, session);

  const facades = await getFacades(projectId);
  let text = `📊 <b>Загрузка производства</b>\n${SEP}\n`;
  let grandPlan = 0, grandFact = 0;

  if (facades.length === 0) {
    text += "Нет фасадов";
  } else {
    for (const f of facades) {
      const s = await getFacadeStats(f.id);
      grandPlan += s.totalPlan;
      grandFact += s.totalFact;
      const remaining = s.totalPlan - s.totalFact;
      text += `<b>${f.name}</b>\n`;
      text += `${progressBar(s.pct)} ${s.pct}%\n`;
      text += `✅ Готово: ${s.totalFact} · ⏳ Осталось: ${remaining}\n\n`;
    }
    const grandPct = grandPlan > 0 ? Math.round((grandFact / grandPlan) * 100) : 0;
    text += `${SEP}\n<b>ИТОГО:</b> ${progressBar(grandPct)} ${grandPct}%\n`;
    text += `Готово: ${grandFact} / ${grandPlan} модулей\n`;
  }

  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
    [{ text: "◀️ Меню", callback_data: "prod:menu" }],
  ] });
}
