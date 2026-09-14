-- Job Inbox: capture-time currency hint (CAD / USD) for Canada vs US roles.
ALTER TABLE job_leads ADD COLUMN salary_currency TEXT NOT NULL DEFAULT 'CAD';
