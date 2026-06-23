import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, auth } from "@/lib/auth/auth";
import { roleHome } from "@/lib/auth/helpers";
import { Logo } from "@/components/brand/Logo";

async function employerLogin(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    await signIn("credentials", { email, password, redirectTo: "/portal" });
  } catch (e) {
    if (e instanceof AuthError) {
      redirect("/employer/login?error=1");
    }
    throw e; // re-throw NEXT_REDIRECT (success) and anything else
  }
}

export default async function EmployerLoginPage({
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
          <h1 className="text-2xl font-bold text-ink">Employer login</h1>
          <p className="mt-2 text-sm text-muted">
            Log in with the email address and password issued to you by Frog.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            The email address or password is incorrect.
          </div>
        )}

        <form action={employerLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-ink"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button type="submit" className="btn-primary w-full px-6 py-3">
            Log in
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Candidates can{" "}
          <a href="/login" className="text-primary hover:underline">
            log in here
          </a>
        </p>
      </div>
    </div>
  );
}
