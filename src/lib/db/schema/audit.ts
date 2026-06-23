import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { candidateProfiles } from "./candidates";

/**
 * Append-only view/download audit. Written by the app on every employer read.
 * No update or delete path exists.
 */
export const viewAudit = sqliteTable(
  "view_audit",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorUserId: text("actor_user_id"),
    actorRole: text("actor_role"),
    companyId: text("company_id"),
    candidateProfileId: text("candidate_profile_id").references(
      () => candidateProfiles.id,
      { onDelete: "set null" }
    ),
    action: text("action", {
      enum: [
        "view_list",
        "view_detail",
        "view_resume",
        "download_resume",
        "preview_pdf",
      ],
    }).notNull(),
    accessGrantId: text("access_grant_id"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("idx_audit_candidate").on(t.candidateProfileId, t.createdAt),
    index("idx_audit_actor").on(t.actorUserId, t.createdAt),
  ]
);
