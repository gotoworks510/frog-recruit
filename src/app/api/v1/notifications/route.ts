import { and, desc, eq, lt, or } from "drizzle-orm";
import { notifications } from "@/lib/db/schema";
import { requireMobile } from "@/lib/api/v1/require-mobile";
import { decodeCursor, encodeCursor } from "@/lib/api/v1/contracts/common";
import { notificationsQuerySchema } from "@/lib/api/v1/contracts/notifications";
import { readQuery } from "@/lib/api/v1/parse";
import { jsonOk } from "@/lib/api/v1/errors";
import { unreadCount } from "@/lib/notify/deliver";

export const dynamic = "force-dynamic";

/** In-app Inbox, newest first. Keyset pagination on (created_at, id). */
export async function GET(request: Request) {
  const { ctx, error } = await requireMobile(request, {});
  if (error) return error;

  const { data, error: queryError } = readQuery(
    request,
    notificationsQuerySchema
  );
  if (queryError) return queryError;

  const cursor = decodeCursor(data.cursor);
  const rows = await ctx.db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      title: notifications.title,
      body: notifications.body,
      dataJson: notifications.dataJson,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, ctx.user.id),
        ...(cursor
          ? [
              or(
                lt(notifications.createdAt, new Date(cursor.createdAtMs)),
                and(
                  eq(notifications.createdAt, new Date(cursor.createdAtMs)),
                  lt(notifications.id, cursor.id)
                )
              ),
            ]
          : [])
      )
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(data.limit + 1)
    .all();

  const page = rows.slice(0, data.limit);
  const last = page[page.length - 1];

  return jsonOk({
    notifications: page.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      data: parseData(r.dataJson),
      createdAt: r.createdAt.toISOString(),
      readAt: r.readAt ? r.readAt.toISOString() : null,
    })),
    nextCursor:
      rows.length > data.limit && last ? encodeCursor(last.createdAt, last.id) : null,
    unreadCount: await unreadCount(ctx.db, ctx.user.id),
  });
}

function parseData(raw: string | null): Record<string, string> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, string>)
      : null;
  } catch {
    return null;
  }
}
