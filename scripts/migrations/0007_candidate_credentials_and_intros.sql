-- Candidate credentials (mirror employer_accounts) + introduction status per company.

CREATE TABLE IF NOT EXISTS candidate_accounts (
  id                          TEXT PRIMARY KEY,
  user_id                     TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  must_reset_password         INTEGER NOT NULL DEFAULT 1,
  disabled_at                 INTEGER,
  last_password_rotation_at   INTEGER,
  created_by                  TEXT,
  created_at                  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS candidate_introductions (
  id                    TEXT PRIMARY KEY,
  candidate_profile_id  TEXT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  company_id            TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- planned | shared | interviewing | offer | hired | declined | withdrawn
  status                TEXT NOT NULL DEFAULT 'planned',
  note_internal         TEXT,
  status_note           TEXT,
  updated_by            TEXT,
  updated_at            INTEGER NOT NULL,
  created_at            INTEGER NOT NULL,
  UNIQUE (candidate_profile_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_intro_profile ON candidate_introductions(candidate_profile_id);
CREATE INDEX IF NOT EXISTS idx_intro_company ON candidate_introductions(company_id);
