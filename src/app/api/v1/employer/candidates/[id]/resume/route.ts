import { requireMobile } from "@/lib/api/v1/require-mobile";
import { buildWatermarkedResume } from "@/lib/employer/resume-stream";
import { forbidden, notFound, withNoStore } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

/**
 * Watermarked PDF stream — the only employer resume path (§11-5). Watermarked
 * per request with company + viewer + timestamp, audited as `download_resume`,
 * and never cached. `canDownloadResume = false` → 403.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireMobile(request, { role: "employer" });
  if (error) return error;

  const { id } = await params;
  const result = await buildWatermarkedResume(ctx.db, {
    employerUserId: ctx.user.id,
    profileId: id,
    companyId: ctx.user.companyId,
    viewerEmail: ctx.user.email,
    audit: {
      actorUserId: ctx.user.id,
      actorRole: "employer",
      ip: ctx.meta.ip,
      userAgent: ctx.meta.userAgent,
    },
  });

  if (!result.ok) {
    return result.reason === "forbidden"
      ? forbidden("Resume access isn't enabled for this candidate.")
      : notFound("No resume is on file for this candidate.");
  }
  return withNoStore(result.response);
}
