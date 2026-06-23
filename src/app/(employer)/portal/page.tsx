import Link from "next/link";
import { headers } from "next/headers";
import { inArray } from "drizzle-orm";
import { requireEmployerReady } from "@/lib/employer/guard";
import { listGrantedCandidateIds } from "@/lib/auth/grant";
import { candidateProfiles } from "@/lib/db/schema";
import { WORK_AUTH_LABELS } from "@/lib/candidate/profile";
import { writeAudit } from "@/lib/audit/log";

export default async function EmployerPortal() {
  const { session, db } = await requireEmployerReady();

  const ids = await listGrantedCandidateIds(db, session.user.id);

  // Audit the list view.
  const hdrs = await headers();
  await writeAudit(db, {
    actorUserId: session.user.id,
    actorRole: "employer",
    companyId: session.user.companyId,
    action: "view_list",
    ip: hdrs.get("cf-connecting-ip") || hdrs.get("x-forwarded-for"),
    userAgent: hdrs.get("user-agent"),
  });

  const rows =
    ids.length > 0
      ? await db
          .select({
            id: candidateProfiles.id,
            displayName: candidateProfiles.displayName,
            headline: candidateProfiles.headline,
            yearsExperience: candidateProfiles.yearsExperience,
            workAuthStatus: candidateProfiles.workAuthStatus,
            locationPreference: candidateProfiles.locationPreference,
          })
          .from(candidateProfiles)
          .where(inArray(candidateProfiles.id, ids))
          .all()
      : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Referred candidates</h1>
        <p className="mt-1 text-sm text-muted">
          Candidates Frog has referred to your company.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          There are no candidates available to view right now. Please wait for a referral from your Frog contact.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((c) => (
            <Link
              key={c.id}
              href={`/portal/candidates/${c.id}`}
              className="card block p-5 transition hover:border-primary hover:shadow-sm"
            >
              <p className="font-semibold text-ink">
                {c.displayName ?? "Candidate"}
              </p>
              {c.headline && (
                <p className="text-sm text-primary">{c.headline}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-frog-dark">
                {c.yearsExperience != null && (
                  <span className="rounded-full bg-surface-2 px-2.5 py-1">
                    {c.yearsExperience} yrs experience
                  </span>
                )}
                {c.workAuthStatus && (
                  <span className="rounded-full bg-surface-2 px-2.5 py-1">
                    {WORK_AUTH_LABELS[c.workAuthStatus] ?? c.workAuthStatus}
                  </span>
                )}
                {c.locationPreference && (
                  <span className="rounded-full bg-surface-2 px-2.5 py-1">
                    {c.locationPreference}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
