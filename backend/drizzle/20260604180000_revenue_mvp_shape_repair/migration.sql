ALTER TABLE "project_revenue_daily"
  ALTER COLUMN "source_provider" SET DEFAULT 'custom_events';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revenue_provider_transactions_manual_revenue_idx"
  ON "revenue_provider_transactions" ("project_id", "currency", "occurred_at")
  WHERE "provider" = 'custom_events' AND "metadata"->>'source' = 'manual_historical';
