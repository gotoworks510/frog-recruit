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
 * Recruit lockup: official Frog wordmark + "Recruit" + "BY FROG · VANCOUVER".
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
          className={`font-heading text-xl font-semibold tracking-tight ${
            onDark ? "text-white" : "text-brand"
          }`}
        >
          Recruit
        </span>
        <span
          className={`mt-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase ${
            onDark ? "text-white/70" : "text-muted"
          }`}
        >
          By Frog · Vancouver
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
