import Link from "next/link";
import { redirect } from "next/navigation";
import { getD1Db } from "@/lib/db/client";
import { confirmPasswordReset } from "@/lib/api/v1/auth-service";
import { AuthSplitShell } from "@/components/auth/AuthSplitShell";

async function resetPassword(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "").trim();
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) {
    redirect("/reset-password?error=token");
  }
  if (next.length < 8 || next !== confirm) {
    redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=invalid`
    );
  }

  const db = await getD1Db();
  const result = await confirmPasswordReset(db, {
    token,
    newPassword: next,
  });

  if (!result.ok) {
    const err =
      result.reason === "weak_password" ? "invalid" : "token";
    redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=${err}`
    );
  }

  redirect("/reset-password?done=1");
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; done?: string }>;
}) {
  const { token, error, done } = await searchParams;

  if (done === "1") {
    return (
      <AuthSplitShell
        audienceLabel="Account"
        headline={
          <>
            Password updated.
            <br />
            Sign in again.
          </>
        }
        body="Your password has been changed. Any signed-in mobile sessions were signed out for security."
      >
        <p className="label-caps">Done</p>
        <h2 className="mt-2 font-heading text-3xl font-semibold text-ink">
          You can sign in now
        </h2>
        <p className="mt-3 text-sm text-muted">
          Use your email and the new password in the app or on the web.
        </p>
        <div className="mt-8 space-y-3">
          <Link
            href="/employer/login"
            className="btn-primary block w-full px-6 py-3.5 text-center text-base"
          >
            Employer login
          </Link>
          <Link
            href="/login"
            className="block w-full rounded-md border border-line px-6 py-3.5 text-center text-base font-medium text-ink hover:bg-surface-2"
          >
            Candidate login
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
          Choose a new
          <br />
          password.
        </>
      }
      body="Enter the reset code from your email (or keep the pre-filled link) and pick a new password. Mobile sessions will be signed out."
    >
      <p className="label-caps">Password reset</p>
      <h2 className="mt-2 font-heading text-3xl font-semibold text-ink">
        Set a new password
      </h2>
      <p className="mt-3 text-sm text-muted">
        Minimum 8 characters. You can also finish this in the Frog Recruit app.
      </p>

      {error === "token" && (
        <div className="mt-5 rounded-md bg-red-50 p-3 text-sm text-red-700">
          That reset code is invalid or has expired. Request a new one from the
          app or login screen.
        </div>
      )}
      {error === "invalid" && (
        <div className="mt-5 rounded-md bg-red-50 p-3 text-sm text-red-700">
          Your new password must be at least 8 characters and match the
          confirmation.
        </div>
      )}

      <form action={resetPassword} className="mt-8 space-y-4">
        <div>
          <label
            htmlFor="token"
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            Reset code
          </label>
          <input
            id="token"
            name="token"
            type="text"
            required
            defaultValue={token ?? ""}
            autoComplete="one-time-code"
            className="input-field py-2.5 font-mono text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="next"
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            New password
          </label>
          <input
            id="next"
            name="next"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="input-field py-2.5"
          />
        </div>
        <div>
          <label
            htmlFor="confirm"
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            Confirm new password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="input-field py-2.5"
          />
        </div>
        <button
          type="submit"
          className="btn-primary w-full px-6 py-3.5 text-base"
        >
          Update password
        </button>
      </form>

      <p className="mt-8 text-sm text-muted">
        Need a new code?{" "}
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">
          Request a reset
        </Link>
      </p>
    </AuthSplitShell>
  );
}
