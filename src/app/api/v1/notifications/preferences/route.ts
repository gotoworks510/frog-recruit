import { requireMobile } from "@/lib/api/v1/require-mobile";
import { listPreferences, setPreference } from "@/lib/notify/prefs";
import { NOTIFICATION_CATALOG } from "@/lib/notify/events";
import { setPreferenceRequestSchema } from "@/lib/api/v1/contracts/notifications";
import { readJson } from "@/lib/api/v1/parse";
import { badRequest, jsonOk } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

/** Per-kind push toggles for this role only. */
export async function GET(request: Request) {
  const { ctx, error } = await requireMobile(request, {});
  if (error) return error;

  return jsonOk({
    preferences: await listPreferences(ctx.db, ctx.user.id, ctx.user.role),
  });
}

export async function PUT(request: Request) {
  const { ctx, error } = await requireMobile(request, {
    mutation: true,
    skipGates: ["password_reset", "terms", "consent"],
  });
  if (error) return error;

  const { data, error: bodyError } = await readJson(
    request,
    setPreferenceRequestSchema
  );
  if (bodyError) return bodyError;

  // Don't let one app store a preference for the other role's events.
  if (!NOTIFICATION_CATALOG[data.kind].audience.includes(ctx.user.role)) {
    return badRequest("That notification type doesn't apply to this account.");
  }

  const preference = await setPreference(
    ctx.db,
    ctx.user.id,
    data.kind,
    data.pushEnabled
  );
  return jsonOk({ preference });
}
