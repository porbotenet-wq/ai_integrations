// ═══════════════════════════════════════════════════════════════
// White-label бот — один код, N компаний (v3.0)
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const db = createClient(SB_URL, SB_KEY);

// ── Company cache (in-memory, 5 min TTL) ─────────────────────
interface CompanyConfig {
  id: string;
  name: string;
  code: string;
  bot_token: string;
  mini_app_url: string;
  primary_color: string;
  logo_url: string | null;
  cached_at: number;
}

const companyCache = new Map<string, CompanyConfig>();
const CACHE_TTL = 300_000; // 5 min

const COMPANY_SELECT = "id, name, code, bot_token, mini_app_url, primary_color, logo_url";

async function getCompanyByToken(botToken: string): Promise<CompanyConfig | null> {
  const cached = companyCache.get(botToken);
  if (cached && Date.now() - cached.cached_at < CACHE_TTL) return cached;

  const { data } = await db.from("companies")
    .select(COMPANY_SELECT)
    .eq("bot_token", botToken)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;
  const config: CompanyConfig = { ...data, cached_at: Date.now() };
  companyCache.set(botToken, config);
  return config;
}

async function getCompanyBySecret(secret: string): Promise<CompanyConfig | null> {
  if (!secret) return null;
  // Search by settings->webhook_secret
  const { data: companies } = await db.from("companies")
    .select(COMPANY_SELECT + ", settings")
    .eq("is_active", true);

  if (!companies) return null;
  const match = companies.find((c: any) => c.settings?.webhook_secret === secret);
  if (!match) return null;
  const { settings: _s, ...rest } = match as any;
  return { ...rest, cached_at: Date.now() } as CompanyConfig;
}

async function getCompanyByCode(code: string): Promise<CompanyConfig | null> {
  const { data } = await db.from("companies")
    .select(COMPANY_SELECT)
    .eq("code", code.toUpperCase())
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  return { ...data, cached_at: Date.now() };
}

// ── Telegram API per company ─────────────────────────────────
function tgApi(botToken: string) {
  const base = `https://api.telegram.org/bot${botToken}`;

  return {
    async send(chatId: number, text: string, extra: Record<string, unknown> = {}) {
      await fetch(`${base}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId, text, parse_mode: "HTML",
          disable_web_page_preview: true, ...extra,
        }),
      });
    },

    async edit(chatId: number, msgId: number, text: string, extra: Record<string, unknown> = {}) {
      await fetch(`${base}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId, message_id: msgId, text, parse_mode: "HTML", ...extra,
        }),
      });
    },

    async answer(cbId: string, text?: string) {
      await fetch(`${base}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cbId, ...(text ? { text } : {}) }),
      });
    },

    async sendRaw(chatId: number, text: string, extra: Record<string, unknown> = {}) {
      const res = await fetch(`${base}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId, text, parse_mode: "HTML",
          disable_web_page_preview: true, ...extra,
        }),
      });
      return res.json();
    },
  };
}

// ── User helpers ─────────────────────────────────────────────
async function getCompanyUser(chatId: number, companyId: string) {
  const { data } = await db.from("profiles")
    .select("user_id, display_name, company_id")
    .eq("telegram_chat_id", String(chatId))
    .eq("company_id", companyId)
    .maybeSingle();
  return data;
}

async function getUserRoles(userId: string, companyId: string): Promise<string[]> {
  const { data } = await db.from("user_roles")
    .select("role, scope")
    .eq("user_id", userId)
    .eq("company_id", companyId);
  return (data || []).map((r: any) => r.role);
}

// ── Session ──────────────────────────────────────────────────
async function getSession(chatId: number, companyId: string) {
  const { data } = await db.from("bot_sessions")
    .select("state, context, message_id")
    .eq("chat_id", String(chatId))
    .eq("company_id", companyId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data;
}

async function saveSession(chatId: number, companyId: string, state: string, context: any, msgId?: number) {
  await db.from("bot_sessions").upsert({
    chat_id: String(chatId),
    company_id: companyId,
    state,
    context,
    message_id: msgId,
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7200000).toISOString(),
  }, { onConflict: "chat_id" });
}

// ── Branded texts ────────────────────────────────────────────
function brandedWelcome(company: CompanyConfig, displayName: string, roles: string[]): string {
  const isDirector = roles.includes("director");
  const roleEmoji = isDirector ? "👔" : roles.some(r => r.startsWith("foreman")) ? "👷" : "🏗️";
  return (
    `${roleEmoji} <b>Добро пожаловать, ${displayName}!</b>\n` +
    `${company.name}\n\n` +
    `Роль: <code>${roles[0] || "user"}</code>\n\n` +
    `Выберите действие:`
  );
}

function brandedNotLinked(company: CompanyConfig): string {
  return (
    `⚠️ Аккаунт не привязан к ${company.name}.\n\n` +
    `Откройте приложение и привяжите Telegram в настройках профиля.`
  );
}

// ── Start handler ────────────────────────────────────────────
async function handleStart(chatId: number, firstName: string, company: CompanyConfig, tg: ReturnType<typeof tgApi>) {
  const user = await getCompanyUser(chatId, company.id);
  if (!user) {
    await tg.send(chatId, brandedNotLinked(company), {
      reply_markup: { inline_keyboard: [[
        { text: "🚀 Открыть приложение", url: company.mini_app_url || "https://stsphera.lovable.app" },
      ]] },
    });
    return;
  }

  const roles = await getUserRoles(user.user_id, company.id);
  const isDirector = roles.includes("director");
  const text = brandedWelcome(company, user.display_name || firstName, roles);

  const buttons: any[][] = [
    [
      { text: "📊 Дашборд", callback_data: "nav:dashboard" },
      { text: "🔔 Алерты", callback_data: "nav:alerts" },
    ],
    [
      { text: "📦 Снабжение", callback_data: "nav:supply" },
      { text: "📋 Отчёт", callback_data: "nav:report" },
    ],
  ];

  if (isDirector) {
    buttons.push([{ text: "📁 Портфель", callback_data: "nav:portfolio" }]);
  }

  if (company.mini_app_url) {
    buttons.push([{ text: "🚀 Открыть приложение", url: company.mini_app_url }]);
  }

  const session = await getSession(chatId, company.id);
  if (session?.message_id) {
    await tg.edit(chatId, session.message_id, text, { reply_markup: { inline_keyboard: buttons } });
  } else {
    const json = await tg.sendRaw(chatId, text, { reply_markup: { inline_keyboard: buttons } });
    const msgId = json.result?.message_id;
    await saveSession(chatId, company.id, "IDLE", {}, msgId);
  }
}

// ── Dashboard handler ────────────────────────────────────────
async function handleDashboard(chatId: number, company: CompanyConfig, tg: ReturnType<typeof tgApi>, projectId?: string) {
  const user = await getCompanyUser(chatId, company.id);
  if (!user) { await tg.send(chatId, brandedNotLinked(company)); return; }

  const { data: projects } = await db.from("projects")
    .select("id, name, end_date")
    .eq("company_id", company.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(8);

  if (!projects?.length) {
    await tg.send(chatId, `🏗️ ${company.name}\n\nНет активных объектов.`);
    return;
  }

  const pid = projectId || projects[0].id;
  const project = projects.find((p: any) => p.id === pid) || projects[0];

  const [pfRes, alertsRes] = await Promise.all([
    db.from("plan_fact").select("plan_value,fact_value").eq("project_id", pid).order("date", { ascending: false }).limit(14),
    db.from("alerts").select("priority").eq("project_id", pid).eq("is_resolved", false),
  ]);

  const pf = pfRes.data || [];
  const plan = pf.reduce((s: number, r: any) => s + Number(r.plan_value || 0), 0);
  const fact = pf.reduce((s: number, r: any) => s + Number(r.fact_value || 0), 0);
  const pct = plan > 0 ? Math.round((fact / plan) * 100) : 0;
  const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
  const alerts = alertsRes.data || [];
  const critical = alerts.filter((a: any) => a.priority === "critical").length;

  const daysLeft = project.end_date
    ? Math.ceil((new Date(project.end_date).getTime() - Date.now()) / 86400000) : null;

  let text = `📊 <b>${company.name}</b>\n${project.name}\n\n${bar} <b>${pct}%</b>\nПлан: ${plan} · Факт: ${fact}\n`;

  if (daysLeft !== null) {
    text += daysLeft < 0 ? `🔴 Просрочка ${Math.abs(daysLeft)} дн.\n` : `📅 До сдачи: ${daysLeft} дн.\n`;
  }
  if (alerts.length > 0) {
    text += `🔔 Алертов: ${alerts.length}`;
    if (critical > 0) text += `  🔴 крит: ${critical}`;
    text += "\n";
  }

  const session = await getSession(chatId, company.id);
  const msgId = session?.message_id;

  const buttons = [
    projects.slice(0, 3).map((p: any) => ({
      text: p.id === pid ? `✓ ${p.name.slice(0, 18)}` : p.name.slice(0, 18),
      callback_data: `dash:${p.id}`,
    })),
    [
      { text: "🔔 Алерты", callback_data: `alerts:${pid}` },
      { text: "📦 Дефицит", callback_data: `supply:${pid}` },
    ],
    ...(company.mini_app_url ? [[{ text: "🚀 Открыть объект", url: `${company.mini_app_url}?project=${pid}` }]] : []),
  ].filter((r: any[]) => r.length > 0);

  if (msgId) {
    await tg.edit(chatId, msgId, text, { reply_markup: { inline_keyboard: buttons } });
  } else {
    await tg.send(chatId, text, { reply_markup: { inline_keyboard: buttons } });
  }
}

// ── Dispatcher ───────────────────────────────────────────────
async function dispatch(update: any, company: CompanyConfig) {
  const tg = tgApi(company.bot_token);

  if (update.message) {
    const chatId = update.message.chat.id;
    const text: string = update.message.text || "";
    const firstName = update.message.from?.first_name || "Пользователь";

    if (text.startsWith("/start")) return handleStart(chatId, firstName, company, tg);
    if (text.startsWith("/d")) return handleDashboard(chatId, company, tg);

    // FSM delegation to main telegram-bot
    const session = await getSession(chatId, company.id);
    if (session && session.state !== "IDLE" && !text.startsWith("/")) {
      await db.functions.invoke("telegram-bot", {
        body: { update, company_id: company.id, bot_token: company.bot_token },
      });
      return;
    }

    return handleStart(chatId, firstName, company, tg);
  }

  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.from.id;
    const data: string = cq.data || "";

    await tg.answer(cq.id);

    if (data === "nav:dashboard") return handleDashboard(chatId, company, tg);
    if (data.startsWith("dash:")) return handleDashboard(chatId, company, tg, data.slice(5));

    // Delegate to main bot
    await db.functions.invoke("telegram-bot", {
      body: { update, company_id: company.id, bot_token: company.bot_token },
    });
  }
}

// ── Main ─────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== "POST") return new Response("OK");

  const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
  let company: CompanyConfig | null = null;

  // Method 1: webhook secret
  if (incomingSecret) {
    company = await getCompanyBySecret(incomingSecret);
  }

  // Method 2: X-Bot-Token header
  if (!company) {
    const tokenHeader = req.headers.get("x-bot-token") || "";
    if (tokenHeader) company = await getCompanyByToken(tokenHeader);
  }

  // Method 3: ?company=CODE
  if (!company) {
    const url = new URL(req.url);
    const code = url.searchParams.get("company") || "";
    if (code) company = await getCompanyByCode(code);
  }

  if (!company) {
    console.error("[WhiteLabel] Unknown company for request");
    return new Response("OK");
  }

  try {
    const update = await req.json();
    await dispatch(update, company);
  } catch (err) {
    console.error("[WhiteLabel]", err);
  }

  return new Response("OK");
});
