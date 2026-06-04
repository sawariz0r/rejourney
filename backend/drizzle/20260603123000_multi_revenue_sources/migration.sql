SET lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_revenue_source_settings" (
  "project_id" uuid PRIMARY KEY NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "active_provider" varchar(32),
  "connected_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_revenue_source_settings_active_idx"
  ON "project_revenue_source_settings" ("active_provider");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_revenue_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
  "connected_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "provider" varchar(32) NOT NULL,
  "external_account_id" varchar(255),
  "external_account_name" varchar(255),
  "status" varchar(32) DEFAULT 'connected' NOT NULL,
  "scope" text,
  "access_token_encrypted" text,
  "refresh_token_encrypted" text,
  "api_key_encrypted" text,
  "api_key_last4" varchar(16),
  "token_expires_at" timestamp,
  "connection_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "custom_event_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_sync_started_at" timestamp,
  "last_sync_completed_at" timestamp,
  "last_sync_error" text,
  "oldest_synced_at" timestamp,
  "newest_synced_at" timestamp,
  "cursor" varchar(255),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_revenue_connections_project_provider_unique"
  ON "project_revenue_connections" ("project_id", "provider");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_revenue_connections_team_idx"
  ON "project_revenue_connections" ("team_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_revenue_connections_provider_status_idx"
  ON "project_revenue_connections" ("provider", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "revenue_provider_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "connection_id" uuid NOT NULL REFERENCES "project_revenue_connections"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "provider" varchar(32) NOT NULL,
  "external_transaction_id" varchar(255) NOT NULL,
  "external_source_id" varchar(255),
  "occurred_at" timestamp NOT NULL,
  "amount_cents" integer NOT NULL,
  "fee_cents" integer DEFAULT 0 NOT NULL,
  "net_cents" integer NOT NULL,
  "gross_amount_cents" integer DEFAULT 0 NOT NULL,
  "refund_amount_cents" integer DEFAULT 0 NOT NULL,
  "currency" varchar(12) NOT NULL,
  "type" varchar(80) NOT NULL,
  "reporting_category" varchar(80),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "imported_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "revenue_provider_transactions_project_provider_tx_unique"
  ON "revenue_provider_transactions" ("project_id", "provider", "external_transaction_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revenue_provider_transactions_project_provider_date_idx"
  ON "revenue_provider_transactions" ("project_id", "provider", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revenue_provider_transactions_connection_idx"
  ON "revenue_provider_transactions" ("connection_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revenue_provider_transactions_manual_revenue_idx"
  ON "revenue_provider_transactions" ("project_id", "currency", "occurred_at")
  WHERE "provider" = 'custom_events' AND "metadata"->>'source' = 'manual_historical';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_revenue_daily" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "source_provider" varchar(32) DEFAULT 'custom_events' NOT NULL,
  "date" date NOT NULL,
  "currency" varchar(12) NOT NULL,
  "gross_amount_cents" integer DEFAULT 0 NOT NULL,
  "refund_amount_cents" integer DEFAULT 0 NOT NULL,
  "fee_amount_cents" integer DEFAULT 0 NOT NULL,
  "net_amount_cents" integer DEFAULT 0 NOT NULL,
  "transaction_count" integer DEFAULT 0 NOT NULL,
  "refund_count" integer DEFAULT 0 NOT NULL,
  "subscriber_count" integer DEFAULT 0 NOT NULL,
  "trial_count" integer DEFAULT 0 NOT NULL,
  "subscription_start_count" integer DEFAULT 0 NOT NULL,
  "cancellation_count" integer DEFAULT 0 NOT NULL,
  "conversion_count" integer DEFAULT 0 NOT NULL,
  "custom_event_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_revenue_daily"
  ADD COLUMN IF NOT EXISTS "source_provider" varchar(32) DEFAULT 'custom_events' NOT NULL,
  ADD COLUMN IF NOT EXISTS "subscriber_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "trial_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "subscription_start_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "cancellation_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "conversion_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "custom_event_counts" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "project_revenue_daily"
  ALTER COLUMN "source_provider" SET DEFAULT 'custom_events';
--> statement-breakpoint
DROP INDEX IF EXISTS "project_revenue_daily_project_date_currency_unique";
--> statement-breakpoint
DROP INDEX IF EXISTS "project_revenue_daily_project_date_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "project_revenue_daily_project_currency_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_revenue_daily_project_source_date_currency_unique"
  ON "project_revenue_daily" ("project_id", "source_provider", "date", "currency");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_revenue_daily_project_source_date_idx"
  ON "project_revenue_daily" ("project_id", "source_provider", "date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_revenue_daily_project_source_currency_idx"
  ON "project_revenue_daily" ("project_id", "source_provider", "currency");
