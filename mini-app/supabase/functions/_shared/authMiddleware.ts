// Auth middleware for Edge Functions
// Validates either Supabase JWT or Telegram initData

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateInitDataAsync } from "./validateTelegram.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

export interface AuthUser {
  id: string;            // Supabase user_id
  telegramId?: number;   // Telegram user id (if auth via initData)
  method: "jwt" | "telegram";
}

/**
 * Authenticate request via Supabase JWT (Authorization header)
 * or Telegram initData (x-telegram-init-data header).
 * Returns AuthUser or null.
 */
export async function authenticate(req: Request): Promise<AuthUser | null> {
  // 1. Try Supabase JWT
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (user && !error) {
      return { id: user.id, method: "jwt" };
    }
  }

  // 2. Try Telegram initData
  const initData = req.headers.get("x-telegram-init-data");
  if (initData && BOT_TOKEN) {
    const tgUser = await validateInitDataAsync(initData, BOT_TOKEN);
    if (tgUser) {
      // Look up Supabase user by telegram_id
      const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("telegram_chat_id", tgUser.id)
        .single();

      if (profile) {
        return { id: profile.user_id, telegramId: tgUser.id, method: "telegram" };
      }
    }
  }

  return null;
}
