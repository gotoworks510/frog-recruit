import { desc, eq, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import {
  users,
  employerAccounts,
  companies,
  candidateProfiles,
  accessGrants,
  candidateConsents,
} from "@/lib/db/schema";
import { createGrant, revokeGrant } from "@/lib/admin/actions";
import { formatDateTime } from "@/lib/date";

const inputCls =
  "w-full rounded-md border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const ERRORS: Record<string, string> = {
  missing: "企業アカウントと候補者を選択してください。",
  consent: "この候補者は共有に同意していないため付与できません（候補者の共有設定が必要です）。",
};

export default async function AdminGrants({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requireAdmin();
  const db = await getD1Db();
  const { error, ok } = await searchParams;

  const employers = await db
    .select({
      userId: users.id,
      email: users.email,
      companyName: companies.name,
    })
    .from(employerAccounts)
    .innerJoin(users, eq(employerAccounts.userId, users.id))
    .leftJoin(companies, eq(employerAccounts.companyId, companies.id))
    .where(isNull(employerAccounts.disabledAt))
    .all();

  const candidates = await db
    .select({
      profileId: candidateProfiles.id,
      name: candidateProfiles.displayName,
      headline: candidateProfiles.headline,
    })
    .from(candidateProfiles)
    .innerJoin(users, eq(candidateProfiles.userId, users.id))
    .where(eq(users.status, "approved"))
    .all();

  // Candidates with an active broad/any consent — for an at-a-glance hint.
  const activeConsents = await db
    .select({ candidateProfileId: candidateConsents.candidateProfileId })
    .from(candidateConsents)
    .where(isNull(candidateConsents.revokedAt))
    .all();
  const consented = new Set(activeConsents.map((c) => c.candidateProfileId));

  const grants = await db
    .select({
      id: accessGrants.id,
      employerEmail: users.email,
      companyName: companies.name,
      candidateName: candidateProfiles.displayName,
      grantedAt: accessGrants.grantedAt,
      expiresAt: accessGrants.expiresAt,
      revokedAt: accessGrants.revokedAt,
      canDownloadResume: accessGrants.canDownloadResume,
    })
    .from(accessGrants)
    .innerJoin(users, eq(accessGrants.employerUserId, users.id))
    .leftJoin(companies, eq(accessGrants.companyId, companies.id))
    .leftJoin(candidateProfiles, eq(accessGrants.candidateProfileId, candidateProfiles.id))
    .orderBy(desc(accessGrants.grantedAt))
    .all();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">閲覧権限</h1>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {ERRORS[error] ?? "エラーが発生しました。"}
        </div>
      )}
      {ok && (
        <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
          閲覧権限を更新しました。
        </div>
      )}

      <form action={createGrant} className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="font-semibold text-ink sm:col-span-2">権限を付与</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">企業アカウント</span>
          <select name="employerUserId" required className={inputCls}>
            {employers.map((e) => (
              <option key={e.userId} value={e.userId}>
                {e.companyName ?? "—"}（{e.email}）
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">候補者</span>
          <select name="candidateProfileId" required className={inputCls}>
            {candidates.map((cd) => (
              <option key={cd.profileId} value={cd.profileId}>
                {cd.name ?? "候補者"} {cd.headline ? `– ${cd.headline}` : ""}
                {consented.has(cd.profileId) ? "" : "（未同意）"}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">有効期限（任意）</span>
          <input name="expiresAt" type="date" className={inputCls} />
        </label>
        <label className="flex items-center gap-2 pt-6 text-sm text-ink">
          <input type="checkbox" name="canDownloadResume" value="1" defaultChecked />
          レジュメ閲覧を許可
        </label>
        <div className="sm:col-span-2">
          <button className="btn-primary px-6 py-2.5">付与する</button>
        </div>
        <p className="text-xs text-muted sm:col-span-2">
          候補者が共有に同意していない場合は付与できません。
        </p>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2">企業</th>
              <th className="px-4 py-2">候補者</th>
              <th className="px-4 py-2">状態</th>
              <th className="px-4 py-2">レジュメ</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {grants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  まだ閲覧権限がありません。
                </td>
              </tr>
            )}
            {grants.map((g) => {
              const inactive =
                g.revokedAt || (g.expiresAt && g.expiresAt.getTime() <= Date.now());
              return (
                <tr key={g.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="text-ink">{g.companyName ?? "—"}</p>
                    <p className="text-xs text-muted">{g.employerEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-ink">{g.candidateName ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {g.revokedAt ? (
                      <span className="text-danger">失効</span>
                    ) : inactive ? (
                      <span className="text-muted">期限切れ</span>
                    ) : (
                      <span className="text-frog-dark">
                        有効{g.expiresAt ? ` (〜${formatDateTime(g.expiresAt)})` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {g.canDownloadResume ? "可" : "不可"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!g.revokedAt && (
                      <form action={revokeGrant}>
                        <input type="hidden" name="id" value={g.id} />
                        <button className="text-xs text-danger hover:underline">失効</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
