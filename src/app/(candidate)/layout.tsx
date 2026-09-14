import { requireCandidate } from "@/lib/auth/helpers";
import { signOut } from "@/lib/auth/auth";
import { BrandMark } from "@/components/brand/BrandMark";
import { SiteFooter } from "@/components/brand/SiteFooter";
import { CandidateNav } from "@/components/candidate/CandidateNav";
import { ViewAsBanner } from "@/components/admin/ViewAsBanner";
import { isViewAsSession } from "@/lib/auth/view-as";
import { exitViewAs } from "@/lib/admin/actions";

export default async function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireCandidate();
  const previewing = isViewAsSession(session);
  const displayName = session.user.name ?? session.user.email ?? "Candidate";

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      {previewing && <ViewAsBanner session={session} />}
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5">
          <BrandMark href="/me" variant="white" logoHeight={28} />
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-white/80 sm:inline">{displayName}</span>
            {previewing ? (
              <form action={exitViewAs}>
                <button className="text-white/80 transition hover:text-white">
                  管理画面に戻る
                </button>
              </form>
            ) : (
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button className="text-white/80 transition hover:text-white">
                  Sign out
                </button>
              </form>
            )}
          </div>
        </div>
      </header>
      <CandidateNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter
        noteLeft="Part of Frog's long-standing overseas career community."
        noteRight="Questions about your next step? Contact your Frog representative."
      />
    </div>
  );
}
