import Link from "next/link";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import {
  users,
  companies,
  accessGrants,
  viewAudit,
  candidateProfiles,
} from "@/lib/db/schema";
import { formatDateTime } from "@/lib/date";

async function c(q: Promise<{ c: number }[]>): Promise<number> {
  const r = await q;
  return r[0]?.c ?? 0;
}

const AUDIT_LABEL: Record<string, string> = {
  view_list: "一覧閲覧",
  view_detail: "詳細閲覧",
  view_resume: "レジュメ閲覧",
  download_resume: "レジュメDL",
  preview_pdf: "レジュメ表示",
};

export default async function AdminDashboard() {
  await requireAdmin();
  const db = await getD1Db();

  const candidatesTotal = await c(
    db.select({ c: count() }).from(users).where(eq(users.role, "candidate")).all()
  );
  const pending = await c(
    db
      .select({ c: count() })
      .from(users)
      .where(and(eq(users.role, "candidate"), eq(users.status, "pending")))
      .all()
  );
  const companiesTotal = await c(db.select({ c: count() }).from(companies).all());
  const employersTotal = await c(
    db.select({ c: count() }).from(users).where(eq(users.role, "employer")).all()
  );
  const activeGrants = await c(
    db.select({ c: count() }).from(accessGrants).where(isNull(accessGrants.revokedAt)).all()
  );

  const recent = await db
    .select({
      action: viewAudit.action,
      actorRole: viewAudit.actorRole,
      companyId: viewAudit.companyId,
      candidateName: candidateProfiles.displayName,
      createdAt: viewAudit.createdAt,
    })
    .from(viewAudit)
    .leftJoin(candidateProfiles, eq(viewAudit.candidateProfileId, candidateProfiles.id))
    .orderBy(desc(viewAudit.createdAt))
    .limit(12)
    .all();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-ink">ダッシュボード</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="候補者" value={candidatesTotal} href="/admin/candidates" />
        <Stat label="承認待ち" value={pending} href="/admin/candidates" highlight={pending > 0} />
        <Stat label="企業" value={companiesTotal} href="/admin/companies" />
        <Stat label="企業アカウント" value={employersTotal} href="/admin/employers" />
        <Stat label="有効な閲覧権限" value={activeGrants} href="/admin/grants" />
      </div>

      <div className="card p-6">
        <h2 className="mb-4 font-semibold text-ink">最近の閲覧アクティビティ</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">まだアクティビティはありません。</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="pb-2">日時</th>
                <th className="pb-2">操作</th>
                <th className="pb-2">候補者</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-2 text-muted">{formatDateTime(r.createdAt)}</td>
                  <td className="py-2 text-ink">{AUDIT_LABEL[r.action] ?? r.action}</td>
                  <td className="py-2 text-ink">{r.candidateName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
  highlight,
}: {
  label: string;
  value: number;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`card p-4 transition hover:border-primary ${
        highlight ? "ring-1 ring-amber-300" : ""
      }`}
    >
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${highlight ? "text-amber-600" : "text-ink"}`}>
        {value}
      </p>
    </Link>
  );
}
