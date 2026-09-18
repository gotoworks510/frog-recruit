import { and, desc, eq, inArray } from "drizzle-orm";
import {
  accessGrants,
  candidateFeedback,
  candidateIntroductions,
  candidateProfiles,
  jobs,
  recommendations,
} from "@/lib/db/schema";
import { listGrantedCandidateIds } from "@/lib/auth/grant";
import { parseDeclineReasons } from "@/lib/employer/feedback";
import { excerpt, workAuthLabel } from "@/lib/api/v1/serialize";
import type { EmployerBucket } from "@/lib/api/v1/contracts/employer";
import type { Database } from "@/lib/db/client";

export interface EmployerCandidateCard {
  profileId: string;
  displayName: string | null;
  headline: string | null;
  yearsExperience: number | null;
  workAuthLabel: string | null;
  locationPreference: string | null;
  frogScore: number | null;
  recommendationExcerpt: string | null;
  considerationsExcerpt: string | null;
  targetRoleTitle: string | null;
  targetRoleLocation: string | null;
  introducedAt: string | null;
  introductionStatus: string | null;
  myFeedback: {
    interest: "interested" | "maybe" | "not_interested";
    wantsInterview: boolean;
    questionsMd: string | null;
    declineReasons: string[];
    declineNote: string | null;
    updatedAt: string | null;
  } | null;
  hasResume: boolean;
  canDownloadResume: boolean;
}

const IN_PROGRESS_STATUSES = new Set(["interviewing", "offer", "hired"]);

/**
 * Employer home / list data. Scoped by `listGrantedCandidateIds`, so every
 * effective-access gate (grant + consent + published/shared recommendation)
 * applies. Only DTO-safe fields — no internal notes, no candidate email.
 */
export async function listEmployerCandidates(
  db: Database,
  params: { employerUserId: string; companyId: string | null }
): Promise<EmployerCandidateCard[]> {
  const ids = await listGrantedCandidateIds(db, params.employerUserId);
  if (ids.length === 0) return [];

  const [profiles, grants, recs, feedbackRows] = await Promise.all([
    db
      .select({
        id: candidateProfiles.id,
        displayName: candidateProfiles.displayName,
        headline: candidateProfiles.headline,
        yearsExperience: candidateProfiles.yearsExperience,
        workAuthStatus: candidateProfiles.workAuthStatus,
        locationPreference: candidateProfiles.locationPreference,
        resumeKey: candidateProfiles.resumeKey,
      })
      .from(candidateProfiles)
      .where(inArray(candidateProfiles.id, ids))
      .all(),
    db
      .select({
        candidateProfileId: accessGrants.candidateProfileId,
        companyId: accessGrants.companyId,
        jobId: accessGrants.jobId,
        grantedAt: accessGrants.grantedAt,
        canDownloadResume: accessGrants.canDownloadResume,
      })
      .from(accessGrants)
      .where(
        and(
          eq(accessGrants.employerUserId, params.employerUserId),
          inArray(accessGrants.candidateProfileId, ids)
        )
      )
      .all(),
    db
      .select({
        candidateProfileId: recommendations.candidateProfileId,
        companyId: recommendations.companyId,
        frogScore: recommendations.frogScore,
        strengthsMd: recommendations.strengthsMd,
        considerationsMd: recommendations.considerationsMd,
      })
      .from(recommendations)
      .where(
        and(
          inArray(recommendations.candidateProfileId, ids),
          eq(recommendations.status, "published"),
          eq(recommendations.visibility, "shared")
        )
      )
      .orderBy(desc(recommendations.updatedAt))
      .all(),
    db
      .select()
      .from(candidateFeedback)
      .where(
        and(
          eq(candidateFeedback.employerUserId, params.employerUserId),
          inArray(candidateFeedback.candidateProfileId, ids)
        )
      )
      .all(),
  ]);

  const grantByProfile = new Map(grants.map((g) => [g.candidateProfileId, g]));
  const feedbackByProfile = new Map(
    feedbackRows.map((f) => [f.candidateProfileId, f])
  );

  const companyIds = Array.from(
    new Set(grants.map((g) => g.companyId).filter(Boolean))
  );

  const intros =
    companyIds.length > 0
      ? await db
          .select({
            candidateProfileId: candidateIntroductions.candidateProfileId,
            companyId: candidateIntroductions.companyId,
            status: candidateIntroductions.status,
          })
          .from(candidateIntroductions)
          .where(
            and(
              inArray(candidateIntroductions.candidateProfileId, ids),
              inArray(candidateIntroductions.companyId, companyIds)
            )
          )
          .all()
      : [];

  const jobRows =
    companyIds.length > 0
      ? await db
          .select({
            id: jobs.id,
            companyId: jobs.companyId,
            title: jobs.title,
            location: jobs.location,
            status: jobs.status,
          })
          .from(jobs)
          .where(inArray(jobs.companyId, companyIds))
          .all()
      : [];

  return profiles.map((p) => {
    const grant = grantByProfile.get(p.id);
    const grantCompanyId = grant?.companyId ?? params.companyId ?? null;

    const forProfile = recs.filter((r) => r.candidateProfileId === p.id);
    const rec =
      (grantCompanyId
        ? forProfile.find((r) => r.companyId === grantCompanyId)
        : undefined) ??
      forProfile.find((r) => r.companyId === null) ??
      forProfile[0];

    const intro = intros.find(
      (i) => i.candidateProfileId === p.id && i.companyId === grantCompanyId
    );

    // The role Frog connected them to: the grant's job when set, otherwise the
    // company's first open requisition.
    const job =
      (grant?.jobId ? jobRows.find((j) => j.id === grant.jobId) : undefined) ??
      jobRows.find((j) => j.companyId === grantCompanyId && j.status === "open");

    const fb = feedbackByProfile.get(p.id);

    return {
      profileId: p.id,
      displayName: p.displayName,
      headline: p.headline,
      yearsExperience: p.yearsExperience,
      workAuthLabel: workAuthLabel(p.workAuthStatus),
      locationPreference: p.locationPreference,
      frogScore: rec?.frogScore ?? null,
      recommendationExcerpt: excerpt(rec?.strengthsMd),
      considerationsExcerpt: excerpt(rec?.considerationsMd),
      targetRoleTitle: job?.title ?? null,
      targetRoleLocation: job?.location ?? null,
      introducedAt: grant?.grantedAt ? grant.grantedAt.toISOString() : null,
      introductionStatus: intro?.status ?? null,
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
      hasResume: !!p.resumeKey,
      canDownloadResume: grant?.canDownloadResume ?? false,
    };
  });
}

export function matchesBucket(
  card: EmployerCandidateCard,
  bucket: EmployerBucket
): boolean {
  switch (bucket) {
    // Owner decision §3: the employer home's "Action needed" list is this
    // user's unrated introductions.
    case "action_needed":
    case "new":
      return card.myFeedback === null;
    case "in_progress":
      return (
        card.myFeedback !== null ||
        (!!card.introductionStatus &&
          IN_PROGRESS_STATUSES.has(card.introductionStatus))
      );
    case "interested":
      return card.myFeedback?.interest === "interested";
    case "maybe":
      return card.myFeedback?.interest === "maybe";
    case "passed":
      return card.myFeedback?.interest === "not_interested";
  }
}

export function bucketCounts(
  cards: EmployerCandidateCard[]
): Record<EmployerBucket, number> {
  const buckets: EmployerBucket[] = [
    "action_needed",
    "in_progress",
    "new",
    "interested",
    "maybe",
    "passed",
  ];
  return buckets.reduce(
    (acc, b) => {
      acc[b] = cards.filter((c) => matchesBucket(c, b)).length;
      return acc;
    },
    {} as Record<EmployerBucket, number>
  );
}

/** Highest Frog score first (same priority order as the Web list). */
export function sortByFrogScore(
  cards: EmployerCandidateCard[]
): EmployerCandidateCard[] {
  return [...cards].sort((a, b) => {
    if (a.frogScore == null && b.frogScore == null) return 0;
    if (a.frogScore == null) return 1;
    if (b.frogScore == null) return -1;
    return b.frogScore - a.frogScore;
  });
}
