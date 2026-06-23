import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { users, candidateProfiles } from "@/lib/db/schema";

const STATUS_LABEL: Record<string, string> = {
  pending: "承認待ち",
  approved: "承認済み",
  rejected: "却下",
};

export default async function AdminCandidates() {
  await requireAdmin();
  const db = await getD1Db();

  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      profileId: candidateProfiles.id,
      headline: candidateProfiles.headline,
      completeness: candidateProfiles.completeness,
    })
    .from(users)
    .leftJoin(candidateProfiles, eq(candidateProfiles.userId, users.id))
    .where(eq(users.role, "candidate"))
    .all();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">候補者</h1>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">まだ候補者がいません。「招待」から招待してください。</p>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2">名前</th>
                <th className="px-4 py-2">職種</th>
                <th className="px-4 py-2">ステータス</th>
                <th className="px-4 py-2">完成度</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{r.name ?? "—"}</p>
                    <p className="text-xs text-muted">{r.email}</p>
                  </td>
                  <td className="px-4 py-3 text-ink">{r.headline ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        r.status === "approved"
                          ? "bg-emerald-50 text-emerald-700"
                          : r.status === "rejected"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{r.completeness ?? 0}%</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/candidates/${r.userId}`}
                      className="text-primary hover:underline"
                    >
                      開く
                    </Link>
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
