import { eq, inArray } from "drizzle-orm";
import { users } from "@/lib/db/schema";
import type { Database } from "@/lib/db/client";
import { sendEmail, type SendResult } from "@/lib/email/resend";
import { notifySlack, type SlackNotifyResult } from "@/lib/slack/notify";

/**
 * `users.is_test = 1` marks App Review / internal verification accounts.
 * Their activity must not fire Resend email or Slack ops notifications
 * (Fable §11-7). Inbox + push still work normally.
 */
export async function isTestUser(
  db: Database,
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return false;
  const row = await db
    .select({ isTest: users.isTest })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  return !!row?.isTest;
}

/** True when ANY of these users is a test account. */
export async function anyTestUser(
  db: Database,
  userIds: (string | null | undefined)[]
): Promise<boolean> {
  const ids = userIds.filter((v): v is string => !!v);
  if (ids.length === 0) return false;
  const rows = await db
    .select({ isTest: users.isTest })
    .from(users)
    .where(inArray(users.id, ids))
    .all();
  return rows.some((r) => r.isTest);
}

/** True when this email belongs to a test account (admin-triggered mail). */
export async function isTestEmail(
  db: Database,
  email: string | null | undefined
): Promise<boolean> {
  if (!email) return false;
  const row = await db
    .select({ isTest: users.isTest })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .get();
  return !!row?.isTest;
}

/** sendEmail unless the recipient address belongs to a test account. */
export async function sendEmailUnlessTest(
  db: Database,
  params: Parameters<typeof sendEmail>[0]
): Promise<SendResult> {
  const to = Array.isArray(params.to) ? params.to[0] : params.to;
  if (await isTestEmail(db, to)) {
    console.warn("[email] skipped for is_test account");
    return { ok: true };
  }
  return sendEmail(params);
}

/** notifySlack unless one of the involved users is a test account. */
export async function notifySlackUnlessTest(
  db: Database,
  userIds: (string | null | undefined)[],
  text: string
): Promise<SlackNotifyResult> {
  if (await anyTestUser(db, userIds)) {
    console.warn("[slack] skipped for is_test account");
    return { ok: false, skipped: true };
  }
  return notifySlack(text);
}
