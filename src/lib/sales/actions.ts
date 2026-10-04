"use server";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { createProspect, updateProspect, recordActivity, createSalesJob } from "./service";

export type SalesResult = { error?: string; id?: string; saved?: boolean };
function requireAtomicLocalDevelopment() {
  if (process.env.NODE_ENV === "development" && process.env.RECRUIT_LOCAL_D1 !== "1") throw new Error("営業管理のローカル編集は RECRUIT_LOCAL_D1=1 で起動してください（ローカルD1の原子的な更新を使用）");
}
export async function createSales(_: SalesResult, form: FormData): Promise<SalesResult> {
  const session = await requireAdmin();
  try {
    requireAtomicLocalDevelopment();
    const id = await createProspect(await getD1Db(), Object.fromEntries(form), session.user.id);
    revalidatePath("/admin/sales"); return { id, saved:true };
  } catch (e) { return failure(e); }
}
export async function saveSales(_: SalesResult, form: FormData): Promise<SalesResult> {
  const session = await requireAdmin();
  try {
    requireAtomicLocalDevelopment();
    const id = String(form.get("id")), version = Number(form.get("version"));
    await updateProspect(await getD1Db(), id, version, Object.fromEntries(form), session.user.id);
    revalidatePath("/admin/sales"); revalidatePath(`/admin/sales/${id}`); return { saved:true };
  } catch (e) { return failure(e); }
}
export async function addSalesActivity(_: SalesResult, form: FormData): Promise<SalesResult> {
  const session = await requireAdmin();
  try {
    requireAtomicLocalDevelopment();
    const id = String(form.get("id"));
    await recordActivity(await getD1Db(), id, Number(form.get("version")), { ...Object.fromEntries(form), approved:form.get("approved") === "on" }, session.user.id);
    revalidatePath("/admin/sales"); revalidatePath(`/admin/sales/${id}`); return { saved:true };
  } catch (e) { return failure(e); }
}
function failure(e: unknown): SalesResult {
  if (e && typeof e === "object" && "issues" in e) return { error:"入力を確認してください。URL・メール・日付・必須項目が不正です。" };
  // Never expose SQL payloads or bound contact data in an error response.
  const message = e instanceof Error ? e.message : "";
  return { error: /[ぁ-んァ-ン一-龯]/.test(message) && !message.includes("query") ? message : "保存できませんでした。重複登録や接続状態を確認してください。" };
}
export async function addSalesJob(_: SalesResult, form: FormData): Promise<SalesResult> {
  const session=await requireAdmin();
  try {
    requireAtomicLocalDevelopment();
    const id=String(form.get("id"));
    await createSalesJob(await getD1Db(),id,Number(form.get("version")),String(form.get("title")??""),session.user.id);
    revalidatePath(`/admin/sales/${id}`); revalidatePath("/admin/companies"); return {saved:true};
  } catch(e) { return failure(e); }
}
