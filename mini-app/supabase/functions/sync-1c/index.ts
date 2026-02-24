// ═══════════════════════════════════════════════════════════════
// 1С ↔ STSphera — двусторонняя синхронизация (v3.0)
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticate } from "../_shared/authMiddleware.ts";
import { getCorsHeaders } from "../_shared/corsHeaders.ts";

const C1_URL  = Deno.env.get("C1_BASE_URL") || "";
const C1_USER = Deno.env.get("C1_USERNAME") || "";
const C1_PASS = Deno.env.get("C1_PASSWORD") || "";
const SB_URL  = Deno.env.get("SUPABASE_URL")!;
const SB_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const db = createClient(SB_URL, SB_KEY);

// ── 1С REST client ────────────────────────────────────────────
const c1Auth = "Basic " + btoa(`${C1_USER}:${C1_PASS}`);

async function c1Get<T>(endpoint: string): Promise<T | null> {
  if (!C1_URL) return null;
  try {
    const res = await fetch(`${C1_URL}${endpoint}`, {
      headers: { Authorization: c1Auth, Accept: "application/json" },
    });
    if (!res.ok) {
      console.error(`[1C GET] ${endpoint} → ${res.status}`);
      return null;
    }
    return await res.json() as T;
  } catch (err) {
    console.error(`[1C GET] ${endpoint}:`, err);
    return null;
  }
}

async function c1Post<T>(endpoint: string, body: unknown): Promise<T | null> {
  if (!C1_URL) return null;
  try {
    const res = await fetch(`${C1_URL}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: c1Auth,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[1C POST] ${endpoint} → ${res.status}: ${text}`);
      return null;
    }
    return await res.json() as T;
  } catch (err) {
    console.error(`[1C POST] ${endpoint}:`, err);
    return null;
  }
}

async function logSync(
  direction: "1c_to_app" | "app_to_1c",
  entity: string,
  count: number,
  errors: number,
  details?: string
) {
  await db.from("sync_log").insert({
    direction,
    entity,
    records_synced: count,
    errors_count: errors,
    details,
    synced_at: new Date().toISOString(),
  });
}

function mapMaterialStatus(status1c: string): string {
  const map: Record<string, string> = {
    "НеЗаказан": "deficit", "ВЗаказе": "ordered",
    "ВПроизводстве": "in_production", "Отгружен": "shipped",
    "НаОбъекте": "on_site", "Установлен": "installed",
    ok: "ok", ordered: "ordered",
  };
  return map[status1c] || "deficit";
}

async function syncMaterialsFrom1C() {
  const data = await c1Get<{ materials: any[] }>("/stsphera/v1/materials");
  if (!data?.materials) return { synced: 0, errors: 1 };

  let synced = 0, errors = 0;
  for (const mat of data.materials) {
    const record: any = {
      code_1c: mat.Код || mat.code,
      name: mat.Наименование || mat.name,
      unit: mat.ЕдиницаИзмерения || mat.unit || "шт.",
      price_per_unit: mat.ЦенаЗаЕдиницу || mat.price || 0,
      supplier_inn: mat.ПоставщикИНН || mat.supplier_inn,
      supplier_code_1c: mat.КодПоставщика || mat.supplier_code,
      total_required: mat.КоличествоПоПлану || mat.quantity_plan || 0,
      on_site: mat.КоличествоНаОбъекте || mat.quantity_on_site || 0,
      status: mapMaterialStatus(mat.Статус || mat.status),
      eta: mat.ДатаПоставки ? new Date(mat.ДатаПоставки).toISOString() : null,
      updated_from_1c: new Date().toISOString(),
    };
    const deficit = Math.max(0, record.total_required - record.on_site);
    const { error } = await db.from("materials").upsert(
      { ...record, deficit },
      { onConflict: "code_1c" }
    );
    if (error) { errors++; console.error("[sync materials]", error.message); }
    else synced++;
  }
  await logSync("1c_to_app", "materials", synced, errors);
  return { synced, errors };
}

function mapOrderStatus(s: string): string {
  const map: Record<string, string> = {
    "Черновик": "draft", "Подтверждён": "confirmed",
    "ВПроизводстве": "in_production", "Отгружен": "shipped",
    "Доставлен": "delivered", "Отменён": "cancelled",
  };
  return map[s] || "draft";
}

async function syncOrdersFrom1C() {
  const data = await c1Get<{ orders: any[] }>("/stsphera/v1/orders");
  if (!data?.orders) return { synced: 0, errors: 1 };

  let synced = 0, errors = 0;
  for (const order of data.orders) {
    const record: any = {
      order_number_1c: order.НомерДокумента || order.order_number,
      supplier_inn: order.ПоставщикИНН || order.supplier_inn,
      supplier_code_1c: order.КодПоставщика || order.supplier_code,
      supplier_name: order.ПоставщикНаименование || order.supplier_name,
      supplier: order.ПоставщикНаименование || order.supplier_name || "Не указан",
      material_name: order.НоменклатураНаименование || order.material_name || "Не указано",
      status: mapOrderStatus(order.Статус || order.status),
      total_amount: order.СуммаДокумента || order.total_amount || 0,
      expected_delivery: order.ОжидаемаяДатаПоставки
        ? new Date(order.ОжидаемаяДатаПоставки).toISOString() : null,
      actual_delivery: order.ФактическаяДатаПоставки
        ? new Date(order.ФактическаяДатаПоставки).toISOString() : null,
      updated_from_1c: new Date().toISOString(),
    };
    const { error } = await db.from("orders").upsert(record, { onConflict: "order_number_1c" });
    if (error) { errors++; } else synced++;
  }
  await logSync("1c_to_app", "orders", synced, errors);
  return { synced, errors };
}

async function syncPlanFrom1C() {
  const today = new Date().toISOString().split("T")[0];
  const data = await c1Get<{ plan: any[] }>(`/stsphera/v1/plan?date_from=${today}`);
  if (!data?.plan) return { synced: 0, errors: 1 };

  let synced = 0, errors = 0;
  for (const row of data.plan) {
    const record: any = {
      project_id: row.КодПроекта || row.project_id,
      date: row.Дата || row.date,
      week_number: row.НомерНедели || row.week_number,
      plan_value: row.ПлановоеКоличество || row.plan_value || 0,
      ref_1c: row.НомерДокумента || row.ref_1c,
    };
    const { error } = await db.from("plan_fact").upsert(record, {
      onConflict: "project_id,date",
      ignoreDuplicates: false,
    });
    if (error) { errors++; } else synced++;
  }
  await logSync("1c_to_app", "plan", synced, errors);
  return { synced, errors };
}

async function pushFactTo1C() {
  const since = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const { data: rows } = await db.from("plan_fact")
    .select("id, project_id, date, fact_value, notes")
    .gte("date", since)
    .is("synced_to_1c", null)
    .gt("fact_value", 0)
    .limit(100);

  if (!rows?.length) return { pushed: 0, errors: 0 };
  let pushed = 0, errors = 0;

  for (const row of rows) {
    const payload = {
      КодПроекта: row.project_id,
      Дата: row.date,
      ФактическоеКоличество: row.fact_value,
      Примечание: row.notes || "",
      ИсточникДанных: "STSphera",
    };
    const res = await c1Post("/stsphera/v1/fact", payload);
    if (res) {
      await db.from("plan_fact").update({ synced_to_1c: new Date().toISOString() }).eq("id", row.id);
      pushed++;
    } else errors++;
  }
  await logSync("app_to_1c", "fact", pushed, errors);
  return { pushed, errors };
}

function mapPriorityTo1C(p: string): string {
  return { critical: "Критичный", high: "Высокий", medium: "Средний", low: "Низкий" }[p] || "Средний";
}

async function pushAlertsTo1C() {
  const { data: alerts } = await db.from("alerts")
    .select("id, project_id, title, priority, description, created_at")
    .is("synced_to_1c", null)
    .eq("is_resolved", false)
    .in("priority", ["critical", "high"])
    .limit(50);

  if (!alerts?.length) return { pushed: 0, errors: 0 };
  let pushed = 0, errors = 0;

  for (const alert of alerts) {
    const payload = {
      КодПроекта: alert.project_id,
      Наименование: alert.title,
      Приоритет: mapPriorityTo1C(alert.priority),
      Описание: alert.description || "",
      ДатаСоздания: alert.created_at,
      Источник: "STSphera.Bot",
    };
    const res = await c1Post("/stsphera/v1/alerts", payload);
    if (res) {
      await db.from("alerts").update({ synced_to_1c: new Date().toISOString() }).eq("id", alert.id);
      pushed++;
    } else errors++;
  }
  await logSync("app_to_1c", "alerts", pushed, errors);
  return { pushed, errors };
}

async function pushOrderStatusTo1C() {
  const { data: orders } = await db.from("orders")
    .select("id, order_number_1c, status, actual_delivery")
    .not("order_number_1c", "is", null)
    .in("status", ["delivered", "cancelled"])
    .is("synced_to_1c", null)
    .limit(50);

  if (!orders?.length) return { pushed: 0, errors: 0 };
  let pushed = 0, errors = 0;

  for (const order of orders) {
    const payload = {
      НомерДокумента: order.order_number_1c,
      Статус: order.status === "delivered" ? "Доставлен" : "Отменён",
      ФактическаяДатаПоставки: order.actual_delivery,
    };
    const res = await c1Post("/stsphera/v1/orders/status", payload);
    if (res) {
      await db.from("orders").update({ synced_to_1c: new Date().toISOString() }).eq("id", order.id);
      pushed++;
    } else errors++;
  }
  await logSync("app_to_1c", "order_status", pushed, errors);
  return { pushed, errors };
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth check
  const user = await authenticate(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const start = Date.now();
  const results: Record<string, unknown> = {};

  try {
    if (!C1_URL) {
      return new Response(JSON.stringify({
        status: "skipped",
        message: "C1_BASE_URL not configured. Set secrets first.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1С → App
    results.materials_in = await syncMaterialsFrom1C();
    results.orders_in    = await syncOrdersFrom1C();
    results.plan_in      = await syncPlanFrom1C();

    // App → 1С
    results.fact_out         = await pushFactTo1C();
    results.alerts_out       = await pushAlertsTo1C();
    results.order_status_out = await pushOrderStatusTo1C();

    results.duration_ms = Date.now() - start;
    results.status = "ok";
  } catch (err: unknown) {
    results.error = err instanceof Error ? err.message : "Unknown";
    results.status = "error";
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
