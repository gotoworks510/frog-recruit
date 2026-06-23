import Link from "next/link";
import { requireAdmin } from "@/lib/auth/helpers";
import { signOut } from "@/lib/auth/auth";
import { Logo } from "@/components/brand/Logo";

const NAV = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/candidates", label: "候補者" },
  { href: "/admin/invites", label: "招待" },
  { href: "/admin/companies", label: "企業・求人" },
  { href: "/admin/employers", label: "企業アカウント" },
  { href: "/admin/grants", label: "閲覧権限" },
  { href: "/admin/audit", label: "監査ログ" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
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
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="hover:text-ink">ログアウト</button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-ink hover:bg-surface-2"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
