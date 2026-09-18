import { and, eq } from "drizzle-orm";
import { notificationPreferences } from "@/lib/db/schema";
import type { Database } from "@/lib/db/client";
import {
  NOTIFICATION_CATALOG,
  defaultPushEnabled,
  kindsForAudience,
  type NotificationAudience,
  type NotificationKind,
} from "./events";

export interface PreferenceRow {
  kind: NotificationKind;
  label: string;
  description: string;
  pushEnabled: boolean;
}

/**
 * Preferences for the kinds this role can receive. A missing row falls back to
 * the catalog default (see events.ts — employer.viewed defaults to OFF).
 */
export async function listPreferences(
  db: Database,
  userId: string,
  audience: NotificationAudience
): Promise<PreferenceRow[]> {
  const stored = await db
    .select({
      kind: notificationPreferences.kind,
      pushEnabled: notificationPreferences.pushEnabled,
    })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .all();

  const byKind = new Map(stored.map((r) => [r.kind, r.pushEnabled]));

  return kindsForAudience(audience).map((meta) => ({
    kind: meta.kind,
    label: meta.label,
    description: meta.description,
    pushEnabled: byKind.get(meta.kind) ?? meta.defaultPushEnabled,
  }));
}

/** Is push allowed for this (user, kind)? Falls back to the catalog default. */
export async function isPushEnabled(
  db: Database,
  userId: string,
  kind: NotificationKind
): Promise<boolean> {
  const row = await db
    .select({ pushEnabled: notificationPreferences.pushEnabled })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.kind, kind)
      )
    )
    .get();
  return row?.pushEnabled ?? defaultPushEnabled(kind);
}

export async function setPreference(
  db: Database,
  userId: string,
  kind: NotificationKind,
  pushEnabled: boolean
): Promise<PreferenceRow> {
  const existing = await db
    .select({ kind: notificationPreferences.kind })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.kind, kind)
      )
    )
    .get();

  if (existing) {
    await db
      .update(notificationPreferences)
      .set({ pushEnabled, updatedAt: new Date() })
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.kind, kind)
        )
      );
  } else {
    await db
      .insert(notificationPreferences)
      .values({ userId, kind, pushEnabled, updatedAt: new Date() });
  }

  const meta = NOTIFICATION_CATALOG[kind];
  return {
    kind,
    label: meta.label,
    description: meta.description,
    pushEnabled,
  };
}
