import { requireMobile } from "@/lib/api/v1/require-mobile";
import { buildEmployerCandidateView } from "@/lib/employer/candidate-dto";
import { englishLabel, workAuthLabel } from "@/lib/api/v1/serialize";
import { jsonOk, notFound } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

/**
 * What an employer sees — minus Frog's recommendation and `frogScore`.
 * Those are employer-only (AGENTS.md: never shown on /me or in preview).
 */
export async function GET(request: Request) {
  const { ctx, error } = await requireMobile(request, { role: "candidate" });
  if (error) return error;
  if (!ctx.profileId) return notFound("Your profile is still being set up.");

  const view = await buildEmployerCandidateView(ctx.db, ctx.profileId);
  if (!view) return notFound("Your profile is still being set up.");

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
  });
}
