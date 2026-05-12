ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "recording_fps" integer DEFAULT 1 NOT NULL;--> statement-breakpoint

UPDATE "projects"
SET "recording_fps" = 1
WHERE "recording_fps" IS NULL;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_recording_fps_check'
  ) THEN
    ALTER TABLE "projects"
      ADD CONSTRAINT "projects_recording_fps_check"
      CHECK ("recording_fps" BETWEEN 1 AND 3);
  END IF;
END $$;
