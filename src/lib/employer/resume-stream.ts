import { eq } from "drizzle-orm";
import { candidateProfiles } from "@/lib/db/schema";
import { getEffectiveGrant } from "@/lib/auth/grant";
import { getObject } from "@/lib/storage/r2";
import { writeAudit } from "@/lib/audit/log";
import type { Database } from "@/lib/db/client";

export type ResumeStreamResult =
  | { ok: true; response: Response }
  | { ok: false; reason: "forbidden" | "not_found" };

/**
 * Employer resume delivery: effective-access check → R2 fetch →
 * `download_resume` audit → original PDF stream. No durable URL is ever created.
 *
 * Returns a discriminated result so the Web route and the mobile API can each
 * format their own error body while sharing this one path.
 */
export async function streamEmployerResume(
  db: Database,
  params: {
    employerUserId: string;
    profileId: string;
    /** Session company id; falls back to the grant's company when absent. */
    companyId?: string | null;
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
    response: new Response(object.body as ReadableStream, { headers }),
  };
}
