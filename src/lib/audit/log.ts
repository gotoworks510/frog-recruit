import { viewAudit } from "@/lib/db/schema";
import type { Database } from "@/lib/db/client";

export type AuditAction =
  | "view_list"
  | "view_detail"
  | "view_resume"
  | "download_resume"
  | "preview_pdf";

export interface AuditInput {
  actorUserId?: string | null;
  actorRole?: string | null;
  companyId?: string | null;
  candidateProfileId?: string | null;
  action: AuditAction;
  accessGrantId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Append a row to the immutable view audit. Best-effort: an audit write failure
 * must not block the user-facing read (but is logged server-side).
 */
export async function writeAudit(db: Database, input: AuditInput): Promise<void> {
  try {
    await db.insert(viewAudit).values({
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      companyId: input.companyId ?? null,
      candidateProfileId: input.candidateProfileId ?? null,
      action: input.action,
      accessGrantId: input.accessGrantId ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (e) {
    console.error("[audit] write failed:", e);
  }
}

/** Pull client IP + UA from a request for audit rows. */
export function auditMetaFromRequest(request: Request): {
  ip: string | null;
  userAgent: string | null;
} {
  return {
    ip:
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      null,
    userAgent: request.headers.get("user-agent"),
  };
}
