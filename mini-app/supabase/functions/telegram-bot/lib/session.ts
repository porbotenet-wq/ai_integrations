// Session management (TTL 8 hours = 28800000ms)
import { db } from "./db.ts";

const TTL = 28800000; // 8 hours

export async function getSession(chatId: number) {
  const { data } = await db.from("bot_sessions").select("state, context, message_id, user_id")
    .eq("chat_id", String(chatId)).gt("expires_at", new Date().toISOString()).maybeSingle();
  return data as { state: string; context: any; message_id: number | null; user_id: string } | null;
}

export async function saveSession(chatId: number, userId: string, state: string, context: any, msgId?: number) {
  await db.from("bot_sessions").upsert({
    chat_id: String(chatId), user_id: userId, state, context: context || {},
    message_id: msgId ?? null, updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + TTL).toISOString(),
  }, { onConflict: "chat_id" });
}

export async function clearSession(chatId: number) {
  await db.from("bot_sessions").update({ state: "IDLE", context: {} }).eq("chat_id", String(chatId));
}
