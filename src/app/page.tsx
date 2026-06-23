import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo variant="green" height={36} />
        <nav className="flex items-center gap-3 text-sm">
          <Link
            href="/login"
            className="rounded-md px-4 py-2 font-medium text-ink hover:bg-surface-2"
          >
            Candidate login
          </Link>
          <Link href="/employer/login" className="btn-primary text-sm">
            Employer login
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <p className="mb-4 inline-block rounded-full bg-accent-soft px-4 py-1 text-sm font-medium text-frog-dark">
            Frog Creator Production
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Connecting{" "}
            <span className="text-primary">global job candidates</span>
            {" "}vetted by Frog
            <br className="hidden sm:block" />
            with the companies hiring them.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
            Candidate pages with only the information that truly matters for hiring. Frog
            adds context on where the strengths are and what to keep in mind.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className="btn-primary px-7 py-3 text-base">
              Get started as a candidate
            </Link>
            <Link
              href="/employer/login"
              className="rounded-md border border-line px-7 py-3 text-base font-semibold text-ink hover:bg-surface-2"
            >
              For hiring companies
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">
            Candidate registration is invite-only. You'll need an invitation link from your Frog contact.
          </p>
        </div>
      </section>

      {/* Two audiences */}
      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-2">
        <div className="card p-8">
          <h2 className="text-xl font-semibold text-frog-dark">For candidates</h2>
          <p className="mt-3 text-muted">
            No need to cram in your entire work history. We distill the
            achievements, skills, and work authorization that match the role into one
            clean page. You control exactly what's shared through your consent.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-ink">
            <li>• Sign in securely with your Google account</li>
            <li>• Upload your resume (PDF) and a structured work history</li>
            <li>• Preview exactly what employers will see</li>
          </ul>
        </div>
        <div className="card p-8">
          <h2 className="text-xl font-semibold text-frog-dark">For hiring companies</h2>
          <p className="mt-3 text-muted">
            Securely view only the candidates Frog recommends through a dedicated account. See the strengths and points to consider at a glance, and assess fit quickly before the interview.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-ink">
            <li>• Log in with the email and password issued by Frog</li>
            <li>• View only the candidates referred to you (permission-based)</li>
            <li>• Resumes are watermarked with the viewer and timestamp</li>
          </ul>
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-muted">
        &copy; Frog Creator Production Inc.
      </footer>
    </main>
  );
}
