import Link from "next/link";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, auth } from "@/lib/auth/auth";
import { roleHome } from "@/lib/auth/helpers";
import { AuthSplitShell } from "@/components/auth/AuthSplitShell";

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
    <AuthSplitShell
      audienceLabel="For hiring teams"
      headline={
        <>
          Meet the person.
          <br />
          Understand the perspective.
        </>
      }
      body="Access the candidates introduced to your company, with Frog's recommendation and points to consider."
      footerLines={[
        "A private introduction portal. Built on about 12 years of overseas career support.",
      ]}
    >
      <p className="label-caps">Your company portal</p>
      <h2 className="mt-2 font-heading text-3xl font-semibold text-ink">
        Employer login
      </h2>
      <p className="mt-3 text-sm text-muted">
        Use the email address and password provided by Frog.
      </p>

      {error && (
        <div className="mt-5 rounded-md bg-red-50 p-3 text-sm text-red-700">
          The email address or password is incorrect.
        </div>
      )}

      <form action={employerLogin} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input-field py-2.5"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="input-field py-2.5"
          />
        </div>
        <button type="submit" className="btn-primary w-full px-6 py-3.5 text-base">
          Log in
        </button>
      </form>

      <p className="mt-4 text-center text-sm">
        <Link
          href="/forgot-password?appVariant=employer"
          className="font-medium text-primary hover:underline"
        >
          Forgot password?
        </Link>
      </p>

      <p className="mt-8 text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Candidate? Sign in here →
        </Link>
      </p>
    </AuthSplitShell>
  );
}
