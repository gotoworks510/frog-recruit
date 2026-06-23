import { and, desc, eq } from "drizzle-orm";
import { recommendations } from "@/lib/db/schema";
import { getCandidateByProfileId } from "@/lib/candidate/profile";
import type { Database } from "@/lib/db/client";

/**
 * Employer-safe candidate view. Only curated fields + the published/shared
 * recommendation's strengths/considerations. NEVER includes internalNotesMd,
 * raw contact details, or draft/internal recommendations.
 */
export interface EmployerCandidateView {
  profileId: string;
  displayName: string | null;
  headline: string | null;
  summary: string | null;
  locationCurrent: string | null;
  locationPreference: string | null;
  yearsExperience: number | null;
  workAuthStatus: string | null;
  visaNotes: string | null;
  availability: string | null;
  englishLevel: string | null;
  desiredSalaryMin: number | null;
  desiredSalaryMax: number | null;
  salaryCurrency: string;
  hasResume: boolean;
  experiences: Array<{
    id: string;
    company: string;
    title: string;
    employmentType: string | null;
    startDate: Date | null;
    endDate: Date | null;
    isCurrent: boolean;
    location: string | null;
    description: string | null;
    techStack: string | null;
  }>;
  links: Array<{ id: string; kind: string; url: string; label: string | null }>;
  recommendation: { strengthsMd: string | null; considerationsMd: string | null } | null;
}

export async function buildEmployerCandidateView(
  db: Database,
  profileId: string,
  options?: { includeUnsharedRecommendation?: boolean; companyId?: string | null }
): Promise<EmployerCandidateView | null> {
  const candidate = await getCandidateByProfileId(db, profileId);
  if (!candidate) return null;
  const p = candidate.profile;

  // Recommendations are per-company; pick the one targeted at this company,
  // falling back to a general (companyId = null) recommendation.
  const conds = options?.includeUnsharedRecommendation
    ? [eq(recommendations.candidateProfileId, profileId)]
    : [
        eq(recommendations.candidateProfileId, profileId),
        eq(recommendations.status, "published"),
        eq(recommendations.visibility, "shared"),
      ];

  const recs = await db
    .select({
      companyId: recommendations.companyId,
      strengthsMd: recommendations.strengthsMd,
      considerationsMd: recommendations.considerationsMd,
    })
    .from(recommendations)
    .where(and(...conds))
    .orderBy(desc(recommendations.updatedAt))
    .all();

  const targetCompany = options?.companyId ?? null;
  const rec =
    (targetCompany
      ? recs.find((r) => r.companyId === targetCompany)
      : undefined) ??
    recs.find((r) => r.companyId === null) ??
    recs[0];

  return {
    profileId: p.id,
    displayName: p.displayName,
    headline: p.headline,
    summary: p.summary,
    locationCurrent: p.locationCurrent,
    locationPreference: p.locationPreference,
    yearsExperience: p.yearsExperience,
    workAuthStatus: p.workAuthStatus,
    visaNotes: p.visaNotes,
    availability: p.availability,
    englishLevel: p.englishLevel,
    desiredSalaryMin: p.desiredSalaryMin,
    desiredSalaryMax: p.desiredSalaryMax,
    salaryCurrency: p.salaryCurrency,
    hasResume: !!p.resumeKey,
    experiences: candidate.experiences.map((e) => ({
      id: e.id,
      company: e.company,
      title: e.title,
      employmentType: e.employmentType,
      startDate: e.startDate,
      endDate: e.endDate,
      isCurrent: e.isCurrent,
      location: e.location,
      description: e.description,
      techStack: e.techStack,
    })),
    links: candidate.links.map((l) => ({
      id: l.id,
      kind: l.kind,
      url: l.url,
      label: l.label,
    })),
    recommendation: rec
      ? { strengthsMd: rec.strengthsMd, considerationsMd: rec.considerationsMd }
      : null,
  };
}
