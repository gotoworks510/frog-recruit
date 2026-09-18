import { and, eq, isNotNull } from "drizzle-orm";
import {
  candidateFeedback,
  candidateIntroductions,
  candidateProfiles,
  companies,
  users,
} from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit/log";
import { buildCandidateEmployerInterestEmail } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/resend";
import { escapeSlack, notifySlack } from "@/lib/slack/notify";
import { emit } from "@/lib/notify/deliver";
import {
  DECLINE_REASONS,
  parseDeclineReasons,
  type CandidateFeedbackData,
  type InterestLevel,
} from "@/lib/employer/feedback";
import type { EffectiveGrant } from "@/lib/auth/grant";
import type { Database } from "@/lib/db/client";

const VALID_REASON_CODES = new Set(DECLINE_REASONS.map((r) => r.value));

export interface FeedbackInput {
  interest: InterestLevel;
  wantsInterview?: boolean;
  questionsMd?: string | null;
  declineReasons?: string[];
  declineNote?: string | null;
  /**
   * Offline-safe idempotency key (owner decision §9). Re-sending the same id
   * returns the stored row with no writes and no email / Slack / push.
   */
  clientRequestId?: string | null;
  /**
   * The server `updatedAt` the client based its edit on. `undefined` = no
   * optimistic-concurrency check (Web forms). `null` = "I believe there is no
   * feedback yet". A stale value returns a conflict instead of writing.
   */
  baseUpdatedAt?: Date | null;
}

export interface FeedbackAuditMeta {
  actorUserId?: string | null;
  actorRole?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface UpsertFeedbackResult {
  feedback: CandidateFeedbackData;
  /** True only on the first transition into `interested`. */
  newlyInterested: boolean;
  /** Set when `baseUpdatedAt` was stale — nothing was written. */
  conflict?: boolean;
  /** Set when the same clientRequestId was already applied. */
  idempotentReplay?: boolean;
}

function toData(row: typeof candidateFeedback.$inferSelect): CandidateFeedbackData {
  return {
    interest: row.interest,
    wantsInterview: row.wantsInterview,
    questionsMd: row.questionsMd,
    declineReasons: parseDeclineReasons(row.declineReasons),
    declineNote: row.declineNote,
    updatedAt: row.updatedAt,
  };
}

/**
 * Upsert an employer's feedback on a candidate. Row-level authorization is the
 * caller's job — pass the already-resolved `getEffectiveGrant` result.
 *
 * Side effects on the first transition to `interested`: candidate email, Frog
 * Slack, and an `employer.interested` Inbox/push event. All three fire for
 * `is_test` accounts too (owner: review/smoke must see the full path).
 */
export async function upsertCandidateFeedback(
  db: Database,
  params: {
    employerUserId: string;
    grant: EffectiveGrant;
    input: FeedbackInput;
    audit?: FeedbackAuditMeta | null;
    /** Skip email / Slack / push (used by internal tooling). */
    skipSideEffects?: boolean;
  }
): Promise<UpsertFeedbackResult> {
  const { employerUserId, grant, input } = params;
  const candidateProfileId = grant.candidateProfileId;

  const existing = await db
    .select()
    .from(candidateFeedback)
    .where(
      and(
        eq(candidateFeedback.employerUserId, employerUserId),
        eq(candidateFeedback.candidateProfileId, candidateProfileId)
      )
    )
    .get();

  // Idempotent replay — same request id already applied. No writes, no notify.
  if (
    input.clientRequestId &&
    existing?.clientRequestId === input.clientRequestId
  ) {
    return {
      feedback: toData(existing),
      newlyInterested: false,
      idempotentReplay: true,
    };
  }

  // Optimistic concurrency (owner decision §9).
  if (input.baseUpdatedAt !== undefined) {
    const serverMs = existing?.updatedAt?.getTime() ?? null;
    const baseMs = input.baseUpdatedAt?.getTime() ?? null;
    const stale =
      serverMs !== null && (baseMs === null || baseMs < serverMs);
    if (stale && existing) {
      return {
        feedback: toData(existing),
        newlyInterested: false,
        conflict: true,
      };
    }
  }

  const notInterested = input.interest === "not_interested";
  const wantsInterview = !notInterested && !!input.wantsInterview;
  const questionsMd = !notInterested ? (input.questionsMd ?? null) : null;
  const declineReasons = notInterested
    ? (input.declineReasons ?? []).filter((c) => VALID_REASON_CODES.has(c))
    : [];
  const declineNote = notInterested ? (input.declineNote ?? null) : null;

  const clientRequestId = await resolveClientRequestId(
    db,
    employerUserId,
    candidateProfileId,
    input.clientRequestId ?? null
  );

  const now = new Date();
  const vals = {
    interest: input.interest,
    wantsInterview,
    questionsMd,
    declineReasons: declineReasons.length
      ? JSON.stringify(declineReasons)
      : null,
    declineNote,
    clientRequestId,
    updatedAt: now,
  };

  const newlyInterested =
    input.interest === "interested" && existing?.interest !== "interested";

  if (existing) {
    await db
      .update(candidateFeedback)
      .set(vals)
      .where(eq(candidateFeedback.id, existing.id));
  } else {
    await db.insert(candidateFeedback).values({
      employerUserId,
      candidateProfileId,
      companyId: grant.companyId,
      ...vals,
    });
  }

  if (newlyInterested && !params.skipSideEffects) {
    await announceInterest(db, {
      employerUserId,
      grant,
      wantsInterview,
      questionsMd,
      feedbackUpdatedAt: now,
    });
  }

  if (params.audit) {
    await writeAudit(db, {
      actorUserId: params.audit.actorUserId ?? employerUserId,
      actorRole: params.audit.actorRole ?? "employer",
      companyId: grant.companyId,
      candidateProfileId,
      action: "submit_feedback",
      accessGrantId: grant.id,
      ip: params.audit.ip ?? null,
      userAgent: params.audit.userAgent ?? null,
    });
  }

  return {
    feedback: {
      interest: input.interest,
      wantsInterview,
      questionsMd,
      declineReasons,
      declineNote,
      updatedAt: now,
    },
    newlyInterested,
  };
}

/**
 * The (employer_user_id, client_request_id) index is unique across candidates.
 * If this id was already used for a different candidate, don't take the row
 * down with a constraint error — just store no id for this write.
 */
async function resolveClientRequestId(
  db: Database,
  employerUserId: string,
  candidateProfileId: string,
  clientRequestId: string | null
): Promise<string | null> {
  if (!clientRequestId) return null;
  const clash = await db
    .select({ candidateProfileId: candidateFeedback.candidateProfileId })
    .from(candidateFeedback)
    .where(
      and(
        eq(candidateFeedback.employerUserId, employerUserId),
        eq(candidateFeedback.clientRequestId, clientRequestId),
        isNotNull(candidateFeedback.clientRequestId)
      )
    )
    .get();
  if (clash && clash.candidateProfileId !== candidateProfileId) return null;
  return clientRequestId;
}

/** Candidate email + Frog Slack + candidate Inbox/push on first `interested`. */
async function announceInterest(
  db: Database,
  params: {
    employerUserId: string;
    grant: EffectiveGrant;
    wantsInterview: boolean;
    questionsMd: string | null;
    feedbackUpdatedAt: Date;
  }
): Promise<void> {
  const { employerUserId, grant } = params;

  const [company, candidate, employer] = await Promise.all([
    db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, grant.companyId))
      .get(),
    db
      .select({
        userId: candidateProfiles.userId,
        email: users.email,
        userName: users.name,
        displayName: candidateProfiles.displayName,
      })
      .from(candidateProfiles)
      .innerJoin(users, eq(users.id, candidateProfiles.userId))
      .where(eq(candidateProfiles.id, grant.candidateProfileId))
      .get(),
    db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, employerUserId))
      .get(),
  ]);

  const displayName = candidate?.displayName || candidate?.userName || "Candidate";
  const companyName = company?.name || "a company";

  // Always send — including is_test (App Review / smoke). Other notify paths
  // still skip email/Slack for test accounts via skip-ops.
  if (company?.name && candidate?.email) {
    const { subject, subtitle, bodyHtml } = buildCandidateEmployerInterestEmail({
      name: displayName,
      companyName: company.name,
    });
    const result = await sendEmail({
      to: candidate.email,
      subject,
      subtitle,
      bodyHtml,
      replyTo: "agent@frogagent.com",
    });
    if (!result.ok) {
      console.error("[feedback] candidate interest email failed:", result.error);
    }
  }

  const base =
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "https://recruit.frogagent.com";
  const adminUrl = candidate?.userId
    ? `${base.replace(/\/$/, "")}/admin/candidates/${candidate.userId}`
    : `${base.replace(/\/$/, "")}/admin/candidates`;
  const employerLabel = employer?.name || employer?.email || "Employer";
  const interviewNote = params.wantsInterview
    ? "Yes — asked to interview"
    : "Not marked";
  const questionsNote = params.questionsMd?.trim()
    ? params.questionsMd.trim().slice(0, 500)
    : "—";

  const slack = await notifySlack(
    [
      ":sparkles: *Employer interest — follow up needed*",
      `*Company:* ${escapeSlack(companyName)}`,
      `*Employer:* ${escapeSlack(employerLabel)}${
        employer?.email ? ` (${escapeSlack(employer.email)})` : ""
      }`,
      `*Candidate:* ${escapeSlack(displayName)}${
        candidate?.email ? ` (${escapeSlack(candidate.email)})` : ""
      }`,
      `*Interview request:* ${escapeSlack(interviewNote)}`,
      `*Questions / notes:* ${escapeSlack(questionsNote)}`,
      `*Admin:* ${adminUrl}`,
      "_Candidate was emailed to contact Frog. Please reach out to both sides._",
    ].join("\n")
  );
  if (!slack.ok && !slack.skipped) {
    console.error("[feedback] slack notify failed:", slack);
  }

  // Candidate Inbox + push.
  if (candidate?.userId) {
    const intro = await db
      .select({ id: candidateIntroductions.id })
      .from(candidateIntroductions)
      .where(
        and(
          eq(candidateIntroductions.candidateProfileId, grant.candidateProfileId),
          eq(candidateIntroductions.companyId, grant.companyId)
        )
      )
      .get();

    await emit(db, {
      kind: "employer.interested",
      userId: candidate.userId,
      title: `${companyName} is interested in connecting`,
      body: "Frog will reach out to you about next steps.",
      dedupeKey: `employer.interested:${grant.companyId}:${params.feedbackUpdatedAt.getTime()}`,
      data: intro
        ? { route: `introductions/${intro.id}`, id: intro.id }
        : { route: "inbox" },
    });
  }
}
