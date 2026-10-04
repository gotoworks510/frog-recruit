-- Additive; apply locally first. No accounts, grants, or outbound mail.
CREATE TABLE IF NOT EXISTS sales_prospects (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  domain TEXT NOT NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  job_url TEXT,
  contact_name TEXT NOT NULL DEFAULT '',
  contact_role TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  contact_source_url TEXT,
  contact_basis TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'research',
  owner TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  stopped INTEGER NOT NULL DEFAULT 0 CHECK (stopped IN (0,1)),
  stop_reason TEXT NOT NULL DEFAULT '',
  opening_line TEXT NOT NULL DEFAULT '',
  needs TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_domain ON sales_prospects(domain);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_company ON sales_prospects(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_due ON sales_prospects(due_date);
CREATE TABLE IF NOT EXISTS sales_activities (
  id TEXT PRIMARY KEY NOT NULL,
  prospect_id TEXT NOT NULL REFERENCES sales_prospects(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_url TEXT,
  reason TEXT NOT NULL DEFAULT '',
  template_version TEXT NOT NULL DEFAULT '',
  minutes INTEGER NOT NULL DEFAULT 0 CHECK(minutes BETWEEN 0 AND 1440),
  occurred_on TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sales_activity_prospect ON sales_activities(prospect_id);
CREATE INDEX IF NOT EXISTS idx_sales_activity_date ON sales_activities(occurred_on);
-- Preserve evidence even if a converted Inbox entry is targeted for deletion.
CREATE TRIGGER IF NOT EXISTS preserve_converted_job_lead
BEFORE DELETE ON job_leads WHEN OLD.converted_job_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'Converted job leads are retained as evidence'); END;
