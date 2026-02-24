// supabase/functions/bot-notify-worker/index.ts
// ═══════════════════════════════════════════════════════════════
// Воркер очереди уведомлений — запускать cron каждую минуту
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SB_URL    = Deno.env.get("SUPABASE_URL")!;
const SB_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db        = createClient(SB_URL, SB_KEY);
const TG        = `https://api.telegram.org/bot${BOT_TOKEN}`;

const PRIORITY_EMOJI: Record<string, string> = {
  critical: "🔴", high: "🟠", normal: "🟡", low: "⚪",
};

// DO NOT DISTURB: 23:00 – 07:00 (UTC+3 = 20:00 – 04:00 UTC)
function isDND(prefs: Record<string, unknown> | null): boolean {
  if (!prefs) return false;
  const now  = new Date();
  const hour = now.getUTCHours() + 3;
  const h    = ((hour % 24) + 24) % 24;
  const from = parseInt(String(prefs.do_not_disturb_from || "23:00").split(":")[0]);
  const to   = parseInt(String(prefs.do_not_disturb_to   || "07:00").split(":")[0]);
  if (from > to) return h >= from || h < to;
  return h >= from && h < to;
}

// ── Форматирование сообщений по типу события ─────────────────
function formatMessage(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case "alert.created":
      return `${PRIORITY_EMOJI[String(payload.priority)] || "⚠️"} <b>Новый алерт</b>\n` +
             `«${payload.title}»\n` +
             `Объект: ${payload.project_name || ""}\n` +
             `Создал: ${payload.created_by || ""}`;

    case "alert.overdue":
      return `🔴 <b>Просроченный алерт</b>\n` +
             `«${payload.title}»\n` +
             `Просрочен на ${payload.days_overdue} дн.\n` +
             `Объект: ${payload.project_name || ""}`;

    case "report.missing":
      return `📋 <b>Ежедневный отчёт</b>\n` +
             `Отчёт за сегодня не отправлен.\n` +
             `Объект: ${payload.project_name || ""}\n` +
             `Отправьте через бот: /report`;

    case "supply.deficit":
      return `📦 <b>Дефицит материалов</b>\n` +
             `${payload.count} позиций в дефиците\n` +
             `Объект: ${payload.project_name || ""}`;

    case "stage.overdue":
      return `⚠️ <b>Просрочка этапа</b>\n` +
             `«${payload.stage_name}»\n` +
             `Дедлайн: ${payload.deadline}\n` +
             `Объект: ${payload.project_name || ""}`;

    case "xp.level_up":
      return `🏆 <b>Новый уровень!</b>\n` +
             `Вы достигли уровня ${payload.level}: ${payload.level_name}\n` +
             `XP: ${payload.total_xp}`;

    case "project.summary":
      return `📊 <b>Еженедельная сводка</b>\n` +
             `${payload.project_name}\n` +
             `Прогресс: ${payload.progress}%\n` +
             `Алертов: ${payload.open_alerts}\n` +
             `До сдачи: ${payload.days_left} дн.`;

    // ── v4 Auto-trigger events ──
    case "document.sent":
      return `📤 <b>Документ получен</b>\n` +
             `${payload.label}\n` +
             `От: ${payload.sender || ""}\n` +
             `${payload.comment ? `💬 ${payload.comment}` : ""}\n` +
             `Объект: ${payload.project_name || ""}`;

    case "kmd.ready":
      return `✏️ <b>КМД готов</b>\n` +
             `${payload.facade || ""}\n` +
             `Объект: ${payload.project_name || ""}\n` +
             `Передано в производство`;

    case "spec.issued":
      return `📏 <b>Спецификация выпущена</b>\n` +
             `${payload.spec_name || ""}\n` +
             `Объект: ${payload.project_name || ""}\n` +
             `Передано в снабжение`;

    case "shipment.24h":
      return `🚚 <b>Отгрузка через 24ч</b>\n` +
             `${payload.material || ""}\n` +
             `Кол-во: ${payload.quantity || ""} ${payload.unit || ""}\n` +
             `Объект: ${payload.project_name || ""}`;

    case "material.mismatch":
      return `🔴 <b>Несхождение материалов</b>\n` +
             `${payload.material || ""}\n` +
             `${payload.details || ""}\n` +
             `Объект: ${payload.project_name || ""}`;

    case "material.deficit":
      return `🔴 <b>Критический дефицит</b>\n` +
             `${payload.material || ""}: ${payload.deficit || ""} ${payload.unit || ""}\n` +
             `Объект: ${payload.project_name || ""}`;

    case "gpr.delay":
      return `⚠️ <b>Задержка ГПР > 2 дн.</b>\n` +
             `${payload.task || ""}\n` +
             `Просрочка: ${payload.days || ""} дн.\n` +
             `Объект: ${payload.project_name || ""}`;

    case "task.overdue":
      return `⏰ <b>Просроченная задача</b>\n` +
             `«${payload.task_name || ""}»\n` +
             `Дедлайн: ${payload.deadline || ""}\n` +
             `Объект: ${payload.project_name || ""}`;

    case "work.stop":
      return `🛑 <b>ОСТАНОВКА РАБОТ</b>\n` +
             `${payload.reason || ""}\n` +
             `Инспектор: ${payload.inspector || ""}\n` +
             `Объект: ${payload.project_name || ""}`;

    case "aosr.signed":
      return `✅ <b>АОСР подписан</b>\n` +
             `${payload.aosr_type || ""}\n` +
             `${payload.facade || ""} · эт.${payload.floor || ""}\n` +
             `Объект: ${payload.project_name || ""}`;

    case "photo.uploaded":
      return `📸 <b>Фотоотчёт загружен</b>\n` +
             `${payload.type || ""}\n` +
             `${payload.facade || ""} · эт.${payload.floor || ""}\n` +
             `${payload.count || ""} фото · ${payload.reporter || ""}\n` +
             `Объект: ${payload.project_name || ""}`;

    case "report.submitted":
      return `📋 <b>Отчёт подан</b>\n` +
             `${payload.reporter_name || ""}\n` +
             `${payload.facade_name || ""} · эт.${payload.floor_number || ""}\n` +
             `+${payload.value || 0} мод. (${payload.pct || 0}%)\n` +
             `Объект: ${payload.project_name || ""}`;

    case "plan.morning": {
      let msg = `📋 <b>ПЛАН НА ${payload.date || "сегодня"}</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `Объект: ${payload.project_name || ""}\n\n`;
      const byFacade = (payload.by_facade || {}) as Record<string, number>;
      for (const [facade, plan] of Object.entries(byFacade)) {
        msg += `🏗️ <b>${facade}</b>: ${plan} ед.\n`;
      }
      msg += `\n━━━━━━━━━━━━━━━━━━━━\n📊 <b>Итого:</b> ${payload.total_plan || 0} ед. (${payload.rows_count || 0} позиций)`;
      return msg;
    }

    case "fact.evening": {
      const pct = Number(payload.pct || 0);
      const status = pct >= 100 ? "✅" : pct >= 80 ? "🟡" : "🔴";
      let msg = `📊 <b>ФАКТ ЗА ${payload.date || "сегодня"}</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `Объект: ${payload.project_name || ""}\n\n`;
      const byFacade = (payload.by_facade || {}) as Record<string, { plan: number; fact: number }>;
      for (const [facade, vals] of Object.entries(byFacade)) {
        const fp = vals.plan > 0 ? Math.round((vals.fact / vals.plan) * 100) : 0;
        const fi = fp >= 100 ? "✅" : fp >= 80 ? "🟡" : "🔴";
        msg += `${fi} <b>${facade}</b>: ${vals.fact}/${vals.plan} (${fp}%)\n`;
      }
      msg += `\n━━━━━━━━━━━━━━━━━━━━\n${status} <b>ИТОГО:</b> ${payload.total_fact || 0}/${payload.total_plan || 0} ед. (${pct}%)\n`;
      const failures = (payload.failures || []) as Array<{ facade: string; deficit: number; note: string }>;
      if (failures.length > 0) {
        msg += `\n⚠️ <b>СРЫВЫ:</b>\n`;
        for (const f of failures) {
          msg += `• ${f.facade}: -${f.deficit} ед.\n  📍 ${f.note}\n`;
        }
      }
      return msg;
    }

    case "director.digest": {
      let msg = `📊 <b>Утренний дайджест</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `Проектов: ${payload.total_projects || 0}\n`;
      msg += `Прогресс: ${payload.avg_progress || 0}%\n`;
      msg += `Алертов: ${payload.open_alerts || 0}`;
      if (Number(payload.critical_alerts) > 0) msg += ` 🔴 крит: ${payload.critical_alerts}`;
      msg += `\nДефицит: ${payload.deficit_count || 0} позиций`;
      return msg;
    }

    case "morning.briefing":
      return String(payload.text || "☀️ Утренняя сводка");

    case "task.deadline_warning":
      return `⏰ <b>Дедлайн через ${payload.hours_left || 2}ч!</b>\n` +
             `«${payload.task_name || ""}»\n` +
             `Срок: ${payload.deadline || ""}\n` +
             `Объект: ${payload.project_name || ""}`;

    case "docs.overdue":
      return `📨 <b>Документы без ответа > 24ч</b>\n` +
             `Всего: ${payload.total_count || 0}\n` +
             `${payload.message || ""}`;

    case "stage.ready":
      return `🏗️ <b>Готовность к приёмке</b>\n` +
             `Прораб ${payload.foreman_name || ""} отметил готовность:\n` +
             `${payload.facade_name || ""} / ${payload.stage || ""}\n` +
             `Объект: ${payload.project_name || ""}\n` +
             `Требуется приёмка!`;

    default:
      return `📌 <b>STSphera</b>\n${payload.message || "Новое уведомление"}`;
  }
}

async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const res = await fetch(`${TG}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const json = await res.json();
  return json.ok;
}

// Разрешаем target_roles / target_users в список chat_id + prefs
interface Target { chat_id: string; prefs: Record<string, unknown> | null }

async function resolveTargets(
  targetRoles: string[],
  targetUsers: string[],
): Promise<Target[]> {
  if (targetUsers.length > 0) {
    const { data } = await db
      .from("profiles")
      .select("telegram_chat_id, notification_preferences")
      .in("telegram_chat_id", targetUsers)
      .not("telegram_chat_id", "is", null);
    return (data || []).map((p: Record<string, unknown>) => ({
      chat_id: String(p.telegram_chat_id),
      prefs:   p.notification_preferences as Record<string, unknown> | null,
    }));
  }

  if (targetRoles.length > 0) {
    const { data } = await db
      .from("user_roles")
      .select("user_id, role, profiles(telegram_chat_id, notification_preferences)")
      .in("role", targetRoles);

    return (data || [])
      .filter((r: Record<string, unknown>) => {
        const prof = r.profiles as Record<string, unknown> | null;
        return prof?.telegram_chat_id;
      })
      .map((r: Record<string, unknown>) => {
        const prof = r.profiles as Record<string, unknown>;
        return {
          chat_id: String(prof.telegram_chat_id),
          prefs:   prof.notification_preferences as Record<string, unknown> | null,
        };
      });
  }

  return [];
}

// ── Main handler ─────────────────────────────────────────────
Deno.serve(async () => {
  const now = new Date().toISOString();

  // Берём до 50 pending событий за раз
  const { data: events, error } = await db
    .from("bot_event_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .lt("attempts", 3)
    .order("priority", { ascending: false })
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (error || !events?.length) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0, failed = 0, skipped = 0;

  for (const event of events) {
    // Mark as in-progress
    await db.from("bot_event_queue")
      .update({ status: "sent" })
      .eq("id", event.id);

    const targets = await resolveTargets(
      event.target_roles || [],
      event.target_users || [],
    );

    if (targets.length === 0) {
      await db.from("bot_event_queue").update({ status: "skipped", processed_at: new Date().toISOString() }).eq("id", event.id);
      skipped++;
      continue;
    }

    // Enrich payload with project_name
    let payload = event.payload || {};
    if (event.project_id && !payload.project_name) {
      const { data: proj } = await db
        .from("projects")
        .select("name")
        .eq("id", event.project_id)
        .maybeSingle();
      if (proj) payload = { ...payload, project_name: proj.name };
    }

    const message = formatMessage(event.event_type, payload);
    let allSent = true;

    for (const target of targets) {
      // DND check — skip for critical priority
      if (event.priority !== "critical" && isDND(target.prefs)) {
        const tomorrow7 = new Date();
        tomorrow7.setUTCHours(4, 1, 0, 0); // 07:01 MSK = 04:01 UTC
        if (tomorrow7 < new Date()) tomorrow7.setDate(tomorrow7.getDate() + 1);

        await db.from("bot_event_queue").update({
          status:       "pending",
          scheduled_at: tomorrow7.toISOString(),
        }).eq("id", event.id);
        skipped++;
        allSent = false;
        break;
      }

      // Rate limit: ~28 msg/sec
      await new Promise(r => setTimeout(r, 35));

      const ok = await sendTelegramMessage(target.chat_id, message);
      if (!ok) allSent = false;
    }

    if (allSent) {
      await db.from("bot_event_queue").update({
        status:       "sent",
        sent_at:      new Date().toISOString(),
        processed_at: new Date().toISOString(),
      }).eq("id", event.id);
      sent++;
    } else {
      await db.from("bot_event_queue").update({
        status:       "pending",
        attempts:     (event.attempts || 0) + 1,
        scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      }).eq("id", event.id);
      failed++;
    }
  }

  // Cleanup sent/skipped events older than 7 days
  await db.from("bot_event_queue")
    .delete()
    .in("status", ["sent", "skipped"])
    .lt("processed_at", new Date(Date.now() - 7 * 86400000).toISOString());

  // Refresh materialized view
  await db.rpc("refresh_portfolio_stats").then(() => {});

  // Cleanup expired sessions
  await db.rpc("cleanup_expired_bot_sessions").then(() => {});

  return new Response(JSON.stringify({ processed: events.length, sent, failed, skipped }), {
    headers: { "Content-Type": "application/json" },
  });
});
