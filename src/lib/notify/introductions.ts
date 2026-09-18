import { and, eq } from "drizzle-orm";
import {
  accessGrants,
  candidateProfiles,
  companies,
} from "@/lib/db/schema";
import { getEffectiveGrant } from "@/lib/auth/grant";
import { INTRO_STATUS_LABELS } from "@/lib/introductions/labels";
import type { IntroStatus } from "@/lib/db/schema/introductions";
import type { Database } from "@/lib/db/client";
import { emit } from "./deliver";

/** Statuses worth telling the employer about (Fable §7.1). */
const EMPLOYER_NOTIFY_STATUSES: IntroStatus[] = [
  "interviewing",
  "offer",
  "hired",
  "withdrawn",
];

/** Forward motion — the candidate copy is upbeat for these. */
const POSITIVE_STATUSES: IntroStatus[] = ["interviewing", "offer", "hired"];

/**
 * Fan out introduction events after an admin writes `candidate_introductions`.
 *
 * - candidate `introduction.created` — the row is new, or it reached `shared`
 *   for the first time
 * - candidate `introduction.updated` — any other status change
 * - employer `introduction.updated` — status moved to interviewing / offer /
 *   hired / withdrawn
 *
 * Idempotent through `emit`'s dedupe keys. Best-effort: never throws, so an
 * admin action is never blocked by the notification layer.
 */
export async function emitIntroductionEvents(
  db: Database,
  params: {
    introductionId: string;
    candidateProfileId: string;
    companyId: string;
    previousStatus: IntroStatus | null;
    status: IntroStatus;
    statusNote?: string | null;
    updatedAt: Date;
  }
): Promise<void> {
  try {
    const { previousStatus, status } = params;
    if (previousStatus === status) return;

    const company = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, params.companyId))
      .get();
    const companyName = company?.name ?? "a company";
    const statusLabel = INTRO_STATUS_LABELS[status] ?? status;

    const candidate = await db
      .select({ userId: candidateProfiles.userId })
      .from(candidateProfiles)
      .where(eq(candidateProfiles.id, params.candidateProfileId))
      .get();

    if (candidate?.userId) {
      const firstShare = status === "shared" && previousStatus !== "shared";
      if (previousStatus === null || firstShare) {
        await emit(db, {
          kind: "introduction.created",
          userId: candidate.userId,
          title: `Frog is introducing you to ${companyName}`,
          body: "See who they are and the role Frog connected you to.",
          dedupeKey: `introduction.created:${params.introductionId}`,
          data: {
            route: `introductions/${params.introductionId}`,
            id: params.introductionId,
          },
        });
      } else {
        const positive = POSITIVE_STATUSES.includes(status);
        await emit(db, {
          kind: "introduction.updated",
          userId: candidate.userId,
          title: positive
            ? `Good news from Frog about ${companyName}`
            : `Update on your introduction to ${companyName}`,
          body:
            params.statusNote?.trim() ||
            (positive
              ? `Your introduction moved to ${statusLabel}.`
              : "Your Frog representative will follow up."),
          dedupeKey: `introduction.updated:${params.introductionId}:${status}:${params.updatedAt.getTime()}`,
          data: {
            route: `introductions/${params.introductionId}`,
            id: params.introductionId,
          },
        });
      }
    }

    if (!EMPLOYER_NOTIFY_STATUSES.includes(status)) return;

    const grants = await db
      .select({ employerUserId: accessGrants.employerUserId })
      .from(accessGrants)
      .where(
        and(
          eq(accessGrants.candidateProfileId, params.candidateProfileId),
          eq(accessGrants.companyId, params.companyId)
        )
      )
      .all();

    for (const grant of grants) {
      const effective = await getEffectiveGrant(
        db,
        grant.employerUserId,
        params.candidateProfileId
      );
      if (!effective) continue;
      await emit(db, {
        kind: "introduction.updated",
        userId: grant.employerUserId,
        title: "Update from Frog",
        body: `An introduction to your team moved to ${statusLabel}.`,
        dedupeKey: `introduction.updated:${params.introductionId}:${status}`,
        data: {
          route: `candidates/${params.candidateProfileId}`,
          id: params.candidateProfileId,
        },
      });
    }
  } catch (e) {
    console.error("[notify] emitIntroductionEvents failed:", e);
  }
}
