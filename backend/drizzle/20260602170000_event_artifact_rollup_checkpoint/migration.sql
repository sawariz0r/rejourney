SET lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "recording_artifacts"
  ADD COLUMN IF NOT EXISTS "event_rollup_requested_at" timestamp;
--> statement-breakpoint
ALTER TABLE "recording_artifacts"
  ADD COLUMN IF NOT EXISTS "event_rollup_processed_at" timestamp;
