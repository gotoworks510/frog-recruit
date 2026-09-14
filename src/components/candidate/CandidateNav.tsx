"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/me", label: "Home" },
  { href: "/me/profile", label: "Profile" },
  { href: "/me/experience", label: "Experience" },
  { href: "/me/links", label: "Links" },
  { href: "/me/resume", label: "Resume" },
  { href: "/me/sharing", label: "Sharing" },
  { href: "/me/preview", label: "Preview" },
];

export function CandidateNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 text-sm sm:px-4">
        {NAV.map((n) => {
          const active =
            n.href === "/me"
              ? pathname === "/me"
              : pathname === n.href || pathname.startsWith(`${n.href}/`);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`whitespace-nowrap border-b-2 px-3 py-3 transition ${
                active
                  ? "border-brand font-semibold text-brand"
                  : "border-transparent text-ink hover:text-brand"
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
