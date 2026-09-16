import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { SiteFooter } from "@/components/brand/SiteFooter";

/** Shared chrome for public Terms / Privacy pages. */
export function LegalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-surface text-ink">
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <BrandMark href="/" variant="white" logoHeight={32} />
          <nav className="flex items-center gap-2 text-sm sm:gap-3">
            <Link
              href="/"
              className="rounded-md px-3 py-2 font-medium text-white/85 transition hover:text-white"
            >
              Home
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-md px-3 py-2 font-medium text-white/85 transition hover:text-white"
            >
              How it works
            </Link>
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-14 lg:py-16">
        <p className="label-caps">Legal</p>
        <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">{subtitle}</p>
        <div className="legal-prose mt-10 space-y-8 text-sm leading-relaxed text-ink/90">
          {children}
        </div>
        <p className="mt-12 text-sm text-muted">
          Related:{" "}
          <Link href="/terms" className="font-semibold text-primary hover:underline">
            Terms of Use
          </Link>
          {" · "}
          <Link
            href="/privacy"
            className="font-semibold text-primary hover:underline"
          >
            Privacy Policy
          </Link>
          {" · "}
          <a
            href="https://frogagent.com/terms/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            Frog general terms (JP)
          </a>
        </p>
      </article>

      <SiteFooter />
    </main>
  );
}

export function LegalH2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading text-xl font-semibold tracking-tight text-ink">
      {children}
    </h2>
  );
}

export function LegalH3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 font-semibold text-ink">{children}</h3>;
}
