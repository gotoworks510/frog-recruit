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
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; Frog Creator Production Inc.</p>
          <p>Vancouver, Canada · Thoughtful introductions.</p>
        </div>
      </div>
    </footer>
  );
}
