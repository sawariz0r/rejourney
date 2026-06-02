-- Optional production recovery index for the session event rollup sweep.
--
-- Do not put this in the normal Drizzle migration path. On the production
-- recording_artifacts table this can scan tens of millions of rows, so run it
-- manually during a quiet window from psql or another tool that does not wrap
-- the statement in a transaction.
--
-- After this succeeds, RJ_SESSION_EVENT_ROLLUP_SWEEP_ENABLED=true may be used
-- to allow the lifecycle worker to discover pending rollups that lost their
-- BullMQ enqueue.

SET lock_timeout = '5s';
SET statement_timeout = '0';

CREATE INDEX CONCURRENTLY IF NOT EXISTS "recording_artifacts_event_rollup_pending_idx"
  ON "recording_artifacts" ("session_id", "created_at", "id")
  WHERE "status" = 'ready'
    AND "kind" = 'events'
    AND "event_rollup_requested_at" IS NOT NULL
    AND "event_rollup_processed_at" IS NULL;

-- If CREATE INDEX CONCURRENTLY is interrupted, PostgreSQL may leave an invalid
-- index behind. Drop it concurrently, then rerun this file:
--
-- DROP INDEX CONCURRENTLY IF EXISTS "recording_artifacts_event_rollup_pending_idx";
