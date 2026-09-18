import { redirect } from "next/navigation";
import { requireEmployer } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { changePassword as changePasswordCore } from "@/lib/account/password-core";

const inputCls =
  "w-full rounded-md border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

async function changePassword(formData: FormData) {
  "use server";
  const session = await requireEmployer();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 8 || next !== confirm) {
    redirect("/portal/account/password?error=invalid");
  }

  const db = await getD1Db();
  const result = await changePasswordCore(db, {
    userId: session.user.id,
    role: "employer",
    currentPassword: current,
    newPassword: next,
  });
  if (!result.ok) {
    redirect(
      `/portal/account/password?error=${
        result.reason === "current" ? "current" : "invalid"
      }`
    );
  }

  redirect("/portal");
}

export default async function EmployerPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireEmployer();
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-ink">Change password</h1>
      <p className="mt-1 text-sm text-muted">
        For security, you must change your password the first time you log in (8 characters minimum).
      </p>

      {error === "current" && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          The current password is incorrect.
        </div>
      )}
      {error === "invalid" && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          Your new password doesn't meet the requirements (at least 8 characters and must match the confirmation).
        </div>
      )}

      <form action={changePassword} className="card mt-6 space-y-4 p-6">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Current password</span>
          <input name="current" type="password" required autoComplete="current-password" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">New password</span>
          <input name="next" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">New password (confirm)</span>
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
        </label>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary px-6 py-2.5">Update</button>
        </div>
      </form>
    </div>
  );
}
