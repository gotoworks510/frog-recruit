import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireCandidatePreConsent } from "@/lib/auth/helpers";
import { isViewAsSession } from "@/lib/auth/view-as";
import { getD1Db } from "@/lib/db/client";
import { candidateAccounts } from "@/lib/db/schema";
import type { Session } from "next-auth";
import type { Database } from "@/lib/db/client";

/**
 * Candidate session after role/status checks, before consent / must-reset.
 * Rejected users are sent to /rejected; non-approved to /pending.
 */
export async function requireCandidateSession(): Promise<Session> {
  const session = await requireCandidatePreConsent();
  if (session.user.status === "rejected") redirect("/rejected");
  if (session.user.status !== "approved") redirect("/pending");
  return session;
}

/**
 * Full candidate guard: session + forced password reset + privacy consent.
 * Use on every candidate page EXCEPT password change and /consent.
 */
export async function requireCandidateReady(): Promise<{
  session: Session;
  db: Database;
}> {
  const session = await requireCandidateSession();
  const db = await getD1Db();

  const acct = await db
    .select({
      mustReset: candidateAccounts.mustResetPassword,
      disabledAt: candidateAccounts.disabledAt,
    })
    .from(candidateAccounts)
    .where(eq(candidateAccounts.userId, session.user.id))
    .get();

  if (acct?.disabledAt && !isViewAsSession(session)) {
    redirect("/login");
  }
  if (acct?.mustReset && !isViewAsSession(session)) {
    redirect("/me/account/password");
  }
  if (!session.user.privacyConsentedAt) {
    redirect("/consent");
  }

  return { session, db };
}
