import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { SiteFooter } from "@/components/brand/SiteFooter";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-surface text-ink">
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <BrandMark href="/" variant="white" logoHeight={32} />
          <nav className="flex items-center gap-2 text-sm sm:gap-3">
            <Link
              href="/login"
              className="rounded-md px-3 py-2 font-medium text-white/85 transition hover:text-white"
            >
              Candidate login
            </Link>
            <Link
              href="/employer/login"
              className="rounded-md bg-surface px-4 py-2 font-semibold text-brand transition hover:bg-white"
            >
              Employer login
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-2 lg:items-center lg:gap-14 lg:py-20">
        <div>
          <p className="label-caps">Rooted in Vancouver. Connected to Japan.</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold leading-[1.15] tracking-tight sm:text-5xl">
            Good introductions start with{" "}
            <em className="italic">knowing people.</em>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted">
            Frog has spent about 12 years supporting Japanese professionals
            building careers abroad. Recruit is where we make considered
            introductions — with context, consent, and care.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/employer/login" className="btn-primary px-6 py-3 text-base">
              Employer login ↗
            </Link>
            <Link
              href="/login"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Candidate login →
            </Link>
          </div>
          <p className="mt-5 text-xs text-muted">
            A private introduction portal. Access is provided by Frog.
          </p>
        </div>

        <div className="rounded-2xl bg-brand px-7 py-8 text-white shadow-lg sm:px-9 sm:py-10">
          <p className="label-caps text-white/55">The Frog introduction</p>
          <h2 className="mt-3 font-heading text-2xl font-semibold leading-snug sm:text-3xl">
            A person. A perspective. A reason to connect.
          </h2>
          <ol className="mt-8 space-y-6">
            {[
              {
                n: "01",
                title: "Get to know the person",
                body: "Experience, goals, and the story behind the resume.",
              },
              {
                n: "02",
                title: "Add our perspective",
                body: "Why Frog recommends them — and what to keep in mind.",
              },
              {
                n: "03",
                title: "Make a considered introduction",
                body: "Shared with companies only with the candidate's consent.",
              },
            ].map((step) => (
              <li key={step.n} className="flex gap-4">
                <span className="font-heading text-lg font-semibold text-mint-deep">
                  {step.n}
                </span>
                <div>
                  <p className="font-semibold">{step.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/70">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="label-caps">People behind the platform</p>
          <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
            A community built over time.
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              {
                value: "650+",
                label: "people across our overseas career support and community",
              },
              {
                value: "~220",
                label: "companies in the Frog network",
              },
              {
                value: "~12 years",
                label: "of supporting careers abroad",
              },
            ].map((stat) => (
              <div key={stat.value}>
                <p className="font-heading text-4xl font-semibold text-brand sm:text-5xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-2 lg:gap-14">
        <div>
          <p className="label-caps">Why this community</p>
          <h2 className="mt-2 font-heading text-3xl font-semibold leading-snug tracking-tight">
            Careers cross borders. Context should, too.
          </h2>
        </div>
        <div className="space-y-4 text-base leading-relaxed text-muted">
          <p>
            People moving from Japan to Canada and North America need more than
            a job board — they need someone who understands both sides of the
            move. Employers need introductions that come with judgment, not just
            résumés.
          </p>
          <p>
            Frog Recruit is the private portal where those introductions happen:
            curated profiles, Frog&apos;s written perspective, and access only for
            the companies we refer candidates to.
          </p>
          <p className="pt-2">
            <Link
              href="/login"
              className="font-semibold text-primary hover:underline"
            >
              Already invited? Prepare your profile →
            </Link>
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
