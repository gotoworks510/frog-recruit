import Link from "next/link";
import { FrogScoreBadge } from "@/components/employer/FrogScoreBadge";
import { DEMO_CANDIDATES, DEMO_COMPANY } from "@/lib/demo/mock-data";

export default function DemoEmployerPortalPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-caps">
            {DEMO_COMPANY.name} / Your introductions
          </p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-brand sm:text-4xl">
            People worth a conversation.
          </h1>
          <p className="mt-2 text-muted">
            Candidates selected by Frog and introduced to your company. Sorted
            by Frog score.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-mint px-3 py-1 text-xs font-semibold text-frog-dark">
          {DEMO_CANDIDATES.length} introductions
        </span>
      </div>

      <div className="rounded-lg border-l-4 border-brand bg-mint px-4 py-3 text-sm text-frog-dark">
        A considered introduction, with context. The Frog score is our fit
        rating for your role (out of 10). Read the full recommendation before
        sharing feedback.
      </div>

      <div className="space-y-3">
        {DEMO_CANDIDATES.map((c) => (
          <div
            key={c.id}
            className="card grid gap-5 p-5 lg:grid-cols-[1.2fr_1.4fr_auto] lg:items-center lg:gap-6 lg:p-6"
          >
            <div>
              <p className="text-lg font-semibold text-ink">{c.displayName}</p>
              <p className="mt-0.5 text-sm text-muted">{c.headline}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <FrogScoreBadge score={c.frogScore} />
                <span className="rounded-full bg-mint px-2.5 py-1 text-xs font-medium text-frog-dark">
                  {c.yearsExperience} years&apos; experience
                </span>
                <span className="rounded-full bg-mint px-2.5 py-1 text-xs font-medium text-frog-dark">
                  {c.workAuth}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted">
                Preferred: {c.locationPreference}
              </p>
            </div>
            <div>
              <p className="label-caps text-frog-dark/70">
                Why Frog recommends {c.firstName}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink">{c.excerpt}</p>
              <p className="mt-2 text-xs text-muted">
                Frog recommendation · Full introduction
              </p>
            </div>
            <div className="lg:justify-self-end">
              <Link
                href="/demo/employer/candidate"
                className="btn-primary whitespace-nowrap text-sm"
              >
                View introduction →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
