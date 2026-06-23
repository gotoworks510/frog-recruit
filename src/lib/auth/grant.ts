import { and, eq, isNull, or, inArray } from "drizzle-orm";
import {
  accessGrants,
  candidateConsents,
  recommendations,
} from "@/lib/db/schema";
import type { Database } from "@/lib/db/client";

export interface EffectiveGrant {
  id: string;
  candidateProfileId: string;
  companyId: string;
  jobId: string | null;
  canDownloadResume: boolean;
  expiresAt: Date | null;
}

function isActiveGrant(g: {
  revokedAt: Date | null;
  expiresAt: Date | null;
}): boolean {
  if (g.revokedAt) return false;
  if (g.expiresAt && g.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

/** Does an active consent cover this company for this candidate? */
async function hasActiveConsent(
  db: Database,
  candidateProfileId: string,
  companyId: string
): Promise<boolean> {
  const rows = await db
    .select({
      scope: candidateConsents.scope,
      companyId: candidateConsents.companyId,
    })
    .from(candidateConsents)
    .where(
      and(
        eq(candidateConsents.candidateProfileId, candidateProfileId),
        isNull(candidateConsents.revokedAt)
      )
    )
    .all();

  return rows.some(
    (r) =>
      r.scope === "share_with_employers" ||
      (r.scope === "share_with_company" && r.companyId === companyId)
  );
}

/**
 * Is there a published + shared recommendation for this candidate that applies
 * to this company? (a company-specific rec, or the general fallback rec.)
 */
async function hasSharedRecommendation(
  db: Database,
  candidateProfileId: string,
  companyId: string
): Promise<boolean> {
  const row = await db
    .select({ id: recommendations.id })
    .from(recommendations)
    .where(
      and(
        eq(recommendations.candidateProfileId, candidateProfileId),
        eq(recommendations.status, "published"),
        eq(recommendations.visibility, "shared"),
        or(
          eq(recommendations.companyId, companyId),
          isNull(recommendations.companyId)
        )
      )
    )
    .get();
  return !!row;
}

/**
 * Resolve the effective grant for (employer, candidate), or null if the
 * employer must not see this candidate. Full check: grant active + consent
 * active + a published/shared recommendation that applies to the grant's company.
 */
export async function getEffectiveGrant(
  db: Database,
  employerUserId: string,
  candidateProfileId: string
): Promise<EffectiveGrant | null> {
  const grant = await db
    .select()
    .from(accessGrants)
    .where(
      and(
        eq(accessGrants.employerUserId, employerUserId),
        eq(accessGrants.candidateProfileId, candidateProfileId)
      )
    )
    .get();

  if (!grant || !isActiveGrant(grant)) return null;
  if (!(await hasActiveConsent(db, candidateProfileId, grant.companyId))) {
    return null;
  }
  if (!(await hasSharedRecommendation(db, candidateProfileId, grant.companyId))) {
    return null;
  }

  return {
    id: grant.id,
    candidateProfileId: grant.candidateProfileId,
    companyId: grant.companyId,
    jobId: grant.jobId,
    canDownloadResume: grant.canDownloadResume,
    expiresAt: grant.expiresAt,
  };
}

/**
 * List candidate profile ids an employer may currently see (all effective-access
 * gates applied — including a published/shared recommendation that applies to
 * the grant's company). Used to scope the employer candidate list.
 */
export async function listGrantedCandidateIds(
  db: Database,
  employerUserId: string
): Promise<string[]> {
  const grants = await db
    .select({
      candidateProfileId: accessGrants.candidateProfileId,
      companyId: accessGrants.companyId,
      revokedAt: accessGrants.revokedAt,
      expiresAt: accessGrants.expiresAt,
    })
    .from(accessGrants)
    .where(eq(accessGrants.employerUserId, employerUserId))
    .all();

  const active = grants.filter(isActiveGrant);
  if (active.length === 0) return [];

  const ids = active.map((g) => g.candidateProfileId);

  // Published + shared recommendations (with their target company) for these candidates.
  const sharedRecs = await db
    .select({
      candidateProfileId: recommendations.candidateProfileId,
      companyId: recommendations.companyId,
    })
    .from(recommendations)
    .where(
      and(
        inArray(recommendations.candidateProfileId, ids),
        eq(recommendations.status, "published"),
        eq(recommendations.visibility, "shared")
      )
    )
    .all();

  // candidateProfileId -> { companies: Set, general: boolean }
  const recMap = new Map<string, { companies: Set<string>; general: boolean }>();
  for (const r of sharedRecs) {
    const e = recMap.get(r.candidateProfileId) ?? {
      companies: new Set<string>(),
      general: false,
    };
    if (r.companyId) e.companies.add(r.companyId);
    else e.general = true;
    recMap.set(r.candidateProfileId, e);
  }

  // Active consents for those candidates.
  const consents = await db
    .select({
      candidateProfileId: candidateConsents.candidateProfileId,
      scope: candidateConsents.scope,
      companyId: candidateConsents.companyId,
    })
    .from(candidateConsents)
    .where(
      and(
        inArray(candidateConsents.candidateProfileId, ids),
        isNull(candidateConsents.revokedAt)
      )
    )
    .all();

  const result: string[] = [];
  for (const g of active) {
    const rec = recMap.get(g.candidateProfileId);
    const recOk = !!rec && (rec.general || rec.companies.has(g.companyId));
    if (!recOk) continue;
    const consentOk = consents.some(
      (c) =>
        c.candidateProfileId === g.candidateProfileId &&
        (c.scope === "share_with_employers" ||
          (c.scope === "share_with_company" && c.companyId === g.companyId))
    );
    if (consentOk) result.push(g.candidateProfileId);
  }
  return Array.from(new Set(result));
}
