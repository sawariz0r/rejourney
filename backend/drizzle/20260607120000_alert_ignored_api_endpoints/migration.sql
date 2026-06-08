ALTER TABLE "alert_settings"
ADD COLUMN IF NOT EXISTS "ignored_api_endpoints" jsonb DEFAULT '[]'::jsonb NOT NULL;
