import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { SiteFooter } from "@/components/brand/SiteFooter";

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
        <strong>Demo mockup</strong> — fictional people and company. Not a live
        account.{" "}
        <Link href="/how-it-works" className="font-semibold underline">
          Back to how it works
        </Link>
      </div>
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5">
          <Link href="/how-it-works" className="inline-flex items-center gap-2.5">
            <Logo variant="white" height={28} />
            <span className="flex flex-col leading-none">
              <span className="font-heading text-lg font-semibold tracking-tight text-white sm:text-xl">
                Recruit
              </span>
              <span className="mt-0.5 text-[10px] font-semibold tracking-[0.12em] text-white/70 uppercase">
                Product demo
              </span>
            </span>
          </Link>
          <span className="text-sm text-white/80">Demo portal · fictional data</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter
        noteLeft="Demo screens use fictional data only."
        noteRight="Real introductions are private and by Frog referral."
      />
    </div>
  );
}
