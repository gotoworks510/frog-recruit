import { cookies } from "next/headers";
import { signIn } from "@/lib/auth/auth";
import { getD1Db } from "@/lib/db/client";
import { validateInviteToken } from "@/lib/invite/validate-token";
import { Logo } from "@/components/brand/Logo";

const REASON_MESSAGE: Record<string, string> = {
  not_found: "Invitation link not found.",
  expired: "This invitation link has expired.",
  revoked: "This invitation link has been revoked.",
  max_uses_reached: "This invitation link has already been used.",
};

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = await getD1Db();
  const result = await validateInviteToken(db, token);

  if (!result.valid) {
    return (
      <Shell>
        <h1 className="text-xl font-bold text-ink">We couldn't verify this invitation</h1>
        <p className="mt-3 text-sm text-muted">
          {REASON_MESSAGE[result.reason] ?? "This invitation link is invalid."}
          <br />
          Please ask your Frog contact for a new invitation link.
        </p>
      </Shell>
    );
  }

  const inviteEmail = result.invite.email;

  async function accept() {
    "use server";
    // Store the token so the signIn callback can match it to the Google email.
    const cookieStore = await cookies();
    cookieStore.set("invite_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 10,
      path: "/",
    });
    await signIn("google", { redirectTo: "/me" });
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold text-ink">Welcome to Frog Recruit</h1>
      <p className="mt-3 text-sm text-muted">
        This invitation was sent to{" "}
        <span className="font-medium text-ink">{inviteEmail}</span>. Please sign in
        with that same Google account.
      </p>
      <form action={accept} className="mt-6">
        <button type="submit" className="btn-primary w-full px-6 py-3">
          Sign in with Google to get started
        </button>
      </form>
      <p className="mt-4 text-xs text-muted">
        Note: you can only sign in with the Google account matching the invited email
        address.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-2xl bg-paper p-8 text-center shadow-sm ring-1 ring-line">
        <div className="mb-6 flex justify-center">
          <Logo variant="green" height={40} />
        </div>
        {children}
      </div>
    </div>
  );
}
