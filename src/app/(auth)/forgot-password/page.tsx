import Link from "next/link";
import { redirect } from "next/navigation";
import { getD1Db } from "@/lib/db/client";
import { requestPasswordReset } from "@/lib/api/v1/auth-service";
import { AuthSplitShell } from "@/components/auth/AuthSplitShell";
import type { AppVariant } from "@/lib/db/schema/mobile";

async function requestReset(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const variantRaw = String(formData.get("appVariant") ?? "employer");
  const appVariant: AppVariant =
    variantRaw === "candidate" ? "candidate" : "employer";

  // Always redirect the same way — do not reveal whether the account exists.
  if (email) {
    const db = await getD1Db();
    await requestPasswordReset(db, { email, appVariant });
  }
  redirect(`/forgot-password?sent=1&appVariant=${appVariant}`);
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; appVariant?: string }>;
}) {
  const { sent, appVariant: variantParam } = await searchParams;
  const defaultVariant =
    variantParam === "candidate" ? "candidate" : "employer";

  if (sent === "1") {
    return (
      <AuthSplitShell
        audienceLabel="Account"
        headline={
          <>
            Check your email.
          </>
        }
        body="If an account matches that address, we sent a one-time reset code. It expires soon and can be used once."
      >
        <p className="label-caps">Password reset</p>
        <h2 className="mt-2 font-heading text-3xl font-semibold text-ink">
          Email sent (if we found you)
        </h2>
        <p className="mt-3 text-sm text-muted">
          Open the link in the email, or paste the code on the reset page. You
          can also finish in the Frog Recruit app.
        </p>
        <div className="mt-8 space-y-3">
          <Link
            href="/reset-password"
            className="btn-primary block w-full px-6 py-3.5 text-center text-base"
          >
            Enter reset code
          </Link>
          <Link
            href={
              defaultVariant === "candidate" ? "/login" : "/employer/login"
            }
            className="block w-full rounded-md border border-line px-6 py-3.5 text-center text-base font-medium text-ink hover:bg-surface-2"
          >
            Back to login
          </Link>
        </div>
      </AuthSplitShell>
    );
  }

  return (
    <AuthSplitShell
      audienceLabel="Account"
      headline={
        <>
          Forgot your
          <br />
          password?
        </>
      }
      body="Enter the email on your Frog Recruit credentials account. We'll send a one-time code if it matches."
    >
      <p className="label-caps">Password reset</p>
      <h2 className="mt-2 font-heading text-3xl font-semibold text-ink">
        Request a reset
      </h2>
      <p className="mt-3 text-sm text-muted">
        Works for employer and candidate accounts issued with email and
        password. Google-only accounts are not covered here.
      </p>

      <form action={requestReset} className="mt-8 space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input-field py-2.5"
          />
        </div>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink">
            Account type
          </legend>
          <div className="flex gap-4 text-sm text-ink">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="appVariant"
                value="employer"
                defaultChecked={defaultVariant === "employer"}
              />
              Employer
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="appVariant"
                value="candidate"
                defaultChecked={defaultVariant === "candidate"}
              />
              Candidate
            </label>
          </div>
        </fieldset>
        <button
          type="submit"
          className="btn-primary w-full px-6 py-3.5 text-base"
        >
          Send reset code
        </button>
      </form>

      <p className="mt-8 text-sm">
        <Link
          href={defaultVariant === "candidate" ? "/login" : "/employer/login"}
          className="font-medium text-primary hover:underline"
        >
          ← Back to login
        </Link>
      </p>
    </AuthSplitShell>
  );
}
