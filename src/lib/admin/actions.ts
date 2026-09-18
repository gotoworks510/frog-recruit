"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import type { Database } from "@/lib/db/client";
import {
  users,
  candidateProfiles,
  recommendations,
  companies,
  jobs,
  employerAccounts,
  candidateAccounts,
  candidateIntroductions,
  accessGrants,
  candidateConsents,
  candidateInvites,
} from "@/lib/db/schema";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";
import { sendEmail } from "@/lib/email/resend";
import {
  buildCandidateInviteEmail,
  buildCandidateCredentialsEmail,
  buildEmployerCredentialsEmail,
} from "@/lib/email/messages";
import { parseFrogScore } from "@/lib/employer/frog-score";
import {
  INTRO_STATUSES,
  type IntroStatus,
} from "@/lib/db/schema/introductions";
import { syncCandidateVisibility } from "@/lib/notify/visibility";
import { emitIntroductionEvents } from "@/lib/notify/introductions";
import { revokeMobileSessions } from "@/lib/notify/sessions";
import { isTestEmail } from "@/lib/notify/skip-ops";

function str(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}
function num(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

const INVITE_TTL_DAYS = 14;
const EMP_PW_COOKIE = "recruit_emp_pw";
const CAND_PW_COOKIE = "recruit_cand_pw";

async function ensureIntroduction(
  db: Database,
  params: {
    candidateProfileId: string;
    companyId: string;
    updatedBy: string;
    status?: IntroStatus;
  }
) {
  const { candidateProfileId, companyId, updatedBy } = params;
  const status = params.status ?? "shared";
  const existing = await db
    .select({ id: candidateIntroductions.id, status: candidateIntroductions.status })
    .from(candidateIntroductions)
    .where(
      and(
        eq(candidateIntroductions.candidateProfileId, candidateProfileId),
        eq(candidateIntroductions.companyId, companyId)
      )
    )
    .get();

  if (existing) {
    // Don't downgrade a later pipeline status when re-sharing.
    if (existing.status === "planned" && status !== "planned") {
      const updatedAt = new Date();
      await db
        .update(candidateIntroductions)
        .set({ status, updatedBy, updatedAt })
        .where(eq(candidateIntroductions.id, existing.id));
      await emitIntroductionEvents(db, {
        introductionId: existing.id,
        candidateProfileId,
        companyId,
        previousStatus: existing.status,
        status,
        updatedAt,
      });
    }
    return;
  }

  const introId = crypto.randomUUID();
  const createdAt = new Date();
  await db.insert(candidateIntroductions).values({
    id: introId,
    candidateProfileId,
    companyId,
    status,
    updatedBy,
  });
  await emitIntroductionEvents(db, {
    introductionId: introId,
    candidateProfileId,
    companyId,
    previousStatus: null,
    status,
    updatedAt: createdAt,
  });
}

// --- Candidate vetting ---------------------------------------------------

export async function setCandidateStatus(formData: FormData) {
  await requireAdmin();
  const db = await getD1Db();
  const userId = str(formData.get("userId"));
  const status = str(formData.get("status"));
  if (!userId || !status) return;
  if (!["pending", "approved", "rejected"].includes(status)) return;
  await db
    .update(users)
    .set({ status: status as "pending" | "approved" | "rejected" })
    .where(eq(users.id, userId));
  if (status === "rejected") {
    await revokeMobileSessions(db, userId, "admin");
  }
  revalidatePath("/admin/candidates");
  // Redirect (not just revalidate) so the dynamic detail page reliably refreshes
  // on OpenNext/Cloudflare, where revalidatePath alone may serve a stale view.
  redirect(`/admin/candidates/${userId}`);
}

// --- Recommendation (one general rec per candidate for v1) ---------------

export async function saveRecommendation(formData: FormData) {
  const session = await requireAdmin();
  const db = await getD1Db();
  const candidateProfileId = str(formData.get("candidateProfileId"));
  if (!candidateProfileId) return;

  // recId present = editing an existing row (allows changing target company).
  const recId = str(formData.get("recId"));
  // Target company (null = general fallback) + optional position.
  const companyId = str(formData.get("companyId"));
  const jobId = str(formData.get("jobId"));
  const strengthsMd = str(formData.get("strengthsMd"));
  const considerationsMd = str(formData.get("considerationsMd"));
  const internalNotesMd = str(formData.get("internalNotesMd"));
  const frogScore = parseFrogScore(formData.get("frogScore"));
  const status = (str(formData.get("status")) ?? "draft") as "draft" | "published";
  const visibility = (str(formData.get("visibility")) ?? "internal_only") as
    | "internal_only"
    | "shared";

  const now = new Date();
  const setVals = {
    companyId,
    jobId,
    frogScore,
    strengthsMd,
    considerationsMd,
    internalNotesMd,
    status,
    visibility,
    publishedAt: status === "published" ? now : null,
    updatedAt: now,
  };

  if (recId) {
    // Edit existing row by id (target company may be changed).
    await db.update(recommendations).set(setVals).where(eq(recommendations.id, recId));
  } else {
    // Add: one recommendation per (candidate, target company) — upsert.
    const existing = await db
      .select({ id: recommendations.id })
      .from(recommendations)
      .where(
        and(
          eq(recommendations.candidateProfileId, candidateProfileId),
          companyId
            ? eq(recommendations.companyId, companyId)
            : isNull(recommendations.companyId)
        )
      )
      .get();
    if (existing) {
      await db.update(recommendations).set(setVals).where(eq(recommendations.id, existing.id));
    } else {
      await db.insert(recommendations).values({
        candidateProfileId,
        authoredBy: session.user.id,
        ...setVals,
      });
    }
  }

  // Auto-grant this company's employers when the recommendation is actually
  // shareable (published + shared + targets a specific company). Removes the
  // manual /admin/grants step; the runtime access check still requires consent.
  if (companyId && status === "published" && visibility === "shared") {
    await autoGrantCompanyEmployers(db, {
      candidateProfileId,
      companyId,
      grantedBy: session.user.id,
    });
    await ensureIntroduction(db, {
      candidateProfileId,
      companyId,
      updatedBy: session.user.id,
      status: "shared",
    });
    // Publishing + sharing can be the moment effective access turns true.
    await syncCandidateVisibility(db, candidateProfileId);
  }

  revalidatePath("/admin/candidates");
  revalidatePath("/admin/grants");
  revalidatePath("/me/preview");
  revalidatePath("/portal");
  // Redirect back to the candidate detail so the page shows the saved state
  // (revalidatePath alone leaves a stale dynamic view on OpenNext/Cloudflare).
  const prof = await db
    .select({ userId: candidateProfiles.userId })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.id, candidateProfileId))
    .get();
  if (prof?.userId) redirect(`/admin/candidates/${prof.userId}`);
}

export async function deleteRecommendation(formData: FormData) {
  await requireAdmin();
  const db = await getD1Db();
  const id = str(formData.get("id"));
  const candidateProfileId = str(formData.get("candidateProfileId"));
  if (!id) return;
  await db.delete(recommendations).where(eq(recommendations.id, id));
  revalidatePath("/admin/candidates");
  revalidatePath("/me/preview");
  revalidatePath("/portal");
  if (candidateProfileId) {
    const prof = await db
      .select({ userId: candidateProfiles.userId })
      .from(candidateProfiles)
      .where(eq(candidateProfiles.id, candidateProfileId))
      .get();
    if (prof?.userId) redirect(`/admin/candidates/${prof.userId}`);
  }
}

// --- Invites -------------------------------------------------------------

export async function createInvite(formData: FormData) {
  const session = await requireAdmin();
  const db = await getD1Db();
  const email = str(formData.get("email"))?.toLowerCase();
  const name = str(formData.get("name"));
  if (!email) return;

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(candidateInvites).values({
    email,
    name,
    token,
    expiresAt,
    createdBy: session.user.id,
  });

  const { subject, subtitle, bodyHtml } = buildCandidateInviteEmail({ name, token });
  if (!(await isTestEmail(db, email))) {
    await sendEmail({ to: email, subject, subtitle, bodyHtml });
  }

  revalidatePath("/admin/invites");
}

export async function revokeInvite(formData: FormData) {
  await requireAdmin();
  const db = await getD1Db();
  const id = str(formData.get("id"));
  if (!id) return;
  await db
    .update(candidateInvites)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(eq(candidateInvites.id, id));
  revalidatePath("/admin/invites");
}

// --- Companies + jobs ----------------------------------------------------

export async function createCompany(formData: FormData) {
  await requireAdmin();
  const db = await getD1Db();
  const name = str(formData.get("name"));
  const slug = str(formData.get("slug"))?.toLowerCase();
  if (!name || !slug) return;
  await db.insert(companies).values({
    name,
    slug,
    domain: str(formData.get("domain")),
    description: str(formData.get("description")),
  });
  revalidatePath("/admin/companies");
}

export async function updateCompany(formData: FormData) {
  await requireAdmin();
  const db = await getD1Db();
  const id = str(formData.get("id"));
  const name = str(formData.get("name"));
  const slug = str(formData.get("slug"))?.toLowerCase();
  if (!id || !name || !slug) return;
  await db
    .update(companies)
    .set({
      name,
      slug,
      domain: str(formData.get("domain")),
      description: str(formData.get("description")),
      status: (str(formData.get("status")) ?? "active") as "active" | "archived",
    })
    .where(eq(companies.id, id));
  revalidatePath("/admin/companies");
}

export async function deleteCompany(formData: FormData) {
  await requireAdmin();
  const db = await getD1Db();
  const id = str(formData.get("id"));
  if (!id) return;
  // FK cascade removes this company's jobs and access grants.
  await db.delete(companies).where(eq(companies.id, id));
  revalidatePath("/admin/companies");
}

export async function updateJob(formData: FormData) {
  await requireAdmin();
  const db = await getD1Db();
  const id = str(formData.get("id"));
  const title = str(formData.get("title"));
  if (!id || !title) return;
  await db
    .update(jobs)
    .set({
      title,
      description: str(formData.get("description")),
      salaryMin: num(formData.get("salaryMin")),
      salaryMax: num(formData.get("salaryMax")),
      salaryCurrency: str(formData.get("salaryCurrency")) ?? "USD",
      location: str(formData.get("location")),
      workAuthRequirement: str(formData.get("workAuthRequirement")),
      status: (str(formData.get("status")) ?? "open") as "open" | "filled" | "closed",
    })
    .where(eq(jobs.id, id));
  revalidatePath("/admin/companies");
}

export async function deleteJob(formData: FormData) {
  await requireAdmin();
  const db = await getD1Db();
  const id = str(formData.get("id"));
  if (!id) return;
  await db.delete(jobs).where(eq(jobs.id, id));
  revalidatePath("/admin/companies");
}

// --- Employer accounts ---------------------------------------------------

async function flashTempPassword(email: string, pw: string) {
  const c = await cookies();
  c.set(EMP_PW_COOKIE, JSON.stringify({ email, pw }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 120,
    path: "/admin/employers",
  });
}

export async function createEmployer(formData: FormData) {
  const session = await requireAdmin();
  const db = await getD1Db();
  const email = str(formData.get("email"))?.toLowerCase();
  const companyId = str(formData.get("companyId"));
  const contactName = str(formData.get("contactName"));
  if (!email || !companyId) redirect("/admin/employers?error=missing");

  const existing = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .get();
  if (existing) {
    // Employer duplicate can be cleared via the delete button on this screen;
    // a collision with a candidate/admin account is a different situation.
    redirect(
      existing.role === "employer"
        ? "/admin/employers?error=exists"
        : "/admin/employers?error=email_taken"
    );
  }

  const company = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();
  if (!company) redirect("/admin/employers?error=missing");

  const tempPassword = generateTempPassword();
  const { hash, salt } = await hashPassword(tempPassword);
  const userId = crypto.randomUUID();

  await db.insert(users).values({
    id: userId,
    email,
    name: contactName,
    role: "employer",
    status: "approved",
    authProvider: "credentials",
    passwordHash: hash,
    passwordSalt: salt,
    passwordUpdatedAt: new Date(),
    employerCompanyId: companyId,
  });
  await db.insert(employerAccounts).values({
    userId,
    companyId,
    contactName,
    mustResetPassword: true,
    createdBy: session.user.id,
  });

  const { subject, subtitle, bodyHtml } = buildEmployerCredentialsEmail({
    companyName: company.name,
    contactName,
    email,
    tempPassword,
  });
  await sendEmail({ to: email, subject, subtitle, bodyHtml });

  await flashTempPassword(email, tempPassword);
  redirect("/admin/employers?created=1");
}

export async function rotateEmployerPassword(formData: FormData) {
  await requireAdmin();
  const db = await getD1Db();
  const userId = str(formData.get("userId"));
  if (!userId) return;

  const u = await db
    .select({ email: users.email, companyId: users.employerCompanyId })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!u) return;

  const tempPassword = generateTempPassword();
  const { hash, salt } = await hashPassword(tempPassword);
  await db
    .update(users)
    .set({ passwordHash: hash, passwordSalt: salt, passwordUpdatedAt: new Date() })
    .where(eq(users.id, userId));
  await db
    .update(employerAccounts)
    .set({ mustResetPassword: true, lastPasswordRotationAt: new Date() })
    .where(eq(employerAccounts.userId, userId));

  let companyName = "Frog Recruit";
  if (u.companyId) {
    const c = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, u.companyId))
      .get();
    if (c?.name) companyName = c.name;
  }
  // The old password is dead — sign the employer out of every mobile device.
  await revokeMobileSessions(db, userId, "password_changed");

  const { subject, subtitle, bodyHtml } = buildEmployerCredentialsEmail({
    companyName,
    email: u.email,
    tempPassword,
  });
  if (!(await isTestEmail(db, u.email))) {
    await sendEmail({ to: u.email, subject, subtitle, bodyHtml });
  }

  await flashTempPassword(u.email, tempPassword);
  redirect("/admin/employers?rotated=1");
}

export async function setEmployerDisabled(formData: FormData) {
  await requireAdmin();
  const db = await getD1Db();
  const userId = str(formData.get("userId"));
  const disabled = str(formData.get("disabled")) === "1";
  if (!userId) return;
  await db
    .update(employerAccounts)
    .set({ disabledAt: disabled ? new Date() : null })
    .where(eq(employerAccounts.userId, userId));
  if (disabled) {
    // A disabled employer must stop receiving candidate pushes immediately.
    await revokeMobileSessions(db, userId, "admin");
  }
  revalidatePath("/admin/employers");
}

/**
 * Permanently delete an employer account and free its email for
 * re-registration. Disabling only blocks login — the users row (and its unique
 * email) remains, so a duplicate-email error persists. Deletion is the way to
 * clear an "already registered" email.
 *
 * FK `ON DELETE CASCADE` removes the linked employer_accounts row and any
 * access_grants for this employer. view_audit.actor_user_id has no FK, so the
 * append-only audit history is intentionally preserved (actor id is retained
 * but no longer resolves to a user).
 */
export async function deleteEmployer(formData: FormData) {
  await requireAdmin();
  const db = await getD1Db();
  const userId = str(formData.get("userId"));
  if (!userId) redirect("/admin/employers?error=missing");

  // Safety: this screen only ever deletes employer accounts. Never remove an
  // admin or candidate that might share the same id.
  const u = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!u || u.role !== "employer") {
    redirect("/admin/employers?error=notfound");
  }

  // Revoke before the cascade so push tokens are cleared deliberately.
  await revokeMobileSessions(db, userId, "admin");
  await db.delete(users).where(eq(users.id, userId));
  revalidatePath("/admin/employers");
  redirect("/admin/employers?deleted=1");
}

// --- Access grants (consent-gated) ---------------------------------------

/**
 * Auto-grant: when a candidate recommendation is published + shared for a
 * specific company, give every active (non-disabled) employer account of that
 * company view access to the candidate — so admins no longer need a separate
 * /admin/grants step after publishing a company-targeted recommendation.
 *
 * Idempotent: upserts on the unique (employer, candidate) index and reactivates
 * a previously revoked grant, without touching an already-active grant's expiry.
 *
 * Consent is intentionally NOT required here. The grant row is inert until the
 * runtime effective-access check (getEffectiveGrant / listGrantedCandidateIds)
 * also sees an active consent AND a published/shared recommendation, so eager
 * creation is safe and order-independent (works whether the candidate consents
 * before or after the recommendation is shared).
 */
async function autoGrantCompanyEmployers(
  db: Database,
  params: { candidateProfileId: string; companyId: string; grantedBy: string }
): Promise<void> {
  const { candidateProfileId, companyId, grantedBy } = params;

  const employers = await db
    .select({ userId: employerAccounts.userId })
    .from(employerAccounts)
    .where(
      and(
        eq(employerAccounts.companyId, companyId),
        isNull(employerAccounts.disabledAt)
      )
    )
    .all();

  for (const emp of employers) {
    const existing = await db
      .select({ id: accessGrants.id })
      .from(accessGrants)
      .where(
        and(
          eq(accessGrants.employerUserId, emp.userId),
          eq(accessGrants.candidateProfileId, candidateProfileId)
        )
      )
      .get();

    if (existing) {
      // Reactivate a revoked grant; leave an active grant's expiry untouched.
      await db
        .update(accessGrants)
        .set({ revokedAt: null })
        .where(eq(accessGrants.id, existing.id));
    } else {
      await db.insert(accessGrants).values({
        employerUserId: emp.userId,
        candidateProfileId,
        companyId,
        grantedBy,
      });
    }
  }
}

export async function createGrant(formData: FormData) {
  const session = await requireAdmin();
  const db = await getD1Db();
  const employerUserId = str(formData.get("employerUserId"));
  const candidateProfileId = str(formData.get("candidateProfileId"));
  if (!employerUserId || !candidateProfileId) {
    redirect("/admin/grants?error=missing");
  }

  const employer = await db
    .select({ companyId: users.employerCompanyId })
    .from(users)
    .where(eq(users.id, employerUserId))
    .get();
  if (!employer?.companyId) redirect("/admin/grants?error=missing");

  // Consent gate: candidate must have active consent covering this company.
  const consents = await db
    .select({
      scope: candidateConsents.scope,
      companyId: candidateConsents.companyId,
    })
    .from(candidateConsents)
    .where(
      and(
        eq(candidateConsents.candidateProfileId, candidateProfileId),
        isNull(candidateConsents.revokedAt)
      )
    )
    .all();
  const consentOk = consents.some(
    (c) =>
      c.scope === "share_with_employers" ||
      (c.scope === "share_with_company" && c.companyId === employer.companyId)
  );
  if (!consentOk) redirect("/admin/grants?error=consent");

  const expiresRaw = str(formData.get("expiresAt"));
  const canDownloadResume = str(formData.get("canDownloadResume")) !== "0";

  // Upsert (unique employer+candidate): reactivate if a revoked grant exists.
  const existing = await db
    .select({ id: accessGrants.id })
    .from(accessGrants)
    .where(
      and(
        eq(accessGrants.employerUserId, employerUserId),
        eq(accessGrants.candidateProfileId, candidateProfileId)
      )
    )
    .get();

  if (existing) {
    await db
      .update(accessGrants)
      .set({
        revokedAt: null,
        expiresAt: expiresRaw ? new Date(expiresRaw) : null,
        canDownloadResume,
        grantedBy: session.user.id,
        grantedAt: new Date(),
      })
      .where(eq(accessGrants.id, existing.id));
  } else {
    await db.insert(accessGrants).values({
      employerUserId,
      candidateProfileId,
      companyId: employer.companyId,
      grantedBy: session.user.id,
      expiresAt: expiresRaw ? new Date(expiresRaw) : null,
      canDownloadResume,
    });
  }
  await ensureIntroduction(db, {
    candidateProfileId,
    companyId: employer.companyId,
    updatedBy: session.user.id,
    status: "shared",
  });
  await syncCandidateVisibility(db, candidateProfileId);
  redirect("/admin/grants?ok=1");
}

export async function revokeGrant(formData: FormData) {
  await requireAdmin();
  const db = await getD1Db();
  const id = str(formData.get("id"));
  if (!id) return;
  await db
    .update(accessGrants)
    .set({ revokedAt: new Date() })
    .where(eq(accessGrants.id, id));
  revalidatePath("/admin/grants");
  revalidatePath("/admin/candidates");
}

// --- Admin view-as (preview candidate / employer UI without re-login) -----

export async function startViewAsCandidate(formData: FormData) {
  const session = await requireAdmin();
  const userId = str(formData.get("userId"));
  if (!userId) redirect("/admin/candidates?error=missing");

  const db = await getD1Db();
  const target = await db
    .select({ id: users.id, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!target || target.role !== "candidate") {
    redirect("/admin/candidates?error=notfound");
  }

  const { buildViewAsPayload, setViewAsCookie } = await import("@/lib/auth/view-as");
  await setViewAsCookie(
    buildViewAsPayload(session.user.id, "candidate", target.id)
  );
  redirect("/me");
}

export async function startViewAsEmployer(formData: FormData) {
  const session = await requireAdmin();
  const userId = str(formData.get("userId"));
  if (!userId) redirect("/admin/employers?error=missing");

  const db = await getD1Db();
  const target = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!target || target.role !== "employer") {
    redirect("/admin/employers?error=notfound");
  }

  const acct = await db
    .select({ disabledAt: employerAccounts.disabledAt })
    .from(employerAccounts)
    .where(eq(employerAccounts.userId, target.id))
    .get();
  if (acct?.disabledAt) {
    redirect("/admin/employers?error=disabled");
  }

  const { buildViewAsPayload, setViewAsCookie } = await import("@/lib/auth/view-as");
  await setViewAsCookie(
    buildViewAsPayload(session.user.id, "employer", target.id)
  );
  redirect("/portal");
}

export async function exitViewAs() {
  const session = await requireAdmin();
  void session;
  const { clearViewAsCookie } = await import("@/lib/auth/view-as");
  await clearViewAsCookie();
  redirect("/admin");
}

// --- Candidate credentials + introductions -------------------------------

async function flashCandidateTempPassword(email: string, pw: string) {
  const c = await cookies();
  c.set(CAND_PW_COOKIE, JSON.stringify({ email, pw }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 120,
    path: "/admin/candidates",
  });
}

export async function createCandidateAccount(formData: FormData) {
  const session = await requireAdmin();
  const db = await getD1Db();
  const email = str(formData.get("email"))?.toLowerCase();
  const name = str(formData.get("name"));
  if (!email) redirect("/admin/candidates?error=missing");

  const existing = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .get();
  if (existing) {
    redirect(
      existing.role === "candidate"
        ? "/admin/candidates?error=exists"
        : "/admin/candidates?error=email_taken"
    );
  }

  const tempPassword = generateTempPassword();
  const { hash, salt } = await hashPassword(tempPassword);
  const userId = crypto.randomUUID();

  await db.insert(users).values({
    id: userId,
    email,
    name,
    role: "candidate",
    status: "approved",
    authProvider: "credentials",
    passwordHash: hash,
    passwordSalt: salt,
    passwordUpdatedAt: new Date(),
  });
  await db.insert(candidateProfiles).values({
    userId,
    displayName: name,
  });
  await db.insert(candidateAccounts).values({
    userId,
    mustResetPassword: true,
    createdBy: session.user.id,
  });

  const { subject, subtitle, bodyHtml } = buildCandidateCredentialsEmail({
    name,
    email,
    tempPassword,
  });
  await sendEmail({ to: email, subject, subtitle, bodyHtml });

  await flashCandidateTempPassword(email, tempPassword);
  redirect("/admin/candidates?created=1");
}

export async function rotateCandidatePassword(formData: FormData) {
  await requireAdmin();
  const db = await getD1Db();
  const userId = str(formData.get("userId"));
  if (!userId) return;

  const u = await db
    .select({
      email: users.email,
      name: users.name,
      role: users.role,
      authProvider: users.authProvider,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!u || u.role !== "candidate") return;

  const tempPassword = generateTempPassword();
  const { hash, salt } = await hashPassword(tempPassword);
  await db
    .update(users)
    .set({
      passwordHash: hash,
      passwordSalt: salt,
      passwordUpdatedAt: new Date(),
      authProvider: "credentials",
    })
    .where(eq(users.id, userId));

  const acct = await db
    .select({ id: candidateAccounts.id })
    .from(candidateAccounts)
    .where(eq(candidateAccounts.userId, userId))
    .get();
  if (acct) {
    await db
      .update(candidateAccounts)
      .set({ mustResetPassword: true, lastPasswordRotationAt: new Date() })
      .where(eq(candidateAccounts.userId, userId));
  } else {
    await db.insert(candidateAccounts).values({
      userId,
      mustResetPassword: true,
      lastPasswordRotationAt: new Date(),
    });
  }

  await revokeMobileSessions(db, userId, "password_changed");

  const { subject, subtitle, bodyHtml } = buildCandidateCredentialsEmail({
    name: u.name,
    email: u.email,
    tempPassword,
  });
  if (!(await isTestEmail(db, u.email))) {
    await sendEmail({ to: u.email, subject, subtitle, bodyHtml });
  }

  await flashCandidateTempPassword(u.email, tempPassword);
  redirect(`/admin/candidates/${userId}?rotated=1`);
}

export async function setCandidateDisabled(formData: FormData) {
  await requireAdmin();
  const db = await getD1Db();
  const userId = str(formData.get("userId"));
  const disabled = str(formData.get("disabled")) === "1";
  if (!userId) return;

  const acct = await db
    .select({ id: candidateAccounts.id })
    .from(candidateAccounts)
    .where(eq(candidateAccounts.userId, userId))
    .get();
  if (!acct) return;

  await db
    .update(candidateAccounts)
    .set({ disabledAt: disabled ? new Date() : null })
    .where(eq(candidateAccounts.userId, userId));
  if (disabled) {
    await revokeMobileSessions(db, userId, "admin");
  }
  revalidatePath("/admin/candidates");
  revalidatePath(`/admin/candidates/${userId}`);
}

export async function upsertIntroduction(formData: FormData) {
  const session = await requireAdmin();
  const db = await getD1Db();
  const candidateProfileId = str(formData.get("candidateProfileId"));
  const companyId = str(formData.get("companyId"));
  const statusRaw = str(formData.get("status")) ?? "planned";
  const statusNote = str(formData.get("statusNote"));
  const noteInternal = str(formData.get("noteInternal"));
  const userId = str(formData.get("userId"));

  if (!candidateProfileId || !companyId) {
    redirect(userId ? `/admin/candidates/${userId}?error=missing` : "/admin/candidates?error=missing");
  }
  if (!(INTRO_STATUSES as readonly string[]).includes(statusRaw)) {
    redirect(`/admin/candidates/${userId}?error=missing`);
  }
  const status = statusRaw as IntroStatus;

  const existing = await db
    .select({
      id: candidateIntroductions.id,
      status: candidateIntroductions.status,
    })
    .from(candidateIntroductions)
    .where(
      and(
        eq(candidateIntroductions.candidateProfileId, candidateProfileId),
        eq(candidateIntroductions.companyId, companyId)
      )
    )
    .get();

  const updatedAt = new Date();
  let introId: string;
  let previousStatus: IntroStatus | null = null;

  if (existing) {
    introId = existing.id;
    previousStatus = existing.status;
    await db
      .update(candidateIntroductions)
      .set({
        status,
        statusNote,
        noteInternal,
        updatedBy: session.user.id,
        updatedAt,
      })
      .where(eq(candidateIntroductions.id, existing.id));
  } else {
    introId = crypto.randomUUID();
    await db.insert(candidateIntroductions).values({
      id: introId,
      candidateProfileId,
      companyId,
      status,
      statusNote,
      noteInternal,
      updatedBy: session.user.id,
    });
  }

  // Candidate + employer Inbox/push for the new pipeline state. `noteInternal`
  // is never passed through — only the candidate-safe statusNote.
  await emitIntroductionEvents(db, {
    introductionId: introId,
    candidateProfileId,
    companyId,
    previousStatus,
    status,
    statusNote,
    updatedAt,
  });

  revalidatePath("/me");
  revalidatePath("/me/sharing");
  if (userId) redirect(`/admin/candidates/${userId}?intro=1`);
  revalidatePath("/admin/candidates");
}
