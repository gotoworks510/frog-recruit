-- frog-recruit — 0005: Job Inbox leads (Chrome extension / Client Ops capture).
-- Local:  wrangler d1 execute frog-recruit-db --local --file=scripts/migrations/0005_job_leads.sql
-- Remote: only apply when intentionally enabling Job Inbox outside local prototyping.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS job_leads (
  id                    TEXT PRIMARY KEY,
  source                TEXT NOT NULL DEFAULT 'other',
  source_url            TEXT NOT NULL,
  external_id           TEXT,
  company_name_raw      TEXT,
  title_raw             TEXT,
  location_raw          TEXT,
  description_raw       TEXT,
  salary_raw            TEXT,
  posted_at_raw         TEXT,
  status                TEXT NOT NULL DEFAULT 'new',
  score                 INTEGER NOT NULL DEFAULT 0,
  raw_payload_json      TEXT,
  converted_company_id  TEXT,
  converted_job_id      TEXT,
  captured_by           TEXT,
  notes_md              TEXT,
  captured_at           INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_job_leads_source_url ON job_leads(source_url);
CREATE INDEX IF NOT EXISTS idx_job_leads_status ON job_leads(status);
CREATE INDEX IF NOT EXISTS idx_job_leads_source ON job_leads(source);
CREATE INDEX IF NOT EXISTS idx_job_leads_captured ON job_leads(captured_at);
