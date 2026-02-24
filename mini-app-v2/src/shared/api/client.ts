const API_BASE = import.meta.env.VITE_API_URL || "";

function getAuthHeader(): Record<string, string> {
  const tg = window.Telegram?.WebApp;
  if (tg?.initData) {
    return { Authorization: `tma ${tg.initData}` };
  }
  // Dev fallback
  const token = localStorage.getItem("sfera_token");
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeader(),
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
