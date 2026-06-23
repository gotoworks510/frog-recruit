import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { companies, jobs } from "@/lib/db/schema";
import {
  createCompany,
  createJob,
  updateCompany,
  deleteCompany,
  updateJob,
  deleteJob,
} from "@/lib/admin/actions";

const inputCls =
  "w-full rounded-md border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

export default async function AdminCompanies() {
  await requireAdmin();
  const db = await getD1Db();
  const companyRows = await db
    .select()
    .from(companies)
    .orderBy(desc(companies.createdAt))
    .all();
  const jobRows = await db.select().from(jobs).all();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-ink">企業・求人</h1>

      {/* Create company */}
      <form action={createCompany} className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="font-semibold text-ink sm:col-span-2">企業を追加</h2>
        <input name="name" placeholder="企業名 *" required className={inputCls} />
        <input name="slug" placeholder="スラッグ（英小文字）*" required className={inputCls} />
        <input name="domain" placeholder="ドメイン（例: palm.com）" className={inputCls} />
        <input name="description" placeholder="説明" className={inputCls} />
        <div className="sm:col-span-2">
          <button className="btn-primary px-6 py-2.5">追加</button>
        </div>
      </form>

      <div className="space-y-4">
        {companyRows.map((co) => {
          const coJobs = jobRows.filter((j) => j.companyId === co.id);
          return (
            <div key={co.id} className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-ink">
                    {co.name}
                    {co.status === "archived" && (
                      <span className="ml-2 rounded bg-surface-2 px-2 py-0.5 text-xs text-muted">
                        アーカイブ
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-muted">
                    {co.slug}
                    {co.domain ? ` ・ ${co.domain}` : ""}
                  </p>
                </div>
              </div>

              {/* Jobs */}
              <div className="mt-4 space-y-2">
                {coJobs.map((j) => (
                  <div key={j.id} className="rounded-md border border-line p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-ink">
                        {j.title}
                        {j.salaryMin || j.salaryMax ? (
                          <span className="ml-2 text-xs text-muted">
                            {j.salaryMin?.toLocaleString()} – {j.salaryMax?.toLocaleString()}{" "}
                            {j.salaryCurrency}
                          </span>
                        ) : null}
                        {j.status !== "open" && (
                          <span className="ml-2 text-xs text-muted">
                            （{j.status === "filled" ? "充足" : "クローズ"}）
                          </span>
                        )}
                      </p>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-primary">
                        求人を編集
                      </summary>
                      <form action={updateJob} className="mt-3 grid gap-3 sm:grid-cols-2">
                        <input type="hidden" name="id" value={j.id} />
                        <input name="title" defaultValue={j.title} placeholder="求人タイトル *" required className={inputCls} />
                        <input name="location" defaultValue={j.location ?? ""} placeholder="勤務地" className={inputCls} />
                        <input name="salaryMin" type="number" defaultValue={j.salaryMin ?? ""} placeholder="年収下限" className={inputCls} />
                        <input name="salaryMax" type="number" defaultValue={j.salaryMax ?? ""} placeholder="年収上限" className={inputCls} />
                        <input name="workAuthRequirement" defaultValue={j.workAuthRequirement ?? ""} placeholder="就労資格要件" className={inputCls} />
                        <div className="grid grid-cols-2 gap-3">
                          <select name="salaryCurrency" defaultValue={j.salaryCurrency} className={inputCls}>
                            <option value="USD">USD</option>
                            <option value="CAD">CAD</option>
                            <option value="JPY">JPY</option>
                          </select>
                          <select name="status" defaultValue={j.status} className={inputCls}>
                            <option value="open">募集中</option>
                            <option value="filled">充足</option>
                            <option value="closed">クローズ</option>
                          </select>
                        </div>
                        <textarea name="description" defaultValue={j.description ?? ""} placeholder="求人内容" rows={4} className={`${inputCls} sm:col-span-2`} />
                        <div className="flex items-center justify-between sm:col-span-2">
                          <button className="btn-primary px-5 py-2 text-sm">求人を更新</button>
                        </div>
                      </form>
                      <form action={deleteJob} className="mt-2">
                        <input type="hidden" name="id" value={j.id} />
                        <button className="text-xs text-danger hover:underline">この求人を削除</button>
                      </form>
                    </details>
                  </div>
                ))}
                {coJobs.length === 0 && (
                  <p className="text-xs text-muted">求人はまだありません。</p>
                )}
              </div>

              {/* Add job */}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-primary">求人を追加</summary>
                <form action={createJob} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="companyId" value={co.id} />
                  <input name="title" placeholder="求人タイトル *" required className={inputCls} />
                  <input name="location" placeholder="勤務地" className={inputCls} />
                  <input name="salaryMin" type="number" placeholder="年収下限" className={inputCls} />
                  <input name="salaryMax" type="number" placeholder="年収上限" className={inputCls} />
                  <input name="workAuthRequirement" placeholder="就労資格要件" className={inputCls} />
                  <select name="salaryCurrency" defaultValue="USD" className={inputCls}>
                    <option value="USD">USD</option>
                    <option value="CAD">CAD</option>
                    <option value="JPY">JPY</option>
                  </select>
                  <textarea name="description" placeholder="求人内容" rows={2} className={`${inputCls} sm:col-span-2`} />
                  <div className="sm:col-span-2">
                    <button className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2">
                      求人を追加
                    </button>
                  </div>
                </form>
              </details>

              {/* Edit company */}
              <details className="mt-2 border-t border-line pt-3">
                <summary className="cursor-pointer text-sm text-muted">企業情報を編集</summary>
                <form action={updateCompany} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={co.id} />
                  <input name="name" defaultValue={co.name} placeholder="企業名 *" required className={inputCls} />
                  <input name="slug" defaultValue={co.slug} placeholder="スラッグ *" required className={inputCls} />
                  <input name="domain" defaultValue={co.domain ?? ""} placeholder="ドメイン" className={inputCls} />
                  <select name="status" defaultValue={co.status} className={inputCls}>
                    <option value="active">有効</option>
                    <option value="archived">アーカイブ</option>
                  </select>
                  <textarea name="description" defaultValue={co.description ?? ""} placeholder="説明" rows={3} className={`${inputCls} sm:col-span-2`} />
                  <div className="flex items-center justify-between sm:col-span-2">
                    <button className="btn-primary px-5 py-2 text-sm">企業を更新</button>
                  </div>
                </form>
                <form action={deleteCompany} className="mt-2">
                  <input type="hidden" name="id" value={co.id} />
                  <button className="text-xs text-danger hover:underline">
                    この企業を削除（求人・閲覧権限も削除されます）
                  </button>
                </form>
              </details>
            </div>
          );
        })}
        {companyRows.length === 0 && (
          <p className="text-sm text-muted">まだ企業が登録されていません。</p>
        )}
      </div>
    </div>
  );
}
