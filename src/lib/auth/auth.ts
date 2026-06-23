import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { cookies, headers } from "next/headers";
import { eq, sql, and } from "drizzle-orm";
import {
  users,
  candidateProfiles,
  candidateInvites,
  employerAccounts,
} from "@/lib/db/schema";
import { validateInviteToken } from "@/lib/invite/validate-token";
import { verifyPassword } from "@/lib/auth/password";
import { loginRateLimit } from "@/lib/ratelimit/kv";

/**
 * ADMIN_EMAILS is the single source of truth for the admin role.
 * Comma-separated list, e.g. ADMIN_EMAILS=senna@frogagent.com,other@example.com
 */
export function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

// NOTE: lazy config (function form). On OpenNext/Cloudflare, Worker *secrets*
// (GOOGLE_CLIENT_SECRET, AUTH_SECRET) are only present in process.env at REQUEST
// time, not at module-load. Evaluating the config per-request ensures the
// OAuth client secret is read correctly (a static config captures it as
// undefined → "Configuration" error at the callback / token exchange).
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  trustHost: true,
  session: { strategy: "jwt" as const },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    // Employer credential login (email + PBKDF2 password issued by an admin).
    Credentials({
      name: "Employer",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        // KV login rate-limit (per IP) — best-effort.
        try {
          const hdrs = await headers();
          const ip =
            hdrs.get("cf-connecting-ip") || hdrs.get("x-forwarded-for") || "unknown";
          const allowed = await loginRateLimit(ip);
          if (!allowed) return null;
        } catch {
          /* ignore rate-limit infra errors */
        }

        try {
          const { getD1Db } = await import("@/lib/db/client");
          const db = await getD1Db();

          const row = await db
            .select({
              id: users.id,
              email: users.email,
              name: users.name,
              role: users.role,
              passwordHash: users.passwordHash,
              passwordSalt: users.passwordSalt,
              companyId: users.employerCompanyId,
            })
            .from(users)
            .where(and(eq(users.email, email), eq(users.authProvider, "credentials")))
            .get();

          // Uniform failure to avoid account enumeration.
          if (!row || !row.passwordHash || !row.passwordSalt) return null;

          const ok = await verifyPassword(password, row.passwordHash, row.passwordSalt);
          if (!ok) return null;

          // Reject disabled employer accounts.
          const acct = await db
            .select({ disabledAt: employerAccounts.disabledAt })
            .from(employerAccounts)
            .where(eq(employerAccounts.userId, row.id))
            .get();
          if (acct?.disabledAt) return null;

          await db
            .update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.id, row.id));

          return {
            id: row.id,
            email: row.email,
            name: row.name,
            role: "employer",
            companyId: row.companyId,
          };
        } catch (e) {
          console.error("[auth] employer authorize error:", e);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      // Employer credential sign-in is already validated in authorize().
      if (account?.provider === "credentials") return true;

      if (!account || account.provider !== "google" || !user.email) {
        return false;
      }

      const email = user.email.toLowerCase();

      try {
        const { getD1Db } = await import("@/lib/db/client");
        const db = await getD1Db();

        // Read + clear the invite_token cookie (set by the invite-accept page).
        let invitedEmailMatch = false;
        let inviteId: string | null = null;
        try {
          const cookieStore = await cookies();
          const inviteCookie = cookieStore.get("invite_token");
          if (inviteCookie?.value) {
            cookieStore.delete("invite_token");
            const result = await validateInviteToken(db, inviteCookie.value);
            // Invite must target THIS Google account's email.
            if (result.valid && result.invite.email.toLowerCase() === email) {
              invitedEmailMatch = true;
              inviteId = result.invite.id;
            }
          }
        } catch (cookieErr) {
          console.error("[auth] invite cookie error:", cookieErr);
        }

        const existing = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .get();

        const admin = isAdminEmail(email);

        if (existing) {
          // Never touch employer accounts via Google sign-in.
          if (existing.authProvider === "credentials") return false;

          // Sync admin status against ADMIN_EMAILS.
          if (admin && existing.role !== "admin") {
            await db
              .update(users)
              .set({ role: "admin", status: "approved" })
              .where(eq(users.id, existing.id));
          } else if (!admin && existing.role === "admin") {
            await db
              .update(users)
              .set({ role: "candidate" })
              .where(eq(users.id, existing.id));
          }
          return true;
        }

        // New Google user: must be an admin OR hold a matching, valid invite.
        if (admin) {
          await db.insert(users).values({
            email,
            name: user.name,
            image: user.image,
            role: "admin",
            status: "approved",
            authProvider: "google",
          });
          return true;
        }

        if (!invitedEmailMatch || !inviteId) {
          // Invite-only gate: reject uninvited Google sign-ins.
          return false;
        }

        const newUserId = crypto.randomUUID();
        await db.insert(users).values({
          id: newUserId,
          email,
          name: user.name,
          image: user.image,
          role: "candidate",
          status: "approved", // vetted at invite time
          authProvider: "google",
        });
        await db.insert(candidateProfiles).values({
          userId: newUserId,
          displayName: user.name ?? null,
        });
        await db
          .update(candidateInvites)
          .set({
            status: "accepted",
            acceptedUserId: newUserId,
            useCount: sql`${candidateInvites.useCount} + 1`,
          })
          .where(eq(candidateInvites.id, inviteId));

        return true;
      } catch (e) {
        console.error("[auth] signIn D1 error:", e);
        return false;
      }
    },

    async jwt({ token, user }) {
      // Always re-read role/status from D1 so admin changes apply without re-login.
      try {
        const { getD1Db } = await import("@/lib/db/client");
        const db = await getD1Db();
        const email = token.email ?? user?.email;
        if (email) {
          const dbUser = await db
            .select({
              id: users.id,
              name: users.name,
              role: users.role,
              status: users.status,
              companyId: users.employerCompanyId,
              privacyConsentedAt: users.privacyConsentedAt,
            })
            .from(users)
            .where(eq(users.email, email.toLowerCase()))
            .get();
          if (dbUser) {
            token.id = dbUser.id;
            token.name = dbUser.name;
            token.role = dbUser.role;
            token.status = dbUser.status;
            token.companyId = dbUser.companyId;
            token.privacyConsentedAt = dbUser.privacyConsentedAt
              ? dbUser.privacyConsentedAt.getTime()
              : null;
          }
        }
      } catch (e) {
        console.error("[auth] jwt D1 error:", e);
        if (user) token.id = user.id;
      }
      return token;
    },

    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.name = (token.name as string) ?? null;
        session.user.role = (token.role as string) ?? "candidate";
        session.user.status = (token.status as string) ?? "pending";
        session.user.companyId = (token.companyId as string) ?? null;
        session.user.privacyConsentedAt =
          (token.privacyConsentedAt as number) ?? null;
      }
      return session;
    },
  },
}));
