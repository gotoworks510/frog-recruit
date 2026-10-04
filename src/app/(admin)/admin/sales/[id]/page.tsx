import Link from "next/link";
import { SalesDisclosureLink } from "@/components/admin/SalesDisclosureLink";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireSalesAdmin as requireAdmin } from "@/lib/sales/auth";
import { getD1Db } from "@/lib/db/client";
import { companies, jobs, salesProspects, salesActivities } from "@/lib/db/schema";
import { ProspectForm, ActivityForm, DraftPanel, SalesJobForm } from "@/components/admin/SalesForms";
import { KINDS, REASONS, STAGES, externalHref } from "@/lib/sales/model";

export default async function SalesDetail({params}:{params:Promise<{id:string}>}) {
  await requireAdmin();
  const {id}=await params, db=await getD1Db();
  const row=await db.select().from(salesProspects).where(eq(salesProspects.id,id)).get().catch(()=>{throw new Error("営業先を読み込めませんでした。");});
  if(!row) notFound();
  const [company, jobList, history]=await Promise.all([
    db.select({name:companies.name}).from(companies).where(eq(companies.id,row.companyId)).get(),
    db.select({id:jobs.id,title:jobs.title}).from(jobs).where(eq(jobs.companyId,row.companyId)).all(),
    db.select().from(salesActivities).where(eq(salesActivities.prospectId,id)).orderBy(desc(salesActivities.createdAt),desc(salesActivities.id)).all(),
  ]).catch(()=>{throw new Error("営業履歴を読み込めませんでした。");});
  return <>
    <header className="sales-identity"><Link href="/admin/sales" className="sales-back">← 営業一覧</Link><div className="sales-identity-row"><span className="sales-avatar" aria-hidden="true">{company?.name.slice(0,1)}</span><div><p className="sales-eyebrow">COMPANY RELATIONSHIP</p><h1>{company?.name}</h1><p>{row.domain} · 担当 {row.owner||"未設定"}</p></div><span className="sales-tag">{STAGES[row.stage as keyof typeof STAGES]}</span></div></header>
    <div className="sales-next"><span className="sales-dot"/><div><strong>{row.stopped?"連絡停止中":row.nextAction||"次の行動を決めましょう"}</strong><p>期限 {row.dueDate??"未設定"}</p></div><SalesDisclosureLink target="edit-prospect">確認・編集 →</SalesDisclosureLink></div>
    {row.stopped&&<p role="status" className="sales-stop">連絡停止中 · {row.stopReason} — 相手からの再開依頼を記録するまで、次の連絡は設定できません。</p>}
    <div className="sales-workspace"><div className="sales-main">
      <section className="sales-section"><div className="sales-section-heading"><h2>接点を記録</h2><span>スタッフ専用</span></div><ActivityForm key={row.version} row={row}/></section>
      <section className="sales-section"><div className="sales-section-heading"><h2>企業別の履歴</h2><span>{history.length}件</span></div><ol className="sales-timeline">{history.map(a=><li key={a.id}><div className="sales-history-meta"><strong>{KINDS[a.kind as keyof typeof KINDS]??a.kind}</strong><time>{a.occurredOn}</time><span>{a.minutes}分</span></div><p>{a.summary}</p>{a.reason&&<small>理由: {REASONS[a.reason as keyof typeof REASONS]??a.reason}</small>}{externalHref(a.sourceUrl)&&<a href={externalHref(a.sourceUrl)} target="_blank" rel="noreferrer">原文を開く ↗</a>}<small>{a.templateVersion||"文面版なし"}</small></li>)}</ol></section>
      <details className="sales-disclosure"><summary>英文下書き・追送文を確認</summary><div className="sales-disclosure-body"><DraftPanel row={row}/></div></details>
      <details id="edit-prospect" className="sales-disclosure"><summary>担当者・求人ニーズ・次の行動を編集</summary><div className="sales-disclosure-body"><ProspectForm key={row.version} row={row} companyName={company?.name} jobs={jobList}/></div></details>
      {!row.jobId&&<details className="sales-disclosure"><summary>受領した求人を登録</summary><div className="sales-disclosure-body"><SalesJobForm key={row.version} row={row}/></div></details>}
    </div><aside className="sales-rail"><h2>企業の情報</h2><dl><dt>窓口</dt><dd>{row.contactName||"担当者未確認"}<small>{row.contactRole}</small></dd><dt>メール</dt><dd>{row.contactEmail||"未登録"}</dd><dt>連絡先の確認</dt><dd>{row.contactBasis||"送信根拠を確認してください"}</dd><dt>求人ニーズ・確認事項</dt><dd className="whitespace-pre-wrap">{row.needs||"会話を通じて確認しましょう"}</dd></dl><p className="sales-private-note">このメモはスタッフ専用です。求人として共有する内容は別途確認します。</p><div className="sales-related"><h2>次のステップ</h2><Link href={`/admin/companies?highlight=${row.companyId}`}>企業・求人を確認 →</Link><Link href="/admin/candidates">候補者・既存推薦を確認 →</Link><Link href="/admin/grants">同意確認後の閲覧権限管理 →</Link></div></aside></div>
  </>;
}
