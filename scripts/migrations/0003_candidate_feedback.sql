-- frog-recruit — 0003: employer feedback on referred candidates.
-- Apply: wrangler d1 execute frog-recruit-db --remote --file=scripts/migrations/0003_candidate_feedback.sql --yes
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS candidate_feedback (
  id                    TEXT PRIMARY KEY,
  employer_user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_profile_id  TEXT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  company_id            TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  interest              TEXT NOT NULL,             -- interested | maybe | not_interested
  wants_interview       INTEGER NOT NULL DEFAULT 0,
  questions_md          TEXT,
  decline_reasons       TEXT,                      -- JSON array of reason codes
  decline_note          TEXT,
  updated_at            INTEGER NOT NULL,
  created_at            INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_employer_candidate
  ON candidate_feedback(employer_user_id, candidate_profile_id);
CREATE INDEX IF NOT EXISTS idx_feedback_candidate ON candidate_feedback(candidate_profile_id);
