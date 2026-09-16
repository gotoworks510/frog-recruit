import Link from "next/link";
import { requireCandidate } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { getCandidateByUserId } from "@/lib/candidate/profile";
import { updateProfile, requestLinkedInRefresh } from "@/lib/candidate/actions";

export default async function ProfileEditor({
  searchParams,
}: {
  searchParams: Promise<{
    linkedin?: string;
    error?: string;
  }>;
}) {
  const session = await requireCandidate();
  const { linkedin, error } = await searchParams;
  const db = await getD1Db();
  const candidate = await getCandidateByUserId(db, session.user.id);
  const p = candidate?.profile;
  const linkedIn =
    candidate?.links.find((l) => l.kind === "linkedin")?.url ?? "";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-caps">Your profile</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-brand">
            Make your experience clear.
          </h1>
          <p className="mt-2 text-sm text-muted">
            Focus on the work you can do and where you want to go.
          </p>
        </div>
        <Link href="/me/preview" className="btn-outline shrink-0 text-sm">
          Preview
        </Link>
      </div>

      {linkedin === "requested" && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          Request received. Frog will review your LinkedIn and update your
          profile here when ready.
        </div>
      )}
      {linkedin === "saved_no_slack" && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          LinkedIn URL saved. Frog notification is temporarily unavailable —
          please also message your Frog contact.
        </div>
      )}
      {error === "linkedin_url" && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Please enter a valid LinkedIn profile URL (linkedin.com/…).
        </div>
      )}
      {error === "linkedin_rate" && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          You recently requested an update. Please try again later.
        </div>
      )}
      {error === "linkedin_slack" && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Could not notify Frog right now. Please try again or contact your
          Frog representative.
        </div>
      )}

      <form action={requestLinkedInRefresh} className="card space-y-4 p-6 sm:p-7">
        <div>
          <p className="label-caps">LinkedIn</p>
          <h2 className="mt-2 font-heading text-xl font-semibold text-ink">
            Request a profile refresh from LinkedIn
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Share your LinkedIn profile URL. Frog will review the latest
            information and update your candidate profile manually — nothing is
            overwritten automatically.
          </p>
        </div>
        <Field
          label="LinkedIn profile URL"
          hint="e.g. https://www.linkedin.com/in/your-name"
        >
          <input
            name="linkedinUrl"
            type="url"
            required
            defaultValue={linkedIn}
            placeholder="https://www.linkedin.com/in/..."
            className="input-field"
          />
        </Field>
        <button type="submit" className="btn-primary px-6 py-2.5">
          Request update from LinkedIn
        </button>
      </form>

      <form action={updateProfile} className="space-y-10">
        <Section n="01" title="Your introduction">
          <Field label="Display name">
            <input
              name="displayName"
              defaultValue={p?.displayName ?? ""}
              className="input-field"
            />
          </Field>
          <Field label="Headline (role)" hint="e.g. Senior Backend Engineer">
            <input
              name="headline"
              defaultValue={p?.headline ?? ""}
              className="input-field"
            />
          </Field>
          <Field
            label="Summary"
            hint="A few lines that convey what problems you can solve."
          >
            <textarea
              name="summary"
              rows={4}
              defaultValue={p?.summary ?? ""}
              className="input-field"
            />
          </Field>
        </Section>

        <Section n="02" title="Your next role">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Current location">
              <input
                name="locationCurrent"
                defaultValue={p?.locationCurrent ?? ""}
                className="input-field"
              />
            </Field>
            <Field label="Preferred location">
              <input
                name="locationPreference"
                defaultValue={p?.locationPreference ?? ""}
                className="input-field"
              />
            </Field>
            <Field label="Years of experience">
              <input
                name="yearsExperience"
                type="number"
                min={0}
                defaultValue={p?.yearsExperience ?? ""}
                className="input-field"
              />
            </Field>
            <Field label="Availability">
              <input
                name="availability"
                defaultValue={p?.availability ?? ""}
                placeholder="e.g. Immediately / In 1 month"
                className="input-field"
              />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Desired salary (min)">
              <input
                name="desiredSalaryMin"
                type="number"
                defaultValue={p?.desiredSalaryMin ?? ""}
                className="input-field"
              />
            </Field>
            <Field label="Desired salary (max)">
              <input
                name="desiredSalaryMax"
                type="number"
                defaultValue={p?.desiredSalaryMax ?? ""}
                className="input-field"
              />
            </Field>
            <Field label="Currency">
              <select
                name="salaryCurrency"
                defaultValue={p?.salaryCurrency ?? "USD"}
                className="input-field"
              >
                <option value="USD">USD</option>
                <option value="CAD">CAD</option>
                <option value="JPY">JPY</option>
              </select>
            </Field>
          </div>
        </Section>

        <Section n="03" title="Work & communication">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Work authorization / visa">
              <select
                name="workAuthStatus"
                defaultValue={p?.workAuthStatus ?? ""}
                className="input-field"
              >
                <option value="">Please select</option>
                <option value="us_citizen">U.S. Citizen</option>
                <option value="green_card">Green Card</option>
                <option value="h1b">H-1B</option>
                <option value="tn">TN</option>
                <option value="opt">OPT</option>
                <option value="ca_pr">Canada PR</option>
                <option value="ca_citizen">Canadian Citizen</option>
                <option value="iec">IEC (Canada)</option>
                <option value="needs_sponsorship">Needs Sponsorship</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="English level">
              <select
                name="englishLevel"
                defaultValue={p?.englishLevel ?? ""}
                className="input-field"
              >
                <option value="">Please select</option>
                <option value="native">Native</option>
                <option value="business">Business</option>
                <option value="conversational">Conversational</option>
                <option value="basic">Basic</option>
              </select>
            </Field>
          </div>
          <Field label="Visa notes (optional)">
            <input
              name="visaNotes"
              defaultValue={p?.visaNotes ?? ""}
              className="input-field"
            />
          </Field>
        </Section>

        <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:gap-5">
          <button type="submit" className="btn-primary px-6 py-2.5">
            Save changes
          </button>
          <p className="text-xs text-muted">
            Your sharing preferences are managed separately.
          </p>
        </div>
      </form>
    </div>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <h2 className="font-heading text-xl font-semibold text-ink">
        <span className="text-muted">{n}</span>
        <span className="mx-2 text-muted">/</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {hint && <span className="mb-1.5 block text-xs text-muted">{hint}</span>}
      {children}
    </label>
  );
}
