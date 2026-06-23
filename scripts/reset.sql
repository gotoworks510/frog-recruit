-- frog-recruit — drop all tables (used by `npm run db:reset` before re-applying schema).
-- Order respects foreign keys (children first).
DROP TABLE IF EXISTS view_audit;
DROP TABLE IF EXISTS access_grants;
DROP TABLE IF EXISTS candidate_consents;
DROP TABLE IF EXISTS recommendations;
DROP TABLE IF EXISTS candidate_experiences;
DROP TABLE IF EXISTS candidate_links;
DROP TABLE IF EXISTS employer_accounts;
DROP TABLE IF EXISTS jobs;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS candidate_invites;
DROP TABLE IF EXISTS candidate_profiles;
DROP TABLE IF EXISTS verification_tokens;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS users;
