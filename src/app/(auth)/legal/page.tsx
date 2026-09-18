import Link from "next/link";
import { redirect } from "next/navigation";
import { requireLoggedInPreTerms, roleHome } from "@/lib/auth/helpers";
import { signOut } from "@/lib/auth/auth";
import { getD1Db } from "@/lib/db/client";
import { acceptTerms } from "@/lib/legal/accept-core";
import { TERMS_VERSION } from "@/lib/legal/terms";
import { Logo } from "@/components/brand/Logo";

export default async function LegalAcceptPage() {
  const session = await requireLoggedInPreTerms();
  if (session.user.termsAcceptedAt) {
    redirect(roleHome(session.user.role));
  }

  async function agree() {
    "use server";
    const s = await requireLoggedInPreTerms();
    if (s.user.termsAcceptedAt) {
      redirect(roleHome(s.user.role));
    }
    const db = await getD1Db();
    await acceptTerms(db, s.user.id, TERMS_VERSION);
    redirect(roleHome(s.user.role));
  }

  async function decline() {
    "use server";
    const s = await requireLoggedInPreTerms();
    const login =
      s.user.role === "employer" ? "/employer/login" : "/login";
    await signOut({ redirectTo: login });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-paper p-8 shadow-sm ring-1 ring-line">
        <div className="mb-6 flex justify-center">
          <Logo variant="green" height={36} />
        </div>
        <h1 className="text-xl font-bold text-ink">
          Terms of Use &amp; Privacy Policy
        </h1>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            Before you continue, please review and accept Frog Recruit&apos;s
            Terms of Use and Privacy Policy. This is required once for your
            account.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <Link
                href="/terms"
                target="_blank"
                className="font-semibold text-primary hover:underline"
              >
                Terms of Use
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                target="_blank"
                className="font-semibold text-primary hover:underline"
              >
                Privacy Policy
              </Link>
            </li>
          </ul>
          <p>
            If you do not agree, you will be signed out and cannot use the
            portal.
          </p>
        </div>
        <form action={agree} className="mt-6">
          <button type="submit" className="btn-primary w-full px-6 py-3">
            I agree — continue
          </button>
        </form>
        <form action={decline} className="mt-3">
          <button
            type="submit"
            className="w-full rounded-md border border-line px-6 py-3 text-sm font-semibold text-muted transition hover:bg-surface hover:text-ink"
          >
            I do not agree — sign out
          </button>
        </form>
        <p className="mt-3 text-center text-xs text-muted">
          Document version {TERMS_VERSION}
        </p>
      </div>
    </div>
  );
}
