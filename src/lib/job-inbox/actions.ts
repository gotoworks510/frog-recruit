"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { companies, jobLeads, jobs } from "@/lib/db/schema";
import { isJobInboxEnabled } from "@/lib/job-inbox/config";
import { detectSourceFromUrl, scoreJobLead, slugifyCompany } from "@/lib/job-inbox/score";
import { normalizeDomain } from "@/lib/sales/model";

function str(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}

function assertInboxEnabled() {
  if (!isJobInboxEnabled()) {
    throw new Error("Job Inbox is disabled");
  }
}

export async function createManualJobLead(formData: FormData) {
  await requireAdmin();
  assertInboxEnabled();
  const db = await getD1Db();

  const sourceUrl = str(formData.get("sourceUrl"));
  if (!sourceUrl) redirect("/admin/job-inbox?error=missing");

  const titleRaw = str(formData.get("title"));
  const companyNameRaw = str(formData.get("companyName"));
  const locationRaw = str(formData.get("location"));
  const descriptionRaw = str(formData.get("description"));
  const source = detectSourceFromUrl(sourceUrl);
  const score = scoreJobLead({
    title: titleRaw,
    location: locationRaw,
    description: descriptionRaw,
    company: companyNameRaw,
  });

  const existing = await db
    .select({ id: jobLeads.id })
    .from(jobLeads)
    .where(eq(jobLeads.sourceUrl, sourceUrl))
    .get();
  if (existing) redirect(`/admin/job-inbox/${existing.id}?dup=1`);

  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(jobLeads).values({
    id,
    source,
    sourceUrl,
    companyNameRaw,
    titleRaw,
    locationRaw,
    descriptionRaw,
    status: "new",
    score,
    capturedBy: "manual",
    capturedAt: now,
    updatedAt: now,
  });
  revalidatePath("/admin/job-inbox");
  redirect(`/admin/job-inbox/${id}`);
}

export async function setJobLeadStatus(formData: FormData) {
  await requireAdmin();
  assertInboxEnabled();
  const db = await getD1Db();
  const id = str(formData.get("id"));
  const status = str(formData.get("status"));
  if (!id || !status) return;
  if (!["new", "triaged", "converted", "rejected", "snoozed"].includes(status)) {
    return;
  }
  await db
    .update(jobLeads)
    .set({
      status: status as
        | "new"
        | "triaged"
        | "converted"
        | "rejected"
        | "snoozed",
      updatedAt: new Date(),
    })
    .where(eq(jobLeads.id, id));
  revalidatePath("/admin/job-inbox");
  revalidatePath(`/admin/job-inbox/${id}`);
}

export async function convertJobLead(formData: FormData) {
  await requireAdmin();
  assertInboxEnabled();
  const db = await getD1Db();
  const id = str(formData.get("id"));
  if (!id) redirect("/admin/job-inbox?error=missing");

  const lead = await db.select().from(jobLeads).where(eq(jobLeads.id, id)).get();
  if (!lead) redirect("/admin/job-inbox?error=missing");
  if (lead.convertedJobId) {
    const companyId = lead.convertedCompanyId;
    revalidatePath("/admin/job-inbox");
    redirect(
      companyId
        ? `/admin/companies?highlight=${companyId}`
        : "/admin/companies"
    );
  }

  const companyName = str(formData.get("companyName")) || lead.companyNameRaw || "Unknown Co";
  const title = str(formData.get("title")) || lead.titleRaw || "Untitled role";
  const location = str(formData.get("location")) || lead.locationRaw;
  const description =
    str(formData.get("description")) || lead.descriptionRaw || lead.sourceUrl;
  const salaryCurrencyRaw = str(formData.get("salaryCurrency"));
  const salaryCurrency =
    salaryCurrencyRaw === "USD" || salaryCurrencyRaw === "CAD"
      ? salaryCurrencyRaw
      : lead.salaryCurrency === "USD"
        ? "USD"
        : "CAD";

  const selectedId = str(formData.get("companyId"));
  const domainRaw = str(formData.get("domain"));
  const domain = domainRaw ? normalizeDomain(domainRaw) : null;
  const companyList = await db.select().from(companies).all();
  const matches = domain ? companyList.filter(c => { try { return c.domain && normalizeDomain(c.domain) === domain; } catch { return false; } }) : [];
  if (!selectedId && matches.length > 1) throw new Error("同じドメインの企業が複数あります。既存企業を選択してください");
  const existingCompany = selectedId ? companyList.find(c => c.id === selectedId) : matches[0];
  if (existingCompany?.status === "archived") throw new Error("アーカイブ企業は先に企業画面で確認してください");
  if (selectedId && !existingCompany) throw new Error("企業が見つかりません");
  if (!existingCompany && !domain) throw new Error("既存企業を選ぶか公式ドメインを入力してください");
  if (existingCompany?.domain && domain && normalizeDomain(existingCompany.domain) !== domain) throw new Error("選択した企業とドメインが一致しません");
  const companyId = existingCompany?.id ?? `inbox-${id}`;
  const jobId = `inbox-job-${id}`;
  const slug = `${slugifyCompany(companyName)}-${id.slice(0,8)}`;
  const now = new Date();

  const companyInsert = db.insert(companies).values({
    id: companyId,
    name: companyName,
    slug,
    domain,
    description: `Imported from Job Inbox (${lead.source}). Source: ${lead.sourceUrl}`,
    status: "active",
    createdAt: now,
  }).onConflictDoNothing();
  const jobInsert = db.insert(jobs).values({
    id: jobId,
    companyId,
    title,
    description,
    location,
    status: "open",
    salaryCurrency,
    createdAt: now,
  });

  // Preserve the original evidence and link it to canonical records.
  const retainLead = db.update(jobLeads).set({ status:"converted", convertedCompanyId:companyId, convertedJobId:jobId, updatedAt:now }).where(eq(jobLeads.id,id));
  if (existingCompany) await db.batch([jobInsert.onConflictDoNothing(),retainLead]);
  else await db.batch([companyInsert,jobInsert.onConflictDoNothing(),retainLead]);

  revalidatePath("/admin/job-inbox");
  revalidatePath("/admin/companies");
  redirect(`/admin/companies?highlight=${companyId}&fromInbox=1`);
}

export async function deleteJobLead(formData: FormData) {
  await requireAdmin();
  assertInboxEnabled();
  const db = await getD1Db();
  const id = str(formData.get("id"));
  if (!id) redirect("/admin/job-inbox?error=missing");

  const lead = await db.select().from(jobLeads).where(eq(jobLeads.id,id)).get();
  if (lead?.convertedJobId) throw new Error("求人化済みのリードは履歴として保持します");
  await db.delete(jobLeads).where(eq(jobLeads.id, id));
  revalidatePath("/admin/job-inbox");
  redirect("/admin/job-inbox?deleted=1");
}
