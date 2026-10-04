"use server";
import { requireAdminMutation } from "@/lib/sales/auth";
import { getD1Db } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { createProspect, updateProspect, recordActivity, createSalesJob } from "./service";
import { SalesInputError, salesFailure } from "./errors";

export type SalesResult = { error?: string; id?: string; saved?: boolean };
function requireAtomicLocalDevelopment() {
  if (process.env.NODE_ENV === "development" && process.env.RECRUIT_LOCAL_D1 !== "1") throw new SalesInputError("営業管理のローカル編集は RECRUIT_LOCAL_D1=1 で起動してください。");
}
export async function createSales(_: SalesResult, form: FormData): Promise<SalesResult> {
  const session = await requireAdminMutation();
  try {
    requireAtomicLocalDevelopment();
    const id = await createProspect(await getD1Db(), Object.fromEntries(form), session.user.id);
    revalidatePath("/admin/sales"); return { id, saved:true };
  } catch (e) { return failure(e); }
}
export async function saveSales(_: SalesResult, form: FormData): Promise<SalesResult> {
  const session = await requireAdminMutation();
  try {
    requireAtomicLocalDevelopment();
    const id = String(form.get("id")), version = Number(form.get("version"));
    await updateProspect(await getD1Db(), id, version, Object.fromEntries(form), session.user.id);
    revalidatePath("/admin/sales"); revalidatePath(`/admin/sales/${id}`); return { saved:true };
  } catch (e) { return failure(e); }
}
export async function addSalesActivity(_: SalesResult, form: FormData): Promise<SalesResult> {
  const session = await requireAdminMutation();
  try {
    requireAtomicLocalDevelopment();
    const id = String(form.get("id"));
    await recordActivity(await getD1Db(), id, Number(form.get("version")), { ...Object.fromEntries(form), approved:form.get("approved") === "on" }, session.user.id);
    revalidatePath("/admin/sales"); revalidatePath(`/admin/sales/${id}`); return { saved:true };
  } catch (e) { return failure(e); }
}
const failure = salesFailure;
export async function addSalesJob(_: SalesResult, form: FormData): Promise<SalesResult> {
  const session=await requireAdminMutation();
  try {
    requireAtomicLocalDevelopment();
    const id=String(form.get("id"));
    await createSalesJob(await getD1Db(),id,Number(form.get("version")),String(form.get("title")??""),session.user.id,String(form.get("sharedDescription")??""),form.get("shareApproved")==="on");
    revalidatePath(`/admin/sales/${id}`); revalidatePath("/admin/companies"); return {saved:true};
  } catch(e) { return failure(e); }
}
