import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { authenticate } from "../_shared/authMiddleware.ts";
import { getCorsHeaders } from "../_shared/corsHeaders.ts";

interface SheetRange {
  values: string[][];
}

function isServiceAccountJson(val: string): boolean {
  try {
    const parsed = JSON.parse(val);
    return !!parsed.client_email && !!parsed.private_key;
  } catch {
    return false;
  }
}

async function getAccessToken(serviceAccountKey: string): Promise<string> {
  const key = JSON.parse(serviceAccountKey);
  if (!key.client_email || !key.private_key) {
    throw new Error("Invalid service account JSON: missing client_email or private_key");
  }
  const now = Math.floor(Date.now() / 1000);

  const b64url = (str: string) =>
    btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );

  const pemContent = key.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const toSign = new TextEncoder().encode(`${header}.${claim}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, toSign);
  const base64Sig = b64url(String.fromCharCode(...new Uint8Array(signature)));

  const jwt = `${header}.${claim}.${base64Sig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Failed to get access token: ${err}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function readSheetWithApiKey(apiKey: string, sheetId: string, range: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to read sheet with API key: ${err}`);
  }
  const data: SheetRange = await res.json();
  return data.values || [];
}

async function readSheet(accessToken: string, sheetId: string, range: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to read sheet: ${err}`);
  }
  const data: SheetRange = await res.json();
  return data.values || [];
}

async function writeSheet(accessToken: string, sheetId: string, range: string, values: string[][]): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to write sheet: ${err}`);
  }
  await res.text();
}

const tableSyncHandlers: Record<string, {
  columns: string[];
  mapRowToRecord: (row: string[], columns: string[]) => Record<string, unknown>;
  mapRecordToRow: (record: Record<string, unknown>, columns: string[]) => string[];
}> = {
  materials: {
    columns: ["name", "unit", "category", "total_required", "ordered", "in_production", "shipped", "on_site", "installed", "deficit", "status", "supplier", "eta"],
    mapRowToRecord: (row, columns) => {
      const record: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        const val = row[i] || "";
        if (["total_required", "ordered", "in_production", "shipped", "on_site", "installed", "deficit"].includes(col)) {
          record[col] = parseFloat(val) || 0;
        } else {
          record[col] = val || null;
        }
      });
      return record;
    },
    mapRecordToRow: (record, columns) => columns.map((col) => String(record[col] ?? "")),
  },
  plan_fact: {
    columns: ["date", "week_number", "plan_value", "fact_value", "notes"],
    mapRowToRecord: (row, columns) => {
      const record: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        const val = row[i] || "";
        if (["week_number"].includes(col)) record[col] = parseInt(val) || 0;
        else if (["plan_value", "fact_value"].includes(col)) record[col] = parseFloat(val) || 0;
        else record[col] = val || null;
      });
      return record;
    },
    mapRecordToRow: (record, columns) => columns.map((col) => String(record[col] ?? "")),
  },
  floors: {
    columns: ["floor_number", "modules_plan", "modules_fact", "brackets_plan", "brackets_fact", "sealant_plan", "sealant_fact", "status"],
    mapRowToRecord: (row, columns) => {
      const record: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        const val = row[i] || "";
        if (col === "status") record[col] = val || "pending";
        else record[col] = parseInt(val) || 0;
      });
      return record;
    },
    mapRecordToRow: (record, columns) => columns.map((col) => String(record[col] ?? "")),
  },
  work_types: {
    columns: ["name", "section", "subsection", "unit", "volume", "workers_count", "duration_days", "start_date", "end_date"],
    mapRowToRecord: (row, columns) => {
      const record: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        const val = row[i] || "";
        if (["volume", "workers_count", "duration_days"].includes(col)) record[col] = parseFloat(val) || null;
        else record[col] = val || null;
      });
      return record;
    },
    mapRecordToRow: (record, columns) => columns.map((col) => String(record[col] ?? "")),
  },
};

serve(async (req) => {
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase environment variables are not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { action, sheet_id, sheet_name, target_table, range, direction, project_id } = body;

    if (action === "list_configs") {
      const { data, error } = await supabase.from("sync_config").select("*").eq("is_active", true);
      if (error) throw new Error(`Failed to list configs: ${error.message}`);
      return new Response(JSON.stringify({ success: true, configs: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKey) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not configured. Please add the full JSON key of a Google Service Account.");
    }

    const useServiceAccount = isServiceAccountJson(serviceAccountKey);
    let accessToken = "";
    
    if (useServiceAccount) {
      accessToken = await getAccessToken(serviceAccountKey);
    } else {
      if (action !== "pull") {
        throw new Error("API Key mode only supports 'pull' from public sheets. For push/sync, provide a Service Account JSON key.");
      }
    }

    if (action === "pull") {
      const handler = tableSyncHandlers[target_table];
      if (!handler) throw new Error(`Unsupported table: ${target_table}`);

      const sheetRange = range || `${sheet_name}!A2:Z1000`;
      const rows = useServiceAccount
        ? await readSheet(accessToken, sheet_id, sheetRange)
        : await readSheetWithApiKey(serviceAccountKey, sheet_id, sheetRange);

      if (rows.length === 0) {
        return new Response(JSON.stringify({ success: true, message: "No data to pull", rows_processed: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let processed = 0;
      for (const row of rows) {
        if (row.length === 0 || !row[0]) continue;
        const record = handler.mapRowToRecord(row, handler.columns);
        if (project_id) record.project_id = project_id;

        const { error } = await supabase.from(target_table).upsert(record, { onConflict: "id" });
        if (error) console.error(`Error upserting ${target_table}:`, error);
        else processed++;
      }

      await supabase.from("sync_config").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("sheet_id", sheet_id).eq("target_table", target_table);

      return new Response(JSON.stringify({ success: true, rows_processed: processed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "push") {
      const handler = tableSyncHandlers[target_table];
      if (!handler) throw new Error(`Unsupported table: ${target_table}`);

      let query = supabase.from(target_table).select("*");
      if (project_id) query = query.eq("project_id", project_id);
      const { data, error } = await query;
      if (error) throw new Error(`Failed to read ${target_table}: ${error.message}`);

      const header = handler.columns;
      const rows = (data || []).map((record: Record<string, unknown>) => handler.mapRecordToRow(record, handler.columns));
      const allRows = [header, ...rows];

      const sheetRange = range || `${sheet_name}!A1:Z${allRows.length}`;
      await writeSheet(accessToken, sheet_id, sheetRange, allRows);

      await supabase.from("sync_config").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("sheet_id", sheet_id).eq("target_table", target_table);

      return new Response(JSON.stringify({ success: true, rows_pushed: rows.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sync") {
      const handler = tableSyncHandlers[target_table];
      if (!handler) throw new Error(`Unsupported table: ${target_table}`);

      const pullRange = range || `${sheet_name}!A2:Z1000`;
      const sheetRows = await readSheet(accessToken, sheet_id, pullRange);

      let pulled = 0;
      for (const row of sheetRows) {
        if (row.length === 0 || !row[0]) continue;
        const record = handler.mapRowToRecord(row, handler.columns);
        if (project_id) record.project_id = project_id;
        const { error } = await supabase.from(target_table).upsert(record, { onConflict: "id" });
        if (!error) pulled++;
      }

      let query = supabase.from(target_table).select("*");
      if (project_id) query = query.eq("project_id", project_id);
      const { data } = await query;

      const header = handler.columns;
      const pushRows = (data || []).map((record: Record<string, unknown>) => handler.mapRecordToRow(record, handler.columns));
      const allRows = [header, ...pushRows];
      const pushRange = `${sheet_name}!A1:Z${allRows.length}`;
      await writeSheet(accessToken, sheet_id, pushRange, allRows);

      await supabase.from("sync_config").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("sheet_id", sheet_id).eq("target_table", target_table);

      return new Response(JSON.stringify({ success: true, pulled, pushed: pushRows.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    console.error("Google Sheets sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
