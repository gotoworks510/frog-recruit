import Link from "next/link";
import { APP_STORE } from "@/lib/apps/app-store";

interface SiteFooterProps {
  /** Extra note above the copyright bar (employer confidentiality, etc.). */
  noteLeft?: string;
  noteRight?: string;
  className?: string;
  /**
   * Which App Store apps to list in the footer.
   * Public pages show both; role-scoped shells show one.
   */
  apps?: "both" | "candidate" | "employer" | "none";
}

export function SiteFooter({
  noteLeft,
  noteRight,
  className = "",
  apps = "both",
}: SiteFooterProps) {
  const appLinks =
    apps === "none"
      ? []
      : apps === "both"
        ? [
            { href: APP_STORE.candidate.url, label: "iPhone — Candidates" },
            { href: APP_STORE.employer.url, label: "iPhone — Employers" },
          ]
        : [
            {
              href: APP_STORE[apps].url,
              label:
                apps === "candidate"
                  ? "iPhone — Frog Recruit"
                  : "iPhone — for Employers",
            },
          ];

  return (
    <footer className={`mt-auto ${className}`}>
      {(noteLeft || noteRight) && (
        <div className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:justify-between">
            {noteLeft && <p>{noteLeft}</p>}
            {noteRight && <p className="sm:text-right">{noteRight}</p>}
          </div>
        </div>
      )}
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; Frog Creator Production Inc.</p>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4 sm:text-right">
            {appLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-ink"
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://en.frogagent.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-ink"
            >
              What is Frog?
            </a>
            <Link href="/terms" className="transition hover:text-ink">
              Terms
            </Link>
            <Link href="/privacy" className="transition hover:text-ink">
              Privacy
            </Link>
            <p>Canada · Thoughtful introductions.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
