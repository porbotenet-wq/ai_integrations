// Supply screens — REAL status/deficit screens (replacing stubs)
import { tgEdit } from "../lib/tg.ts";
import { db, type BotUser, getProjects, getProject, getInboxCount, getDeficitMaterials } from "../lib/db.ts";
import { sendOrEdit, progressBar, SEP, APP_URL } from "../lib/ui.ts";
import { rp } from "../lib/roles.ts";

export async function screenSupplyMenu(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  const project = projectId ? await getProject(projectId) : (await getProjects())[0];
  const ctx: any = { project_id: project?.id, project_name: project?.name };
  const inboxCount = project ? await getInboxCount(project.id, "supply") : 0;
  const deficit = project ? await getDeficitMaterials(project.id) : [];
  let text = `📦 <b>${user.display_name}</b> · Снабжение\n${SEP}\n`;
  if (project) {
    text += `📍 ${project.name}\n`;
    if (inboxCount > 0) text += `📥 Входящих: <b>${inboxCount}</b>\n`;
    if (deficit.length > 0) text += `🔴 Дефицит: <b>${deficit.length}</b> позиций\n`;
  }
  await sendOrEdit(chatId, session, user.user_id, text, [
    [{ text: `📥 Входящие${inboxCount ? ` (${inboxCount})` : ""}`, callback_data: "sup:inbox" }],
    [{ text: "📤 Отправить", callback_data: "sup:send" }],
    [{ text: "📊 Статус закупок", callback_data: "sup:status" }],
    [{ text: "🔴 Дефицит", callback_data: "sup:deficit" }],
    [{ text: "🚀 Открыть приложение", web_app: { url: APP_URL } }],
  ], "IDLE", ctx);
}

export async function screenSupplySend(chatId: number, user: BotUser, session: any) {
  await tgEdit(chatId, session.message_id, `📤 <b>Снабжение · Отчёты</b>\n${SEP}`, { inline_keyboard: [
    [{ text: "📊 Статус закупки", callback_data: "sup:doc:status" }],
    [{ text: "🚚 Уведом. об отгрузке", callback_data: "sup:doc:shipment" }],
    [{ text: "⚠️ Отчёт о несхождениях", callback_data: "sup:doc:mismatch" }],
    [{ text: "🚛 Заявка на транспорт", callback_data: "sup:doc:transport" }],
    [{ text: "◀️ Назад", callback_data: "sup:menu" }],
  ] });
}

// REAL: Supply status from orders table
export async function screenSupplyStatus(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  if (!projectId) return screenSupplyMenu(chatId, user, session);

  const { data: orders } = await db.from("orders")
    .select("id, material_name, status, quantity, unit, expected_delivery, supplier")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(10);

  const statusIcons: Record<string, string> = { ordered: "📦", shipped: "🚚", delivered: "✅", delayed: "🔴", draft: "📝" };
  const statusLabels: Record<string, string> = { ordered: "Заказано", shipped: "В пути", delivered: "Доставлено", delayed: "Задержка", draft: "Черновик" };

  let text = `📊 <b>Статус закупок</b>\n${SEP}\n`;
  if (!orders || orders.length === 0) {
    text += "Нет заказов";
  } else {
    for (const o of orders) {
      const icon = statusIcons[o.status] || "📌";
      const label = statusLabels[o.status] || o.status;
      const eta = o.expected_delivery ? ` · ETA ${new Date(o.expected_delivery).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}` : "";
      text += `${icon} <b>${o.material_name}</b>\n   ${label} · ${o.quantity} ${o.unit}${eta}\n`;
      if (o.supplier) text += `   Поставщик: ${o.supplier}\n`;
      text += "\n";
    }
  }

  await tgEdit(chatId, session.message_id, text, { inline_keyboard: [
    [{ text: "🔴 Дефицит", callback_data: "sup:deficit" }],
    [{ text: "◀️ Меню", callback_data: "sup:menu" }],
  ] });
}

// REAL: Supply deficit detail
export async function screenSupplyDeficit(chatId: number, user: BotUser, session: any) {
  const projectId = session?.context?.project_id;
  if (!projectId) return screenSupplyMenu(chatId, user, session);

  const { data: materials } = await db.from("materials")
    .select("id, name, unit, total_required, on_site, deficit, eta")
    .eq("project_id", projectId)
    .gt("deficit", 0)
    .order("deficit", { ascending: false })
    .limit(10);

  let text = `🔴 <b>Дефицит материалов</b>\n${SEP}\n`;
  if (!materials || materials.length === 0) {
    text += "✅ Дефицита нет";
  } else {
    text += `⚠️ <b>${materials.length}</b> позиций:\n\n`;
    for (const m of materials) {
      const etaStr = m.eta ? ` · ETA ${new Date(m.eta).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}` : "";
      text += `📌 <b>${m.name}</b>\n`;
      text += `   Нужно: ${m.total_required} ${m.unit} · На объекте: ${m.on_site}\n`;
      text += `   🔴 Дефицит: <b>${m.deficit} ${m.unit}</b>${etaStr}\n\n`;
    }
  }

  const prefix = rp(user.roles);
  const buttons: any[][] = [];
  if (materials && materials.length > 0) {
    buttons.push([{ text: "📋 Заявка на закупку", callback_data: "sup:doc:status" }]);
  }
  buttons.push([{ text: "📊 Статус закупок", callback_data: "sup:status" }]);
  buttons.push([{ text: "◀️ Меню", callback_data: "sup:menu" }]);

  await tgEdit(chatId, session.message_id, text, { inline_keyboard: buttons });
}
