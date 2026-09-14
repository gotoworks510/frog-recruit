import Image from "next/image";
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

      {/* Trust / credibility — why employers can trust Frog */}
      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <p className="label-caps">Why companies trust Frog</p>
          <h2 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-snug tracking-tight sm:text-4xl">
            Not a stranger sending résumés. A community that has known these
            people for years.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
            For about 12 years, Frog has built Japanese professional communities
            across Canada — seminars, conferences, meetups, and gatherings that
            keep people connected long after they land. From that work grew what
            is today the only large-scale community for Japanese tech talent on
            the North American West Coast — based in Vancouver, connected to
            Japan.
          </p>

          {/* Primary visual: large-hall scale */}
          <figure className="mt-10">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl sm:aspect-[21/9]">
              <Image
                src="/community/seminar-hall.jpg"
                alt="A packed Frog seminar hall — hundreds of Japanese professionals facing the stage"
                fill
                className="object-cover object-[center_65%]"
                priority
                sizes="(max-width: 1152px) 100vw, 1152px"
              />
            </div>
            <figcaption className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
              A Frog seminar at full scale. Nearly everyone in this room is
              building a path toward North America — careers, immigration, and
              life on the West Coast — and Frog has walked that road with them
              for years.
            </figcaption>
          </figure>

          {/* Community mosaic: many faces of Frog in Canada */}
          <div className="mt-10">
            <p className="label-caps">One community, many gatherings</p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Career seminars, tech conferences at places like UBC, office
              meetups, and outdoor BBQs — the same network, meeting in many
              forms across Canada.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {[
                {
                  src: "/community/canadian-dream-hall.jpg",
                  alt: "Frog Canadian Dream seminar hall with attendees at tables",
                  label: "Career seminars",
                  object: "object-cover object-[center_72%]",
                },
                {
                  src: "/community/conference-panel.jpg",
                  alt: "Frog Conference panel of Japanese engineers at UBC Vancouver",
                  label: "Tech conferences",
                  object: "object-cover object-[center_35%]",
                },
                {
                  src: "/community/office-meetup.jpg",
                  alt: "Frog office meetup with Japanese professionals networking",
                  label: "Meetups",
                  object: "object-cover object-[center_45%]",
                },
                {
                  src: "/community/bbq-park.jpg",
                  alt: "Frog community BBQ group photo in a Canadian park",
                  label: "Community BBQs",
                  object: "object-cover object-[center_40%]",
                },
              ].map((shot) => (
                <figure key={shot.src} className="min-w-0">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl">
                    <Image
                      src={shot.src}
                      alt={shot.alt}
                      fill
                      className={shot.object}
                      sizes="(max-width: 1024px) 50vw, 280px"
                    />
                  </div>
                  <figcaption className="mt-2.5 text-xs font-medium text-muted">
                    {shot.label}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>

          <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
            <figure>
              <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl">
                <Image
                  src="/community/career-talk.jpg"
                  alt="Frog career talk on North American layoffs with speakers and audience"
                  fill
                  className="object-cover object-[center_35%]"
                  sizes="(max-width: 1024px) 100vw, 560px"
                />
              </div>
              <figcaption className="mt-4 text-sm leading-relaxed text-muted">
                Ongoing career sessions in Vancouver — the same community that
                later becomes the talent pool behind Recruit.
              </figcaption>
            </figure>

            <div>
              <h3 className="font-heading text-2xl font-semibold tracking-tight text-brand">
                Why that matters for hiring
              </h3>
              <ul className="mt-6 space-y-6">
                {[
                  {
                    title: "We know the people we introduce",
                    body: "Candidates come through a community we have run for years — not cold inbound from a job board. When Frog recommends someone, it is because we have context on who they are.",
                  },
                  {
                    title: "West Coast scale, Japan fluency",
                    body: "We are rooted in Vancouver and focused on Japanese professionals building careers in Canada and the U.S. West Coast. That dual fluency is hard to fake — and hard to replace with a generic agency.",
                  },
                  {
                    title: "Judgment before the interview",
                    body: "Recruit shows more than a résumé: Frog's written perspective on strengths and points to consider, shared only with companies we introduce the candidate to — with their consent.",
                  },
                ].map((item) => (
                  <li key={item.title}>
                    <p className="font-semibold text-ink">{item.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-10 grid grid-cols-3 gap-4 border-t border-line pt-8">
                {[
                  { value: "~12 yrs", label: "community & career support" },
                  { value: "650+", label: "people in the network" },
                  { value: "~220", label: "companies connected" },
                ].map((s) => (
                  <div key={s.value}>
                    <p className="font-heading text-2xl font-semibold text-brand sm:text-3xl">
                      {s.value}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-muted">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip kept light after trust proof */}
      <section className="bg-brand text-white">
        <div className="mx-auto max-w-6xl px-6 py-12 sm:py-14">
          <p className="label-caps text-white/55">The community behind Recruit</p>
          <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Built over time — not overnight.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
            Recruit is the private introduction portal for that community. Access
            is by Frog referral only. Employers see candidates we stand behind;
            candidates keep control over what is shared.
          </p>
        </div>
      </section>

      {/* How it connects to the product */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-2 lg:gap-14">
        <div>
          <p className="label-caps">Why this portal</p>
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
            Frog Recruit is where those introductions happen: curated profiles,
            Frog&apos;s written perspective, and access only for the companies we
            refer candidates to.
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
