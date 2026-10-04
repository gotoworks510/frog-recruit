import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { companies, jobs } from "./companies";

/** Staff-only relationship record; never grants employer access. */
export const salesProspects = sqliteTable("sales_prospects", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  domain: text("domain").notNull(),
  jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
  jobUrl: text("job_url"),
  contactName: text("contact_name").notNull().default(""),
  contactRole: text("contact_role").notNull().default(""),
  contactEmail: text("contact_email").notNull().default(""),
  contactSourceUrl: text("contact_source_url"),
  contactBasis: text("contact_basis").notNull().default(""),
  stage: text("stage").notNull().default("research"),
  owner: text("owner").notNull().default(""),
  nextAction: text("next_action").notNull().default(""),
  dueDate: text("due_date"), // YYYY-MM-DD, calendar date selected by staff
  stopped: integer("stopped", { mode: "boolean" }).notNull().default(false),
  stopReason: text("stop_reason").notNull().default(""),
  openingLine: text("opening_line").notNull().default(""),
  needs: text("needs").notNull().default(""),
  version: integer("version").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (t) => [uniqueIndex("uq_sales_domain").on(t.domain), uniqueIndex("uq_sales_company").on(t.companyId), index("idx_sales_due").on(t.dueDate)]);

/** Append-only staff log. Message contents stay in the original inbox. */
export const salesActivities = sqliteTable("sales_activities", {
  id: text("id").primaryKey(),
  prospectId: text("prospect_id").notNull().references(() => salesProspects.id, { onDelete: "restrict" }),
  kind: text("kind").notNull(),
  summary: text("summary").notNull(),
  sourceUrl: text("source_url"),
  reason: text("reason").notNull().default(""),
  templateVersion: text("template_version").notNull().default(""),
  minutes: integer("minutes").notNull().default(0),
  occurredOn: text("occurred_on").notNull(),
  actorId: text("actor_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (t) => [index("idx_sales_activity_prospect").on(t.prospectId), index("idx_sales_activity_date").on(t.occurredOn)]);

export type SalesProspect = typeof salesProspects.$inferSelect;
export type SalesActivity = typeof salesActivities.$inferSelect;
