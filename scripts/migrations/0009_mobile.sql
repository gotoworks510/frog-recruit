-- Mobile API + push + sessions (Phase 0)
-- See docs/IPHONE-APP-SPEC-PROMPT-FABLE.md §5 and docs/IPHONE-APP-OWNER-DECISIONS.md

CREATE TABLE mobile_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_variant TEXT NOT NULL CHECK (app_variant IN ('candidate','employer')),
  device_id TEXT NOT NULL,
  device_name TEXT,
  app_version TEXT,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  previous_token_hash TEXT,
  previous_grace_until INTEGER,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  revoked_reason TEXT
);
CREATE INDEX idx_msess_user ON mobile_sessions(user_id);
CREATE INDEX idx_msess_prev ON mobile_sessions(previous_token_hash);

CREATE TABLE device_push_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_variant TEXT NOT NULL CHECK (app_variant IN ('candidate','employer')),
  device_id TEXT NOT NULL,
  expo_push_token TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  invalidated_at INTEGER,
  last_error TEXT
);
CREATE UNIQUE INDEX uq_push_user_device ON device_push_tokens(user_id, device_id);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data_json TEXT,
  dedupe_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER,
  pushed_at INTEGER,
  push_status TEXT
);
CREATE UNIQUE INDEX uq_notif_user_dedupe ON notifications(user_id, dedupe_key);
CREATE INDEX idx_notif_user_created ON notifications(user_id, created_at DESC);

CREATE TABLE notification_preferences (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  push_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind)
);

CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  app_variant TEXT NOT NULL CHECK (app_variant IN ('candidate','employer')),
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_pwreset_user ON password_reset_tokens(user_id);

ALTER TABLE candidate_introductions ADD COLUMN candidate_response TEXT
  CHECK (candidate_response IN ('interested','consult','pass'));
ALTER TABLE candidate_introductions ADD COLUMN candidate_responded_at INTEGER;
ALTER TABLE candidate_introductions ADD COLUMN response_client_request_id TEXT;

ALTER TABLE candidate_feedback ADD COLUMN client_request_id TEXT;
CREATE UNIQUE INDEX uq_feedback_client_request
  ON candidate_feedback(employer_user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

ALTER TABLE users ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0;
