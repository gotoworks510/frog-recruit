import { and, eq, inArray, isNull } from "drizzle-orm";
import { notifications } from "@/lib/db/schema";
import { requireMobile } from "@/lib/api/v1/require-mobile";
import { markReadRequestSchema } from "@/lib/api/v1/contracts/notifications";
import { readJson } from "@/lib/api/v1/parse";
import { jsonOk } from "@/lib/api/v1/errors";
import { unreadCount } from "@/lib/notify/deliver";

export const dynamic = "force-dynamic";

/** Mark specific notifications — or all of them — read. */
export async function POST(request: Request) {
  const { ctx, error } = await requireMobile(request, {
    mutation: true,
    skipGates: ["password_reset", "terms", "consent"],
  });
  if (error) return error;

  const { data, error: bodyError } = await readJson(
    request,
    markReadRequestSchema
  );
  if (bodyError) return bodyError;

  const now = new Date();
  await ctx.db
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.userId, ctx.user.id),
        isNull(notifications.readAt),
        ...("ids" in data ? [inArray(notifications.id, data.ids)] : [])
      )
    );

  return jsonOk({ unreadCount: await unreadCount(ctx.db, ctx.user.id) });
}
