-- frog-recruit migration 0002 — per-company recommendations.
-- Adds a target company to recommendations (null = general fallback).
-- Apply: wrangler d1 execute frog-recruit-db --remote --file=scripts/migrations/0002_rec_company.sql --yes

ALTER TABLE recommendations ADD COLUMN company_id TEXT REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_rec_company ON recommendations(company_id);
