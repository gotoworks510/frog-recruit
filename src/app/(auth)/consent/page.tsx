import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { requireCandidatePreConsent } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { users, candidateProfiles, candidateConsents } from "@/lib/db/schema";
import { Logo } from "@/components/brand/Logo";

const CONSENT_VERSION = "2026-06-22";

export default async function ConsentPage() {
  const session = await requireCandidatePreConsent();
  if (session.user.privacyConsentedAt) redirect("/me");

  async function agree() {
    "use server";
    const s = await requireCandidatePreConsent();
    const db = await getD1Db();

    const profile = await db
      .select({ id: candidateProfiles.id })
      .from(candidateProfiles)
      .where(eq(candidateProfiles.userId, s.user.id))
      .get();

    const hdrs = await headers();
    const ip =
      hdrs.get("cf-connecting-ip") || hdrs.get("x-forwarded-for") || null;

    if (profile) {
      await db.insert(candidateConsents).values({
        candidateProfileId: profile.id,
        scope: "share_with_employers",
        consentTextVersion: CONSENT_VERSION,
        ipAtConsent: ip,
      });
    }

    await db
      .update(users)
      .set({ privacyConsentedAt: new Date() })
      .where(eq(users.id, s.user.id));

    redirect("/me");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-paper p-8 shadow-sm ring-1 ring-line">
        <div className="mb-6 flex justify-center">
          <Logo variant="green" height={36} />
        </div>
        <h1 className="text-xl font-bold text-ink">Consent to share your profile</h1>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            Frog Recruit shares the profile you create (work history, skills, work
            authorization, resume, and so on) with the hiring companies that Frog
            refers you to.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your profile is only shared with hiring companies that Frog refers you to.</li>
            <li>
              When an employer views your resume, it is watermarked with the viewer and timestamp, and the access is logged.
            </li>
            <li>
              You can withdraw your consent at any time from the Sharing settings page, and withdrawing it immediately stops employer access.
            </li>
          </ul>
        </div>
        <form action={agree} className="mt-6">
          <button type="submit" className="btn-primary w-full px-6 py-3">
            Agree and continue
          </button>
        </form>
        <p className="mt-3 text-center text-xs text-muted">
          Consent version {CONSENT_VERSION}
        </p>
      </div>
    </div>
  );
}
