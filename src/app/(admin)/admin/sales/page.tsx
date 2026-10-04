import Link from "next/link";
import { SalesDisclosureLink } from "@/components/admin/SalesDisclosureLink";
import { desc, eq } from "drizzle-orm";
import { requireSalesAdmin as requireAdmin } from "@/lib/sales/auth";
import { getD1Db } from "@/lib/db/client";
import { companies, salesProspects, salesActivities } from "@/lib/db/schema";
import { REASONS } from "@/lib/sales/model";
import { ProspectForm } from "@/components/admin/SalesForms";
import { SalesList } from "@/components/admin/SalesList";

export default async function SalesPage({searchParams}:{searchParams:Promise<{view?:string}>}) {
  await requireAdmin();
  const db = await getD1Db(), {view} = await searchParams;
  const [rows, companyList, activity] = await Promise.all([
    db.select({prospect:salesProspects,company:companies}).from(salesProspects).innerJoin(companies,eq(salesProspects.companyId,companies.id)).orderBy(desc(salesProspects.updatedAt)).all(),
    db.select({id:companies.id,name:companies.name}).from(companies).where(eq(companies.status,"active")).all(),
    db.select({prospectId:salesActivities.prospectId,kind:salesActivities.kind,occurredOn:salesActivities.occurredOn,minutes:salesActivities.minutes,reason:salesActivities.reason,templateVersion:salesActivities.templateVersion}).from(salesActivities).all(),
  ]).catch(()=>{throw new Error("営業一覧を読み込めませんでした。");});
  const today=new Date().toISOString().slice(0,10), from=new Date(Date.now()-28*86400000).toISOString().slice(0,10);
  const due=rows.filter(({prospect:p})=>!p.stopped && p.stage!=="closed" && p.dueDate && p.dueDate<=today);
  const missing=rows.filter(({prospect:p})=>!p.stopped && !["closed","later"].includes(p.stage) && !p.dueDate);
  const list=(view==="today"?due:view==="unscheduled"?missing:rows).map(({company:c,prospect:p})=>({id:p.id,name:c.name,domain:p.domain,contactName:p.contactName,owner:p.owner,stage:p.stage,stopped:p.stopped,nextAction:p.nextAction,dueDate:p.dueDate}));
  const recent=activity.filter(a=>a.occurredOn>=from && a.occurredOn<=today);
  const contacted=new Set(recent.filter(a=>a.kind==="sent").map(a=>a.prospectId));
  const contactDates=new Map(recent.filter(a=>a.kind==="sent").map(a=>[a.prospectId,a.occurredOn]));
  const responses=activity.filter(a=>["reply","needs"].includes(a.kind) && contactDates.has(a.prospectId) && a.occurredOn>=contactDates.get(a.prospectId)!);
  const replied=new Set(responses.map(a=>a.prospectId));
  return <>
    <header className="sales-heading"><div><p className="sales-eyebrow">FROG RECRUIT / RELATIONSHIPS</p><h1>営業・関係づくり</h1><p>企業との会話を、次の紹介につなげる。</p></div><SalesDisclosureLink className="btn-outline" target="new-prospect">＋ 見込み企業を登録</SalesDisclosureLink></header>
    <nav className="sales-tabs" aria-label="営業先の表示"><Link aria-current={view==="today"?"page":undefined} href="/admin/sales?view=today">今日の対応 <span>{due.length}</span></Link><Link aria-current={view==="unscheduled"?"page":undefined} href="/admin/sales?view=unscheduled">次の行動を決める <span>{missing.length}</span></Link><Link aria-current={!view?"page":undefined} href="/admin/sales">すべて <span>{rows.length}</span></Link></nav>
    <SalesList rows={list}/>
    <details id="new-prospect" className="sales-disclosure"><summary>見込み企業を登録（ログインアカウントは発行しません）</summary><div className="sales-disclosure-body"><ProspectForm companies={companyList}/></div></details>
    <details id="review" className="sales-disclosure"><summary>活動の振り返り · 過去28日</summary><section className="sales-disclosure-body space-y-4"><p className="text-xs text-muted">{from}〜{today}（UTC）。初回接触企業を母集団に、その後の返信を数えます。返信がまだ届く途中の企業を含みます。</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["初回接触企業",contacted.size],["その企業からの返信",replied.size],["求人受領（期間内）",new Set(recent.filter(a=>a.kind==="needs").map(a=>a.prospectId)).size],["記録工数（分）",recent.reduce((s,a)=>s+a.minutes,0)]].map(([label,value])=><div key={label} className="rounded-lg bg-surface p-3"><p className="text-xs text-muted">{label}</p><p className="text-2xl font-semibold">{value}</p></div>)}</div>
      <div className="flex flex-wrap gap-3 text-sm">{Object.entries(REASONS).filter(([k])=>k).map(([k,v])=>{const n=recent.filter(a=>a.reason===k).length;return n?<span key={k}>{v}: {n}件</span>:null;})}</div>
      <p className="text-sm">文面版ごとの初回接触・返信・工数を比較し、次のバッチで変える項目は1つに絞ります。返信理由を企業別履歴で確認してください。</p>
      <ul className="text-sm space-y-2">{[...new Set(recent.filter(a=>a.kind==="sent").map(a=>a.templateVersion))].map(v=>{const ids=new Set(recent.filter(a=>a.kind==="sent"&&a.templateVersion===v).map(a=>a.prospectId));const replies=new Set(responses.filter(a=>ids.has(a.prospectId)).map(a=>a.prospectId));return <li key={v}>{v}: 初回 {ids.size}社 / 返信 {replies.size}社 / 期間内工数 {recent.filter(a=>ids.has(a.prospectId)).reduce((s,a)=>s+a.minutes,0)}分</li>;})}</ul>
    </section></details>
  </>;
}
