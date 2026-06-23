/**
 * KV-backed rate limiting (ported pattern from frog-mailsystem).
 * Best-effort: KV failures never block the underlying operation.
 *
 * Note: KV expirationTtl minimum is 60 seconds.
 */

async function getKv(): Promise<KVNamespace | null> {
  if (process.env.NODE_ENV === "development") {
    // In `next dev` there is no KV binding; degrade to no-op (no throttling).
    return null;
  }
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return env.KV ?? null;
  } catch {
    return null;
  }
}

/**
 * Increment a counter under `key`. Returns true if the request is allowed
 * (count was below `limit` before this call), false if rate-limited.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const kv = await getKv();
  if (!kv) return true; // no KV (dev) → allow

  try {
    const current = parseInt((await kv.get(key)) ?? "0", 10);
    if (current >= limit) return false;
    await kv.put(key, String(current + 1), {
      expirationTtl: Math.max(60, windowSeconds),
    });
    return true;
  } catch {
    return true; // KV error → do not block
  }
}

/** Convenience: login throttle (10 attempts / 15 min per IP). */
export async function loginRateLimit(ip: string): Promise<boolean> {
  return rateLimit(`rl:login:${ip}`, 10, 900);
}
