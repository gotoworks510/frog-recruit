import { and, eq, isNull, desc } from "drizzle-orm";
import { requireCandidate } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import {
  candidateProfiles,
  candidateConsents,
  accessGrants,
  companies,
  viewAudit,
} from "@/lib/db/schema";
import { revokeConsent, enableConsent } from "@/lib/candidate/actions";
import { formatDateTime } from "@/lib/date";

const AUDIT_LABEL: Record<string, string> = {
  view_list: "Viewed in list",
  view_detail: "Viewed details",
  view_resume: "Viewed resume",
  download_resume: "Downloaded resume",
  preview_pdf: "Opened resume",
};

export default async function SharingPage() {
  const session = await requireCandidate();
  const db = await getD1Db();
  const profile = await db
    .select({ id: candidateProfiles.id })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, session.user.id))
    .get();

  if (!profile) return <p className="text-muted">No profile found.</p>;

  const consent = await db
    .select({ id: candidateConsents.id })
    .from(candidateConsents)
    .where(
      and(
        eq(candidateConsents.candidateProfileId, profile.id),
        isNull(candidateConsents.revokedAt)
      )
    )
    .get();

  const grants = await db
    .select({
      id: accessGrants.id,
      companyName: companies.name,
      grantedAt: accessGrants.grantedAt,
      expiresAt: accessGrants.expiresAt,
      revokedAt: accessGrants.revokedAt,
    })
    .from(accessGrants)
    .innerJoin(companies, eq(accessGrants.companyId, companies.id))
    .where(eq(accessGrants.candidateProfileId, profile.id))
    .all();

  const recentViews = await db
    .select({
      action: viewAudit.action,
      createdAt: viewAudit.createdAt,
    })
    .from(viewAudit)
    .where(eq(viewAudit.candidateProfileId, profile.id))
    .orderBy(desc(viewAudit.createdAt))
    .limit(10)
    .all();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Sharing settings</h1>

      <div className="card p-6">
        <h2 className="font-semibold text-ink">Sharing with hiring companies</h2>
        {consent ? (
          <>
            <p className="mt-2 text-sm text-muted">
              You've agreed to share your profile with the hiring companies Frog refers you to.
            </p>
            <form action={revokeConsent} className="mt-4">
              <button className="rounded-md border border-danger px-4 py-2 text-sm font-medium text-danger hover:bg-red-50">
                Stop sharing
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-danger">
              Sharing with hiring companies is currently turned off. While it's off, no one can view your profile.
            </p>
            <form action={enableConsent} className="mt-4">
              <button className="btn-primary px-4 py-2 text-sm">Resume sharing</button>
            </form>
          </>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-ink">Companies that can view you</h2>
        {grants.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No companies have been granted access yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {grants.map((g) => {
              const inactive =
                g.revokedAt || (g.expiresAt && g.expiresAt.getTime() <= Date.now());
              return (
                <li
                  key={g.id}
                  className="flex items-center justify-between border-b border-line pb-2 last:border-0"
                >
                  <span className="text-ink">{g.companyName}</span>
                  <span className={`text-xs ${inactive ? "text-muted" : "text-frog-dark"}`}>
                    {inactive ? "Inactive" : "Active"}
                    {g.expiresAt ? ` · Expires ${formatDateTime(g.expiresAt)}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-ink">Recent view history</h2>
        {recentViews.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No view history yet.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {recentViews.map((v, i) => (
              <li key={i}>
                {formatDateTime(v.createdAt)} · {AUDIT_LABEL[v.action] ?? v.action}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
