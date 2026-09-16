import Link from "next/link";

interface SiteFooterProps {
  /** Extra note above the copyright bar (employer confidentiality, etc.). */
  noteLeft?: string;
  noteRight?: string;
  className?: string;
}

export function SiteFooter({
  noteLeft,
  noteRight,
  className = "",
}: SiteFooterProps) {
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
            <p>Vancouver, Canada · Thoughtful introductions.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
