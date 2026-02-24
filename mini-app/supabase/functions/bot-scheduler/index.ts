// supabase/functions/bot-scheduler/index.ts
// ═══════════════════════════════════════════════════════════════
// STSphera Bot Scheduler — полная версия v2
// Запуск: каждый час (cron: 0 * * * *)
// ═══════════════════════════════════════════════════════════════
// Расписание (МСК = UTC+3):
//   07:00 → Утренний план по фасадам
//   08:00 → Утренний дайджест для директора + ролевые брифинги
//   09:00 → Эскалация алертов >24ч + просроченные документы
//   Каждый час → Проверка дедлайнов задач
//   17:00 → Напоминание прорабам (нет отчёта)
//   17:00 пт → AI-анализ недели
//   20:00 → Вечерний факт
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SB_URL, SB_KEY);

// ── Helpers ──────────────────────────────────────────────────
function mskHour(): number {
  return new Date(Date.now() + 3 * 3600000).getUTCHours();
}
function mskDay(): number {
  return new Date(Date.now() + 3 * 3600000).getUTCDay();
}
function todayMSK(): string {
  return new Date(Date.now() + 3 * 3600000).toISOString().split("T")[0];
}

const ROLE_PRIORITY = ["director","pm","opr","km","kmd","supply","production","foreman1","foreman2","foreman3","pto","inspector"];

function detectPrimaryRole(roles: string[]): string {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }
  return roles[0] || "viewer";
}

async function alreadyQueued(eventType: string, projectId?: string): Promise<boolean> {
  const today = todayMSK();
  const q = db.from("bot_event_queue")
    .select("id", { count: "exact", head: true })
    .eq("event_type", eventType)
    .gte("created_at", today + "T00:00:00Z");
  if (projectId) q.eq("project_id", projectId);
  const { count } = await q;
  return (count || 0) > 0;
}

async function getActiveProjects() {
  const { data } = await db.from("projects").select("id, name").eq("status", "active");
  return data || [];
}

async function getUserRoles(userId: string): Promise<string[]> {
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  return (data || []).map((r: { role: string }) => r.role);
}

async function getUserNotifConfig(userId: string) {
  const { data } = await db.from("notifications_config")
    .select("*").eq("user_id", userId).maybeSingle();
  return data;
}

// ═══════════════════════════════════════════════════════════════
// 07:00 — Утренний план
// ═══════════════════════════════════════════════════════════════
async function scheduleMorningPlan(projects: { id: string; name: string }[]): Promise<number> {
  let queued = 0;
  const today = todayMSK();

  for (const proj of projects) {
    if (await alreadyQueued("plan.morning", proj.id)) continue;

    const { data: planRows } = await db.from("plan_fact")
      .select("plan_value, fact_value, facade_id")
      .eq("project_id", proj.id).eq("date", today).gt("plan_value", 0);

    if (!planRows?.length) continue;

    const facadeIds = [...new Set(planRows.map((r: { facade_id: string }) => r.facade_id).filter(Boolean))];
    const facadeMap: Record<string, string> = {};
    if (facadeIds.length > 0) {
      const { data: facades } = await db.from("facades").select("id, name").in("id", facadeIds);
      for (const f of (facades || [])) facadeMap[f.id] = f.name;
    }

    let totalPlan = 0;
    const grouped: Record<string, number> = {};
    for (const r of planRows) {
      const name = facadeMap[r.facade_id] || "Без фасада";
      grouped[name] = (grouped[name] || 0) + Number(r.plan_value || 0);
      totalPlan += Number(r.plan_value || 0);
    }

    await db.from("bot_event_queue").insert({
      event_type: "plan.morning",
      target_roles: ["pm", "director", "foreman1", "foreman2", "foreman3"],
      project_id: proj.id,
      priority: "normal",
      payload: { project_name: proj.name, date: today, total_plan: totalPlan, rows_count: planRows.length, by_facade: grouped },
      scheduled_at: new Date().toISOString(),
    });
    queued++;
  }
  return queued;
}

// ═══════════════════════════════════════════════════════════════
// 08:00 — Директорский дайджест
// ═══════════════════════════════════════════════════════════════
async function scheduleMorningDigest(projects: { id: string; name: string }[]): Promise<number> {
  if (await alreadyQueued("director.digest")) return 0;

  let totalAlerts = 0, criticalAlerts = 0, deficitCount = 0, avgProgress = 0;
  const projectsData: unknown[] = [];

  for (const proj of projects) {
    const { count: alertCount } = await db.from("alerts")
      .select("*", { count: "exact", head: true }).eq("project_id", proj.id).eq("is_resolved", false);

    const { count: critCount } = await db.from("alerts")
      .select("*", { count: "exact", head: true }).eq("project_id", proj.id).eq("is_resolved", false).eq("priority", "critical");

    const { count: defCount } = await db.from("materials")
      .select("*", { count: "exact", head: true }).eq("project_id", proj.id).gt("deficit", 0);

    const { data: facades } = await db.from("facades").select("id").eq("project_id", proj.id);
    let projPlan = 0, projFact = 0;
    for (const f of (facades || [])) {
      const { data: floors } = await db.from("floors").select("modules_plan, modules_fact").eq("facade_id", f.id);
      for (const fl of (floors || [])) { projPlan += fl.modules_plan || 0; projFact += fl.modules_fact || 0; }
    }
    const projPct = projPlan > 0 ? Math.round((projFact / projPlan) * 100) : 0;

    totalAlerts += alertCount || 0;
    criticalAlerts += critCount || 0;
    deficitCount += defCount || 0;
    avgProgress += projPct;
    projectsData.push({ name: proj.name, open_alerts: alertCount || 0, critical: critCount || 0, deficit: defCount || 0, progress_pct: projPct });
  }

  if (projects.length > 0) avgProgress = Math.round(avgProgress / projects.length);

  await db.from("bot_event_queue").insert({
    event_type: "director.digest",
    target_roles: ["director"],
    priority: criticalAlerts > 0 ? "high" : "normal",
    payload: { total_projects: projects.length, avg_progress: avgProgress, open_alerts: totalAlerts, critical_alerts: criticalAlerts, deficit_count: deficitCount, projects: projectsData },
    scheduled_at: new Date().toISOString(),
  });
  return 1;
}

// ═══════════════════════════════════════════════════════════════
// 08:00 — Ролевые утренние брифинги
// ═══════════════════════════════════════════════════════════════
async function scheduleMorningBriefings(projects: { id: string; name: string }[]): Promise<number> {
  if (await alreadyQueued("morning.briefing")) return 0;

  const { data: profiles } = await db.from("profiles")
    .select("user_id, telegram_chat_id, display_name")
    .not("telegram_chat_id", "is", null);

  if (!profiles?.length) return 0;
  let queued = 0;

  for (const profile of profiles) {
    const config = await getUserNotifConfig(profile.user_id);
    if (config && config.morning_briefing === false) continue;

    const roles = await getUserRoles(profile.user_id);
    if (!roles.length) continue;
    const primary = detectPrimaryRole(roles);

    // Skip director — he gets director.digest
    if (primary === "director") continue;

    const briefing = await buildRoleBriefing(primary, profile, projects);
    if (!briefing) continue;

    await db.from("bot_event_queue").insert({
      event_type: "morning.briefing",
      target_chat_ids: [profile.telegram_chat_id],
      priority: "normal",
      payload: { text: briefing, role: primary, user_name: profile.display_name },
      scheduled_at: new Date().toISOString(),
    });
    queued++;
  }
  return queued;
}

async function buildRoleBriefing(
  role: string,
  profile: { user_id: string; display_name: string },
  projects: { id: string; name: string }[],
): Promise<string | null> {
  const today = todayMSK();

  switch (role) {
    case "pm": {
      const { count: inbox } = await db.from("bot_inbox")
        .select("*", { count: "exact", head: true }).eq("status", "new");
      const { count: overdue } = await db.from("ecosystem_tasks")
        .select("*", { count: "exact", head: true })
        .not("deadline", "is", null).lt("deadline", new Date().toISOString())
        .neq("status", "Выполнено");
      const { count: approvals } = await db.from("approvals")
        .select("*", { count: "exact", head: true }).eq("status", "pending");

      return `☀️ <b>Утренняя сводка — РП</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `📨 Входящих: ${inbox || 0}\n` +
        `⏰ Просрочено задач: ${overdue || 0}\n` +
        `✅ На согласовании: ${approvals || 0}\n` +
        `\n📅 Дата: ${today}`;
    }

    case "foreman1": case "foreman2": case "foreman3": {
      const { count: reportCount } = await db.from("daily_logs")
        .select("*", { count: "exact", head: true })
        .eq("submitted_by", profile.user_id).eq("date", today);

      const { data: planRows } = await db.from("plan_fact")
        .select("plan_value, facade_id")
        .eq("date", today).eq("reported_by", profile.user_id).gt("plan_value", 0);

      let planLine = "";
      if (planRows?.length) {
        const total = planRows.reduce((s: number, r: { plan_value: number }) => s + Number(r.plan_value), 0);
        planLine = `\n📋 План на сегодня: ${total} ед. (${planRows.length} позиций)`;
      }

      return `☀️ <b>Доброе утро, ${profile.display_name}!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `📅 ${today}\n` +
        `${(reportCount || 0) > 0 ? "✅ Отчёт подан" : "⚠️ Отчёт НЕ подан"}` +
        planLine +
        `\n\n📝 Не забудьте подать отчёт до 17:00!`;
    }

    case "supply": {
      let totalDeficit = 0;
      for (const proj of projects) {
        const { count } = await db.from("materials")
          .select("*", { count: "exact", head: true }).eq("project_id", proj.id).gt("deficit", 0);
        totalDeficit += count || 0;
      }
      const { count: deliveries } = await db.from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "shipped").lte("expected_delivery", today);

      return `☀️ <b>Утренняя сводка — Снабжение</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `📦 Дефицит: ${totalDeficit} позиций\n` +
        `🚚 Ожидаемых поставок сегодня: ${deliveries || 0}\n` +
        `📅 ${today}`;
    }

    case "pto": {
      const { count: pending } = await db.from("stage_acceptance")
        .select("*", { count: "exact", head: true }).eq("status", "inspection");
      const { count: docs } = await db.from("bot_inbox")
        .select("*", { count: "exact", head: true })
        .eq("status", "new").contains("to_roles", ["pto"]);

      return `☀️ <b>Утренняя сводка — ПТО</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `📄 На проверке: ${pending || 0} этапов\n` +
        `📨 Входящих: ${docs || 0}\n` +
        `📅 ${today}`;
    }

    case "inspector": {
      const { count: open } = await db.from("alerts")
        .select("*", { count: "exact", head: true }).eq("is_resolved", false);
      const { count: ready } = await db.from("stage_acceptance")
        .select("*", { count: "exact", head: true }).eq("status", "ready");

      return `☀️ <b>Утренняя сводка — Технадзор</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ Открытых замечаний: ${open || 0}\n` +
        `🏗️ Ожидают приёмки: ${ready || 0}\n` +
        `📅 ${today}`;
    }

    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 09:00 — Эскалация алертов >24ч
// ═══════════════════════════════════════════════════════════════
async function scheduleAlertEscalation(projects: { id: string; name: string }[]): Promise<number> {
  let queued = 0;
  for (const proj of projects) {
    if (await alreadyQueued("alert.overdue", proj.id)) continue;

    const since24h = new Date(Date.now() - 24 * 3600000).toISOString();
    const { data: overdueAlerts } = await db.from("alerts")
      .select("title, priority, created_at")
      .eq("project_id", proj.id).eq("is_resolved", false)
      .in("priority", ["critical", "high"]).lt("created_at", since24h)
      .order("priority", { ascending: false }).limit(10);

    if (!overdueAlerts?.length) continue;

    const list = overdueAlerts.map((a: { title: string; priority: string; created_at: string }) => ({
      title: a.title, priority: a.priority,
      age_hours: Math.round((Date.now() - new Date(a.created_at).getTime()) / 3600000),
    }));

    await db.from("bot_event_queue").insert({
      event_type: "alert.overdue",
      target_roles: ["director", "pm"],
      project_id: proj.id,
      priority: overdueAlerts.some((a: { priority: string }) => a.priority === "critical") ? "critical" : "high",
      payload: { project_name: proj.name, count: overdueAlerts.length, list },
      scheduled_at: new Date().toISOString(),
    });
    queued++;
  }
  return queued;
}

// ═══════════════════════════════════════════════════════════════
// 09:00 — Просроченные документы (>24ч без ответа)
// ═══════════════════════════════════════════════════════════════
async function scheduleOverdueDocuments(): Promise<number> {
  if (await alreadyQueued("docs.overdue")) return 0;

  const since24h = new Date(Date.now() - 24 * 3600000).toISOString();
  const { data: overdue } = await db.from("bot_inbox")
    .select("id, title, to_roles, project_id, created_at")
    .eq("status", "new").lt("created_at", since24h).limit(50);

  if (!overdue?.length) return 0;

  // Group by to_roles and notify
  const roleMap: Record<string, number> = {};
  for (const doc of overdue) {
    for (const role of (doc.to_roles || [])) {
      roleMap[role] = (roleMap[role] || 0) + 1;
    }
  }

  // Notify PM about total
  await db.from("bot_event_queue").insert({
    event_type: "docs.overdue",
    target_roles: ["pm", "director"],
    priority: "high",
    payload: {
      total_count: overdue.length,
      by_role: roleMap,
      message: `📨 ${overdue.length} документов без ответа > 24ч`,
    },
    scheduled_at: new Date().toISOString(),
  });

  return 1;
}

// ═══════════════════════════════════════════════════════════════
// Каждый час — Проверка дедлайнов задач
// ═══════════════════════════════════════════════════════════════
async function scheduleDeadlineAlerts(): Promise<number> {
  let queued = 0;
  const now = new Date();
  const in2h = new Date(Date.now() + 2 * 3600000).toISOString();

  // Tasks with deadline in next 2 hours (warning)
  const { data: soonTasks } = await db.from("ecosystem_tasks")
    .select("id, name, deadline, assigned_to, assigned_role, project_id, reminder_sent")
    .neq("status", "Выполнено")
    .eq("reminder_sent", false)
    .not("deadline", "is", null)
    .gt("deadline", now.toISOString())
    .lte("deadline", in2h)
    .limit(50);

  for (const task of (soonTasks || [])) {
    const targetRoles = task.assigned_role ? [task.assigned_role] : ["pm"];
    const targetUsers = task.assigned_to ? [task.assigned_to] : [];

    // Get project name
    let projectName = "";
    if (task.project_id) {
      const { data: proj } = await db.from("projects").select("name").eq("id", task.project_id).maybeSingle();
      projectName = proj?.name || "";
    }

    await db.from("bot_event_queue").insert({
      event_type: "task.deadline_warning",
      target_roles: targetUsers.length ? [] : targetRoles,
      target_users: targetUsers.length ? targetUsers : [],
      project_id: task.project_id,
      priority: "high",
      payload: { task_name: task.name, deadline: task.deadline, project_name: projectName, hours_left: 2 },
      scheduled_at: new Date().toISOString(),
    });

    // Mark reminder sent
    await db.from("ecosystem_tasks").update({ reminder_sent: true }).eq("id", task.id);
    queued++;
  }

  // Tasks already overdue
  const { data: overdueTasks } = await db.from("ecosystem_tasks")
    .select("id, name, deadline, assigned_to, assigned_role, project_id")
    .neq("status", "Выполнено")
    .not("deadline", "is", null)
    .lt("deadline", now.toISOString())
    .limit(50);

  // Only create overdue alerts once per day per task
  for (const task of (overdueTasks || [])) {
    const key = `task.overdue:${task.id}`;
    if (await alreadyQueued("task.overdue", task.project_id || undefined)) continue;

    let projectName = "";
    if (task.project_id) {
      const { data: proj } = await db.from("projects").select("name").eq("id", task.project_id).maybeSingle();
      projectName = proj?.name || "";
    }

    await db.from("bot_event_queue").insert({
      event_type: "task.overdue",
      target_roles: ["pm"],
      project_id: task.project_id,
      priority: "high",
      payload: {
        task_name: task.name,
        deadline: task.deadline,
        project_name: projectName,
        days_overdue: Math.ceil((Date.now() - new Date(task.deadline).getTime()) / 86400000),
      },
      scheduled_at: new Date().toISOString(),
    });
    queued++;
  }

  return queued;
}

// ═══════════════════════════════════════════════════════════════
// 17:00 — Напоминание прорабам (нет отчёта)
// ═══════════════════════════════════════════════════════════════
async function scheduleForemanReminders(projects: { id: string; name: string }[]): Promise<number> {
  let queued = 0;
  const today = todayMSK();

  for (const proj of projects) {
    if (await alreadyQueued("report.missing", proj.id)) continue;

    const { data: foremanRoles } = await db.from("user_roles")
      .select("user_id").in("role", ["foreman1", "foreman2", "foreman3"]);
    if (!foremanRoles?.length) continue;

    const foremanUserIds = foremanRoles.map((r: { user_id: string }) => r.user_id);

    const { data: todayReports } = await db.from("daily_logs")
      .select("submitted_by").eq("project_id", proj.id).eq("date", today)
      .in("submitted_by", foremanUserIds);

    const reportedIds = new Set((todayReports || []).map((r: { submitted_by: string }) => r.submitted_by));
    const notReported = foremanUserIds.filter((id: string) => !reportedIds.has(id));
    if (!notReported.length) continue;

    const { data: profiles } = await db.from("profiles")
      .select("user_id, telegram_chat_id, display_name")
      .in("user_id", notReported)
      .not("telegram_chat_id", "is", null);

    if (!profiles?.length) continue;

    for (const profile of profiles) {
      // Check user notification config
      const config = await getUserNotifConfig(profile.user_id);
      if (config && config.report_reminder === false) continue;

      await db.from("bot_event_queue").insert({
        event_type: "report.missing",
        target_chat_ids: [profile.telegram_chat_id],
        project_id: proj.id,
        priority: "normal",
        payload: { project_name: proj.name, date: today, foreman_name: profile.display_name },
        scheduled_at: new Date().toISOString(),
      });
    }
    queued += profiles.length;
  }
  return queued;
}

// ═══════════════════════════════════════════════════════════════
// 17:00 пт — AI-анализ недели
// ═══════════════════════════════════════════════════════════════
async function triggerWeeklyAI(): Promise<boolean> {
  if (await alreadyQueued("weekly.ai.triggered")) return false;

  await db.from("bot_event_queue").insert({
    event_type: "weekly.ai.triggered",
    target_roles: [],
    priority: "low",
    status: "sent",
    payload: { triggered_at: new Date().toISOString() },
    scheduled_at: new Date().toISOString(),
  });

  try {
    const res = await fetch(`${SB_URL}/functions/v1/bot-ai-weekly`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" },
    });
    return res.ok;
  } catch { return false; }
}

// ═══════════════════════════════════════════════════════════════
// 20:00 — Вечерний факт
// ═══════════════════════════════════════════════════════════════
async function scheduleEveningFact(projects: { id: string; name: string }[]): Promise<number> {
  let queued = 0;
  const today = todayMSK();

  for (const proj of projects) {
    if (await alreadyQueued("fact.evening", proj.id)) continue;

    const { data: rows } = await db.from("plan_fact")
      .select("plan_value, fact_value, facade_id, notes")
      .eq("project_id", proj.id).eq("date", today);

    if (!rows?.length) continue;

    const facadeIds = [...new Set(rows.map((r: { facade_id: string }) => r.facade_id).filter(Boolean))];
    const facadeMap: Record<string, string> = {};
    if (facadeIds.length > 0) {
      const { data: facades } = await db.from("facades").select("id, name").in("id", facadeIds);
      for (const f of (facades || [])) facadeMap[f.id] = f.name;
    }

    let totalPlan = 0, totalFact = 0;
    const byFacade: Record<string, { plan: number; fact: number }> = {};
    const failures: { facade: string; deficit: number; note: string }[] = [];

    for (const r of rows) {
      const plan = Number(r.plan_value || 0);
      const fact = Number(r.fact_value || 0);
      const facadeName = facadeMap[r.facade_id] || "Без фасада";
      totalPlan += plan;
      totalFact += fact;
      if (!byFacade[facadeName]) byFacade[facadeName] = { plan: 0, fact: 0 };
      byFacade[facadeName].plan += plan;
      byFacade[facadeName].fact += fact;
      if (fact < plan && r.notes) failures.push({ facade: facadeName, deficit: plan - fact, note: r.notes });
    }

    const pct = totalPlan > 0 ? Math.round((totalFact / totalPlan) * 100) : 0;

    await db.from("bot_event_queue").insert({
      event_type: "fact.evening",
      target_roles: ["pm", "director"],
      project_id: proj.id,
      priority: pct < 80 ? "high" : "normal",
      payload: { project_name: proj.name, date: today, total_plan: totalPlan, total_fact: totalFact, pct, by_facade: byFacade, failures },
      scheduled_at: new Date().toISOString(),
    });
    queued++;
  }
  return queued;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
serve(async () => {
  const hour = mskHour();
  const day = mskDay();
  const results: Record<string, unknown> = { hour_msk: hour };

  const projects = await getActiveProjects();
  if (!projects.length) {
    return new Response(JSON.stringify({ ...results, status: "no_active_projects" }));
  }

  // Every hour — deadline checks
  results.deadline_alerts = await scheduleDeadlineAlerts();

  // 07:00 — morning plan
  if (hour === 7) {
    results.morning_plan = await scheduleMorningPlan(projects);
  }

  // 08:00 — director digest + role briefings
  if (hour === 8) {
    results.morning_digest = await scheduleMorningDigest(projects);
    results.morning_briefings = await scheduleMorningBriefings(projects);
  }

  // 09:00 — alert escalation + overdue documents
  if (hour === 9) {
    results.alert_escalation = await scheduleAlertEscalation(projects);
    results.overdue_documents = await scheduleOverdueDocuments();
  }

  // 17:00 — foreman reminders
  if (hour === 17) {
    results.foreman_reminders = await scheduleForemanReminders(projects);
    if (day === 5) {
      results.weekly_ai = await triggerWeeklyAI();
    }
  }

  // 20:00 — evening fact
  if (hour === 20) {
    results.evening_fact = await scheduleEveningFact(projects);
  }

  results.status = "ok";
  results.projects_count = projects.length;

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
});
