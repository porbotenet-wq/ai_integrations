// TG API helpers
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
export const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function tgSend(chatId: number, text: string, markup?: object): Promise<number | null> {
  const res = await fetch(`${TG}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...(markup ? { reply_markup: markup } : {}) }) });
  const j = await res.json();
  if (!j.ok) console.error(`[tgSend] FAILED:`, JSON.stringify(j));
  return j.ok ? j.result.message_id : null;
}

export async function tgEdit(chatId: number, msgId: number, text: string, markup?: object) {
  await fetch(`${TG}/editMessageText`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: msgId, text, parse_mode: "HTML", disable_web_page_preview: true, ...(markup ? { reply_markup: markup } : {}) }) });
}

export async function tgAnswer(cbId: string, text?: string) {
  await fetch(`${TG}/answerCallbackQuery`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: cbId, ...(text ? { text } : {}) }) });
}

export async function tgDeleteMsg(chatId: number, msgId: number) {
  await fetch(`${TG}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: msgId }) }).catch(() => {});
}

export { BOT_TOKEN };
