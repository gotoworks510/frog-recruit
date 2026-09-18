/**
 * Expo Push Service transport. Everything push-related is behind this module so
 * a future switch to direct APNs (p8 + WebCrypto ES256) is a single-file change.
 *
 * Never throws — a push failure must not affect the API response.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushMessage {
  /** Expo push token (ExponentPushToken[...]). */
  to: string;
  title: string;
  body?: string | null;
  /** Deep-link payload only — no PII (§7.3). */
  data?: Record<string, string>;
  badge?: number;
  /** Used as the iOS notification category (kind). */
  categoryId?: string;
}

export type PushTicketStatus = "ok" | "device_not_registered" | "error";

export interface PushTicket {
  token: string;
  status: PushTicketStatus;
  error?: string;
}

interface ExpoTicket {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Send up to 100 messages in one Expo request. Returns one ticket per input
 * message, in order, so callers can invalidate dead device tokens.
 */
export async function sendExpoPush(
  messages: PushMessage[]
): Promise<PushTicket[]> {
  if (messages.length === 0) return [];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
  };
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const payload = messages.map((m) => ({
    to: m.to,
    title: m.title,
    body: m.body ?? undefined,
    data: m.data,
    badge: m.badge,
    sound: "default",
    categoryId: m.categoryId,
    mutableContent: false,
    priority: "high",
  }));

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[push] expo HTTP error:", res.status, text.slice(0, 200));
      return messages.map((m) => ({
        token: m.to,
        status: "error" as const,
        error: `HTTP ${res.status}`,
      }));
    }

    const json = (await res.json().catch(() => null)) as {
      data?: ExpoTicket[];
      errors?: { message?: string }[];
    } | null;

    if (!json?.data) {
      const msg = json?.errors?.[0]?.message ?? "malformed expo response";
      console.error("[push] expo response error:", msg);
      return messages.map((m) => ({
        token: m.to,
        status: "error" as const,
        error: msg,
      }));
    }

    return messages.map((m, i) => {
      const ticket = json.data?.[i];
      if (ticket?.status === "ok") return { token: m.to, status: "ok" as const };
      const detail = ticket?.details?.error;
      if (detail === "DeviceNotRegistered") {
        return { token: m.to, status: "device_not_registered" as const };
      }
      return {
        token: m.to,
        status: "error" as const,
        error: detail || ticket?.message || "unknown",
      };
    });
  } catch (e) {
    console.error("[push] expo network error:", e);
    return messages.map((m) => ({
      token: m.to,
      status: "error" as const,
      error: e instanceof Error ? e.message : "network error",
    }));
  }
}

/**
 * Run work after the response is flushed (Workers `ctx.waitUntil`). Falls back
 * to awaiting inline when no Cloudflare context exists (local `next dev`).
 */
export async function runAfterResponse(work: Promise<unknown>): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const { ctx } = await getCloudflareContext({ async: true });
      ctx.waitUntil(work);
      return;
    } catch {
      /* no Worker context — fall through to inline await */
    }
  }
  await work.catch((e) => console.error("[push] deferred work failed:", e));
}
