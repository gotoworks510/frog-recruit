import { getD1Db } from "@/lib/db/client";
import { refresh } from "@/lib/api/v1/auth-service";
import { refreshRequestSchema } from "@/lib/api/v1/contracts/auth";
import { readJson } from "@/lib/api/v1/parse";
import { jsonOk, rateLimited, unauthorized } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

/**
 * Rotating refresh. The client MUST overwrite its stored refresh token with the
 * one in this response and must single-flight refresh calls (owner §8).
 */
export async function POST(request: Request) {
  const { data, error } = await readJson(request, refreshRequestSchema);
  if (error) return error;

  const db = await getD1Db();
  const result = await refresh(db, { refreshToken: data.refreshToken });

  if (!result.ok) {
    return result.reason === "rate_limited" ? rateLimited() : unauthorized();
  }
  return jsonOk(result.tokens);
}
