import { desc, eq } from "drizzle-orm";
import { requireEmployerReady } from "@/lib/employer/guard";
import { jobs } from "@/lib/db/schema";

function statusLabel(status: "open" | "filled" | "closed"): string {
  if (status === "open") return "Open";
  if (status === "filled") return "Filled";
  return "Closed";
}

function salaryLabel(job: {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
}): string | null {
  if (job.salaryMin == null && job.salaryMax == null) return null;
  const min = job.salaryMin?.toLocaleString() ?? "—";
  const max = job.salaryMax?.toLocaleString() ?? "—";
  return `${min} – ${max} ${job.salaryCurrency}`;
}

/**
 * Read-only confirmation of roles Frog is working on for this company.
 * Edits stay on /admin/companies — employers confirm, Frog updates.
 */
export default async function EmployerRolesPage() {
  const { session, db } = await requireEmployerReady();
  const companyId = session.user.companyId;

  const rows = companyId
    ? await db
        .select({
          id: jobs.id,
          title: jobs.title,
          location: jobs.location,
          description: jobs.description,
          salaryMin: jobs.salaryMin,
          salaryMax: jobs.salaryMax,
          salaryCurrency: jobs.salaryCurrency,
          status: jobs.status,
        })
        .from(jobs)
        .where(eq(jobs.companyId, companyId))
        .orderBy(desc(jobs.createdAt))
        .all()
    : [];

  const ranked = [...rows].sort((a, b) => {
    const rank = { open: 0, filled: 1, closed: 2 } as const;
    return rank[a.status] - rank[b.status];
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Open roles</h1>
        <p className="mt-1 text-sm text-muted">
          Roles Frog is working from for your company. Contact your Frog
          representative to update a listing.
        </p>
      </div>

      {ranked.length === 0 ? (
        <div className="card p-6 text-sm text-muted">
          No roles are listed yet. Frog will add openings here when your search
          starts.
        </div>
      ) : (
        <ul className="space-y-3">
          {ranked.map((job) => (
            <li key={job.id} className="card space-y-2 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-ink">{job.title}</h2>
                <span className="text-xs font-semibold uppercase tracking-wide text-frog">
                  {statusLabel(job.status)}
                </span>
              </div>
              {job.location ? (
                <p className="text-sm text-muted">{job.location}</p>
              ) : null}
              {salaryLabel(job) ? (
                <p className="text-sm text-muted">{salaryLabel(job)}</p>
              ) : null}
              {job.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {job.description}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
