"use client";
import { useState } from "react";
import Link from "next/link";
import { STAGES } from "@/lib/sales/model";

export type SalesListRow = { id:string; name:string; domain:string; contactName:string; owner:string; stage:string; stopped:boolean; nextAction:string; dueDate:string|null };
/** Search stays in this authorized page, never in URLs or access logs. */
export function SalesList({rows}:{rows:SalesListRow[]}) {
  const [query,setQuery]=useState("");
  const filtered=rows.filter(r=>`${r.name} ${r.domain} ${r.contactName} ${r.owner}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="sales-list">
    <div className="sales-list-tools"><label>企業を検索<input className="input-field" type="search" value={query} onChange={e=>setQuery(e.target.value)} aria-label="企業・ドメイン・担当者で検索" placeholder="企業名、ドメイン、担当スタッフ" autoComplete="off"/></label><span>{filtered.length}社</span></div>
    <table><thead><tr><th>企業・担当者</th><th>段階</th><th>次の行動</th><th>期限</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}>
      <td><Link className="sales-company" href={`/admin/sales/${r.id}`}>{r.name}</Link><small>{r.contactName || "担当者未確認"} · {r.owner || "担当未設定"}</small></td>
      <td data-label="段階"><span className="sales-tag">{STAGES[r.stage as keyof typeof STAGES]??r.stage}</span>{r.stopped&&<small className="text-danger">連絡停止</small>}</td>
      <td data-label="次の行動">{r.stopped ? STAGES.stopped : r.nextAction||"次の行動を決める"}</td><td data-label="期限"><time>{r.dueDate??"未設定"}</time></td>
    </tr>)}</tbody></table>
    {!filtered.length&&<p className="sales-empty">該当する企業はありません。表示条件を変更するか、見込み企業を登録してください。</p>}
  </section>;
}
