import type { EmployerCandidateView } from "@/lib/employer/candidate-dto";
import { WORK_AUTH_LABELS, ENGLISH_LABELS } from "@/lib/candidate/profile";
import { formatRange } from "@/lib/date";
import { Markdown } from "@/components/ui/Markdown";

interface CandidateViewProps {
  view: EmployerCandidateView;
  /** Audited resume route (employer) or self-view route. Omit to hide. */
  resumeHref?: string;
  /** Preview banner context for candidate self-view. */
  mode?: "employer" | "preview";
  /** Shown in breadcrumb on employer detail (e.g. company name). */
  companyName?: string | null;
}

function salary(v: EmployerCandidateView): string | null {
  if (!v.desiredSalaryMin && !v.desiredSalaryMax) return null;
  const fmt = (n: number) => n.toLocaleString("en-US");
  const lo = v.desiredSalaryMin ? fmt(v.desiredSalaryMin) : "";
  const hi = v.desiredSalaryMax ? fmt(v.desiredSalaryMax) : "";
  const range = lo && hi ? `${lo} – ${hi}` : lo || hi;
  return `${range} ${v.salaryCurrency}`;
}

function plainExcerpt(md: string | null | undefined, max = 160): string | null {
  if (!md) return null;
  const plain = md
    .replace(/[#>*_`\[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return null;
  return plain.length > max ? `${plain.slice(0, max).trim()}…` : plain;
}

export function CandidateView({
  view,
  resumeHref,
  mode = "employer",
  companyName,
}: CandidateViewProps) {
  const sal = salary(view);
  const firstName =
    (view.displayName ?? "this candidate").trim().split(/\s+/)[0] ??
    "this candidate";
  const workAuth = view.workAuthStatus
    ? WORK_AUTH_LABELS[view.workAuthStatus] ?? view.workAuthStatus
    : null;

  const stats: Array<{ label: string; value: string }> = [];
  if (view.yearsExperience != null) {
    stats.push({
      label: "Experience",
      value: `${view.yearsExperience} years`,
    });
  }
  if (workAuth) {
    stats.push({ label: "Work authorization", value: workAuth });
  }
  if (view.locationPreference) {
    stats.push({ label: "Preferred location", value: view.locationPreference });
  }

  const extraMeta: Array<{ label: string; value: string }> = [];
  if (view.englishLevel) {
    extraMeta.push({
      label: "English",
      value: ENGLISH_LABELS[view.englishLevel] ?? view.englishLevel,
    });
  }
  if (view.locationCurrent) {
    extraMeta.push({ label: "Current location", value: view.locationCurrent });
  }
  if (view.availability) {
    extraMeta.push({ label: "Availability", value: view.availability });
  }
  if (sal) {
    extraMeta.push({ label: "Desired salary", value: sal });
  }
  if (view.visaNotes) {
    extraMeta.push({ label: "Visa notes", value: view.visaNotes });
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="label-caps">
          {mode === "preview"
            ? "Shared profile / Preview"
            : companyName
              ? `Introduced by Frog / For ${companyName}`
              : "Introduced by Frog"}
        </p>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-brand sm:text-4xl">
          {view.displayName ?? "Candidate"}
        </h1>
        {view.headline && (
          <p className="mt-2 text-lg text-frog">{view.headline}</p>
        )}

        {stats.length > 0 && (
          <dl className="mt-6 grid gap-4 border-y border-line py-5 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="label-caps">{s.label}</dt>
                <dd className="mt-1.5 text-sm font-medium text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {view.summary && (
          <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-ink">
            {view.summary}
          </p>
        )}

        {extraMeta.length > 0 && (
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {extraMeta.map((m) => (
              <div key={m.label} className="text-sm">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {m.label}
                </dt>
                <dd className="mt-0.5 text-ink">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {view.recommendation && (
        <section className="rounded-2xl bg-mint px-6 py-7 sm:px-8">
          <p className="label-caps text-frog-dark/70">Frog&apos;s perspective</p>
          <h2 className="mt-2 font-heading text-2xl font-semibold text-brand">
            Why we recommend {firstName}
          </h2>
          <div className="mt-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-ink">Strengths</h3>
              <Markdown className="mt-2 text-sm text-ink/90">
                {view.recommendation.strengthsMd || "(None provided)"}
              </Markdown>
            </div>
            <div className="border-t border-frog-dark/10 pt-5">
              <h3 className="text-sm font-semibold text-ink">
                Points to consider
              </h3>
              <Markdown className="mt-2 text-sm text-ink/90">
                {view.recommendation.considerationsMd || "(None provided)"}
              </Markdown>
            </div>
          </div>
        </section>
      )}

      {(resumeHref && view.hasResume) && (
        <section>
          <h2 className="text-lg font-semibold text-ink">Profile & resume</h2>
          <p className="mt-1 text-sm text-muted">
            Review the candidate&apos;s experience alongside Frog&apos;s
            recommendation.
          </p>
          <a
            href={resumeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex text-sm font-semibold text-frog hover:underline"
          >
            View watermarked resume ↗
          </a>
        </section>
      )}

      {view.experiences.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-ink">Experience</h2>
          <div className="space-y-5">
            {view.experiences.map((e) => (
              <div key={e.id} className="border-l-2 border-line pl-4">
                <p className="font-semibold text-ink">
                  {e.title} <span className="text-muted">@ {e.company}</span>
                </p>
                <p className="text-xs text-muted">
                  {formatRange(e.startDate, e.endDate, e.isCurrent)}
                  {e.location ? ` · ${e.location}` : ""}
                </p>
                {e.description && (
                  <p className="mt-2 whitespace-pre-line text-sm text-ink">
                    {e.description}
                  </p>
                )}
                {e.techStack && (
                  <p className="mt-1.5 text-xs text-frog-dark">{e.techStack}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {view.links.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">Links</h2>
          <ul className="space-y-1 text-sm">
            {view.links.map((l) => (
              <li key={l.id}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-frog hover:underline"
                >
                  {l.label ?? l.url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mode === "preview" && (
        <p className="text-xs text-muted">
          Only companies Frog has referred you to can access your shared
          profile, with your consent.
        </p>
      )}
    </div>
  );
}

/** Plain-text excerpt of recommendation strengths for list cards. */
export function recommendationExcerpt(
  strengthsMd: string | null | undefined,
  max = 140
): string | null {
  return plainExcerpt(strengthsMd, max);
}
