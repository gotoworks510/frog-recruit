import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { viewAudit, candidateProfiles, companies } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/date";

const AUDIT_LABEL: Record<string, string> = {
  view_list: "一覧閲覧",
  view_detail: "詳細閲覧",
  view_resume: "レジュメ閲覧",
  download_resume: "レジュメDL",
  preview_pdf: "レジュメ表示",
};

export default async function AdminAudit() {
  await requireAdmin();
  const db = await getD1Db();

  const rows = await db
    .select({
      action: viewAudit.action,
      actorRole: viewAudit.actorRole,
      companyName: companies.name,
      candidateName: candidateProfiles.displayName,
      ip: viewAudit.ip,
      createdAt: viewAudit.createdAt,
    })
    .from(viewAudit)
    .leftJoin(companies, eq(viewAudit.companyId, companies.id))
    .leftJoin(candidateProfiles, eq(viewAudit.candidateProfileId, candidateProfiles.id))
    .orderBy(desc(viewAudit.createdAt))
    .limit(200)
    .all();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">監査ログ</h1>
      <p className="text-sm text-muted">
        候補者情報・レジュメの閲覧履歴（直近200件）。追記専用です。
      </p>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2">日時</th>
              <th className="px-4 py-2">企業</th>
              <th className="px-4 py-2">操作</th>
              <th className="px-4 py-2">候補者</th>
              <th className="px-4 py-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  まだ記録がありません。
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-4 py-2 text-muted">{formatDateTime(r.createdAt)}</td>
                <td className="px-4 py-2 text-ink">{r.companyName ?? "—"}</td>
                <td className="px-4 py-2 text-ink">{AUDIT_LABEL[r.action] ?? r.action}</td>
                <td className="px-4 py-2 text-ink">{r.candidateName ?? "—"}</td>
                <td className="px-4 py-2 text-xs text-muted">{r.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
