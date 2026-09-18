import { and, eq, isNull, or } from "drizzle-orm";
import {
  candidateAccounts,
  companies,
  devicePushTokens,
  employerAccounts,
  mobileSessions,
  passwordResetTokens,
  users,
} from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { loginRateLimit, rateLimit } from "@/lib/ratelimit/kv";
import { applyNewPassword, MIN_PASSWORD_LENGTH } from "@/lib/account/password-core";
import { revokeMobileSessions } from "@/lib/notify/sessions";
import {
  notifySlackUnlessTest,
  sendEmailUnlessTest,
} from "@/lib/notify/skip-ops";
import { buildPasswordResetEmail } from "@/lib/email/messages";
import { escapeSlack } from "@/lib/slack/notify";
import type { AppVariant } from "@/lib/db/schema/mobile";
import type { Database } from "@/lib/db/client";
import { randomToken, sha256Hex } from "./crypto";
import { signAccessToken } from "./jwt";
import { loadGates, type MobileGates, type MobileRole } from "./require-mobile";

/** Refresh tokens live 30 days; rotation happens on every use. */
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Window in which the previous refresh token still works (parallel refresh). */
export const REFRESH_GRACE_MS = 60 * 1000;
export const RESET_TOKEN_TTL_MINUTES = 30;

export interface DeviceInfo {
  id: string;
  name?: string | null;
  appVersion?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionUser {
  id: string;
  name: string | null;
  email: string;
  role: MobileRole;
  company: { id: string; name: string | null } | null;
}

export type LoginResult =
  | {
      ok: true;
      tokens: AuthTokens;
      user: SessionUser;
      gates: MobileGates;
      sessionId: string;
    }
  | { ok: false; reason: "invalid" | "rate_limited" | "wrong_app"; role?: MobileRole };

/**
 * Credentials login for the mobile apps. Deliberately uniform failures
 * (`invalid`) so the response can't be used to enumerate accounts.
 */
export async function login(
  db: Database,
  params: {
    email: string;
    password: string;
    appVariant: AppVariant;
    device: DeviceInfo;
    ip: string | null;
  }
): Promise<LoginResult> {
  const email = params.email.trim().toLowerCase();

  const ipOk = await loginRateLimit(params.ip || "unknown");
  if (!ipOk) return { ok: false, reason: "rate_limited" };
  const emailOk = await rateLimit(`rl:v1:login:${email}`, 10, 900);
  if (!emailOk) return { ok: false, reason: "rate_limited" };

  const row = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
      passwordHash: users.passwordHash,
      passwordSalt: users.passwordSalt,
      companyId: users.employerCompanyId,
    })
    .from(users)
    .where(and(eq(users.email, email), eq(users.authProvider, "credentials")))
    .get();

  if (!row?.passwordHash || !row.passwordSalt) return { ok: false, reason: "invalid" };
  if (row.role !== "employer" && row.role !== "candidate") {
    return { ok: false, reason: "invalid" };
  }
  if (row.status === "rejected") return { ok: false, reason: "invalid" };

  const passwordOk = await verifyPassword(
    params.password,
    row.passwordHash,
    row.passwordSalt
  );
  if (!passwordOk) return { ok: false, reason: "invalid" };

  const { gates } = await loadGates(db, row.id, row.role);
  if (gates.disabled) return { ok: false, reason: "invalid" };

  // Right credentials, wrong app binary.
  if (params.appVariant !== row.role) {
    return { ok: false, reason: "wrong_app", role: row.role };
  }

  const company = await resolveCompany(db, row.id, row.companyId);

  const session = await createSession(db, {
    userId: row.id,
    appVariant: params.appVariant,
    device: params.device,
  });

  const access = await signAccessToken({
    sub: row.id,
    role: row.role,
    companyId: company?.id ?? null,
    sid: session.id,
    appVariant: params.appVariant,
  });

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, row.id));

  return {
    ok: true,
    sessionId: session.id,
    tokens: {
      accessToken: access.token,
      refreshToken: session.refreshToken,
      expiresIn: access.expiresIn,
    },
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      company,
    },
    gates,
  };
}

async function resolveCompany(
  db: Database,
  userId: string,
  companyIdOnUser: string | null
): Promise<{ id: string; name: string | null } | null> {
  let companyId = companyIdOnUser;
  if (!companyId) {
    const acct = await db
      .select({ companyId: employerAccounts.companyId })
      .from(employerAccounts)
      .where(eq(employerAccounts.userId, userId))
      .get();
    companyId = acct?.companyId ?? null;
  }
  if (!companyId) return null;
  const company = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();
  return company ?? { id: companyId, name: null };
}

/** One row per device session; the token itself is only ever stored hashed. */
async function createSession(
  db: Database,
  params: { userId: string; appVariant: AppVariant; device: DeviceInfo }
): Promise<{ id: string; refreshToken: string }> {
  // Replace any previous session for this (user, device) so re-login doesn't
  // leave an orphan refresh token alive.
  await db
    .update(mobileSessions)
    .set({ revokedAt: new Date(), revokedReason: "logout" })
    .where(
      and(
        eq(mobileSessions.userId, params.userId),
        eq(mobileSessions.deviceId, params.device.id),
        isNull(mobileSessions.revokedAt)
      )
    );

  const id = crypto.randomUUID();
  const refreshToken = randomToken();
  await db.insert(mobileSessions).values({
    id,
    userId: params.userId,
    appVariant: params.appVariant,
    deviceId: params.device.id,
    deviceName: params.device.name ?? null,
    appVersion: params.device.appVersion ?? null,
    refreshTokenHash: await sha256Hex(refreshToken),
    createdAt: new Date(),
    lastUsedAt: new Date(),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return { id, refreshToken };
}

export type RefreshResult =
  | { ok: true; tokens: AuthTokens }
  | { ok: false; reason: "invalid" | "rate_limited" };

/**
 * Rotating refresh with a 60s grace window and reuse detection
 * (owner decision §8).
 *
 * - presented hash == current  → normal rotation (previous = old current,
 *   grace = now + 60s)
 * - presented hash == previous within grace → rotate again, keep the original
 *   `previous_token_hash` and do NOT extend the grace window
 * - previous after grace, or any hash belonging to a revoked session
 *   → reuse detected: kill every session for that user + Slack warning
 * - anything else → uniform 401
 */
export async function refresh(
  db: Database,
  params: { refreshToken: string }
): Promise<RefreshResult> {
  const presented = await sha256Hex(params.refreshToken);

  const session = await db
    .select()
    .from(mobileSessions)
    .where(
      or(
        eq(mobileSessions.refreshTokenHash, presented),
        eq(mobileSessions.previousTokenHash, presented)
      )
    )
    .get();

  if (!session) return { ok: false, reason: "invalid" };

  const perUser = await rateLimit(`rl:v1:refresh:${session.userId}`, 60, 3600);
  if (!perUser) return { ok: false, reason: "rate_limited" };

  // Any token of an already-revoked session is a replay.
  if (session.revokedAt) {
    await handleReuse(db, session.userId);
    return { ok: false, reason: "invalid" };
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "invalid" };
  }

  const isCurrent = session.refreshTokenHash === presented;
  const now = new Date();

  if (!isCurrent) {
    const graceUntil = session.previousGraceUntil?.getTime() ?? 0;
    if (now.getTime() >= graceUntil) {
      await handleReuse(db, session.userId);
      return { ok: false, reason: "invalid" };
    }
  }

  const user = await db
    .select({
      id: users.id,
      role: users.role,
      status: users.status,
      companyId: users.employerCompanyId,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .get();
  if (
    !user ||
    (user.role !== "candidate" && user.role !== "employer") ||
    user.status === "rejected"
  ) {
    return { ok: false, reason: "invalid" };
  }

  const { gates } = await loadGates(db, user.id, user.role);
  if (gates.disabled) return { ok: false, reason: "invalid" };

  const nextToken = randomToken();
  await db
    .update(mobileSessions)
    .set({
      refreshTokenHash: await sha256Hex(nextToken),
      // Grace rotation keeps the originally retired hash and its deadline.
      previousTokenHash: isCurrent ? presented : session.previousTokenHash,
      previousGraceUntil: isCurrent
        ? new Date(now.getTime() + REFRESH_GRACE_MS)
        : session.previousGraceUntil,
      lastUsedAt: now,
    })
    .where(eq(mobileSessions.id, session.id));

  const access = await signAccessToken({
    sub: user.id,
    role: user.role,
    companyId: user.companyId,
    sid: session.id,
    appVariant: session.appVariant,
  });

  return {
    ok: true,
    tokens: {
      accessToken: access.token,
      refreshToken: nextToken,
      expiresIn: access.expiresIn,
    },
  };
}

async function handleReuse(db: Database, userId: string): Promise<void> {
  await revokeMobileSessions(db, userId, "reuse_detected");
  await notifySlackUnlessTest(
    db,
    [userId],
    [
      ":rotating_light: *Mobile refresh token reuse detected*",
      `*User:* ${escapeSlack(userId)}`,
      "_All mobile sessions were revoked and push tokens removed. The user must sign in again._",
    ].join("\n")
  );
}

/** Sign out this device: revoke the session row + drop its push token. */
export async function logout(
  db: Database,
  params: { sessionId: string; userId: string; deviceId: string }
): Promise<void> {
  await db
    .update(mobileSessions)
    .set({ revokedAt: new Date(), revokedReason: "logout" })
    .where(
      and(
        eq(mobileSessions.id, params.sessionId),
        eq(mobileSessions.userId, params.userId)
      )
    );
  await db
    .delete(devicePushTokens)
    .where(
      and(
        eq(devicePushTokens.userId, params.userId),
        eq(devicePushTokens.deviceId, params.deviceId)
      )
    );
}

/**
 * Start a self-service password reset. The caller always gets the same
 * response — only credentials accounts of the matching role actually get mail.
 */
export async function requestPasswordReset(
  db: Database,
  params: { email: string; appVariant: AppVariant }
): Promise<void> {
  const email = params.email.trim().toLowerCase();
  const allowed = await rateLimit(`rl:v1:pwreset:${email}`, 5, 900);
  if (!allowed) return;

  const user = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(and(eq(users.email, email), eq(users.authProvider, "credentials")))
    .get();

  if (!user || user.role !== params.appVariant) return;
  if (user.status === "rejected") return;

  const { gates } = await loadGates(db, user.id, params.appVariant);
  if (gates.disabled) return;

  const token = randomToken(24);
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: await sha256Hex(token),
    appVariant: params.appVariant,
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
    createdAt: new Date(),
  });

  const { subject, subtitle, bodyHtml } = buildPasswordResetEmail({
    name: user.name,
    token,
    expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
  });
  const result = await sendEmailUnlessTest(db, {
    to: user.email,
    subject,
    subtitle,
    bodyHtml,
  });
  if (!result.ok) {
    console.error("[auth] password reset email failed:", result.error);
  }
}

export type ConfirmResetResult =
  | { ok: true }
  | { ok: false; reason: "invalid_token" | "weak_password" };

/** Complete a reset. All mobile sessions are revoked afterwards (§5). */
export async function confirmPasswordReset(
  db: Database,
  params: { token: string; newPassword: string }
): Promise<ConfirmResetResult> {
  if (params.newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: "weak_password" };
  }

  const tokenHash = await sha256Hex(params.token.trim());
  const row = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .get();

  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "invalid_token" };
  }

  const user = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, row.userId))
    .get();
  if (!user || (user.role !== "candidate" && user.role !== "employer")) {
    return { ok: false, reason: "invalid_token" };
  }

  await applyNewPassword(db, {
    userId: user.id,
    role: user.role,
    newPassword: params.newPassword,
  });
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, row.id));

  // Clear the forced-reset funnel — the user just chose their own password.
  if (user.role === "employer") {
    await db
      .update(employerAccounts)
      .set({ mustResetPassword: false })
      .where(eq(employerAccounts.userId, user.id));
  } else {
    await db
      .update(candidateAccounts)
      .set({ mustResetPassword: false })
      .where(eq(candidateAccounts.userId, user.id));
  }

  await revokeMobileSessions(db, user.id, "password_changed");
  return { ok: true };
}
