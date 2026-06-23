import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { requireCandidate } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { getCandidateByUserId, computeCompleteness } from "@/lib/candidate/profile";
import { candidateConsents } from "@/lib/db/schema";

export default async function CandidateHome() {
  const session = await requireCandidate();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          Welcome, {candidate.profile.displayName ?? session.user.name ?? "candidate"}
        </h1>
        <p className="mt-1 text-muted">
          Let's build a profile that resonates with hiring companies.
        </p>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink">Profile completeness</h2>
          <span className="text-lg font-bold text-primary">{completeness}%</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${completeness}%` }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/me/profile" className="btn-primary text-sm">
            Edit profile
          </Link>
          <Link
            href="/me/resume"
            className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2"
          >
            Upload resume
          </Link>
          <Link
            href="/me/preview"
            className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2"
          >
            See what employers see
          </Link>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-ink">Sharing status</h2>
        {consent ? (
          <p className="mt-2 text-sm text-muted">
            You've agreed to share your profile with hiring companies. When Frog
            recommends you, the referred companies can view your profile.
            <Link href="/me/sharing" className="ml-1 text-primary hover:underline">
              Sharing settings
            </Link>
          </p>
        ) : (
          <p className="mt-2 text-sm text-danger">
            Sharing with hiring companies is currently turned off.
            <Link href="/me/sharing" className="ml-1 text-primary hover:underline">
              Resume in Sharing settings
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
