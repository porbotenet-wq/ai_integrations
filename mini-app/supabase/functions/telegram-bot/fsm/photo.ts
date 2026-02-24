// Photo FSM
import { tgEdit } from "../lib/tg.ts";
import { db, type BotUser, getFacades } from "../lib/db.ts";
import { saveSession, clearSession } from "../lib/session.ts";
import { detectPrimaryRole } from "../lib/roles.ts";
import { SEP } from "../lib/ui.ts";
import { audit } from "../lib/audit.ts";
import { screenForemanMenu } from "../screens/foreman.ts";

export const PHOTO_TYPES: Record<string, string> = { daily: "Ежедневный", brackets: "Кронштейны", frame: "Каркас", glass: "Заполнение" };

export async function startPhotoFSM(chatId: number, user: BotUser, session: any, photoType: string) {
  const projectId = session?.context?.project_id;
  if (!projectId) return screenForemanMenu(chatId, user, session);
  const facades = await getFacades(projectId);
  const buttons = facades.map((f: any) => [{ text: `🏗️ ${f.name}`, callback_data: `f:pf:${f.id}` }]);
  buttons.push([{ text: "✕ Отмена", callback_data: "f:menu" }]);
  await tgEdit(chatId, session.message_id, `📸 <b>${PHOTO_TYPES[photoType] || photoType}</b>\n${SEP}\nВыберите фасад:`, { inline_keyboard: buttons });
  await saveSession(chatId, user.user_id, "PHOTO_FACADE", { ...session.context, photo_type: photoType, photo_label: PHOTO_TYPES[photoType] || photoType, photo_urls: [] }, session.message_id);
}

export async function screenPhotoFloor(chatId: number, user: BotUser, session: any, facadeId: string) {
  const { data: facade } = await db.from("facades").select("name").eq("id", facadeId).maybeSingle();
  const { data: floors } = await db.from("floors").select("id, floor_number, status")
    .eq("facade_id", facadeId).order("floor_number", { ascending: false }).limit(20);
  const rows: any[][] = [];
  for (let i = 0; i < (floors || []).length; i += 4) {
    rows.push((floors || []).slice(i, i + 4).map((fl: any) => {
      const icon = fl.status === "done" ? "✅" : fl.status === "in_progress" ? "🔄" : "⬜";
      return { text: `${icon}${fl.floor_number}`, callback_data: `f:pfl:${fl.id}` };
    }));
  }
  rows.push([{ text: "✕ Отмена", callback_data: "f:menu" }]);
  await tgEdit(chatId, session.message_id, `📸 <b>${session.context.photo_label} · ${facade?.name}</b>\n${SEP}\nВыберите этаж:`, { inline_keyboard: rows });
  await saveSession(chatId, user.user_id, "PHOTO_FLOOR", { ...session.context, facade_id: facadeId, facade_name: facade?.name }, session.message_id);
}

export async function screenPhotoUpload(chatId: number, user: BotUser, session: any, floorId: string) {
  const { data: floor } = await db.from("floors").select("floor_number").eq("id", floorId).maybeSingle();
  const ctx = { ...session.context, floor_id: floorId, floor_number: floor?.floor_number, photo_urls: [] };
  await tgEdit(chatId, session.message_id,
    `📸 <b>${ctx.photo_label}</b>\n${SEP}\n🏗️ ${ctx.facade_name} · Этаж ${ctx.floor_number}\n\n📷 Отправьте фото (до 5 шт.):\nЗагружено: <b>0 / 5</b>`,
    { inline_keyboard: [[{ text: "✕ Отмена", callback_data: "f:menu" }]] });
  await saveSession(chatId, user.user_id, "PHOTO_UPLOAD", ctx, session.message_id);
}

export async function handlePhotoFile(chatId: number, user: BotUser, session: any, fileUrl: string) {
  const urls = [...(session.context.photo_urls || []), fileUrl];
  const ctx = { ...session.context, photo_urls: urls };
  const count = urls.length;
  if (count >= 5) {
    await tgEdit(chatId, session.message_id,
      `📸 <b>${ctx.photo_label}</b>\n${SEP}\n🏗️ ${ctx.facade_name} · Этаж ${ctx.floor_number}\n\n✅ Загружено: <b>${count} / 5</b>\n\n💬 Добавьте комментарий или пропустите:`,
      { inline_keyboard: [[{ text: "— Без комментария", callback_data: "f:pc:skip" }], [{ text: "✕ Отмена", callback_data: "f:menu" }]] });
    await saveSession(chatId, user.user_id, "PHOTO_COMMENT", ctx, session.message_id);
  } else {
    await tgEdit(chatId, session.message_id,
      `📸 <b>${ctx.photo_label}</b>\n${SEP}\n🏗️ ${ctx.facade_name} · Этаж ${ctx.floor_number}\n\n📷 Загружено: <b>${count} / 5</b>\n\nОтправьте ещё фото или нажмите «Готово»:`,
      { inline_keyboard: [[{ text: `✅ Готово (${count})`, callback_data: "f:pc:done" }], [{ text: "✕ Отмена", callback_data: "f:menu" }]] });
    await saveSession(chatId, user.user_id, "PHOTO_UPLOAD", ctx, session.message_id);
  }
}

export async function screenPhotoComment(chatId: number, user: BotUser, session: any) {
  const ctx = session.context;
  const count = (ctx.photo_urls || []).length;
  await tgEdit(chatId, session.message_id,
    `📸 <b>${ctx.photo_label}</b>\n${SEP}\n🏗️ ${ctx.facade_name} · Этаж ${ctx.floor_number}\n✅ Фото: <b>${count}</b>\n\n💬 Добавьте комментарий или пропустите:`,
    { inline_keyboard: [[{ text: "— Без комментария", callback_data: "f:pc:skip" }], [{ text: "✕ Отмена", callback_data: "f:menu" }]] });
  await saveSession(chatId, user.user_id, "PHOTO_COMMENT", ctx, session.message_id);
}

export async function handlePhotoComment(chatId: number, user: BotUser, session: any, comment: string | null) {
  const ctx = { ...session.context, photo_comment: comment };
  const count = (ctx.photo_urls || []).length;
  await tgEdit(chatId, session.message_id,
    `📸 <b>Подтверждение</b>\n${SEP}\nТип: ${ctx.photo_label}\n🏗️ ${ctx.facade_name} · Этаж ${ctx.floor_number}\n📷 Фото: <b>${count}</b>\n${ctx.photo_comment ? `💬 ${ctx.photo_comment}` : ""}\n\nОтправить?`,
    { inline_keyboard: [
      [{ text: "✅ Отправить", callback_data: "f:pc:confirm" }],
      [{ text: "✕ Отмена", callback_data: "f:menu" }],
    ] });
  await saveSession(chatId, user.user_id, "PHOTO_CONFIRM", ctx, session.message_id);
}

export async function handlePhotoConfirm(chatId: number, user: BotUser, session: any) {
  const ctx = session.context;
  await db.from("bot_documents").insert({
    project_id: ctx.project_id, sender_id: user.user_id,
    doc_type: `photo_${ctx.photo_type}`, file_url: (ctx.photo_urls || [])[0] || null,
    comment: ctx.photo_comment || null, recipients: ["pm", "pto"], status: "sent",
  });
  await db.from("bot_inbox").insert({
    project_id: ctx.project_id, from_user_id: user.user_id,
    from_role: detectPrimaryRole(user.roles), to_roles: ["pm", "pto"],
    type: "photo_report", title: `📸 ${ctx.photo_label} · ${ctx.facade_name} эт.${ctx.floor_number}`,
    description: ctx.photo_comment || null, file_url: (ctx.photo_urls || [])[0] || null, status: "new",
  });
  if (ctx.floor_id && ctx.photo_urls?.length > 0) {
    const { data: fl } = await db.from("floors").select("photo_urls").eq("id", ctx.floor_id).maybeSingle();
    const existing = fl?.photo_urls || [];
    await db.from("floors").update({ photo_urls: [...existing, ...ctx.photo_urls] }).eq("id", ctx.floor_id);
  }
  await db.from("bot_event_queue").insert({
    event_type: "photo.uploaded", target_roles: ["pm"],
    project_id: ctx.project_id, priority: "normal",
    payload: { reporter: user.display_name, type: ctx.photo_label, facade: ctx.facade_name, floor: ctx.floor_number, count: (ctx.photo_urls || []).length },
    scheduled_at: new Date().toISOString(),
  });
  await audit(chatId, user.user_id, "photo:submit", { type: ctx.photo_type, facade: ctx.facade_name, floor: ctx.floor_number, count: (ctx.photo_urls || []).length });
  await tgEdit(chatId, session.message_id,
    `✅ <b>Фотоотчёт отправлен</b>\n${SEP}\n${ctx.photo_label}\n🏗️ ${ctx.facade_name} · Этаж ${ctx.floor_number}\n📷 ${(ctx.photo_urls || []).length} фото`,
    { inline_keyboard: [[{ text: "📸 Ещё фотоотчёт", callback_data: "f:photo" }], [{ text: "◀️ Меню", callback_data: "f:menu" }]] });
  await clearSession(chatId);
}
