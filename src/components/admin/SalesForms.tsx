"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSales, saveSales, addSalesActivity, addSalesJob, type SalesResult } from "@/lib/sales/actions";
import { STAGES, KINDS, REASONS, TEMPLATE_VERSION, storyDraft, followupDraft } from "@/lib/sales/model";
import type { SalesProspect } from "@/lib/db/schema/sales";

function Field({ label, name, value = "", type = "text", required = false }: { label:string; name:string; value?:string | null; type?:string; required?:boolean }) {
  return <label className="block text-sm">{label}<input className="input-field mt-1" name={name} defaultValue={value ?? ""} type={type} required={required} /></label>;
}
function Feedback({ state, pending }: {state:SalesResult; pending:boolean}) {
  return <div aria-live="polite">{state.error && <p role="alert" className="text-danger">{state.error}</p>}{state.saved && <p>保存しました。</p>}<button className="btn-primary mt-3" disabled={pending}>{pending ? "保存中…" : "保存する"}</button></div>;
}
export function ProspectForm({ row, companyName = "", companies = [], jobs = [] }: { row?:SalesProspect; companyName?:string; companies?:{id:string;name:string}[]; jobs?:{id:string;title:string}[] }) {
  const [state, action, pending] = useActionState(row ? saveSales : createSales, {});
  const router = useRouter();
  useEffect(() => { if (state.id) router.push(`/admin/sales/${state.id}`); else if (state.saved) router.refresh(); }, [state,router]);
  return <form action={action} className="grid gap-4 sm:grid-cols-2">
    {row && <><input type="hidden" name="id" value={row.id}/><input type="hidden" name="version" value={row.version}/></>}
    {row ? <><input type="hidden" name="companyName" value={companyName}/><input type="hidden" name="companyId" value={row.companyId}/><input type="hidden" name="domain" value={row.domain}/></> : <>
      <Field label="企業名 *" name="companyName" required/><Field label="企業ドメイン *（例 example.com）" name="domain" required/>
      <label className="text-sm">既存企業に紐づける<select name="companyId" className="input-field mt-1"><option value="">ドメインで照合／新規作成</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    </>}
    <Field label="担当者" name="contactName" value={row?.contactName}/><Field label="役割" name="contactRole" value={row?.contactRole}/>
    <Field label="メール（任意）" name="contactEmail" value={row?.contactEmail} type="email"/><Field label="連絡先の出典URL" name="contactSourceUrl" value={row?.contactSourceUrl} type="url"/>
    <Field label="連絡経路・送信根拠・確認日" name="contactBasis" value={row?.contactBasis}/><Field label="担当スタッフ" name="owner" value={row?.owner}/>
    <Field label="求人・採用ページURL" name="jobUrl" value={row?.jobUrl} type="url"/>
    <label className="text-sm">既存求人<select className="input-field mt-1" name="jobId" defaultValue={row?.jobId ?? ""}><option value="">未受領／未登録</option>{jobs.map(j=><option key={j.id} value={j.id}>{j.title}</option>)}</select></label>
    <label className="text-sm">段階<select name="stage" className="input-field mt-1" defaultValue={row?.stage ?? "research"}>{Object.entries(STAGES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <Field label="次の行動" name="nextAction" value={row?.nextAction}/><Field label="期限（日付）" name="dueDate" value={row?.dueDate} type="date"/>
    <label className="text-sm sm:col-span-2">冒頭の英文1文（求人との確認済みの関連）<textarea className="input-field mt-1" name="openingLine" rows={2} defaultValue={row?.openingLine}/></label>
    <label className="text-sm sm:col-span-2">求人ニーズ・確認事項（給与、勤務地、就労資格、必須経験、採用時期、未確認事項）<textarea className="input-field mt-1" name="needs" rows={4} defaultValue={row?.needs}/></label>
    <div className="sm:col-span-2"><Feedback state={state} pending={pending}/></div>
  </form>;
}
export function ActivityForm({ row }: {row:SalesProspect}) {
  const [state, action, pending] = useActionState(addSalesActivity, {});
  const router = useRouter();
  useEffect(()=>{ if(state.saved) router.refresh(); },[state,router]);
  return <form action={action} className="grid gap-3 sm:grid-cols-2">
    <input type="hidden" name="id" value={row.id}/><input type="hidden" name="version" value={row.version}/>
    <label className="text-sm">活動<select name="kind" className="input-field mt-1">{Object.entries(KINDS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <Field label="実行日（UTC基準）" name="occurredOn" type="date" value={new Date().toISOString().slice(0,10)} required/>
    <label className="text-sm sm:col-span-2">要点・次の判断 *<textarea className="input-field mt-1" name="summary" rows={3} required/></label>
    <Field label="メール・返信・求人原文へのリンク" name="sourceUrl" type="url"/>
    <label className="text-sm">反応の理由<select name="reason" className="input-field mt-1">{Object.entries(REASONS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <Field label="文面版（送信記録は必須）" name="templateVersion" value={TEMPLATE_VERSION}/><Field label="作業時間（分）" name="minutes" type="number" value="0"/>
    <label className="text-sm sm:col-span-2"><input type="checkbox" name="approved"/> 送信記録：宛先・根拠・拒否履歴・求人継続を確認し、実際に手動送信済み。再開記録：相手の再開依頼を確認済み。</label>
    <p className="text-xs text-muted sm:col-span-2">記録は追記のみ。誤記は訂正メモを追加してください。この画面からメールは送信されません。返信・停止を記録すると追送候補を解除します。</p>
    <Feedback state={state} pending={pending}/>
  </form>;
}
export function DraftPanel({ row }: {row:SalesProspect}) {
  const [copied,setCopied] = useState(false);
  const [copyError,setCopyError] = useState(false);
  const draft = storyDraft(row.openingLine,row.contactName);
  return <section className="card p-5 space-y-3"><h2 className="text-lg">英文下書き · {TEMPLATE_VERSION}</h2>
    <p className="text-sm text-muted">保存した冒頭1文を反映。送信前に氏名・住所・返信先を補完し、全文を確認してください。700名以上はコミュニティの規模であり、現在紹介できる人数ではありません。</p>
    <textarea aria-label="初回英文下書き" readOnly value={draft} className="input-field" rows={16}/>
    <button type="button" className="btn-outline" onClick={async()=>{ try { await navigator.clipboard.writeText(draft);setCopied(true);setCopyError(false); } catch { setCopyError(true); } }}>{copied ? "コピーしました" : "下書きをコピー"}</button>
    {copyError && <p role="alert">コピーできませんでした。上の本文を選択してコピーしてください。</p>}
    <details><summary className="cursor-pointer text-sm">追送候補（送信前に人が確認）</summary><pre className="whitespace-pre-wrap mt-3 text-sm">{followupDraft()}</pre></details>
  </section>;
}
export function SalesJobForm({row}:{row:SalesProspect}) {
  const [state,action,pending]=useActionState(addSalesJob,{});
  const router=useRouter();
  useEffect(()=>{if(state.saved)router.refresh();},[state,router]);
  if(row.jobId)return null;
  return <form action={action} className="card p-5 space-y-3"><h2 className="text-lg">受領した求人を登録</h2><p className="text-sm">上の求人ニーズを保存後、既存の企業・求人モデルへ登録します。候補者共有やアカウント発行は行いません。</p><input type="hidden" name="id" value={row.id}/><input type="hidden" name="version" value={row.version}/><Field label="求人名 *" name="title" required/><Feedback state={state} pending={pending}/></form>;
}
