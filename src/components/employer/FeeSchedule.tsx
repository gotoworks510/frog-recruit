import Link from "next/link";
import {
  FEE_BRAND_NAME,
  FEE_CALCULATION_POINTS,
  FEE_ENTITY_NAME,
  FEE_SCOPE_POINTS,
  FEE_TIERS,
  SUBSEQUENT_HIRE_FEE_PCT,
} from "@/lib/employer/fee-schedule";

type FeeScheduleProps = {
  /** Compact card for portal home; full for /portal/fees. */
  variant?: "full" | "summary";
};

export function FeeSchedule({ variant = "full" }: FeeScheduleProps) {
  if (variant === "summary") {
    return (
      <section className="overflow-hidden rounded-2xl border border-line bg-paper">
        <div className="bg-brand px-6 py-6 text-white sm:px-7">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-white/55 uppercase">
            Referral fees
          </p>
          <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
            Simple pricing. Built to try Frog first.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">
            Your first Frog-referred hire is complimentary. After that,{" "}
            {SUBSEQUENT_HIRE_FEE_PCT}% — far below typical agency rates — because
            overseas Japanese talent is hard to reach well, and we want the door
            open.
          </p>
        </div>
        <div className="grid gap-0 sm:grid-cols-2">
          {FEE_TIERS.map((tier) => (
            <div
              key={tier.id}
              className="border-t border-line px-6 py-5 sm:border-t-0 sm:px-7 sm:py-6 sm:odd:border-r"
            >
              <p className="label-caps">{tier.title}</p>
              <p className="mt-2 font-heading text-3xl font-semibold text-brand">
                {tier.rateLabel}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {tier.detail}
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-t border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p className="text-xs text-muted">
            Employers pay {FEE_BRAND_NAME}. Candidates are never charged.
          </p>
          <Link
            href="/portal/fees"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Full fee schedule →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl bg-brand px-6 py-8 text-white sm:px-8 sm:py-10">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-white/55 uppercase">
          Fee schedule
        </p>
        <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Referral fees for companies working with {FEE_BRAND_NAME}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/75">
          {FEE_ENTITY_NAME} ({FEE_BRAND_NAME}) refers pre-vetted people for you
          to engage directly. You pay a referral fee only when you hire — and
          the first engagement is free.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {FEE_TIERS.map((tier) => (
          <div key={tier.id} className="card p-6 sm:p-7">
            <p className="label-caps">{tier.title}</p>
            <p className="mt-3 font-heading text-4xl font-semibold text-brand">
              {tier.rateLabel}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {tier.detail}
            </p>
          </div>
        ))}
      </section>

      <section className="card p-6 sm:p-7">
        <h2 className="font-heading text-2xl font-semibold text-ink">
          How the {SUBSEQUENT_HIRE_FEE_PCT}% is calculated
        </h2>
        <ul className="mt-5 space-y-5">
          {FEE_CALCULATION_POINTS.map((point) => (
            <li key={point.title}>
              <p className="font-semibold text-ink">{point.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {point.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl bg-mint p-6 sm:p-7">
        <h2 className="font-heading text-2xl font-semibold text-ink">
          Scope of the referral
        </h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink/80">
          {FEE_SCOPE_POINTS.map((line) => (
            <li key={line} className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-frog-dark/70">
          Governed by the laws of British Columbia and applicable Canadian
          federal law. A signed referral agreement may set payment
          administration and other commercial details for your engagement; this
          page is the rate card used on Frog Recruit.
        </p>
      </section>

      <p className="text-sm text-muted">
        Questions about an invoice or a specific engagement? Email{" "}
        <a
          href="mailto:agent@frogagent.com"
          className="font-semibold text-primary hover:underline"
        >
          agent@frogagent.com
        </a>
        .
      </p>
    </div>
  );
}
