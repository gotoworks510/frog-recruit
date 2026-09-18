import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { users } from "./auth";
import { candidateProfiles } from "./candidates";
import { companies } from "./companies";

/**
 * Employer feedback on a referred candidate: interest level, an interview
 * request, questions / info the employer wants, and — when declining —
 * structured reasons plus a free-text note. One row per (employer, candidate),
 * upserted on save. Visible to Frog admins to close the referral loop.
 */
export const candidateFeedback = sqliteTable(
  "candidate_feedback",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    employerUserId: text("employer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    candidateProfileId: text("candidate_profile_id")
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    // Denormalized for admin filtering / grouping by company.
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    interest: text("interest", {
      enum: ["interested", "maybe", "not_interested"],
    }).notNull(),
    wantsInterview: integer("wants_interview", { mode: "boolean" })
      .notNull()
      .default(false),
    // Free text: things to ask the candidate / more info wanted.
    questionsMd: text("questions_md"),
    // JSON array of reason codes (see DECLINE_REASONS) when interest = not_interested.
    declineReasons: text("decline_reasons"),
    declineNote: text("decline_note"),
    /** Offline / retry idempotency (unique per employer when set). */
    clientRequestId: text("client_request_id"),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_feedback_employer_candidate").on(
      t.employerUserId,
      t.candidateProfileId
    ),
    index("idx_feedback_candidate").on(t.candidateProfileId),
  ]
);
