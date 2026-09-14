"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { requireEmployerReady } from "@/lib/employer/guard";
import { isViewAsSession } from "@/lib/auth/view-as";
import { getEffectiveGrant } from "@/lib/auth/grant";
import { candidateFeedback } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit/log";
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
    .select({ id: candidateFeedback.id })
    .from(candidateFeedback)
    .where(
      and(
        eq(candidateFeedback.employerUserId, session.user.id),
        eq(candidateFeedback.candidateProfileId, candidateProfileId)
      )
    )
    .get();

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
  redirect(`/portal/candidates/${candidateProfileId}?fb=saved`);
}
