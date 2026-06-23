import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/** Hiring companies. Multi-company ready; Palm is row #1. */
export const companies = sqliteTable("companies", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  domain: text("domain"), // e.g. palm.com (sanity, not auth)
  description: text("description"),
  logoKey: text("logo_key"), // R2 object key
  status: text("status", { enum: ["active", "archived"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Jobs / requisitions. Multi-company ready; v1 seeds one Palm job. */
export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryCurrency: text("salary_currency").notNull().default("USD"),
    location: text("location"),
    workAuthRequirement: text("work_auth_requirement"),
    status: text("status", { enum: ["open", "filled", "closed"] })
      .notNull()
      .default("open"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("idx_jobs_company").on(t.companyId)]
);
