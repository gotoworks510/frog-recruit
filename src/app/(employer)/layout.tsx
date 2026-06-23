import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireEmployer } from "@/lib/auth/helpers";
import { signOut } from "@/lib/auth/auth";
import { getD1Db } from "@/lib/db/client";
import { employerAccounts, companies } from "@/lib/db/schema";
import { Logo } from "@/components/brand/Logo";

export default async function EmployerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireEmployer();
  const db = await getD1Db();

  const acct = await db
    .select({
      disabledAt: employerAccounts.disabledAt,
      companyName: companies.name,
    })
    .from(employerAccounts)
    .leftJoin(companies, eq(employerAccounts.companyId, companies.id))
    .where(eq(employerAccounts.userId, session.user.id))
    .get();

  // Disabled accounts are signed out immediately.
  if (acct?.disabledAt) {
    await signOut({ redirectTo: "/employer/login" });
  }

  // Note: the forced-password-reset funnel is enforced per-page via
  // requireEmployerReady() (see src/lib/employer/guard.ts), not here, so the
  // password page can render inside this layout without a redirect loop.

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/portal">
              <Logo variant="green" height={28} />
            </Link>
            <span className="text-sm text-muted">
              {acct?.companyName ?? "Employer"} Portal
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/portal/account/password" className="text-muted hover:text-ink">
              Change password
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/employer/login" });
              }}
            >
              <button className="text-muted hover:text-ink">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="py-8 text-center text-xs text-muted">
        The candidate information on this screen is confidential. Please do not share or redistribute it to third parties.
      </footer>
    </div>
  );
}
