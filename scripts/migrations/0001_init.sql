-- frog-recruit — initial schema (canonical, hand-written).
-- Apply: wrangler d1 execute frog-recruit-db --local|--remote --file=scripts/migrations/0001_init.sql
-- Timestamps are stored as Unix seconds (drizzle mode:"timestamp"); booleans as 0/1.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Identity (all roles)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                    TEXT PRIMARY KEY,
  name                  TEXT,
  email                 TEXT NOT NULL UNIQUE,
  email_verified        INTEGER,
  image                 TEXT,
  role                  TEXT NOT NULL DEFAULT 'candidate',   -- admin | candidate | employer
  status                TEXT NOT NULL DEFAULT 'pending',     -- pending | approved | rejected
  auth_provider         TEXT NOT NULL DEFAULT 'google',      -- google | credentials
  password_hash         TEXT,
  password_salt         TEXT,
  password_updated_at   INTEGER,
  employer_company_id   TEXT,
  privacy_consented_at  INTEGER,
  last_login_at         INTEGER,
  created_at            INTEGER NOT NULL
);

-- NextAuth schema-completeness tables (unused under JWT strategy)
CREATE TABLE IF NOT EXISTS accounts (
  userId               TEXT NOT NULL,
  type                 TEXT NOT NULL,
  provider             TEXT NOT NULL,
  providerAccountId    TEXT NOT NULL,
  refresh_token        TEXT,
  access_token         TEXT,
  expires_at           INTEGER,
  token_type           TEXT,
  scope                TEXT,
  id_token             TEXT,
  session_state        TEXT,
  PRIMARY KEY (provider, providerAccountId)
);

CREATE TABLE IF NOT EXISTS sessions (
  sessionToken  TEXT PRIMARY KEY,
  userId        TEXT NOT NULL,
  expires       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier  TEXT NOT NULL,
  token       TEXT NOT NULL,
  expires     INTEGER NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ---------------------------------------------------------------------------
-- Candidate profile + structured data
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidate_profiles (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name          TEXT,
  headline              TEXT,
  summary               TEXT,
  location_current      TEXT,
  location_preference   TEXT,
  years_experience      INTEGER,
  work_auth_status      TEXT,
  visa_notes            TEXT,
  availability          TEXT,
  english_level         TEXT,
  desired_salary_min    INTEGER,
  desired_salary_max    INTEGER,
  salary_currency       TEXT NOT NULL DEFAULT 'USD',
  resume_key            TEXT,
  resume_file_name      TEXT,
  resume_uploaded_at    INTEGER,
  completeness          INTEGER NOT NULL DEFAULT 0,
  updated_at            INTEGER NOT NULL,
  created_at            INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS candidate_experiences (
  id                    TEXT PRIMARY KEY,
  candidate_profile_id  TEXT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  company               TEXT NOT NULL,
  title                 TEXT NOT NULL,
  employment_type       TEXT,
  start_date            INTEGER,
  end_date              INTEGER,
  is_current            INTEGER NOT NULL DEFAULT 0,
  location              TEXT,
  description           TEXT,
  tech_stack            TEXT,
  sort_order            INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_exp_profile ON candidate_experiences(candidate_profile_id);

CREATE TABLE IF NOT EXISTS candidate_links (
  id                    TEXT PRIMARY KEY,
  candidate_profile_id  TEXT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  kind                  TEXT NOT NULL DEFAULT 'other',
  url                   TEXT NOT NULL,
  label                 TEXT,
  sort_order            INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_link_profile ON candidate_links(candidate_profile_id);

-- ---------------------------------------------------------------------------
-- Companies + jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  domain      TEXT,
  description TEXT,
  logo_key    TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id                    TEXT PRIMARY KEY,
  company_id            TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  description           TEXT,
  salary_min            INTEGER,
  salary_max            INTEGER,
  salary_currency       TEXT NOT NULL DEFAULT 'USD',
  location              TEXT,
  work_auth_requirement TEXT,
  status                TEXT NOT NULL DEFAULT 'open',
  created_at            INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);

-- ---------------------------------------------------------------------------
-- Recommendations (Frog curation)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendations (
  id                    TEXT PRIMARY KEY,
  candidate_profile_id  TEXT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  company_id            TEXT REFERENCES companies(id) ON DELETE CASCADE, -- target company; null = general fallback
  job_id                TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  strengths_md          TEXT,
  considerations_md     TEXT,
  internal_notes_md     TEXT,
  status                TEXT NOT NULL DEFAULT 'draft',          -- draft | published
  visibility            TEXT NOT NULL DEFAULT 'internal_only',  -- internal_only | shared
  authored_by           TEXT,
  published_at          INTEGER,
  updated_at            INTEGER NOT NULL,
  created_at            INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rec_profile ON recommendations(candidate_profile_id);
CREATE INDEX IF NOT EXISTS idx_rec_company ON recommendations(company_id);
CREATE INDEX IF NOT EXISTS idx_rec_job ON recommendations(job_id);

-- ---------------------------------------------------------------------------
-- Employer accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employer_accounts (
  id                        TEXT PRIMARY KEY,
  user_id                   TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_id                TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_name              TEXT,
  must_reset_password       INTEGER NOT NULL DEFAULT 1,
  disabled_at               INTEGER,
  last_password_rotation_at INTEGER,
  created_by                TEXT,
  created_at                INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_employer_company ON employer_accounts(company_id);

-- ---------------------------------------------------------------------------
-- Access grants + consents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS access_grants (
  id                    TEXT PRIMARY KEY,
  employer_user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_profile_id  TEXT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  company_id            TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id                TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  granted_by            TEXT,
  granted_at            INTEGER NOT NULL,
  expires_at            INTEGER,
  revoked_at            INTEGER,
  can_download_resume   INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_grant_employer_candidate
  ON access_grants(employer_user_id, candidate_profile_id);
CREATE INDEX IF NOT EXISTS idx_grant_employer ON access_grants(employer_user_id);
CREATE INDEX IF NOT EXISTS idx_grant_candidate ON access_grants(candidate_profile_id);

CREATE TABLE IF NOT EXISTS candidate_consents (
  id                    TEXT PRIMARY KEY,
  candidate_profile_id  TEXT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  scope                 TEXT NOT NULL DEFAULT 'share_with_company',
  company_id            TEXT REFERENCES companies(id) ON DELETE CASCADE,
  consent_text_version  TEXT,
  ip_at_consent         TEXT,
  consented_at          INTEGER NOT NULL,
  revoked_at            INTEGER
);
CREATE INDEX IF NOT EXISTS idx_consent_profile ON candidate_consents(candidate_profile_id);

-- ---------------------------------------------------------------------------
-- View audit (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS view_audit (
  id                    TEXT PRIMARY KEY,
  actor_user_id         TEXT,
  actor_role            TEXT,
  company_id            TEXT,
  candidate_profile_id  TEXT REFERENCES candidate_profiles(id) ON DELETE SET NULL,
  action                TEXT NOT NULL,
  access_grant_id       TEXT,
  ip                    TEXT,
  user_agent            TEXT,
  created_at            INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_candidate ON view_audit(candidate_profile_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON view_audit(actor_user_id, created_at);

-- ---------------------------------------------------------------------------
-- Candidate invites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidate_invites (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL,
  name              TEXT,
  token             TEXT NOT NULL UNIQUE,
  status            TEXT NOT NULL DEFAULT 'invited',  -- invited | accepted | expired | revoked
  max_uses          INTEGER NOT NULL DEFAULT 1,
  use_count         INTEGER NOT NULL DEFAULT 0,
  expires_at        INTEGER NOT NULL,
  revoked_at        INTEGER,
  accepted_user_id  TEXT,
  created_by        TEXT,
  created_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invite_email ON candidate_invites(email);
