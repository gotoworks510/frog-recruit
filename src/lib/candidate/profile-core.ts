import { and, eq, isNull } from "drizzle-orm";
import {
  candidateConsents,
  candidateExperiences,
  candidateLinks,
  candidateProfiles,
  users,
} from "@/lib/db/schema";
import { computeCompleteness, getCandidateByUserId } from "@/lib/candidate/profile";
import { deleteObject, putObject, resumeKey } from "@/lib/storage/r2";
import { validateMagicBytes } from "@/lib/storage/magic-bytes";
import { rateLimit } from "@/lib/ratelimit/kv";
import { escapeSlack } from "@/lib/slack/notify";
import { notifySlackUnlessTest } from "@/lib/notify/skip-ops";
import { syncCandidateVisibility } from "@/lib/notify/visibility";
import type { Database } from "@/lib/db/client";

export const MAX_RESUME_BYTES = 10 * 1024 * 1024; // 10MB
export const CONSENT_VERSION = "2026-06-22";

/** Profile id owned by this user, or null. */
export async function ownProfileId(
  db: Database,
  userId: string
): Promise<string | null> {
  const row = await db
    .select({ id: candidateProfiles.id })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, userId))
    .get();
  return row?.id ?? null;
}

export async function recomputeCompleteness(
  db: Database,
  userId: string
): Promise<void> {
  const candidate = await getCandidateByUserId(db, userId);
  if (!candidate) return;
  await db
    .update(candidateProfiles)
    .set({
      completeness: computeCompleteness(candidate),
      updatedAt: new Date(),
    })
    .where(eq(candidateProfiles.id, candidate.profile.id));
}

type ProfileInsert = typeof candidateProfiles.$inferInsert;

export interface ProfileFields {
  displayName: string | null;
  headline: string | null;
  summary: string | null;
  locationCurrent: string | null;
  locationPreference: string | null;
  yearsExperience: number | null;
  workAuthStatus: ProfileInsert["workAuthStatus"];
  visaNotes: string | null;
  availability: string | null;
  englishLevel: ProfileInsert["englishLevel"];
  desiredSalaryMin: number | null;
  desiredSalaryMax: number | null;
  salaryCurrency: string;
}

/** Replace the editable profile fields (full overwrite, as the Web form does). */
export async function updateProfileFields(
  db: Database,
  userId: string,
  fields: ProfileFields
): Promise<{ ok: boolean }> {
  const profileId = await ownProfileId(db, userId);
  if (!profileId) return { ok: false };

  await db
    .update(candidateProfiles)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(candidateProfiles.id, profileId));

  await recomputeCompleteness(db, userId);
  return { ok: true };
}

type ExperienceInsert = typeof candidateExperiences.$inferInsert;

export interface ExperienceFields {
  company: string;
  title: string;
  employmentType: ExperienceInsert["employmentType"];
  startDate: Date | null;
  endDate: Date | null;
  isCurrent: boolean;
  location: string | null;
  description: string | null;
  techStack: string | null;
  sortOrder: number;
}

export async function addExperienceCore(
  db: Database,
  userId: string,
  fields: ExperienceFields
): Promise<{ ok: boolean; id?: string }> {
  const profileId = await ownProfileId(db, userId);
  if (!profileId) return { ok: false };
  if (!fields.company || !fields.title) return { ok: false };

  const id = crypto.randomUUID();
  await db.insert(candidateExperiences).values({
    id,
    candidateProfileId: profileId,
    ...fields,
    endDate: fields.isCurrent ? null : fields.endDate,
  });
  await recomputeCompleteness(db, userId);
  return { ok: true, id };
}

/** Ownership-checked update of one experience row. */
export async function updateExperienceCore(
  db: Database,
  userId: string,
  id: string,
  fields: Partial<ExperienceFields>
): Promise<{ ok: boolean }> {
  const profileId = await ownProfileId(db, userId);
  if (!profileId) return { ok: false };

  const owned = await db
    .select({ id: candidateExperiences.id })
    .from(candidateExperiences)
    .where(
      and(
        eq(candidateExperiences.id, id),
        eq(candidateExperiences.candidateProfileId, profileId)
      )
    )
    .get();
  if (!owned) return { ok: false };

  await db
    .update(candidateExperiences)
    .set(fields)
    .where(eq(candidateExperiences.id, id));
  await recomputeCompleteness(db, userId);
  return { ok: true };
}

export async function deleteExperienceCore(
  db: Database,
  userId: string,
  id: string
): Promise<{ ok: boolean }> {
  const profileId = await ownProfileId(db, userId);
  if (!profileId) return { ok: false };

  // Ownership check: row must belong to the caller's profile.
  await db
    .delete(candidateExperiences)
    .where(
      and(
        eq(candidateExperiences.id, id),
        eq(candidateExperiences.candidateProfileId, profileId)
      )
    );
  await recomputeCompleteness(db, userId);
  return { ok: true };
}

type LinkInsert = typeof candidateLinks.$inferInsert;

export interface LinkFields {
  kind: NonNullable<LinkInsert["kind"]>;
  url: string;
  label: string | null;
  sortOrder: number;
}

export async function addLinkCore(
  db: Database,
  userId: string,
  fields: LinkFields
): Promise<{ ok: boolean; id?: string }> {
  const profileId = await ownProfileId(db, userId);
  if (!profileId || !fields.url) return { ok: false };

  const id = crypto.randomUUID();
  await db
    .insert(candidateLinks)
    .values({ id, candidateProfileId: profileId, ...fields });
  await recomputeCompleteness(db, userId);
  return { ok: true, id };
}

export async function deleteLinkCore(
  db: Database,
  userId: string,
  id: string
): Promise<{ ok: boolean }> {
  const profileId = await ownProfileId(db, userId);
  if (!profileId) return { ok: false };

  await db
    .delete(candidateLinks)
    .where(
      and(
        eq(candidateLinks.id, id),
        eq(candidateLinks.candidateProfileId, profileId)
      )
    );
  await recomputeCompleteness(db, userId);
  return { ok: true };
}

export type ResumeUploadFailure = "empty" | "size" | "type" | "no_profile";

/** PDF-only resume upload (magic bytes enforced, 10MB cap). */
export async function saveResumeCore(
  db: Database,
  userId: string,
  file: { buffer: ArrayBuffer; fileName: string; size: number }
): Promise<
  { ok: true; fileName: string; uploadedAt: Date } | { ok: false; reason: ResumeUploadFailure }
> {
  const profileId = await ownProfileId(db, userId);
  if (!profileId) return { ok: false, reason: "no_profile" };
  if (file.size === 0) return { ok: false, reason: "empty" };
  if (file.size > MAX_RESUME_BYTES) return { ok: false, reason: "size" };
  if (validateMagicBytes(file.buffer, "application/pdf")) {
    return { ok: false, reason: "type" };
  }

  const fileName = file.fileName || "resume.pdf";
  const key = resumeKey(profileId, fileName);
  await putObject(key, file.buffer, "application/pdf");

  const uploadedAt = new Date();
  await db
    .update(candidateProfiles)
    .set({
      resumeKey: key,
      resumeFileName: fileName,
      resumeUploadedAt: uploadedAt,
      updatedAt: uploadedAt,
    })
    .where(eq(candidateProfiles.id, profileId));

  await recomputeCompleteness(db, userId);
  return { ok: true, fileName, uploadedAt };
}

export async function removeResumeCore(
  db: Database,
  userId: string
): Promise<{ ok: boolean }> {
  const profile = await db
    .select({ id: candidateProfiles.id, resumeKey: candidateProfiles.resumeKey })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, userId))
    .get();
  if (!profile) return { ok: false };

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
  await recomputeCompleteness(db, userId);
  return { ok: true };
}

// --- Consent -------------------------------------------------------------

/** Is broad share consent currently active for this candidate? */
export async function isConsentActive(
  db: Database,
  profileId: string
): Promise<boolean> {
  const row = await db
    .select({ id: candidateConsents.id })
    .from(candidateConsents)
    .where(
      and(
        eq(candidateConsents.candidateProfileId, profileId),
        isNull(candidateConsents.revokedAt)
      )
    )
    .get();
  return !!row;
}

/** Revoke broad share consent — employer access stops on the next request. */
export async function revokeConsentCore(
  db: Database,
  userId: string
): Promise<{ ok: boolean }> {
  const profileId = await ownProfileId(db, userId);
  if (!profileId) return { ok: false };

  await db
    .update(candidateConsents)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(candidateConsents.candidateProfileId, profileId),
        isNull(candidateConsents.revokedAt)
      )
    );
  return { ok: true };
}

/**
 * Re-enable broad share consent. Re-enabling can make an existing grant
 * effective, so this is one of the three `syncCandidateVisibility` call sites.
 */
export async function enableConsentCore(
  db: Database,
  userId: string,
  options?: { consentTextVersion?: string | null; ip?: string | null }
): Promise<{ ok: boolean; alreadyActive?: boolean }> {
  const profileId = await ownProfileId(db, userId);
  if (!profileId) return { ok: false };

  if (await isConsentActive(db, profileId)) {
    return { ok: true, alreadyActive: true };
  }

  await db.insert(candidateConsents).values({
    candidateProfileId: profileId,
    scope: "share_with_employers",
    consentTextVersion: options?.consentTextVersion || CONSENT_VERSION,
    ipAtConsent: options?.ip ?? null,
  });

  await syncCandidateVisibility(db, profileId);
  return { ok: true };
}

// --- LinkedIn refresh ----------------------------------------------------

export function normalizeLinkedInUrl(raw: string): string | null {
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

export type LinkedInRefreshFailure =
  | "no_profile"
  | "url"
  | "rate"
  | "slack"
  | "saved_no_slack";

/**
 * Candidate asks Frog to refresh their profile from LinkedIn: save/update the
 * LinkedIn link, then notify Slack for manual review.
 */
export async function requestLinkedInRefreshCore(
  db: Database,
  userId: string,
  rawUrl: string
): Promise<{ ok: true; url: string } | { ok: false; reason: LinkedInRefreshFailure }> {
  const profileId = await ownProfileId(db, userId);
  if (!profileId) return { ok: false, reason: "no_profile" };

  const linkedInUrl = normalizeLinkedInUrl(rawUrl);
  if (!linkedInUrl) return { ok: false, reason: "url" };

  const allowed = await rateLimit(`rl:li-refresh:${userId}`, 3, 3600);
  if (!allowed) return { ok: false, reason: "rate" };

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
    .where(eq(users.id, userId))
    .get();
  const profile = await db
    .select({ displayName: candidateProfiles.displayName })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.id, profileId))
    .get();

  const display = profile?.displayName || u?.name || u?.email || "Candidate";
  const base =
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "https://recruit.frogagent.com";
  const adminUrl = `${base.replace(/\/$/, "")}/admin/candidates/${userId}`;

  const slack = await notifySlackUnlessTest(
    db,
    [userId],
    [
      ":linkedin: *LinkedIn profile update requested*",
      `*Candidate:* ${escapeSlack(display)} (${escapeSlack(u?.email ?? "—")})`,
      `*LinkedIn:* ${linkedInUrl}`,
      `*Admin:* ${adminUrl}`,
      "_Please review LinkedIn and update the candidate profile manually._",
    ].join("\n")
  );

  if (slack.ok) return { ok: true, url: linkedInUrl };
  if ("skipped" in slack && slack.skipped) {
    return { ok: false, reason: "saved_no_slack" };
  }
  return { ok: false, reason: "slack" };
}
