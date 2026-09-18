import { getD1Db } from "@/lib/db/client";
import { confirmPasswordReset } from "@/lib/api/v1/auth-service";
import { passwordResetConfirmSchema } from "@/lib/api/v1/contracts/auth";
import { readJson } from "@/lib/api/v1/parse";
import { badRequest, jsonOk, rateLimited } from "@/lib/api/v1/errors";
import { rateLimit } from "@/lib/ratelimit/kv";

export const dynamic = "force-dynamic";

/** Complete a reset. Every mobile session is revoked on success (owner §5). */
export async function POST(request: Request) {
  const { data, error } = await readJson(request, passwordResetConfirmSchema);
  if (error) return error;

  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";
  const allowed = await rateLimit(`rl:v1:pwreset-confirm:${ip}`, 20, 900);
  if (!allowed) return rateLimited();

  const db = await getD1Db();
  const result = await confirmPasswordReset(db, {
    token: data.token,
    newPassword: data.newPassword,
  });

  if (!result.ok) {
    return result.reason === "weak_password"
      ? badRequest("Your new password must be at least 8 characters.")
      : badRequest("That reset code is invalid or has expired.");
  }

  return jsonOk({
    ok: true,
    message: "Your password has been updated. Please sign in again.",
  });
}
