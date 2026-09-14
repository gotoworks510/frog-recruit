import Link from "next/link";
import { signIn, auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { roleHome } from "@/lib/auth/helpers";
import { AuthSplitShell } from "@/components/auth/AuthSplitShell";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect(roleHome(session.user.role));

  const { error } = await searchParams;

  return (
    <AuthSplitShell
      audienceLabel="For candidates"
      headline={
        <>
          Your next chapter.
          <br />
          With people in your corner.
        </>
      }
      body="A place to prepare your profile and see what hiring companies will see."
      footerLines={[
        "About 12 years of supporting careers abroad.",
        "Rooted in Vancouver's Frog community.",
      ]}
    >
      <p className="label-caps">Welcome to Frog Recruit</p>
      <h2 className="mt-2 font-heading text-3xl font-semibold text-ink">
        Candidate login
      </h2>
      <p className="mt-3 text-sm text-muted">
        Use the Google account that received your invitation from Frog.
      </p>

      {error === "AccessDenied" && (
        <div className="mt-5 rounded-md bg-red-50 p-3 text-sm text-red-700">
          This account doesn&apos;t have an invitation. Please check with your
          Frog contact.
        </div>
      )}

      <form
        className="mt-8"
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/me" });
        }}
      >
        <button
          type="submit"
          className="btn-outline w-full gap-3 px-6 py-3.5 text-base shadow-sm"
        >
          <GoogleIcon />
          Sign in with Google
        </button>
      </form>

      <p className="mt-5 text-xs leading-relaxed text-muted">
        Access is by invitation. If you need help, contact your Frog
        representative.
      </p>

      <p className="mt-8 text-sm">
        <Link href="/employer/login" className="font-medium text-primary hover:underline">
          Hiring company? Employer login →
        </Link>
      </p>
    </AuthSplitShell>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
