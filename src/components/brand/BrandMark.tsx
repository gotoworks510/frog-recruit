import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

interface BrandMarkProps {
  href?: string;
  /** "white" for dark headers/panels, "green" for light backgrounds. */
  variant?: "green" | "white";
  className?: string;
  logoHeight?: number;
}

/**
 * Employer-facing lockup: official Frog wordmark + "for Employers" +
 * "Talent introductions".
 */
export function BrandMark({
  href = "/",
  variant = "white",
  className = "",
  logoHeight = 32,
}: BrandMarkProps) {
  const onDark = variant === "white";
  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Logo variant={variant} height={logoHeight} />
      <span className="flex flex-col leading-none">
        <span
          className={`font-heading text-lg font-semibold tracking-tight sm:text-xl ${
            onDark ? "text-white" : "text-brand"
          }`}
        >
          for Employers
        </span>
        <span
          className={`mt-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase ${
            onDark ? "text-white/70" : "text-muted"
          }`}
        >
          Talent introductions
        </span>
      </span>
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex shrink-0">
      {inner}
    </Link>
  );
}
