import { and, eq, isNull, ne } from "drizzle-orm";
import { devicePushTokens, mobileSessions } from "@/lib/db/schema";
import type { Database } from "@/lib/db/client";

export type RevokeReason =
  | "logout"
  | "rotated"
  | "reuse_detected"
  | "password_changed"
  | "admin";

/**
 * Kill a user's mobile sessions and the push tokens on those devices (§7.5).
 * A revoked employer must not keep receiving candidate pushes on their phone.
 *
 * `exceptSessionId` keeps the caller's own session alive (self-service password
 * change from the app signs out the *other* devices only).
 *
 * Best-effort: never throws — the triggering admin action must still complete.
 */
export async function revokeMobileSessions(
  db: Database,
  userId: string,
  reason: RevokeReason,
  options?: { exceptSessionId?: string | null }
): Promise<void> {
  const except = options?.exceptSessionId ?? null;

  try {
    const sessions = await db
      .select({
        id: mobileSessions.id,
        deviceId: mobileSessions.deviceId,
      })
      .from(mobileSessions)
      .where(
        and(
          eq(mobileSessions.userId, userId),
          isNull(mobileSessions.revokedAt),
          ...(except ? [ne(mobileSessions.id, except)] : [])
        )
      )
      .all();

    if (sessions.length === 0) return;

    await db
      .update(mobileSessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(
        and(
          eq(mobileSessions.userId, userId),
          isNull(mobileSessions.revokedAt),
          ...(except ? [ne(mobileSessions.id, except)] : [])
        )
      );

    // Drop push tokens for the devices we just signed out. The kept session's
    // device (if any) stays registered.
    let keptDeviceId: string | null = null;
    if (except) {
      const kept = await db
        .select({ deviceId: mobileSessions.deviceId })
        .from(mobileSessions)
        .where(eq(mobileSessions.id, except))
        .get();
      keptDeviceId = kept?.deviceId ?? null;
    }

    for (const s of sessions) {
      if (keptDeviceId && s.deviceId === keptDeviceId) continue;
      await db
        .delete(devicePushTokens)
        .where(
          and(
            eq(devicePushTokens.userId, userId),
            eq(devicePushTokens.deviceId, s.deviceId)
          )
        );
    }
  } catch (e) {
    console.error("[mobile] revokeMobileSessions failed:", e);
  }
}
