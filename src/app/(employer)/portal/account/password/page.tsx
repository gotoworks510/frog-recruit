import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireEmployer } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { users, employerAccounts } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

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
  const u = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      passwordSalt: users.passwordSalt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .get();

  if (!u?.passwordHash || !u.passwordSalt) {
    redirect("/portal/account/password?error=invalid");
  }
  const ok = await verifyPassword(current, u.passwordHash, u.passwordSalt);
  if (!ok) {
    redirect("/portal/account/password?error=current");
  }

  const { hash, salt } = await hashPassword(next);
  await db
    .update(users)
    .set({ passwordHash: hash, passwordSalt: salt, passwordUpdatedAt: new Date() })
    .where(eq(users.id, session.user.id));
  await db
    .update(employerAccounts)
    .set({ mustResetPassword: false, lastPasswordRotationAt: new Date() })
    .where(eq(employerAccounts.userId, session.user.id));

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
