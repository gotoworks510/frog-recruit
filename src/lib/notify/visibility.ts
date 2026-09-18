import { and, eq } from "drizzle-orm";
import {
  accessGrants,
  candidateIntroductions,
  candidateProfiles,
  companies,
} from "@/lib/db/schema";
import { getEffectiveGrant } from "@/lib/auth/grant";
import { WORK_AUTH_LABELS } from "@/lib/candidate/profile";
import type { Database } from "@/lib/db/client";
import { emit } from "./deliver";

/**
 * "A new candidate appeared" = the moment effective access becomes true for an
 * employer. That happens on grant creation, on publishing/sharing a
 * recommendation, AND on the candidate re-enabling consent — so all three call
 * this single helper (Fable §7.2).
 *
 * `emit` is idempotent on (user_id, dedupe_key), so repeat calls never
 * double-notify. Best-effort: never throws.
 */
export async function syncCandidateVisibility(
  db: Database,
  profileId: string
): Promise<void> {
  try {
    const grants = await db
      .select({
        id: accessGrants.id,
        employerUserId: accessGrants.employerUserId,
        grantedAt: accessGrants.grantedAt,
      })
      .from(accessGrants)
      .where(eq(accessGrants.candidateProfileId, profileId))
      .all();
    if (grants.length === 0) return;

    const profile = await db
      .select({
        headline: candidateProfiles.headline,
        yearsExperience: candidateProfiles.yearsExperience,
        workAuthStatus: candidateProfiles.workAuthStatus,
      })
      .from(candidateProfiles)
      .where(eq(candidateProfiles.id, profileId))
      .get();

    // No name, no salary, no Frog Score — this lands on a lock screen.
    const parts = [
      profile?.headline ?? "New introduction",
      profile?.yearsExperience != null
        ? `${profile.yearsExperience} yrs`
        : null,
      profile?.workAuthStatus
        ? (WORK_AUTH_LABELS[profile.workAuthStatus] ?? profile.workAuthStatus)
        : null,
    ].filter(Boolean);

    for (const grant of grants) {
      const effective = await getEffectiveGrant(
        db,
        grant.employerUserId,
        profileId
      );
      if (!effective) continue;

      await emit(db, {
        kind: "candidate.introduced",
        userId: grant.employerUserId,
        title: "New candidate introduced",
        body: parts.join(" · "),
        dedupeKey: `candidate.introduced:${grant.id}:${grant.grantedAt.getTime()}`,
        data: { route: `candidates/${profileId}`, id: profileId },
      });
    }
  } catch (e) {
    console.error("[notify] syncCandidateVisibility failed:", e);
  }
}

/**
 * "A company viewed your profile" (Fable §7.1). Collapsed to once per company
 * per day and never names the individual viewer. Push default is OFF
 * (owner decision §4) — the Inbox entry is still written.
 *
 * Admin view-as must NOT reach this. Best-effort: never throws.
 */
export async function emitEmployerViewed(
  db: Database,
  params: { profileId: string; companyId: string | null }
): Promise<void> {
  if (!params.companyId) return;
  try {
    const profile = await db
      .select({ userId: candidateProfiles.userId })
      .from(candidateProfiles)
      .where(eq(candidateProfiles.id, params.profileId))
      .get();
    if (!profile?.userId) return;

    const company = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, params.companyId))
      .get();

    const intro = await db
      .select({ id: candidateIntroductions.id })
      .from(candidateIntroductions)
      .where(
        and(
          eq(candidateIntroductions.candidateProfileId, params.profileId),
          eq(candidateIntroductions.companyId, params.companyId)
        )
      )
      .get();

    const day = new Date().toISOString().slice(0, 10);
    await emit(db, {
      kind: "employer.viewed",
      userId: profile.userId,
      title: `${company?.name ?? "A company"} viewed your profile`,
      body: "Your introduction is being reviewed.",
      dedupeKey: `employer.viewed:${params.companyId}:${day}`,
      data: intro
        ? { route: `introductions/${intro.id}`, id: intro.id }
        : { route: "inbox" },
    });
  } catch (e) {
    console.error("[notify] emitEmployerViewed failed:", e);
  }
}
