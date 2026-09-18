import { eq } from "drizzle-orm";
import { candidateProfiles, companies, employerAccounts } from "@/lib/db/schema";
import { getEffectiveGrant } from "@/lib/auth/grant";
import { getObject } from "@/lib/storage/r2";
import { watermarkPdf, watermarkLine } from "@/lib/pdf/watermark";
import { writeAudit } from "@/lib/audit/log";
import type { Database } from "@/lib/db/client";

export type ResumeStreamResult =
  | { ok: true; response: Response }
  | { ok: false; reason: "forbidden" | "not_found" };

/**
 * Employer resume delivery: effective-access check → R2 fetch → per-request
 * watermark (company + viewer + timestamp) → `download_resume` audit → stream.
 * No durable URL is ever created.
 *
 * Returns a discriminated result so the Web route and the mobile API can each
 * format their own error body while sharing this one path.
 */
export async function buildWatermarkedResume(
  db: Database,
  params: {
    employerUserId: string;
    profileId: string;
    /** Session company id; falls back to employer_accounts when absent. */
    companyId?: string | null;
    viewerEmail: string;
    audit: {
      actorUserId: string;
      actorRole: string;
      ip: string | null;
      userAgent: string | null;
    };
  }
): Promise<ResumeStreamResult> {
  const { employerUserId, profileId } = params;

  const grant = await getEffectiveGrant(db, employerUserId, profileId);
  if (!grant || !grant.canDownloadResume) {
    return { ok: false, reason: "forbidden" };
  }

  const profile = await db
    .select({ resumeKey: candidateProfiles.resumeKey })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.id, profileId))
    .get();
  if (!profile?.resumeKey) return { ok: false, reason: "not_found" };

  const object = await getObject(profile.resumeKey);
  if (!object) return { ok: false, reason: "not_found" };

  const companyName = await resolveCompanyName(
    db,
    employerUserId,
    params.companyId ?? null
  );

  const original = await object.arrayBuffer();
  const stamped = await watermarkPdf(
    original,
    watermarkLine({
      companyName,
      viewerEmail: params.viewerEmail,
      isoTimestamp: new Date().toISOString(),
    })
  );

  await writeAudit(db, {
    actorUserId: params.audit.actorUserId,
    actorRole: params.audit.actorRole,
    companyId: params.companyId ?? grant.companyId,
    candidateProfileId: profileId,
    action: "download_resume",
    accessGrantId: grant.id,
    ip: params.audit.ip,
    userAgent: params.audit.userAgent,
  });

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", 'inline; filename="resume.pdf"');
  headers.set("Cache-Control", "no-store");
  return {
    ok: true,
    response: new Response(stamped as unknown as BodyInit, { headers }),
  };
}

async function resolveCompanyName(
  db: Database,
  employerUserId: string,
  companyId: string | null
): Promise<string> {
  let id = companyId;
  if (!id) {
    const acct = await db
      .select({ companyId: employerAccounts.companyId })
      .from(employerAccounts)
      .where(eq(employerAccounts.userId, employerUserId))
      .get();
    id = acct?.companyId ?? null;
  }
  if (!id) return "Frog Recruit";
  const company = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, id))
    .get();
  return company?.name || "Frog Recruit";
}
