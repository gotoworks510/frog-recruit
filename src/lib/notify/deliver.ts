import { and, eq, isNull, sql } from "drizzle-orm";
import { devicePushTokens, notifications } from "@/lib/db/schema";
import type { Database } from "@/lib/db/client";
import { isPushEnabled } from "./prefs";
import { runAfterResponse, sendExpoPush, type PushMessage } from "./push";
import type { NotificationKind } from "./events";

export interface NotifyEvent {
  kind: NotificationKind;
  /** Recipient user id. */
  userId: string;
  /** English. No candidate name / salary / Frog Score / internal notes. */
  title: string;
  body?: string | null;
  /** Idempotency key — UNIQUE per (user_id, dedupe_key). */
  dedupeKey: string;
  /** Deep link target: `{ route: "candidates/<id>" }`. */
  data?: Record<string, string>;
}

export interface EmitResult {
  /** False when the dedupe key already existed (no Inbox row, no push). */
  created: boolean;
  notificationId: string | null;
}

/**
 * Create one Inbox row and (when allowed) one push, idempotent on
 * (user_id, dedupe_key). Safe to call repeatedly — Fable §7.3.
 *
 * `is_test` users receive Inbox + push normally; only email / Slack are
 * skipped (see notify/skip-ops.ts).
 */
export async function emit(
  db: Database,
  event: NotifyEvent
): Promise<EmitResult> {
  const id = crypto.randomUUID();

  try {
    await db
      .insert(notifications)
      .values({
        id,
        userId: event.userId,
        kind: event.kind,
        title: event.title,
        body: event.body ?? null,
        dataJson: event.data ? JSON.stringify(event.data) : null,
        dedupeKey: event.dedupeKey,
        createdAt: new Date(),
      })
      .onConflictDoNothing({
        target: [notifications.userId, notifications.dedupeKey],
      });
  } catch (e) {
    console.error("[notify] insert failed:", e);
    return { created: false, notificationId: null };
  }

  // Our row only exists if this dedupe key was new.
  const inserted = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.id, id))
    .get();
  if (!inserted) return { created: false, notificationId: null };

  await deliverPush(db, id, event);
  return { created: true, notificationId: id };
}

async function deliverPush(
  db: Database,
  notificationId: string,
  event: NotifyEvent
): Promise<void> {
  const allowed = await isPushEnabled(db, event.userId, event.kind);
  if (!allowed) {
    await setPushStatus(db, notificationId, "skipped_pref");
    return;
  }

  const devices = await db
    .select({
      id: devicePushTokens.id,
      expoPushToken: devicePushTokens.expoPushToken,
    })
    .from(devicePushTokens)
    .where(
      and(
        eq(devicePushTokens.userId, event.userId),
        eq(devicePushTokens.enabled, true),
        isNull(devicePushTokens.invalidatedAt)
      )
    )
    .all();

  if (devices.length === 0) {
    await setPushStatus(db, notificationId, "skipped_no_device");
    return;
  }

  const badge = await unreadCount(db, event.userId);
  const messages: PushMessage[] = devices.map((d) => ({
    to: d.expoPushToken,
    title: event.title,
    body: event.body ?? undefined,
    data: event.data,
    badge,
    categoryId: event.kind,
  }));

  await runAfterResponse(
    (async () => {
      const tickets = await sendExpoPush(messages);
      let anyOk = false;
      let lastError: string | null = null;

      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const device = devices[i];
        if (ticket.status === "ok") {
          anyOk = true;
          continue;
        }
        if (ticket.status === "device_not_registered") {
          lastError = "DeviceNotRegistered";
          await db
            .update(devicePushTokens)
            .set({
              invalidatedAt: new Date(),
              lastError: "DeviceNotRegistered",
              updatedAt: new Date(),
            })
            .where(eq(devicePushTokens.id, device.id));
          continue;
        }
        lastError = ticket.error ?? "error";
        await db
          .update(devicePushTokens)
          .set({ lastError, updatedAt: new Date() })
          .where(eq(devicePushTokens.id, device.id));
      }

      await db
        .update(notifications)
        .set({
          pushedAt: anyOk ? new Date() : null,
          pushStatus: anyOk ? "sent" : (lastError ?? "error"),
        })
        .where(eq(notifications.id, notificationId));
    })()
  );
}

async function setPushStatus(
  db: Database,
  notificationId: string,
  status: string
): Promise<void> {
  await db
    .update(notifications)
    .set({ pushStatus: status })
    .where(eq(notifications.id, notificationId));
}

/** Unread Inbox count — used as the iOS badge value. */
export async function unreadCount(
  db: Database,
  userId: string
): Promise<number> {
  const row = await db
    .select({ n: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), isNull(notifications.readAt))
    )
    .get();
  return Number(row?.n ?? 0);
}
