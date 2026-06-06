-- Smart Capture session indexes for production.
--
-- Run manually during a quiet window from psql or another tool that does not
-- wrap this file in a transaction. CREATE INDEX CONCURRENTLY is intentionally
-- not part of the normal Drizzle migration path.

SET lock_timeout = '5s';
SET statement_timeout = '30min';

CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_smart_capture_status_started_idx"
    ON "sessions" ("smart_capture_status", "started_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_replay_retention_state_started_idx"
    ON "sessions" ("replay_retention_state", "started_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_archive_saved_replay_idx"
    ON "sessions" ("project_id", "started_at")
    WHERE "replay_available" = true AND COALESCE("replay_retention_state", 'saved') = 'saved';

-- If CREATE INDEX CONCURRENTLY is interrupted, PostgreSQL may leave an invalid
-- index behind. Check with:
--   SELECT indexrelid::regclass, indisvalid, indisready
--   FROM pg_index
--   WHERE indexrelid::regclass::text IN (
--     'sessions_smart_capture_status_started_idx',
--     'sessions_replay_retention_state_started_idx',
--     'sessions_archive_saved_replay_idx'
--   );
-- Drop and rerun this file for any invalid index.
