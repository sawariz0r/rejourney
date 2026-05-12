ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "text_input_masking" varchar(32) DEFAULT 'all' NOT NULL;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_text_input_masking_check'
  ) THEN
    ALTER TABLE "projects"
      ADD CONSTRAINT "projects_text_input_masking_check"
      CHECK ("text_input_masking" IN ('all', 'secure_only'));
  END IF;
END $$;
