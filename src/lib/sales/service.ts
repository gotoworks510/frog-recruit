import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { companies, jobs, salesProspects, salesActivities } from "../db/schema";
import type { SalesProspect } from "../db/schema/sales";
import { activityInput, prospectInput, addBusinessDays, normalizeDomain, STAGES } from "./model";

export async function createProspect(db: Database, raw: unknown, actorId: string) {
  const input = prospectInput.parse(raw);
  if (Boolean(input.nextAction) !== Boolean(input.dueDate)) throw new Error("次の行動と期限を両方入力してください");
  const duplicate = await db.select().from(salesProspects).where(eq(salesProspects.domain, input.domain)).get();
  if (duplicate) return duplicate.id;
  const allCompanies = await db.select().from(companies).all();
  const matches = allCompanies.filter(c => { try { return c.domain && normalizeDomain(c.domain) === input.domain; } catch { return false; } });
  if (!input.companyId && matches.length > 1) throw new Error("同じドメインの既存企業が複数あります。企業を選択してください");
  const company = input.companyId ? allCompanies.find(c => c.id === input.companyId) : matches[0];
  if (input.companyId && !company) throw new Error("企業が見つかりません");
  if (company?.status === "archived") throw new Error("アーカイブ企業は先に企業画面で確認してください");
  if (company?.domain && normalizeDomain(company.domain) !== input.domain) throw new Error("既存企業のドメインと一致しません");
  if (company) {
    const existing = await db.select().from(salesProspects).where(eq(salesProspects.companyId, company.id)).get();
    if (existing) return existing.id;
  }
  const id = crypto.randomUUID(), companyId = company?.id ?? crypto.randomUUID(), now = new Date();
  await validateJob(db, input.jobId, companyId);
  const { companyName, companyId: ignored, ...fields } = input;
  void ignored;
  const insert = db.insert(salesProspects).values({ ...fields, id, companyId, stage: "research", jobId: input.jobId || null, jobUrl: input.jobUrl || null, contactSourceUrl: input.contactSourceUrl || null, dueDate: input.dueDate || null, createdAt: now, updatedAt: now });
  const log = db.insert(salesActivities).values({ id: crypto.randomUUID(), prospectId: id, kind: "note", summary: "営業管理に登録（アカウント発行・送信なし）", actorId, occurredOn: now.toISOString().slice(0,10), createdAt: now });
  if (company) await db.batch([insert, log]);
  else await db.batch([db.insert(companies).values({ id: companyId, name: companyName, domain: input.domain, slug: `sales-${companyId}`, status: "active", createdAt: now }), insert, log]);
  return id;
}

async function validateJob(db: Database, jobId: string, companyId: string) {
  if (!jobId) return;
  const job = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId))).get();
  if (!job) throw new Error("この企業に属する求人を選択してください");
}

export async function getProspect(db: Database, id: string) {
  const row = await db.select().from(salesProspects).where(eq(salesProspects.id,id)).get();
  if (!row) throw new Error("営業先が見つかりません");
  return row;
}

/** Native D1 batch is atomic. Version guards prevent stale tabs overwriting a stop/reply. */
async function change(db: Database, row: SalesProspect, version: number, patch: Partial<SalesProspect>, log: typeof salesActivities.$inferInsert) {
  if (row.version !== version) throw new Error("別の更新があります。再読み込みして確認してください");
  const result = await db.batch([
    db.insert(salesActivities).select(db.select({
      id:sql<string>`${log.id}`.as("id"), prospectId:sql<string>`${row.id}`.as("prospect_id"), kind:sql<string>`${log.kind}`.as("kind"),
      summary:sql<string>`${log.summary}`.as("summary"), sourceUrl:sql<string | null>`${log.sourceUrl ?? null}`.as("source_url"),
      reason:sql<string>`${log.reason ?? ""}`.as("reason"), templateVersion:sql<string>`${log.templateVersion ?? ""}`.as("template_version"),
      minutes:sql<number>`${log.minutes ?? 0}`.as("minutes"), occurredOn:sql<string>`${log.occurredOn}`.as("occurred_on"),
      actorId:sql<string>`${log.actorId}`.as("actor_id"), createdAt:sql<Date>`${Math.floor(log.createdAt.getTime()/1000)}`.as("created_at"),
    }).from(salesProspects).where(and(eq(salesProspects.id,row.id),eq(salesProspects.version,version)))),
    db.update(salesProspects).set({ ...patch, version: version+1, updatedAt: new Date() }).where(and(eq(salesProspects.id,row.id), eq(salesProspects.version,version))).returning({ id: salesProspects.id }),
  ]);
  if (!result[1].length) throw new Error("別の更新があります。再読み込みして確認してください");
}

export async function updateProspect(db: Database, id: string, version: number, raw: unknown, actorId: string) {
  const row = await getProspect(db,id), input = prospectInput.parse(raw);
  if (input.domain !== row.domain || input.companyId !== row.companyId) throw new Error("企業・ドメインの変更はできません");
  await validateJob(db, input.jobId, row.companyId);
  if (input.stage === "stopped" && !row.stopped) throw new Error("停止は活動欄から理由とともに記録してください");
  if (row.stopped && (input.stage !== "stopped" || input.nextAction || input.dueDate)) throw new Error("停止中です。相手からの再開依頼を先に記録してください");
  if ((input.nextAction && !input.dueDate) || (!input.nextAction && input.dueDate)) throw new Error("次の行動と期限を両方入力してください");
  if (input.stage === "closed" && (input.nextAction || input.dueDate)) throw new Error("終了する場合は次の行動と期限を空にしてください");
  const { companyName, companyId, domain, ...fields } = input;
  void companyName; void companyId; void domain;
  const summary = `管理情報を更新 / ${STAGES[input.stage]} / 次の行動: ${input.nextAction || "なし"} ${input.dueDate}`;
  await change(db,row,version,{ ...fields, jobId: input.jobId || null, jobUrl: input.jobUrl || null, contactSourceUrl: input.contactSourceUrl || null, dueDate: input.dueDate || null }, { id: crypto.randomUUID(), prospectId:id, kind:"note", summary, actorId, occurredOn:new Date().toISOString().slice(0,10), createdAt:new Date() });
}

export async function recordActivity(db: Database, id: string, version: number, raw: unknown, actorId: string) {
  const input = activityInput.parse(raw), row = await getProspect(db,id);
  const today = new Date().toISOString().slice(0,10);
  if (input.occurredOn > today) throw new Error("実行済み活動の日付に未来日は使えません");
  const history = await db.select().from(salesActivities).where(eq(salesActivities.prospectId,id)).all();
  const patch: Partial<SalesProspect> = {};
  if (["sent","followup"].includes(input.kind)) {
    if (row.stopped || row.stage === "closed") throw new Error("停止・終了中の企業には送信を記録できません");
    if (!input.approved || !input.sourceUrl || !input.templateVersion || !row.contactBasis || !row.contactSourceUrl) throw new Error("人による確認、送信済み原文リンク、文面版、連絡先の出典・根拠が必要です");
    const sent = history.find(a => a.kind === "sent");
    if (input.kind === "sent" && sent) throw new Error("初回送信は既に記録されています");
    if (input.kind === "followup") {
      if (!sent || history.some(a => ["followup","reply","needs","stop"].includes(a.kind))) throw new Error("追送は未返信の初回送信に対して1回のみです");
      if (input.occurredOn < addBusinessDays(sent.occurredOn,5)) throw new Error("追送候補は初回から5営業日以降です（土日除外。祝日は担当者が確認）");
    }
    patch.stage = "contacted";
    patch.nextAction = input.kind === "sent" ? "返信・求人継続・送信根拠を確認し、追送候補をレビュー" : "無反応なら終了を確認";
    patch.dueDate = addBusinessDays(input.occurredOn,5);
  }
  if (["reply","needs"].includes(input.kind)) {
    if (!input.sourceUrl) throw new Error("返信・求人の原文リンクを入力してください");
    patch.nextAction = ""; patch.dueDate = null;
    if (!row.stopped) patch.stage = input.kind === "needs" ? "needs_received" : "qualifying";
  }
  if (input.kind === "stop" || ["unsubscribe","declined"].includes(input.reason)) {
    if (!input.reason) throw new Error("停止・拒否の理由を選択してください");
    patch.stopped = true; patch.stage = "stopped"; patch.stopReason = input.summary; patch.nextAction = ""; patch.dueDate = null;
  }
  if (input.kind === "reopen") {
    if (!row.stopped || !input.approved || !input.sourceUrl) throw new Error("停止からの再開には相手の依頼原文と人による確認が必要です");
    patch.stopped = false; patch.stage = "qualifying"; patch.nextAction = ""; patch.dueDate = null;
  }
  if (input.kind === "handoff") {
    if (row.stopped || !row.jobId || !row.needs) throw new Error("停止していない企業で、対象求人と確認した条件を記録してから接続してください");
    patch.stage = "introduction";
  }
  await change(db,row,version,patch,{ ...input, id:crypto.randomUUID(), prospectId:id, sourceUrl:input.sourceUrl || null, actorId, createdAt:new Date() });
}

export async function createSalesJob(db: Database, id: string, version: number, title: string, actorId: string) {
  const row = await getProspect(db,id);
  if (row.stopped || !row.needs || !title.trim() || title.length > 200) throw new Error("停止していない企業で、求人名と確認したニーズを入力してください");
  if (row.jobId) throw new Error("既に求人が紐づいています。企業・求人画面で確認してください");
  if (row.version !== version) throw new Error("別の更新があります。再読み込みしてください");
  const jobId=`sales-job-${id}`, now=new Date();
  const guard=and(eq(salesProspects.id,id),eq(salesProspects.version,version));
  const result=await db.batch([
    db.insert(jobs).select(db.select({
      id:sql<string>`${jobId}`.as("id"), companyId:sql<string>`${row.companyId}`.as("company_id"),
      title:sql<string>`${title.trim()}`.as("title"), description:sql<string>`${row.needs}`.as("description"),
      salaryMin:sql<number | null>`NULL`.as("salary_min"), salaryMax:sql<number | null>`NULL`.as("salary_max"),
      salaryCurrency:sql<string>`'USD'`.as("salary_currency"), location:sql<string | null>`NULL`.as("location"), workAuthRequirement:sql<string | null>`NULL`.as("work_auth_requirement"),
      status:sql<"open">`'open'`.as("status"), createdAt:sql<Date>`${Math.floor(now.getTime()/1000)}`.as("created_at"),
    }).from(salesProspects).where(guard)),
    db.insert(salesActivities).select(db.select({
      id:sql<string>`${crypto.randomUUID()}`.as("id"), prospectId:sql<string>`${id}`.as("prospect_id"), kind:sql<string>`'review'`.as("kind"),
      summary:sql<string>`${`受領したニーズを求人として登録: ${title.trim()}`}`.as("summary"),
      sourceUrl:sql<string | null>`NULL`.as("source_url"), reason:sql<string>`''`.as("reason"), templateVersion:sql<string>`''`.as("template_version"), minutes:sql<number>`0`.as("minutes"),
      occurredOn:sql<string>`${now.toISOString().slice(0,10)}`.as("occurred_on"), actorId:sql<string>`${actorId}`.as("actor_id"), createdAt:sql<Date>`${Math.floor(now.getTime()/1000)}`.as("created_at"),
    }).from(salesProspects).where(guard)),
    db.update(salesProspects).set({jobId,version:version+1,updatedAt:now}).where(guard).returning({id:salesProspects.id}),
  ]);
  if(!result[2].length) throw new Error("別の更新があります。再読み込みしてください");
}
