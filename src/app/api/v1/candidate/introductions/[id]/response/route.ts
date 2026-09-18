import { requireMobile } from "@/lib/api/v1/require-mobile";
import { respondToIntroduction } from "@/lib/candidate/introduction-response";
import { introductionResponseSchema } from "@/lib/api/v1/contracts/candidate";
import { readJson } from "@/lib/api/v1/parse";
import { conflict, jsonOk, notFound } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

/**
 * Candidate reaction to an introduction card. Allowed WITHOUT active consent
 * (owner decision §6) — it's an intent signal to Frog, and the employer is
 * never notified.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireMobile(request, {
    role: "candidate",
    mutation: true,
    skipGates: ["consent"],
  });
  if (error) return error;
  if (!ctx.profileId) return notFound("Your profile is still being set up.");

  const { id } = await params;
  const { data, error: bodyError } = await readJson(
    request,
    introductionResponseSchema
  );
  if (bodyError) return bodyError;

  const outcome = await respondToIntroduction(ctx.db, {
    profileId: ctx.profileId,
    introductionId: id,
    response: data.response,
    clientRequestId: data.clientRequestId,
    // Omitted = no concurrency check. Explicit null = "there is no answer yet".
    baseRespondedAt:
      data.baseUpdatedAt === undefined
        ? undefined
        : data.baseUpdatedAt === null
          ? null
          : new Date(data.baseUpdatedAt),
  });

  if (!outcome.ok) return notFound("That introduction was not found.");

  const { result } = outcome;
  if (result.conflict) {
    return conflict(
      "Your answer changed on another device. Review the current answer before saving.",
      {
        current: {
          response: result.response,
          respondedAt: result.respondedAt.toISOString(),
        },
      }
    );
  }

  return jsonOk({
    introductionId: result.introductionId,
    response: result.response,
    respondedAt: result.respondedAt.toISOString(),
    idempotentReplay: !!result.idempotentReplay,
  });
}
