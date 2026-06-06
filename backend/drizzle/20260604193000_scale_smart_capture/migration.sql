SET lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "projects"
    ADD COLUMN IF NOT EXISTS "smart_capture_enabled" boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS "smart_capture_mode" varchar(32) DEFAULT 'record_all' NOT NULL,
    ADD COLUMN IF NOT EXISTS "smart_capture_preset" varchar(64) DEFAULT 'none' NOT NULL,
    ADD COLUMN IF NOT EXISTS "smart_capture_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
    ADD COLUMN IF NOT EXISTS "smart_capture_decision_window_hours" integer DEFAULT 168 NOT NULL;
--> statement-breakpoint
ALTER TABLE "sessions"
    ADD COLUMN IF NOT EXISTS "smart_capture_status" varchar(32) DEFAULT 'not_applicable' NOT NULL,
    ADD COLUMN IF NOT EXISTS "smart_capture_reason" varchar(120),
    ADD COLUMN IF NOT EXISTS "smart_capture_rule_id" varchar(120),
    ADD COLUMN IF NOT EXISTS "smart_capture_decided_at" timestamp,
    ADD COLUMN IF NOT EXISTS "replay_retention_state" varchar(32);

-- Do not backfill or index the hot sessions table in the deploy migration.
-- Existing rows keep replay_retention_state=NULL, which means "legacy row; use
-- the old replay_available/recording_deleted/is_replay_expired/quota guards."
-- New app code writes precise states (not_available, buffered, analytics_only,
-- saved) as sessions reconcile.
--
-- Build the session indexes out-of-band with
-- drizzle/manual/smart-capture-session-indexes-concurrent.sql, which uses
-- CREATE INDEX CONCURRENTLY and therefore cannot run inside Drizzle's
-- migration transaction.
