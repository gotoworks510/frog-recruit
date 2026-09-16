import Link from "next/link";
import { FrogScoreBadge } from "@/components/employer/FrogScoreBadge";
import { Markdown } from "@/components/ui/Markdown";
import { DEMO_CANDIDATES, DEMO_COMPANY } from "@/lib/demo/mock-data";
import { INTEREST_OPTIONS } from "@/lib/employer/feedback";

const alex = DEMO_CANDIDATES[0];

export default function DemoEmployerCandidatePage() {
  return (
    <div className="space-y-6">
      <Link
        href="/demo/employer"
        className="text-sm font-medium text-muted transition hover:text-ink"
      >
        ← Back to introductions
      </Link>

      <header className="space-y-3">
        <p className="label-caps">
          Introduced by Frog / For {DEMO_COMPANY.name}
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-brand sm:text-4xl">
              {alex.displayName}
            </h1>
            <p className="mt-1 text-muted">{alex.headline}</p>
          </div>
          <FrogScoreBadge score={alex.frogScore} size="lg" />
        </div>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="text-sm">
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">
              Experience
            </dt>
            <dd className="mt-0.5 text-ink">{alex.yearsExperience} years</dd>
          </div>
          <div className="text-sm">
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">
              Work authorization
            </dt>
            <dd className="mt-0.5 text-ink">{alex.workAuth}</dd>
          </div>
          <div className="text-sm">
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">
              Preferred location
            </dt>
            <dd className="mt-0.5 text-ink">{alex.locationPreference}</dd>
          </div>
        </dl>
      </header>

      <section className="rounded-2xl bg-mint px-6 py-7 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="label-caps text-frog-dark/70">Frog&apos;s perspective</p>
            <h2 className="mt-2 font-heading text-2xl font-semibold text-brand">
              Why we recommend {alex.firstName}
            </h2>
          </div>
        </div>
        <div className="mt-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-ink">Strengths</h3>
            <Markdown className="mt-2 text-sm text-ink/90">
              {alex.strengths.map((s) => `- ${s}`).join("\n")}
            </Markdown>
          </div>
          <div className="border-t border-frog-dark/10 pt-5">
            <h3 className="text-sm font-semibold text-ink">Points to consider</h3>
            <Markdown className="mt-2 text-sm text-ink/90">
              {alex.considerations.map((s) => `- ${s}`).join("\n")}
            </Markdown>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">Experience</h2>
        <div className="mt-4 space-y-5">
          <div className="border-l-2 border-line pl-4">
            <p className="font-semibold text-ink">
              Senior Software Engineer{" "}
              <span className="text-muted">@ Northwind Labs</span>
            </p>
            <p className="text-xs text-muted">2021 – Present · Vancouver, BC</p>
            <p className="mt-2 text-sm text-ink">
              Owned billing and notification services in TypeScript. Reduced
              incident load with better observability and clearer ownership.
            </p>
            <p className="mt-1.5 text-xs text-frog-dark">
              TypeScript · Node.js · PostgreSQL · AWS
            </p>
          </div>
          <div className="border-l-2 border-line pl-4">
            <p className="font-semibold text-ink">
              Software Engineer <span className="text-muted">@ Cedar Soft</span>
            </p>
            <p className="text-xs text-muted">2018 – 2021 · Tokyo</p>
            <p className="mt-2 text-sm text-ink">
              Built internal APIs and admin tools for a B2B SaaS product.
            </p>
          </div>
        </div>
      </section>

      <section className="card p-5 shadow-sm sm:p-6">
        <p className="label-caps">Your next step</p>
        <h2 className="mt-2 text-lg font-semibold text-ink">
          Would you like to connect?
        </h2>
        <p className="mt-1 text-sm text-muted">
          Share your take with Frog after reviewing this introduction for{" "}
          {alex.displayName}.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((opt) => (
            <span
              key={opt.value}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                opt.value === "interested"
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-paper text-ink"
              }`}
            >
              {opt.label}
            </span>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">
          Demo only — feedback is not submitted from this page.
        </p>
      </section>
    </div>
  );
}
