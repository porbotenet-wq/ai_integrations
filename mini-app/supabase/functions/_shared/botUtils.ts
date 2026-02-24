// Telegram Bot API helpers for Edge Functions

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendMessage(
  chatId: number | string,
  text: string,
  options?: {
    reply_markup?: unknown;
    parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  }
) {
  const res = await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode || "HTML",
      reply_markup: options?.reply_markup,
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[botUtils] sendMessage FAILED ${res.status}:`, body);
  }
  return res;
}

export async function editMessage(
  chatId: number | string,
  messageId: number,
  text: string,
  options?: { reply_markup?: unknown }
) {
  return fetch(`${API}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      reply_markup: options?.reply_markup,
      disable_web_page_preview: true,
    }),
  });
}

export async function answerCallback(callbackQueryId: string, text?: string) {
  return fetch(`${API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    }),
  });
}

export async function deleteMessage(chatId: number | string, messageId: number) {
  return fetch(`${API}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
  });
}

// Inline keyboard builder
export function inlineKeyboard(
  rows: { text: string; callback_data?: string; web_app?: { url: string } }[][]
) {
  return { inline_keyboard: rows };
}

// Callback data parser: "action:entity:id:extra"
export function parseCallback(data: string) {
  const [action, entity, id, extra] = data.split(":");
  return { action, entity, id, extra };
}

export function buildCallback(
  action: string,
  entity?: string,
  id?: string,
  extra?: string
) {
  return [action, entity, id, extra].filter(Boolean).join(":");
}
