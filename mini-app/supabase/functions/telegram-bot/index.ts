// STSphera Telegram Bot v4 — Modular Entry Point
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleUpdate } from "./dispatcher.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";

serve(async (req) => {
  if (req.method !== "POST") return new Response("OK");

  if (WEBHOOK_SECRET) {
    const headerSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
    if (headerSecret !== WEBHOOK_SECRET) {
      console.warn("[Bot v4] Webhook secret mismatch");
    }
  }

  try {
    const update = await req.json();
    const chatId = update.message?.chat?.id || update.callback_query?.from?.id;

    console.log("[Bot v4]", JSON.stringify({
      text: update.message?.text, chat: chatId, cb: update.callback_query?.data,
    }));

    if (chatId) {
      const { allowed } = checkRateLimit(`bot:${chatId}`, 30, 60_000);
      if (!allowed) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: "⏳ Слишком много запросов. Подождите минуту." }),
        });
        return new Response("OK");
      }
    }

    await handleUpdate(update);
  } catch (err) {
    console.error("[Bot v4] ERROR:", err instanceof Error ? err.stack || err.message : String(err));
    try {
      const body = await req.clone().json().catch(() => null);
      const chatId = body?.message?.chat?.id || body?.callback_query?.from?.id;
      if (chatId) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: "⚠️ Произошла ошибка. Попробуйте /start" }),
        });
      }
    } catch (_) { /* ignore fallback error */ }
  }
  return new Response("OK");
});
