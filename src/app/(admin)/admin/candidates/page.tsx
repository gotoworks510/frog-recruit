import Link from "next/link";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import {
  users,
  candidateProfiles,
  candidateConsents,
  recommendations,
  accessGrants,
  candidateFeedback,
} from "@/lib/db/schema";
import { WORK_AUTH_LABELS } from "@/lib/candidate/profile";
import { INTEREST_LABELS_JA, type InterestLevel } from "@/lib/employer/feedback";

const STATUS_LABEL: Record<string, string> = {
  pending: "承認待ち",
  approved: "承認済み",
  rejected: "却下",
};

const ERRORS: Record<string, string> = {
  missing: "候補者IDが指定されていません。",
  notfound: "対象の候補者が見つかりませんでした（開発DBにいない可能性があります）。",
  notapproved: "承認済みの候補者のみプレビューできます。",
  config: "プレビュー用の署名鍵（NEXTAUTH_SECRET）を確認してください。",
};

type FilterKey =
  | "all"
  | "pending"
  | "approved"
  | "rejected"
  | "no_consent"
  | "no_resume"
  | "no_live_rec"
  | "interview";

export default async function AdminCandidates({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string; q?: string; filter?: string }>;
}) {
  await requireAdmin();
  const { error, status, q, filter } = await searchParams;
  const db = await getD1Db();

  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      profileId: candidateProfiles.id,
      displayName: candidateProfiles.displayName,
      headline: candidateProfiles.headline,
      completeness: candidateProfiles.completeness,
      workAuthStatus: candidateProfiles.workAuthStatus,
      resumeKey: candidateProfiles.resumeKey,
      yearsExperience: candidateProfiles.yearsExperience,
    })
    .from(users)
    .leftJoin(candidateProfiles, eq(candidateProfiles.userId, users.id))
    .where(eq(users.role, "candidate"))
    .all();

  const profileIds = rows
    .map((r) => r.profileId)
    .filter((id): id is string => !!id);

  const consented = new Set<string>();
  const liveRec = new Set<string>();
  const draftOnly = new Set<string>();
  const grantCount = new Map<string, number>();
  const bestFeedback = new Map<
    string,
    { interest: InterestLevel; wantsInterview: boolean }
  >();

  if (profileIds.length > 0) {
    const [consents, recs, grants, feedback] = await Promise.all([
      db
        .select({ candidateProfileId: candidateConsents.candidateProfileId })
        .from(candidateConsents)
        .where(
          and(
            inArray(candidateConsents.candidateProfileId, profileIds),
            isNull(candidateConsents.revokedAt)
          )
        )
        .all(),
      db
        .select({
          candidateProfileId: recommendations.candidateProfileId,
          status: recommendations.status,
          visibility: recommendations.visibility,
        })
        .from(recommendations)
        .where(inArray(recommendations.candidateProfileId, profileIds))
        .all(),
      db
        .select({ candidateProfileId: accessGrants.candidateProfileId })
        .from(accessGrants)
        .where(
          and(
            inArray(accessGrants.candidateProfileId, profileIds),
            isNull(accessGrants.revokedAt)
          )
        )
        .all(),
      db
        .select({
          candidateProfileId: candidateFeedback.candidateProfileId,
          interest: candidateFeedback.interest,
          wantsInterview: candidateFeedback.wantsInterview,
        })
        .from(candidateFeedback)
        .where(inArray(candidateFeedback.candidateProfileId, profileIds))
        .all(),
    ]);

    for (const c of consents) consented.add(c.candidateProfileId);

    const hasAnyRec = new Set<string>();
    for (const r of recs) {
      hasAnyRec.add(r.candidateProfileId);
      if (r.status === "published" && r.visibility === "shared") {
        liveRec.add(r.candidateProfileId);
      }
    }
    for (const id of hasAnyRec) {
      if (!liveRec.has(id)) draftOnly.add(id);
    }

    for (const g of grants) {
      grantCount.set(
        g.candidateProfileId,
        (grantCount.get(g.candidateProfileId) ?? 0) + 1
      );
    }

    const rank: Record<InterestLevel, number> = {
      interested: 3,
      maybe: 2,
      not_interested: 1,
    };
    for (const f of feedback) {
      const cur = bestFeedback.get(f.candidateProfileId);
      const interest = f.interest as InterestLevel;
      if (
        !cur ||
        rank[interest] > rank[cur.interest] ||
        (f.wantsInterview && !cur.wantsInterview)
      ) {
        bestFeedback.set(f.candidateProfileId, {
          interest,
          wantsInterview: f.wantsInterview || !!cur?.wantsInterview,
        });
      }
    }
  }

  const query = (q ?? "").trim().toLowerCase();
  const activeFilter = (filter as FilterKey) || (status as FilterKey) || "all";

  const enriched = rows
    .map((r) => {
      const pid = r.profileId;
      const fb = pid ? bestFeedback.get(pid) : undefined;
      return {
        ...r,
        hasConsent: pid ? consented.has(pid) : false,
        hasLiveRec: pid ? liveRec.has(pid) : false,
        hasDraftOnly: pid ? draftOnly.has(pid) : false,
        grants: pid ? (grantCount.get(pid) ?? 0) : 0,
        hasResume: !!r.resumeKey,
        feedback: fb ?? null,
        label: r.displayName ?? r.name ?? "—",
      };
    })
    .filter((r) => {
      if (query) {
        const hay = `${r.label} ${r.email} ${r.headline ?? ""}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      switch (activeFilter) {
        case "pending":
        case "approved":
        case "rejected":
          return r.status === activeFilter;
        case "no_consent":
          return r.status === "approved" && !r.hasConsent;
        case "no_resume":
          return r.status === "approved" && !r.hasResume;
        case "no_live_rec":
          return r.status === "approved" && !r.hasLiveRec;
        case "interview":
          return !!r.feedback?.wantsInterview;
        default:
          return true;
      }
    })
    .sort((a, b) => {
      // pending first, then by completeness desc
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (b.status === "pending" && a.status !== "pending") return 1;
      return (b.completeness ?? 0) - (a.completeness ?? 0);
    });

  const counts = {
    all: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };

  const filters: Array<{ key: FilterKey; label: string; count?: number }> = [
    { key: "all", label: "すべて", count: counts.all },
    { key: "pending", label: "承認待ち", count: counts.pending },
    { key: "approved", label: "承認済み", count: counts.approved },
    { key: "no_consent", label: "未同意" },
    { key: "no_resume", label: "レジュメなし" },
    { key: "no_live_rec", label: "未公開推薦" },
    { key: "interview", label: "面接希望あり" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">候補者</h1>
          <p className="mt-1 text-sm text-muted">
            紹介の準備状況（同意・推薦・権限・FB）を一覧で確認できます。行をクリックして詳細へ。
          </p>
        </div>
        <form className="flex gap-2">
          {activeFilter !== "all" && (
            <input type="hidden" name="filter" value={activeFilter} />
          )}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="名前・メール・職種で検索"
            className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm sm:w-64"
          />
          <button type="submit" className="btn-primary px-4 py-2 text-sm">
            検索
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {ERRORS[error] ?? "プレビューを開始できませんでした。"}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const href =
            f.key === "all"
              ? q
                ? `/admin/candidates?q=${encodeURIComponent(q)}`
                : "/admin/candidates"
              : `/admin/candidates?filter=${f.key}${
                  q ? `&q=${encodeURIComponent(q)}` : ""
                }`;
          const on = activeFilter === f.key;
          return (
            <Link
              key={f.key}
              href={href}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                on
                  ? "bg-frog-dark text-white"
                  : "bg-paper text-ink ring-1 ring-line hover:bg-surface-2"
              }`}
            >
              {f.label}
              {typeof f.count === "number" ? ` (${f.count})` : ""}
            </Link>
          );
        })}
      </div>

      {enriched.length === 0 ? (
        <p className="text-sm text-muted">
          {rows.length === 0
            ? "まだ候補者がいません。「招待」から招待してください。"
            : "条件に一致する候補者がいません。"}
        </p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2">候補者</th>
                <th className="px-3 py-2">状態</th>
                <th className="px-3 py-2">就労</th>
                <th className="px-3 py-2">準備</th>
                <th className="px-3 py-2">権限</th>
                <th className="px-3 py-2">FB</th>
                <th className="px-3 py-2">完成度</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((r) => (
                <tr key={r.userId} className="border-t border-line hover:bg-surface/60">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/candidates/${r.userId}`}
                      className="block hover:underline"
                    >
                      <p className="font-medium text-ink">{r.label}</p>
                      <p className="text-xs text-muted">{r.email}</p>
                      {r.headline && (
                        <p className="mt-0.5 text-xs text-muted">{r.headline}</p>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink">
                    {r.workAuthStatus
                      ? WORK_AUTH_LABELS[r.workAuthStatus] ?? r.workAuthStatus
                      : "—"}
                    {r.yearsExperience != null && (
                      <span className="mt-0.5 block text-muted">
                        {r.yearsExperience}年
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      <Chip ok={r.hasConsent} yes="同意" no="未同意" />
                      <Chip ok={r.hasResume} yes="履歴書" no="履歴書なし" />
                      {r.hasLiveRec ? (
                        <Chip ok yes="公開推薦" />
                      ) : r.hasDraftOnly ? (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800">
                          下書き推薦
                        </span>
                      ) : (
                        <Chip ok={false} no="推薦なし" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink">
                    {r.grants > 0 ? (
                      <span className="font-medium text-frog-dark">{r.grants}件</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {r.feedback ? (
                      <span className="text-ink">
                        {INTEREST_LABELS_JA[r.feedback.interest]}
                        {r.feedback.wantsInterview ? " · 面接希望" : ""}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted">
                    {r.completeness ?? 0}%
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.status === "approved" && (
                        <form action="/api/admin/view-as" method="post">
                          <input type="hidden" name="as" value="candidate" />
                          <input type="hidden" name="userId" value={r.userId} />
                          <button
                            type="submit"
                            className="text-xs font-medium text-frog-dark hover:underline"
                          >
                            見る
                          </button>
                        </form>
                      )}
                      <Link
                        href={`/admin/candidates/${r.userId}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        詳細
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${
        status === "approved"
          ? "bg-emerald-50 text-emerald-700"
          : status === "rejected"
            ? "bg-red-50 text-red-700"
            : "bg-amber-50 text-amber-700"
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function Chip({
  ok,
  yes,
  no,
}: {
  ok: boolean;
  yes?: string;
  no?: string;
}) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] ${
        ok ? "bg-emerald-50 text-emerald-800" : "bg-surface-2 text-muted"
      }`}
    >
      {ok ? yes : no}
    </span>
  );
}
