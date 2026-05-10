-- Read-only Postgres role for the internal Issue Detection module.
--
-- The detection-worker polls Rejourney's `sessions` table with a monotonic
-- (ended_at, id) cursor and reads supporting signals from a small fixed set
-- of tables. It must never write.
--
-- ----------------------------------------------------------------------------
-- Role creation is a ONE-TIME MANUAL STEP, not part of this migration.
-- ----------------------------------------------------------------------------
-- This migration runs as the `rejourney` application user, which is the table
-- owner but not a superuser and lacks CREATEROLE (CNPG sets
-- enableSuperuserAccess=false). Drizzle therefore can't issue CREATE ROLE.
--
-- After this migration applies for the first time, an operator runs ONCE:
--
--   kubectl exec -n rejourney postgres-local-1 -c postgres -- \
--     psql -U postgres rejourney <<'SQL'
--   CREATE ROLE issue_detection_reader LOGIN PASSWORD '<from secrets manager>';
--   ALTER  ROLE issue_detection_reader SET default_transaction_read_only = on;
--   GRANT CONNECT ON DATABASE rejourney TO issue_detection_reader;
--   SQL
--
-- (Postgres superuser-only operations: CREATE/ALTER ROLE, GRANT CONNECT.)
--
-- All subsequent grants live in this migration, gated on the role existing.
-- They re-apply harmlessly on every deploy and pick up new tables added below.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'issue_detection_reader') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO issue_detection_reader';
    EXECUTE 'GRANT SELECT ON
      public.sessions,
      public.recording_artifacts,
      public.app_daily_stats,
      public.api_endpoint_daily_stats,
      public.screen_touch_heatmaps,
      public.errors,
      public.anrs,
      public.crashes,
      public.issues,
      public.issue_events
      TO issue_detection_reader';
  END IF;
END
$$;

-- Covering composite index for the detection-worker's poll query
--   SELECT … FROM sessions
--   WHERE status IN ('ready','completed') AND (ended_at, id) > ($1, $2)
--   ORDER BY ended_at, id LIMIT $3
-- Without (status, ended_at, id) Postgres would fall back to sessions_status_idx
-- and a sort, which gets expensive as the table grows. Owned by `rejourney`,
-- so this CREATE doesn't need superuser. CONCURRENTLY can't run inside the
-- transaction drizzle wraps each migration in; if locking impact ever becomes
-- a concern on a much larger table, build the index out-of-band first and let
-- this statement no-op via IF NOT EXISTS.
CREATE INDEX IF NOT EXISTS sessions_status_ended_at_id_idx
  ON public.sessions (status, ended_at, id);
