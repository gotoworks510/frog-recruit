"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { companies, jobLeads, jobs } from "@/lib/db/schema";
import { isJobInboxEnabled } from "@/lib/job-inbox/config";
import { detectSourceFromUrl, scoreJobLead, slugifyCompany } from "@/lib/job-inbox/score";

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
    redirect(`/admin/companies?highlight=${lead.convertedCompanyId}`);
  }

  const companyName = str(formData.get("companyName")) || lead.companyNameRaw || "Unknown Co";
  const title = str(formData.get("title")) || lead.titleRaw || "Untitled role";
  const location = str(formData.get("location")) || lead.locationRaw;
  const description =
    str(formData.get("description")) || lead.descriptionRaw || lead.sourceUrl;

  let slug = slugifyCompany(companyName);
  const slugTaken = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, slug))
    .get();
  if (slugTaken) slug = `${slug}-${crypto.randomUUID().slice(0, 6)}`;

  const companyId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const now = new Date();

  await db.insert(companies).values({
    id: companyId,
    name: companyName,
    slug,
    description: `Imported from Job Inbox (${lead.source}). Source: ${lead.sourceUrl}`,
    status: "active",
    createdAt: now,
  });
  await db.insert(jobs).values({
    id: jobId,
    companyId,
    title,
    description,
    location,
    status: "open",
    salaryCurrency: "USD",
    createdAt: now,
  });
  await db
    .update(jobLeads)
    .set({
      status: "converted",
      convertedCompanyId: companyId,
      convertedJobId: jobId,
      companyNameRaw: companyName,
      titleRaw: title,
      locationRaw: location,
      descriptionRaw: description,
      updatedAt: now,
    })
    .where(eq(jobLeads.id, id));

  revalidatePath("/admin/job-inbox");
  revalidatePath("/admin/companies");
  redirect("/admin/companies");
}

export async function deleteJobLead(formData: FormData) {
  await requireAdmin();
  assertInboxEnabled();
  const db = await getD1Db();
  const id = str(formData.get("id"));
  if (!id) redirect("/admin/job-inbox?error=missing");

  await db.delete(jobLeads).where(eq(jobLeads.id, id));
  revalidatePath("/admin/job-inbox");
  redirect("/admin/job-inbox?deleted=1");
}
