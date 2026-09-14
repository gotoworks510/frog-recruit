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
  candidateInvites,
  jobLeads,
  candidateFeedback,
  candidateConsents,
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

  const [
    candidatesTotal,
    pending,
    companiesTotal,
    employersTotal,
    activeGrants,
    invitePending,
    inboxNew,
    interviewFb,
  ] = await Promise.all([
    c(db.select({ c: count() }).from(users).where(eq(users.role, "candidate")).all()),
    c(
      db
        .select({ c: count() })
        .from(users)
        .where(and(eq(users.role, "candidate"), eq(users.status, "pending")))
        .all()
    ),
    c(db.select({ c: count() }).from(companies).all()),
    c(db.select({ c: count() }).from(users).where(eq(users.role, "employer")).all()),
    c(db.select({ c: count() }).from(accessGrants).where(isNull(accessGrants.revokedAt)).all()),
    c(
      db
        .select({ c: count() })
        .from(candidateInvites)
        .where(eq(candidateInvites.status, "invited"))
        .all()
    ),
    c(db.select({ c: count() }).from(jobLeads).where(eq(jobLeads.status, "new")).all()),
    c(
      db
        .select({ c: count() })
        .from(candidateFeedback)
        .where(eq(candidateFeedback.wantsInterview, true))
        .all()
    ),
  ]);

  const approvedProfiles = await db
    .select({ id: candidateProfiles.id })
    .from(candidateProfiles)
    .innerJoin(users, eq(candidateProfiles.userId, users.id))
    .where(eq(users.status, "approved"))
    .all();
  const approvedIds = approvedProfiles.map((p) => p.id);
  let noConsent = 0;
  if (approvedIds.length > 0) {
    const active = await db
      .select({ candidateProfileId: candidateConsents.candidateProfileId })
      .from(candidateConsents)
      .where(isNull(candidateConsents.revokedAt))
      .all();
    const set = new Set(active.map((a) => a.candidateProfileId));
    noConsent = approvedIds.filter((id) => !set.has(id)).length;
  }

  const recent = await db
    .select({
      action: viewAudit.action,
      companyName: companies.name,
      candidateName: candidateProfiles.displayName,
      candidateUserId: candidateProfiles.userId,
      createdAt: viewAudit.createdAt,
    })
    .from(viewAudit)
    .leftJoin(candidateProfiles, eq(viewAudit.candidateProfileId, candidateProfiles.id))
    .leftJoin(companies, eq(viewAudit.companyId, companies.id))
    .orderBy(desc(viewAudit.createdAt))
    .limit(12)
    .all();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">ダッシュボード</h1>
        <p className="mt-1 text-sm text-muted">
          今日のオペレーション用サマリー。カードをクリックして該当一覧へ。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="承認待ち"
          value={pending}
          href="/admin/candidates?filter=pending"
          highlight={pending > 0}
        />
        <Stat
          label="面接希望FB"
          value={interviewFb}
          href="/admin/candidates?filter=interview"
          highlight={interviewFb > 0}
        />
        <Stat
          label="未同意（承認済）"
          value={noConsent}
          href="/admin/candidates?filter=no_consent"
          highlight={noConsent > 0}
        />
        <Stat
          label="求人Inbox（新規）"
          value={inboxNew}
          href="/admin/job-inbox?status=new"
          highlight={inboxNew > 0}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="候補者" value={candidatesTotal} href="/admin/candidates" />
        <Stat label="招待中" value={invitePending} href="/admin/invites" />
        <Stat label="企業" value={companiesTotal} href="/admin/companies" />
        <Stat label="企業アカウント" value={employersTotal} href="/admin/employers" />
        <Stat label="有効な閲覧権限" value={activeGrants} href="/admin/grants" />
      </div>

      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-ink">最近の閲覧アクティビティ</h2>
          <Link href="/admin/audit" className="text-xs text-primary hover:underline">
            すべて見る
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">まだアクティビティはありません。</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="pb-2">日時</th>
                <th className="pb-2">企業</th>
                <th className="pb-2">操作</th>
                <th className="pb-2">候補者</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-2 text-muted">{formatDateTime(r.createdAt)}</td>
                  <td className="py-2 text-ink">{r.companyName ?? "—"}</td>
                  <td className="py-2 text-ink">
                    {AUDIT_LABEL[r.action] ?? r.action}
                  </td>
                  <td className="py-2 text-ink">
                    {r.candidateUserId ? (
                      <Link
                        href={`/admin/candidates/${r.candidateUserId}`}
                        className="text-primary hover:underline"
                      >
                        {r.candidateName ?? "候補者"}
                      </Link>
                    ) : (
                      r.candidateName ?? "—"
                    )}
                  </td>
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
      <p
        className={`mt-1 text-2xl font-bold ${
          highlight ? "text-amber-600" : "text-ink"
        }`}
      >
        {value}
      </p>
    </Link>
  );
}
