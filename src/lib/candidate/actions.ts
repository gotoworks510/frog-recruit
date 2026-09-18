"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireCandidateWritable } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { candidateProfiles, candidateExperiences, candidateLinks } from "@/lib/db/schema";
import {
  addExperienceCore,
  addLinkCore,
  deleteExperienceCore,
  deleteLinkCore,
  enableConsentCore,
  removeResumeCore,
  requestLinkedInRefreshCore,
  revokeConsentCore,
  saveResumeCore,
  updateProfileFields,
} from "@/lib/candidate/profile-core";

function num(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}

export async function updateProfile(formData: FormData) {
  const session = await requireCandidateWritable();
  const db = await getD1Db();

  const result = await updateProfileFields(db, session.user.id, {
    displayName: str(formData.get("displayName")),
    headline: str(formData.get("headline")),
    summary: str(formData.get("summary")),
    locationCurrent: str(formData.get("locationCurrent")),
    locationPreference: str(formData.get("locationPreference")),
    yearsExperience: num(formData.get("yearsExperience")),
    workAuthStatus: (str(formData.get("workAuthStatus")) ??
      null) as typeof candidateProfiles.$inferInsert.workAuthStatus,
    visaNotes: str(formData.get("visaNotes")),
    availability: str(formData.get("availability")),
    englishLevel: (str(formData.get("englishLevel")) ??
      null) as typeof candidateProfiles.$inferInsert.englishLevel,
    desiredSalaryMin: num(formData.get("desiredSalaryMin")),
    desiredSalaryMax: num(formData.get("desiredSalaryMax")),
    salaryCurrency: str(formData.get("salaryCurrency")) ?? "USD",
  });
  if (!result.ok) return;

  revalidatePath("/me/profile");
  revalidatePath("/me");
}

export async function addExperience(formData: FormData) {
  const session = await requireCandidateWritable();
  const db = await getD1Db();

  const company = str(formData.get("company"));
  const title = str(formData.get("title"));
  if (!company || !title) return;

  const startRaw = str(formData.get("startDate"));
  const endRaw = str(formData.get("endDate"));

  const result = await addExperienceCore(db, session.user.id, {
    company,
    title,
    employmentType: (str(formData.get("employmentType")) ??
      null) as typeof candidateExperiences.$inferInsert.employmentType,
    startDate: startRaw ? new Date(startRaw) : null,
    endDate: endRaw ? new Date(endRaw) : null,
    isCurrent: formData.get("isCurrent") === "on",
    location: str(formData.get("location")),
    description: str(formData.get("description")),
    techStack: str(formData.get("techStack")),
    sortOrder: num(formData.get("sortOrder")) ?? 0,
  });
  if (!result.ok) return;

  revalidatePath("/me/experience");
}

export async function deleteExperience(formData: FormData) {
  const session = await requireCandidateWritable();
  const db = await getD1Db();
  const id = str(formData.get("id"));
  if (!id) return;

  const result = await deleteExperienceCore(db, session.user.id, id);
  if (!result.ok) return;
  revalidatePath("/me/experience");
}

export async function addLink(formData: FormData) {
  const session = await requireCandidateWritable();
  const db = await getD1Db();

  const url = str(formData.get("url"));
  if (!url) return;

  const result = await addLinkCore(db, session.user.id, {
    kind: (str(formData.get("kind")) ??
      "other") as NonNullable<typeof candidateLinks.$inferInsert.kind>,
    url,
    label: str(formData.get("label")),
    sortOrder: num(formData.get("sortOrder")) ?? 0,
  });
  if (!result.ok) return;
  revalidatePath("/me/links");
}

export async function deleteLink(formData: FormData) {
  const session = await requireCandidateWritable();
  const db = await getD1Db();
  const id = str(formData.get("id"));
  if (!id) return;

  const result = await deleteLinkCore(db, session.user.id, id);
  if (!result.ok) return;
  revalidatePath("/me/links");
}

export async function uploadResume(formData: FormData) {
  const session = await requireCandidateWritable();
  const db = await getD1Db();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/me/resume?error=empty");
  }

  const result = await saveResumeCore(db, session.user.id, {
    buffer: await file.arrayBuffer(),
    fileName: file.name || "resume.pdf",
    size: file.size,
  });
  if (!result.ok) {
    if (result.reason === "no_profile") return;
    redirect(`/me/resume?error=${result.reason}`);
  }

  redirect("/me/resume?ok=1");
}

export async function removeResume() {
  const session = await requireCandidateWritable();
  const db = await getD1Db();
  const result = await removeResumeCore(db, session.user.id);
  if (!result.ok) return;
  revalidatePath("/me/resume");
}

/** Revoke broad share consent — employer access stops on the next request. */
export async function revokeConsent() {
  const session = await requireCandidateWritable();
  const db = await getD1Db();
  const result = await revokeConsentCore(db, session.user.id);
  if (!result.ok) return;
  revalidatePath("/me/sharing");
  revalidatePath("/me");
}

/** Re-enable broad share consent. */
export async function enableConsent() {
  const session = await requireCandidateWritable();
  const db = await getD1Db();
  const hdrs = await headers();
  const result = await enableConsentCore(db, session.user.id, {
    ip: hdrs.get("cf-connecting-ip") || hdrs.get("x-forwarded-for") || null,
  });
  if (!result.ok || result.alreadyActive) return;
  revalidatePath("/me/sharing");
  revalidatePath("/me");
}

/**
 * Candidate asks Frog to refresh their profile from LinkedIn.
 * Saves/updates the LinkedIn link, then notifies Slack for manual review.
 */
export async function requestLinkedInRefresh(formData: FormData) {
  const session = await requireCandidateWritable();
  const db = await getD1Db();

  const result = await requestLinkedInRefreshCore(
    db,
    session.user.id,
    String(formData.get("linkedinUrl") ?? "")
  );

  if (result.ok) {
    revalidatePath("/me/profile");
    revalidatePath("/me/links");
    redirect("/me/profile?linkedin=requested");
  }
  if (result.reason === "no_profile") redirect("/me/profile?error=linkedin");
  if (result.reason === "url") redirect("/me/profile?error=linkedin_url");
  if (result.reason === "rate") redirect("/me/profile?error=linkedin_rate");
  if (result.reason === "saved_no_slack") {
    redirect("/me/profile?linkedin=saved_no_slack");
  }
  redirect("/me/profile?error=linkedin_slack");
}
