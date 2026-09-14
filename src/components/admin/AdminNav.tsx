"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "ダッシュボード", exact: true },
  { href: "/admin/candidates", label: "候補者" },
  { href: "/admin/invites", label: "招待" },
  { href: "/admin/job-inbox", label: "求人Inbox" },
  { href: "/admin/companies", label: "企業・求人" },
  { href: "/admin/employers", label: "企業アカウント" },
  { href: "/admin/grants", label: "閲覧権限" },
  { href: "/admin/audit", label: "監査ログ" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 text-sm sm:px-4">
      {NAV.map((n) => {
        const active = n.exact
          ? pathname === n.href
          : pathname === n.href || pathname.startsWith(`${n.href}/`);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 transition ${
              active
                ? "border-frog-dark font-semibold text-frog-dark"
                : "border-transparent text-ink hover:text-frog-dark"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
