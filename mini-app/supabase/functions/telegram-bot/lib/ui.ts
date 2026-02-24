// UI helpers
import { tgEdit, tgSend } from "./tg.ts";
import { saveSession } from "./session.ts";

const RAW_APP_URL = Deno.env.get("MINI_APP_URL") || "https://smr-sfera.lovable.app";
export const APP_URL = RAW_APP_URL.startsWith("http") ? RAW_APP_URL : `https://${RAW_APP_URL}`;
export const SEP = "─".repeat(29);

export function progressBar(pct: number): string {
  const filled = Math.round(Math.min(pct, 100) / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

export const todayStr = () => new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

export const pe: Record<string, string> = { critical: "🔴", high: "🟠", normal: "🟡", low: "⚪" };
export const typeIcons: Record<string, string> = { daily_log: "📋", material_request: "📦", task_completion: "✔️", budget: "💰", other: "📌" };
export const typeLabels: Record<string, string> = { daily_log: "Дневной отчёт", material_request: "Заявка на материалы", task_completion: "Завершение задачи", budget: "Бюджет" };

export async function sendOrEdit(chatId: number, session: any, userId: string, text: string, buttons: any[][], state = "IDLE", ctx?: any) {
  const msgId = session?.message_id;
  if (msgId) {
    await tgEdit(chatId, msgId, text, { inline_keyboard: buttons });
    await saveSession(chatId, userId, state, ctx || session?.context || {}, msgId);
  } else {
    const n = await tgSend(chatId, text, { inline_keyboard: buttons });
    await saveSession(chatId, userId, state, ctx || {}, n ?? undefined);
  }
}
