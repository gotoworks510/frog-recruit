import { getD1Db } from "@/lib/db/client";
import { requestPasswordReset } from "@/lib/api/v1/auth-service";
import { passwordResetRequestSchema } from "@/lib/api/v1/contracts/auth";
import { readJson } from "@/lib/api/v1/parse";
import { jsonOk } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

/**
 * Start a self-service password reset (owner decision §5).
 * The response is ALWAYS the same so the endpoint can't be used to check
 * whether an email has an account.
 */
export async function POST(request: Request) {
  const { data, error } = await readJson(request, passwordResetRequestSchema);
  if (error) return error;

  const db = await getD1Db();
  try {
    await requestPasswordReset(db, {
      email: data.email,
      appVariant: data.appVariant,
    });
  } catch (e) {
    console.error("[v1] password reset request failed:", e);
  }

  return jsonOk({
    ok: true,
    message:
      "If that email has a Frog Recruit account, we've sent a reset code. Check your inbox.",
  });
}
