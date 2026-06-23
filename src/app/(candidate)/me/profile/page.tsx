import { requireCandidate } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { getCandidateByUserId } from "@/lib/candidate/profile";
import { updateProfile } from "@/lib/candidate/actions";

const inputCls =
  "w-full rounded-md border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

export default async function ProfileEditor() {
  const session = await requireCandidate();
  const db = await getD1Db();
  const candidate = await getCandidateByUserId(db, session.user.id);
  const p = candidate?.profile;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Profile</h1>
        <p className="mt-1 text-sm text-muted">
          Focus on the achievements and work authorization that match the role. There's no need to list everything.
        </p>
      </div>

      <form action={updateProfile} className="card space-y-5 p-6">
        <Field label="Display name">
          <input name="displayName" defaultValue={p?.displayName ?? ""} className={inputCls} />
        </Field>
        <Field label="Headline (role)" hint="e.g. Senior Backend Engineer">
          <input name="headline" defaultValue={p?.headline ?? ""} className={inputCls} />
        </Field>
        <Field label="Summary" hint="A few lines that convey what problems you can solve.">
          <textarea
            name="summary"
            rows={4}
            defaultValue={p?.summary ?? ""}
            className={inputCls}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Current location">
            <input name="locationCurrent" defaultValue={p?.locationCurrent ?? ""} className={inputCls} />
          </Field>
          <Field label="Preferred location">
            <input
              name="locationPreference"
              defaultValue={p?.locationPreference ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Years of experience">
            <input
              name="yearsExperience"
              type="number"
              min={0}
              defaultValue={p?.yearsExperience ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Work authorization / visa">
            <select name="workAuthStatus" defaultValue={p?.workAuthStatus ?? ""} className={inputCls}>
              <option value="">Please select</option>
              <option value="us_citizen">U.S. Citizen</option>
              <option value="green_card">Green Card</option>
              <option value="h1b">H-1B</option>
              <option value="tn">TN</option>
              <option value="opt">OPT</option>
              <option value="ca_pr">Canada PR</option>
              <option value="ca_citizen">Canadian Citizen</option>
              <option value="needs_sponsorship">Needs Sponsorship</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="English level">
            <select name="englishLevel" defaultValue={p?.englishLevel ?? ""} className={inputCls}>
              <option value="">Please select</option>
              <option value="native">Native</option>
              <option value="business">Business</option>
              <option value="conversational">Conversational</option>
              <option value="basic">Basic</option>
            </select>
          </Field>
          <Field label="Availability">
            <input
              name="availability"
              defaultValue={p?.availability ?? ""}
              placeholder="e.g. Immediately / In 1 month"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Visa notes (optional)">
          <input name="visaNotes" defaultValue={p?.visaNotes ?? ""} className={inputCls} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Desired salary (min)">
            <input
              name="desiredSalaryMin"
              type="number"
              defaultValue={p?.desiredSalaryMin ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Desired salary (max)">
            <input
              name="desiredSalaryMax"
              type="number"
              defaultValue={p?.desiredSalaryMax ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Currency">
            <select name="salaryCurrency" defaultValue={p?.salaryCurrency ?? "USD"} className={inputCls}>
              <option value="USD">USD</option>
              <option value="CAD">CAD</option>
              <option value="JPY">JPY</option>
            </select>
          </Field>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary px-6 py-2.5">
            Save
          </button>
        </div>
      </form>
    </div>
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
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {hint && <span className="mb-1 block text-xs text-muted">{hint}</span>}
      {children}
    </label>
  );
}
