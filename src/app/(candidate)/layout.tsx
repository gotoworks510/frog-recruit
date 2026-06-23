import Link from "next/link";
import { requireCandidate } from "@/lib/auth/helpers";
import { signOut } from "@/lib/auth/auth";
import { Logo } from "@/components/brand/Logo";

const NAV = [
  { href: "/me", label: "Home" },
  { href: "/me/profile", label: "Profile" },
  { href: "/me/experience", label: "Experience" },
  { href: "/me/links", label: "Links" },
  { href: "/me/resume", label: "Resume" },
  { href: "/me/sharing", label: "Sharing" },
  { href: "/me/preview", label: "Preview" },
];

export default async function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCandidate();
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/me">
            <Logo variant="green" height={30} />
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="text-sm text-muted hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 pb-2 text-sm">
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
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
