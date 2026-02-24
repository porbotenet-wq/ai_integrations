// Audit logging
import { db } from "./db.ts";

export async function audit(chatId: number, userId: string, action: string, payload?: object) {
  await db.from("bot_audit_log").insert({ chat_id: String(chatId), user_id: userId, action, payload: payload || {} });
}
