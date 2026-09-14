import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireCandidate } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { candidateProfiles } from "@/lib/db/schema";
import { buildEmployerCandidateView } from "@/lib/employer/candidate-dto";
import { CandidateView } from "@/components/candidate/CandidateView";

export default async function PreviewPage() {
  const session = await requireCandidate();
  const db = await getD1Db();
  const profile = await db
    .select({ id: candidateProfiles.id })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, session.user.id))
    .get();

  if (!profile) return <p className="text-muted">No profile found.</p>;

  const view = await buildEmployerCandidateView(db, profile.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg bg-mint px-4 py-3.5 text-sm text-frog-dark sm:flex-row sm:items-center sm:justify-between">
        <p>
          You&apos;re viewing your employer preview. This shows your shared
          profile. Frog&apos;s recommendation appears once published and shared.
        </p>
        <Link href="/me/profile" className="btn-outline shrink-0 bg-paper text-sm">
          Edit profile
        </Link>
      </div>

      {view ? (
        <>
          {!view.recommendation && (
            <p className="text-sm text-muted">
              Note: Frog&apos;s recommendation hasn&apos;t been published yet.
              Once it is, the strengths and points to consider will appear
              above.
            </p>
          )}
          <CandidateView
            view={view}
            resumeHref="/api/profile/resume"
            mode="preview"
          />
        </>
      ) : (
        <p className="text-muted">We couldn&apos;t generate a preview.</p>
      )}
    </div>
  );
}
