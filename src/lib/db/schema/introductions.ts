import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { candidateProfiles } from "./candidates";
import { companies } from "./companies";

export const INTRO_STATUSES = [
  "planned",
  "shared",
  "interviewing",
  "offer",
  "hired",
  "declined",
  "withdrawn",
] as const;

export type IntroStatus = (typeof INTRO_STATUSES)[number];

/**
 * Admin-managed introduction pipeline per (candidate, company).
 * Separate from access_grants (authorization) and candidate_feedback (employer input).
 */
export const candidateIntroductions = sqliteTable(
  "candidate_introductions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    candidateProfileId: text("candidate_profile_id")
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    status: text("status", { enum: INTRO_STATUSES })
      .notNull()
      .default("planned"),
    /** Admin-only; never expose to candidate UI. */
    noteInternal: text("note_internal"),
    /** Optional short note safe for the candidate. */
    statusNote: text("status_note"),
    updatedBy: text("updated_by"),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_intro_profile_company").on(
      t.candidateProfileId,
      t.companyId
    ),
    index("idx_intro_profile").on(t.candidateProfileId),
    index("idx_intro_company").on(t.companyId),
  ]
);
