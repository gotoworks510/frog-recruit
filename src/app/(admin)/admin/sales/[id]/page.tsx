import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { companies, jobs, salesProspects, salesActivities } from "@/lib/db/schema";
import { ProspectForm, ActivityForm, DraftPanel, SalesJobForm } from "@/components/admin/SalesForms";
import { KINDS, REASONS, STAGES } from "@/lib/sales/model";

export default async function SalesDetail({params}:{params:Promise<{id:string}>}) {
  await requireAdmin();
  const {id}=await params, db=await getD1Db();
  const row=await db.select().from(salesProspects).where(eq(salesProspects.id,id)).get();
  if(!row) notFound();
  const [company, jobList, history]=await Promise.all([
    db.select().from(companies).where(eq(companies.id,row.companyId)).get(),
    db.select({id:jobs.id,title:jobs.title}).from(jobs).where(eq(jobs.companyId,row.companyId)).all(),
    db.select().from(salesActivities).where(eq(salesActivities.prospectId,id)).orderBy(desc(salesActivities.createdAt),desc(salesActivities.id)).all(),
  ]);
  return <>
    <header><Link href="/admin/sales" className="text-sm underline">← 営業一覧</Link><h1 className="text-2xl mt-2">{company?.name}</h1><p className="text-sm text-muted">{row.domain} · {STAGES[row.stage as keyof typeof STAGES]}</p></header>
    {row.stopped && <div role="status" className="border border-danger rounded-lg p-4 text-danger">連絡停止中 · {row.stopReason}<p>次の連絡は、相手からの再開依頼を記録するまで設定できません。</p></div>}
    <div className="flex flex-wrap gap-3 text-sm"><Link className="btn-outline" href={`/admin/companies?highlight=${row.companyId}`}>企業・求人を確認</Link><Link className="btn-outline" href="/admin/candidates">候補者・既存推薦を確認</Link><Link className="btn-outline" href="/admin/grants">同意確認後の閲覧権限管理</Link></div>
    <section className="card p-5"><h2 className="text-lg mb-4">担当者・求人ニーズ・次の行動</h2><ProspectForm key={row.version} row={row} companyName={company?.name} jobs={jobList}/></section>
    <DraftPanel row={row}/>
    <SalesJobForm key={`job-${row.version}`} row={row}/>
    <section className="card p-5"><h2 className="text-lg mb-4">接点を記録</h2><ActivityForm key={row.version} row={row}/></section>
    <section className="card p-5"><h2 className="text-lg mb-4">企業別の履歴</h2><ol className="space-y-4">{history.map(a=><li key={a.id} className="border-l-2 border-line pl-4"><p className="text-xs text-muted">{a.occurredOn} · {KINDS[a.kind as keyof typeof KINDS]??a.kind} · {a.minutes}分 · {a.templateVersion || "文面版なし"}</p><p className="whitespace-pre-wrap text-sm mt-1">{a.summary}</p>{a.reason && <p className="text-sm">理由: {REASONS[a.reason as keyof typeof REASONS]??a.reason}</p>}{a.sourceUrl && <a className="text-sm underline" href={a.sourceUrl} target="_blank" rel="noreferrer">原文を開く</a>}</li>)}</ol></section>
  </>;
}
