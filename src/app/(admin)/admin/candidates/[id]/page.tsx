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
} from "@/lib/db/schema";
import { buildEmployerCandidateView } from "@/lib/employer/candidate-dto";
import { CandidateView } from "@/components/candidate/CandidateView";
import {
  setCandidateStatus,
  saveRecommendation,
  deleteRecommendation,
} from "@/lib/admin/actions";

const inputCls =
  "w-full rounded-md border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

type RecRow = typeof recommendations.$inferSelect & { companyName: string | null };
type JobRow = typeof jobs.$inferSelect;
type CompanyRow = typeof companies.$inferSelect;

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
    .select({ id: users.id, name: users.name, email: users.email, status: users.status })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.role, "candidate")))
    .get();
  if (!user) notFound();

  const profile = await db
    .select({ id: candidateProfiles.id })
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

  // Preview: which company would see what. "general" or a companyId.
  const previewCompanyId =
    preview && preview !== "general" ? preview : null;
  const view = await buildEmployerCandidateView(db, profile.id, {
    includeUnsharedRecommendation: true,
    companyId: previewCompanyId,
  });

  return (
    <div className="space-y-6">
      <Link href="/admin/candidates" className="text-sm text-primary hover:underline">
        ← 候補者一覧へ
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{user.name ?? "候補者"}</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <form action={setCandidateStatus} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <select name="status" defaultValue={user.status} className={inputCls}>
            <option value="pending">承認待ち</option>
            <option value="approved">承認済み</option>
            <option value="rejected">却下</option>
          </select>
          <button className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2">
            更新
          </button>
        </form>
      </div>

      {/* Per-company recommendations */}
      <section className="space-y-4">
        <div>
          <h2 className="font-semibold text-ink">Frog の推薦（会社別）</h2>
          <p className="text-xs text-muted">
            紹介する会社ごとに推薦内容を作成できます。企業に表示されるのは「公開」かつ「企業に共有」を満たす推薦のみ。会社を「汎用（全企業）」にすると、専用の推薦が無い会社への共通フォールバックになります。
          </p>
        </div>

        {recs.map((rec) => (
          <RecommendationCard
            key={rec.id}
            rec={rec}
            profileId={profile.id}
            companies={companyList}
            jobs={jobList.filter((j) => j.companyId === rec.companyId)}
          />
        ))}

        {/* Add recommendation for a company */}
        <details className="card p-6">
          <summary className="cursor-pointer font-semibold text-ink">
            ＋ 会社向けの推薦を追加
          </summary>
          <form action={saveRecommendation} className="mt-4 space-y-4">
            <input type="hidden" name="candidateProfileId" value={profile.id} />
            <label className="block sm:max-w-xs">
              <span className="mb-1 block text-sm font-medium text-ink">対象の会社</span>
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

      {/* Employer-facing preview */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-ink">企業に見える内容（プレビュー）</h2>
          <span className="text-xs text-muted">表示する会社:</span>
          <PreviewLink userId={user.id} value="general" label="汎用" active={!previewCompanyId} />
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
        {view ? (
          <CandidateView view={view} />
        ) : (
          <p className="text-sm text-muted">プレビューを生成できませんでした。</p>
        )}
      </section>
    </div>
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
      href={`/admin/candidates/${userId}?preview=${value}`}
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
}: {
  rec: RecRow;
  profileId: string;
  companies: CompanyRow[];
  jobs: JobRow[];
}) {
  const isLive = rec.status === "published" && rec.visibility === "shared";
  return (
    <div className="card p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-ink">
          {rec.companyName ?? "汎用（全企業）"}
        </h3>
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
      </div>
      <form action={saveRecommendation} className="space-y-4">
        <input type="hidden" name="candidateProfileId" value={profileId} />
        <input type="hidden" name="recId" value={rec.id} />
        <label className="block sm:max-w-xs">
          <span className="mb-1 block text-xs text-muted">対象の会社</span>
          <select name="companyId" defaultValue={rec.companyId ?? ""} className={inputCls}>
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
            <span className="mb-1 block text-xs text-muted">対象ポジション（任意）</span>
            <select name="jobId" defaultValue={rec.jobId ?? ""} className={inputCls}>
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
        <button className="text-xs text-danger hover:underline">この推薦を削除</button>
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
        <select name="status" defaultValue={rec?.status ?? "draft"} className={inputCls}>
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
