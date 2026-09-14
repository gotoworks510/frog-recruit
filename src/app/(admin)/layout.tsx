import Link from "next/link";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { signOut } from "@/lib/auth/auth";
import { Logo } from "@/components/brand/Logo";
import { AdminNav } from "@/components/admin/AdminNav";
import { VIEW_AS_COOKIE, decodeViewAsCookie } from "@/lib/auth/view-as";
import { exitViewAs } from "@/lib/admin/actions";
import { getD1Db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  const jar = await cookies();
  const payload = await decodeViewAsCookie(jar.get(VIEW_AS_COOKIE)?.value);
  let previewLabel: string | null = null;
  let previewHome: string | null = null;
  if (payload && payload.adminId === session.user.id) {
    const db = await getD1Db();
    const target = await db
      .select({ email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, payload.targetUserId))
      .get();
    if (target) {
      previewLabel = `${target.role === "employer" ? "企業" : "候補者"}: ${target.email}`;
      previewHome = target.role === "employer" ? "/portal" : "/me";
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      {previewLabel && previewHome && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <p>
              <span className="font-semibold">プレビュー中</span>
              {" — "}
              {previewLabel}
            </p>
            <div className="flex items-center gap-3">
              <Link href={previewHome} className="underline hover:no-underline">
                プレビュー画面へ
              </Link>
              <form action={exitViewAs}>
                <button
                  type="submit"
                  className="rounded-md bg-amber-800 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-900"
                >
                  プレビュー終了
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Logo variant="green" height={28} />
            </Link>
            <span className="rounded bg-frog/10 px-2 py-0.5 text-xs font-semibold text-frog-dark">
              ADMIN
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted">
            <span className="hidden sm:inline">{session.user.email}</span>
            <form
              action={async () => {
                "use server";
                const { clearViewAsCookie } = await import("@/lib/auth/view-as");
                await clearViewAsCookie();
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="hover:text-ink">ログアウト</button>
            </form>
          </div>
        </div>
        <AdminNav />
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
