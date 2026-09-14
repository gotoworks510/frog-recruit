import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { SiteFooter } from "@/components/brand/SiteFooter";

interface AuthSplitShellProps {
  /** Small caps label on the brand panel (e.g. FOR CANDIDATES). */
  audienceLabel: string;
  headline: ReactNode;
  body: string;
  footerLines?: string[];
  children: ReactNode;
}

/**
 * Split-screen auth shell: dark brand panel (left) + form panel (right).
 * Stacks vertically on small screens.
 */
export function AuthSplitShell({
  audienceLabel,
  headline,
  body,
  footerLines = [],
  children,
}: AuthSplitShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Brand panel */}
        <aside className="flex flex-col justify-between bg-brand px-8 py-10 text-white lg:w-1/2 lg:px-14 lg:py-12">
          <BrandMark href="/" variant="white" logoHeight={36} />
          <div className="my-12 max-w-md lg:my-0">
            <p className="label-caps text-white/55">{audienceLabel}</p>
            <h1 className="mt-4 font-heading text-3xl font-semibold leading-snug tracking-tight sm:text-4xl">
              {headline}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-white/75">{body}</p>
          </div>
          <div className="border-t border-white/15 pt-6">
            {footerLines.map((line) => (
              <p key={line} className="text-sm text-white/65">
                {line}
              </p>
            ))}
          </div>
        </aside>

        {/* Form panel */}
        <div className="relative flex flex-1 flex-col bg-surface px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
          <div className="mb-8 flex justify-end lg:absolute lg:right-10 lg:top-8 lg:mb-0">
            <Link
              href="/"
              className="text-sm text-muted transition hover:text-ink"
            >
              ← About Frog Recruit
            </Link>
          </div>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
            {children}
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
