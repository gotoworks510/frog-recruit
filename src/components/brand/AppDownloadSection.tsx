import {
  APP_STORE,
  type AppStoreVariant,
} from "@/lib/apps/app-store";
import { AppStoreBadge } from "@/components/brand/AppStoreBadge";

interface AppDownloadPromptProps {
  /** Which app to promote (login / in-portal surfaces). */
  variant: AppStoreVariant;
  /** Compact = single line under a form; card = labeled block. */
  layout?: "compact" | "card";
  className?: string;
}

/**
 * Audience-specific App Store CTA. Keeps invitation-only framing —
 * the store is for people who already have a Frog-issued account.
 */
export function AppDownloadPrompt({
  variant,
  layout = "card",
  className = "",
}: AppDownloadPromptProps) {
  const app = APP_STORE[variant];

  if (layout === "compact") {
    return (
      <div className={`flex flex-col items-start gap-3 ${className}`}>
        <p className="text-sm text-muted">
          Prefer iPhone? Use the same Frog-issued login in{" "}
          <span className="font-medium text-ink">{app.name}</span>.
        </p>
        <AppStoreBadge variant={variant} height={40} />
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-line bg-paper px-5 py-5 ${className}`}
    >
      <p className="label-caps">On iPhone</p>
      <p className="mt-2 text-sm font-semibold text-ink">{app.name}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Same Frog-issued email and password. Accounts are not created in the
        App Store — Frog invites you first.
      </p>
      <div className="mt-4">
        <AppStoreBadge variant={variant} height={40} />
      </div>
    </div>
  );
}

interface AppDownloadSectionProps {
  /** Landing / how-it-works dual-app showcase. */
  className?: string;
  /** Dark brand band vs paper section. */
  tone?: "paper" | "brand";
}

/** Public dual-app section: candidate + employer, clearly separated. */
export function AppDownloadSection({
  className = "",
  tone = "paper",
}: AppDownloadSectionProps) {
  const onBrand = tone === "brand";

  return (
    <section
      className={
        onBrand
          ? `bg-brand text-white ${className}`
          : `border-y border-line bg-paper ${className}`
      }
    >
      <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
        <p className={`label-caps ${onBrand ? "text-white/55" : ""}`}>
          On iPhone
        </p>
        <h2
          className={`mt-3 max-w-3xl font-heading text-3xl font-semibold leading-snug tracking-tight sm:text-4xl ${
            onBrand ? "text-white" : ""
          }`}
        >
          Two private apps. Same Frog introductions.
        </h2>
        <p
          className={`mt-4 max-w-2xl text-base leading-relaxed ${
            onBrand ? "text-white/75" : "text-muted"
          }`}
        >
          Frog Recruit and Frog Recruit for Employers are on the App Store.
          Access is still by Frog referral — download the app for your role,
          then sign in with the credentials Frog sent you.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {(
            [
              ["candidate", APP_STORE.candidate],
              ["employer", APP_STORE.employer],
            ] as const
          ).map(([key, app]) => (
            <div
              key={key}
              className={
                onBrand
                  ? "rounded-2xl border border-white/15 bg-white/5 px-6 py-6 sm:px-7 sm:py-7"
                  : "rounded-2xl border border-line bg-surface px-6 py-6 sm:px-7 sm:py-7"
              }
            >
              <p
                className={`label-caps ${
                  onBrand ? "text-white/55" : ""
                }`}
              >
                {app.audience}
              </p>
              <h3
                className={`mt-2 font-heading text-xl font-semibold tracking-tight sm:text-2xl ${
                  onBrand ? "text-white" : "text-ink"
                }`}
              >
                {app.name}
              </h3>
              <p
                className={`mt-1 text-sm ${
                  onBrand ? "text-white/55" : "text-muted"
                }`}
              >
                {app.subtitle}
              </p>
              <p
                className={`mt-4 text-sm leading-relaxed ${
                  onBrand ? "text-white/75" : "text-muted"
                }`}
              >
                {app.blurb}
              </p>
              <div className="mt-6">
                <AppStoreBadge
                  variant={key}
                  tone={onBrand ? "white" : "black"}
                  height={44}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
