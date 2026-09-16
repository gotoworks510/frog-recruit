import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { SiteFooter } from "@/components/brand/SiteFooter";

const STEPS_SHARED = [
  {
    n: "01",
    title: "Frog selects people and companies",
    body: "This is not an open job board. Frog decides who to introduce to whom, based on years of community context.",
  },
  {
    n: "02",
    title: "Both sides get a private portal",
    body: "Candidates prepare a profile and turn sharing on. Employers receive login access only for the people Frog introduced.",
  },
  {
    n: "03",
    title: "Frog adds judgment, then you decide",
    body: "Employers see Frog’s score and written perspective. Candidates see which company Frog opened the door to. Frog stays in the middle for next steps.",
  },
] as const;

const GUIDE_SHOTS = [
  {
    src: "/guide/employer-list.png",
    alt: "Demo employer portal listing fictional candidates with Frog scores",
    caption: "Employer home — introductions sorted by Frog score",
    href: "/demo/employer",
  },
  {
    src: "/guide/employer-detail.png",
    alt: "Demo employer candidate detail with Frog recommendation and feedback choices",
    caption: "Employer detail — Frog perspective + your next step",
    href: "/demo/employer/candidate",
  },
  {
    src: "/guide/candidate-home.png",
    alt: "Demo candidate home showing a Frog introduction to a fictional company",
    caption: "Candidate home — companies Frog introduced you to",
    href: "/demo/candidate",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-surface text-ink">
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <BrandMark href="/" variant="white" logoHeight={32} />
          <nav className="flex items-center gap-2 text-sm sm:gap-3">
            <Link
              href="/"
              className="rounded-md px-3 py-2 font-medium text-white/85 transition hover:text-white"
            >
              Home
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

      <section className="mx-auto max-w-6xl px-6 py-14 lg:py-16">
        <p className="label-caps">Product guide</p>
        <h1 className="mt-3 max-w-3xl font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          How Frog Recruit works
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
          A short tour of the path from Frog introduction to employer feedback.
          Screenshots below use <strong className="font-semibold text-ink">fictional
          demo data only</strong> — no real candidate or company names.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/demo/employer" className="btn-primary text-sm">
            Open employer demo
          </Link>
          <Link href="/demo/candidate" className="btn-outline text-sm">
            Open candidate demo
          </Link>
        </div>
      </section>

      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="label-caps">The shared path</p>
          <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
            Three roles. One private introduction.
          </h2>
          <ol className="mt-10 grid gap-8 lg:grid-cols-3">
            {STEPS_SHARED.map((s) => (
              <li key={s.n}>
                <p className="font-heading text-lg font-semibold text-brand">
                  {s.n}
                </p>
                <h3 className="mt-2 font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="label-caps">For employers</p>
            <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
              See who Frog is putting in front of you
            </h2>
            <ol className="mt-6 space-y-5 text-sm leading-relaxed text-muted">
              <li>
                <span className="font-semibold text-ink">1. Log in to your portal.</span>{" "}
                Only candidates Frog granted to your company appear.
              </li>
              <li>
                <span className="font-semibold text-ink">2. Scan Frog scores.</span>{" "}
                The list is sorted by Frog’s fit rating for your mandate.
              </li>
              <li>
                <span className="font-semibold text-ink">3. Open an introduction.</span>{" "}
                Read strengths, points to consider, experience, and resume.
              </li>
              <li>
                <span className="font-semibold text-ink">4. Tell Frog your take.</span>{" "}
                Interested / Maybe / Not interested — Frog follows up. You don’t
                cold-email the candidate.
              </li>
            </ol>
          </div>
          <div>
            <p className="label-caps">For candidates</p>
            <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
              Know which door Frog opened
            </h2>
            <ol className="mt-6 space-y-5 text-sm leading-relaxed text-muted">
              <li>
                <span className="font-semibold text-ink">1. Accept your invite and log in.</span>{" "}
                Complete profile, experience, links, and resume.
              </li>
              <li>
                <span className="font-semibold text-ink">2. Turn sharing on.</span>{" "}
                Without consent, companies cannot see you — even if Frog is ready.
              </li>
              <li>
                <span className="font-semibold text-ink">3. Watch introductions on Home.</span>{" "}
                When Frog refers you, the company and role context show up clearly.
              </li>
              <li>
                <span className="font-semibold text-ink">4. Stay close to Frog.</span>{" "}
                Frog coordinates employer interest and next steps with you.
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-paper">
        <div className="mx-auto max-w-6xl px-6 py-14 lg:py-16">
          <p className="label-caps">Screenshots from the demo</p>
          <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
            What the product looks like
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            Captured from the live demo pages. Click a shot to open the
            interactive mockup.
          </p>
          <div className="mt-10 space-y-10">
            {GUIDE_SHOTS.map((shot) => (
              <figure key={shot.src} className="space-y-3">
                <Link
                  href={shot.href}
                  className="block overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:border-brand/40"
                >
                  <Image
                    src={shot.src}
                    alt={shot.alt}
                    width={1440}
                    height={900}
                    className="h-auto w-full"
                    unoptimized
                    priority={shot.src.includes("employer-list")}
                  />
                </Link>
                <figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                  <span>{shot.caption}</span>
                  <Link
                    href={shot.href}
                    className="font-semibold text-primary hover:underline"
                  >
                    Open demo →
                  </Link>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="rounded-2xl bg-brand px-6 py-10 text-white sm:px-10">
          <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Access is by Frog referral
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
            Employers and candidates do not self-serve into live introductions.
            If Frog is working with you, you already have login details — or
            your Frog contact will send them.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/employer/login"
              className="rounded-md bg-surface px-4 py-2 text-sm font-semibold text-brand transition hover:bg-white"
            >
              Employer login
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Candidate login
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
