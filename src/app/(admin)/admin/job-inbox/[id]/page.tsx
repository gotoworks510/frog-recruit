import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { jobLeads } from "@/lib/db/schema";
import { isJobInboxEnabled } from "@/lib/job-inbox/config";
import { convertJobLead, setJobLeadStatus } from "@/lib/job-inbox/actions";

const inputCls =
  "w-full rounded-md border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

export default async function JobLeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dup?: string }>;
}) {
  await requireAdmin();
  if (!isJobInboxEnabled()) {
    return (
      <div className="card p-6 text-sm text-muted">
        Job Inboxは無効です。.env.local で有効化してください。
      </div>
    );
  }

  const { id } = await params;
  const { dup } = await searchParams;
  const db = await getD1Db();
  const lead = await db.select().from(jobLeads).where(eq(jobLeads.id, id)).get();
  if (!lead) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/job-inbox" className="text-sm text-primary hover:underline">
            ← Job Inbox
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-ink">
            {lead.titleRaw || "(タイトル未取得)"}
          </h1>
          <p className="text-sm text-muted">
            {lead.companyNameRaw || "—"} · score {lead.score} · {lead.source}
          </p>
        </div>
        <a
          href={lead.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-primary px-4 py-2 text-sm"
        >
          元ページを開く
        </a>
      </div>

      {dup && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          同じURLは既にInboxにあります（この詳細へ誘導しました）。
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(["triaged", "snoozed", "rejected"] as const).map((status) => (
          <form key={status} action={setJobLeadStatus}>
            <input type="hidden" name="id" value={lead.id} />
            <input type="hidden" name="status" value={status} />
            <button className="rounded-md border border-line px-3 py-1.5 text-xs hover:bg-surface-2">
              {status === "triaged"
                ? "選別済にする"
                : status === "snoozed"
                  ? "保留"
                  : "見送り"}
            </button>
          </form>
        ))}
        {lead.status !== "new" && (
          <form action={setJobLeadStatus}>
            <input type="hidden" name="id" value={lead.id} />
            <input type="hidden" name="status" value="new" />
            <button className="rounded-md border border-line px-3 py-1.5 text-xs hover:bg-surface-2">
              新規に戻す
            </button>
          </form>
        )}
      </div>

      <div className="card space-y-3 p-6 text-sm">
        <p>
          <span className="text-muted">URL: </span>
          <a href={lead.sourceUrl} className="break-all text-primary hover:underline">
            {lead.sourceUrl}
          </a>
        </p>
        <p>
          <span className="text-muted">勤務地: </span>
          {lead.locationRaw || "—"}
        </p>
        <p>
          <span className="text-muted">給与（生）: </span>
          {lead.salaryRaw || "—"}
        </p>
        <p>
          <span className="text-muted">状態: </span>
          {lead.status}
          {lead.convertedJobId ? "（求人化済）" : ""}
        </p>
        <div>
          <p className="mb-1 text-muted">説明</p>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-surface-2 p-3 text-xs text-ink">
            {lead.descriptionRaw || "（本文なし）"}
          </pre>
        </div>
      </div>

      {lead.convertedJobId ? (
        <div className="card p-6 text-sm">
          既に求人化済みです。{" "}
          <Link href="/admin/companies" className="text-primary hover:underline">
            企業・求人へ
          </Link>
        </div>
      ) : (
        <form action={convertJobLead} className="card grid gap-3 p-6 sm:grid-cols-2">
          <h2 className="font-semibold text-ink sm:col-span-2">
            正規の企業・求人に変換
          </h2>
          <p className="text-xs text-muted sm:col-span-2">
            `companies` / `jobs` に作成し、このリードを converted にします。既存の企業ポータルフローへ接続する入口です。
          </p>
          <input type="hidden" name="id" value={lead.id} />
          <input
            name="companyName"
            defaultValue={lead.companyNameRaw ?? ""}
            placeholder="会社名 *"
            required
            className={inputCls}
          />
          <input
            name="title"
            defaultValue={lead.titleRaw ?? ""}
            placeholder="求人タイトル *"
            required
            className={inputCls}
          />
          <input
            name="location"
            defaultValue={lead.locationRaw ?? ""}
            placeholder="勤務地"
            className={`${inputCls} sm:col-span-2`}
          />
          <textarea
            name="description"
            defaultValue={lead.descriptionRaw ?? ""}
            rows={6}
            placeholder="求人内容"
            className={`${inputCls} sm:col-span-2`}
          />
          <div className="sm:col-span-2">
            <button className="btn-primary px-5 py-2 text-sm">求人に変換</button>
          </div>
        </form>
      )}
    </div>
  );
}
