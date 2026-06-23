import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

/**
 * Candidate-facing profile — the curated "MyPage". One row per candidate user.
 * Only recruitment-relevant fields; raw contact details stay on `users`.
 */
export const candidateProfiles = sqliteTable("candidate_profiles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  headline: text("headline"), // e.g. "Senior Backend Engineer"
  summary: text("summary"), // candidate-authored, long text
  locationCurrent: text("location_current"),
  locationPreference: text("location_preference"),
  yearsExperience: integer("years_experience"),
  // Work authorization / visa status — first-class for overseas placement.
  workAuthStatus: text("work_auth_status", {
    enum: [
      "us_citizen",
      "green_card",
      "h1b",
      "tn",
      "opt",
      "ca_pr",
      "ca_citizen",
      "needs_sponsorship",
      "other",
    ],
  }),
  visaNotes: text("visa_notes"),
  availability: text("availability"), // free text: immediate / notice period
  englishLevel: text("english_level", {
    enum: ["native", "business", "conversational", "basic"],
  }),
  desiredSalaryMin: integer("desired_salary_min"),
  desiredSalaryMax: integer("desired_salary_max"),
  salaryCurrency: text("salary_currency").notNull().default("USD"),
  resumeKey: text("resume_key"), // R2 object key (PDF)
  resumeFileName: text("resume_file_name"),
  resumeUploadedAt: integer("resume_uploaded_at", { mode: "timestamp" }),
  // 0-100, computed server-side to drive completeness nudges.
  completeness: integer("completeness").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Structured work history. Many rows per profile. */
export const candidateExperiences = sqliteTable(
  "candidate_experiences",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    candidateProfileId: text("candidate_profile_id")
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    company: text("company").notNull(),
    title: text("title").notNull(),
    employmentType: text("employment_type", {
      enum: ["full_time", "contract", "freelance", "internship"],
    }),
    startDate: integer("start_date", { mode: "timestamp" }),
    endDate: integer("end_date", { mode: "timestamp" }),
    isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
    location: text("location"),
    description: text("description"), // bullet-style achievements
    techStack: text("tech_stack"), // comma / newline separated
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("idx_exp_profile").on(t.candidateProfileId)]
);

/** External links (LinkedIn, GitHub, portfolio). Many rows per profile. */
export const candidateLinks = sqliteTable(
  "candidate_links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    candidateProfileId: text("candidate_profile_id")
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["linkedin", "github", "portfolio", "website", "other"],
    })
      .notNull()
      .default("other"),
    url: text("url").notNull(),
    label: text("label"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("idx_link_profile").on(t.candidateProfileId)]
);
