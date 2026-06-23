import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

/**
 * Unified identity table for all three roles.
 * - admin / candidate  → authProvider "google"
 * - employer           → authProvider "credentials" (PBKDF2 password set by an admin)
 *
 * passwordHash / passwordSalt are only populated for employers.
 */
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "timestamp" }),
  image: text("image"),
  role: text("role", { enum: ["admin", "candidate", "employer"] })
    .notNull()
    .default("candidate"),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  authProvider: text("auth_provider", { enum: ["google", "credentials"] })
    .notNull()
    .default("google"),
  // Employer credential auth (PBKDF2). Null for admin / candidate.
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  passwordUpdatedAt: integer("password_updated_at", { mode: "timestamp" }),
  // Links an employer user to its company (null for admin / candidate).
  employerCompanyId: text("employer_company_id"),
  privacyConsentedAt: integer("privacy_consented_at", { mode: "timestamp" }),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// --- NextAuth schema-completeness tables (unused under the JWT strategy) ---

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);
