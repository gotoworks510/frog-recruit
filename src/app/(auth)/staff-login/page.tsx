import Link from "next/link";
import { signIn } from "@/lib/auth/auth";
import { Logo } from "@/components/brand/Logo";

export const dynamic = "force-dynamic";

export default function StaffLogin() {
  return <main className="min-h-screen bg-surface px-5 py-16">
    <section className="mx-auto max-w-md rounded-lg border border-line bg-paper p-8">
      <Logo height={56}/>
      <p className="mt-8 text-xs font-semibold uppercase tracking-widest text-muted">Frog / Sales workspace</p>
      <h1 className="mt-3 text-3xl font-semibold">Staff sign in</h1>
      <p className="mt-4 text-sm leading-7 text-muted">Use your authorized Frog Google account. This workspace is available to approved administrators only.</p>
      <form className="mt-8" action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/admin/sales" });
      }}><button className="btn-primary w-full">Sign in with Google</button></form>
      <Link href="/admin/sales" className="mt-5 block text-center text-sm underline">Already signed in? Open workspace</Link>
    </section>
  </main>;
}
