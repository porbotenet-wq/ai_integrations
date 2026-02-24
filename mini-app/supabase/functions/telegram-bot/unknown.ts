// Unknown user screen
import { tgSend } from "./lib/tg.ts";
import { SEP, APP_URL } from "./lib/ui.ts";

export async function screenUnknownUser(chatId: number, firstName: string) {
  await tgSend(chatId, `👋 <b>Добро пожаловать, ${firstName}!</b>\n${SEP}\nЭто бот STSphera.\n\nВаш Telegram не привязан.\nВойдите в приложение → ⚙️ Настройки → привяжите Telegram.\n\nChat ID: <code>${chatId}</code>`,
    { inline_keyboard: [[{ text: "🚀 Открыть STSphera", web_app: { url: APP_URL } }]] });
}
