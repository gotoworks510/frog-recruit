import { eq } from "drizzle-orm";
import { candidateAccounts, employerAccounts, users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { revokeMobileSessions } from "@/lib/notify/sessions";
import type { Database } from "@/lib/db/client";

export const MIN_PASSWORD_LENGTH = 8;

export type ChangePasswordFailure = "invalid" | "current" | "unsupported";

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: ChangePasswordFailure };

/**
 * Self-service password change for employer / candidate credentials accounts.
 * Clears the forced-reset flag and revokes mobile sessions (§7.5).
 *
 * `exceptSessionId` keeps the caller's own mobile session alive so an in-app
 * password change signs out the other devices only. Web callers omit it, which
 * signs out every mobile device.
 */
export async function changePassword(
  db: Database,
  params: {
    userId: string;
    role: "candidate" | "employer";
    currentPassword: string;
    newPassword: string;
    exceptSessionId?: string | null;
  }
): Promise<ChangePasswordResult> {
  if (params.newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: "invalid" };
  }

  const u = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      passwordSalt: users.passwordSalt,
      authProvider: users.authProvider,
    })
    .from(users)
    .where(eq(users.id, params.userId))
    .get();

  if (!u?.passwordHash || !u.passwordSalt || u.authProvider !== "credentials") {
    return { ok: false, reason: "unsupported" };
  }

  const ok = await verifyPassword(
    params.currentPassword,
    u.passwordHash,
    u.passwordSalt
  );
  if (!ok) return { ok: false, reason: "current" };

  await applyNewPassword(db, {
    userId: params.userId,
    role: params.role,
    newPassword: params.newPassword,
  });
  await revokeMobileSessions(db, params.userId, "password_changed", {
    exceptSessionId: params.exceptSessionId ?? null,
  });

  return { ok: true };
}

/**
 * Write a new password + clear must-reset. Shared by the self-service change
 * and the password-reset confirm flow (which has no current password).
 */
export async function applyNewPassword(
  db: Database,
  params: {
    userId: string;
    role: "candidate" | "employer";
    newPassword: string;
  }
): Promise<void> {
  const { hash, salt } = await hashPassword(params.newPassword);
  await db
    .update(users)
    .set({
      passwordHash: hash,
      passwordSalt: salt,
      passwordUpdatedAt: new Date(),
      authProvider: "credentials",
    })
    .where(eq(users.id, params.userId));

  if (params.role === "employer") {
    await db
      .update(employerAccounts)
      .set({ mustResetPassword: false, lastPasswordRotationAt: new Date() })
      .where(eq(employerAccounts.userId, params.userId));
    return;
  }

  const acct = await db
    .select({ id: candidateAccounts.id })
    .from(candidateAccounts)
    .where(eq(candidateAccounts.userId, params.userId))
    .get();
  if (acct) {
    await db
      .update(candidateAccounts)
      .set({ mustResetPassword: false, lastPasswordRotationAt: new Date() })
      .where(eq(candidateAccounts.userId, params.userId));
  } else {
    await db.insert(candidateAccounts).values({
      userId: params.userId,
      mustResetPassword: false,
      lastPasswordRotationAt: new Date(),
    });
  }
}
