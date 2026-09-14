import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { requireCandidate } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { getCandidateByUserId, computeCompleteness } from "@/lib/candidate/profile";
import { candidateConsents } from "@/lib/db/schema";

export default async function CandidateHome({
  searchParams,
}: {
  searchParams: Promise<{ readonly?: string }>;
}) {
  const session = await requireCandidate();
  const { readonly } = await searchParams;
  const db = await getD1Db();
  const candidate = await getCandidateByUserId(db, session.user.id);

  if (!candidate) {
    return (
      <p className="text-muted">
        Your profile is being set up. Please wait a moment and reload the page.
      </p>
    );
  }

  const completeness = computeCompleteness(candidate);
  const consent = await db
    .select({ id: candidateConsents.id })
    .from(candidateConsents)
    .where(
      and(
        eq(candidateConsents.candidateProfileId, candidate.profile.id),
        isNull(candidateConsents.revokedAt)
      )
    )
    .get();

  const firstName =
    (candidate.profile.displayName ?? session.user.name ?? "there")
      .trim()
      .split(/\s+/)[0] ?? "there";

  return (
    <div className="space-y-8">
      {readonly && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Preview is read-only. Changes are disabled while an admin is viewing
          as this candidate.
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-caps">Your career, with Frog</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-brand sm:text-4xl">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-2 text-muted">
            Let&apos;s make your experience clear to the right people.
          </p>
        </div>
        <Link href="/me/preview" className="btn-outline shrink-0 text-sm">
          Preview your profile ↗
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card flex flex-col p-6 sm:p-7">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink">Profile completeness</span>
            <span className="font-semibold text-brand">{completeness}%</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${completeness}%` }}
            />
          </div>
          <p className="label-caps mt-8">Your next step</p>
          <h2 className="mt-2 font-heading text-2xl font-semibold text-ink">
            Tell us what you want to do next.
          </h2>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
            Review your profile, from the experience you bring to the roles and
            locations you prefer.
          </p>
          <Link href="/me/profile" className="btn-primary mt-6 w-fit text-sm">
            Continue your profile →
          </Link>
        </div>

        <div className="flex flex-col rounded-xl bg-mint p-6 sm:p-7">
          <p className="label-caps text-frog-dark/70">Your sharing status</p>
          {consent ? (
            <>
              <span className="mt-3 inline-flex w-fit rounded-full bg-paper px-3 py-1 text-xs font-semibold text-frog-dark">
                Sharing consent given
              </span>
              <h2 className="mt-4 font-heading text-2xl font-semibold text-ink">
                Your profile has a defined audience.
              </h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/75">
                When Frog refers you to a company, that company can view your
                shared profile. Your profile is not publicly listed.
              </p>
            </>
          ) : (
            <>
              <span className="mt-3 inline-flex w-fit rounded-full bg-paper px-3 py-1 text-xs font-semibold text-danger">
                Sharing turned off
              </span>
              <h2 className="mt-4 font-heading text-2xl font-semibold text-ink">
                Companies can&apos;t see you yet.
              </h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/75">
                Sharing with hiring companies is currently turned off. Resume
                sharing when you&apos;re ready for Frog to make introductions.
              </p>
            </>
          )}
          <Link
            href="/me/sharing"
            className="mt-6 text-sm font-semibold text-primary hover:underline"
          >
            Review sharing settings →
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold text-ink">
            Bring your story together.
          </h2>
          <p className="mt-1 text-sm text-muted">
            Keep your resume current and check what employers can see.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/me/resume" className="btn-outline text-sm">
            Upload resume
          </Link>
          <Link href="/me/experience" className="btn-outline text-sm">
            Edit experience
          </Link>
        </div>
      </div>
    </div>
  );
}
