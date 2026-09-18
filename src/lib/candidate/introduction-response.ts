import { and, eq } from "drizzle-orm";
import {
  candidateIntroductions,
  candidateProfiles,
  companies,
  users,
} from "@/lib/db/schema";
import { escapeSlack } from "@/lib/slack/notify";
import { notifySlackUnlessTest } from "@/lib/notify/skip-ops";
import type { CandidateResponse } from "@/lib/db/schema/introductions";
import type { Database } from "@/lib/db/client";

const RESPONSE_LABELS: Record<CandidateResponse, string> = {
  interested: "I'm interested",
  consult: "Talk to Frog first",
  pass: "Pass for now",
};

export interface IntroductionResponseResult {
  introductionId: string;
  response: CandidateResponse;
  respondedAt: Date;
  idempotentReplay?: boolean;
  conflict?: boolean;
}

export type IntroductionResponseOutcome =
  | { ok: true; result: IntroductionResponseResult }
  | { ok: false; reason: "not_found" };

/**
 * Record a candidate's reaction to an introduction card (owner decision §2:
 * `interested | consult | pass`).
 *
 * Frog is notified via Slack; the employer is NEVER told. A `pass` does not
 * move the introduction to `declined` — that stays Frog's call.
 *
 * `baseRespondedAt` is compared against `candidate_responded_at` (not the row's
 * `updated_at`) so an admin status change doesn't produce a phantom conflict.
 */
export async function respondToIntroduction(
  db: Database,
  params: {
    profileId: string;
    introductionId: string;
    response: CandidateResponse;
    clientRequestId: string;
    baseRespondedAt?: Date | null;
  }
): Promise<IntroductionResponseOutcome> {
  const intro = await db
    .select({
      id: candidateIntroductions.id,
      companyId: candidateIntroductions.companyId,
      status: candidateIntroductions.status,
      candidateResponse: candidateIntroductions.candidateResponse,
      candidateRespondedAt: candidateIntroductions.candidateRespondedAt,
      responseClientRequestId: candidateIntroductions.responseClientRequestId,
    })
    .from(candidateIntroductions)
    .where(
      and(
        eq(candidateIntroductions.id, params.introductionId),
        // Ownership check: the introduction must be this candidate's.
        eq(candidateIntroductions.candidateProfileId, params.profileId)
      )
    )
    .get();

  if (!intro) return { ok: false, reason: "not_found" };

  if (intro.responseClientRequestId === params.clientRequestId) {
    return {
      ok: true,
      result: {
        introductionId: intro.id,
        response: intro.candidateResponse ?? params.response,
        respondedAt: intro.candidateRespondedAt ?? new Date(),
        idempotentReplay: true,
      },
    };
  }

  if (params.baseRespondedAt !== undefined) {
    const serverMs = intro.candidateRespondedAt?.getTime() ?? null;
    const baseMs = params.baseRespondedAt?.getTime() ?? null;
    if (serverMs !== null && (baseMs === null || baseMs < serverMs)) {
      return {
        ok: true,
        result: {
          introductionId: intro.id,
          response: intro.candidateResponse ?? params.response,
          respondedAt: intro.candidateRespondedAt ?? new Date(),
          conflict: true,
        },
      };
    }
  }

  const respondedAt = new Date();
  await db
    .update(candidateIntroductions)
    .set({
      candidateResponse: params.response,
      candidateRespondedAt: respondedAt,
      responseClientRequestId: params.clientRequestId,
    })
    .where(eq(candidateIntroductions.id, intro.id));

  await notifyFrog(db, {
    profileId: params.profileId,
    companyId: intro.companyId,
    status: intro.status,
    response: params.response,
  });

  return {
    ok: true,
    result: {
      introductionId: intro.id,
      response: params.response,
      respondedAt,
    },
  };
}

async function notifyFrog(
  db: Database,
  params: {
    profileId: string;
    companyId: string;
    status: string;
    response: CandidateResponse;
  }
): Promise<void> {
  const candidate = await db
    .select({
      userId: candidateProfiles.userId,
      displayName: candidateProfiles.displayName,
      email: users.email,
      userName: users.name,
    })
    .from(candidateProfiles)
    .innerJoin(users, eq(users.id, candidateProfiles.userId))
    .where(eq(candidateProfiles.id, params.profileId))
    .get();

  const company = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, params.companyId))
    .get();

  const base =
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "https://recruit.frogagent.com";
  const adminUrl = candidate?.userId
    ? `${base.replace(/\/$/, "")}/admin/candidates/${candidate.userId}`
    : `${base.replace(/\/$/, "")}/admin/candidates`;

  await notifySlackUnlessTest(
    db,
    [candidate?.userId ?? null],
    [
      ":speech_balloon: *Candidate responded to an introduction*",
      `*Candidate:* ${escapeSlack(
        candidate?.displayName || candidate?.userName || "Candidate"
      )}${candidate?.email ? ` (${escapeSlack(candidate.email)})` : ""}`,
      `*Company:* ${escapeSlack(company?.name ?? "—")}`,
      `*Response:* ${escapeSlack(RESPONSE_LABELS[params.response])}`,
      `*Introduction status:* ${escapeSlack(params.status)}`,
      `*Admin:* ${adminUrl}`,
      "_The employer was not notified. Please follow up with the candidate._",
    ].join("\n")
  );
}
