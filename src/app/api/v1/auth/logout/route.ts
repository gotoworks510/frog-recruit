import { logout } from "@/lib/api/v1/auth-service";
import { jsonOk } from "@/lib/api/v1/errors";
import { requireMobile } from "@/lib/api/v1/require-mobile";

export const dynamic = "force-dynamic";

/** Revoke this device's session + delete its push token. */
export async function POST(request: Request) {
  const { ctx, error } = await requireMobile(request, {
    mutation: true,
    skipGates: ["password_reset", "terms", "consent"],
  });
  if (error) return error;

  await logout(ctx.db, {
    sessionId: ctx.session.id,
    userId: ctx.user.id,
    deviceId: ctx.session.deviceId,
  });
  return jsonOk({ ok: true });
}
