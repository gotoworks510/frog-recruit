import { submitEmployerAccessRequest } from "@/lib/employer/access-request";
import { employerAccessRequestSchema } from "@/lib/api/v1/contracts/employer";
import { readJson } from "@/lib/api/v1/parse";
import { jsonOk, rateLimited } from "@/lib/api/v1/errors";
import { rateLimit } from "@/lib/ratelimit/kv";

export const dynamic = "force-dynamic";

/**
 * Public employer access request from the iPhone app (no auth).
 * Slack → Frog ops; confirmation email → requester.
 */
export async function POST(request: Request) {
  const { data, error } = await readJson(request, employerAccessRequestSchema);
  if (error) return error;

  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";
  const allowed = await rateLimit(`rl:v1:employer-access:${ip}`, 5, 3600);
  if (!allowed) return rateLimited();

  try {
    await submitEmployerAccessRequest(data);
  } catch (e) {
    console.error("[v1] employer access request failed:", e);
  }

  return jsonOk({
    ok: true,
    message:
      "Thanks — we received your request. If Frog can introduce a strong fit, we'll email you account details.",
  });
}
