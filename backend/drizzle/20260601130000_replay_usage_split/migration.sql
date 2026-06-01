SET lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "project_usage"
  ADD COLUMN IF NOT EXISTS "session_replays" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "billing_usage"
  ADD COLUMN IF NOT EXISTS "session_replays" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "replay_quota_counted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "billing_notifications"
  ADD COLUMN IF NOT EXISTS "dedupe_key" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_cutovers" (
  "name" varchar(128) PRIMARY KEY,
  "cutover_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT NOW() NOT NULL
);
--> statement-breakpoint

-- Preserve the current billing ledger exactly: before this migration,
-- project_usage.sessions was the quota number shown to customers.
UPDATE "project_usage"
SET "session_replays" = "sessions"
WHERE "session_replays" = 0
  AND "sessions" <> 0;
--> statement-breakpoint
UPDATE "billing_usage"
SET "session_replays" = "sessions"
WHERE "session_replays" = 0
  AND "sessions" <> 0;
--> statement-breakpoint

-- Do not update or index the hot sessions table in the deploy migration. After
-- the app rollout, production cutover is finalized over SSH by raising the
-- preserved usage ledgers from live sessions and inserting the
-- billing_cutovers('replay_usage_split') row. Runtime replay counting stays
-- paused until that cutover row exists.

-- Keep existing warning rows as the canonical "already sent" records without
-- failing if old duplicate rows exist. Only the oldest row gets the dedupe key.
WITH ranked_notifications AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "team_id", "period", "type"
      ORDER BY "sent_at" ASC, "id" ASC
    ) AS row_num
  FROM "billing_notifications"
  WHERE "team_id" IS NOT NULL
    AND "type" IN ('warning_80', 'limit_100')
    AND "dedupe_key" IS NULL
)
UPDATE "billing_notifications" AS bn
SET "dedupe_key" = CONCAT('team:', bn."team_id", ':period:', bn."period", ':type:', bn."type")
FROM ranked_notifications rn
WHERE bn."id" = rn."id"
  AND rn.row_num = 1;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_notifications_dedupe_key_unique"
  ON "billing_notifications" ("dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;
