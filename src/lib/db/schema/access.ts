import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { users } from "./auth";
import { candidateProfiles } from "./candidates";
import { companies, jobs } from "./companies";

/**
 * The employer ↔ candidate authorization spine.
 *
 * Effective access (checked by requireGrant on every employer read):
 *   grant exists
 *   AND revokedAt IS NULL
 *   AND (expiresAt IS NULL OR expiresAt > now)
 *   AND an active candidate consent covers this company
 *   AND a published + shared recommendation exists for the candidate
 */
export const accessGrants = sqliteTable(
  "access_grants",
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
    // Denormalized for fast list-scoping / consent checks.
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    grantedBy: text("granted_by"), // admin user id
    grantedAt: integer("granted_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    expiresAt: integer("expires_at", { mode: "timestamp" }), // null = no expiry
    revokedAt: integer("revoked_at", { mode: "timestamp" }), // null = active
    // Granular: view-detail is always allowed by a grant; download is opt-in.
    canDownloadResume: integer("can_download_resume", { mode: "boolean" })
      .notNull()
      .default(true),
  },
  (t) => [
    uniqueIndex("uq_grant_employer_candidate").on(
      t.employerUserId,
      t.candidateProfileId
    ),
    index("idx_grant_employer").on(t.employerUserId),
    index("idx_grant_candidate").on(t.candidateProfileId),
  ]
);

/**
 * Candidate consent to be shared. A grant for a company does not resolve
 * unless an active (revokedAt IS NULL) consent covers that company.
 */
export const candidateConsents = sqliteTable(
  "candidate_consents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    candidateProfileId: text("candidate_profile_id")
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    scope: text("scope", {
      enum: ["share_with_employers", "share_with_company"],
    })
      .notNull()
      .default("share_with_company"),
    // Required when scope = share_with_company.
    companyId: text("company_id").references(() => companies.id, {
      onDelete: "cascade",
    }),
    consentTextVersion: text("consent_text_version"),
    ipAtConsent: text("ip_at_consent"),
    consentedAt: integer("consented_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
  },
  (t) => [index("idx_consent_profile").on(t.candidateProfileId)]
);
