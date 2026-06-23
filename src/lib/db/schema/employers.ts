import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";
import { companies } from "./companies";

/**
 * Employer-facing operational metadata. The login identity + PBKDF2 password
 * live on `users` (so the NextAuth session is uniform); this table holds the
 * admin-managed employer record.
 */
export const employerAccounts = sqliteTable(
  "employer_accounts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    contactName: text("contact_name"),
    // Set when an admin hands over a temp password; forces change on first login.
    mustResetPassword: integer("must_reset_password", { mode: "boolean" })
      .notNull()
      .default(true),
    // Soft-disable without deleting the account / its audit trail.
    disabledAt: integer("disabled_at", { mode: "timestamp" }),
    lastPasswordRotationAt: integer("last_password_rotation_at", {
      mode: "timestamp",
    }),
    createdBy: text("created_by"), // admin user id
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("idx_employer_company").on(t.companyId)]
);
