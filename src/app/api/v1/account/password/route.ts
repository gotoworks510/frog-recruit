import { requireMobile } from "@/lib/api/v1/require-mobile";
import { changePassword } from "@/lib/account/password-core";
import { changePasswordRequestSchema } from "@/lib/api/v1/contracts/auth";
import { readJson } from "@/lib/api/v1/parse";
import { badRequest, jsonOk } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

/**
 * Self-service password change. Allowed while any gate is unmet — this IS the
 * way out of the forced-reset funnel. Other devices are signed out; this
 * session survives.
 */
export async function POST(request: Request) {
  const { ctx, error } = await requireMobile(request, {
    mutation: true,
    skipGates: ["password_reset", "terms", "consent"],
  });
  if (error) return error;

  const { data, error: bodyError } = await readJson(
    request,
    changePasswordRequestSchema
  );
  if (bodyError) return bodyError;

  const result = await changePassword(ctx.db, {
    userId: ctx.user.id,
    role: ctx.user.role,
    currentPassword: data.currentPassword,
    newPassword: data.newPassword,
    exceptSessionId: ctx.session.id,
  });

  if (!result.ok) {
    if (result.reason === "current") {
      return badRequest("The current password is incorrect.");
    }
    if (result.reason === "unsupported") {
      return badRequest("Password change is not available for this account.");
    }
    return badRequest("Your new password must be at least 8 characters.");
  }

  return jsonOk({ ok: true });
}
