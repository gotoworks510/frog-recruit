import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireEmployer } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { employerAccounts } from "@/lib/db/schema";
import type { Session } from "next-auth";
import type { Database } from "@/lib/db/client";

/**
 * Employer guard that also enforces the forced-password-reset funnel.
 * Use on every employer page EXCEPT the password-change page itself.
 */
export async function requireEmployerReady(): Promise<{
  session: Session;
  db: Database;
}> {
  const session = await requireEmployer();
  const db = await getD1Db();
  const acct = await db
    .select({
      mustReset: employerAccounts.mustResetPassword,
      disabledAt: employerAccounts.disabledAt,
    })
    .from(employerAccounts)
    .where(eq(employerAccounts.userId, session.user.id))
    .get();

  if (acct?.disabledAt) redirect("/employer/login");
  if (acct?.mustReset) redirect("/portal/account/password");

  return { session, db };
}
