-- frog-recruit — seed data (idempotent).
-- Admins are created automatically on first Google sign-in via ADMIN_EMAILS,
-- so only the first hiring company + its job are seeded here (Palm MVP).

INSERT OR IGNORE INTO companies (id, name, slug, domain, description, status, created_at)
VALUES (
  'company_palm',
  'Palm',
  'palm',
  'palm.com',
  'Business Identity infrastructure (San Francisco). Backed by Amex Ventures & Better Tomorrow.',
  'active',
  unixepoch()
);

INSERT OR IGNORE INTO jobs (
  id, company_id, title, description,
  salary_min, salary_max, salary_currency,
  location, work_auth_requirement, status, created_at
)
VALUES (
  'job_palm_sbe',
  'company_palm',
  'Senior Backend Engineer',
  'Design and build the core services powering Palm''s platform — high-performance APIs, microservices (data ingestion to compliance workflows), and LLM-driven data syndication.',
  175000,
  190000,
  'USD',
  'San Francisco / Remote',
  '7+ yrs backend (Node.js/TypeScript + Python), microservices, production LLM, startup experience',
  'open',
  unixepoch()
);
