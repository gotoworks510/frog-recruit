import { Logo } from "@/components/brand/Logo";
import { DEMO_CANDIDATE_HOME } from "@/lib/demo/mock-data";

export default function DemoCandidateHomePage() {
  const d = DEMO_CANDIDATE_HOME;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-caps">Your career, with Frog</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-brand sm:text-4xl">
            Welcome back, {d.firstName}.
          </h1>
        </div>
        <span className="btn-outline shrink-0 text-sm opacity-70">
          Preview your profile ↗
        </span>
      </div>

      <section className="overflow-hidden rounded-2xl bg-brand text-white shadow-sm">
        <div className="border-b border-white/10 px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex items-center gap-3">
            <Logo variant="white" height={28} />
            <p className="text-[11px] font-semibold tracking-[0.14em] text-white/60 uppercase">
              Introduced by Frog
            </p>
          </div>
          <h2 className="mt-5 font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Frog is introducing you to this company.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
            These introductions only exist because Frog brought you to the
            table. Without Frog&apos;s referral, these hiring teams would not be
            reviewing your profile.
          </p>
        </div>

        <div className="bg-mint/95 px-4 py-5 sm:px-6 sm:py-6">
          <div className="rounded-xl border border-frog-dark/10 bg-paper p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-brand px-3 py-1 text-[11px] font-semibold tracking-wide text-white uppercase">
                Via Frog
              </span>
              <span className="inline-flex items-center rounded-full bg-mint-deep px-3 py-1 text-xs font-semibold text-frog-dark">
                {d.introStatus}
              </span>
            </div>
            <h3 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {d.companyName}
            </h3>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink/80">
              {d.companyBlurb}
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold tracking-[0.1em] text-muted uppercase">
                Role Frog connected you to
              </p>
              <p className="font-medium text-ink">{d.roleTitle}</p>
              <p className="text-sm text-muted">{d.roleLocation}</p>
            </div>
            <p className="mt-5 text-sm font-medium text-frog-dark">
              Frog recommended you to {d.companyName}. Keep your Frog contact in
              the loop — they are your bridge to this team.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card flex flex-col p-6 sm:p-7">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink">Profile completeness</span>
            <span className="font-semibold text-brand">{d.completeness}%</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${d.completeness}%` }}
            />
          </div>
          <p className="label-caps mt-8">Your next step</p>
          <h2 className="mt-2 font-heading text-2xl font-semibold text-ink">
            Keep your profile current.
          </h2>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
            Experience, links, and resume help Frog make a stronger introduction.
          </p>
        </div>
        <div className="flex flex-col rounded-xl bg-mint p-6 sm:p-7">
          <p className="label-caps text-frog-dark/70">Your sharing status</p>
          <span className="mt-3 inline-flex w-fit rounded-full bg-paper px-3 py-1 text-xs font-semibold text-frog-dark">
            Sharing consent given
          </span>
          <h2 className="mt-4 font-heading text-2xl font-semibold text-ink">
            Your profile has a defined audience.
          </h2>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/75">
            When Frog refers you to a company, that company can view your shared
            profile. Your profile is not publicly listed.
          </p>
        </div>
      </div>
    </div>
  );
}
