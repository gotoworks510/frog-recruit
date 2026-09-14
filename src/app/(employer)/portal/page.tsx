import Link from "next/link";
import { headers } from "next/headers";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireEmployerReady } from "@/lib/employer/guard";
import { listGrantedCandidateIds } from "@/lib/auth/grant";
import { candidateProfiles, companies, recommendations } from "@/lib/db/schema";
import { WORK_AUTH_LABELS } from "@/lib/candidate/profile";
import { writeAudit } from "@/lib/audit/log";
import { recommendationExcerpt } from "@/components/candidate/CandidateView";

export default async function EmployerPortal({
  searchParams,
}: {
  searchParams: Promise<{ readonly?: string }>;
}) {
  const { session, db } = await requireEmployerReady();
  const { readonly } = await searchParams;
  const companyId = session.user.companyId;

  const ids = await listGrantedCandidateIds(db, session.user.id);

  // Audit the list view.
  const hdrs = await headers();
  await writeAudit(db, {
    actorUserId: session.user.viewAs?.adminId ?? session.user.id,
    actorRole: session.user.viewAs ? "admin_view_as" : "employer",
    companyId: session.user.companyId,
    action: "view_list",
    ip: hdrs.get("cf-connecting-ip") || hdrs.get("x-forwarded-for"),
    userAgent: hdrs.get("user-agent"),
  });

  const company = companyId
    ? await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, companyId))
        .get()
    : null;
  const companyName = company?.name ?? "your company";

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

  // Published+shared recommendations for list excerpts (company-specific, else general).
  const recByProfile = new Map<string, string | null>();
  if (ids.length > 0) {
    const recs = await db
      .select({
        candidateProfileId: recommendations.candidateProfileId,
        companyId: recommendations.companyId,
        strengthsMd: recommendations.strengthsMd,
      })
      .from(recommendations)
      .where(
        and(
          inArray(recommendations.candidateProfileId, ids),
          eq(recommendations.status, "published"),
          eq(recommendations.visibility, "shared")
        )
      )
      .orderBy(desc(recommendations.updatedAt))
      .all();

    for (const id of ids) {
      const forProfile = recs.filter((r) => r.candidateProfileId === id);
      const pick =
        (companyId
          ? forProfile.find((r) => r.companyId === companyId)
          : undefined) ??
        forProfile.find((r) => r.companyId === null) ??
        forProfile[0];
      recByProfile.set(id, pick?.strengthsMd ?? null);
    }
  }

  const countLabel =
    rows.length === 1 ? "1 introduction" : `${rows.length} introductions`;

  return (
    <div className="space-y-8">
      {readonly && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          プレビューは読み取り専用です。変更操作はできません。
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-caps">
            {companyName} / Your introductions
          </p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-brand sm:text-4xl">
            People worth a conversation.
          </h1>
          <p className="mt-2 text-muted">
            Candidates selected by Frog and introduced to your company.
          </p>
        </div>
        {rows.length > 0 && (
          <span className="inline-flex w-fit rounded-full bg-mint px-3 py-1 text-xs font-semibold text-frog-dark">
            {countLabel}
          </span>
        )}
      </div>

      {rows.length > 0 && (
        <div className="rounded-lg border-l-4 border-brand bg-mint px-4 py-3 text-sm text-frog-dark">
          A considered introduction, with context. Read Frog&apos;s
          recommendation and points to discuss before sharing your feedback.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          There are no candidates available to view right now. Please wait for a
          referral from your Frog contact.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="hidden grid-cols-[1.2fr_1.4fr_auto] gap-6 px-1 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase lg:grid">
            <span>Introduced to {companyName}</span>
            <span>Frog&apos;s perspective</span>
            <span className="sr-only">Action</span>
          </div>
          {rows.map((c) => {
            const firstName =
              (c.displayName ?? "Candidate").trim().split(/\s+/)[0] ??
              "Candidate";
            const excerpt = recommendationExcerpt(recByProfile.get(c.id));
            return (
              <div
                key={c.id}
                className="card grid gap-5 p-5 lg:grid-cols-[1.2fr_1.4fr_auto] lg:items-center lg:gap-6 lg:p-6"
              >
                <div>
                  <p className="text-lg font-semibold text-ink">
                    {c.displayName ?? "Candidate"}
                  </p>
                  {c.headline && (
                    <p className="mt-0.5 text-sm text-muted">{c.headline}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.yearsExperience != null && (
                      <span className="rounded-full bg-mint px-2.5 py-1 text-xs font-medium text-frog-dark">
                        {c.yearsExperience} years&apos; experience
                      </span>
                    )}
                    {c.workAuthStatus && (
                      <span className="rounded-full bg-mint px-2.5 py-1 text-xs font-medium text-frog-dark">
                        {WORK_AUTH_LABELS[c.workAuthStatus] ?? c.workAuthStatus}
                      </span>
                    )}
                  </div>
                  {c.locationPreference && (
                    <p className="mt-2 text-xs text-muted">
                      Preferred: {c.locationPreference}
                    </p>
                  )}
                </div>

                <div>
                  <p className="label-caps text-frog-dark/70">
                    Why Frog recommends {firstName}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink">
                    {excerpt ??
                      "Open the introduction to read Frog's full recommendation."}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    Frog recommendation · Full introduction
                  </p>
                </div>

                <div className="lg:justify-self-end">
                  <Link
                    href={`/portal/candidates/${c.id}`}
                    className="btn-primary whitespace-nowrap text-sm"
                  >
                    View introduction →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
