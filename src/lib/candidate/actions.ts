"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { requireCandidateWritable } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import {
  candidateProfiles,
  candidateExperiences,
  candidateLinks,
  candidateConsents,
  users,
} from "@/lib/db/schema";
import { getCandidateByUserId, computeCompleteness } from "@/lib/candidate/profile";
import { putObject, deleteObject, resumeKey } from "@/lib/storage/r2";
import { validateMagicBytes } from "@/lib/storage/magic-bytes";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/db/client";
import { rateLimit } from "@/lib/ratelimit/kv";
import { notifySlack, escapeSlack } from "@/lib/slack/notify";

const MAX_RESUME_BYTES = 10 * 1024 * 1024; // 10MB

async function ownProfileId(db: Database, userId: string): Promise<string | null> {
  const row = await db
    .select({ id: candidateProfiles.id })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, userId))
    .get();
  return row?.id ?? null;
}

function num(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}

async function recomputeCompleteness(db: Database, userId: string) {
  const candidate = await getCandidateByUserId(db, userId);
  if (!candidate) return;
  await db
    .update(candidateProfiles)
    .set({ completeness: computeCompleteness(candidate), updatedAt: new Date() })
    .where(eq(candidateProfiles.id, candidate.profile.id));
}

export async function updateProfile(formData: FormData) {
  const session = await requireCandidateWritable();
  const db = await getD1Db();
  const profileId = await ownProfileId(db, session.user.id);
  if (!profileId) return;

  await db
    .update(candidateProfiles)
    .set({
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
      updatedAt: new Date(),
    })
    .where(eq(candidateProfiles.id, profileId));

  await recomputeCompleteness(db, session.user.id);
  revalidatePath("/me/profile");
  revalidatePath("/me");
}

export async function addExperience(formData: FormData) {
  const session = await requireCandidateWritable();
  const db = await getD1Db();
  const profileId = await ownProfileId(db, session.user.id);
  if (!profileId) return;

  const company = str(formData.get("company"));
  const title = str(formData.get("title"));
  if (!company || !title) return;

  const startRaw = str(formData.get("startDate"));
  const endRaw = str(formData.get("endDate"));
  const isCurrent = formData.get("isCurrent") === "on";

  await db.insert(candidateExperiences).values({
    candidateProfileId: profileId,
    company,
    title,
    employmentType: (str(formData.get("employmentType")) ??
      null) as typeof candidateExperiences.$inferInsert.employmentType,
    startDate: startRaw ? new Date(startRaw) : null,
    endDate: !isCurrent && endRaw ? new Date(endRaw) : null,
    isCurrent,
    location: str(formData.get("location")),
    description: str(formData.get("description")),
    techStack: str(formData.get("techStack")),
    sortOrder: num(formData.get("sortOrder")) ?? 0,
  });

  await recomputeCompleteness(db, session.user.id);
  revalidatePath("/me/experience");
}

export async function deleteExperience(formData: FormData) {
  const session = await requireCandidateWritable();
  const db = await getD1Db();
  const profileId = await ownProfileId(db, session.user.id);
  const id = str(formData.get("id"));
  if (!profileId || !id) return;

  // Ownership check: row must belong to the caller's profile.
  await db
    .delete(candidateExperiences)
    .where(
      and(
        eq(candidateExperiences.id, id),
        eq(candidateExperiences.candidateProfileId, profileId)
      )
    );
  await recomputeCompleteness(db, session.user.id);
  revalidatePath("/me/experience");
}

export async function addLink(formData: FormData) {
  const session = await requireCandidateWritable();
  const db = await getD1Db();
  const profileId = await ownProfileId(db, session.user.id);
  if (!profileId) return;

  const url = str(formData.get("url"));
  if (!url) return;

  await db.insert(candidateLinks).values({
    candidateProfileId: profileId,
    kind: (str(formData.get("kind")) ??
      "other") as typeof candidateLinks.$inferInsert.kind,
    url,
    label: str(formData.get("label")),
    sortOrder: num(formData.get("sortOrder")) ?? 0,
  });
  await recomputeCompleteness(db, session.user.id);
  revalidatePath("/me/links");
}

export async function deleteLink(formData: FormData) {
  const session = await requireCandidateWritable();
  const db = await getD1Db();
  const profileId = await ownProfileId(db, session.user.id);
  const id = str(formData.get("id"));
  if (!profileId || !id) return;

  await db
    .delete(candidateLinks)
    .where(
      and(
        eq(candidateLinks.id, id),
        eq(candidateLinks.candidateProfileId, profileId)
      )
    );
  await recomputeCompleteness(db, session.user.id);
  revalidatePath("/me/links");
}

export async function uploadResume(formData: FormData) {
  const session = await requireCandidateWritable();
  const db = await getD1Db();
  const profileId = await ownProfileId(db, session.user.id);
  if (!profileId) return;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/me/resume?error=empty");
  }
  if (file.size > MAX_RESUME_BYTES) {
    redirect("/me/resume?error=size");
  }

  const buf = await file.arrayBuffer();
  if (validateMagicBytes(buf, "application/pdf")) {
    redirect("/me/resume?error=type");
  }

  const key = resumeKey(profileId, file.name || "resume.pdf");
  await putObject(key, buf, "application/pdf");

  await db
    .update(candidateProfiles)
    .set({
      resumeKey: key,
      resumeFileName: file.name || "resume.pdf",
      resumeUploadedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(candidateProfiles.id, profileId));

  await recomputeCompleteness(db, session.user.id);
  redirect("/me/resume?ok=1");
}

export async function removeResume() {
  const session = await requireCandidateWritable();
  const db = await getD1Db();
  const profile = await db
    .select({ id: candidateProfiles.id, resumeKey: candidateProfiles.resumeKey })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, session.user.id))
    .get();
  if (!profile) return;

  if (profile.resumeKey) {
    try {
      await deleteObject(profile.resumeKey);
    } catch (e) {
      console.error("[resume] delete object failed:", e);
    }
  }
  await db
    .update(candidateProfiles)
    .set({ resumeKey: null, resumeFileName: null, resumeUploadedAt: null })
    .where(eq(candidateProfiles.id, profile.id));
  await recomputeCompleteness(db, session.user.id);
  revalidatePath("/me/resume");
}

/** Revoke broad share consent — employer access stops on the next request. */
export async function revokeConsent() {
  const session = await requireCandidateWritable();
  const db = await getD1Db();
  const profileId = await ownProfileId(db, session.user.id);
  if (!profileId) return;

  await db
    .update(candidateConsents)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(candidateConsents.candidateProfileId, profileId),
        isNull(candidateConsents.revokedAt)
      )
    );
  revalidatePath("/me/sharing");
  revalidatePath("/me");
}

/** Re-enable broad share consent. */
export async function enableConsent() {
  const session = await requireCandidateWritable();
  const db = await getD1Db();
  const profileId = await ownProfileId(db, session.user.id);
  if (!profileId) return;

  const existing = await db
    .select({ id: candidateConsents.id })
    .from(candidateConsents)
    .where(
      and(
        eq(candidateConsents.candidateProfileId, profileId),
        isNull(candidateConsents.revokedAt)
      )
    )
    .get();
  if (existing) return;

  const hdrs = await headers();
  await db.insert(candidateConsents).values({
    candidateProfileId: profileId,
    scope: "share_with_employers",
    consentTextVersion: "2026-06-22",
    ipAtConsent:
      hdrs.get("cf-connecting-ip") || hdrs.get("x-forwarded-for") || null,
  });
  revalidatePath("/me/sharing");
  revalidatePath("/me");
}

function normalizeLinkedInUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

/**
 * Candidate asks Frog to refresh their profile from LinkedIn.
 * Saves/updates the LinkedIn link, then notifies Slack for manual review.
 */
export async function requestLinkedInRefresh(formData: FormData) {
  const session = await requireCandidateWritable();
  const db = await getD1Db();
  const profileId = await ownProfileId(db, session.user.id);
  if (!profileId) redirect("/me/profile?error=linkedin");

  const linkedInUrl = normalizeLinkedInUrl(String(formData.get("linkedinUrl") ?? ""));
  if (!linkedInUrl) redirect("/me/profile?error=linkedin_url");

  const allowed = await rateLimit(`rl:li-refresh:${session.user.id}`, 3, 3600);
  if (!allowed) redirect("/me/profile?error=linkedin_rate");

  const existing = await db
    .select({ id: candidateLinks.id })
    .from(candidateLinks)
    .where(
      and(
        eq(candidateLinks.candidateProfileId, profileId),
        eq(candidateLinks.kind, "linkedin")
      )
    )
    .get();

  if (existing) {
    await db
      .update(candidateLinks)
      .set({ url: linkedInUrl, label: "LinkedIn" })
      .where(eq(candidateLinks.id, existing.id));
  } else {
    await db.insert(candidateLinks).values({
      candidateProfileId: profileId,
      kind: "linkedin",
      url: linkedInUrl,
      label: "LinkedIn",
      sortOrder: 0,
    });
  }

  const u = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, session.user.id))
    .get();
  const profile = await db
    .select({ displayName: candidateProfiles.displayName })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.id, profileId))
    .get();

  const display =
    profile?.displayName || u?.name || u?.email || "Candidate";
  const base =
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "https://recruit.frogagent.com";
  const adminUrl = `${base.replace(/\/$/, "")}/admin/candidates/${session.user.id}`;

  const text = [
    ":linkedin: *LinkedIn profile update requested*",
    `*Candidate:* ${escapeSlack(display)} (${escapeSlack(u?.email ?? "—")})`,
    `*LinkedIn:* ${linkedInUrl}`,
    `*Admin:* ${adminUrl}`,
    "_Please review LinkedIn and update the candidate profile manually._",
  ].join("\n");

  const slack = await notifySlack(text);
  if (slack.ok) {
    revalidatePath("/me/profile");
    revalidatePath("/me/links");
    redirect("/me/profile?linkedin=requested");
  }
  if ("skipped" in slack && slack.skipped) {
    redirect("/me/profile?linkedin=saved_no_slack");
  }
  redirect("/me/profile?error=linkedin_slack");
}
