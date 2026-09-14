import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

/**
 * Candidate operational metadata for credentials login (mirrors employer_accounts).
 * Password hash/salt live on `users`; this table holds must-reset / disabled flags.
 */
export const candidateAccounts = sqliteTable("candidate_accounts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  mustResetPassword: integer("must_reset_password", { mode: "boolean" })
    .notNull()
    .default(true),
  disabledAt: integer("disabled_at", { mode: "timestamp" }),
  lastPasswordRotationAt: integer("last_password_rotation_at", {
    mode: "timestamp",
  }),
  createdBy: text("created_by"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
