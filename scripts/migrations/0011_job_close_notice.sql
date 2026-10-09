-- Candidate-facing "this role has closed" notice.
-- Existing databases only. Fresh installs already have close_notice from 0001_init.sql.
-- Safe to apply before the app deploy: old code does not read this column.
-- Apply: npm run db:migrate:remote -- scripts/migrations/0011_job_close_notice.sql
--
-- After deploy, turn a role on from 管理画面 → 企業・求人 → 求人を編集
-- 「候補者に募集終了のお知らせを出す」. Checking it also closes an open role.

ALTER TABLE jobs ADD COLUMN close_notice INTEGER NOT NULL DEFAULT 0;
