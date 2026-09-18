import { and, eq } from "drizzle-orm";
import {
  candidateFeedback,
  candidateIntroductions,
  jobs,
} from "@/lib/db/schema";
import { requireMobile } from "@/lib/api/v1/require-mobile";
import { getEffectiveGrant } from "@/lib/auth/grant";
import { buildEmployerCandidateView } from "@/lib/employer/candidate-dto";
import { parseDeclineReasons } from "@/lib/employer/feedback";
import { englishLabel, workAuthLabel } from "@/lib/api/v1/serialize";
import { jsonOk, notFound } from "@/lib/api/v1/errors";
import { writeAudit } from "@/lib/audit/log";
import { emitEmployerViewed } from "@/lib/notify/visibility";

export const dynamic = "force-dynamic";

/**
 * Candidate detail for an employer. Returns only the `buildEmployerCandidateView`
 * DTO fields — `internalNotesMd` and the candidate's email never appear here.
 * Writes `view_detail` and fires the candidate's `employer.viewed` event.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireMobile(request, { role: "employer" });
  if (error) return error;

  const { id } = await params;

  const grant = await getEffectiveGrant(ctx.db, ctx.user.id, id);
  if (!grant) return notFound("This candidate is no longer available.");

  const view = await buildEmployerCandidateView(ctx.db, id, {
    companyId: grant.companyId,
  });
  if (!view) return notFound("This candidate is no longer available.");

  const [fb, intro, job] = await Promise.all([
    ctx.db
      .select()
      .from(candidateFeedback)
      .where(
        and(
          eq(candidateFeedback.employerUserId, ctx.user.id),
          eq(candidateFeedback.candidateProfileId, id)
        )
      )
      .get(),
    ctx.db
      .select({
        status: candidateIntroductions.status,
        updatedAt: candidateIntroductions.updatedAt,
      })
      .from(candidateIntroductions)
      .where(
        and(
          eq(candidateIntroductions.candidateProfileId, id),
          eq(candidateIntroductions.companyId, grant.companyId)
        )
      )
      .get(),
    grant.jobId
      ? ctx.db
          .select({ title: jobs.title, location: jobs.location })
          .from(jobs)
          .where(eq(jobs.id, grant.jobId))
          .get()
      : ctx.db
          .select({ title: jobs.title, location: jobs.location })
          .from(jobs)
          .where(and(eq(jobs.companyId, grant.companyId), eq(jobs.status, "open")))
          .get(),
  ]);

  await writeAudit(ctx.db, {
    actorUserId: ctx.user.id,
    actorRole: "employer",
    companyId: ctx.user.companyId,
    candidateProfileId: id,
    action: "view_detail",
    accessGrantId: grant.id,
    ip: ctx.meta.ip,
    userAgent: ctx.meta.userAgent,
  });

  await emitEmployerViewed(ctx.db, {
    profileId: id,
    companyId: grant.companyId,
  });

  return jsonOk({
    profileId: view.profileId,
    displayName: view.displayName,
    headline: view.headline,
    summary: view.summary,
    locationCurrent: view.locationCurrent,
    locationPreference: view.locationPreference,
    yearsExperience: view.yearsExperience,
    workAuthStatus: view.workAuthStatus,
    workAuthLabel: workAuthLabel(view.workAuthStatus),
    visaNotes: view.visaNotes,
    availability: view.availability,
    englishLevel: view.englishLevel,
    englishLabel: englishLabel(view.englishLevel),
    desiredSalaryMin: view.desiredSalaryMin,
    desiredSalaryMax: view.desiredSalaryMax,
    salaryCurrency: view.salaryCurrency,
    hasResume: view.hasResume,
    canDownloadResume: grant.canDownloadResume,
    experiences: view.experiences.map((e) => ({
      id: e.id,
      company: e.company,
      title: e.title,
      employmentType: e.employmentType,
      startDate: e.startDate ? e.startDate.toISOString() : null,
      endDate: e.endDate ? e.endDate.toISOString() : null,
      isCurrent: e.isCurrent,
      location: e.location,
      description: e.description,
      techStack: e.techStack,
    })),
    links: view.links,
    recommendation: view.recommendation,
    targetRoleTitle: job?.title ?? null,
    targetRoleLocation: job?.location ?? null,
    introductionStatus: intro?.status ?? null,
    introducedAt: intro?.updatedAt ? intro.updatedAt.toISOString() : null,
    myFeedback: fb
      ? {
          interest: fb.interest,
          wantsInterview: fb.wantsInterview,
          questionsMd: fb.questionsMd,
          declineReasons: parseDeclineReasons(fb.declineReasons),
          declineNote: fb.declineNote,
          updatedAt: fb.updatedAt ? fb.updatedAt.toISOString() : null,
        }
      : null,
  });
}
