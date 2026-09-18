import { and, eq, isNull } from "drizzle-orm";
import {
  candidateAccounts,
  candidateConsents,
  candidateProfiles,
  employerAccounts,
  mobileSessions,
  users,
} from "@/lib/db/schema";
import { getD1Db } from "@/lib/db/client";
import { rateLimit } from "@/lib/ratelimit/kv";
import type { AppVariant } from "@/lib/db/schema/mobile";
import type { Database } from "@/lib/db/client";
import { verifyAccessToken } from "./jwt";
import {
  gateRequired,
  rateLimited,
  unauthorized,
  wrongApp,
  type GateName,
} from "./errors";

export type MobileRole = "candidate" | "employer";

export interface MobileGates {
  mustResetPassword: boolean;
  termsAccepted: boolean;
  /** Candidates only; always true for employers. */
  consentActive: boolean;
  disabled: boolean;
}

export interface MobileContext {
  db: Database;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: MobileRole;
    status: string;
    companyId: string | null;
    isTest: boolean;
    termsAcceptedAt: Date | null;
    termsVersion: string | null;
  };
  /** Candidate profile id (candidates only). */
  profileId: string | null;
  gates: MobileGates;
  session: { id: string; appVariant: AppVariant; deviceId: string };
  /** Audit metadata from the request. */
  meta: { ip: string | null; userAgent: string | null };
}

export type MobileAuth =
  | { ctx: MobileContext; error: null }
  | { ctx: null; error: Response };

export interface RequireMobileOptions {
  /** Omit for endpoints both apps share (/me, /account, /notifications, …). */
  role?: MobileRole;
  /** Writes must satisfy the gates unless listed in `skipGates`. */
  mutation?: boolean;
  /**
   * Gates this endpoint is allowed to bypass (owner decision §6). Example:
   * `POST /candidate/consent` passes `["consent"]`, the password endpoint
   * passes all three.
   */
  skipGates?: GateName[];
  /** Per-user write throttle (default 120/min for mutations). */
  rateLimit?: { key: string; limit: number; windowSeconds: number } | false;
}

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Bearer gate for every `/api/v1` endpoint.
 *
 * JWT claims are never trusted for authorization: the user row, the session
 * row, the disabled/must-reset flags, Terms acceptance and (for candidates)
 * consent are re-read from D1 on every request (§11-2).
 */
export async function requireMobile(
  request: Request,
  options: RequireMobileOptions
): Promise<MobileAuth> {
  const token = bearer(request);
  if (!token) return { ctx: null, error: unauthorized() };

  const payload = await verifyAccessToken(token);
  if (!payload) return { ctx: null, error: unauthorized() };

  const db = await getD1Db();

  const session = await db
    .select({
      id: mobileSessions.id,
      userId: mobileSessions.userId,
      appVariant: mobileSessions.appVariant,
      deviceId: mobileSessions.deviceId,
      revokedAt: mobileSessions.revokedAt,
      expiresAt: mobileSessions.expiresAt,
    })
    .from(mobileSessions)
    .where(eq(mobileSessions.id, payload.sid))
    .get();

  if (
    !session ||
    session.userId !== payload.sub ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    return { ctx: null, error: unauthorized() };
  }

  const user = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
      companyId: users.employerCompanyId,
      isTest: users.isTest,
      termsAcceptedAt: users.termsAcceptedAt,
      termsVersion: users.termsVersion,
    })
    .from(users)
    .where(eq(users.id, payload.sub))
    .get();

  if (!user || (user.role !== "candidate" && user.role !== "employer")) {
    return { ctx: null, error: unauthorized() };
  }
  if (user.status === "rejected") return { ctx: null, error: unauthorized() };

  // appVariant ↔ role must match: an employer token can never reach a
  // candidate endpoint and vice versa.
  if (session.appVariant !== user.role) {
    return { ctx: null, error: wrongApp(user.role) };
  }
  if (options.role && user.role !== options.role) {
    return { ctx: null, error: wrongApp(user.role) };
  }

  const { gates, profileId } = await loadGates(db, user.id, user.role);
  if (gates.disabled) return { ctx: null, error: unauthorized() };

  if (options.mutation) {
    const skip = new Set(options.skipGates ?? []);
    if (gates.mustResetPassword && !skip.has("password_reset")) {
      return { ctx: null, error: gateRequired("password_reset") };
    }
    if (!gates.termsAccepted && !skip.has("terms")) {
      return { ctx: null, error: gateRequired("terms") };
    }
    if (user.role === "candidate" && !gates.consentActive && !skip.has("consent")) {
      return { ctx: null, error: gateRequired("consent") };
    }

    const throttle =
      options.rateLimit === false
        ? null
        : (options.rateLimit ?? {
            key: `rl:v1:write:${user.id}`,
            limit: 120,
            windowSeconds: 60,
          });
    if (throttle) {
      const allowed = await rateLimit(
        throttle.key,
        throttle.limit,
        throttle.windowSeconds
      );
      if (!allowed) return { ctx: null, error: rateLimited() };
    }
  }

  // Touch the session so we can spot dormant devices later.
  await db
    .update(mobileSessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(mobileSessions.id, session.id));

  return {
    ctx: {
      db,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        companyId: user.companyId,
        isTest: user.isTest,
        termsAcceptedAt: user.termsAcceptedAt,
        termsVersion: user.termsVersion,
      },
      profileId,
      gates,
      session: {
        id: session.id,
        appVariant: session.appVariant,
        deviceId: session.deviceId,
      },
      meta: {
        ip:
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for") ||
          null,
        userAgent: request.headers.get("user-agent"),
      },
    },
    error: null,
  };
}

/** Same gate set the Web guards enforce (employer/guard.ts, candidate/guard.ts). */
export async function loadGates(
  db: Database,
  userId: string,
  role: MobileRole
): Promise<{ gates: MobileGates; profileId: string | null }> {
  const user = await db
    .select({ termsAcceptedAt: users.termsAcceptedAt })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (role === "employer") {
    const acct = await db
      .select({
        mustReset: employerAccounts.mustResetPassword,
        disabledAt: employerAccounts.disabledAt,
      })
      .from(employerAccounts)
      .where(eq(employerAccounts.userId, userId))
      .get();
    return {
      gates: {
        mustResetPassword: !!acct?.mustReset,
        termsAccepted: !!user?.termsAcceptedAt,
        consentActive: true,
        disabled: !!acct?.disabledAt,
      },
      profileId: null,
    };
  }

  const acct = await db
    .select({
      mustReset: candidateAccounts.mustResetPassword,
      disabledAt: candidateAccounts.disabledAt,
    })
    .from(candidateAccounts)
    .where(eq(candidateAccounts.userId, userId))
    .get();

  const profile = await db
    .select({ id: candidateProfiles.id })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, userId))
    .get();

  let consentActive = false;
  if (profile) {
    const consent = await db
      .select({ id: candidateConsents.id })
      .from(candidateConsents)
      .where(
        and(
          eq(candidateConsents.candidateProfileId, profile.id),
          isNull(candidateConsents.revokedAt)
        )
      )
      .get();
    consentActive = !!consent;
  }

  return {
    gates: {
      mustResetPassword: !!acct?.mustReset,
      termsAccepted: !!user?.termsAcceptedAt,
      consentActive,
      disabled: !!acct?.disabledAt,
    },
    profileId: profile?.id ?? null,
  };
}
