import { signIn, auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { roleHome } from "@/lib/auth/helpers";
import { Logo } from "@/components/brand/Logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect(roleHome(session.user.role));

  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-2xl bg-paper p-8 shadow-sm ring-1 ring-line">
        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <Logo variant="green" height={40} />
          </div>
          <h1 className="text-2xl font-bold text-ink">Candidate login</h1>
          <p className="mt-2 text-sm text-muted">
            Sign in with the Google account that received an invitation from Frog.
          </p>
        </div>

        {error === "AccessDenied" && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            This account doesn't have an invitation. Please check with your Frog contact.
          </div>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/me" });
          }}
        >
          <button type="submit" className="btn-primary w-full px-6 py-3">
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Hiring companies can{" "}
          <a href="/employer/login" className="text-primary hover:underline">
            log in here
          </a>
        </p>
      </div>
    </div>
  );
}
