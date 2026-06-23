import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Candidate invitations (invite-only onboarding). Email-targeted single-use
 * tokens: the invite link only works for the intended Google account (email
 * must match at sign-in time).
 */
export const candidateInvites = sqliteTable(
  "candidate_invites",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    name: text("name"),
    token: text("token")
      .notNull()
      .unique()
      .$defaultFn(() => crypto.randomUUID()),
    status: text("status", {
      enum: ["invited", "accepted", "expired", "revoked"],
    })
      .notNull()
      .default("invited"),
    maxUses: integer("max_uses").notNull().default(1),
    useCount: integer("use_count").notNull().default(0),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
    acceptedUserId: text("accepted_user_id"),
    createdBy: text("created_by"), // admin user id
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("idx_invite_email").on(t.email)]
);
