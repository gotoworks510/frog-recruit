import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireEmployer } from "@/lib/auth/helpers";
import { signOut } from "@/lib/auth/auth";
import { getD1Db } from "@/lib/db/client";
import { employerAccounts, companies } from "@/lib/db/schema";
import { BrandMark } from "@/components/brand/BrandMark";
import { SiteFooter } from "@/components/brand/SiteFooter";
import { ViewAsBanner } from "@/components/admin/ViewAsBanner";
import { isViewAsSession } from "@/lib/auth/view-as";
import { exitViewAs } from "@/lib/admin/actions";

export default async function EmployerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireEmployer();
  const previewing = isViewAsSession(session);
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

  // Disabled accounts are signed out immediately (but not during admin preview).
  if (acct?.disabledAt && !previewing) {
    await signOut({ redirectTo: "/employer/login" });
  }

  // Note: the forced-password-reset funnel is enforced per-page via
  // requireEmployerReady() (see src/lib/employer/guard.ts), not here, so the
  // password page can render inside this layout without a redirect loop.

  const companyName = acct?.companyName ?? "Employer";

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      {previewing && <ViewAsBanner session={session} />}
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5">
          <BrandMark href="/portal" variant="white" logoHeight={28} />
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-white/80 sm:inline">{companyName}</span>
            <Link
              href="/portal/roles"
              className="text-white/80 transition hover:text-white"
            >
              Roles
            </Link>
            <Link
              href="/portal/fees"
              className="text-white/80 transition hover:text-white"
            >
              Fees
            </Link>
            {!previewing && (
              <Link
                href="/portal/account/password"
                className="text-white/80 transition hover:text-white"
              >
                Account
              </Link>
            )}
            {previewing ? (
              <form action={exitViewAs}>
                <button className="text-white/80 transition hover:text-white">
                  Back to admin
                </button>
              </form>
            ) : (
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/employer/login" });
                }}
              >
                <button className="text-white/80 transition hover:text-white">
                  Sign out
                </button>
              </form>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter
        noteLeft="Built on about 12 years of overseas career support."
        noteRight="Private to your company. Please do not redistribute candidate information."
      />
    </div>
  );
}
