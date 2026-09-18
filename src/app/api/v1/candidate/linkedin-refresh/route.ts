import { requireMobile } from "@/lib/api/v1/require-mobile";
import { requestLinkedInRefreshCore } from "@/lib/candidate/profile-core";
import { linkedInRefreshSchema } from "@/lib/api/v1/contracts/candidate";
import { readJson } from "@/lib/api/v1/parse";
import { badRequest, jsonOk, rateLimited } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

/** Ask Frog to refresh the profile from LinkedIn. Rate limited 3/hour. */
export async function POST(request: Request) {
  const { ctx, error } = await requireMobile(request, {
    role: "candidate",
    mutation: true,
  });
  if (error) return error;

  const { data, error: bodyError } = await readJson(
    request,
    linkedInRefreshSchema
  );
  if (bodyError) return bodyError;

  const result = await requestLinkedInRefreshCore(ctx.db, ctx.user.id, data.url);

  if (result.ok) {
    return jsonOk({
      ok: true,
      url: result.url,
      message: "Frog will review your LinkedIn profile and update your details.",
    });
  }
  if (result.reason === "rate") return rateLimited();
  if (result.reason === "url") {
    return badRequest("Enter a valid LinkedIn profile URL.");
  }
  if (result.reason === "saved_no_slack") {
    // Link saved, but we couldn't page Frog — tell the truth.
    return jsonOk({
      ok: true,
      url: data.url,
      message:
        "We saved your LinkedIn URL. If you don't hear back, contact your Frog representative.",
    });
  }
  return badRequest("We couldn't submit that request. Please try again.");
}
