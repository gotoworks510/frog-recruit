import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";
import { getD1Db } from "@/lib/db/client";
import { users, employerAccounts } from "@/lib/db/schema";

export const VIEW_AS_COOKIE = "recruit_view_as";
const VIEW_AS_TTL_SEC = 60 * 60; // 1 hour

export type ViewAsRole = "candidate" | "employer";

export type ViewAsPayload = {
  v: 1;
  as: ViewAsRole;
  targetUserId: string;
  adminId: string;
  exp: number; // unix seconds
};

export type ViewAsMeta = {
  adminId: string;
  adminEmail: string | null | undefined;
  as: ViewAsRole;
  label: string;
};

function secret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    ""
  );
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSign(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return b64url(new Uint8Array(sig));
}

async function hmacVerify(message: string, sigB64: string): Promise<boolean> {
  if (!secret()) return false;
  const expected = await hmacSign(message);
  if (expected.length !== sigB64.length) return false;
  let ok = 0;
  for (let i = 0; i < expected.length; i++) {
    ok |= expected.charCodeAt(i) ^ sigB64.charCodeAt(i);
  }
  return ok === 0;
}

export async function encodeViewAsCookie(payload: ViewAsPayload): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacSign(body);
  return `${body}.${sig}`;
}

export async function decodeViewAsCookie(
  raw: string | undefined | null
): Promise<ViewAsPayload | null> {
  if (!raw || !secret()) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  if (!(await hmacVerify(body, sig))) return null;
  try {
    const json = new TextDecoder().decode(b64urlDecode(body));
    const parsed = JSON.parse(json) as ViewAsPayload;
    if (parsed?.v !== 1) return null;
    if (parsed.as !== "candidate" && parsed.as !== "employer") return null;
    if (!parsed.targetUserId || !parsed.adminId || !parsed.exp) return null;
    if (parsed.exp * 1000 < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearViewAsCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(VIEW_AS_COOKIE);
}

export async function setViewAsCookie(payload: ViewAsPayload): Promise<void> {
  if (!secret()) {
    throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) is required for view-as");
  }
  const jar = await cookies();
  const value = await encodeViewAsCookie(payload);
  jar.set(VIEW_AS_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VIEW_AS_TTL_SEC,
  });
}

export function buildViewAsPayload(
  adminId: string,
  as: ViewAsRole,
  targetUserId: string
): ViewAsPayload {
  return {
    v: 1,
    as,
    targetUserId,
    adminId,
    exp: Math.floor(Date.now() / 1000) + VIEW_AS_TTL_SEC,
  };
}

/**
 * If the real session is admin and a valid view-as cookie is set, return a
 * synthetic session for the target candidate/employer. Otherwise return real.
 */
export async function resolveEffectiveSession(
  real: Session | null
): Promise<{ session: Session | null; viewAs: ViewAsMeta | null }> {
  if (!real?.user) return { session: null, viewAs: null };
  if (real.user.role !== "admin") return { session: real, viewAs: null };

  const jar = await cookies();
  const payload = await decodeViewAsCookie(jar.get(VIEW_AS_COOKIE)?.value);
  if (!payload) return { session: real, viewAs: null };
  if (payload.adminId !== real.user.id) {
    await clearViewAsCookie();
    return { session: real, viewAs: null };
  }

  const db = await getD1Db();
  const target = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
      companyId: users.employerCompanyId,
      privacyConsentedAt: users.privacyConsentedAt,
      termsAcceptedAt: users.termsAcceptedAt,
    })
    .from(users)
    .where(eq(users.id, payload.targetUserId))
    .get();

  if (!target || target.role !== payload.as) {
    await clearViewAsCookie();
    return { session: real, viewAs: null };
  }

  if (payload.as === "employer") {
    const acct = await db
      .select({ disabledAt: employerAccounts.disabledAt })
      .from(employerAccounts)
      .where(eq(employerAccounts.userId, target.id))
      .get();
    if (acct?.disabledAt) {
      await clearViewAsCookie();
      return { session: real, viewAs: null };
    }
  }

  const viewAs: ViewAsMeta = {
    adminId: real.user.id,
    adminEmail: real.user.email,
    as: payload.as,
    label: target.email || target.name || target.id,
  };

  const session: Session = {
    ...real,
    user: {
      id: target.id,
      email: target.email,
      name: target.name,
      image: null,
      role: target.role,
      status: target.status,
      companyId: target.companyId,
      privacyConsentedAt: target.privacyConsentedAt
        ? target.privacyConsentedAt.getTime()
        : null,
      termsAcceptedAt: target.termsAcceptedAt
        ? target.termsAcceptedAt.getTime()
        : null,
      viewAs,
    },
  };

  return { session, viewAs };
}

export function isViewAsSession(session: Session | null | undefined): boolean {
  return Boolean(session?.user?.viewAs);
}
