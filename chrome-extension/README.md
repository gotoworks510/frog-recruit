# Frog Recruit — Job Capture (Chrome MV3)

Local/dev companion for **Job Inbox**. Saves the active LinkedIn / Indeed / Glassdoor job tab into `http://localhost:3005/api/desk/job-leads`.

## Setup

1. In frog-recruit `.env.local`:

```bash
JOB_INBOX_ENABLED=1
JOB_INBOX_TOKEN=dev-local-change-me
```

2. Apply the local D1 migration (or your DEV D1):

```bash
npx wrangler d1 execute frog-recruit-db --local --file=scripts/migrations/0005_job_leads.sql
# or against DEV remote:
# npx wrangler d1 execute frog-recruit-db --remote --file=scripts/migrations/0005_job_leads.sql
```

3. Start the app: `npm run dev` (port 3005).

4. Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → select this `chrome-extension/` folder.

5. Extension **Options**: API base `http://localhost:3005`, token = same as `JOB_INBOX_TOKEN`.

6. Open a job page → click the extension → **Save to Job Inbox** → review at `/admin/job-inbox`.

## Flow

```
Job page (LI / Indeed / Glassdoor)
  → Chrome extension (DOM extract)
  → POST /api/desk/job-leads (Bearer token)
  → job_leads table
  → Admin Job Inbox → optional convert → companies/jobs
```

Does not scrape sites in the background. Capture is user-initiated on a page you already opened.
