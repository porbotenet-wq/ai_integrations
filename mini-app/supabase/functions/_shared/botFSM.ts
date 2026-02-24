import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

export type BotState =
  | "idle"
  | "report:select_project"
  | "report:select_zone"
  | "report:works"
  | "report:volume"
  | "report:workers"
  | "report:issues"
  | "report:confirm";

export interface SessionContext {
  project_id?: string;
  project_name?: string;
  zone_name?: string;
  works?: string;
  volume?: string;
  workers?: string;
  issues?: string;
}

export async function getSession(
  telegramId: number
): Promise<{ state: BotState; context: SessionContext }> {
  const { data } = await supabase
    .from("bot_sessions")
    .select("state, context")
    .eq("telegram_id", telegramId)
    .single();

  if (!data) {
    await supabase
      .from("bot_sessions")
      .insert({ telegram_id: telegramId, state: "idle", context: {} });
    return { state: "idle", context: {} };
  }

  return {
    state: data.state as BotState,
    context: data.context as SessionContext,
  };
}

export async function setState(
  telegramId: number,
  state: BotState,
  context?: Partial<SessionContext>
) {
  const { data: existing } = await supabase
    .from("bot_sessions")
    .select("context")
    .eq("telegram_id", telegramId)
    .single();

  const merged = { ...(existing?.context || {}), ...(context || {}) };

  await supabase.from("bot_sessions").upsert({
    telegram_id: telegramId,
    state,
    context: merged,
    updated_at: new Date().toISOString(),
  });
}

export async function resetSession(telegramId: number) {
  await supabase.from("bot_sessions").upsert({
    telegram_id: telegramId,
    state: "idle",
    context: {},
    updated_at: new Date().toISOString(),
  });
}

export const STEP_PROMPTS: Record<string, string> = {
  "report:works":
    "🔨 Какие работы выполнены сегодня?\n\n<i>Напишите текстом</i>",
  "report:volume":
    "📏 Объём выполненных работ?\n\n<i>Например: 45 м², 12 шт</i>",
  "report:workers":
    "👷 Количество рабочих на участке?\n\n<i>Напишите число</i>",
  "report:issues":
    '⚠️ Проблемы или замечания?\n\n<i>Напишите текстом или отправьте «Нет»</i>',
};
