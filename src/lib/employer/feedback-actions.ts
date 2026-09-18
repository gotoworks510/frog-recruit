"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireEmployerReady } from "@/lib/employer/guard";
import { isViewAsSession } from "@/lib/auth/view-as";
import { getEffectiveGrant } from "@/lib/auth/grant";
import { upsertCandidateFeedback } from "@/lib/employer/feedback-core";
import {
  parseDeclineReasons,
  type InterestLevel,
} from "@/lib/employer/feedback";

const VALID_INTEREST: InterestLevel[] = ["interested", "maybe", "not_interested"];

function str(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}

/**
 * Save (upsert) an employer's feedback on a candidate. Row-level authorization
 * is enforced via getEffectiveGrant — an employer can only rate a candidate
 * they currently have effective access to.
 *
 * The write, the `newlyInterested` transition, the candidate email, Frog Slack,
 * the push event and the audit row all live in `feedback-core.ts` (shared with
 * the mobile API). This action only parses the form and redirects.
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

  const hdrs = await headers();
  await upsertCandidateFeedback(db, {
    employerUserId: session.user.id,
    grant,
    input: {
      interest,
      wantsInterview: str(formData.get("wantsInterview")) === "1",
      questionsMd: str(formData.get("questionsMd")),
      declineReasons: parseDeclineReasons(str(formData.get("declineReasons"))),
      declineNote: str(formData.get("declineNote")),
    },
    audit: {
      actorUserId: session.user.id,
      actorRole: "employer",
      ip: hdrs.get("cf-connecting-ip") || hdrs.get("x-forwarded-for"),
      userAgent: hdrs.get("user-agent"),
    },
  });

  revalidatePath(`/portal/candidates/${candidateProfileId}`);
  const fbFlag = interest === "interested" ? "interested" : "saved";
  redirect(`/portal/candidates/${candidateProfileId}?fb=${fbFlag}`);
}
