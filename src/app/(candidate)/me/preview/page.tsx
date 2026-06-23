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
    <div className="space-y-4">
      <div className="rounded-md bg-accent-soft p-4 text-sm text-frog-dark">
        This is a preview of what hiring companies will see. Frog's recommended
        strengths and points to consider appear only once Frog publishes and shares them.
      </div>
      {view ? (
        <>
          {!view.recommendation && (
            <p className="text-sm text-muted">
              Note: Frog's recommendation hasn't been published yet. Once it is, the strengths and points to consider will appear above.
            </p>
          )}
          <CandidateView view={view} resumeHref="/api/profile/resume" />
        </>
      ) : (
        <p className="text-muted">We couldn't generate a preview.</p>
      )}
    </div>
  );
}
