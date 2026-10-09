import Link from "next/link";
import { and, eq, isNull, desc, inArray, or } from "drizzle-orm";
import { requireCandidate } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { getCandidateByUserId, computeCompleteness } from "@/lib/candidate/profile";
import {
  candidateConsents,
  candidateIntroductions,
  companies,
  jobs,
} from "@/lib/db/schema";
import { INTRO_STATUS_LABELS } from "@/lib/introductions/labels";
import type { IntroStatus } from "@/lib/db/schema/introductions";
import { roleNoticesForIntro } from "@/lib/introductions/close-notice";
import { formatDateTime } from "@/lib/date";
import { Logo } from "@/components/brand/Logo";
import { AppDownloadPrompt } from "@/components/brand/AppDownloadSection";

function cleanCompanyBlurb(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return raw
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim() || null;
}

function companySiteUrl(domain: string | null | undefined): string | null {
  if (!domain?.trim()) return null;
  const d = domain.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return d ? `https://${d}` : null;
}

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

  const intros = await db
    .select({
      id: candidateIntroductions.id,
      status: candidateIntroductions.status,
      statusNote: candidateIntroductions.statusNote,
      updatedAt: candidateIntroductions.updatedAt,
      companyId: companies.id,
      companyName: companies.name,
      companyDomain: companies.domain,
      companyDescription: companies.description,
    })
    .from(candidateIntroductions)
    .innerJoin(companies, eq(candidateIntroductions.companyId, companies.id))
    .where(eq(candidateIntroductions.candidateProfileId, candidate.profile.id))
    .orderBy(desc(candidateIntroductions.updatedAt))
    .all();

  const companyIds = [...new Set(intros.map((i) => i.companyId))];
  const companyJobs =
    companyIds.length === 0
      ? []
      : await db
          .select({
            companyId: jobs.companyId,
            title: jobs.title,
            location: jobs.location,
            status: jobs.status,
            closeNotice: jobs.closeNotice,
          })
          .from(jobs)
          .where(
            and(
              inArray(jobs.companyId, companyIds),
              or(eq(jobs.status, "open"), eq(jobs.closeNotice, true))
            )
          )
          .all();

  const jobsByCompany = new Map<string, { title: string; location: string | null }[]>();
  for (const job of companyJobs) {
    if (job.status !== "open" || job.closeNotice) continue;
    const list = jobsByCompany.get(job.companyId) ?? [];
    list.push({ title: job.title, location: job.location });
    jobsByCompany.set(job.companyId, list);
  }

  const noticesFor = (row: (typeof intros)[number]) =>
    roleNoticesForIntro({
      introStatus: row.status,
      companyName: row.companyName,
      jobs: companyJobs.filter((job) => job.companyId === row.companyId),
    });
  const introductionsCongratulated =
    intros.length > 0 &&
    intros.every((row) => {
      const open = (jobsByCompany.get(row.companyId) ?? []).length > 0;
      const notices = noticesFor(row);
      return !open && notices.length > 0 && notices.every((n) => n.tone === "hired");
    });
  const introductionsWrappedUp =
    !introductionsCongratulated &&
    intros.length > 0 &&
    intros.every((row) => {
      const open = (jobsByCompany.get(row.companyId) ?? []).length > 0;
      const notices = noticesFor(row);
      return !open && notices.some((n) => n.tone === "closed");
    });

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
        </div>
        <Link href="/me/preview" className="btn-outline shrink-0 text-sm">
          Preview your profile ↗
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl bg-brand text-white shadow-sm">
        <div className="border-b border-white/10 px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <Logo variant="white" height={28} />
                <p className="text-[11px] font-semibold tracking-[0.14em] text-white/60 uppercase">
                  Introduced by Frog
                </p>
              </div>
              <h2 className="mt-5 font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                {intros.length === 0
                  ? "Frog will open doors for you here."
                  : introductionsCongratulated
                    ? "Congratulations."
                  : introductionsWrappedUp
                    ? intros.length === 1
                      ? "Thank you. This introduction has wrapped up."
                      : "Thank you. These introductions have wrapped up."
                    : intros.length === 1
                      ? "Frog is introducing you to this company."
                      : `Frog is introducing you to ${intros.length} companies.`}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/75 sm:text-lg">
                {introductionsCongratulated
                  ? "You were selected for this role. Thank you for going through it with Frog."
                  : introductionsWrappedUp
                  ? "The role Frog connected you to has closed. If another opportunity comes up, we hope to be in touch again."
                  : "These introductions only exist because Frog brought you to the table. Without Frog's referral, these hiring teams would not be reviewing your profile. Stay close to your Frog representative as things move forward."}
              </p>
            </div>
            <Link
              href="/me/sharing"
              className="shrink-0 text-sm font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline"
            >
              Sharing settings →
            </Link>
          </div>
        </div>

        <div className="bg-mint/95 px-4 py-5 sm:px-6 sm:py-6">
          {intros.length === 0 ? (
            <div className="rounded-xl border border-frog-dark/10 bg-paper px-5 py-8 text-center sm:px-8">
              <p className="font-heading text-xl font-semibold text-ink">
                No company introductions yet
              </p>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
                When Frog refers you to a hiring team, that company will appear
                here with context on who they are and where the introduction
                stands.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {intros.map((row) => {
                const blurb = cleanCompanyBlurb(row.companyDescription);
                const site = companySiteUrl(row.companyDomain);
                const relatedJobs =
                  row.status === "hired"
                    ? companyJobs
                        .filter((job) => job.companyId === row.companyId)
                        .map((job) => ({
                          title: job.title,
                          location: job.location,
                        }))
                    : (jobsByCompany.get(row.companyId) ?? []);
                const roleNotices = noticesFor(row);
                return (
                  <li
                    key={row.id}
                    className="rounded-xl border border-frog-dark/10 bg-paper p-5 shadow-sm sm:p-7"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-brand px-3 py-1 text-[11px] font-semibold tracking-wide text-white uppercase">
                            Via Frog
                          </span>
                          <span className="inline-flex items-center rounded-full bg-mint-deep px-3 py-1 text-xs font-semibold text-frog-dark">
                            {INTRO_STATUS_LABELS[row.status as IntroStatus] ??
                              row.status}
                          </span>
                        </div>

                        <h3 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                          {row.companyName}
                        </h3>

                        {blurb && (
                          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink/80">
                            {blurb}
                          </p>
                        )}

                        {relatedJobs.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <p className="text-xs font-semibold tracking-[0.1em] text-muted uppercase">
                              Role Frog connected you to
                            </p>
                            {relatedJobs.map((job) => (
                              <div key={job.title + (job.location ?? "")}>
                                <p className="font-medium text-ink">
                                  {job.title}
                                </p>
                                {job.location && (
                                  <p className="mt-0.5 text-sm text-muted">
                                    {job.location}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {roleNotices.length > 0 && (
                          <div className="mt-4 space-y-3">
                            {roleNotices.map((notice) => (
                              <div
                                key={notice.tone + notice.title}
                                className="rounded-lg border border-frog-dark/15 bg-mint px-4 py-3"
                              >
                                <p className="text-xs font-semibold tracking-[0.1em] text-frog-dark uppercase">
                                  {notice.tone === "hired"
                                    ? "Congratulations"
                                    : "This role has closed"}
                                </p>
                                <p className="mt-2 text-sm leading-relaxed text-ink/85">
                                  {notice.message}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {row.statusNote && (
                          <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink/80">
                            {row.statusNote}
                          </p>
                        )}

                        {((jobsByCompany.get(row.companyId) ?? []).length > 0 ||
                          roleNotices.length === 0) && (
                          <p className="mt-5 text-sm font-medium text-frog-dark">
                            Frog recommended you to {row.companyName}. Keep your
                            Frog contact in the loop — they are your bridge to this
                            team.
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col gap-3 lg:items-end lg:text-right">
                        {site && (
                          <a
                            href={site}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-outline text-sm"
                          >
                            Company website ↗
                          </a>
                        )}
                        <p className="text-xs text-muted">
                          Updated {formatDateTime(row.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

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

      <AppDownloadPrompt variant="candidate" />
    </div>
  );
}
