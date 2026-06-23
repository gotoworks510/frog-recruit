import { cookies } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { users, employerAccounts, companies } from "@/lib/db/schema";
import {
  createEmployer,
  rotateEmployerPassword,
  setEmployerDisabled,
} from "@/lib/admin/actions";

const inputCls =
  "w-full rounded-md border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const ERRORS: Record<string, string> = {
  missing: "必要な項目が不足しています。",
  exists: "このメールアドレスは既に登録されています。",
};

export default async function AdminEmployers({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; rotated?: string }>;
}) {
  await requireAdmin();
  const db = await getD1Db();
  const { error } = await searchParams;

  // Read once-only temp-password flash cookie (httpOnly; read server-side).
  let flash: { email: string; pw: string } | null = null;
  try {
    const c = await cookies();
    const raw = c.get("recruit_emp_pw")?.value;
    if (raw) flash = JSON.parse(raw);
  } catch {
    flash = null;
  }

  const companyRows = await db.select().from(companies).orderBy(companies.name).all();

  const employers = await db
    .select({
      userId: users.id,
      email: users.email,
      contactName: employerAccounts.contactName,
      companyName: companies.name,
      mustReset: employerAccounts.mustResetPassword,
      disabledAt: employerAccounts.disabledAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(employerAccounts)
    .innerJoin(users, eq(employerAccounts.userId, users.id))
    .leftJoin(companies, eq(employerAccounts.companyId, companies.id))
    .orderBy(desc(employerAccounts.createdAt))
    .all();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">企業アカウント</h1>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {ERRORS[error] ?? "エラーが発生しました。"}
        </div>
      )}
      {flash && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-800">
            仮パスワードを発行しました（この表示は一度きりです）
          </p>
          <p className="mt-2 text-amber-900">
            メール: <span className="font-mono">{flash.email}</span>
            <br />
            仮パスワード: <span className="font-mono font-bold">{flash.pw}</span>
          </p>
          <p className="mt-2 text-xs text-amber-700">
            企業担当者にはメールでも送信済みです。安全な方法で共有してください。
          </p>
        </div>
      )}

      {companyRows.length === 0 ? (
        <p className="text-sm text-muted">
          先に「企業・求人」から企業を登録してください。
        </p>
      ) : (
        <form action={createEmployer} className="card grid gap-4 p-6 sm:grid-cols-2">
          <h2 className="font-semibold text-ink sm:col-span-2">アカウントを発行</h2>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">企業</span>
            <select name="companyId" required className={inputCls}>
              {companyRows.map((co) => (
                <option key={co.id} value={co.id}>
                  {co.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">担当者名</span>
            <input name="contactName" className={inputCls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-ink">メールアドレス</span>
            <input name="email" type="email" required className={inputCls} />
          </label>
          <div className="sm:col-span-2">
            <button className="btn-primary px-6 py-2.5">発行してメール送信</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2">企業 / 担当</th>
              <th className="px-4 py-2">メール</th>
              <th className="px-4 py-2">状態</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {employers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  まだ企業アカウントがありません。
                </td>
              </tr>
            )}
            {employers.map((e) => (
              <tr key={e.userId} className="border-t border-line">
                <td className="px-4 py-3">
                  <p className="text-ink">{e.companyName ?? "—"}</p>
                  {e.contactName && <p className="text-xs text-muted">{e.contactName}</p>}
                </td>
                <td className="px-4 py-3 text-ink">{e.email}</td>
                <td className="px-4 py-3 text-xs">
                  {e.disabledAt ? (
                    <span className="text-danger">無効</span>
                  ) : e.mustReset ? (
                    <span className="text-amber-600">初回パス変更待ち</span>
                  ) : (
                    <span className="text-frog-dark">有効</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-3 text-xs">
                    <form action={rotateEmployerPassword}>
                      <input type="hidden" name="userId" value={e.userId} />
                      <button className="text-primary hover:underline">パス再発行</button>
                    </form>
                    <form action={setEmployerDisabled}>
                      <input type="hidden" name="userId" value={e.userId} />
                      <input type="hidden" name="disabled" value={e.disabledAt ? "0" : "1"} />
                      <button className="text-danger hover:underline">
                        {e.disabledAt ? "有効化" : "無効化"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
