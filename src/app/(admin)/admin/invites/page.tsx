import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { candidateInvites } from "@/lib/db/schema";
import { createInvite, revokeInvite } from "@/lib/admin/actions";
import { baseUrl } from "@/lib/email/templates";
import { formatDateTime } from "@/lib/date";

const inputCls =
  "w-full rounded-md border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const STATUS_LABEL: Record<string, string> = {
  invited: "招待中",
  accepted: "登録済み",
  expired: "期限切れ",
  revoked: "無効化",
};

export default async function AdminInvites() {
  await requireAdmin();
  const db = await getD1Db();
  const invites = await db
    .select()
    .from(candidateInvites)
    .orderBy(desc(candidateInvites.createdAt))
    .all();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">候補者の招待</h1>

      <form action={createInvite} className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-end">
        <label className="block flex-1">
          <span className="mb-1 block text-sm font-medium text-ink">メールアドレス</span>
          <input name="email" type="email" required className={inputCls} />
        </label>
        <label className="block flex-1">
          <span className="mb-1 block text-sm font-medium text-ink">名前（任意）</span>
          <input name="name" className={inputCls} />
        </label>
        <button type="submit" className="btn-primary px-6 py-2.5">
          招待を送る
        </button>
      </form>
      <p className="text-xs text-muted">
        招待メールが {`<recruit@japan.frogagent.com>`} から送信されます。有効期限は14日間です。
      </p>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2">メール</th>
              <th className="px-4 py-2">状態</th>
              <th className="px-4 py-2">招待リンク</th>
              <th className="px-4 py-2">期限</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  まだ招待がありません。
                </td>
              </tr>
            )}
            {invites.map((iv) => (
              <tr key={iv.id} className="border-t border-line align-top">
                <td className="px-4 py-3">
                  <p className="text-ink">{iv.email}</p>
                  {iv.name && <p className="text-xs text-muted">{iv.name}</p>}
                </td>
                <td className="px-4 py-3 text-ink">{STATUS_LABEL[iv.status] ?? iv.status}</td>
                <td className="px-4 py-3">
                  {iv.status === "invited" ? (
                    <code className="break-all text-xs text-muted">
                      {baseUrl()}/invite/{iv.token}
                    </code>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {formatDateTime(iv.expiresAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  {iv.status === "invited" && (
                    <form action={revokeInvite}>
                      <input type="hidden" name="id" value={iv.id} />
                      <button className="text-xs text-danger hover:underline">無効化</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
