# Frog Recruit — Job Capture (Chrome MV3)

Local/dev companion for **Job Inbox**. Saves the active LinkedIn / Indeed / Glassdoor job tab into `http://localhost:3005/api/desk/job-leads`.

## Design

**Capture only.** The extension sucks structured fields + raw JD text/HTML off the page.
Readable formatting (headings, bullets, tone) is **deferred** — clean up later with AI or by hand in Job Inbox / after convert.

Do not turn this extension into a formatter or LLM client.

## Setup

1. In frog-recruit `.env.local`:

```bash
JOB_INBOX_ENABLED=1
JOB_INBOX_TOKEN=dev-local-change-me
```

2. Apply the D1 migration to the DB your `.env.local` points at (`DEV_D1_DATABASE_ID`):

```bash
npx wrangler d1 execute frog-recruit-dev-db --remote --file=scripts/migrations/0005_job_leads.sql
```

3. Start the app: `npm run dev` (port 3005).

4. Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → select this `chrome-extension/` folder.

5. Extension **Options**: API base `http://localhost:3005`, token = same as `JOB_INBOX_TOKEN`.

6. Open a job page → click the extension → **Save to Job Inbox** → review at `/admin/job-inbox`.

## Flow

```
Job page (LI / Indeed / Glassdoor)
  → Chrome extension (pick CAD/USD + raw capture)
  → POST /api/desk/job-leads
  → job_leads
  → Admin Job Inbox → (optional later) AI polish → convert to companies/jobs
```

Currency is an **operator choice** at save time (Canada → CAD, US → USD). Default CAD; last pick is remembered in extension storage.

User-initiated only. No background crawling.
