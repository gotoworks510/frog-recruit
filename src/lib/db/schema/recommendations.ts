import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { candidateProfiles } from "./candidates";
import { jobs, companies } from "./companies";

/**
 * Frog's curation of a candidate — the core differentiator.
 *
 * Recommendations are TARGETED PER COMPANY: a candidate can have a different
 * writeup for each company they're referred to. `companyId = null` is a general
 * recommendation used as a fallback for any company without a specific one.
 *
 * Two independent gates control employer visibility:
 *  - status:     draft → published   (lifecycle)
 *  - visibility: internal_only → shared   (audience)
 * Only a row that is BOTH `published` AND `shared` is surfaced to the matching
 * company, and `internalNotesMd` is NEVER serialized to an employer response.
 */
export const recommendations = sqliteTable(
  "recommendations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    candidateProfileId: text("candidate_profile_id")
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    // Target company for this recommendation. null = general (fallback for any company).
    companyId: text("company_id").references(() => companies.id, {
      onDelete: "cascade",
    }),
    // Optional position/job context at that company.
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    strengthsMd: text("strengths_md"), // 推薦ポイント — shown to employer
    considerationsMd: text("considerations_md"), // 勧められない点 — shown to employer
    internalNotesMd: text("internal_notes_md"), // Frog-staff only — never to employer
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    visibility: text("visibility", { enum: ["internal_only", "shared"] })
      .notNull()
      .default("internal_only"),
    authoredBy: text("authored_by"), // admin user id
    publishedAt: integer("published_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("idx_rec_profile").on(t.candidateProfileId),
    index("idx_rec_company").on(t.companyId),
    index("idx_rec_job").on(t.jobId),
  ]
);
