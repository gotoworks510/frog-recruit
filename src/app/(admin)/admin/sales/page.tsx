import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { companies, salesProspects, salesActivities } from "@/lib/db/schema";
import { STAGES, REASONS } from "@/lib/sales/model";
import { ProspectForm } from "@/components/admin/SalesForms";

export default async function SalesPage({searchParams}:{searchParams:Promise<{view?:string;q?:string}>}) {
  await requireAdmin();
  const db = await getD1Db(), {view,q=""} = await searchParams;
  const [rows, companyList, activity] = await Promise.all([
    db.select({prospect:salesProspects,company:companies}).from(salesProspects).innerJoin(companies,eq(salesProspects.companyId,companies.id)).orderBy(desc(salesProspects.updatedAt)).all(),
    db.select({id:companies.id,name:companies.name}).from(companies).where(eq(companies.status,"active")).all(),
    db.select().from(salesActivities).all(),
  ]);
  const today=new Date().toISOString().slice(0,10), from=new Date(Date.now()-28*86400000).toISOString().slice(0,10);
  const due=rows.filter(({prospect:p})=>!p.stopped && p.stage!=="closed" && p.dueDate && p.dueDate<=today);
  const missing=rows.filter(({prospect:p})=>!p.stopped && !["closed","later"].includes(p.stage) && !p.dueDate);
  const list=(view==="today"?due:view==="unscheduled"?missing:rows).filter(({company:c,prospect:p})=>`${c.name} ${p.domain} ${p.owner}`.toLowerCase().includes(q.toLowerCase()));
  const recent=activity.filter(a=>a.occurredOn>=from && a.occurredOn<=today);
  const contacted=new Set(recent.filter(a=>a.kind==="sent").map(a=>a.prospectId));
  const contactDates=new Map(recent.filter(a=>a.kind==="sent").map(a=>[a.prospectId,a.occurredOn]));
  const responses=activity.filter(a=>["reply","needs"].includes(a.kind) && contactDates.has(a.prospectId) && a.occurredOn>=contactDates.get(a.prospectId)!);
  const replied=new Set(responses.map(a=>a.prospectId));
  return <>
    <header><p className="text-sm text-muted">Frog Recruit / スタッフ専用</p><h1 className="text-2xl mt-1">営業・関係づくり</h1><p className="text-sm mt-2">ストーリーを伝える → 求人ニーズを聞く → 条件を確認 → 人材を探す → 推薦へ。送信・共有は担当者が行います。</p></header>
    <nav className="flex flex-wrap gap-3"><Link className="btn-outline" href="/admin/sales?view=today">今日の対応 {due.length}</Link><Link className="btn-outline" href="/admin/sales?view=unscheduled">次の行動を決める {missing.length}</Link><Link className="btn-outline" href="/admin/sales">すべて {rows.length}</Link><a className="btn-outline" href="#review">振り返り</a></nav>
    <form className="flex gap-2"><input type="hidden" name="view" value={view??""}/><input className="input-field" name="q" defaultValue={q} aria-label="企業・ドメイン・担当者で検索" placeholder="企業・ドメイン・担当者で検索"/><button className="btn-outline">検索</button></form>
    <section className="card overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b border-line">{["企業・担当","段階","次の行動","期限"].map(t=><th key={t} className="p-3">{t}</th>)}</tr></thead><tbody>{list.map(({prospect:p,company:c})=><tr key={p.id} className="border-b border-line"><td className="p-3"><Link className="font-semibold underline" href={`/admin/sales/${p.id}`}>{c.name}</Link><p className="text-xs text-muted">{p.contactName || "担当者未確認"} · {p.owner || "担当未設定"}</p></td><td className="p-3">{STAGES[p.stage as keyof typeof STAGES] ?? p.stage}{p.stopped && <span className="block text-danger">送信対象外</span>}</td><td className="p-3 min-w-48">{p.nextAction || "未設定"}</td><td className="p-3 whitespace-nowrap">{p.dueDate ?? "—"}</td></tr>)}</tbody></table>{!list.length && <p className="p-6 text-muted">該当する営業先はありません。新規登録するか表示条件を変更してください。</p>}</section>
    <details className="card p-5"><summary className="font-semibold cursor-pointer">見込み企業を登録（ログインアカウントは発行しません）</summary><div className="mt-4"><ProspectForm companies={companyList}/></div></details>
    <section id="review" className="card p-5 space-y-4"><h2 className="text-lg">少量バッチの振り返り · 過去28日</h2><p className="text-xs text-muted">{from}〜{today}（UTC）。初回接触企業を母集団に、その後の返信を数えます。返信がまだ届く途中の企業を含みます。</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["初回接触企業",contacted.size],["その企業からの返信",replied.size],["求人受領（期間内）",new Set(recent.filter(a=>a.kind==="needs").map(a=>a.prospectId)).size],["記録工数（分）",recent.reduce((s,a)=>s+a.minutes,0)]].map(([label,value])=><div key={label} className="rounded-lg bg-surface p-3"><p className="text-xs text-muted">{label}</p><p className="text-2xl font-semibold">{value}</p></div>)}</div>
      <div className="flex flex-wrap gap-3 text-sm">{Object.entries(REASONS).filter(([k])=>k).map(([k,v])=>{const n=recent.filter(a=>a.reason===k).length;return n?<span key={k}>{v}: {n}件</span>:null;})}</div>
      <p className="text-sm">文面版ごとの初回接触・返信・工数を比較し、次のバッチで変える項目は1つに絞ります。返信理由を企業別履歴で確認してください。</p>
      <ul className="text-sm space-y-2">{[...new Set(recent.filter(a=>a.kind==="sent").map(a=>a.templateVersion))].map(v=>{const ids=new Set(recent.filter(a=>a.kind==="sent"&&a.templateVersion===v).map(a=>a.prospectId));const replies=new Set(responses.filter(a=>ids.has(a.prospectId)).map(a=>a.prospectId));return <li key={v}>{v}: 初回 {ids.size}社 / 返信 {replies.size}社 / 期間内工数 {recent.filter(a=>ids.has(a.prospectId)).reduce((s,a)=>s+a.minutes,0)}分</li>;})}</ul>
    </section>
  </>;
}
