"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { requireEmployerReady } from "@/lib/employer/guard";
import { isViewAsSession } from "@/lib/auth/view-as";
import { getEffectiveGrant } from "@/lib/auth/grant";
import {
  candidateFeedback,
  candidateProfiles,
  companies,
  users,
} from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/resend";
import { buildCandidateEmployerInterestEmail } from "@/lib/email/messages";
import { notifySlack, escapeSlack } from "@/lib/slack/notify";
import {
  DECLINE_REASONS,
  parseDeclineReasons,
  type InterestLevel,
} from "@/lib/employer/feedback";

const VALID_INTEREST: InterestLevel[] = ["interested", "maybe", "not_interested"];
const VALID_REASON_CODES = new Set(DECLINE_REASONS.map((r) => r.value));

function str(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}

/**
 * Save (upsert) an employer's feedback on a candidate. Row-level authorization
 * is enforced via getEffectiveGrant — an employer can only rate a candidate
 * they currently have effective access to.
 *
 * When interest first becomes `interested`, email the candidate (once per
 * transition) and Slack Frog ops. Employers are not emailed; the portal UI
 * explains that Frog will follow up.
 */
export async function saveCandidateFeedback(formData: FormData) {
  const { session, db } = await requireEmployerReady();
  if (isViewAsSession(session)) redirect("/portal?readonly=1");
  const candidateProfileId = str(formData.get("candidateProfileId"));
  if (!candidateProfileId) redirect("/portal");

  const grant = await getEffectiveGrant(db, session.user.id, candidateProfileId);
  if (!grant) redirect("/portal");

  const interestRaw = str(formData.get("interest"));
  const interest = (VALID_INTEREST as string[]).includes(interestRaw ?? "")
    ? (interestRaw as InterestLevel)
    : null;
  if (!interest) redirect(`/portal/candidates/${candidateProfileId}?fb=error`);

  const notInterested = interest === "not_interested";
  const wantsInterview =
    !notInterested && str(formData.get("wantsInterview")) === "1";
  const questionsMd = !notInterested ? str(formData.get("questionsMd")) : null;

  let declineReasons: string[] = [];
  let declineNote: string | null = null;
  if (notInterested) {
    declineReasons = parseDeclineReasons(str(formData.get("declineReasons"))).filter(
      (c) => VALID_REASON_CODES.has(c)
    );
    declineNote = str(formData.get("declineNote"));
  }

  const vals = {
    interest,
    wantsInterview,
    questionsMd,
    declineReasons: declineReasons.length ? JSON.stringify(declineReasons) : null,
    declineNote,
    updatedAt: new Date(),
  };

  const existing = await db
    .select({
      id: candidateFeedback.id,
      interest: candidateFeedback.interest,
    })
    .from(candidateFeedback)
    .where(
      and(
        eq(candidateFeedback.employerUserId, session.user.id),
        eq(candidateFeedback.candidateProfileId, candidateProfileId)
      )
    )
    .get();

  const newlyInterested =
    interest === "interested" && existing?.interest !== "interested";

  if (existing) {
    await db
      .update(candidateFeedback)
      .set(vals)
      .where(eq(candidateFeedback.id, existing.id));
  } else {
    await db.insert(candidateFeedback).values({
      employerUserId: session.user.id,
      candidateProfileId,
      companyId: grant.companyId,
      ...vals,
    });
  }

  if (newlyInterested) {
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
        .where(eq(candidateProfiles.id, candidateProfileId))
        .get(),
      db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, session.user.id))
        .get(),
    ]);

    const displayName =
      candidate?.displayName || candidate?.userName || "Candidate";
    const companyName = company?.name || "a company";

    if (company?.name && candidate?.email) {
      const { subject, subtitle, bodyHtml } =
        buildCandidateEmployerInterestEmail({
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
        console.error(
          "[feedback] candidate interest email failed:",
          result.error
        );
      }
    }

    const base =
      process.env.PUBLIC_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      "https://recruit.frogagent.com";
    const adminUrl = candidate?.userId
      ? `${base.replace(/\/$/, "")}/admin/candidates/${candidate.userId}`
      : `${base.replace(/\/$/, "")}/admin/candidates`;
    const employerLabel =
      employer?.name || employer?.email || session.user.email || "Employer";
    const interviewNote = wantsInterview
      ? "Yes — asked to interview"
      : "Not marked";
    const questionsNote = questionsMd?.trim()
      ? questionsMd.trim().slice(0, 500)
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
    if (!slack.ok) {
      console.error("[feedback] slack notify failed:", slack);
    }
  }

  const hdrs = await headers();
  await writeAudit(db, {
    actorUserId: session.user.id,
    actorRole: "employer",
    companyId: grant.companyId,
    candidateProfileId,
    action: "submit_feedback",
    accessGrantId: grant.id,
    ip: hdrs.get("cf-connecting-ip") || hdrs.get("x-forwarded-for"),
    userAgent: hdrs.get("user-agent"),
  });

  revalidatePath(`/portal/candidates/${candidateProfileId}`);
  const fbFlag = interest === "interested" ? "interested" : "saved";
  redirect(`/portal/candidates/${candidateProfileId}?fb=${fbFlag}`);
}
