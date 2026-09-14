import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Raw job leads captured from LinkedIn / Indeed / Glassdoor (or manual URL).
 * Client-ops inbox — NOT the canonical `jobs` table until explicitly converted.
 *
 * Dev/prototype surface for Chrome extension → Job Inbox flow.
 */
export const jobLeads = sqliteTable(
  "job_leads",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    source: text("source", {
      enum: ["linkedin", "indeed", "glassdoor", "manual", "other"],
    })
      .notNull()
      .default("other"),
    sourceUrl: text("source_url").notNull(),
    externalId: text("external_id"),
    companyNameRaw: text("company_name_raw"),
    titleRaw: text("title_raw"),
    locationRaw: text("location_raw"),
    descriptionRaw: text("description_raw"),
    salaryRaw: text("salary_raw"),
    postedAtRaw: text("posted_at_raw"),
    status: text("status", {
      enum: ["new", "triaged", "converted", "rejected", "snoozed"],
    })
      .notNull()
      .default("new"),
    score: integer("score").notNull().default(0),
    rawPayloadJson: text("raw_payload_json"),
    /** Set when promoted into canonical companies/jobs. */
    convertedCompanyId: text("converted_company_id"),
    convertedJobId: text("converted_job_id"),
    capturedBy: text("captured_by"), // staff user id or "extension"
    notesMd: text("notes_md"),
    capturedAt: integer("captured_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_job_leads_source_url").on(t.sourceUrl),
    index("idx_job_leads_status").on(t.status),
    index("idx_job_leads_source").on(t.source),
    index("idx_job_leads_captured").on(t.capturedAt),
  ]
);

export type JobLeadSource = (typeof jobLeads.$inferSelect)["source"];
export type JobLeadStatus = (typeof jobLeads.$inferSelect)["status"];
