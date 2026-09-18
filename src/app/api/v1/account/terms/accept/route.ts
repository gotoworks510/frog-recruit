import { requireMobile } from "@/lib/api/v1/require-mobile";
import { acceptTerms } from "@/lib/legal/accept-core";
import { acceptTermsRequestSchema } from "@/lib/api/v1/contracts/auth";
import { readJson } from "@/lib/api/v1/parse";
import { jsonOk } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { ctx, error } = await requireMobile(request, {
    mutation: true,
    skipGates: ["password_reset", "terms", "consent"],
  });
  if (error) return error;

  const { data, error: bodyError } = await readJson(
    request,
    acceptTermsRequestSchema
  );
  if (bodyError) return bodyError;

  const result = await acceptTerms(ctx.db, ctx.user.id, data.version ?? null);
  return jsonOk({
    version: result.version,
    acceptedAt: result.acceptedAt.toISOString(),
  });
}
