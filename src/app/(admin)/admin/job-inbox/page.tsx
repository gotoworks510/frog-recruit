import Link from "next/link";
import { desc, ne } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { jobLeads } from "@/lib/db/schema";
import { isJobInboxEnabled } from "@/lib/job-inbox/config";
import { createManualJobLead, deleteJobLead } from "@/lib/job-inbox/actions";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";

const inputCls =
  "w-full rounded-md border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const STATUS_JA: Record<string, string> = {
  new: "新規",
  triaged: "選別済",
  rejected: "見送り",
  snoozed: "保留",
};

export default async function JobInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string; deleted?: string }>;
}) {
  await requireAdmin();
  const { error, status: statusFilter, deleted } = await searchParams;
  const enabled = isJobInboxEnabled();

  if (!enabled) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-ink">求人Inbox</h1>
        <div className="card p-6 text-sm text-muted">
          Job Inboxは開発用フラグで無効です。.env.local に{" "}
          <code className="rounded bg-surface-2 px-1">JOB_INBOX_ENABLED=1</code> と{" "}
          <code className="rounded bg-surface-2 px-1">JOB_INBOX_TOKEN=...</code>{" "}
          を設定してから再起動してください。
        </div>
      </div>
    );
  }

  const db = await getD1Db();
  // Converted leads are deleted on convert; filter any legacy rows out of the queue view.
  let rows = await db
    .select()
    .from(jobLeads)
    .where(ne(jobLeads.status, "converted"))
    .orderBy(desc(jobLeads.score), desc(jobLeads.capturedAt))
    .all();
  if (statusFilter && STATUS_JA[statusFilter]) {
    rows = rows.filter((r) => r.status === statusFilter);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">求人Inbox</h1>
          <p className="mt-1 text-sm text-muted">
            Chrome拡張または手動URLから取り込んだ求人リード。求人化したものはInboxから消え、企業・求人側に残ります。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {["", "new", "triaged", "rejected", "snoozed"].map((s) => (
            <Link
              key={s || "all"}
              href={s ? `/admin/job-inbox?status=${s}` : "/admin/job-inbox"}
              className={`rounded-full px-3 py-1 ${
                (statusFilter || "") === s
                  ? "bg-frog text-white"
                  : "bg-surface-2 text-muted hover:text-ink"
              }`}
            >
              {s ? STATUS_JA[s] : "すべて"}
            </Link>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          入力が不足しています。
        </div>
      )}
      {deleted && (
        <div className="rounded-md bg-accent-soft p-3 text-sm text-frog-dark">
          リードを削除しました。
        </div>
      )}

      <form action={createManualJobLead} className="card grid gap-3 p-6 sm:grid-cols-2">
        <h2 className="font-semibold text-ink sm:col-span-2">手動で追加（URL）</h2>
        <input
          name="sourceUrl"
          type="url"
          required
          placeholder="https://www.linkedin.com/jobs/view/..."
          className={`${inputCls} sm:col-span-2`}
        />
        <input name="companyName" placeholder="会社名" className={inputCls} />
        <input name="title" placeholder="求人タイトル" className={inputCls} />
        <input name="location" placeholder="勤務地" className={inputCls} />
        <textarea
          name="description"
          placeholder="概要（任意）"
          rows={2}
          className={`${inputCls} sm:col-span-2`}
        />
        <div className="sm:col-span-2">
          <button className="btn-primary px-5 py-2 text-sm">Inboxに追加</button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2">スコア</th>
              <th className="px-4 py-2">求人</th>
              <th className="px-4 py-2">ソース</th>
              <th className="px-4 py-2">状態</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  まだリードがありません。拡張で求人ページから保存するか、上のフォームでURLを追加してください。
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-3 font-mono text-xs text-ink">{r.score}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">
                    {r.titleRaw || "(タイトル未取得)"}
                  </p>
                  <p className="text-xs text-muted">
                    {r.companyNameRaw || "—"}
                    {r.locationRaw ? ` · ${r.locationRaw}` : ""}
                    {` · ${r.salaryCurrency || "CAD"}`}
                  </p>
                </td>
                <td className="px-4 py-3 text-xs text-muted">{r.source}</td>
                <td className="px-4 py-3 text-xs">{STATUS_JA[r.status] ?? r.status}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/admin/job-inbox/${r.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      詳細
                    </Link>
                    <form action={deleteJobLead}>
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmSubmitButton
                        className="text-xs text-danger hover:underline"
                        message={`「${r.titleRaw || r.sourceUrl}」をInboxから削除します。よろしいですか？`}
                      >
                        削除
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-dashed border-line p-4 text-xs text-muted">
        <p className="font-medium text-ink">Chrome拡張の接続</p>
        <p className="mt-1">
          拡張は<strong>取り込み専用</strong>です（タイトル・会社・勤務地・本文の生データ）。
          読みやすい整形は後でAI／手動で行う想定です。
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>
            <code className="rounded bg-surface-2 px-1">chrome-extension/</code>{" "}
            を Chrome の「パッケージ化されていない拡張機能」として読み込む
          </li>
          <li>
            拡張オプションに API Base{" "}
            <code className="rounded bg-surface-2 px-1">http://localhost:3005</code>{" "}
            と JOB_INBOX_TOKEN を設定
          </li>
          <li>LinkedIn / Indeed / Glassdoor の求人ページで拡張アイコンをクリック</li>
        </ol>
      </div>
    </div>
  );
}
