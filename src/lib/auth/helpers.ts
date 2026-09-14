import { auth } from "./auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import {
  isViewAsSession,
  resolveEffectiveSession,
} from "@/lib/auth/view-as";

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

/**
 * Real NextAuth session (admin stays admin even during view-as).
 * Prefer requireCandidate / requireEmployer for role areas.
 */
export async function requireRealSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

/** Effective actor: view-as overlay when admin is previewing. */
async function effectiveAuth(): Promise<Session | null> {
  const real = await auth();
  const { session } = await resolveEffectiveSession(real);
  return session;
}

/** Candidate area guard: candidate role, approved, password reset done, consent given. */
export async function requireCandidate(): Promise<Session> {
  const { requireCandidateReady } = await import("@/lib/candidate/guard");
  const { session } = await requireCandidateReady();
  return session;
}

/** Candidate mutations — blocked during admin view-as (read-only preview). */
export async function requireCandidateWritable(): Promise<Session> {
  const session = await requireCandidate();
  if (isViewAsSession(session)) {
    redirect("/me?readonly=1");
  }
  return session;
}

/** Candidate logged in but before the consent gate (used by /consent itself). */
export async function requireCandidatePreConsent(): Promise<Session> {
  const session = await effectiveAuth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "admin") redirect("/admin");
  if (session.user.role === "employer") redirect("/portal");
  return session;
}

/** Admin pages guard (never uses view-as overlay). */
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
  const session = await effectiveAuth();
  if (!session?.user) redirect("/employer/login");
  if (session.user.role !== "employer") redirect(roleHome(session.user.role));
  return session;
}

/** Employer mutations — blocked during admin view-as. */
export async function requireEmployerWritable(): Promise<Session> {
  const session = await requireEmployer();
  if (isViewAsSession(session)) {
    redirect("/portal?readonly=1");
  }
  return session;
}

/** Employer API guard → 403 JSON. Allows admin view-as (reads); mutations must check separately. */
export async function requireEmployerApi(): Promise<
  { session: Session; error: null } | { session: null; error: NextResponse }
> {
  const session = await effectiveAuth();
  if (!session?.user?.id || session.user.role !== "employer") {
    return {
      session: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, error: null };
}
