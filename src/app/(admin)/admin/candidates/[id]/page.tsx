import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import {
  users,
  candidateProfiles,
  recommendations,
  companies,
  jobs,
  candidateFeedback,
  candidateConsents,
  accessGrants,
  viewAudit,
} from "@/lib/db/schema";
import { buildEmployerCandidateView } from "@/lib/employer/candidate-dto";
import { CandidateView } from "@/components/candidate/CandidateView";
import { WORK_AUTH_LABELS, ENGLISH_LABELS } from "@/lib/candidate/profile";
import {
  INTEREST_LABELS_JA,
  DECLINE_REASON_LABELS_JA,
  parseDeclineReasons,
  type InterestLevel,
} from "@/lib/employer/feedback";
import { formatDateTime } from "@/lib/date";
import {
  setCandidateStatus,
  saveRecommendation,
  deleteRecommendation,
  revokeGrant,
} from "@/lib/admin/actions";

const inputCls =
  "w-full rounded-md border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

type RecRow = typeof recommendations.$inferSelect & { companyName: string | null };
type JobRow = typeof jobs.$inferSelect;
type CompanyRow = typeof companies.$inferSelect;

const AUDIT_LABEL: Record<string, string> = {
  view_list: "一覧閲覧",
  view_detail: "詳細閲覧",
  view_resume: "レジュメ閲覧",
  download_resume: "レジュメDL",
  preview_pdf: "レジュメ表示",
};

export default async function AdminCandidateDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  await requireAdmin();
  const { id: userId } = await params;
  const { preview } = await searchParams;
  const db = await getD1Db();

  const user = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.role, "candidate")))
    .get();
  if (!user) notFound();

  const profile = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, userId))
    .get();
  if (!profile) notFound();

  const companyList = await db.select().from(companies).orderBy(companies.name).all();
  const jobList = await db.select().from(jobs).all();
  const recs: RecRow[] = await db
    .select({
      ...recommendationsCols(),
      companyName: companies.name,
    })
    .from(recommendations)
    .leftJoin(companies, eq(recommendations.companyId, companies.id))
    .where(eq(recommendations.candidateProfileId, profile.id))
    .orderBy(desc(recommendations.updatedAt))
    .all();

  const feedback = await db
    .select({
      id: candidateFeedback.id,
      companyId: candidateFeedback.companyId,
      companyName: companies.name,
      employerEmail: users.email,
      interest: candidateFeedback.interest,
      wantsInterview: candidateFeedback.wantsInterview,
      questionsMd: candidateFeedback.questionsMd,
      declineReasons: candidateFeedback.declineReasons,
      declineNote: candidateFeedback.declineNote,
      updatedAt: candidateFeedback.updatedAt,
    })
    .from(candidateFeedback)
    .leftJoin(companies, eq(candidateFeedback.companyId, companies.id))
    .leftJoin(users, eq(candidateFeedback.employerUserId, users.id))
    .where(eq(candidateFeedback.candidateProfileId, profile.id))
    .orderBy(desc(candidateFeedback.updatedAt))
    .all();

  const consents = await db
    .select({
      id: candidateConsents.id,
      scope: candidateConsents.scope,
      companyName: companies.name,
      consentedAt: candidateConsents.consentedAt,
      revokedAt: candidateConsents.revokedAt,
    })
    .from(candidateConsents)
    .leftJoin(companies, eq(candidateConsents.companyId, companies.id))
    .where(eq(candidateConsents.candidateProfileId, profile.id))
    .orderBy(desc(candidateConsents.consentedAt))
    .all();

  const grants = await db
    .select({
      id: accessGrants.id,
      employerEmail: users.email,
      companyName: companies.name,
      companyId: accessGrants.companyId,
      grantedAt: accessGrants.grantedAt,
      expiresAt: accessGrants.expiresAt,
      revokedAt: accessGrants.revokedAt,
      canDownloadResume: accessGrants.canDownloadResume,
    })
    .from(accessGrants)
    .innerJoin(users, eq(accessGrants.employerUserId, users.id))
    .leftJoin(companies, eq(accessGrants.companyId, companies.id))
    .where(eq(accessGrants.candidateProfileId, profile.id))
    .orderBy(desc(accessGrants.grantedAt))
    .all();

  const recentAudit = await db
    .select({
      action: viewAudit.action,
      companyName: companies.name,
      createdAt: viewAudit.createdAt,
    })
    .from(viewAudit)
    .leftJoin(companies, eq(viewAudit.companyId, companies.id))
    .where(eq(viewAudit.candidateProfileId, profile.id))
    .orderBy(desc(viewAudit.createdAt))
    .limit(8)
    .all();

  const previewCompanyId =
    preview && preview !== "general" ? preview : null;
  const view = await buildEmployerCandidateView(db, profile.id, {
    includeUnsharedRecommendation: true,
    companyId: previewCompanyId,
  });

  const activeConsent = consents.some((c) => !c.revokedAt);
  const liveRecs = recs.filter(
    (r) => r.status === "published" && r.visibility === "shared"
  );
  const activeGrants = grants.filter(
    (g) =>
      !g.revokedAt && (!g.expiresAt || g.expiresAt.getTime() > Date.now())
  );
  const hasResume = !!profile.resumeKey;
  const displayName = profile.displayName ?? user.name ?? "候補者";
  const blockers: string[] = [];
  if (user.status !== "approved") blockers.push("未承認");
  if (!activeConsent) blockers.push("共有未同意");
  if (!hasResume) blockers.push("レジュメなし");
  if (liveRecs.length === 0) blockers.push("公開共有の推薦なし");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/admin/candidates"
          className="text-sm text-primary hover:underline"
        >
          ← 候補者一覧へ
        </Link>
        <nav className="flex flex-wrap gap-3 text-xs">
          <a href="#readiness" className="text-muted hover:text-ink">
            準備状況
          </a>
          <a href="#feedback" className="text-muted hover:text-ink">
            FB ({feedback.length})
          </a>
          <a href="#recs" className="text-muted hover:text-ink">
            推薦 ({recs.length})
          </a>
          <a href="#access" className="text-muted hover:text-ink">
            権限・同意
          </a>
          <a href="#preview" className="text-muted hover:text-ink">
            プレビュー
          </a>
        </nav>
      </div>

      {/* Sticky readiness */}
      <div
        id="readiness"
        className="sticky top-0 z-20 -mx-4 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-ink sm:text-2xl">
              {displayName}
            </h1>
            <p className="text-sm text-muted">
              {user.email}
              {profile.headline ? ` · ${profile.headline}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusPill status={user.status} />
              <Flag ok={activeConsent} yes="共有同意あり" no="共有未同意" />
              <Flag ok={hasResume} yes="レジュメあり" no="レジュメなし" />
              <Flag
                ok={liveRecs.length > 0}
                yes={`公開推薦 ${liveRecs.length}`}
                no="公開推薦なし"
              />
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink">
                有効権限 {activeGrants.length}
              </span>
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink">
                完成度 {profile.completeness}%
              </span>
            </div>
            {blockers.length > 0 && (
              <p className="mt-2 text-xs text-amber-800">
                紹介ブロック要因: {blockers.join(" / ")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {user.status === "approved" && (
              <form action="/api/admin/view-as" method="post">
                <input type="hidden" name="as" value="candidate" />
                <input type="hidden" name="userId" value={user.id} />
                <button
                  type="submit"
                  className="rounded-md border border-frog/30 bg-accent-soft px-3 py-2 text-sm font-medium text-frog-dark hover:bg-frog/10"
                >
                  候補者として見る
                </button>
              </form>
            )}
            <Link
              href={`/admin/grants?candidate=${profile.id}`}
              className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-surface-2"
            >
              権限を付与
            </Link>
            {user.status !== "approved" && (
              <form action={setCandidateStatus}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="status" value="approved" />
                <button className="btn-primary px-3 py-2 text-sm">承認する</button>
              </form>
            )}
            {user.status === "pending" && (
              <form action={setCandidateStatus}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="status" value="rejected" />
                <button className="rounded-md border border-danger/30 px-3 py-2 text-sm text-danger hover:bg-red-50">
                  却下
                </button>
              </form>
            )}
            <form action={setCandidateStatus} className="flex items-center gap-1.5">
              <input type="hidden" name="userId" value={user.id} />
              <select
                name="status"
                defaultValue={user.status}
                className="rounded-md border border-line px-2 py-2 text-sm"
              >
                <option value="pending">承認待ち</option>
                <option value="approved">承認済み</option>
                <option value="rejected">却下</option>
              </select>
              <button className="rounded-md border border-line px-3 py-2 text-sm hover:bg-surface-2">
                更新
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Profile snapshot */}
      <section className="card grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Meta
          label="就労資格"
          value={
            profile.workAuthStatus
              ? WORK_AUTH_LABELS[profile.workAuthStatus] ?? profile.workAuthStatus
              : "—"
          }
        />
        <Meta
          label="英語"
          value={
            profile.englishLevel
              ? ENGLISH_LABELS[profile.englishLevel] ?? profile.englishLevel
              : "—"
          }
        />
        <Meta
          label="希望勤務地"
          value={profile.locationPreference ?? profile.locationCurrent ?? "—"}
        />
        <Meta
          label="レジュメ"
          value={
            hasResume
              ? profile.resumeFileName ?? "アップロード済み"
              : "未アップロード"
          }
        />
        <Meta
          label="経験年数"
          value={
            profile.yearsExperience != null
              ? `${profile.yearsExperience}年`
              : "—"
          }
        />
        <Meta label="稼働" value={profile.availability ?? "—"} />
        <Meta
          label="希望年収"
          value={salaryLabel(profile)}
        />
        <Meta
          label="最終更新"
          value={formatDateTime(profile.updatedAt)}
        />
      </section>

      {/* Feedback */}
      <section id="feedback" className="space-y-3">
        <h2 className="font-semibold text-ink">
          企業からのフィードバック
          <span className="ml-2 text-sm font-normal text-muted">
            {feedback.length}件
          </span>
        </h2>
        {feedback.length === 0 ? (
          <p className="text-sm text-muted">まだ企業からのフィードバックはありません。</p>
        ) : (
          feedback.map((f) => <FeedbackCard key={f.id} f={f} />)
        )}
      </section>

      {/* Recommendations */}
      <section id="recs" className="space-y-4">
        <div>
          <h2 className="font-semibold text-ink">Frog の推薦（会社別）</h2>
          <p className="text-xs text-muted">
            企業に表示されるのは「公開」かつ「企業に共有」の推薦のみ。汎用は会社専用が無いときのフォールバックです。
          </p>
        </div>

        {recs.map((rec) => (
          <RecommendationCard
            key={rec.id}
            rec={rec}
            profileId={profile.id}
            companies={companyList}
            jobs={jobList.filter((j) => j.companyId === rec.companyId)}
            activeGrantCount={
              activeGrants.filter(
                (g) => !rec.companyId || g.companyId === rec.companyId
              ).length
            }
            hasConsent={activeConsent}
          />
        ))}

        <details className="card p-6">
          <summary className="cursor-pointer font-semibold text-ink">
            ＋ 会社向けの推薦を追加
          </summary>
          <form action={saveRecommendation} className="mt-4 space-y-4">
            <input type="hidden" name="candidateProfileId" value={profile.id} />
            <label className="block sm:max-w-xs">
              <span className="mb-1 block text-sm font-medium text-ink">
                対象の会社
              </span>
              <select name="companyId" defaultValue="" className={inputCls}>
                <option value="">汎用（全企業）</option>
                {companyList.map((co) => (
                  <option key={co.id} value={co.id}>
                    {co.name}
                  </option>
                ))}
              </select>
            </label>
            <RecommendationFields />
            <RecommendationControls />
          </form>
        </details>
      </section>

      {/* Access: consent + grants + audit */}
      <section id="access" className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink">共有同意</h2>
            <Link
              href="/admin/grants"
              className="text-xs text-primary hover:underline"
            >
              権限管理へ
            </Link>
          </div>
          {consents.length === 0 ? (
            <p className="text-sm text-muted">同意記録がありません。</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {consents.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start justify-between gap-2 border-b border-line pb-2 last:border-0"
                >
                  <div>
                    <p className="text-ink">
                      {c.scope === "share_with_employers"
                        ? "全企業向け共有"
                        : `企業別: ${c.companyName ?? "—"}`}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateTime(c.consentedAt)}
                    </p>
                  </div>
                  {c.revokedAt ? (
                    <span className="text-xs text-danger">撤回済</span>
                  ) : (
                    <span className="text-xs text-frog-dark">有効</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink">閲覧権限</h2>
            <Link
              href={`/admin/grants?candidate=${profile.id}`}
              className="text-xs text-primary hover:underline"
            >
              付与する
            </Link>
          </div>
          {grants.length === 0 ? (
            <p className="text-sm text-muted">まだ閲覧権限がありません。</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {grants.map((g) => {
                const inactive =
                  g.revokedAt ||
                  (g.expiresAt && g.expiresAt.getTime() <= Date.now());
                return (
                  <li
                    key={g.id}
                    className="flex items-start justify-between gap-2 border-b border-line pb-2 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-ink">
                        {g.companyName ?? "—"}
                      </p>
                      <p className="text-xs text-muted">
                        {g.employerEmail}
                        {g.canDownloadResume ? " · レジュメ可" : " · レジュメ不可"}
                      </p>
                    </div>
                    <div className="text-right">
                      {g.revokedAt ? (
                        <span className="text-xs text-danger">失効</span>
                      ) : inactive ? (
                        <span className="text-xs text-muted">期限切れ</span>
                      ) : (
                        <span className="text-xs text-frog-dark">有効</span>
                      )}
                      {!g.revokedAt && (
                        <form action={revokeGrant} className="mt-1">
                          <input type="hidden" name="id" value={g.id} />
                          <button className="text-[11px] text-danger hover:underline">
                            失効
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {!activeConsent && activeGrants.length > 0 && (
            <p className="mt-3 text-xs text-amber-800">
              有効な権限がありますが、共有同意が無いため企業側には表示されません。
            </p>
          )}
          {activeConsent && liveRecs.length === 0 && activeGrants.length > 0 && (
            <p className="mt-3 text-xs text-amber-800">
              公開共有の推薦が無いため、企業側の実効アクセスは成立しません。
            </p>
          )}
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink">最近の閲覧</h2>
            <Link href="/admin/audit" className="text-xs text-primary hover:underline">
              監査ログへ
            </Link>
          </div>
          {recentAudit.length === 0 ? (
            <p className="text-sm text-muted">この候補者の閲覧記録はまだありません。</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="pb-1">日時</th>
                  <th className="pb-1">企業</th>
                  <th className="pb-1">操作</th>
                </tr>
              </thead>
              <tbody>
                {recentAudit.map((a, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-1.5 text-muted">
                      {formatDateTime(a.createdAt)}
                    </td>
                    <td className="py-1.5 text-ink">{a.companyName ?? "—"}</td>
                    <td className="py-1.5 text-ink">
                      {AUDIT_LABEL[a.action] ?? a.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Preview */}
      <section id="preview">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-ink">企業に見える内容（プレビュー）</h2>
          <span className="text-xs text-muted">表示する会社:</span>
          <PreviewLink
            userId={user.id}
            value="general"
            label="汎用"
            active={!previewCompanyId}
          />
          {companyList.map((co) => (
            <PreviewLink
              key={co.id}
              userId={user.id}
              value={co.id}
              label={co.name}
              active={previewCompanyId === co.id}
            />
          ))}
        </div>
        {!activeConsent && (
          <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            共有同意が無いため、実際の企業ポータルではこの候補者は表示されません（プレビューは確認用）。
          </p>
        )}
        {view ? (
          <div className="rounded-xl border border-line bg-surface p-4 sm:p-6">
            <CandidateView view={view} companyName={
              previewCompanyId
                ? companyList.find((c) => c.id === previewCompanyId)?.name
                : null
            } />
          </div>
        ) : (
          <p className="text-sm text-muted">プレビューを生成できませんでした。</p>
        )}
      </section>
    </div>
  );
}

function salaryLabel(p: typeof candidateProfiles.$inferSelect): string {
  if (!p.desiredSalaryMin && !p.desiredSalaryMax) return "—";
  const fmt = (n: number) => n.toLocaleString("en-US");
  const lo = p.desiredSalaryMin ? fmt(p.desiredSalaryMin) : "";
  const hi = p.desiredSalaryMax ? fmt(p.desiredSalaryMax) : "";
  const range = lo && hi ? `${lo} – ${hi}` : lo || hi;
  return `${range} ${p.salaryCurrency}`;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-ink">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const label =
    status === "approved"
      ? "承認済み"
      : status === "rejected"
        ? "却下"
        : "承認待ち";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs ${
        status === "approved"
          ? "bg-emerald-50 text-emerald-700"
          : status === "rejected"
            ? "bg-red-50 text-red-700"
            : "bg-amber-50 text-amber-700"
      }`}
    >
      {label}
    </span>
  );
}

function Flag({
  ok,
  yes,
  no,
}: {
  ok: boolean;
  yes: string;
  no: string;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs ${
        ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
      }`}
    >
      {ok ? yes : no}
    </span>
  );
}

function recommendationsCols() {
  return {
    id: recommendations.id,
    candidateProfileId: recommendations.candidateProfileId,
    companyId: recommendations.companyId,
    jobId: recommendations.jobId,
    strengthsMd: recommendations.strengthsMd,
    considerationsMd: recommendations.considerationsMd,
    internalNotesMd: recommendations.internalNotesMd,
    status: recommendations.status,
    visibility: recommendations.visibility,
    authoredBy: recommendations.authoredBy,
    publishedAt: recommendations.publishedAt,
    updatedAt: recommendations.updatedAt,
    createdAt: recommendations.createdAt,
  };
}

function PreviewLink({
  userId,
  value,
  label,
  active,
}: {
  userId: string;
  value: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={`/admin/candidates/${userId}?preview=${value}#preview`}
      className={`rounded-full px-3 py-1 text-xs ${
        active ? "bg-primary text-white" : "bg-surface-2 text-ink hover:bg-line"
      }`}
    >
      {label}
    </Link>
  );
}

function RecommendationCard({
  rec,
  profileId,
  companies: companyList,
  jobs: companyJobs,
  activeGrantCount,
  hasConsent,
}: {
  rec: RecRow;
  profileId: string;
  companies: CompanyRow[];
  jobs: JobRow[];
  activeGrantCount: number;
  hasConsent: boolean;
}) {
  const isLive = rec.status === "published" && rec.visibility === "shared";
  return (
    <div id={`rec-${rec.id}`} className="card p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-ink">
          {rec.companyName ?? "汎用（全企業）"}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs ${
              isLive
                ? "bg-emerald-50 text-emerald-700"
                : rec.status === "published"
                  ? "bg-surface-2 text-muted"
                  : "bg-amber-50 text-amber-700"
            }`}
          >
            {isLive
              ? "企業に公開中"
              : rec.status === "published"
                ? "公開（社内のみ）"
                : "下書き"}
          </span>
          <span className="text-xs text-muted">
            権限{activeGrantCount} · {hasConsent ? "同意あり" : "未同意"}
          </span>
        </div>
      </div>
      <form action={saveRecommendation} className="space-y-4">
        <input type="hidden" name="candidateProfileId" value={profileId} />
        <input type="hidden" name="recId" value={rec.id} />
        <label className="block sm:max-w-xs">
          <span className="mb-1 block text-xs text-muted">対象の会社</span>
          <select
            name="companyId"
            defaultValue={rec.companyId ?? ""}
            className={inputCls}
          >
            <option value="">汎用（全企業）</option>
            {companyList.map((co) => (
              <option key={co.id} value={co.id}>
                {co.name}
              </option>
            ))}
          </select>
        </label>
        {companyJobs.length > 0 && (
          <label className="block sm:max-w-xs">
            <span className="mb-1 block text-xs text-muted">
              対象ポジション（任意）
            </span>
            <select
              name="jobId"
              defaultValue={rec.jobId ?? ""}
              className={inputCls}
            >
              <option value="">指定なし</option>
              {companyJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <RecommendationFields rec={rec} />
        <RecommendationControls rec={rec} />
      </form>
      <form action={deleteRecommendation} className="mt-2">
        <input type="hidden" name="id" value={rec.id} />
        <input type="hidden" name="candidateProfileId" value={profileId} />
        <button className="text-xs text-danger hover:underline">
          この推薦を削除
        </button>
      </form>
    </div>
  );
}

function RecommendationFields({ rec }: { rec?: RecRow }) {
  return (
    <>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">
          推薦ポイント（企業に表示・Markdown 可）
        </span>
        <textarea
          name="strengthsMd"
          rows={5}
          defaultValue={rec?.strengthsMd ?? ""}
          className={inputCls}
          placeholder={"例:\n- **強み:** 説明\n- **強み:** 説明"}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">
          留意点（企業に表示・Markdown 可）
        </span>
        <textarea
          name="considerationsMd"
          rows={4}
          defaultValue={rec?.considerationsMd ?? ""}
          className={inputCls}
          placeholder={"例:\n- **留意点:** 説明"}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">
          社内メモ（企業には表示されません）
        </span>
        <textarea
          name="internalNotesMd"
          rows={2}
          defaultValue={rec?.internalNotesMd ?? ""}
          className={`${inputCls} bg-surface-2`}
          placeholder="Frog 内部のみ"
        />
      </label>
    </>
  );
}

function RecommendationControls({ rec }: { rec?: RecRow }) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="block">
        <span className="mb-1 block text-xs text-muted">ステータス</span>
        <select
          name="status"
          defaultValue={rec?.status ?? "draft"}
          className={inputCls}
        >
          <option value="draft">下書き</option>
          <option value="published">公開</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">公開範囲</span>
        <select
          name="visibility"
          defaultValue={rec?.visibility ?? "internal_only"}
          className={inputCls}
        >
          <option value="internal_only">社内のみ</option>
          <option value="shared">企業に共有</option>
        </select>
      </label>
      <button type="submit" className="btn-primary px-6 py-2.5">
        保存
      </button>
    </div>
  );
}

type FeedbackRow = {
  id: string;
  companyId: string | null;
  companyName: string | null;
  employerEmail: string | null;
  interest: InterestLevel;
  wantsInterview: boolean;
  questionsMd: string | null;
  declineReasons: string | null;
  declineNote: string | null;
  updatedAt: Date;
};

function interestBadgeCls(interest: InterestLevel): string {
  switch (interest) {
    case "interested":
      return "bg-emerald-50 text-emerald-700";
    case "maybe":
      return "bg-amber-50 text-amber-700";
    case "not_interested":
      return "bg-red-50 text-red-700";
    default:
      return "bg-surface-2 text-muted";
  }
}

function FeedbackCard({ f }: { f: FeedbackRow }) {
  const reasons = parseDeclineReasons(f.declineReasons);
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">
            {f.companyName ? (
              <Link
                href="/admin/companies"
                className="hover:underline"
              >
                {f.companyName}
              </Link>
            ) : (
              "—"
            )}
          </p>
          <p className="text-xs text-muted">
            {f.employerEmail ? (
              <Link href="/admin/employers" className="hover:underline">
                {f.employerEmail}
              </Link>
            ) : (
              "—"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${interestBadgeCls(
              f.interest
            )}`}
          >
            {INTEREST_LABELS_JA[f.interest]}
          </span>
          {f.wantsInterview && (
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-frog-dark">
              面接希望
            </span>
          )}
        </div>
      </div>

      {f.interest !== "not_interested" && f.questionsMd && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted">
            聞きたいこと / 追加情報
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-ink">
            {f.questionsMd}
          </p>
        </div>
      )}

      {f.interest === "not_interested" &&
        (reasons.length > 0 || f.declineNote) && (
          <div className="mt-3 space-y-2">
            {reasons.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {reasons.map((code) => (
                  <span
                    key={code}
                    className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink"
                  >
                    {DECLINE_REASON_LABELS_JA[code] ?? code}
                  </span>
                ))}
              </div>
            )}
            {f.declineNote && (
              <p className="whitespace-pre-line text-sm text-ink">
                {f.declineNote}
              </p>
            )}
          </div>
        )}

      <p className="mt-3 text-xs text-muted">
        更新: {formatDateTime(f.updatedAt)}
      </p>
    </div>
  );
}
