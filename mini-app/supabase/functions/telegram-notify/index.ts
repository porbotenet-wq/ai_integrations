import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticate } from "../_shared/authMiddleware.ts";
import { getCorsHeaders } from "../_shared/corsHeaders.ts";
import {
  sendMessage,
  inlineKeyboard,
  buildCallback,
} from "../_shared/botUtils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

type NotifyType =
  | "alert"
  | "report_missing"
  | "deadline"
  | "approval"
  | "custom";

interface NotifyPayload {
  type: NotifyType;
  project_id: string;
  title: string;
  body: string;
  target_chat_ids?: (number | string)[];
  target_role?: string;
  entity_id?: string;
}

const ICON: Record<NotifyType, string> = {
  alert: "🚨",
  report_missing: "📵",
  deadline: "⏰",
  approval: "✅",
  custom: "📢",
};

async function resolveChatIds(
  targetChatIds?: (number | string)[],
  targetRole?: string,
): Promise<(number | string)[]> {
  if (targetChatIds && targetChatIds.length > 0) {
    return targetChatIds;
  }

  if (targetRole) {
    const { data, error } = await supabase
      .from("profiles")
      .select("telegram_chat_id")
      .eq("role", targetRole)
      .not("telegram_chat_id", "is", null);

    if (error || !data) return [];
    return data
      .map((p: { telegram_chat_id: number | string | null }) => p.telegram_chat_id)
      .filter(Boolean) as (number | string)[];
  }

  return [];
}

function buildText(type: NotifyType, title: string, body: string): string {
  const icon = ICON[type];
  return `${icon} <b>${title}</b>\n\n${body}`;
}

function buildButtons(type: NotifyType, entityId?: string) {
  const eid = entityId ?? "0";

  switch (type) {
    case "alert":
      return inlineKeyboard([
        [
          { text: "🔍 Подробнее", callback_data: buildCallback("view", "alert", eid) },
          { text: "❌ Закрыть", callback_data: buildCallback("close", "alert", eid) },
        ],
      ]);

    case "report_missing":
      return inlineKeyboard([
        [
          { text: "📝 Заполнить отчёт", callback_data: buildCallback("fill", "report", eid) },
        ],
      ]);

    case "deadline":
      return inlineKeyboard([
        [
          { text: "🔍 Подробнее", callback_data: buildCallback("view", "task", eid) },
          { text: "✅ Выполнено", callback_data: buildCallback("done", "task", eid) },
        ],
      ]);

    case "approval":
      return inlineKeyboard([
        [
          { text: "👍 Согласовать", callback_data: buildCallback("approve", "doc", eid) },
          { text: "👎 Отклонить", callback_data: buildCallback("reject", "doc", eid) },
        ],
        [
          { text: "🔍 Подробнее", callback_data: buildCallback("view", "doc", eid) },
        ],
      ]);

    case "custom":
      return entityId
        ? inlineKeyboard([
            [{ text: "🔍 Подробнее", callback_data: buildCallback("view", "item", eid) }],
          ])
        : undefined;

    default:
      return undefined;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const user = await authenticate(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const payload: NotifyPayload = await req.json();
    const { type, project_id, title, body, target_chat_ids, target_role, entity_id } = payload;

    const chatIds = await resolveChatIds(target_chat_ids, target_role);
    const total = chatIds.length;

    if (total === 0) {
      return new Response(
        JSON.stringify({ sent: 0, failed: 0, total: 0, note: "No recipients found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const text = buildText(type, title, body);
    const replyMarkup = buildButtons(type, entity_id);

    let sent = 0;
    let failed = 0;

    const results = await Promise.allSettled(
      chatIds.map(async (chatId) => {
        const res = await sendMessage(chatId, text, {
          parse_mode: "HTML",
          reply_markup: replyMarkup,
        });
        const json = await res.json();
        return { chatId, ok: json.ok };
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value.ok) {
        sent++;
      } else {
        failed++;
      }
    }

    await supabase.from("telegram_notification_log").insert({
      project_id,
      event_type: type,
      success: failed === 0,
      message_preview: text.slice(0, 200),
    }).then(() => {});

    return new Response(
      JSON.stringify({ sent, failed, total }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
