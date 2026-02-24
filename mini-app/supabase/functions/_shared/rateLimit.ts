// In-memory rate limiter for Edge Functions
// Uses a sliding window counter per user

interface RateEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.windowStart > 120_000) {
      store.delete(key);
    }
  }
}, 300_000);

/**
 * Check rate limit for a given key.
 * @param key - unique identifier (e.g. user_id)
 * @param maxRequests - max requests per window
 * @param windowMs - window size in ms (default 60s)
 * @returns { allowed, remaining, retryAfterMs }
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs = 60_000,
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    const retryAfterMs = windowMs - (now - entry.windowStart);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, retryAfterMs: 0 };
}
