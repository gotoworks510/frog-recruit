import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireCandidateSession } from "@/lib/candidate/guard";
import { getD1Db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { changePassword as changePasswordCore } from "@/lib/account/password-core";

const inputCls =
  "w-full rounded-md border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

async function changePassword(formData: FormData) {
  "use server";
  const session = await requireCandidateSession();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 8 || next !== confirm) {
    redirect("/me/account/password?error=invalid");
  }

  const db = await getD1Db();
  const result = await changePasswordCore(db, {
    userId: session.user.id,
    role: "candidate",
    currentPassword: current,
    newPassword: next,
  });
  if (!result.ok) {
    redirect(`/me/account/password?error=${result.reason}`);
  }

  redirect("/me");
}

export default async function CandidatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireCandidateSession();
  const { error } = await searchParams;
  const db = await getD1Db();
  const u = await db
    .select({ authProvider: users.authProvider })
    .from(users)
    .where(eq(users.id, session.user.id))
    .get();

  if (u?.authProvider !== "credentials") {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="font-heading text-2xl font-semibold text-ink">Account</h1>
        <p className="mt-2 text-sm text-muted">
          You sign in with Google. Password changes are not available for this account.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-heading text-2xl font-semibold text-ink">Change password</h1>
      <p className="mt-1 text-sm text-muted">
        For security, you must change your password the first time you log in (8
        characters minimum).
      </p>

      {error === "current" && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          The current password is incorrect.
        </div>
      )}
      {error === "invalid" && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          Your new password doesn&apos;t meet the requirements (at least 8 characters
          and must match the confirmation).
        </div>
      )}
      {error === "unsupported" && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          Password change is not available for this account.
        </div>
      )}

      <form action={changePassword} className="card mt-6 space-y-4 p-6">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Current password</span>
          <input
            name="current"
            type="password"
            required
            autoComplete="current-password"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">New password</span>
          <input
            name="next"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">
            New password (confirm)
          </span>
          <input
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputCls}
          />
        </label>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary px-6 py-2.5">
            Update
          </button>
        </div>
      </form>
    </div>
  );
}
