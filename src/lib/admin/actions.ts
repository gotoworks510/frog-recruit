"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import {
  users,
  candidateProfiles,
  recommendations,
  companies,
  jobs,
  employerAccounts,
  accessGrants,
  candidateConsents,
  candidateInvites,
} from "@/lib/db/schema";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";
import { sendEmail } from "@/lib/email/resend";
import {
  buildCandidateInviteEmail,
  buildEmployerCredentialsEmail,
} from "@/lib/email/messages";

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
  const status = (str(formData.get("status")) ?? "draft") as "draft" | "published";
  const visibility = (str(formData.get("visibility")) ?? "internal_only") as
    | "internal_only"
    | "shared";

  const now = new Date();
  const setVals = {
    companyId,
    jobId,
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
  revalidatePath("/admin/candidates");
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

  const { subject, html } = buildCandidateInviteEmail({ name, token });
  await sendEmail({ to: email, subject, html });

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

export async function createJob(formData: FormData) {
  await requireAdmin();
  const db = await getD1Db();
  const companyId = str(formData.get("companyId"));
  const title = str(formData.get("title"));
  if (!companyId || !title) return;
  await db.insert(jobs).values({
    companyId,
    title,
    description: str(formData.get("description")),
    salaryMin: num(formData.get("salaryMin")),
    salaryMax: num(formData.get("salaryMax")),
    salaryCurrency: str(formData.get("salaryCurrency")) ?? "USD",
    location: str(formData.get("location")),
    workAuthRequirement: str(formData.get("workAuthRequirement")),
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
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .get();
  if (existing) redirect("/admin/employers?error=exists");

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

  const { subject, html } = buildEmployerCredentialsEmail({
    companyName: company.name,
    contactName,
    email,
    tempPassword,
  });
  await sendEmail({ to: email, subject, html });

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
  const { subject, html } = buildEmployerCredentialsEmail({
    companyName,
    email: u.email,
    tempPassword,
  });
  await sendEmail({ to: u.email, subject, html });

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
  revalidatePath("/admin/employers");
}

// --- Access grants (consent-gated) ---------------------------------------

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
}
