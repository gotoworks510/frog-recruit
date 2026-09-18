import { requireMobile } from "@/lib/api/v1/require-mobile";
import { getEffectiveGrant } from "@/lib/auth/grant";
import { upsertCandidateFeedback } from "@/lib/employer/feedback-core";
import { feedbackRequestSchema } from "@/lib/api/v1/contracts/employer";
import { readJson } from "@/lib/api/v1/parse";
import { conflict, jsonOk, notFound } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

/**
 * Upsert this employer's feedback. Idempotent on `clientRequestId` and guarded
 * by `baseUpdatedAt` so a queued offline write can't clobber a newer edit
 * (owner decision §9).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireMobile(request, {
    role: "employer",
    mutation: true,
  });
  if (error) return error;

  const { id } = await params;
  const { data, error: bodyError } = await readJson(
    request,
    feedbackRequestSchema
  );
  if (bodyError) return bodyError;

  const grant = await getEffectiveGrant(ctx.db, ctx.user.id, id);
  if (!grant) return notFound("This candidate is no longer available.");

  const result = await upsertCandidateFeedback(ctx.db, {
    employerUserId: ctx.user.id,
    grant,
    input: {
      interest: data.interest,
      wantsInterview: data.wantsInterview,
      questionsMd: data.questionsMd ?? null,
      declineReasons: data.declineReasons,
      declineNote: data.declineNote ?? null,
      clientRequestId: data.clientRequestId,
      // Omitted = no concurrency check. Explicit null = "there is no feedback yet".
      baseUpdatedAt:
        data.baseUpdatedAt === undefined
          ? undefined
          : data.baseUpdatedAt === null
            ? null
            : new Date(data.baseUpdatedAt),
    },
    audit: {
      actorUserId: ctx.user.id,
      actorRole: "employer",
      ip: ctx.meta.ip,
      userAgent: ctx.meta.userAgent,
    },
  });

  if (result.conflict) {
    return conflict(
      "This feedback changed on another device. Review the current version before saving.",
      { current: serialize(result.feedback) }
    );
  }

  return jsonOk({
    feedback: serialize(result.feedback),
    newlyInterested: result.newlyInterested,
    idempotentReplay: !!result.idempotentReplay,
  });
}

function serialize(feedback: {
  interest: string;
  wantsInterview: boolean;
  questionsMd: string | null;
  declineReasons: string[];
  declineNote: string | null;
  updatedAt: Date | null;
}) {
  return {
    ...feedback,
    updatedAt: feedback.updatedAt ? feedback.updatedAt.toISOString() : null,
  };
}
