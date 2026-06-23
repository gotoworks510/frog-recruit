import { auth } from "./auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

/** Logged in only (no status/consent gate). Used by holding pages. */
export async function requireLogin(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

/** Route a logged-in user to their role's home. */
export function roleHome(role: string): string {
  if (role === "admin") return "/admin";
  if (role === "employer") return "/portal";
  return "/me";
}

/** Candidate area guard: candidate role, approved, consent given. */
export async function requireCandidate(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "admin") redirect("/admin");
  if (session.user.role === "employer") redirect("/portal");
  if (session.user.status === "rejected") redirect("/rejected");
  if (session.user.status !== "approved") redirect("/pending");
  if (!session.user.privacyConsentedAt) redirect("/consent");
  return session;
}

/** Candidate logged in but before the consent gate (used by /consent itself). */
export async function requireCandidatePreConsent(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "admin") redirect("/admin");
  if (session.user.role === "employer") redirect("/portal");
  return session;
}

/** Admin pages guard. */
export async function requireAdmin(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect(roleHome(session.user.role));
  return session;
}

/** Admin API guard → 403 JSON. */
export async function requireAdminApi(): Promise<
  { session: Session; error: null } | { session: null; error: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return {
      session: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, error: null };
}

/** Employer pages guard. */
export async function requireEmployer(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/employer/login");
  if (session.user.role !== "employer") redirect(roleHome(session.user.role));
  return session;
}

/** Employer API guard → 403 JSON. */
export async function requireEmployerApi(): Promise<
  { session: Session; error: null } | { session: null; error: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "employer") {
    return {
      session: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, error: null };
}
