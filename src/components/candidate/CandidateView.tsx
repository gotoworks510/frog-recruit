import type { EmployerCandidateView } from "@/lib/employer/candidate-dto";
import { WORK_AUTH_LABELS, ENGLISH_LABELS } from "@/lib/candidate/profile";
import { formatRange } from "@/lib/date";
import { Markdown } from "@/components/ui/Markdown";

interface CandidateViewProps {
  view: EmployerCandidateView;
  /** Audited resume route (employer) or self-view route. Omit to hide. */
  resumeHref?: string;
}

function salary(v: EmployerCandidateView): string | null {
  if (!v.desiredSalaryMin && !v.desiredSalaryMax) return null;
  const fmt = (n: number) => n.toLocaleString("en-US");
  const lo = v.desiredSalaryMin ? fmt(v.desiredSalaryMin) : "";
  const hi = v.desiredSalaryMax ? fmt(v.desiredSalaryMax) : "";
  const range = lo && hi ? `${lo} – ${hi}` : lo || hi;
  return `${range} ${v.salaryCurrency}`;
}

export function CandidateView({ view, resumeHref }: CandidateViewProps) {
  const sal = salary(view);
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <h1 className="text-2xl font-bold text-ink">
          {view.displayName ?? "Candidate"}
        </h1>
        {view.headline && (
          <p className="mt-1 text-lg text-primary">{view.headline}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {view.yearsExperience != null && (
            <Tag>{view.yearsExperience} yrs experience</Tag>
          )}
          {view.workAuthStatus && (
            <Tag>Work authorization: {WORK_AUTH_LABELS[view.workAuthStatus] ?? view.workAuthStatus}</Tag>
          )}
          {view.englishLevel && (
            <Tag>English: {ENGLISH_LABELS[view.englishLevel] ?? view.englishLevel}</Tag>
          )}
          {view.locationCurrent && <Tag>Current: {view.locationCurrent}</Tag>}
          {view.locationPreference && <Tag>Preferred: {view.locationPreference}</Tag>}
          {view.availability && <Tag>Availability: {view.availability}</Tag>}
          {sal && <Tag>Desired salary: {sal}</Tag>}
        </div>
        {view.summary && (
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink">
            {view.summary}
          </p>
        )}
        {(resumeHref && view.hasResume) && (
          <a
            href={resumeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-md border border-line px-4 py-2 text-sm font-medium text-primary hover:bg-surface-2"
          >
            View resume (PDF)
          </a>
        )}
      </div>

      {/* Frog recommendation */}
      {view.recommendation && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="text-sm font-bold text-emerald-800">
              Why Frog recommends this candidate
            </h2>
            <Markdown className="mt-2 text-sm text-emerald-900">
              {view.recommendation.strengthsMd || "(None provided)"}
            </Markdown>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-sm font-bold text-amber-800">Points to consider</h2>
            <Markdown className="mt-2 text-sm text-amber-900">
              {view.recommendation.considerationsMd || "(None provided)"}
            </Markdown>
          </div>
        </div>
      )}

      {/* Experience */}
      {view.experiences.length > 0 && (
        <div className="card p-6">
          <h2 className="mb-4 font-semibold text-ink">Experience</h2>
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
        </div>
      )}

      {/* Links */}
      {view.links.length > 0 && (
        <div className="card p-6">
          <h2 className="mb-3 font-semibold text-ink">Links</h2>
          <ul className="space-y-1 text-sm">
            {view.links.map((l) => (
              <li key={l.id}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {l.label ?? l.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-surface-2 px-3 py-1 text-frog-dark">
      {children}
    </span>
  );
}
