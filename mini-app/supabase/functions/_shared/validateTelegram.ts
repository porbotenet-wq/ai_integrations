// Deno-compatible version for Supabase Edge Functions

export function validateInitData(
  initData: string,
  botToken: string
): { id: number; first_name: string; username?: string } | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  const authDate = parseInt(params.get("auth_date") || "0", 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 300) return null;

  params.delete("hash");
  const entries = [...params.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const checkString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  // Sync not available in Deno — use validateInitDataAsync
  return null;
}

export async function validateInitDataAsync(
  initData: string,
  botToken: string
): Promise<{ id: number; first_name: string; username?: string } | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  const authDate = parseInt(params.get("auth_date") || "0", 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 300) return null;

  params.delete("hash");
  const entries = [...params.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const checkString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  const enc = new TextEncoder();

  const secretKeyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const secretKey = await crypto.subtle.sign(
    "HMAC",
    secretKeyMaterial,
    enc.encode(botToken)
  );

  const signingKey = await crypto.subtle.importKey(
    "raw",
    secretKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    signingKey,
    enc.encode(checkString)
  );

  const computedHash = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computedHash !== hash) return null;

  try {
    const userStr = params.get("user");
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}
