ALTER TABLE "screen_touch_heatmaps"
  ADD COLUMN IF NOT EXISTS "page_width" integer,
  ADD COLUMN IF NOT EXISTS "page_height" integer,
  ADD COLUMN IF NOT EXISTS "viewport_width" integer,
  ADD COLUMN IF NOT EXISTS "viewport_height" integer;
